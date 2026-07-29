/*
 * POST /api/reset — kirim tautan setel ulang kata sandi ke email pengguna.
 *
 * PUBLIK (belum login — memang itu masalahnya), jadi tiga pagar dipasang:
 *   1. rate limit ketat per IP (3/menit) — jalur ini mengirim email ke alamat orang lain
 *   2. jawaban SELALU sama, ada atau tidak akunnya — jangan sampai halaman login berubah
 *      jadi alat memeriksa "email ini terdaftar di Corplex atau bukan"
 *   3. tautan dibuat Supabase Auth (generateLink) yang sudah ber-kedaluwarsa & sekali pakai;
 *      kita tak pernah membuat token sendiri
 *
 * Emailnya lewat lib/mail.ts yang sudah ada — nol jalur email baru.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { limited, tooMany } from "@/lib/ratelimit";
import { resetEmail, sendMail } from "@/lib/mail";

const JAWABAN_SERAGAM = { ok: true, pesan: "Bila email itu terdaftar, tautan setel ulang sudah dikirim. Periksa kotak masuk dan folder spam." };

export async function POST(req: NextRequest) {
  if (limited(req, "reset", 3)) return tooMany();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum diisi." }, { status: 501 });
  }
  const { email } = await req.json().catch(() => ({})) as { email?: string };
  const alamat = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alamat)) {
    return Response.json({ error: "Format email tidak valid." }, { status: 400 });
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  /* Akun tak dikenal → berhenti diam-diam dengan jawaban yang sama persis. */
  const { data: ada } = await sb.from("app_users").select("user_id").eq("email", alamat).maybeSingle();
  if (!ada) return Response.json(JAWABAN_SERAGAM);

  const base = (process.env.APP_URL || req.nextUrl.origin).replace(/\/+$/, "");
  const { data: link, error } = await sb.auth.admin.generateLink({
    type: "recovery", email: alamat, options: { redirectTo: `${base}/reset` },
  });
  const tautan = link?.properties?.action_link;
  if (error || !tautan) {
    console.error("[api/reset] generateLink", error);
    return Response.json({ error: "Gagal menyiapkan tautan setel ulang." }, { status: 502 });
  }

  const sent = await sendMail({ to: alamat, ...resetEmail(tautan) });
  if (!sent.ok) {
    console.error("[api/reset] sendMail", sent.error);
    return Response.json({ error: sent.error }, { status: 502 });
  }
  /* Audit: siapa meminta reset & lewat jalur mana. Isi tautannya TIDAK dicatat — ia setara
   * kunci sementara ke akun itu. */
  await sb.from("audit_logs").insert({ action: "minta_reset_sandi", detail: { email: alamat, mode: sent.mode }, actor: "publik" });
  return Response.json(JAWABAN_SERAGAM);
}
