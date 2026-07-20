/*
 * Spec CRUD generik per modul — satu mesin untuk module_records (jsonb).
 * data tersimpan = bentuk PERSIS yang dirender view (array posisi / objek Agr),
 * id DB diselipkan di index `w` (di luar kolom terpakai — clone() aman, render mengabaikannya).
 */

export type RecField = { k: string; l: string; ph?: string; opts?: string[] };
export type RecRow = unknown[] | Record<string, unknown>;

type Spec = {
  title: string;
  w: number; // lebar array (index tempat id); 0 = objek (id jadi properti)
  fields: RecField[];
  toData: (v: Record<string, string>, tenantName: string) => RecRow;
  fromData: (r: RecRow) => Record<string, string>;
};

/* peta status → [chipClass, label, aksi?] per modul */
const LIC_ST: Record<string, [string, string, string]> = { AKTIF: ["c-ver", "AKTIF", "detail"], SEGERA: ["c-red", "SEGERA", "renew"], PENGURUSAN: ["c-mon", "PENGURUSAN", "track"] };
const AST_ST: Record<string, [string, string]> = { AMAN: ["c-ver", "AMAN"], PERHATIAN: ["c-draft", "PERHATIAN"], BERMASALAH: ["c-red", "BERMASALAH"] };
const HKI_ST: Record<string, [string, string]> = { TERDAFTAR: ["c-ver", "TERDAFTAR"], PERPANJANG: ["c-draft", "PERPANJANG"], PROSES: ["c-mon", "PROSES"] };
const POL_ST: Record<string, [string, string]> = { AKTIF: ["c-ver", "AKTIF"], SEGERA: ["c-red", "SEGERA"], KLAIM: ["c-gold", "KLAIM"], PENGURUSAN: ["c-mon", "PENGURUSAN"] };
const AGR_ST: Record<string, [string, string]> = { AKTIF: ["c-ver", "AKTIF"], SEGERA: ["c-red", "SEGERA"], DRAF: ["c-draft", "DRAF AI"], BERAKHIR: ["c-mon", "BERAKHIR"] };

