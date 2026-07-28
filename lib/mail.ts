/*
 * Pengiriman email — SERVER-SIDE SAJA (kredensial tak boleh menyentuh bundel klien).
 *
 * Satu fungsi, tiga jalur, dipilih dari ENV (bukan cabang di pemanggil):
 *   1. GMAIL_USER + GMAIL_APP_PASSWORD  → SMTP Gmail. BENAR-BENAR sampai ke inbox user.
 *   2. MAILTRAP_TOKEN + MAILTRAP_INBOX_ID → sandbox Mailtrap. Email TERTAHAN, tak sampai ke user.
 *   3. MAILTRAP_TOKEN saja               → Mailtrap kirim sungguhan (butuh domain terverifikasi).
 *
 * `mode` dikembalikan supaya UI bisa jujur menyebut email itu benar-benar terkirim atau
 * cuma tertahan di sandbox — jangan pernah menampilkan "terkirim" untuk jalur sandbox.
 *
 * ponytail: Gmail = solusi sementara sampai domain siap. Batas ~500 email/hari, alamat pengirim
 * tetap tampak @gmail.com. Begitu domain terverifikasi di Mailtrap, kosongkan GMAIL_* dan
 * MAILTRAP_INBOX_ID — jalur 3 aktif tanpa mengubah satu baris kode pemanggil.
 */
import nodemailer from "nodemailer";

export type MailMode = "gmail" | "sandbox" | "mailtrap";
export type MailResult =
  | { ok: true; mode: MailMode; id: string; accepted: string[] }
  | { ok: false; error: string };

/* Pilihan jalur dipisah jadi fungsi murni agar bisa diuji tanpa mengirim email
 * (lib/mail.test.ts). null = tak ada kredensial sama sekali. */
export function pickMode(env: NodeJS.ProcessEnv): MailMode | null {
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) return "gmail";
  if (!env.MAILTRAP_TOKEN) return null;
  return env.MAILTRAP_INBOX_ID ? "sandbox" : "mailtrap";
}

/* Escape nilai dinamis sebelum masuk HTML email. Sekarang datanya milik sistem sendiri
 * (kode digenerate, tier dari daftar pilihan), tapi email dikirim keluar — sekali ada nilai
 * yang bisa diketik bebas, tanpa ini ia jadi jalur penyisipan markup. */
export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* Badan email kode undangan. Fungsi murni: (data, alamat aplikasi) → subject/text/html.
 * Trailing slash pada base dinormalkan supaya tak lahir "//login". */
export function inviteEmail(
  inv: { code: string; tier: string; seats: number; expires_at: string | null },
  rawBase: string,
): { subject: string; text: string; html: string } {
  const base = rawBase.replace(/\/+$/, "");
  const url = `${base}/login?kode=${encodeURIComponent(inv.code)}`;
  const tenggat = inv.expires_at
    ? new Date(inv.expires_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }) + " WIB"
    : "tanpa batas waktu";
  const text = `Kode undangan Corplex Anda: ${inv.code}\n\nPaket: ${inv.tier} · ${inv.seats} kursi pengguna\nBerlaku sampai: ${tenggat}\n\nBuka tautan berikut untuk mendaftarkan perusahaan Anda (kode terisi otomatis):\n${url}\n\nKode ini hanya dapat dipakai satu kali. Jangan teruskan kepada pihak lain.\n\nMRWP Law Firm — Corplex`;
  const html = `<div style="font-family:Georgia,serif;max-width:520px;color:#0A1830">
<p style="font-size:11px;letter-spacing:.18em;color:#B08A3E;margin:0 0 6px">MRWP LAW FIRM · CORPLEX</p>
<h2 style="margin:0 0 14px;font-size:20px">Kode undangan Anda</h2>
<p style="font-size:14px;line-height:1.7">Berikut kode undangan untuk mendaftarkan perusahaan Anda ke Corplex.</p>
<p style="font-family:monospace;font-size:22px;letter-spacing:.12em;background:#F4F1E8;border:1px solid #D9BC80;border-radius:8px;padding:14px 18px;text-align:center;margin:18px 0">${esc(inv.code)}</p>
<p style="font-size:13px;line-height:1.8;margin:0 0 18px">Paket <b>${esc(inv.tier)}</b> · ${esc(inv.seats)} kursi pengguna<br>Berlaku sampai: <b>${esc(tenggat)}</b></p>
<p style="margin:0 0 18px"><a href="${esc(url)}" style="background:#0A1830;color:#D9BC80;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px">Daftarkan Perusahaan</a></p>
<p style="font-size:12px;color:#5a6472;line-height:1.7">Kode hanya dapat dipakai satu kali — jangan teruskan kepada pihak lain. Bila tautan tidak dapat diklik, salin alamat ini: ${esc(url)}</p>
</div>`;
  return { subject: `Kode undangan Corplex — ${inv.code}`, text, html };
}

export async function sendMail(m: { to: string; subject: string; text: string; html: string }): Promise<MailResult> {
  const mode = pickMode(process.env);
  if (!mode) return { ok: false, error: "Belum ada kredensial email (GMAIL_APP_PASSWORD atau MAILTRAP_TOKEN) di .env.local." };

  if (mode === "gmail") {
    try {
      const user = process.env.GMAIL_USER!;
      const t = nodemailer.createTransport({ service: "gmail", auth: { user, pass: process.env.GMAIL_APP_PASSWORD! } });
      const info = await t.sendMail({ from: `Corplex — MRWP Law Firm <${user}>`, ...m });
      /* Gmail menolak dgn kode 5xx bila alamat tak ada; accepted kosong = tak satu pun diterima. */
      if (!info.accepted?.length) return { ok: false, error: "SMTP Gmail tidak menerima satu pun penerima." };
      return { ok: true, mode, id: String(info.messageId || ""), accepted: info.accepted.map(String) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      /* pesan asli Gmail dibiarkan tampil — "Username and Password not accepted" jauh lebih
       * berguna bagi admin daripada "gagal mengirim". */
      return { ok: false, error: `SMTP Gmail gagal: ${msg}` };
    }
  }

  const inbox = process.env.MAILTRAP_INBOX_ID;
  const endpoint = inbox ? `https://sandbox.api.mailtrap.io/api/send/${inbox}` : "https://send.api.mailtrap.io/api/send";
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Api-Token": process.env.MAILTRAP_TOKEN!, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: { email: process.env.MAILTRAP_FROM || "no-reply@corplex.test", name: "Corplex — MRWP Law Firm" },
      to: [{ email: m.to }], subject: m.subject, text: m.text, html: m.html, category: "corplex",
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body?.success) return { ok: false, error: `Mailtrap menolak (HTTP ${r.status}) — periksa token/domain pengirim.` };
  return { ok: true, mode, id: String(body.message_ids?.[0] || ""), accepted: [m.to] };
}
