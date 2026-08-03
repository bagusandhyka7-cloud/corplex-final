/*
 * FUNGSI JAGA — kumpulkan tenggat dari rekam HIDUP tenant, satu sumber untuk
 * panel Pengingat (Ringkasan) dan lonceng notifikasi (topbar).
 * Nol tabel baru: semuanya diturunkan dari koleksi yang sudah ada di `ten`.
 * Aturan keras: tenggat yang BUKAN tanggal ISO tidak ditebak jadi angka — ditandai SEGERA.
 */
import type { Tenant } from "./data";
import { statusPeristiwa } from "./peristiwa";

export type Jaga = { b: string; d: string; hari: number | null; v: string };

/* null = tak ada tanggal terbaca. `|| 0` menormalkan -0 saat tenggat jatuh hari ini. */
export const sisaHari = (iso?: string | null): number | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return Math.ceil((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86_400_000) || 0;
};
export const chipJaga = (d: number | null) => (d === null ? "c-red" : d < 0 ? "c-red" : d <= 30 ? "c-red" : d <= 90 ? "c-draft" : "c-mon");
export const lblJaga = (d: number | null) => (d === null ? "SEGERA" : d < 0 ? `TELAT ${Math.abs(d)} HARI` : d === 0 ? "HARI INI" : `${d} HARI`);
/* null (SEGERA tanpa tanggal) paling mendesak → paling atas. */
export const urutJaga = (a: Jaga, b: Jaga) => (a.hari ?? -9999) - (b.hari ?? -9999);

/* "Masa berlaku" izin adalah teks bebas ("Berlaku s.d. 2027-12-31", "s.d. 31 Des 2027").
 * Modul Perizinan menjanjikan tenggat "diingatkan otomatis", tetapi pengingat dulu HANYA
 * terbit bila seseorang menandai status SEGERA dengan tangan — izin yang tanggalnya lewat
 * sementara statusnya masih AKTIF lolos tanpa suara. Baca tanggalnya supaya janji itu benar. */
const BLN_ID: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
export function tanggalDari(teks?: string | null): string | null {
  if (!teks) return null;
  const iso = teks.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const id = teks.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  const b = id && BLN_ID[id[2].slice(0, 3).toLowerCase()];
  return b ? `${id![3]}-${String(b).padStart(2, "0")}-${id![1].padStart(2, "0")}` : null;
}

export function tenggatJaga(t: Tenant, extra: Jaga[] = []): Jaga[] {
  const out: Jaga[] = [...extra];

  /* Peristiwa korporasi: dua tenggat 30 hari (keputusan→akta, akta→Menkumham). Inilah satu-
   * satunya tempat perusahaan bisa kehilangan keabsahan perubahan anggaran dasarnya, jadi
   * wajib muncul di panel Pengingat bersama izin & kontrak — bukan hanya di modulnya sendiri. */
  const hariIni = new Date().toISOString().slice(0, 10);
  (t.corpev || []).forEach((p) => {
    const s = statusPeristiwa(p, hariIni);
    if (!s.tenggat || s.tenggat.sisaHari > 30) return;
    out.push({
      b: `${p.jenis} — ${s.status === "telat-akta" ? "belum diaktakan" : "belum disahkan Menkumham"}`,
      d: `${s.tenggat.label} ${s.tenggat.tanggal}${s.tenggat.sisaHari < 0 ? " — sudah terlampaui, mintakan arahan advokat" : ""}`,
      hari: s.tenggat.sisaHari, v: "corpsec",
    });
  });

  /* Izin: tanggal dulu (otomatis), status SEGERA sebagai jaring pengaman untuk masa berlaku
   * yang tak memuat tanggal terbaca. */
  t.lic.forEach((r) => {
    const a = r as unknown[];
    const h = sisaHari(tanggalDari(String(a[6] ?? "")));
    if (h !== null) {
      if (h <= 90) out.push({ b: String(a[0]), d: `Masa berlaku berakhir ${tanggalDari(String(a[6]))} — ajukan perpanjangan`, hari: h, v: "licensing" });
      return;
    }
    if (a[7] === "SEGERA") out.push({ b: String(a[0]), d: `Masa berlaku segera berakhir — ${String(a[6] || "periksa rekam izin")}`, hari: null, v: "licensing" });
  });
  /* Polis & HKI: pola sama dengan izin — tanggal dibaca otomatis. Dulu keduanya TAK PERNAH
   * disentuh fungsi JAGA: polis kedaluwarsa berstatus AKTIF dan merek yang perlindungannya
   * habis lolos tanpa satu pengingat pun. */
  (t.asr?.pol || []).forEach((r) => {
    const a = r as unknown[];
    const h = sisaHari(tanggalDari(String(a[6] ?? "")));
    if (h !== null && h <= 90) out.push({ b: String(a[0]), d: `Masa polis berakhir ${tanggalDari(String(a[6]))} — urus perpanjangan sebelum pertanggungan putus`, hari: h, v: "asuransi" });
    else if (h === null && a[7] === "SEGERA") out.push({ b: String(a[0]), d: "Masa polis segera berakhir — periksa rekam polis", hari: null, v: "asuransi" });
  });
  (t.hki || []).forEach((r) => {
    const a = r as unknown[];
    const h = sisaHari(tanggalDari(String(a[5] ?? "")));
    if (h !== null && h <= 180) out.push({ b: String(a[0]), d: `Perlindungan HKI berakhir ${tanggalDari(String(a[5]))} — ajukan perpanjangan ke DJKI`, hari: h, v: "asset" });
  });

  // Perjanjian dengan tanggal berakhir terbaca. sisaHari hanya menerima ISO ketat,
  // sedangkan `akhir` tersimpan sebagai teks tampil ("31 Jul 2028") — tanpa tanggalDari,
  // alarm perjanjian tak pernah bunyi sama sekali.
  t.agr.forEach((a) => {
    const x = a as { n?: string; akhir?: string };
    const h = sisaHari(tanggalDari(x.akhir));
    if (h !== null && h <= 120) out.push({ b: x.n || "Perjanjian", d: `Berakhir ${x.akhir} — siapkan perpanjangan atau pengakhiran`, hari: h, v: "agreement" });
  });
  // Kontrak PKWT karyawan yang mendekati habis
  t.emp.forEach((e) => {
    if (e.s !== "PKWT") return;
    const h = sisaHari(e.akhirKontrak);
    if (h !== null && h <= 90) out.push({ b: `Kontrak ${e.n} berakhir`, d: `PKWT habis ${e.akhirKontrak} — putuskan perpanjang atau kompensasi`, hari: h, v: "hr-database" });
  });

  return out.sort(urutJaga);
}
