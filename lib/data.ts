/* Dataset multi-tenant — porting 1:1 dari referensi Corplex Platform v2 */

export interface Msg { r: "q" | "a" | "esc"; t: string; src?: string; chip?: string; esc?: boolean; cit?: number }
export interface Conv { title: string; domain: string; time: string; msgs: Msg[] }
export interface Flag { id: number; t: string; d: string; w: number; cls: string; fix: string; fixText: string; done?: boolean }
export interface Doc { name: string; sub: string; status: string; cls: string; vers: string[]; risk: number | null; body: string; flags: Flag[] }
export interface SP { t: string; tgl: string; exp: string; expISO: string; alasan: string; dok: string; ver: boolean; st?: string }
export interface Emp {
  id?: string; foto?: string | null; n: string; j: string; jk: "L" | "P"; wn: "TKI" | "TKA"; lok: boolean; s: "PKWT" | "PKWTT"; m: string; sisa: number | null; hari?: string | null; komp: string; pat: string; rem: boolean; dok: string; sp?: SP[]; prov?: string; kota?: string; desa?: string;
  nik?: string; kk?: string; npwp?: string; bpjsKes?: string; bpjsTk?: string; sim?: string; pend?: string; lahir?: string; dept?: string; kdNama?: string; kdTelp?: string; pengalaman?: string; dokUrl?: string;
  agama?: string; nikah?: string; golDarah?: string; bankNama?: string; bankRek?: string; alamatKtp?: string; pendInst?: string;
  gajiPokok?: number | null; tunjTetap?: number | null; upah?: number | null; mulaiKerja?: string; akhirKontrak?: string;
}
export interface Case { id?: string; dokUrl?: string | null; dokNama?: string | null; tab?: string; head: string; tl: string[][]; bukti: string[][]; biaya: string[][]; aksi: { t: string; d: string; btn?: string; toast?: [string, string] }[]; custody?: boolean }
export interface Agr { n: string; p1: string; p2: string; mulai: string; akhir: string; nilai: string; st: string; cls: string; lbl: string; dok: string }
export interface Klaim { t: string; obj: string; nilai: string; cls: string; lbl: string; tl: string[][] | null }
export interface QItem { id?: string; t: string; m: string; chip: string; lbl: string; sla: string; status: "masuk" | "meninjau" | "verified" | "rejected"; note?: string }
export interface IdxItem { t: string; s: string; v: string }

export interface Tenant {
  id: string; name: string; plan: string; ava: string; user: string; sector: string;
  score: number; delta: string;
  kpiDocs: number; kpiDocsTr: string; kpiIzin: number; kpiIzinTr: string;
  quota: { used: number; max: number }; verified: number;
  bab: [string, number, number][];
  rem: string[][]; bell: string[][]; verif: string[][];
  conv: Conv[]; docs: Doc[]; emp: Emp[]; cases: Case[]; idx: IdxItem[];
  agr: Agr[]; empOut: number;
  asetVal: string; asetTr: string;
  asr: { nilai: string; polTr: string; pol: string[][]; klaim: Klaim[]; gap: string[][] };
  tax: { score: number; trend: string; done: number; next: string; nextTr: string; prof: string[][]; kal: (string | null)[][]; join: string[][]; integ: string[][] };
  mass: [string, number, number][];
  queue: QItem[];
  lic: (string | number)[][];
  assets: (string | string[] | null)[][];
  hki: (string | number | string[] | null)[][];
  corp: { id?: string; entity: string; rupsTitle: string; rups: string[][]; circNo: string; dirs: string[][]; meetings: string[][]; cap: string[][]; stat: string[][]; docs: string[][] };
}

/* ============ TENANT 1 — PT CONTOH SEJAHTERA ============ */
const CONVS_T1: Conv[] = [
  { title: "Risiko PHK efisiensi 12 karyawan", domain: "KETENAGAKERJAAN", time: "Hari ini", msgs: [
    { r: "q", t: "Kami berencana melakukan PHK terhadap 12 karyawan karena efisiensi. Apa risiko hukum dan kewajiban pesangonnya?" },
    { r: "a", t: "Berdasarkan rekam hubungan kerja perusahaan Anda — 7 PKWTT dan 5 PKWT aktif dari daftar yang Anda tandai — PHK karena efisiensi tunduk pada UU Ketenagakerjaan dalam rezim Cipta Kerja beserta peraturan pelaksananya.<br/><br/>Kewajiban meliputi <b>pesangon</b>, <b>penghargaan masa kerja</b>, dan <b>penggantian hak</b>. Untuk 5 karyawan PKWT, pengakhiran sebelum jangka waktu menimbulkan kewajiban kompensasi tambahan — rekap massal tersedia di modul Employment.", src: "RUJUKAN ✓ SUMBER RESMI: JDIH · PERATURAN.GO.ID", chip: "DRAF AI — BUKAN NASIHAT HUKUM FINAL" },
    { r: "esc", t: "Rencana ini menimbulkan akibat hukum. Sesuai prinsip human-in-the-loop, sistem merekomendasikan <b>verifikasi advokat MRWP</b> sebelum eksekusi — eskalasi berlangsung dalam percakapan ini juga.", src: "FUNGSI JAMIN · SATU PERCAKAPAN, TANPA PINDAH KANAL", esc: true }] },
  { title: "Pemetaan syarat akuisisi PT target", domain: "KORPORASI", time: "10 Jul", msgs: [
    { r: "q", t: "Apa saja persyaratan hukum untuk mengakuisisi 60% saham perusahaan target di sektor pangan?" },
    { r: "a", t: "Pemetaan awal dari wiki regulasi: (1) persetujuan organ perseroan sesuai AD kedua pihak; (2) kewajiban pengumuman dan perlindungan karyawan/kreditur; (3) analisis ambang notifikasi persaingan usaha berdasarkan nilai aset/penjualan gabungan; (4) due diligence perizinan sektor pangan target.<br/><br/>Checklist due diligence dapat dijalankan otomatis pada dokumen target melalui AI Due Diligence Scanner.", src: "RUJUKAN ✓ SUMBER RESMI — 4 NORMA TERTAUT", chip: "DRAF AI" }] },
  { title: "Kepatuhan regulasi sektoral pangan", domain: "PERIZINAN", time: "8 Jul", msgs: [
    { r: "q", t: "Regulasi apa saja yang wajib dipatuhi untuk lini produk minuman serbuk baru?" },
    { r: "a", t: "Untuk KBLI 11040: izin edar BPOM MD (permohonan Anda sedang berjalan — tahap evaluasi teknis), sertifikasi halal, standar label dan iklan pangan olahan, serta kewajiban keamanan pangan. Seluruh tenggat telah terdaftar pada kalender kewajiban modul Licensing.", src: "RUJUKAN ✓ SUMBER RESMI", chip: "DRAF AI" }] },
];

const DOCS_T1: Doc[] = [
  { name: "Perjanjian_Jasa_Vendor_Logistik.docx", sub: "v3 · review pihak lawan", status: "DRAF AI", cls: "c-draft", vers: ["v3 (terkini)", "v2", "v1"], risk: 72,
    body: `<h5>PERJANJIAN JASA PENGANGKUTAN DAN LOGISTIK<br/>Nomor: 014/PJ-LOG/VII/2026</h5>
    <p><b>PASAL 7 — SANKSI DAN DENDA</b><br/>Dalam hal PIHAK PERTAMA terlambat melakukan pembayaran, <span class="hl" id="hl0">PIHAK KEDUA berhak mengenakan denda sebesar 5% (lima persen) per hari keterlambatan tanpa batas maksimum</span>, terhitung sejak tanggal jatuh tempo tagihan.</p>
    <p><b>PASAL 12 — PENGAKHIRAN PERJANJIAN</b><br/><span class="hl" id="hl1">PIHAK KEDUA dapat mengakhiri Perjanjian ini setiap saat secara sepihak tanpa pemberitahuan terlebih dahulu</span>, sedangkan PIHAK PERTAMA hanya dapat mengakhiri dengan pemberitahuan tertulis 90 (sembilan puluh) hari sebelumnya.</p>
    <p><b>PASAL 15 — PENYELESAIAN SENGKETA</b><br/>Segala sengketa akan diselesaikan melalui <span class="hl hl-w" id="hl2">arbitrase di Singapore International Arbitration Centre (SIAC)</span> dengan hukum yang berlaku adalah hukum Republik Singapura.</p>
    <p style="color:var(--muted);font-size:12px">… 14 pasal lainnya tidak menunjukkan anomali terhadap clause library MRWP …</p>`,
    flags: [
      { id: 0, t: "Denda 5%/hari tanpa plafon", d: "Pasal 7 — penalti sepihak, berpotensi merugikan tidak wajar.", w: 32, cls: "", fix: "Denda keterlambatan berimbang: 1‰/hari, maks. 5% nilai tagihan", fixText: "PIHAK KEDUA berhak mengenakan denda 1‰ (satu permil) per hari, maksimum 5% dari nilai tagihan tertunggak" },
      { id: 1, t: "Pengakhiran tidak seimbang", d: "Pasal 12 — hak sepihak tanpa pemberitahuan hanya bagi lawan.", w: 28, cls: "", fix: "Pengakhiran timbal balik: notifikasi tertulis 30 hari kedua pihak", fixText: "Masing-masing Pihak dapat mengakhiri Perjanjian dengan pemberitahuan tertulis 30 (tiga puluh) hari sebelumnya" },
      { id: 2, t: "Forum arbitrase asing", d: "Pasal 15 — SIAC + hukum Singapura menaikkan biaya sengketa.", w: 12, cls: "w", fix: "Sengketa: musyawarah → BANI, hukum Republik Indonesia", fixText: "arbitrase pada Badan Arbitrase Nasional Indonesia (BANI) dengan hukum yang berlaku adalah hukum Republik Indonesia" }] },
  { name: "NDA_Mitra_Distribusi_Jabar.docx", sub: "v1 · clause library MRWP", status: "DRAF AI", cls: "c-draft", vers: ["v1 (terkini)"], risk: 18,
    body: '<h5>PERJANJIAN KERAHASIAAN (NDA)</h5><p>Dirakit dari clause library MRWP — seluruh klausul tervalidasi advokat; parameter diisi dari wawancara kebutuhan.</p><p style="color:var(--muted);font-size:12px">Tidak ada anomali. Risk score rendah — dasar penilaian: 100% klausul berasal dari library tervalidasi.</p>', flags: [] },
  { name: "Addendum_PK_6_PKWT.docx", sub: "v2 · riwayat 2 versi", status: "VERIFIED", cls: "c-ver", vers: ["v2 (terkini, verified)", "v1"], risk: 8,
    body: "<h5>ADDENDUM PERJANJIAN KERJA</h5><p>Ditandatangani digital oleh advokat MRWP atas hash versi final. QR verifikasi tersemat — status dapat dicek publik tanpa membuka isi.</p>", flags: [] },
  { name: "Somasi_Piutang_CV_X.docx", sub: "v1 · menunggu antrean", status: "DRAF", cls: "c-gray", vers: ["v1"], risk: null,
    body: "<h5>SOMASI I</h5><p>Draf somasi disiapkan dari template — berakibat hukum: <b>wajib TERVERIFIKASI ADVOKAT</b> sebelum dikirim. Ekspor final terkunci (403 VERIFIKASI_WAJIB).</p>", flags: [] },
];

