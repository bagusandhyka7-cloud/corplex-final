/*
 * POST /api/admin — operasi back-office MRWP dengan service-role key (server-side saja).
 * Gate RBAC: JWT Supabase Auth dengan role super_admin di app_users (diverifikasi server),
 * ATAU ADMIN_PASSWORD (env) sebagai jalur darurat single-admin.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { limited, tooMany } from "@/lib/ratelimit";
import { sendMail } from "@/lib/mail";

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function POST(req: NextRequest) {
  if (limited(req, "admin", 60)) return tooMany(); // panel internal memanggil banyak op per muat
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

    /* Permintaan demo dari halaman login — dibaca panel Approval (bug: dulu tak pernah ditampilkan). */
    if (op === "listDemo") {
      const { data, error } = await sb.from("demo_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return Response.json({ ok: true, data: data || [] });
    }
    if (op === "decideDemo") {
      const { id, status } = (args || {}) as { id?: string; status?: string };
      if (!id || !status) return Response.json({ error: "id/status wajib" }, { status: 400 });
      const { error } = await sb.from("demo_requests").update({ status }).eq("id", id);
      if (error) throw error;
      await sb.from("audit_logs").insert({ action: "decide_demo", detail: { id, status }, actor: "adminmrwp" });
      return Response.json({ ok: true });
    }
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
        .select("id,name,sector,entity,tier,status,created_at,expires_at")
        .eq("status", "active").order("created_at");
      if (error) throw error;
      const by = await seatsFor((data || []).map((t) => String(t.id)));
      return Response.json({ ok: true, data: (data || []).map((t) => ({ ...t, users: by[String(t.id)] || [] })) });
    }
    /* Pusat Data: kelola profil perusahaan */
    if (op === "editTenant") {
      const { id, name, sector, tier } = (args || {}) as { id?: string; name?: string; sector?: string; tier?: string };
      if (!id || !name) return Response.json({ error: "id/name wajib" }, { status: 400 });
      const { error } = await sb.from("tenants").update({ name, sector: sector || null, tier: tier || "Demo" }).eq("id", id);
      if (error) throw error;
      await sb.from("audit_logs").insert({ action: "edit_tenant", detail: { id, name, sector, tier }, actor: "adminmrwp" });
      return Response.json({ ok: true });
    }
    if (op === "removeTenant") {
      const { id } = (args || {}) as { id?: string };
      if (!id) return Response.json({ error: "id wajib" }, { status: 400 });
      /* hapus akses (app_users) + baris perusahaan; data modul/karyawan TIDAK disentuh (arsip) */
      await sb.from("app_users").delete().eq("tenant_id", id);
      const { error } = await sb.from("tenants").delete().eq("id", id);
      if (error) throw error;
      await sb.from("audit_logs").insert({ action: "remove_tenant", detail: { id }, actor: "adminmrwp" });
      return Response.json({ ok: true });
    }

    if (op === "decideTenant") {
      const id = String(args?.id || "");
      const approve = !!args?.approve;
      const reason = String(args?.reason || "");
      /* tier Demo = akses 24 jam sejak disetujui; tier lain permanen (expires_at NULL) */
      let exp: string | null = null;
      if (approve) {
        const { data: t } = await sb.from("tenants").select("tier").eq("id", id).single();
        if ((t?.tier || "Demo") === "Demo") exp = new Date(Date.now() + 24 * 3600_000).toISOString();
      }
      const { error } = await sb.from("tenants").update(
        approve
          ? { status: "active", decided_at: new Date().toISOString(), expires_at: exp }
          : { status: "rejected", rejected_reason: reason || "Ditolak.", decided_at: new Date().toISOString() },
      ).eq("id", id);
      if (error) throw error;
      await sb.from("audit_logs").insert({ action: approve ? "approve_tenant" : "reject_tenant", detail: { id, reason, expires_at: exp }, actor: "adminmrwp" });
      return Response.json({ ok: true });
    }
    /* Perpanjang tenggat 1 tombol: +N jam dari max(sekarang, tenggat lama). 0/null jam = jadikan permanen. */
    if (op === "extendTenant") {
      const { id, hours } = (args || {}) as { id?: string; hours?: number };
      if (!id) return Response.json({ error: "id wajib" }, { status: 400 });
      let exp: string | null = null;
      if (hours && hours > 0) {
        const { data: t } = await sb.from("tenants").select("expires_at").eq("id", id).single();
        const base = Math.max(Date.now(), t?.expires_at ? new Date(t.expires_at).getTime() : 0);
        exp = new Date(base + hours * 3600_000).toISOString();
      }
      const { error } = await sb.from("tenants").update({ expires_at: exp }).eq("id", id);
      if (error) throw error;
      await sb.from("audit_logs").insert({ action: "extend_tenant", detail: { id, hours: hours || "permanen", expires_at: exp }, actor: "adminmrwp" });
      return Response.json({ ok: true, expires_at: exp });
    }

    /* Seat NYATA via Supabase Auth Admin API (service role). Reset = generateLink recovery
     * (SMTP belum tersambung → kembalikan action_link untuk diserahkan admin ke seat). */
    if (op === "inviteSeat") {
      const tenant = String(args?.tenant || ""); const email = String(args?.email || "").toLowerCase().trim();
      const { count } = await sb.from("app_users").select("*", { count: "exact", head: true }).eq("tenant_id", tenant);
      if ((count || 0) >= 2) return Response.json({ error: "Kuota 2 kursi penuh untuk perusahaan ini." }, { status: 400 });
      const { data: exist } = await sb.from("app_users").select("user_id").eq("email", email).maybeSingle();
      if (exist) return Response.json({ error: "Email sudah terdaftar." }, { status: 400 });
      const { data: created, error } = await sb.auth.admin.createUser({ email, email_confirm: true, password: crypto.randomUUID() });
      if (error || !created?.user) return Response.json({ error: "Gagal membuat akun kursi." }, { status: 500 });
      await sb.from("app_users").insert({ user_id: created.user.id, tenant_id: tenant, role: "client", email });
      await sb.from("audit_logs").insert({ action: "invite_seat", detail: { tenant, email }, actor: "adminmrwp" });
      const { data: link } = await sb.auth.admin.generateLink({ type: "recovery", email });
      return Response.json({ ok: true, link: link?.properties?.action_link ?? null });
    }
    if (op === "resetSeat") {
      const email = String(args?.email || "").toLowerCase().trim();
      const { data: link, error } = await sb.auth.admin.generateLink({ type: "recovery", email });
      if (error) return Response.json({ error: "Gagal membuat tautan reset." }, { status: 500 });
      await sb.from("audit_logs").insert({ action: "reset_seat", detail: { email }, actor: "adminmrwp" });
      return Response.json({ ok: true, link: link?.properties?.action_link ?? null });
    }
    if (op === "removeSeat") {
      const email = String(args?.email || "").toLowerCase().trim();
      const { data: u } = await sb.from("app_users").select("user_id").eq("email", email).maybeSingle();
      if (u?.user_id) { await sb.auth.admin.deleteUser(u.user_id); await sb.from("app_users").delete().eq("user_id", u.user_id); }
      await sb.from("audit_logs").insert({ action: "remove_seat", detail: { email }, actor: "adminmrwp" });
      return Response.json({ ok: true });
    }

    /* PUSAT DATA: seluruh dokumen 1 tenant (pendaftaran + rekam modul + dokumen karyawan).
     * Akses dicatat audit (buku tamu). Legitimasi: perjanjian + NDA (MRWP = firma klien). */
    /* Op tenantDocs/tenantData DIHAPUS — Detail Pusat Data dicabut (owner): akses data klien
     * kini via Mode Pengawasan (Masuk Dashboard), tercatat lewat op logView. */

    /* Mode pengawasan: admin masuk dashboard klien — WAJIB tercatat (tata kelola). */
    if (op === "logView") {
      const { tenant } = (args || {}) as { tenant?: string };
      await sb.from("audit_logs").insert({ action: "masuk_dashboard_klien", detail: { tenant }, actor: "adminmrwp" });
      return Response.json({ ok: true });
    }

    /* KIRIM KODE UNDANGAN KE EMAIL CALON KLIEN (semi-otomatis: admin yang menekan Kirim).
     * Klien hanya mengirim `code` — email tujuan, tier, dan tenggat DIBACA DARI DB, jadi panel
     * tak bisa dipakai mengirim teks sembarang ke alamat sembarang.
     * Sandbox vs produksi = beda ENV, bukan beda kode: MAILTRAP_INBOX_ID terisi → sandbox
     * (email tertahan, tak sampai ke user); dikosongkan → jalur kirim sungguhan (butuh domain
     * terverifikasi di Mailtrap). */
    if (op === "sendInvite") {
      const code = String(args?.code || "").trim();
      if (!code) return Response.json({ error: "code wajib" }, { status: 400 });
      const { data: inv } = await sb.from("invitations").select("code,email_target,tier,seats,expires_at,status").eq("code", code).maybeSingle();
      if (!inv) return Response.json({ error: "Kode tidak ditemukan." }, { status: 404 });
      if (!inv.email_target) return Response.json({ error: "Kode ini generik (tanpa email tujuan) — buat kode dengan email, atau salin manual." }, { status: 400 });
      if (inv.status !== "active") return Response.json({ error: `Kode berstatus ${inv.status} — tak layak dikirim.` }, { status: 400 });

      const url = `${req.nextUrl.origin}/login?kode=${encodeURIComponent(inv.code)}`;
      const tenggat = inv.expires_at
        ? new Date(inv.expires_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }) + " WIB"
        : "tanpa batas waktu";
      const teks = `Kode undangan Corplex Anda: ${inv.code}\n\nPaket: ${inv.tier} · ${inv.seats} kursi pengguna\nBerlaku sampai: ${tenggat}\n\nBuka tautan berikut untuk mendaftarkan perusahaan Anda (kode terisi otomatis):\n${url}\n\nKode ini hanya dapat dipakai satu kali. Jangan teruskan kepada pihak lain.\n\nMRWP Law Firm — Corplex`;
      const html = `<div style="font-family:Georgia,serif;max-width:520px;color:#0A1830">
<p style="font-size:11px;letter-spacing:.18em;color:#B08A3E;margin:0 0 6px">MRWP LAW FIRM · CORPLEX</p>
<h2 style="margin:0 0 14px;font-size:20px">Kode undangan Anda</h2>
<p style="font-size:14px;line-height:1.7">Berikut kode undangan untuk mendaftarkan perusahaan Anda ke Corplex.</p>
<p style="font-family:monospace;font-size:22px;letter-spacing:.12em;background:#F4F1E8;border:1px solid #D9BC80;border-radius:8px;padding:14px 18px;text-align:center;margin:18px 0">${inv.code}</p>
<p style="font-size:13px;line-height:1.8;margin:0 0 18px">Paket <b>${inv.tier}</b> · ${inv.seats} kursi pengguna<br>Berlaku sampai: <b>${tenggat}</b></p>
<p style="margin:0 0 18px"><a href="${url}" style="background:#0A1830;color:#D9BC80;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px">Daftarkan Perusahaan</a></p>
<p style="font-size:12px;color:#5a6472;line-height:1.7">Kode hanya dapat dipakai satu kali — jangan teruskan kepada pihak lain. Bila tautan tidak dapat diklik, salin alamat ini: ${url}</p>
</div>`;

      const sent = await sendMail({ to: inv.email_target, subject: `Kode undangan Corplex — ${inv.code}`, text: teks, html });
      if (!sent.ok) {
        console.error("[api/admin] sendInvite", sent.error);
        return Response.json({ error: sent.error }, { status: 502 });
      }
      await sb.from("audit_logs").insert({ action: "kirim_kode_undangan", detail: { code: inv.code, to: inv.email_target, mode: sent.mode, message_id: sent.id }, actor: "adminmrwp" });
      return Response.json({ ok: true, to: inv.email_target, mode: sent.mode, id: sent.id });
    }

    /* Jejak audit NYATA utk Beranda panel (dulu string sesi in-memory — buatan). */
    if (op === "listAudit") {
      const { data, error } = await sb.from("audit_logs").select("action,detail,actor,created_at").order("created_at", { ascending: false }).limit(15);
      if (error) throw error;
      return Response.json({ ok: true, data: data || [] });
    }

    /* METRIK dihitung dari DB operasional sendiri (bukan pelacak pihak ketiga — PDP + zero-budget). */
    if (op === "metrics") {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [tn, emp, mr, cd, vq] = await Promise.all([
        sb.from("tenants").select("status"),
        sb.from("employees").select("tenant_id,created_at"),
        sb.from("module_records").select("tenant_id,module,dok_url,created_at"),
        sb.from("company_documents").select("id"),
        sb.from("verification_queue").select("status"),
      ]);
      const aktif = new Set<string>();
      (emp.data || []).forEach((r) => { if (r.created_at > since) aktif.add(r.tenant_id); });
      (mr.data || []).forEach((r) => { if (r.created_at > since) aktif.add(r.tenant_id); });
      const perModul: Record<string, number> = {};
      (mr.data || []).forEach((r) => { perModul[r.module] = (perModul[r.module] || 0) + 1; });
      const vqC: Record<string, number> = {};
      (vq.data || []).forEach((r) => { vqC[r.status] = (vqC[r.status] || 0) + 1; });
      const dokumen = (cd.data || []).length + (mr.data || []).filter((r) => r.dok_url).length;
      return Response.json({ ok: true, metrics: {
        tenantAktif: (tn.data || []).filter((t) => t.status === "active").length,
        tenantPending: (tn.data || []).filter((t) => t.status === "pending_review").length,
        aktif30h: aktif.size, karyawan: (emp.data || []).length, dokumen, perModul,
        vqMasuk: vqC.masuk || 0, vqVerified: vqC.verified || 0,
      } });
    }

    return Response.json({ error: "Operasi tidak dikenal." }, { status: 400 });
  } catch (e) {
    console.error("[api/admin]", op, e); // jejak diagnosis — catch-all sempat menelan error asli
    return Response.json({ error: "Gagal memproses permintaan admin." }, { status: 500 });
  }
}
