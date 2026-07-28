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

export async function sendMail(m: { to: string; subject: string; text: string; html: string }): Promise<MailResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (user && pass) {
    try {
      const t = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
      const info = await t.sendMail({ from: `Corplex — MRWP Law Firm <${user}>`, ...m });
      /* Gmail menolak dgn kode 5xx bila alamat tak ada; accepted kosong = tak satu pun diterima. */
      if (!info.accepted?.length) return { ok: false, error: "SMTP Gmail tidak menerima satu pun penerima." };
      return { ok: true, mode: "gmail", id: String(info.messageId || ""), accepted: info.accepted.map(String) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      /* pesan asli Gmail dibiarkan tampil — "Username and Password not accepted" jauh lebih
       * berguna bagi admin daripada "gagal mengirim". */
      return { ok: false, error: `SMTP Gmail gagal: ${msg}` };
    }
  }

  const token = process.env.MAILTRAP_TOKEN;
  if (!token) return { ok: false, error: "Belum ada kredensial email (GMAIL_APP_PASSWORD atau MAILTRAP_TOKEN) di .env.local." };

  const inbox = process.env.MAILTRAP_INBOX_ID;
  const endpoint = inbox ? `https://sandbox.api.mailtrap.io/api/send/${inbox}` : "https://send.api.mailtrap.io/api/send";
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Api-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: { email: process.env.MAILTRAP_FROM || "no-reply@corplex.test", name: "Corplex — MRWP Law Firm" },
      to: [{ email: m.to }], subject: m.subject, text: m.text, html: m.html, category: "corplex",
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body?.success) return { ok: false, error: `Mailtrap menolak (HTTP ${r.status}) — periksa token/domain pengirim.` };
  return { ok: true, mode: inbox ? "sandbox" : "mailtrap", id: String(body.message_ids?.[0] || ""), accepted: [m.to] };
}