const AGR_T1: Agr[] = [
  { n: "Perjanjian Distribusi Produk", p1: "PT Contoh Sejahtera", p2: "PT Distribusi Prima Nusantara", mulai: "1 Feb 2025", akhir: "31 Jan 2027", nilai: "Rp 2,4 M / tahun", st: "AKTIF", cls: "c-ver", lbl: "AKTIF · VERIFIED", dok: "Perjanjian_Distribusi_2025.pdf" },
  { n: "Perjanjian Pasokan Bahan Baku", p1: "PT Contoh Sejahtera", p2: "PT Agro Pangan Makmur", mulai: "15 Sep 2024", akhir: "14 Sep 2026", nilai: "Rp 850 jt / tahun", st: "SEGERA", cls: "c-red", lbl: "59 HARI", dok: "PKS_Pasokan_AgroPangan_2024.pdf" },
  { n: "Perjanjian Sewa Gudang Distribusi", p1: "PT Contoh Sejahtera", p2: "CV Properti Kencana", mulai: "1 Jan 2026", akhir: "31 Des 2028", nilai: "Rp 180 jt / tahun", st: "AKTIF", cls: "c-ver", lbl: "AKTIF · VERIFIED", dok: "Perjanjian_Sewa_Gudang_2026.pdf" },
  { n: "Perjanjian Kredit Modal Kerja", p1: "PT Contoh Sejahtera", p2: "PT Bank Mandiri (Persero) Tbk", mulai: "20 Jun 2025", akhir: "20 Jun 2027", nilai: "Plafon Rp 8 M", st: "AKTIF", cls: "c-ver", lbl: "AKTIF · VERIFIED", dok: "PK_Kredit_Modal_Kerja_2025.pdf" },
  { n: "NDA — Rahasia Dagang Formula A", p1: "PT Contoh Sejahtera", p2: "4 karyawan kunci R&D", mulai: "10 Mar 2024", akhir: "10 Mar 2029", nilai: "—", st: "AKTIF", cls: "c-ver", lbl: "AKTIF · VERIFIED", dok: "NDA_Formula_A_Bundle.pdf" },
  { n: "Perjanjian Jasa — Vendor Logistik", p1: "PT Contoh Sejahtera", p2: "CV Mitra Kirim", mulai: "(draf) 1 Agu 2026", akhir: "(draf) 31 Jul 2027", nilai: "Rp 250 jt / tahun", st: "DRAF", cls: "c-draft", lbl: "DRAF AI", dok: "Perjanjian_Jasa_Vendor_Logistik_v3.docx" },
];

const IDX_T1: IdxItem[] = [
  { t: "Perjanjian Jasa — Vendor Logistik", s: "Dokumen · Legal Drafter · DRAF AI", v: "drafter" },
  { t: "Sertifikat Standar KBLI 10750", s: "Izin · berakhir 14 hari · Licensing", v: "licensing" },
  { t: "Rina Wulandari", s: "Karyawan PKWT · Employment", v: "employment" },
  { t: "Perjanjian Pasokan Bahan Baku — PT Agro Pangan Makmur", s: "Perjanjian · berakhir 59 hari · Agreement", v: "agreement" },
  { t: "Perjanjian Distribusi — PT Distribusi Prima Nusantara", s: "Perjanjian · aktif s.d. Jan 2027 · Agreement", v: "agreement" },
  { t: "Perkara PHI 45/Pdt.Sus-PHI/2026", s: "Case Management · pembuktian", v: "case" },
  { t: "Merek CONTOH", s: "HKI · perpanjangan 120 hari · Asset & IP", v: "asset" },
  { t: "Risalah RUPS Tahunan 2026", s: "Tata kelola · VERIFIED · CorpSec", v: "corpsec" },
  { t: "Legal Opinion restrukturisasi", s: "VERIFIED · Corporate Lawyer", v: "lawyer" },
  { t: "Polis Property All Risk — Pabrik Cirebon", s: "Asuransi · berakhir 36 hari", v: "asuransi" },
  { t: "Klaim Mesin Filling Lini A", s: "Asuransi · klaim berjalan", v: "asuransi" },
  { t: "PPN Masa Juli 2026", s: "Pajak · lapor & setor 10 hari", v: "pajak" },
  { t: "PBB Tanah & Bangunan Pabrik", s: "Pajak · kewajiban turunan aset", v: "pajak" },
];

/* ============ TENANT 2 — CV KARYA ABADI ============ */
const CONVS_T2: Conv[] = [
  { title: "Retensi 5% proyek pemda", domain: "KONTRAK", time: "Hari ini", msgs: [
    { r: "q", t: "Kontraktor pemberi kerja menahan retensi 5% selama 12 bulan setelah serah terima. Apakah wajar dan bagaimana menagihnya?" },
    { r: "a", t: "Retensi (jaminan pemeliharaan) lazim dalam kontrak konstruksi. Yang perlu dipastikan: dasar retensi pada kontrak, masa pemeliharaan, dan mekanisme pencairan setelah Berita Acara Serah Terima II (FHO). Rekam kontraktual Anda memuat 3 kontrak dengan klausul retensi — dua di antaranya sudah melewati masa pemeliharaan.", src: "RUJUKAN ✓ SUMBER RESMI", chip: "DRAF AI" }] },
  { title: "Klasifikasi & sertifikasi SBU", domain: "PERIZINAN", time: "9 Jul", msgs: [
    { r: "q", t: "SBU kami akan berakhir. Apa konsekuensi bila terlambat memperpanjang saat sedang ada tender berjalan?" },
    { r: "a", t: "Sertifikat Badan Usaha (SBU) yang tidak berlaku dapat menggugurkan kualifikasi pada tender. Modul Licensing Anda mencatat SBU berakhir dalam 21 hari — pengingat bertahap sudah aktif dan pengurusan perpanjangan disarankan segera.", src: "RUJUKAN ✓ SUMBER RESMI", chip: "DRAF AI" }] },
];

const DOCS_T2: Doc[] = [
  { name: "Kontrak_Subkon_Struktur_Gedung.docx", sub: "v2 · review pihak lawan", status: "DRAF AI", cls: "c-draft", vers: ["v2 (terkini)", "v1"], risk: 64,
    body: `<h5>PERJANJIAN SUBKONTRAK PEKERJAAN STRUKTUR<br/>Nomor: 021/SUBKON/VII/2026</h5>
    <p><b>PASAL 6 — PEMBAYARAN &amp; RETENSI</b><br/>PIHAK PERTAMA menahan <span class="hl" id="hl0">retensi sebesar 10% dari setiap termin tanpa batas waktu pencairan yang ditentukan</span>.</p>
    <p><b>PASAL 9 — KETERLAMBATAN</b><br/>Atas keterlambatan penyelesaian, <span class="hl" id="hl1">PIHAK KEDUA dikenakan denda 1% per hari dari nilai total kontrak tanpa plafon</span>.</p>
    <p><b>PASAL 14 — PEMUTUSAN</b><br/>PIHAK PERTAMA dapat memutus kontrak <span class="hl hl-w" id="hl2">tanpa kewajiban membayar pekerjaan yang telah terpasang bila terjadi pemutusan</span>.</p>
    <p style="color:var(--muted);font-size:12px">… pasal lain selaras dengan clause library konstruksi MRWP …</p>`,
    flags: [
      { id: 0, t: "Retensi 10% tanpa batas waktu", d: "Pasal 6 — tidak ada kepastian pencairan retensi.", w: 26, cls: "", fix: "Retensi 5%, cair setelah FHO + masa pemeliharaan", fixText: "retensi sebesar 5% yang dicairkan setelah Serah Terima Kedua (FHO) dan berakhirnya masa pemeliharaan" },
      { id: 1, t: "Denda 1%/hari tanpa plafon", d: "Pasal 9 — akumulatif dari nilai total, berat sebelah.", w: 24, cls: "", fix: "Denda 1‰/hari dari nilai pekerjaan terlambat, maks 5%", fixText: "denda 1‰ per hari dari nilai pekerjaan yang terlambat, maksimum 5%" },
      { id: 2, t: "Hak pekerjaan terpasang hangus", d: "Pasal 14 — berpotensi merugikan tidak wajar.", w: 14, cls: "w", fix: "Pembayaran atas prestasi terpasang wajib diperhitungkan", fixText: "dengan tetap memperhitungkan pembayaran atas prestasi pekerjaan yang telah terpasang" }] },
  { name: "Surat_Penawaran_Tender_Jalan.docx", sub: "v1 · clause library MRWP", status: "DRAF AI", cls: "c-draft", vers: ["v1 (terkini)"], risk: 12,
    body: "<h5>SURAT PENAWARAN — PAKET PRESERVASI JALAN</h5><p>Dirakit dari template tender konstruksi — parameter administratif terisi otomatis dari profil badan usaha.</p>", flags: [] },
  { name: "Adendum_Waktu_Proyek_Irigasi.docx", sub: "v1 · menunggu antrean", status: "DRAF", cls: "c-gray", vers: ["v1"], risk: null,
    body: "<h5>ADENDUM PERPANJANGAN WAKTU</h5><p>Berakibat hukum — wajib TERVERIFIKASI ADVOKAT sebelum ditandatangani para pihak.</p>", flags: [] },
];

