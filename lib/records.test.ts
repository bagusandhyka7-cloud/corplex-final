/* Uji konversi tanggal SPECS: picker ISO → teks tampil; teks lama bebas tak boleh hilang. */
import assert from "node:assert";
import { SPECS, tglCantik, isoDari, ISO_RE } from "./records";

assert.equal(tglCantik("2027-12-31"), "31 Des 2027");
assert.equal(isoDari("Berlaku s.d. 31 Des 2027"), "2027-12-31");
assert.equal(isoDari("Berlaku s.d. Des 2027"), "", "tanpa tanggal = tak terbaca, bukan tebakan");
assert.ok(ISO_RE.test("2026-08-03"));

// lic: ISO dari picker → tersimpan berprefiks & cantik; round-trip edit kembali ISO
const lic = SPECS.lic.toData({ nama: "NIB", jenis: "", entitas: "", kbli: "", masa: "2027-12-31", st: "AKTIF" }, "PT X") as string[];
assert.equal(lic[6], "Berlaku s.d. 31 Des 2027");
assert.equal(SPECS.lic.fromData(lic).masa, "2027-12-31");

// lic: nilai LAMA format bebas dipertahankan apa adanya saat disimpan ulang
const legacy = SPECS.lic.toData({ nama: "NIB", jenis: "", entitas: "", kbli: "", masa: "Berlaku s.d. Des 2027", st: "AKTIF" }, "PT X") as string[];
assert.equal(legacy[6], "Berlaku s.d. Des 2027");

// agr: ISO → cantik; kosong → "—"; round-trip
const agr = SPECS.agr.toData({ n: "PJ", p2: "PT Y", mulai: "2026-08-01", akhir: "2028-07-31", nilai: "", st: "AKTIF" }, "PT X") as Record<string, string>;
assert.equal(agr.mulai, "1 Agu 2026"); assert.equal(agr.akhir, "31 Jul 2028");
assert.equal(SPECS.agr.fromData(agr).akhir, "2028-07-31");
assert.equal((SPECS.agr.toData({ n: "PJ", p2: "Y", mulai: "", akhir: "", nilai: "", st: "DRAF" }, "X") as Record<string, string>).akhir, "—");
assert.equal(SPECS.agr.fromData({ n: "PJ", p2: "Y", mulai: "—", akhir: "—", nilai: "—", st: "DRAF" } as never).akhir, "", "strip — saat edit");

// pol & hki
assert.equal((SPECS.pol.toData({ nama: "P", penanggung: "", nomor: "", objek: "", nilai: "", masa: "2027-08-18", st: "AKTIF" }, "PT X") as string[])[6], "18 Agu 2027");
assert.equal((SPECS.hki.toData({ nama: "M", sub: "", nomor: "", masa: "2030-01-05", st: "TERDAFTAR" }, "PT X") as unknown[])[5], "Perlindungan s.d. 5 Jan 2030");

console.log("records(tanggal): semua assert PASS");
