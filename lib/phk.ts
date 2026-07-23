/*
 * Rumus pesangon PHK — PP 35/2021 Pasal 40–57 jo. UU 6/2023.
 * Dipisah dari halaman kalkulator agar bisa DIUJI (jalur uang/hukum wajib punya check).
 * Uji: npx tsx lib/phk.test.ts
 */

/* Pasal 40 ayat (2) — uang pesangon per masa kerja (tahun) */
export const pesangonBln = (th: number) => th < 1 ? 1 : th < 2 ? 2 : th < 3 ? 3 : th < 4 ? 4 : th < 5 ? 5 : th < 6 ? 6 : th < 7 ? 7 : th < 8 ? 8 : 9;
/* Pasal 40 ayat (3) — uang penghargaan masa kerja (UPMK) */
export const upmkBln = (th: number) => th < 3 ? 0 : th < 6 ? 2 : th < 9 ? 3 : th < 12 ? 4 : th < 15 ? 5 : th < 18 ? 6 : th < 21 ? 7 : th < 24 ? 8 : 10;

/* Pengali pesangon (p) & UPMK (u) menurut alasan PHK */
export const ALASAN_PHK: Record<string, { p: number; u: number }> = {
  "Efisiensi (mencegah kerugian)": { p: 1, u: 1 },
  "Efisiensi (perusahaan rugi)": { p: 0.5, u: 1 },
  "Perusahaan tutup (rugi)": { p: 0.5, u: 1 },
  "Keadaan memaksa (force majeure)": { p: 0.5, u: 1 },
  "Perusahaan pailit / PKPU": { p: 0.5, u: 1 },
  "Pensiun": { p: 1.75, u: 1 },
  "Pekerja meninggal dunia": { p: 2, u: 1 },
  "Sakit berkepanjangan / cacat kerja": { p: 2, u: 1 },
  "Pelanggaran (setelah SP-3)": { p: 0.5, u: 1 },
  "Akuisisi / merger / peleburan": { p: 1, u: 1 },
  "PHK oleh pengusaha (umum)": { p: 1, u: 1 },
  "Mengundurkan diri (resign)": { p: 0, u: 0 },
};

export type HasilPesangon = {
  pesBln: number; upmkBln: number; pengali: { p: number; u: number };
  pesRp: number; upmkRp: number; total: number;
};

/* th = masa kerja (tahun), upah = gaji pokok + tunjangan tetap per bulan, uph = penggantian hak. */
export function hitungPesangon(th: number, upah: number, alasan: string, uph = 0): HasilPesangon {
  const m = ALASAN_PHK[alasan] || ALASAN_PHK["PHK oleh pengusaha (umum)"];
  const pBln = pesangonBln(th), uBln = upmkBln(th);
  const pesRp = upah * pBln * m.p, upmkRp = upah * uBln * m.u;
  return { pesBln: pBln, upmkBln: uBln, pengali: m, pesRp, upmkRp, total: pesRp + upmkRp + uph };
}