const AGR_T2: Agr[] = [
  { n: "Kontrak Pengadaan — Proyek Jalan Pemda", p1: "CV Karya Abadi", p2: "Dinas PUPR Kab. Kuningan", mulai: "3 Mar 2026", akhir: "28 Nov 2026", nilai: "Rp 4,7 M", st: "AKTIF", cls: "c-ver", lbl: "AKTIF · VERIFIED", dok: "Kontrak_Proyek_Jalan_Pemda_2026.pdf" },
  { n: "Perjanjian Sewa Alat Berat", p1: "CV Karya Abadi", p2: "PT Rental Alat Perkasa", mulai: "1 Apr 2026", akhir: "30 Sep 2026", nilai: "Rp 95 jt / bulan", st: "SEGERA", cls: "c-red", lbl: "75 HARI", dok: "Sewa_Alat_Berat_2026.pdf" },
  { n: "Kontrak Subkontrak Struktur", p1: "CV Karya Abadi", p2: "PT Beton Sejahtera", mulai: "(draf) —", akhir: "(draf) —", nilai: "Rp 1,2 M", st: "DRAF", cls: "c-draft", lbl: "DRAF AI · 3 RED FLAG", dok: "Kontrak_Subkon_Struktur_v2.docx" },
  { n: "Perjanjian Sewa Kantor & Gudang", p1: "CV Karya Abadi", p2: "H. Mahmud (perorangan)", mulai: "1 Jan 2025", akhir: "31 Des 2027", nilai: "Rp 60 jt / tahun", st: "AKTIF", cls: "c-ver", lbl: "AKTIF · VERIFIED", dok: "Sewa_Kantor_Gudang_2025.pdf" },
];

/* ============ TENANT 3 — PT NUSANTARA DIGITAL ============ */
const CONVS_T3: Conv[] = [
  { title: "Kepatuhan pelindungan data (UU PDP)", domain: "REGULASI", time: "Hari ini", msgs: [
    { r: "q", t: "Sebagai penyelenggara aplikasi fintech, kewajiban apa yang timbul dari UU PDP untuk pemrosesan data pengguna kami?" },
    { r: "a", t: "Sebagai Pengendali Data Pribadi, kewajiban mencakup: dasar pemrosesan yang sah, pemberitahuan & persetujuan, penunjukan DPO bila memenuhi kriteria, langkah keamanan teknis-organisasi, serta prosedur pemberitahuan insiden. Rekam Anda memuat 2 perjanjian pemrosesan data (DPA) dengan vendor cloud yang perlu ditinjau kesesuaiannya.", src: "RUJUKAN ✓ SUMBER RESMI — UU 27/2022", chip: "DRAF AI" }] },
  { title: "Struktur putaran pendanaan Seri B", domain: "KORPORASI", time: "11 Jul", msgs: [
    { r: "q", t: "Apa implikasi hukum penerbitan saham seri baru dengan hak preferensi untuk investor Seri B?" },
    { r: "a", t: "Penerbitan saham klasifikasi baru memerlukan perubahan anggaran dasar, persetujuan RUPS dengan kuorum yang ditentukan, dan penyesuaian cap table. Hak preferensi (likuidasi, anti-dilusi) harus tertuang di AD dan shareholders agreement — modul Corporate Secretary melacak tenggat statutori perubahan AD.", src: "RUJUKAN ✓ SUMBER RESMI — 4 NORMA TERTAUT", chip: "DRAF AI" }] },
  { title: "Lisensi perangkat lunak pihak ketiga", domain: "KONTRAK", time: "7 Jul", msgs: [
    { r: "q", t: "Kami memakai komponen open-source berlisensi copyleft dalam produk berbayar. Apa risikonya?" },
    { r: "a", t: "Lisensi copyleft dapat mewajibkan pembukaan kode turunan tergantung jenis lisensi dan cara penggabungan. Diperlukan audit lisensi komponen (software bill of materials) — AI Due Diligence Scanner dapat memetakan komponen dan tingkat risikonya.", src: "RUJUKAN ✓ SUMBER RESMI", chip: "DRAF AI" }] },
];

const DOCS_T3: Doc[] = [
  { name: "Perjanjian_Berlangganan_SaaS_Enterprise.docx", sub: "v4 · review pihak lawan", status: "DRAF AI", cls: "c-draft", vers: ["v4 (terkini)", "v3", "v2", "v1"], risk: 58,
    body: `<h5>MASTER SUBSCRIPTION AGREEMENT (SaaS)<br/>Nomor: 048/MSA/VII/2026</h5>
    <p><b>PASAL 8 — BATASAN TANGGUNG JAWAB</b><br/><span class="hl" id="hl0">Tanggung jawab Penyedia dibatasi hingga nilai 1 (satu) bulan langganan untuk seluruh klaim apa pun</span>, termasuk kehilangan data.</p>
    <p><b>PASAL 11 — DATA PENGGUNA</b><br/><span class="hl" id="hl1">Penyedia berhak menggunakan data Pelanggan untuk tujuan pengembangan produk tanpa batasan</span>.</p>
    <p><b>PASAL 16 — HUKUM YANG BERLAKU</b><br/>Perjanjian tunduk pada <span class="hl hl-w" id="hl2">hukum negara bagian Delaware, AS, dengan yurisdiksi eksklusif pengadilan setempat</span>.</p>
    <p style="color:var(--muted);font-size:12px">… ketentuan SLA &amp; keamanan selaras clause library teknologi MRWP …</p>`,
    flags: [
      { id: 0, t: "Cap liability 1 bulan", d: "Pasal 8 — batas terlalu rendah untuk kehilangan data.", w: 24, cls: "", fix: "Cap 12 bulan biaya; kehilangan data dikecualikan dari cap", fixText: "dibatasi hingga nilai 12 (dua belas) bulan langganan, dengan pengecualian atas pelanggaran kerahasiaan dan kehilangan data" },
      { id: 1, t: "Penggunaan data tanpa batas", d: "Pasal 11 — bertentangan dengan prinsip UU PDP.", w: 22, cls: "", fix: "Pemrosesan hanya untuk penyediaan layanan, sesuai DPA", fixText: "hanya memproses Data Pelanggan sepanjang diperlukan untuk penyediaan Layanan sesuai Perjanjian Pemrosesan Data (DPA) terlampir" },
      { id: 2, t: "Forum & hukum asing", d: "Pasal 16 — Delaware menaikkan biaya & risiko sengketa.", w: 12, cls: "w", fix: "Hukum Republik Indonesia; sengketa via BANI", fixText: "hukum Republik Indonesia, dan sengketa diselesaikan melalui BANI" }] },
  { name: "DPA_Vendor_Cloud_Region_Jakarta.docx", sub: "v2 · clause library MRWP", status: "DRAF AI", cls: "c-draft", vers: ["v2 (terkini)", "v1"], risk: 16,
    body: "<h5>PERJANJIAN PEMROSESAN DATA (DPA)</h5><p>Dirakit dari clause library pelindungan data — memuat kewajiban keamanan, sub-prosesor, dan pemberitahuan insiden sesuai UU PDP.</p>", flags: [] },
  { name: "Term_of_Service_Aplikasi.docx", sub: "v3 · riwayat 3 versi", status: "VERIFIED", cls: "c-ver", vers: ["v3 (terkini, verified)", "v2", "v1"], risk: 9,
    body: "<h5>SYARAT &amp; KETENTUAN LAYANAN</h5><p>Ditandatangani digital oleh advokat MRWP atas hash versi final. QR verifikasi tersemat.</p>", flags: [] },
  { name: "Shareholders_Agreement_SeriB.docx", sub: "v1 · menunggu antrean", status: "DRAF", cls: "c-gray", vers: ["v1"], risk: null,
    body: "<h5>SHAREHOLDERS AGREEMENT — SERI B</h5><p>Berakibat hukum — wajib TERVERIFIKASI ADVOKAT. Ekspor final terkunci hingga verifikasi.</p>", flags: [] },
];

