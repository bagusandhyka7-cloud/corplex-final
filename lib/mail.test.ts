/* Uji jalur email TANPA mengirim email sungguhan — hanya bagian murni: pemilihan jalur,
 * escaping, dan penyusunan badan email. Jalankan: npx tsx lib/mail.test.ts
 * (pola sama dengan lib/phk.test.ts: assert bawaan Node, nol framework.) */
import assert from "node:assert/strict";
import { esc, inviteEmail, pickMode, resetEmail } from "./mail";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

/* ── pickMode: satu-satunya penentu email benar terkirim atau cuma tertahan ── */
assert.equal(pickMode(env({})), null, "tanpa kredensial = tak ada jalur");
assert.equal(pickMode(env({ MAILTRAP_TOKEN: "t" })), "mailtrap", "token saja = jalur kirim Mailtrap");
assert.equal(pickMode(env({ MAILTRAP_TOKEN: "t", MAILTRAP_INBOX_ID: "1" })), "sandbox", "token + inbox = sandbox");
assert.equal(pickMode(env({ GMAIL_USER: "a@b.c", GMAIL_APP_PASSWORD: "p" })), "gmail", "kredensial Gmail = SMTP Gmail");
/* Gmail menang atas Mailtrap; kalau urutannya terbalik, email produksi diam-diam mendarat
 * di sandbox dan klien tak pernah menerima apa pun. */
assert.equal(
  pickMode(env({ GMAIL_USER: "a@b.c", GMAIL_APP_PASSWORD: "p", MAILTRAP_TOKEN: "t", MAILTRAP_INBOX_ID: "1" })),
  "gmail", "Gmail harus menang atas sandbox saat keduanya terisi");
/* Kredensial Gmail setengah terisi jangan diperlakukan sebagai jalur Gmail (pasti gagal auth). */
assert.equal(pickMode(env({ GMAIL_USER: "a@b.c", MAILTRAP_TOKEN: "t" })), "mailtrap", "user tanpa sandi bukan jalur Gmail");

/* ── esc: nilai dinamis tak boleh menyuntik markup ke email ── */
assert.equal(esc(`<b>&"'`), "&lt;b&gt;&amp;&quot;&#39;");
assert.equal(esc(null), "");

/* ── inviteEmail: tautan, normalisasi base, tenggat, escaping ── */
const inv = { code: "MRWP-AB12CD", tier: "Demo", seats: 2, expires_at: "2026-08-04T04:58:00.000Z" };

const a = inviteEmail(inv, "https://app.corplex.id/");
assert.ok(a.text.includes("https://app.corplex.id/login?kode=MRWP-AB12CD"), "trailing slash harus dinormalkan");
assert.ok(!a.html.includes("//login"), "jangan sampai lahir //login");
assert.ok(a.subject.includes("MRWP-AB12CD"));

const b = inviteEmail(inv, "http://localhost:3000");
assert.ok(b.text.includes("http://localhost:3000/login?kode=MRWP-AB12CD"), "tanpa trailing slash tetap benar");

/* Tenggat ditulis dalam WIB, bukan UTC mentah — 04:58 UTC = 11:58 WIB. */
assert.ok(a.text.includes("11.58") && a.text.includes("WIB"), `tenggat WIB salah: ${a.text.match(/Berlaku sampai:.*/)?.[0]}`);
assert.ok(inviteEmail({ ...inv, expires_at: null }, "https://x.id").text.includes("tanpa batas waktu"));

/* Nilai berbahaya di tier tak boleh lolos ke HTML, dan kode berspasi tetap aman di URL. */
const c = inviteEmail({ ...inv, tier: '<script>alert(1)</script>', code: "A B" }, "https://x.id");
assert.ok(!c.html.includes("<script>"), "tier wajib di-escape");
assert.ok(c.html.includes("&lt;script&gt;"));
assert.ok(c.html.includes("kode=A%20B"), "kode wajib di-encode di URL");

console.log("mail: 15 assert PASS");

/* ── resetEmail: tautan pemulihan wajib utuh & ter-escape ── */
const rs = resetEmail("https://app.corplex.id/reset#access_token=abc&type=recovery");
assert.ok(rs.text.includes("https://app.corplex.id/reset#access_token=abc"), "tautan utuh di versi teks");
assert.ok(rs.html.includes("&amp;type=recovery"), "ampersand wajib di-escape di HTML");
assert.ok(!/<script/i.test(resetEmail('"><script>alert(1)</script>').html), "tautan berbahaya wajib di-escape");
assert.ok(rs.subject.toLowerCase().includes("kata sandi"));
/* Jangan pernah menjanjikan tautan permanen — ia sekali pakai. */
assert.ok(rs.text.includes("sekali pakai"));

console.log("mail(reset): 5 assert PASS");
