/*
 * FUNGSI JAGA — kumpulkan tenggat dari rekam HIDUP tenant, satu sumber untuk
 * panel Pengingat (Ringkasan) dan lonceng notifikasi (topbar).
 * Nol tabel baru: semuanya diturunkan dari koleksi yang sudah ada di `ten`.
 * Aturan keras: tenggat yang BUKAN tanggal ISO tidak ditebak jadi angka — ditandai SEGERA.
 */
import type { Tenant } from "./data";

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

export function tenggatJaga(t: Tenant, extra: Jaga[] = []): Jaga[] {
  const out: Jaga[] = [...extra];

  // Izin bertanda SEGERA pada rekam perizinan
  t.lic.forEach((r) => {
    const a = r as unknown[];
    if (a[7] === "SEGERA") out.push({ b: String(a[0]), d: `Masa berlaku segera berakhir — ${String(a[6] || "periksa rekam izin")}`, hari: null, v: "licensing" });
  });
  // Perjanjian dengan tanggal berakhir terbaca
  t.agr.forEach((a) => {
    const x = a as { n?: string; akhir?: string };
    const h = sisaHari(x.akhir);
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