const AGR_T3: Agr[] = [
  { n: "Master Subscription Agreement (SaaS)", p1: "PT Nusantara Digital", p2: "PT Enterprise Klien Utama", mulai: "(draf) 1 Agu 2026", akhir: "(draf) 31 Jul 2028", nilai: "Rp 3,6 M / tahun", st: "DRAF", cls: "c-draft", lbl: "DRAF AI · RISK 58", dok: "Perjanjian_Berlangganan_SaaS_Enterprise.docx" },
  { n: "Perjanjian Pemrosesan Data (DPA)", p1: "PT Nusantara Digital", p2: "Vendor Cloud Region Jakarta", mulai: "12 Feb 2026", akhir: "12 Feb 2028", nilai: "Mengikuti MSA cloud", st: "AKTIF", cls: "c-ver", lbl: "AKTIF · VERIFIED", dok: "DPA_Vendor_Cloud_Region_Jakarta.docx" },
  { n: "Perjanjian Escrow Kode Sumber", p1: "PT Nusantara Digital", p2: "PT Escrow Agent Indonesia", mulai: "5 Mei 2025", akhir: "5 Mei 2027", nilai: "Rp 45 jt / tahun", st: "AKTIF", cls: "c-ver", lbl: "AKTIF · VERIFIED", dok: "Perjanjian_Escrow_Kode_Sumber.pdf" },
  { n: "Perjanjian Kemitraan Payment Gateway", p1: "PT Nusantara Digital", p2: "PT Gerbang Bayar Nasional", mulai: "18 Okt 2024", akhir: "18 Okt 2026", nilai: "Rev-share 0,8%", st: "SEGERA", cls: "c-red", lbl: "93 HARI", dok: "PKS_Payment_Gateway_2024.pdf" },
  { n: "Shareholders Agreement — Seri B", p1: "Founders & Ventura Seri A", p2: "Ventura Seri B", mulai: "(draf) —", akhir: "(draf) —", nilai: "Investasi Seri B", st: "DRAF", cls: "c-gold", lbl: "MENUNGGU VERIFIKASI", dok: "Shareholders_Agreement_SeriB.docx" },
];