export const SPECS: Record<string, Spec> = {
  lic: {
    title: "Izin", w: 11,
    fields: [
      { k: "nama", l: "Nama izin *", ph: "NIB 1234567890123" },
      { k: "jenis", l: "Jenis", ph: "Nomor Induk Berusaha" },
      { k: "entitas", l: "Entitas / Lokasi", ph: "PT …" },
      { k: "kbli", l: "KBLI", ph: "10750" },
      { k: "masa", l: "Masa berlaku", ph: "Berlaku s.d. Des 2027" },
      { k: "st", l: "Status", opts: Object.keys(LIC_ST) },
    ],
    toData: (v, tn) => { const s = LIC_ST[v.st] || LIC_ST.AKTIF; return [v.nama, v.jenis, v.entitas || tn, v.kbli, "", 0, v.masa, v.st || "AKTIF", s[0], s[1], s[2]]; },
    fromData: (r) => { const a = r as string[]; return { nama: a[0], jenis: a[1], entitas: a[2], kbli: String(a[3] ?? ""), masa: a[6], st: a[7] }; },
  },
  assets: {
    title: "Aset", w: 7,
    fields: [
      { k: "nama", l: "Nama aset *", ph: "Tanah & Bangunan Pabrik" },
      { k: "sub", l: "Keterangan", ph: "Cirebon · 4.200 m²" },
      { k: "bukti", l: "Bukti kepemilikan", ph: "SHGB No. 812" },
      { k: "kwj", l: "Kewajiban terpantau", ph: "PBB 2026 · HGB s.d. 2031" },
      { k: "st", l: "Status", opts: Object.keys(AST_ST) },
    ],
    toData: (v) => { const s = AST_ST[v.st] || AST_ST.AMAN; return [v.nama, v.sub, v.bukti, null, v.kwj || "—", s[0], s[1]]; },
    fromData: (r) => { const a = r as (string | null)[]; return { nama: a[0] || "", sub: a[1] || "", bukti: a[2] || "", kwj: a[4] || "", st: a[6] === "AMAN" || a[6] === "PERHATIAN" || a[6] === "BERMASALAH" ? a[6]! : "AMAN" }; },
  },
  hki: {
    title: "Kekayaan Intelektual", w: 8,
    fields: [
      { k: "nama", l: "Nama HKI *", ph: "Merek “CONTOH”" },
      { k: "sub", l: "Keterangan", ph: "Logo + kata" },
      { k: "nomor", l: "Nomor / Kelas", ph: "IDM00123456 · Kelas 30" },
      { k: "masa", l: "Masa perlindungan", ph: "Perlindungan s.d. 2030" },
      { k: "st", l: "Status", opts: Object.keys(HKI_ST) },
    ],
    toData: (v) => { const s = HKI_ST[v.st] || HKI_ST.TERDAFTAR; return [v.nama, v.sub, v.nomor, "", 0, v.masa, null, [s[0], s[1]]]; },
    fromData: (r) => { const a = r as unknown[]; const st = (a[7] as string[])?.[1]; return { nama: String(a[0] ?? ""), sub: String(a[1] ?? ""), nomor: String(a[2] ?? ""), masa: String(a[5] ?? ""), st: HKI_ST[st] ? st : "TERDAFTAR" }; },
  },
  pol: {
    title: "Polis", w: 10,
    fields: [
      { k: "nama", l: "Nama polis *", ph: "Property All Risk — Pabrik" },
      { k: "penanggung", l: "Penanggung", ph: "PT Asuransi …" },
      { k: "nomor", l: "Nomor polis", ph: "PAR-2026-00001" },
      { k: "objek", l: "Objek pertanggungan", ph: "Tanah & Bangunan · SHGB 812" },
      { k: "nilai", l: "Nilai pertanggungan", ph: "Rp 18 M" },
      { k: "masa", l: "Masa berlaku", ph: "18 Agu 2027" },
      { k: "st", l: "Status", opts: Object.keys(POL_ST) },
    ],
    toData: (v) => { const s = POL_ST[v.st] || POL_ST.AKTIF; return [v.nama, v.penanggung, v.nomor, v.objek, "asset", v.nilai, v.masa, v.st || "AKTIF", s[0], s[1]]; },
    fromData: (r) => { const a = r as string[]; return { nama: a[0], penanggung: a[1], nomor: a[2], objek: a[3], nilai: a[5], masa: a[6], st: a[7] }; },
  },
  agr: {
    title: "Perjanjian", w: 0,
    fields: [
      { k: "n", l: "Nama perjanjian *", ph: "Perjanjian Jasa …" },
      { k: "p2", l: "Pihak kedua *", ph: "PT Mitra …" },
      { k: "mulai", l: "Tanggal mulai", ph: "1 Agu 2026" },
      { k: "akhir", l: "Tanggal berakhir", ph: "31 Jul 2028" },
      { k: "nilai", l: "Nilai", ph: "Rp 1,2 M / tahun" },
      { k: "st", l: "Status", opts: Object.keys(AGR_ST) },
    ],
    toData: (v, tn) => { const s = AGR_ST[v.st] || AGR_ST.DRAF; return { n: v.n, p1: tn, p2: v.p2, mulai: v.mulai || "—", akhir: v.akhir || "—", nilai: v.nilai || "—", st: v.st || "DRAF", cls: s[0], lbl: s[1], dok: v.dok || "" }; },
    fromData: (r) => { const o = r as Record<string, string>; return { n: o.n, p2: o.p2, mulai: o.mulai, akhir: o.akhir, nilai: o.nilai, st: o.st, dok: o.dok }; },
  },
};

/* Selipkan id DB ke row (array: index w; objek: properti id). */
export function withId(mod: string, data: RecRow, id: string): RecRow {
  if (Array.isArray(data)) { const d = [...data]; d[SPECS[mod].w] = id; return d; }
  return { ...(data as object), id };
}
export const idOf = (mod: string, row: RecRow): string | undefined =>
  Array.isArray(row) ? (row[SPECS[mod].w] as string | undefined) : (row as { id?: string }).id;
/* Buang id sebelum simpan (data murni ke jsonb). */
export function stripId(mod: string, row: RecRow): RecRow {
  if (Array.isArray(row)) return row.slice(0, SPECS[mod].w);
  const { id: _id, ...rest } = row as Record<string, unknown>;
  return rest;
}
