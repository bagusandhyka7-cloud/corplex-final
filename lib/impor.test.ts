/* Uji pemetaan header Excel — prioritasnya BUKAN "berhasil impor", melainkan
 * "tak pernah salah kolom". Workbook dibuat di memori, nol berkas, nol jaringan.
 * Jalankan: npx tsx lib/impor.test.ts */
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseWorkbook, petakanHeader, SHEETS } from "./impor";

const pajak = SHEETS.find((s) => s.sheet === "Pajak")!;
const F = pajak.fields; // Nama Kewajiban * · Jenis · Tenggat · Status

/* ── petakanHeader: toleransi bentuk penulisan ── */
const keysOf = (h: unknown[]) => petakanHeader(h, F).keys;
assert.deepEqual(keysOf(["Nama Kewajiban *", "Jenis", "Tenggat", "Status"]), ["nama", "jenis", "tenggat", "status"], "header persis");
assert.deepEqual(keysOf(["NAMA KEWAJIBAN", "jenis", "TeNggAt", "status"]), ["nama", "jenis", "tenggat", "status"], "beda kapital");
assert.deepEqual(keysOf(["nama_kewajiban", "jenis ", " tenggat", "status"]), ["nama", "jenis", "tenggat", "status"], "underscore & spasi");
assert.deepEqual(keysOf(["Nama-Kewajiban:", "Jenis.", "Tenggat!", "Status?"]), ["nama", "jenis", "tenggat", "status"], "tanda baca");
assert.deepEqual(keysOf(["Nama Kewajiban Pajak", "Jenis", "Tenggat", "Status"]), ["nama", "jenis", "tenggat", "status"], "header lebih panjang (prefix)");
assert.deepEqual(keysOf(["Nama", "Jenis", "Tenggat", "Status"]), ["nama", "jenis", "tenggat", "status"], "header lebih pendek (prefix)");

/* Kolom asing tak boleh menempel ke field mana pun, dan dilaporkan. */
const asing = petakanHeader(["Nama Kewajiban", "Catatan Internal", "Tenggat"], F);
assert.deepEqual(asing.keys, ["nama", null, "tenggat"]);
assert.deepEqual(asing.takDikenal, ["Catatan Internal"], "kolom asing wajib dilaporkan");

/* Satu field tak boleh dipakai dua kolom — kolom kedua diabaikan, bukan menimpa. */
const dobel = petakanHeader(["Nama Kewajiban", "Nama Kewajiban"], F);
assert.deepEqual(dobel.keys, ["nama", null], "kolom duplikat tak boleh menimpa");

/* Kolom tanpa judul diabaikan diam-diam (Excel sering menyisakan kolom kosong di kanan). */
assert.deepEqual(petakanHeader(["Nama Kewajiban", "", "   "], F).keys, ["nama", null, null]);

/* ── parseWorkbook: perilaku end-to-end ── */
const wbOf = (sheet: string, aoa: unknown[][]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
};

const baris = ["PPN Juli", "PPN Masa", "2026-08-20", "TERBUKA"];
const okRes = parseWorkbook(wbOf("Pajak", [["nama_kewajiban", "JENIS", "Tenggat", "Status"], baris]));
assert.equal(okRes.items.length, 1, "header tak baku tetap terbaca");
assert.equal(okRes.items[0].vals.nama, "PPN Juli");
assert.equal(okRes.items[0].vals.status, "TERBUKA");
assert.equal(okRes.peringatan.length, 0, "header sah tak boleh memicu peringatan");

/* Kolom ekstra: data tetap masuk, tapi kolom asingnya DILAPORKAN — bukan hilang diam-diam. */
const ekstra = parseWorkbook(wbOf("Pajak", [["Nama Kewajiban", "Jenis", "Tenggat", "Status", "Catatan Internal"], [...baris, "rahasia"]]));
assert.equal(ekstra.items.length, 1);
assert.equal(ekstra.items[0].vals.catatan, undefined, "kolom asing tak boleh diselundupkan ke payload");
assert.ok(ekstra.peringatan.some((p) => p.includes("Catatan Internal")), "kolom asing wajib muncul di peringatan");

/* Kolom WAJIB hilang → sheet ditolak seluruhnya. Impor separuh data pada modul hukum
 * lebih berbahaya daripada tidak mengimpor. */
const wajibHilang = parseWorkbook(wbOf("Pajak", [["Jenis", "Tenggat", "Status"], baris.slice(1)]));
assert.equal(wajibHilang.items.length, 0, "sheet tanpa kolom wajib harus ditolak");
assert.ok(wajibHilang.peringatan.some((p) => p.includes("DILEWATI")), "penolakan wajib dijelaskan");

/* Sheet tak dikenal: tidak crash, dilaporkan terpisah. */
const asingSheet = parseWorkbook(wbOf("Entah Apa", [["A", "B"], ["1", "2"]]));
assert.deepEqual(asingSheet.unknownSheets, ["Entah Apa"]);
assert.equal(asingSheet.items.length, 0);

/* Sheet kosong / hanya header → nol item, nol lemparan. */
assert.equal(parseWorkbook(wbOf("Pajak", [["Nama Kewajiban", "Jenis"]])).items.length, 0, "hanya header");
assert.equal(parseWorkbook(wbOf("Pajak", [])).items.length, 0, "sheet kosong");

/* Baris kosong di tengah dilewati, bukan menghasilkan rekam hampa. */
const berlubang = parseWorkbook(wbOf("Pajak", [["Nama Kewajiban", "Jenis", "Tenggat", "Status"], ["", "", "", ""], baris]));
assert.equal(berlubang.items.length, 1, "baris kosong dilewati");

/* Baris tanpa nilai wajib dihitung sebagai skipped, bukan diam-diam tersimpan. */
const tanpaWajib = parseWorkbook(wbOf("Pajak", [["Nama Kewajiban", "Jenis", "Tenggat", "Status"], ["", "PPN Masa", "2026-08-20", "TERBUKA"]]));
assert.equal(tanpaWajib.items.length, 0);
assert.equal(tanpaWajib.skipped, 1, "baris tanpa field wajib wajib terhitung skipped");

/* Nama sheet beda kapital/spasi tetap dikenali. */
assert.equal(parseWorkbook(wbOf("  pajak ", [["Nama Kewajiban", "Jenis", "Tenggat", "Status"], baris])).items.length, 1, "nama sheet toleran");

/* Berkas SALAH JENIS (teks biasa) — xlsx menerimanya sebagai sheet asing. Yang penting:
 * nol item terimpor dan tak melempar, sehingga UI menampilkan pesan, bukan halaman blank. */
const acak = parseWorkbook(new TextEncoder().encode("ini bukan excel").buffer as ArrayBuffer);
assert.equal(acak.items.length, 0, "berkas asing tak boleh menghasilkan rekam");
assert.ok(acak.unknownSheets.length > 0, "berkas asing dilaporkan sebagai sheet tak dikenal");

/* Berkas RUSAK sungguhan (zip cacat) memang melempar — pemanggil wajib menangkapnya.
 * components/ExcelImport.tsx sudah membungkusnya dengan try/catch + toast. */
assert.throws(() => parseWorkbook(new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5]).buffer), "zip rusak melempar — pemanggil harus menangkap");

console.log("impor: 21 assert PASS");