/* ============ REGISTRI TENANT ============ */
export const TENANTS: Record<string, Tenant> = {
  t1: {
    id: "t1", name: "PT Contoh Sejahtera", plan: "BUSINESS", ava: "CS", user: "Sari Dewi · Legal Admin",
    sector: "Industri Pangan Olahan · Cirebon", score: 92, delta: "▲ +4 dari bulan lalu",
    kpiDocs: 247, kpiDocsTr: "▲ 12 bulan ini", kpiIzin: 9, kpiIzinTr: "● 2 mendekati tenggat",
    quota: { used: 7, max: 10 }, verified: 31,
    bab: [["Kontraktual", 86, 86], ["Hubungan kerja", 64, 64], ["Perizinan", 41, 41], ["Tata kelola · Aset · Perkara", 56, 56]],
    rem: [
      ["Perpanjangan Sertifikat Standar KBLI 10750", "Licensing · tangga eskalasi H-90 → H-14 tercapai", "c-red", "14 HARI", "licensing"],
      ["PKWT 6 karyawan berakhir Agustus 2026", "Employment · rekap kompensasi massal tersedia", "c-draft", "32 HARI", "employment"],
      ["Perjanjian Pasokan Bahan Baku berakhir", "Agreement · PT Agro Pangan Makmur · opsi perpanjangan H-60", "c-red", "59 HARI", "agreement"],
      ["Laporan LKPM Triwulan III", "Licensing · rekap tenaga kerja siap dari modul Employment", "c-draft", "48 HARI", "licensing"],
      ["Perpanjangan perlindungan Merek “CONTOH”", "Asset & IP · jendela perpanjangan DJKI terbuka", "c-mon", "120 HARI", "asset"],
      ["Pemberitahuan perubahan pengurus ke Menkumham", "Corporate Secretary · tenggat statutori pasca RUPS", "c-mon", "TERJADWAL", "corpsec"],
      ["PPN Masa Juli — lapor & setor", "Kepatuhan Pajak · DPP dari rekam kontraktual", "c-red", "10 HARI", "pajak"],
      ["Perpanjangan Polis Property All Risk — Pabrik", "Asuransi · objek tertaut: Tanah & Bangunan (SHGB 812)", "c-draft", "36 HARI", "asuransi"],
      ["Rapat Umum Pemegang Saham Luar Biasa", "Corporate Secretary · Agenda persetujuan akuisisi", "c-mon", "21 HARI", "corpsec"],
      ["Laporan Penanaman Modal (LKPM)", "Kewajiban pelaporan investasi berkala ke BKPM", "c-red", "5 HARI", "licensing"],
      ["Perpanjangan Hak Guna Bangunan", "Sertifikat HGB akan habis masa berlakunya", "c-mon", "90 HARI", "asset"],
      ["Audit Kepatuhan Lingkungan", "Pemeriksaan standar baku mutu air limbah", "c-draft", "45 HARI", "licensing"]],
    bell: [
      ["shield", "Sertifikat Standar KBLI 10750", "Berakhir 14 hari lagi — pengurusan perpanjangan disiapkan", "licensing"],
      ["users", "6 PKWT berakhir Agustus", "Kompensasi PKWT wajib dihitung — rekap massal tersedia", "employment"],
      ["scroll", "Perjanjian Pasokan berakhir 59 hari", "PT Agro Pangan Makmur — opsi perpanjangan terbuka", "agreement"],
      ["file", "LKPM Triwulan III", "48 hari — rekap tenaga kerja siap dari modul Employment", "licensing"],
      ["landmark", "Pemberitahuan Menkumham", "Tenggat 30 hari pasca RUPS — disiapkan notaris rekanan", "corpsec"],
      ["radar", "3 perubahan regulasi terdeteksi", "Relevan bidang usaha Anda — ringkasan dampak DRAF AI siap", "assistant"],
      ["receipt", "PPN Masa Juli", "10 hari — SPT Masa siap lapor dari rekam kontraktual", "pajak"],
      ["lifebuoy", "Polis Property All Risk berakhir", "36 hari — permintaan penawaran perpanjangan siap", "asuransi"]],
    verif: [
      ["Legal Opinion restrukturisasi", "Ditandatangani advokat MRWP", "c-ver", "VERIFIED"],
      ["Perjanjian Jasa — Vendor Logistik", "2 red flag terdeteksi", "c-draft", "DRAF AI"],
      ["Risalah RUPS Tahunan 2026", "Corporate Secretary", "c-ver", "VERIFIED"],
      ["Perjanjian Sewa Kantor Cabang", "Menunggu tanda tangan direksi", "c-draft", "DRAF AI"],
      ["Perpanjangan Izin Usaha", "OSS RBA — Sedang diproses", "c-warn", "PENDING"],
      ["Kontrak Kerja Karyawan (PKWT)", "30 dokumen diverifikasi massal", "c-ver", "VERIFIED"],
      ["Somasi Pelanggaran HKI", "Draf awal dari Legal Assistant", "c-draft", "DRAF AI"],
      ["NDA — PT Inovasi Teknologi", "Ditandatangani kedua belah pihak", "c-ver", "VERIFIED"]],
    conv: CONVS_T1, docs: DOCS_T1, emp: [], cases: [], idx: IDX_T1,
    agr: AGR_T1, empOut: 1,
    asetVal: "Rp 24,6 M", asetTr: "4 kategori · 2 dibebani · DD terjadwal",
    asr: { nilai: "Rp 25,1 M", polTr: "1 klaim berjalan · 1 segera berakhir",
      pol: [
        ["Property All Risk — Pabrik Cirebon", "PT Asuransi Sinar Proteksi", "PAR-2025-08812", "Tanah & Bangunan Pabrik · SHGB No. 812", "asset", "Rp 18 M", "18 Agu 2026", "SEGERA", "c-red", "36 HARI"],
        ["Kendaraan Bermotor — Armada Truk", "PT Asuransi Sinar Proteksi", "KBM-2026-00341", "Armada Truk (6 unit · 2 fidusia)", "asset", "Rp 2,1 M", "s.d. Feb 2027", "AKTIF", "c-ver", "AKTIF"],
        ["Machinery Breakdown — Lini Produksi", "PT Proteksi Industri Utama", "MB-2025-1120", "Mesin Produksi Lini A (8 unit)", "asset", "Rp 4,2 M", "s.d. Nov 2026", "KLAIM", "c-draft", "KLAIM BERJALAN"],
        ["BPJS Ketenagakerjaan — JKK · JKM · JHT", "BPJS Ketenagakerjaan", "KPJ-1002938", "48 tenaga kerja · modul Employment", "employment", "Sesuai program", "Iuran bulanan", "AKTIF", "c-ver", "IURAN LUNAS"],
        ["Marine Cargo — Jalur Distribusi", "PT Asuransi Niaga Samudra", "MC-2026-0077", "Perjanjian Distribusi · Agreement 4.9", "agreement", "Rp 800 jt / kirim", "s.d. Des 2026", "AKTIF", "c-ver", "AKTIF"]],
      klaim: [
        { t: "Klaim Kerusakan Mesin Filling — Lini A", obj: "Polis MB-2025-1120 · Mesin Produksi Lini A", nilai: "Estimasi Rp 380 jt", cls: "c-draft", lbl: "PROSES",
          tl: [["28 JUN 2026", "Insiden dilaporkan", "Berita acara + foto masuk vault (hash tercatat)", "done"], ["1 JUL 2026", "Berkas klaim lengkap", "Polis, invoice mesin & BAST ditarik otomatis dari rekam aset", "done"], ["8 JUL 2026", "Survei loss adjuster", "Laporan surveyor diterima — tanpa catatan", "done"], ["MENUNGGU", "Penawaran ganti rugi penanggung", "Estimasi 10 hari kerja · pengingat JAGA aktif", "next"]] },
        { t: "Klaim Kendaraan — Truk B 9812 XX", obj: "Polis KBM-2026-00341 · tabrakan minor", nilai: "Rp 42 jt — cair 19 Mei 2026", cls: "c-ver", lbl: "SELESAI", tl: null }],
      gap: [
        ["Penyertaan Saham PT Anak Usaha", "Aset tercatat tanpa polis tertaut — konsisten dengan temuan Due Diligence 4.6", "c-red", "TANPA POLIS"],
        ["Business Interruption", "Pabrik tunggal — gangguan produksi belum dipertanggungkan", "c-draft", "REKOMENDASI"]] },
    tax: { score: 94, trend: "▲ +2 · seluruh masa tepat waktu", done: 19,
      next: "PPN Masa Jul", nextTr: "Lapor & setor — 10 hari",
      prof: [
        ["NPWP", "01.234.567.8-901.000 · KPP Madya Cirebon", "c-mon", "TERDAFTAR"],
        ["Status PKP", "Dikukuhkan 2019 · e-Faktur aktif", "c-ver", "PKP"],
        ["KLU", "10750 — Industri makanan olahan (selaras KBLI Licensing)", "c-ver", "SELARAS"],
        ["Kuasa & wakil", "Konsultan pajak terdaftar + advokat MRWP (sengketa)", "c-gold", "TERSEDIA"]],
      kal: [
        ["PPN Masa Juli 2026", "DPP ditarik dari rekam kontraktual (4.9) · 214 faktur keluaran", "c-red", "10 HARI", "Lapor + Setor", "PPN Masa Agu — 40 hari"],
        ["PPh 21 Masa Juli 2026", "Dihitung dari 48 tenaga kerja modul Employment (4.3)", "c-draft", "20 HARI", "Setor + Bukti", "PPh 21 Agu — 50 hari"],
        ["PPh 25 Angsuran Juli", "Angsuran badan bulanan", "c-draft", "20 HARI", "Setor + Bukti", "Angsuran Agu — 50 hari"],
        ["PBB — Tanah & Bangunan Pabrik", "Kewajiban turunan aset SHGB No. 812 (4.6)", "c-mon", "78 HARI", "Bayar + Bukti", "PBB 2027 — terjadwal"],
        ["Pajak Kendaraan — 6 unit armada", "Kewajiban turunan aset armada (4.6) · 2 unit lebih dulu", "c-mon", "TERJADWAL", null, ""],
        ["SPT Tahunan Badan TP 2026", "Menunggu LK audited — kalender tata kelola CorpSec (4.5)", "c-gray", "APR 2027", null, ""]],
      join: [
        ["LKPM Triwulan III ↔ rekonsiliasi omzet", "Angka LKPM (Licensing 4.4) dicek silang dengan DPP PPN masa", "licensing", "c-draft", "48 HARI"],
        ["Pemberitahuan Menkumham ↔ data WP", "Perubahan pengurus (CorpSec 4.5) memicu pemutakhiran data WP badan", "corpsec", "c-mon", "TERJADWAL"],
        ["Premi polis jatuh tempo", "Kalender asuransi (4.10) tampil pada kalender kepatuhan yang sama", "asuransi", "c-mon", "GABUNG"]],
      integ: [
        ["Employment → PPh 21", "Perubahan headcount & upah otomatis memperbarui perhitungan masa — 48 tenaga kerja tersinkron", "employment", "c-ver", "TERSINKRON"],
        ["Asset & IP → PBB & Pajak Kendaraan", "Registrasi aset otomatis membuat kewajiban pajak turunannya", "asset", "c-ver", "TERSINKRON"],
        ["Agreement → DPP PPN", "Nilai perikatan & termin menjadi dasar rekonsiliasi omzet", "agreement", "c-ver", "TERSINKRON"],
        ["Licensing → LKPM & OSS", "Satu kalender kepatuhan: tenggat pajak berdampingan dengan kewajiban pasca-izin", "licensing", "c-ver", "TERSINKRON"],
        ["CorpSec → SPT Tahunan & dividen", "Keputusan RUPS atas laba/dividen memicu kewajiban PPh terkait + jadwal SPT", "corpsec", "c-mon", "DIPANTAU"]] },
    mass: [["Rina Wulandari", 5200000, 23], ["Budi Santoso", 5100000, 23], ["Lina Kartika", 5400000, 23], ["Maya Puspita", 5000000, 22], ["Agus Salim", 4900000, 20], ["Tono Wijaya", 4800000, 18]],
    queue: [
      { t: "Perjanjian Jasa — Vendor Logistik v3", m: "Dari Legal Drafter · risk 72 · 2 red flag + 1 perhatian · klausul pengganti tersedia", chip: "c-red", lbl: "RISIKO TINGGI", sla: "SLA 18 JAM", status: "masuk" },
      { t: "Analisis PHK efisiensi 12 karyawan", m: "Eskalasi dari AI Assistant · perhitungan terlampir · risiko PHI dinilai", chip: "c-gold", lbl: "ESKALASI", sla: "SLA 21 JAM", status: "masuk" },
      { t: "Surat Peringatan II — Rudi Hartawan", m: "Dari Employment · alur SP berjenjang · riwayat SP1 terlampir", chip: "c-draft", lbl: "DRAF AI", sla: "SLA 23 JAM", status: "masuk" }],
    lic: [
      ["NIB 1234567890123", "Nomor Induk Berusaha", "PT Contoh Sejahtera", "10750", "ok", 100, "Selama menjalankan usaha", "AKTIF", "c-ver", "AKTIF", "detail"],
      ["Sertifikat Standar", "Industri makanan olahan", "Pabrik Cirebon", "10750", "dg", 6, "Berakhir 27 Jul 2026 — 14 hari", "SEGERA", "c-red", "SEGERA", "renew"],
      ["Persetujuan Lingkungan", "UKL-UPL", "Pabrik Cirebon", "10750", "ok", 78, "Kewajiban laporan berkala", "AKTIF", "c-ver", "AKTIF", "detail"],
      ["Sertifikat Halal", "BPJPH", "Lini produk A", "10750", "wa", 42, "Berakhir Feb 2027 — 210 hari", "AKTIF", "c-draft", "REMINDER", "detail"],
      ["Izin Edar BPOM MD", "Produk minuman serbuk", "Lini produk B", "11040", "wa", 30, "Permohonan 1 Jul 2026", "PENGURUSAN", "c-mon", "PENGURUSAN", "track"]],
    assets: [
      ["Tanah & Bangunan Pabrik", "Cirebon · 4.200 m²", "SHGB No. 812", ["c-gold", "HAK TANGGUNGAN", "Bank Mandiri · Rp 8 M"], "PBB 2026 · HGB s.d. 2031", "c-ver", "AMAN"],
      ["Armada Truk (6 unit)", "Logistik distribusi", "BPKB lengkap", ["c-gold", "FIDUSIA", "2 unit · leasing"], "Pajak · sertifikat fidusia", "c-ver", "AMAN"],
      ["Mesin Produksi Lini A", "8 unit · 2023", "Invoice & BAST", null, "—", "c-ver", "AMAN"],
      ["Penyertaan Saham PT Anak Usaha", "40% kepemilikan", "Akta & DPS", null, "DD berkala", "c-draft", "DD TERJADWAL"]],
    hki: [
      ["Merek “CONTOH”", "Logo + kata", "IDM00123456 · Kelas 30", "wa", 22, "Jendela perpanjangan terbuka — 120 hari", ["c-ver", "BERSIH"], ["c-draft", "PERPANJANG"]],
      ["Merek “CONTOH FRESH”", "Lini minuman", "D2026-4521 · Kelas 32", "", 0, "Pemeriksaan substantif DJKI", null, ["c-mon", "PROSES"]],
      ["Desain Industri Kemasan", "Botol seri B", "IDD00098765", "ok", 70, "s.d. 2031", ["c-red", "1 INDIKASI"], ["c-red", "TINDAK LANJUT"]],
      ["Rahasia Dagang — Formula A", "NDA karyawan kunci", "4 NDA aktif", "", 0, "Selama dijaga · masa NDA turut dipantau", ["c-ver", "TERJAGA"], ["c-ver", "AMAN"]]],
    corp: { entity: "PT Contoh Sejahtera", rupsTitle: "—", rups: [], circNo: "—", dirs: [], meetings: [], cap: [], stat: [], docs: [] },
  },
  t2: {
    id: "t2", name: "CV Karya Abadi", plan: "BASIC", ava: "KA", user: "Sugeng Riyadi · Owner",
    sector: "Jasa Konstruksi · Kuningan", score: 78, delta: "▲ +2 dari bulan lalu",
    kpiDocs: 63, kpiDocsTr: "▲ 4 bulan ini", kpiIzin: 4, kpiIzinTr: "● 1 mendekati tenggat",
    quota: { used: 2, max: 4 }, verified: 6,
    bab: [["Kontraktual", 54, 54], ["Hubungan kerja", 22, 22], ["Perizinan", 30, 30], ["Tata kelola · Aset · Perkara", 18, 18]],
    rem: [
      ["Perpanjangan SBU (Sertifikat Badan Usaha)", "Licensing · berakhir saat tender berjalan", "c-red", "21 HARI", "licensing"],
      ["PKWT 2 pekerja proyek jalan berakhir", "Employment · kompensasi wajib dihitung", "c-draft", "20 HARI", "employment"],
      ["Laporan realisasi proyek pemda", "Licensing · kewajiban pelaporan berkala", "c-mon", "40 HARI", "licensing"],
      ["Retensi 2 proyek melewati masa pemeliharaan", "Case · penagihan pencairan retensi", "c-mon", "TERJADWAL", "case"],
      ["PPh Final 4(2) — termin III proyek jalan", "Kepatuhan Pajak · rekonsiliasi bukti potong", "c-red", "12 HARI", "pajak"],
      ["Klaim excavator — menunggu surveyor", "Asuransi · polis alat berat HE-2025-0088", "c-draft", "SURVEI", "asuransi"]],
    bell: [
      ["shield", "SBU segera berakhir", "21 hari — berisiko menggugurkan kualifikasi tender", "licensing"],
      ["hardhat", "2 PKWT proyek berakhir", "Kompensasi PKWT wajib dihitung", "employment"],
      ["coins", "Retensi belum cair", "2 proyek lewat masa pemeliharaan — dapat ditagih", "case"],
      ["file", "Laporan realisasi proyek", "40 hari — kewajiban ke pemberi kerja pemda", "licensing"],
      ["receipt", "PPh Final termin proyek", "12 hari — rekonsiliasi bukti potong", "pajak"],
      ["lifebuoy", "Klaim excavator", "Berkas lengkap — jadwal survei 3 hari lagi", "asuransi"]],
    verif: [
      ["Kontrak Subkontrak Struktur", "3 red flag terdeteksi", "c-draft", "DRAF AI"],
      ["Adendum Waktu Proyek Irigasi", "Menunggu verifikasi advokat", "c-mon", "MENUNGGU"],
      ["Surat Kuasa Direksi", "Ditandatangani advokat MRWP", "c-ver", "VERIFIED"]],
    conv: CONVS_T2, docs: DOCS_T2, emp: [], cases: [],
    idx: [
      { t: "Kontrak Subkon Struktur Gedung", s: "Dokumen · Legal Drafter · DRAF AI", v: "drafter" },
      { t: "SBU Konstruksi", s: "Izin · berakhir 21 hari · Licensing", v: "licensing" },
      { t: "Slamet Widodo", s: "Operator alat berat PKWT · Employment", v: "employment" },
      { t: "Kontrak Proyek Jalan Pemda", s: "Perjanjian · Dinas PUPR Kuningan · Agreement", v: "agreement" },
      { t: "Wanprestasi Pemasok Beton", s: "Case · pra-litigasi", v: "case" },
      { t: "Alat Berat Excavator", s: "Aset · fidusia · Asset & IP", v: "asset" },
      { t: "Polis CAR Proyek Jalan Pemda", s: "Asuransi · masa proyek", v: "asuransi" },
      { t: "PPh Final Jasa Konstruksi", s: "Pajak · termin III — 12 hari", v: "pajak" }],
    agr: AGR_T2, empOut: 2,
    asetVal: "Rp 6,8 M", asetTr: "3 kategori · alat berat fidusia",
    asr: { nilai: "Rp 9,4 M", polTr: "1 klaim berjalan",
      pol: [
        ["CAR — Proyek Jalan Pemda", "PT Asuransi Karya Proteksi", "CAR-2026-0219", "Kontrak Pengadaan Pemda · Agreement 4.9", "agreement", "Rp 4,7 M", "s.d. serah terima (28 Nov 2026)", "SEGERA", "c-draft", "MASA PROYEK"],
        ["Heavy Equipment — 4 Alat Berat", "PT Asuransi Karya Proteksi", "HE-2025-0088", "Excavator & Alat Berat · syarat kreditur fidusia", "asset", "Rp 3,9 M", "s.d. Mar 2027", "KLAIM", "c-draft", "KLAIM BERJALAN"],
        ["BPJS Ketenagakerjaan — pekerja proyek", "BPJS Ketenagakerjaan", "KPJ-2201456", "Seluruh pekerja proyek · Employment", "employment", "Sesuai program", "Iuran bulanan", "AKTIF", "c-ver", "IURAN LUNAS"]],
      klaim: [
        { t: "Klaim Kerusakan Excavator PC200", obj: "Polis HE-2025-0088 · longsor lokasi proyek irigasi", nilai: "Estimasi Rp 260 jt", cls: "c-draft", lbl: "PROSES",
          tl: [["30 JUN 2026", "Insiden dilaporkan", "Berita acara K3 + foto lokasi → vault", "done"], ["4 JUL 2026", "Berkas klaim lengkap", "BPKB, sertifikat fidusia & invoice ditarik dari rekam aset", "done"], ["MENUNGGU", "Survei loss adjuster", "Jadwal survei 3 hari lagi — pengingat JAGA aktif", "next"]] }],
      gap: [
        ["Kantor & Gudang Material (sewa)", "Kebakaran isi bangunan belum dipertanggungkan — objek sewa", "c-red", "TANPA POLIS"],
        ["CAR proyek irigasi baru", "Kontrak baru terdeteksi di Agreement — polis CAR belum tertaut", "c-draft", "REKOMENDASI"]] },
    tax: { score: 81, trend: "▲ +3 · 1 pembetulan masa lalu", done: 11,
      next: "PPh Final 4(2)", nextTr: "Termin III — 12 hari",
      prof: [
        ["NPWP", "02.998.123.4-443.000 · KPP Pratama Kuningan", "c-mon", "TERDAFTAR"],
        ["Status PKP", "Dikukuhkan 2021", "c-ver", "PKP"],
        ["KLU", "42101 — Konstruksi jalan (selaras SBU & KBLI)", "c-ver", "SELARAS"],
        ["Skema usaha", "PPh Final 4(2) jasa konstruksi — tarif mengikuti kualifikasi SBU", "c-gold", "FINAL"]],
      kal: [
        ["PPh Final 4(2) — Termin III proyek jalan", "Dipotong pemberi kerja · bukti potong direkonsiliasi dengan termin kontrak (4.9)", "c-red", "12 HARI", "Rekonsiliasi", "Termin IV — sesuai progres"],
        ["PPN Masa Juli 2026", "Faktur atas termin proyek — DPP dari rekam kontraktual", "c-draft", "10 HARI", "Lapor + Setor", "PPN Agu — 40 hari"],
        ["PPh 21 Masa Juli 2026", "Pekerja proyek & tetap — dari modul Employment (4.3)", "c-draft", "20 HARI", "Setor + Bukti", "PPh 21 Agu — 50 hari"],
        ["Pajak Alat Berat", "Kewajiban turunan aset alat berat (4.6)", "c-mon", "TERJADWAL", null, ""],
        ["SPT Tahunan Badan TP 2026", "Kalender tata kelola badan usaha (4.5)", "c-gray", "APR 2027", null, ""]],
      join: [
        ["SBU & kualifikasi ↔ tarif PPh Final", "Perubahan kualifikasi SBU (Licensing 4.4) mengubah tarif final", "licensing", "c-red", "21 HARI"],
        ["Laporan realisasi proyek ↔ omzet", "Rekonsiliasi laporan pemda dengan DPP PPN masa", "licensing", "c-mon", "40 HARI"],
        ["Premi CAR & alat berat", "Jatuh tempo premi pada kalender kepatuhan yang sama", "asuransi", "c-mon", "GABUNG"]],
      integ: [
        ["Agreement → PPh Final per termin", "Setiap termin kontrak memicu kewajiban rekonsiliasi bukti potong", "agreement", "c-ver", "TERSINKRON"],
        ["Licensing (SBU) → tarif final", "Kualifikasi badan usaha menentukan tarif PPh Final 4(2)", "licensing", "c-ver", "TERSINKRON"],
        ["Asset & IP → pajak alat berat", "Registrasi alat berat otomatis membuat kewajiban pajaknya", "asset", "c-ver", "TERSINKRON"],
        ["Employment → PPh 21 pekerja proyek", "Mobilisasi/demobilisasi pekerja memperbarui perhitungan masa", "employment", "c-mon", "DIPANTAU"]] },
    mass: [["Slamet Widodo", 4300000, 20], ["Bambang Irawan", 4100000, 20]],
    queue: [
      { t: "Kontrak Subkontrak Struktur v2", m: "Dari Legal Drafter · risk 64 · 2 red flag + 1 perhatian", chip: "c-red", lbl: "RISIKO TINGGI", sla: "SLA 44 JAM", status: "masuk" },
      { t: "Adendum Waktu Proyek Irigasi", m: "Berakibat hukum · wajib verifikasi advokat", chip: "c-draft", lbl: "DRAF AI", sla: "SLA 46 JAM", status: "masuk" }],
    lic: [
      ["NIB 3210987654321", "Nomor Induk Berusaha", "CV Karya Abadi", "42101", "ok", 100, "Selama menjalankan usaha", "AKTIF", "c-ver", "AKTIF", "detail"],
      ["SBU Konstruksi", "Klasifikasi BG & SI", "CV Karya Abadi", "42101", "dg", 9, "Berakhir 3 Agu 2026 — 21 hari", "SEGERA", "c-red", "SEGERA", "renew"],
      ["SKK Tenaga Ahli", "3 personel bersertifikat", "Kuningan", "—", "wa", 48, "Berkala per personel", "AKTIF", "c-draft", "REMINDER", "detail"],
      ["Sertifikat Standar K3 Konstruksi", "SMKK", "Proyek berjalan", "42101", "ok", 66, "Aktif", "AKTIF", "c-ver", "AKTIF", "detail"]],
    assets: [
      ["Excavator & Alat Berat (4 unit)", "Peralatan proyek", "BPKB & invoice", ["c-gold", "FIDUSIA", "2 unit · leasing"], "Pajak · sertifikat fidusia", "c-ver", "AMAN"],
      ["Kantor & Gudang Material", "Kuningan · sewa", "Perjanjian sewa", null, "Jatuh tempo sewa 2027", "c-ver", "AMAN"],
      ["Kendaraan Operasional (3 unit)", "Pick-up & truk", "BPKB lengkap", null, "Pajak kendaraan", "c-ver", "AMAN"]],
    hki: [
      ["Merek “KARYA ABADI”", "Logo badan usaha", "IDM00456789 · Kelas 37", "wa", 34, "Berlaku s.d. 2028", ["c-ver", "BERSIH"], ["c-ver", "AMAN"]]],
    corp: { entity: "CV Karya Abadi", rupsTitle: "—", rups: [], circNo: "—", dirs: [], meetings: [], cap: [], stat: [], docs: [] },
  },
  t3: {
    id: "t3", name: "PT Nusantara Digital", plan: "ENTERPRISE", ava: "ND", user: "Putri Handayani · Legal Counsel",
    sector: "Teknologi & Fintech · Jakarta", score: 88, delta: "▲ +6 dari bulan lalu",
    kpiDocs: 512, kpiDocsTr: "▲ 34 bulan ini", kpiIzin: 14, kpiIzinTr: "● 3 mendekati tenggat",
    quota: { used: 12, max: 25 }, verified: 74,
    bab: [["Kontraktual", 180, 90], ["Hubungan kerja", 96, 48], ["Perizinan", 72, 36], ["Tata kelola · Aset · Perkara", 164, 82]],
    rem: [
      ["Peninjauan DPA 2 vendor cloud (UU PDP)", "Assistant · kepatuhan pelindungan data", "c-red", "9 HARI", "assistant"],
      ["PKWT 3 karyawan teknologi berakhir September", "Employment · kompensasi wajib dihitung", "c-draft", "28 HARI", "employment"],
      ["Perpanjangan Merek aplikasi (Kelas 9 & 42)", "Asset & IP · jendela DJKI", "c-mon", "75 HARI", "asset"],
      ["Perubahan AD pasca Seri B ke Menkumham", "Corporate Secretary · tenggat statutori", "c-mon", "TERJADWAL", "corpsec"],
      ["Lisensi PSE Kominfo — pembaruan data", "Licensing · kewajiban penyelenggara sistem elektronik", "c-draft", "52 HARI", "licensing"],
      ["PPh 21 Masa Juli — komponen ESOP", "Kepatuhan Pajak · data CorpSec & Employment", "c-red", "9 HARI", "pajak"],
      ["Perpanjangan Polis Cyber Risk", "Asuransi · syarat minimum kontrol keamanan diperbarui", "c-draft", "30 HARI", "asuransi"]],
    bell: [
      ["lock", "Peninjauan DPA vendor cloud", "9 hari — kesesuaian UU PDP wajib ditinjau", "assistant"],
      ["users", "3 PKWT teknologi berakhir", "Kompensasi PKWT wajib dihitung", "employment"],
      ["badge", "Perpanjangan merek aplikasi", "75 hari — Kelas 9 & 42", "asset"],
      ["landmark", "Perubahan AD pasca Seri B", "Tenggat statutori ke Menkumham", "corpsec"],
      ["radar", "5 perubahan regulasi digital terdeteksi", "PDP, PSE, fintech — ringkasan dampak DRAF AI", "assistant"],
      ["receipt", "PPh 21 Masa Juli", "9 hari — termasuk komponen ESOP", "pajak"],
      ["lifebuoy", "Polis Cyber Risk berakhir", "30 hari — pembaruan syarat kontrol keamanan", "asuransi"]],
    verif: [
      ["Term of Service Aplikasi", "Ditandatangani advokat MRWP", "c-ver", "VERIFIED"],
      ["Master Subscription Agreement", "3 temuan terdeteksi", "c-draft", "DRAF AI"],
      ["Shareholders Agreement Seri B", "Menunggu verifikasi advokat", "c-mon", "MENUNGGU"]],
    conv: CONVS_T3, docs: DOCS_T3, emp: [], cases: [],
    idx: [
      { t: "Master Subscription Agreement", s: "Dokumen · Legal Drafter · DRAF AI", v: "drafter" },
      { t: "DPA Vendor Cloud", s: "Dokumen · pelindungan data · Drafter", v: "drafter" },
      { t: "Lisensi PSE Kominfo", s: "Izin · pembaruan 52 hari · Licensing", v: "licensing" },
      { t: "Nadia Safira", s: "UX Researcher PKWT · Employment", v: "employment" },
      { t: "PKS Payment Gateway", s: "Perjanjian · berakhir 93 hari · Agreement", v: "agreement" },
      { t: "Pelanggaran Merek Aplikasi", s: "Case · somasi berjalan", v: "case" },
      { t: "Merek Aplikasi Kelas 9 & 42", s: "HKI · perpanjangan · Asset & IP", v: "asset" },
      { t: "Seri B Shareholders Agreement", s: "Tata kelola · CorpSec", v: "corpsec" },
      { t: "Polis Cyber Risk", s: "Asuransi · perpanjangan 30 hari", v: "asuransi" },
      { t: "PPh 21 ESOP Masa Juli", s: "Pajak · setor 9 hari", v: "pajak" }],
    agr: AGR_T3, empOut: 0,
    asetVal: "Rp 31,4 M", asetTr: "Infrastruktur · IP · penyertaan",
    asr: { nilai: "Rp 42 M", polTr: "1 klaim dalam telaah · 1 segera berakhir",
      pol: [
        ["Cyber Risk — Insiden Siber & Data", "PT Asuransi Digital Proteksi", "CYB-2025-0456", "Infrastruktur & data pengguna · Asset 4.6", "asset", "Rp 15 M", "16 Agu 2026", "SEGERA", "c-red", "30 HARI"],
        ["D&O Liability — Direksi & Komisaris", "PT Asuransi Manajemen Prima", "DNO-2026-0031", "Organ perseroan · CorpSec 4.5", "corpsec", "Rp 20 M", "s.d. Mar 2027", "AKTIF", "c-ver", "AKTIF"],
        ["Property — Server & Colocation", "PT Asuransi Digital Proteksi", "PRO-2025-0871", "Perangkat Server & Infrastruktur", "asset", "Rp 6,5 M", "s.d. Okt 2026", "KLAIM", "c-draft", "KLAIM BERJALAN"],
        ["BPJS TK & Kesehatan", "BPJS", "KPJ-3300912", "Seluruh karyawan + 1 TKA · Employment", "employment", "Sesuai program", "Iuran bulanan", "AKTIF", "c-ver", "IURAN LUNAS"]],
      klaim: [
        { t: "Klaim Kerusakan Perangkat — Insiden Listrik Colocation", obj: "Polis PRO-2025-0871 · rak server B", nilai: "Estimasi Rp 720 jt", cls: "c-draft", lbl: "TELAAH",
          tl: [["22 JUN 2026", "Insiden dilaporkan", "Log insiden + tiket vendor colocation → vault", "done"], ["26 JUN 2026", "Berkas klaim lengkap", "Invoice perangkat & BAST ditarik dari rekam aset", "done"], ["9 JUL 2026", "Telaah penanggung — data tambahan", "Log uptime diserahkan (tersinkron perkara SLA di Case 4.7)", "done"], ["MENUNGGU", "Keputusan klaim", "Estimasi 14 hari kerja", "next"]] }],
      gap: [
        ["Kode Sumber (escrow)", "Nilai IP inti belum dipertanggungkan — kajian IP valuation disarankan", "c-draft", "REKOMENDASI"],
        ["Business Interruption — downtime", "Klaim SLA vendor ≠ kerugian pendapatan sendiri — belum ter-cover", "c-red", "TANPA POLIS"]] },
    tax: { score: 90, trend: "▲ +4 · restitusi PPN lancar", done: 22,
      next: "PPh 21 Masa Jul", nextTr: "Termasuk komponen ESOP — 9 hari",
      prof: [
        ["NPWP", "03.556.677.8-011.000 · KPP Madya Jakarta Selatan", "c-mon", "TERDAFTAR"],
        ["Status PKP", "Dikukuhkan 2020 · e-Faktur host-to-host", "c-ver", "PKP"],
        ["KLU", "62019 — Aktivitas pemrograman (selaras KBLI & PSE)", "c-ver", "SELARAS"],
        ["Transaksi afiliasi", "2 anak usaha — dokumentasi transfer pricing dipantau", "c-gold", "TP DOC"]],
      kal: [
        ["PPh 21 Masa Juli 2026", "Payroll + komponen opsi saham (ESOP) — data CorpSec & Employment", "c-red", "9 HARI", "Setor + Bukti", "PPh 21 Agu — 39 hari"],
        ["PPN Masa Juli 2026", "Faktur langganan SaaS — DPP dari rekam kontraktual (4.9)", "c-draft", "10 HARI", "Lapor + Setor", "PPN Agu — 40 hari"],
        ["PPh 26 — Machine Learning Advisor (TKA)", "Kewajiban potong atas TKA — tersinkron RPTKA Employment", "c-draft", "20 HARI", "Setor + Bukti", "Masa Agu — 50 hari"],
        ["PPh 23 — vendor cloud & jasa", "Rekonsiliasi bukti potong vendor", "c-mon", "TERJADWAL", null, ""],
        ["Dokumentasi Transfer Pricing 2026", "Transaksi afiliasi 2 anak usaha — tenggat bersama SPT", "c-gray", "APR 2027", null, ""]],
      join: [
        ["Perubahan AD Seri B ↔ data WP", "Perubahan modal (CorpSec 4.5) memicu pemutakhiran data WP & pelaporan", "corpsec", "c-draft", "8 HARI"],
        ["PSE Kominfo ↔ kepatuhan digital", "Pembaruan data PSE (Licensing 4.4) berdampingan dengan kewajiban pajak digital", "licensing", "c-draft", "52 HARI"],
        ["Premi polis siber & D&O", "Jatuh tempo premi pada kalender kepatuhan yang sama", "asuransi", "c-mon", "GABUNG"]],
      integ: [
        ["Employment → PPh 21 & PPh 26", "Payroll, ESOP & TKA tersinkron ke perhitungan masa", "employment", "c-ver", "TERSINKRON"],
        ["CorpSec → aksi korporasi Seri B", "Penerbitan saham & perubahan modal dipantau implikasi pajaknya", "corpsec", "c-ver", "TERSINKRON"],
        ["Agreement → DPP PPN langganan", "Nilai MSA & termin menjadi dasar rekonsiliasi omzet", "agreement", "c-ver", "TERSINKRON"],
        ["Licensing (PSE/fintech) → pelaporan sektoral", "Kalender pajak digabung kewajiban regulator sektor", "licensing", "c-mon", "DIPANTAU"],
        ["Asset & IP → transfer pricing IP", "Lisensi IP antar-afiliasi terdokumentasi untuk TP Doc", "asset", "c-gold", "TP DOC"]] },
    mass: [["Nadia Safira", 9500000, 23], ["Fajar Ramadhan", 10200000, 23], ["Yoga Perdana", 8800000, 22]],
    queue: [
      { t: "Master Subscription Agreement v4", m: "Dari Legal Drafter · risk 58 · liability cap + klausul data", chip: "c-red", lbl: "RISIKO TINGGI", sla: "SLA 6 JAM", status: "masuk" },
      { t: "Shareholders Agreement Seri B", m: "Berakibat hukum · perubahan AD · wajib verifikasi", chip: "c-gold", lbl: "ESKALASI", sla: "SLA 9 JAM", status: "masuk" },
      { t: "DPA Vendor Cloud Region Jakarta", m: "Dari Legal Drafter · kesesuaian UU PDP", chip: "c-draft", lbl: "DRAF AI", sla: "SLA 11 JAM", status: "masuk" }],
    lic: [
      ["NIB 5566778899001", "Nomor Induk Berusaha", "PT Nusantara Digital", "62019", "ok", 100, "Selama menjalankan usaha", "AKTIF", "c-ver", "AKTIF", "detail"],
      ["Pendaftaran PSE Lingkup Privat", "Kominfo", "Aplikasi utama", "63122", "wa", 34, "Pembaruan data — 52 hari", "AKTIF", "c-draft", "REMINDER", "detail"],
      ["Izin Usaha Fintech (terdaftar)", "Regulator sektor keuangan", "Produk pembayaran", "64990", "wa", 48, "Kewajiban laporan berkala", "AKTIF", "c-draft", "REMINDER", "detail"],
      ["Tanda Daftar dengan Sistem OSS", "Kegiatan pendukung", "PT Nusantara Digital", "62019", "ok", 82, "Aktif", "AKTIF", "c-ver", "AKTIF", "detail"],
      ["Sertifikat ISO 27001 (privat)", "Keamanan informasi", "Data center", "—", "wa", 40, "Surveillance audit terjadwal", "AKTIF", "c-mon", "PENGURUSAN", "track"]],
    assets: [
      ["Perangkat Server & Infrastruktur", "Colocation Jakarta", "Invoice & BAST", null, "Perpanjangan colocation", "c-ver", "AMAN"],
      ["Kode Sumber Aplikasi (escrow)", "Source code utama", "Perjanjian escrow", null, "Pembaruan deposit escrow", "c-ver", "AMAN"],
      ["Penyertaan pada 2 Anak Usaha", "Holding grup", "Akta & DPS", ["c-gold", "GADAI SAHAM", "sebagian · fasilitas"], "DD berkala grup", "c-draft", "DD TERJADWAL"]],
    hki: [
      ["Merek Aplikasi (kata + logo)", "Produk utama", "IDM00778899 · Kelas 9", "wa", 30, "Perpanjangan — 75 hari", ["c-ver", "BERSIH"], ["c-draft", "PERPANJANG"]],
      ["Merek Layanan", "Platform", "IDM00778900 · Kelas 42", "ok", 64, "Berlaku s.d. 2030", ["c-red", "1 INDIKASI"], ["c-red", "TINDAK LANJUT"]],
      ["Hak Cipta Perangkat Lunak", "Kode aplikasi inti", "EC00202600123", "ok", 88, "Tercatat", ["c-ver", "TERDAFTAR"], ["c-ver", "AMAN"]],
      ["Rahasia Dagang — Algoritma Skoring", "NDA tim data", "6 NDA aktif", "", 0, "Selama dijaga · masa NDA dipantau", ["c-ver", "TERJAGA"], ["c-ver", "AMAN"]]],
    corp: { entity: "PT Nusantara Digital", rupsTitle: "—", rups: [], circNo: "—", dirs: [], meetings: [], cap: [], stat: [], docs: [] },
  },
};

