/*
 * POST /api/hash — hitung SHA-256 isi dokumen milik tenant pemanggil, lalu simpan ke DB.
 *
 * Klien HANYA menyebut baris mana ({kind, id}) — bukan nilai hash, bukan URL. Server membaca
 * dok_url dari DB, mengunduh byte aslinya dari Storage, menghitung sendiri, dan menulis
 * kolomnya dengan service role (kolom itu ditolak untuk penulis lain oleh trigger jaga_dok_hash).
 *
 * Wewenang: JWT Supabase pemanggil wajib sah DAN tenant-nya harus sama dengan pemilik baris —
 * jadi tenant lain tak bisa memancing server menghitung/menulis apa pun di baris orang.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { limited, tooMany } from "@/lib/ratelimit";
import { hashRow, type HashKind } from "@/lib/dokhash";

const KIND: HashKind[] = ["rec", "emp", "vq", "vqmsg", "doc"];

export async function POST(req: NextRequest) {
  /* Tiap panggilan = satu unduhan berkas dari Storage. Batas ini menjaga bandwidth, bukan sekadar CPU. */
  if (limited(req, "hash", 40)) return tooMany();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum diisi." }, { status: 501 });
  }
  const { kind, id, token } = await req.json().catch(() => ({})) as { kind?: string; id?: string; token?: string };
  if (!kind || !KIND.includes(kind as HashKind) || !id) {
    return Response.json({ error: "kind/id tidak sah." }, { status: 400 });
  }
  if (!token) return Response.json({ error: "Sesi tidak dikenal." }, { status: 401 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: u } = await sb.auth.getUser(token);
  if (!u?.user) return Response.json({ error: "Sesi tidak dikenal." }, { status: 401 });
  const { data: me } = await sb.from("app_users").select("tenant_id,role").eq("user_id", u.user.id).maybeSingle();
  if (!me) return Response.json({ error: "Akun tidak dikenal." }, { status: 401 });

  try {
    /* Kepemilikan diperiksa di dalam hashRow — SEBELUM berkas diunduh. Tenant diambil dari DB,
     * bukan dari klaim klien. */
    const r = await hashRow(sb, kind as HashKind, id, { tenant: me.tenant_id, super: me.role === "super_admin" });
    /* Jawaban seragam 400 "Baris tidak ditemukan." untuk baris-tak-ada MAUPUN milik tenant lain —
     * pemisahan 400/403 dulu jadi oracle keberadaan id lintas tenant (pola /api/reset). */
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
    return Response.json({ ok: true, n: r.n });
  } catch (e) {
    console.error("[api/hash]", kind, id, e);
    return Response.json({ error: "Gagal menghitung hash dokumen." }, { status: 500 });
  }
}
