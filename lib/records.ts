/*
 * Spec CRUD generik per modul — satu mesin untuk module_records (jsonb).
 * data tersimpan = bentuk PERSIS yang dirender view (array posisi / objek Agr),
 * id DB diselipkan di index `w` (di luar kolom terpakai — clone() aman, render mengabaikannya).
 */

export type RecField = { k: string; l: string; ph?: string; opts?: string[]; date?: true };
export type RecRow = unknown[] | Record<string, unknown>;

/* Field bertanggal memakai picker (date?:true): picker mengisi ISO, toData mengubahnya jadi
 * teks tampil ("31 Des 2027" — format yang dibaca lib/jaga utk alarm tenggat), fromData
 * mengembalikannya ke ISO saat edit. Nilai LAMA yang tak terbaca (mis. "Berlaku s.d. Des 2027"
 * tanpa tanggal) dibiarkan apa adanya — tidak boleh hilang hanya karena formatnya bebas.
 * (Salinan kecil dari lib/jaga — impor langsung berisiko siklus records→jaga→store.) */
export const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BLN_N: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
export const tglCantik = (iso?: string) => { const m = iso?.match(ISO_RE) ? iso!.split("-") : null; return m ? `${+m[2]} ${BLN[+m[1] - 1]} ${m[0]}` : (iso || ""); };
export const isoDari = (teks?: string) => {
  if (!teks) return "";
  const i = teks.match(/\d{4}-\d{2}-\d{2}/); if (i) return i[0];
  const id = teks.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  const b = id && BLN_N[id[2].slice(0, 3).toLowerCase()];
  return b ? `${id![3]}-${String(b).padStart(2, "0")}-${id![1].padStart(2, "0")}` : "";
};
/* ISO dari picker → teks tampil (opsional berprefiks); selain itu kembalikan apa adanya. */
const tglSimpan = (v: string, pre = "") => (ISO_RE.test(v) ? `${pre}${tglCantik(v)}` : v);

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
      { k: "masa", l: "Masa berlaku s.d.", date: true },
      { k: "st", l: "Status", opts: Object.keys(LIC_ST) },
    ],
    toData: (v, tn) => { const s = LIC_ST[v.st] || LIC_ST.AKTIF; return [v.nama, v.jenis, v.entitas || tn, v.kbli, "", 0, tglSimpan(v.masa, "Berlaku s.d. "), v.st || "AKTIF", s[0], s[1], s[2]]; },
    fromData: (r) => { const a = r as string[]; return { nama: a[0], jenis: a[1], entitas: a[2], kbli: String(a[3] ?? ""), masa: isoDari(a[6]) || a[6], st: a[7] }; },
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
      { k: "masa", l: "Perlindungan s.d.", date: true },
      { k: "st", l: "Status", opts: Object.keys(HKI_ST) },
    ],
    toData: (v) => { const s = HKI_ST[v.st] || HKI_ST.TERDAFTAR; return [v.nama, v.sub, v.nomor, "", 0, tglSimpan(v.masa, "Perlindungan s.d. "), null, [s[0], s[1]]]; },
    fromData: (r) => { const a = r as unknown[]; const st = (a[7] as string[])?.[1]; const m = String(a[5] ?? ""); return { nama: String(a[0] ?? ""), sub: String(a[1] ?? ""), nomor: String(a[2] ?? ""), masa: isoDari(m) || m, st: HKI_ST[st] ? st : "TERDAFTAR" }; },
  },
  pol: {
    title: "Polis", w: 10,
    fields: [
      { k: "nama", l: "Nama polis *", ph: "Property All Risk — Pabrik" },
      { k: "penanggung", l: "Penanggung", ph: "PT Asuransi …" },
      { k: "nomor", l: "Nomor polis", ph: "PAR-2026-00001" },
      { k: "objek", l: "Objek pertanggungan", ph: "Tanah & Bangunan · SHGB 812" },
      { k: "nilai", l: "Nilai pertanggungan", ph: "Rp 18 M" },
      { k: "masa", l: "Masa berlaku s.d.", date: true },
      { k: "st", l: "Status", opts: Object.keys(POL_ST) },
    ],
    toData: (v) => { const s = POL_ST[v.st] || POL_ST.AKTIF; return [v.nama, v.penanggung, v.nomor, v.objek, "asset", v.nilai, tglSimpan(v.masa), v.st || "AKTIF", s[0], s[1]]; },
    fromData: (r) => { const a = r as string[]; return { nama: a[0], penanggung: a[1], nomor: a[2], objek: a[3], nilai: a[5], masa: isoDari(a[6]) || a[6], st: a[7] }; },
  },
  agr: {
    title: "Perjanjian", w: 0,
    fields: [
      { k: "n", l: "Nama perjanjian *", ph: "Perjanjian Jasa …" },
      { k: "p2", l: "Pihak kedua *", ph: "PT Mitra …" },
      { k: "mulai", l: "Tanggal mulai", date: true },
      { k: "akhir", l: "Tanggal berakhir", date: true },
      { k: "nilai", l: "Nilai", ph: "Rp 1,2 M / tahun" },
      { k: "st", l: "Status", opts: Object.keys(AGR_ST) },
    ],
    toData: (v, tn) => { const s = AGR_ST[v.st] || AGR_ST.DRAF; return { n: v.n, p1: tn, p2: v.p2, mulai: tglSimpan(v.mulai) || "—", akhir: tglSimpan(v.akhir) || "—", nilai: v.nilai || "—", st: v.st || "DRAF", cls: s[0], lbl: s[1], dok: v.dok || "" }; },
    fromData: (r) => { const o = r as Record<string, string>; return { n: o.n, p2: o.p2, mulai: isoDari(o.mulai) || (o.mulai === "—" ? "" : o.mulai), akhir: isoDari(o.akhir) || (o.akhir === "—" ? "" : o.akhir), nilai: o.nilai, st: o.st, dok: o.dok }; },
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
