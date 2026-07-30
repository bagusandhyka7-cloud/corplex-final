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

console.log("jaga.test.ts — semua assert lolos");
