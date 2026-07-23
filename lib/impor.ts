/*
 * Pusat Impor Excel — template resmi + parser deterministik.
 * Header sheet = label field SPECS (lib/records.ts) → satu sumber; parse = label→key→toData.
 * ponytail: pemetaan header deterministik (normalisasi + cocok persis); fallback AI utk header
 * tak baku menyusul saat AI_API_KEY terisi.
 */
import * as XLSX from "xlsx";
import { RecField, RecRow, SPECS } from "./records";

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

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[*]/g, "").trim();
/* Excel menyimpan tanggal sebagai ANGKA SERI (mis. 46968). Tanpa penanganan, tenggat hukum
 * tersimpan sebagai angka omong kosong. cellDates:true → objek Date, lalu dinormalkan ke
 * YYYY-MM-DD (format yang dipakai form & <input type="date">). */
const selVal = (v: unknown) =>
  v instanceof Date
    ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
    : String(v ?? "").trim();
export type ParsedItem = { mod: string; label: string; vals: Record<string, string> };

/* Parse workbook terisi → daftar item siap simpan (per baris). Baris kosong/contoh/tanpa field wajib dilewati.
 * Pemetaan kolom deterministik: header sheet → label field → key. */
export function parseWorkbook(buf: ArrayBuffer): { items: ParsedItem[]; skipped: number; unknownSheets: string[] } {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const items: ParsedItem[] = [];
  let skipped = 0;
  const unknownSheets: string[] = [];
  for (const name of wb.SheetNames) {
    const cfg = SHEETS.find((s) => norm(s.sheet) === norm(name));
    if (!cfg) { unknownSheets.push(name); continue; }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" });
    if (rows.length < 2) continue;
    const colKey = (rows[0] as unknown[]).map((h) => cfg.fields.find((f) => norm(f.l) === norm(h))?.k ?? null);
    for (const row of rows.slice(1)) {
      const vals: Record<string, string> = {};
      colKey.forEach((k, i) => { if (k) vals[k] = selVal((row as unknown[])[i]); });
      if (!Object.values(vals).some(Boolean)) continue; // baris kosong
      const wajib = cfg.fields.filter((f) => f.l.includes("*"));
      if (wajib.some((f) => !vals[f.k])) { skipped++; continue; }
      // lewati baris contoh bawaan template
      if (cfg.fields.every((f) => vals[f.k] === (f.opts ? f.opts[0] : f.ph || "") || !vals[f.k])) continue;
      items.push({ mod: cfg.mod, label: vals[cfg.fields[0].k], vals });
    }
  }
  return { items, skipped, unknownSheets };
}

const angka = (s?: string) => (s ? Number(s.replace(/[^\d]/g, "")) || null : null);

/* vals → payload siap tulis. emp → bentuk app Emp (lalu empToRow di pemanggil) · tax → vals langsung ·
 * modul SPECS → toData (array RecRow). */
export function toPayload(item: ParsedItem, tenantName: string): RecRow | Record<string, unknown> {
  const v = item.vals;
  if (item.mod === "emp") {
    return {
      n: v.n, j: v.j || "—", jk: v.jk === "P" ? "P" : "L", wn: v.wn === "TKA" ? "TKA" : "TKI",
      // "Tidak" bisa ditulis macam-macam (no/n/0/false). Salah baca = TKA terhitung lokal di rekap LKPM.
      lok: !["tidak", "no", "n", "0", "false", "-"].includes(norm(v.lok)), s: v.s === "PKWTT" ? "PKWTT" : "PKWT",
      m: v.m || (v.s === "PKWTT" ? "Sejak 2026" : "2026 – 2027"), sisa: v.s === "PKWTT" ? null : 60,
      mulaiKerja: v.mulaiKerja, gajiPokok: angka(v.gajiPokok), tunjTetap: angka(v.tunjTetap),
      dept: v.dept, prov: v.prov, kota: v.kota, desa: v.desa, alamatKtp: v.alamatKtp, lahir: v.lahir,
      pend: v.pend, pendInst: v.pendInst, agama: v.agama, nikah: v.nikah, nik: v.nik, kk: v.kk,
      npwp: v.npwp, sim: v.sim, bpjsKes: v.bpjsKes, bpjsTk: v.bpjsTk, bankNama: v.bankNama,
      bankRek: v.bankRek, golDarah: v.golDarah, kdNama: v.kdNama, kdTelp: v.kdTelp, pengalaman: v.pengalaman,
    };
  }
  if (item.mod === "tax") return v; // key TAX_FIELDS = kolom tabel Tax (nama/jenis/tenggat/status)
  return SPECS[item.mod].toData(v, tenantName);
}