/* Demo VVIP: semua akun auth NYATA (JWT + RLS), dipetakan tenant t1 — nol bypass. */
export const ACCOUNTS = [
  { tid: "t1", email: "legal@contohsejahtera.co.id", pw: "demo123" },
  { tid: "t1", email: "atasan1@mrwp.com", pw: "demo1234" },
  { tid: "t1", email: "atasan2@mrwp.com", pw: "demo1234" },
];

/* Tenant nyata yang baru login (belum punya rekam modul apa pun) — semua koleksi kosong
 * agar setiap view merender empty-state, bukan crash. Diisi mesin data saat backend modul terisi. */
export function emptyTenant(
  /* name/tier/sector SENGAJA boleh null: RPC whoami() mengembalikan name=null bila app_users.tenant_id
   * tidak punya baris di tabel `tenants` (mis. tenant seed t1). Dulu `t.name.replace(...)` langsung
   * melempar TypeError dan MEMBLOKIR LOGIN akun tersebut. Satu guard di sini melindungi semua pemanggil. */
  t: { id: string; name?: string | null; tier?: string | null; sector?: string | null },
  u?: { nama?: string | null; email?: string; jabatan?: string | null },
): Tenant {
  const nama = (t.name || "").trim() || "Perusahaan Anda";
  return {
    id: t.id, name: nama, plan: (t.tier || "STARTER").toUpperCase(),
    ava: nama.replace(/^(PT|CV)\.?\s+/i, "").slice(0, 2).toUpperCase() || "??", user: u ? `${u.nama || u.email || "—"} · ${u.jabatan || "Legal"}` : "—",
    sector: t.sector || "—", score: 0, delta: "—",
    kpiDocs: 0, kpiDocsTr: "—", kpiIzin: 0, kpiIzinTr: "—",
    quota: { used: 0, max: 10 }, verified: 0,
    bab: [], rem: [], bell: [], verif: [],
    conv: [], docs: [], emp: [], cases: [], idx: [],
    agr: [], empOut: 0, asetVal: "Rp 0", asetTr: "—",
    asr: { nilai: "Rp 0", polTr: "—", pol: [], klaim: [], gap: [] },
    tax: { score: 0, trend: "—", done: 0, next: "—", nextTr: "—", prof: [], kal: [], join: [], integ: [] },
    mass: [], queue: [], lic: [], assets: [], hki: [],
    corp: { entity: nama, rupsTitle: "—", rups: [], circNo: "—", dirs: [], meetings: [], cap: [], stat: [], docs: [] },
  };
}

