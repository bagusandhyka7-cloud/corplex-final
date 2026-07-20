/*
 * Pusat Impor Excel — template resmi + parser deterministik.
 * Header sheet = label field SPECS (lib/records.ts) → satu sumber; parse = label→key→toData.
 * ponytail: pemetaan header deterministik (normalisasi + cocok persis); fallback AI utk header
 * tak baku menyusul saat AI_API_KEY terisi.
 */
import * as XLSX from "xlsx";
import { RecField, SPECS } from "./records";

/* Karyawan tidak lewat SPECS (tabel employees sendiri) — 1:1 dengan form Database Karyawan
 * (label kolom = label field form; skema penuh tabel employees). */
export const EMP_FIELDS: RecField[] = [
  { k: "n", l: "Nama Lengkap *", ph: "Nama sesuai KTP" },
  { k: "j", l: "Jabatan", ph: "Jabatan sesuai perjanjian kerja" },
  { k: "jk", l: "Jenis Kelamin", opts: ["L", "P"] },
  { k: "wn", l: "Klasifikasi", opts: ["TKI", "TKA"] },
  { k: "lok", l: "Lokal Setempat", opts: ["Ya", "Tidak"] },
  { k: "s", l: "Status Hubungan Kerja", opts: ["PKWT", "PKWTT"] },
  { k: "m", l: "Masa Kerja / Kontrak", ph: "Sep 2026 – Agu 2028" },
  { k: "mulaiKerja", l: "Tanggal Mulai Kerja", ph: "2026-01-15" },
  { k: "gajiPokok", l: "Gaji Pokok / Bulan", ph: "5000000" },
  { k: "tunjTetap", l: "Tunjangan Tetap / Bulan", ph: "1000000" },
  { k: "dept", l: "Departemen", ph: "Operasional / Finance" },
  { k: "prov", l: "Provinsi Domisili", ph: "Jawa Barat" },
  { k: "kota", l: "Kota / Kabupaten", ph: "Cirebon" },
  { k: "desa", l: "Desa / Kelurahan", ph: "" },
  { k: "alamatKtp", l: "Alamat Sesuai KTP", ph: "Jalan, RT/RW, kecamatan" },
  { k: "lahir", l: "Tanggal Lahir", ph: "1995-04-20" },
  { k: "pend", l: "Pendidikan Terakhir", opts: ["SD", "SMP", "SMA/SMK", "D3", "S1", "S2", "S3"] },
  { k: "pendInst", l: "Institusi Pendidikan", ph: "Universitas Indonesia · lulus 2018" },
  { k: "agama", l: "Agama", opts: ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lainnya"] },
  { k: "nikah", l: "Status Pernikahan", opts: ["Belum menikah (TK)", "Menikah (K)", "Menikah anak 1 (K1)", "Menikah anak 2 (K2)", "Menikah anak 3 (K3)", "Cerai"] },
  { k: "nik", l: "NIK KTP", ph: "16 digit" },
  { k: "kk", l: "No. Kartu Keluarga", ph: "16 digit" },
  { k: "npwp", l: "NPWP", ph: "" },
  { k: "sim", l: "SIM", opts: ["A", "B1", "B2", "C", "A & C", "Tidak punya"] },
  { k: "bpjsKes", l: "BPJS Kesehatan", ph: "No. kartu" },
  { k: "bpjsTk", l: "BPJS Ketenagakerjaan", ph: "No. kartu" },
  { k: "bankNama", l: "Bank Payroll", ph: "Bank Mandiri" },
  { k: "bankRek", l: "No. Rekening", ph: "" },
  { k: "golDarah", l: "Golongan Darah", opts: ["A", "B", "AB", "O"] },
  { k: "kdNama", l: "Kontak Darurat — Nama", ph: "Nama (hubungan)" },
  { k: "kdTelp", l: "Kontak Darurat — Telepon", ph: "08…" },
  { k: "pengalaman", l: "Pengalaman Kerja", ph: "3 th operator produksi PT X" },
];

/* Kalender Kewajiban Pajak — 1:1 dgn form modul Kepatuhan Pajak (mod 'tax'). */
const TAX_FIELDS: RecField[] = [
  { k: "nama", l: "Nama Kewajiban *", ph: "SPT Masa PPN Juli" },
  { k: "jenis", l: "Jenis", opts: ["PPN Masa", "PPh 21", "PPh 25 Angsuran", "PPh Badan Tahunan", "PBB", "PPh Final UMKM", "Lainnya"] },
  { k: "tenggat", l: "Tenggat", ph: "2026-08-20" },
  { k: "status", l: "Status", opts: ["TERBUKA", "DIPENUHI"] },
];

/* Sheet per modul: nama sheet → {mod, fields}. mod "emp" = tabel employees. */
export const SHEETS: { sheet: string; mod: string; fields: RecField[] }[] = [
  { sheet: "Karyawan", mod: "emp", fields: EMP_FIELDS },
  { sheet: "Perizinan", mod: "lic", fields: SPECS.lic.fields },
  { sheet: "Aset", mod: "assets", fields: SPECS.assets.fields },
  { sheet: "HKI", mod: "hki", fields: SPECS.hki.fields },
  { sheet: "Polis Asuransi", mod: "pol", fields: SPECS.pol.fields },
  { sheet: "Perjanjian", mod: "agr", fields: SPECS.agr.fields },
  { sheet: "Pajak", mod: "tax", fields: TAX_FIELDS },
];

/* Template per modul — dipakai daftar "Template Form" di Alat Legal. */
export function buatTemplateSatu(sheetName: string) {
  const cfg = SHEETS.find((s) => s.sheet === sheetName);
  if (!cfg) return;
  const wb = XLSX.utils.book_new();
  const headers = cfg.fields.map((f) => f.l.replace(" *", ""));
  const contoh = cfg.fields.map((f) => (f.opts ? f.opts[0] : f.ph || ""));
  const ws = XLSX.utils.aoa_to_sheet([headers, contoh]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, cfg.sheet);
  XLSX.writeFile(wb, `Template_${cfg.sheet.replace(/\s+/g, "_")}_Corplex.xlsx`);
}
