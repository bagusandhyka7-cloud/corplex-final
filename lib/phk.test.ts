/* Check rumus pesangon — jalankan: npx tsx lib/phk.test.ts
 * Jalur uang/hukum: salah hitung = tanggung jawab hukum. Tanpa framework, cukup assert. */
import assert from "node:assert/strict";
import { hitungPesangon, pesangonBln, upmkBln } from "./phk";

/* 1. Kasus baku yang sudah diverifikasi live: 5 tahun × Rp6.000.000, PHK pengusaha umum. */
const a = hitungPesangon(5, 6_000_000, "PHK oleh pengusaha (umum)");
assert.equal(a.pesBln, 6, "5 th → pesangon 6 bulan (Pasal 40(2))");
assert.equal(a.upmkBln, 2, "5 th → UPMK 2 bulan (Pasal 40(3))");
assert.equal(a.pesRp, 36_000_000);
assert.equal(a.upmkRp, 12_000_000);
assert.equal(a.total, 48_000_000, "total 36jt + 12jt");

/* 2. Resign: nol pesangon & nol UPMK — hanya penggantian hak yang dibayar. */
const b = hitungPesangon(10, 6_000_000, "Mengundurkan diri (resign)", 2_000_000);
assert.equal(b.pesRp, 0);
assert.equal(b.upmkRp, 0);
assert.equal(b.total, 2_000_000, "resign = hanya penggantian hak");

/* 3. Pengali pensiun 1,75× (bukan 1×) — sering salah. */
const c = hitungPesangon(10, 10_000_000, "Pensiun");
assert.equal(c.pesBln, 9);
assert.equal(c.upmkBln, 4);
assert.equal(c.pesRp, 9 * 1.75 * 10_000_000);
assert.equal(c.total, (9 * 1.75 + 4) * 10_000_000);

/* 4. Efisiensi karena rugi = pesangon 0,5× tetapi UPMK tetap 1×. */
const d = hitungPesangon(6, 5_000_000, "Efisiensi (perusahaan rugi)");
assert.equal(d.pesRp, 7 * 0.5 * 5_000_000, "6 th → 7 bulan × 0,5");
assert.equal(d.upmkRp, 3 * 1 * 5_000_000, "6 th → UPMK 3 bulan penuh");

/* 5. Batas tangga masa kerja — titik rawan off-by-one. */
assert.equal(pesangonBln(0), 1); assert.equal(pesangonBln(0.5), 1);
assert.equal(pesangonBln(8), 9); assert.equal(pesangonBln(30), 9, "maksimum 9 bulan");
assert.equal(upmkBln(2), 0, "<3 th belum dapat UPMK");
assert.equal(upmkBln(3), 2); assert.equal(upmkBln(24), 10, "maksimum 10 bulan");

/* 6. Alasan tak dikenal → jatuh ke PHK umum (bukan crash / bukan nol). */
assert.deepEqual(hitungPesangon(5, 6_000_000, "entah apa").total, 48_000_000);

console.log("PASS — 6 kelompok assert rumus pesangon (PP 35/2021) lolos");