export interface Tool { ic: string; t: string; s: string; kind: "drop" | "mono" | "rows" | "template"; drop?: [string, string]; dropToast?: [string, string]; mono?: string; rows?: string[][]; note?: string }
export const TOOLS: Tool[] = [
  { ic: "convert", t: "Konversi Dokumen", s: "PDF ↔ Word · OCR pindaian", kind: "drop", drop: ["Letakkan berkas di sini", "PDF → Word · Word → PDF · OCR dokumen hukum berbahasa Indonesia"], dropToast: ["Konversi dijalankan", "Worker LibreOffice headless — hasil masuk vault sebagai berkas turunan menunjuk berkas asal."] },
  { ic: "clip", t: "Manajemen PDF", s: "Merge · split · watermark", kind: "drop", drop: ["Letakkan PDF di sini", "Gabung · pecah per rentang halaman · watermark"], dropToast: ["PDF diproses", "Merge/split/watermark server-side — watermark kustom tenant."] },
  { ic: "sign", t: "Keabsahan Dokumen", s: "Digital Signature · QR Verify", kind: "mono", mono: "<b>GET /verify/8fa3-…-c21 (publik)</b>\nJudul   : Addendum_PK_6_PKWT.docx\nStatus  : TERVERIFIKASI ADVOKAT ✓\nHash    : COCOK ✓ (SHA-256)\nTtd     : Adv. Ratna P., S.H. — MRWP\n\nVerifikasi publik <b>tanpa membuka isi dokumen</b>." },
  { ic: "note", t: "AI Summarizer", s: "Ringkasan berlapis", kind: "mono", mono: "<b>RINGKASAN EKSEKUTIF — Perjanjian Jasa Vendor (17 pasal):</b>\nPerikatan jasa logistik 12 bulan senilai Rp 250 jt. Tiga titik perhatian: denda sepihak (Ps.7), pengakhiran tak seimbang (Ps.12), forum SIAC (Ps.15).\n\n<b>PER BAGIAN:</b> tersedia ringkasan per pasal — panjang keluaran proporsional paket." },
  { ic: "globe", t: "AI Translator", s: "ID ↔ EN · glosarium hukum", kind: "mono", mono: '<b>ID:</b> "wanprestasi" → <b>EN:</b> "breach of contract / default"\n<b>ID:</b> "somasi" → <b>EN:</b> "formal demand letter"\n\nGlosarium terkelola — koreksi advokat memperbaiki hasil berikutnya.' },
  { ic: "key", t: "AI Clause Extraction", s: "Ekstraksi klausul kunci", kind: "mono", mono: '{ "pihak": ["PT Contoh Sejahtera","CV Mitra Kirim"],\n  "nilai": 250000000, "jangka_waktu": "12 bulan",\n  "pengakhiran": "sepihak — Ps.12 ⚠",\n  "sanksi": "denda 5%/hari ⚠", "sengketa": "SIAC ⚠" }\n\nJSON terstruktur — otomatis mengisi metadata rekam kontraktual.' },
  { ic: "scale", t: "AI Comparison", s: "Diff 2 versi · klasifikasi", kind: "rows", rows: [
    ["Pasal 7 — nilai denda diubah", "1‰/hari → 5%/hari", "c-red", "MEMBURUK"],
    ["Pasal 12 — jangka pemberitahuan", "30 → 90 hari (sepihak)", "c-red", "MEMBURUK"],
    ["Pasal 15 — forum sengketa", "BANI → SIAC", "c-draft", "PERHATIAN"]],
    note: "Klasifikasi menguntungkan/netral/merugikan berdasar perbandingan ke clause library — satu mesin diff dengan Legal Drafter." },
  { ic: "scan", t: "Template Form", s: "Unduh template Excel per modul", kind: "template" },
];
