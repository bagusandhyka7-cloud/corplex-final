/* Uji mandiri lib/jaga — jalankan: npx tsx lib/jaga.test.ts
 * Fokus: tanggal masa berlaku izin BENAR-BENAR dibaca (janji "diingatkan otomatis"),
 * dan status SEGERA manual tetap jadi jaring pengaman saat tanggal tak terbaca. */
import assert from "node:assert";
import type { Tenant } from "./data";
import { sisaHari, tanggalDari, tenggatJaga, lblJaga } from "./jaga";

const hariDepan = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const lic = (nama: string, masa: string, st = "AKTIF") => [nama, "", "", "", "", 0, masa, st, "", "", ""];
const tenant = (rows: unknown[][]) => ({ lic: rows, agr: [], emp: [] } as unknown as Tenant);

/* 1. Pembacaan tanggal dari teks bebas */
assert.equal(tanggalDari("Berlaku s.d. 2027-12-31"), "2027-12-31");
assert.equal(tanggalDari("s.d. 31 Des 2027"), "2027-12-31");
assert.equal(tanggalDari("s.d. 5 Agu 2026"), "2026-08-05");
assert.equal(tanggalDari("berlaku selama perusahaan beroperasi"), null);
assert.equal(tanggalDari(""), null);

/* 2. Izin KEDALUWARSA tapi status masih AKTIF — dulu senyap, kini wajib muncul */
const telat = tenggatJaga(tenant([lic("NIB Lewat", `Berlaku s.d. ${hariDepan(-10)}`, "AKTIF")]));
assert.equal(telat.length, 1);
assert.equal(telat[0].hari, -10);
assert.equal(lblJaga(telat[0].hari), "TELAT 10 HARI");

/* 3. Izin masih lama — tak boleh membanjiri daftar pengingat */
assert.equal(tenggatJaga(tenant([lic("NIB Aman", `Berlaku s.d. ${hariDepan(400)}`)])).length, 0);

/* 4. Ambang 90 hari */
assert.equal(tenggatJaga(tenant([lic("Hampir", `Berlaku s.d. ${hariDepan(89)}`)])).length, 1);
assert.equal(tenggatJaga(tenant([lic("Belum", `Berlaku s.d. ${hariDepan(91)}`)])).length, 0);

/* 5. Status SEGERA manual tetap jalan bila masa berlaku tanpa tanggal */
const manual = tenggatJaga(tenant([lic("Tanpa Tanggal", "berlaku selama usaha berjalan", "SEGERA")]));
assert.equal(manual.length, 1);
assert.equal(manual[0].hari, null);

/* 6. Tanggal menang atas status: SEGERA manual + tanggal jauh = BUKAN pengingat palsu */
assert.equal(tenggatJaga(tenant([lic("Salah Tanda", `Berlaku s.d. ${hariDepan(365)}`, "SEGERA")])).length, 0);

/* 7. sisaHari tetap waras */
assert.equal(sisaHari(hariDepan(0)), 0);
assert.equal(sisaHari("bukan tanggal"), null);

/* 8. PERISTIWA KORPORASI ikut fungsi JAGA — tenggat 30 hari (keputusan→akta, akta→Menkumham)
 * adalah satu-satunya tempat perubahan anggaran dasar bisa kehilangan keabsahannya, jadi
 * wajib muncul di pengingat, bukan hanya di modul Sekretaris. */
const tenantEv = (corpev: unknown[]) => ({ lic: [], agr: [], emp: [], corpev } as unknown as Tenant);
{
  /* keputusan 40 hari lalu tanpa akta → telat 10 hari */
  const r = tenggatJaga(tenantEv([{ jenis: "Perubahan Susunan Direksi", jalur: "pemberitahuan", dasar: { bentuk: "RUPS Luar Biasa", tanggal: hariDepan(-40) } }]));
  assert.equal(r.length, 1);
  assert.equal(r[0].hari, -10);
  assert.equal(r[0].v, "corpsec");
  assert.match(r[0].b, /belum diaktakan/);

  /* akta 5 hari lalu → masih dalam tenggat, sisa 25 hari (tetap tampil karena ≤ 30) */
  const proses = tenggatJaga(tenantEv([{ jenis: "Perubahan Susunan Direksi", jalur: "pemberitahuan", dasar: { bentuk: "RUPS Luar Biasa", tanggal: hariDepan(-20) }, akta: { nomor: "1/2026", tanggal: hariDepan(-5) } }]));
  assert.equal(proses[0].hari, 25);
  assert.match(proses[0].b, /belum disahkan Menkumham/);

  /* riwayat lama & peristiwa yang sudah berlaku TIDAK boleh melahirkan pengingat */
  assert.equal(tenggatJaga(tenantEv([{ jenis: "Pendirian Perseroan", jalur: "persetujuan", historis: true, dasar: { bentuk: "Akta Pendirian", tanggal: "2019-03-12" } }])).length, 0);
  assert.equal(tenggatJaga(tenantEv([{ jenis: "Perubahan Susunan Direksi", jalur: "pemberitahuan", dasar: { bentuk: "RUPS", tanggal: hariDepan(-60) }, akta: { nomor: "2/2026", tanggal: hariDepan(-50) }, sah: { bentuk: "Surat Penerimaan Pemberitahuan", nomor: "AHU-1", tanggal: hariDepan(-40) } }])).length, 0);
}

console.log("jaga.test.ts — semua assert lolos");

/* Perjanjian bertanggal cantik ("31 Jul 2028") WAJIB menghasilkan alarm — dulu sisaHari
 * menolak non-ISO sehingga alarm perjanjian tak pernah bunyi. */
{
  const akhirDekat = new Date(Date.now() + 30 * 86_400_000).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const t = tenant([]); (t as { agr: unknown[] }).agr = [{ n: "PJ Vendor", akhir: akhirDekat }];
  assert.equal(tenggatJaga(t).filter((x) => x.v === "agreement").length, 1, "agr tanggal cantik → alarm");
}

/* Polis & HKI kini ikut fungsi JAGA — dulu tak pernah disentuh: polis kedaluwarsa
 * berstatus AKTIF dan merek habis perlindungan lolos tanpa pengingat. */
{
  const t = tenant([]);
  (t as unknown as { asr: { pol: unknown[] } }).asr = { pol: [["PAR Pabrik", "", "", "", "", "", `18 ${["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][new Date(Date.now()+30*86_400_000).getMonth()]} ${new Date(Date.now()+30*86_400_000).getFullYear()}`, "AKTIF"]] };
  (t as unknown as { hki: unknown[] }).hki = [["Merek CONTOH", "", "", "", 0, hariDepan(100), null, ["c-ver","TERDAFTAR"]]];
  const r = tenggatJaga(t);
  assert.equal(r.filter((x) => x.v === "asuransi").length, 1, "polis 30 hari lagi → alarm");
  assert.equal(r.filter((x) => x.v === "asset").length, 1, "HKI 100 hari lagi (≤180) → alarm");
  assert.equal(tenggatJaga(tenant([])).length, 0, "tenant kosong tetap senyap");
}
