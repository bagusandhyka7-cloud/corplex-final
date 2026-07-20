/*
 * POST /api/admin — operasi back-office MRWP dengan service-role key (server-side saja).
 * Gate RBAC: JWT Supabase Auth dengan role super_admin di app_users (diverifikasi server),
 * ATAU ADMIN_PASSWORD (env) sebagai jalur darurat single-admin.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY / ADMIN_PASSWORD belum diisi di .env.local." }, { status: 501 });
  }
  const { password, op, args, token } = await req.json().catch(() => ({})) as { password?: string; op?: string; args?: Record<string, unknown>; token?: string };
  const sb = svc();
  let authorized = password === process.env.ADMIN_PASSWORD;
  if (!authorized && token) {
    const { data: u } = await sb.auth.getUser(token);
    if (u?.user) {
      const { data: me } = await sb.from("app_users").select("role").eq("user_id", u.user.id).maybeSingle();
      authorized = me?.role === "super_admin";
    }
  }
  if (!authorized) {
    return Response.json({ error: "Akses ditolak — butuh akun super admin." }, { status: 401 });
  }
  try {
    if (op === "auth") return Response.json({ ok: true });

    /* Kursi/user kini di app_users (tenant_id text — tanpa FK ke tenants) → gabung manual, bukan embed. */
    const seatsFor = async (ids: string[]) => {
      if (!ids.length) return {} as Record<string, unknown[]>;
      const { data } = await sb.from("app_users").select("tenant_id,nama,email,jabatan,active").in("tenant_id", ids);
      const by: Record<string, unknown[]> = {};
      (data || []).forEach((u) => { (by[u.tenant_id] ??= []).push(u); });
      return by;
    };

    if (op === "listPending") {
      const { data, error } = await sb.from("tenants")
        .select("id,name,created_at,company_documents(id,jenis,nama,dok_url)")
        .eq("status", "pending_review").order("created_at", { ascending: false });
      if (error) throw error;
      const by = await seatsFor((data || []).map((t) => String(t.id)));
      return Response.json({ ok: true, data: (data || []).map((t) => ({ ...t, users: by[String(t.id)] || [] })) });
    }

    if (op === "listTenants") {
      const { data, error } = await sb.from("tenants")
        .select("id,name,tier,status")
        .eq("status", "active").order("created_at");
      if (error) throw error;
      const by = await seatsFor((data || []).map((t) => String(t.id)));
      return Response.json({ ok: true, data: (data || []).map((t) => ({ ...t, users: by[String(t.id)] || [] })) });
    }

    if (op === "decideTenant") {
      const id = String(args?.id || "");
      const approve = !!args?.approve;
      const reason = String(args?.reason || "");
      const { error } = await sb.from("tenants").update(
        approve
          ? { status: "active", decided_at: new Date().toISOString() }
          : { status: "rejected", rejected_reason: reason || "Ditolak.", decided_at: new Date().toISOString() },
      ).eq("id", id);
      if (error) throw error;
      await sb.from("audit_logs").insert({ action: approve ? "approve_tenant" : "reject_tenant", detail: { id, reason }, actor: "adminmrwp" });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Operasi tidak dikenal." }, { status: 400 });
  } catch {
    return Response.json({ error: "Gagal memproses permintaan admin." }, { status: 500 });
  }
}
