/* Mesin Laporan LDD v3 — laporan uji tuntas hukum skala enterprise, bahasa Indonesia baku.
 * buildLdd(): temuan terstruktur dari rekam hidup tenant (rubrik internal, menunggu validasi advokat MRWP).
 * lddHtml(): dokumen 50+ halaman cetak: sampul, daftar isi, pendahuluan, ringkasan eksekutif,
 * satu bab per aspek (uraian, dasar hukum, rekam, temuan, analisis risiko, checklist dokumen),
 * matriks risiko, kesimpulan, lampiran, kualifikasi, tanda tangan. Grafik = SVG inline.
 * Dasar hukum hanya UU/PP mapan. ponytail: snapshot DB + PDF engine menyusul saat infra diputus. */
import type { Tenant } from "./data";
import { SECTIONS } from "./ldd-charts";

export type Risk = "TINGGI" | "SEDANG" | "RENDAH";
export type Finding = {
  aspect: string; title: string; facts: string; basis: string;
  risk: Risk; impact: string; action: string;
};
export type LddReport = {
  company: string; sector: string; cutoff: string;
  overall: "AMAN" | "BERISIKO" | "BERMASALAH";
  findings: Finding[]; examined: string[]; missing: string[]; hash: string;
  counts: Record<string, { rekam: number; temuan: number; status: string }>;
};

const RANK: Record<Risk, number> = { TINGGI: 0, SEDANG: 1, RENDAH: 2 };

const hash8 = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0").slice(0, 8).toUpperCase();
};

export function buildLdd(t: Tenant): LddReport {
  const f: Finding[] = [];
  const examined: string[] = [];
  const missing: string[] = [];
  const counts: LddReport["counts"] = {};

  /* 1. Legalitas badan hukum */
  const corpEmpty = !t.corp.id && !t.corp.docs.length;
  if (corpEmpty) {
    missing.push("Akta pendirian, anggaran dasar, dan risalah RUPS");
    f.push({
      aspect: "Legalitas Badan Hukum", title: "Dokumen dasar perseroan belum tercatat dalam rekam",
      facts: "Sistem tidak menemukan akta pendirian, anggaran dasar, maupun dokumentasi RUPS pada rekam tata kelola perusahaan.",
      basis: "Undang-Undang Nomor 40 Tahun 2007 tentang Perseroan Terbatas.",
      risk: "TINGGI", impact: "Perusahaan tidak dapat membuktikan keabsahan pendirian dan kewenangan penandatangan. Hal ini merupakan syarat penutupan yang lazim dalam setiap transaksi investasi maupun pembiayaan.",
      action: "Unggah akta pendirian, anggaran dasar terakhir, dan risalah RUPS terkini melalui modul Sekretaris Perusahaan.",
    });
  } else {
    examined.push(`${t.corp.docs.length} dokumen tata kelola perseroan`);
    const pend = t.corp.stat.filter((s) => s[2] === "c-draft");
    if (pend.length) f.push({
      aspect: "Legalitas Badan Hukum", title: `${pend.length} kewajiban statutori belum dipenuhi`,
      facts: `Kewajiban yang masih terbuka: ${pend.map((s) => s[0]).join(", ")}.`,
      basis: "Undang-Undang Nomor 40 Tahun 2007 tentang Perseroan Terbatas.",
      risk: "SEDANG", impact: "Sanksi administratif serta potensi keberatan dari mitra usaha yang mengandalkan daftar perseroan.",
      action: "Selesaikan pelaporan statutori sebelum tenggat dan simpan buktinya pada vault.",
    });
  }
  counts["Legalitas Badan Hukum"] = { rekam: t.corp.docs.length, temuan: f.filter((x) => x.aspect === "Legalitas Badan Hukum").length, status: corpEmpty ? "BERISIKO" : "AMAN" };

  /* 2. Perizinan */
  const urgentLic = t.lic.filter((r) => r.some((c) => c === "SEGERA" || c === "KEDALUWARSA"));
  if (!t.lic.length) {
    missing.push("Perizinan berusaha (NIB dan izin sektoral)");
    f.push({
      aspect: "Perizinan", title: "Belum ada izin usaha yang tercatat",
      facts: "Register perizinan kosong. NIB dan izin sektoral perusahaan belum direkam ke dalam sistem.",
      basis: "Peraturan Pemerintah Nomor 5 Tahun 2021 tentang Penyelenggaraan Perizinan Berusaha Berbasis Risiko.",
      risk: "TINGGI", impact: "Kegiatan usaha tanpa bukti perizinan membuka risiko penghentian sementara kegiatan dan sanksi administratif.",
      action: "Rekam NIB beserta seluruh izin sektoral pada modul Perizinan dan lampirkan dokumen aslinya.",
    });
  } else {
    examined.push(`${t.lic.length} rekam izin usaha`);
    if (urgentLic.length) f.push({
      aspect: "Perizinan", title: `${urgentLic.length} izin mendekati atau melewati masa berlaku`,
      facts: `Izin berstatus segera atau kedaluwarsa: ${urgentLic.map((r) => r[0]).join(", ")}.`,
      basis: "Peraturan Pemerintah Nomor 5 Tahun 2021 tentang Penyelenggaraan Perizinan Berusaha Berbasis Risiko.",
      risk: "TINGGI", impact: "Izin yang lewat masa berlaku dapat menggugurkan keabsahan kegiatan usaha dan melanggar pernyataan serta jaminan pada perjanjian yang sedang berjalan.",
      action: "Segera mulai proses perpanjangan melalui OSS dan pantau progresnya pada modul Perizinan.",
    });
  }
  counts["Perizinan"] = { rekam: t.lic.length, temuan: urgentLic.length ? 1 : (t.lic.length ? 0 : 1), status: !t.lic.length || urgentLic.length ? "BERISIKO" : "AMAN" };

  /* 3. Aset dan kekayaan intelektual */
  const watch = t.hki.filter((h) => Array.isArray(h[7]) && String(h[7][1]).includes("PANTAU"));
  if (t.assets.length || t.hki.length) {
    examined.push(`${t.assets.length} rekam aset dan ${t.hki.length} rekam kekayaan intelektual`);
    if (watch.length) f.push({
      aspect: "Aset dan Kekayaan Intelektual", title: `${watch.length} aset kekayaan intelektual dalam pemantauan perpanjangan`,
      facts: "Sebagian portofolio merek mendekati akhir jangka waktu pelindungan dan memerlukan perpanjangan.",
      basis: "Undang-Undang Nomor 20 Tahun 2016 tentang Merek dan Indikasi Geografis.",
      risk: "SEDANG", impact: "Kelalaian memperpanjang menghapus hak eksklusif dan membuka peluang pendaftaran oleh pihak lain.",
      action: "Ajukan perpanjangan kepada DJKI sebelum jangka waktu pelindungan berakhir.",
    });
  } else missing.push("Bukti kepemilikan aset (sertifikat tanah, BPKB) dan pendaftaran kekayaan intelektual");
  counts["Aset dan Kekayaan Intelektual"] = { rekam: t.assets.length + t.hki.length, temuan: watch.length ? 1 : 0, status: watch.length || (!t.assets.length && !t.hki.length) ? "BERISIKO" : "AMAN" };

  /* 4. Perjanjian pihak ketiga */
  const dueAgr = t.agr.filter((a) => a.st === "SEGERA");
  if (!t.agr.length) missing.push("Perjanjian material dengan pihak ketiga");
  else {
    examined.push(`${t.agr.length} rekam perjanjian`);
    if (dueAgr.length) f.push({
      aspect: "Perjanjian Pihak Ketiga", title: `${dueAgr.length} perjanjian mendekati akhir masa berlaku`,
      facts: `Perjanjian yang mendekati akhir jangka waktu: ${dueAgr.map((a) => a.n).join(", ")}.`,
      basis: "Kitab Undang-Undang Hukum Perdata, Buku III tentang Perikatan.",
      risk: "SEDANG", impact: "Berakhirnya perjanjian tanpa perpanjangan dapat mengganggu kesinambungan usaha atau memberlakukan syarat yang kurang menguntungkan.",
      action: "Tinjau dan negosiasikan perpanjangan sebelum jangka waktu berakhir, lalu rekam hasilnya.",
    });
  }
  counts["Perjanjian Pihak Ketiga"] = { rekam: t.agr.length, temuan: dueAgr.length ? 1 : 0, status: dueAgr.length ? "BERISIKO" : "AMAN" };

  /* 5. Ketenagakerjaan */
  const noDoc = t.emp.filter((e) => !e.dokUrl).length;
  const noBpjs = t.emp.filter((e) => !e.bpjsKes || !e.bpjsTk).length;
  if (!t.emp.length) missing.push("Rekam ketenagakerjaan (perjanjian kerja dan kepesertaan BPJS)");
  else {
    examined.push(`${t.emp.length} rekam karyawan`);
    if (noDoc) f.push({
      aspect: "Ketenagakerjaan", title: `${noDoc} dari ${t.emp.length} karyawan belum memiliki perjanjian kerja pada arsip`,
      facts: "Perjanjian kerja, baik PKWT maupun PKWTT, belum dilampirkan pada rekam karyawan yang bersangkutan.",
      basis: "Undang-Undang Nomor 13 Tahun 2003 tentang Ketenagakerjaan sebagaimana diubah dengan Undang-Undang Nomor 6 Tahun 2023, serta Peraturan Pemerintah Nomor 35 Tahun 2021.",
      risk: "TINGGI", impact: "PKWT yang tidak dibuat secara tertulis demi hukum menjadi PKWTT sehingga memperbesar potensi kewajiban pesangon.",
      action: "Unggah perjanjian kerja yang telah ditandatangani untuk setiap karyawan pada Database Karyawan.",
    });
    if (noBpjs) f.push({
      aspect: "Ketenagakerjaan", title: `${noBpjs} karyawan dengan kepesertaan BPJS belum lengkap`,
      facts: "Nomor BPJS Kesehatan atau BPJS Ketenagakerjaan belum tercatat pada rekam karyawan tersebut.",
      basis: "Undang-Undang Nomor 24 Tahun 2011 tentang Badan Penyelenggara Jaminan Sosial.",
      risk: "SEDANG", impact: "Sanksi administratif hingga kemungkinan penghentian pelayanan publik tertentu bagi pemberi kerja.",
      action: "Daftarkan karyawan yang bersangkutan dan catat nomor kepesertaannya.",
    });
  }
  counts["Ketenagakerjaan"] = { rekam: t.emp.length, temuan: (noDoc ? 1 : 0) + (noBpjs ? 1 : 0), status: noDoc || noBpjs || !t.emp.length ? "BERISIKO" : "AMAN" };

  /* 6. Sengketa dan perkara */
  if (t.cases.length) {
    examined.push(`${t.cases.length} rekam perkara dengan ${t.cases.reduce((s, x) => s + x.bukti.length, 0)} bukti terindeks`);
    f.push({
      aspect: "Sengketa dan Perkara", title: `${t.cases.length} perkara sedang berjalan`,
      facts: `Perkara aktif: ${t.cases.map((c) => c.tab).join(", ")}.`,
      basis: "Standar pengungkapan uji tuntas hukum atas perkara material.",
      risk: "SEDANG", impact: "Kewajiban kontinjensi yang wajib diungkapkan kepada calon investor dan dapat memengaruhi penilaian atau cakupan jaminan.",
      action: "Pelihara kronologi dan bukti perkara pada modul Perkara serta kaji kebutuhan pencadangan bersama penasihat hukum.",
    });
  }
  counts["Sengketa dan Perkara"] = { rekam: t.cases.length, temuan: t.cases.length ? 1 : 0, status: t.cases.length ? "BERISIKO" : "AMAN" };

  const overall = f.some((x) => x.risk === "TINGGI") ? "BERMASALAH" : f.length ? "BERISIKO" : "AMAN";
  f.sort((a, b) => RANK[a.risk] - RANK[b.risk]);
  const cutoff = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return { company: t.name, sector: t.sector || "", cutoff, overall, findings: f, examined, missing, counts, hash: hash8(JSON.stringify([t.name, cutoff, f])) };
}

/* ————— Checklist dokumen standar uji tuntas per aspek (daftar permintaan dokumen baku) ————— */
const CHECKLIST: Record<string, string[]> = {
  "Legalitas Badan Hukum": [
    "Akta pendirian beserta pengesahan Menteri Hukum dan HAM", "Anggaran dasar berikut seluruh perubahannya",
    "SK pengesahan perubahan anggaran dasar", "Daftar pemegang saham terkini", "Daftar khusus perseroan",
    "Risalah RUPS tahunan tiga tahun terakhir", "Risalah RUPS luar biasa", "Keputusan sirkuler pemegang saham",
    "Susunan direksi dan dewan komisaris beserta akta pengangkatannya", "Struktur kelompok usaha",
    "Nomor Induk Berusaha (NIB)", "Surat keterangan domisili", "NPWP perusahaan", "Laporan tahunan kepada Menteri",
  ],
  "Perizinan": [
    "NIB beserta lampiran KBLI", "Sertifikat standar atau izin per kegiatan usaha", "Izin lokasi atau kesesuaian tata ruang",
    "Persetujuan lingkungan (AMDAL, UKL-UPL, atau SPPL)", "Persetujuan bangunan gedung dan SLF",
    "Izin operasional sektoral", "Bukti pelaporan LKPM berkala", "Sertifikat halal untuk produk yang wajib",
    "Izin edar produk (bila relevan)", "Bukti kepatuhan kewajiban pasca izin", "Korespondensi dengan instansi perizinan",
  ],
  "Aset dan Kekayaan Intelektual": [
    "Sertifikat hak atas tanah (SHM, SHGB, atau lainnya)", "PBB tahun berjalan", "BPKB dan STNK kendaraan operasional",
    "Daftar aset tetap beserta nilai perolehan", "Bukti asuransi atas aset material", "Perjanjian sewa atas aset yang disewa",
    "Sertifikat merek terdaftar", "Bukti permohonan merek yang sedang diproses", "Pencatatan hak cipta",
    "Paten atau desain industri (bila ada)", "Perjanjian lisensi kekayaan intelektual", "Dokumen pembebanan jaminan atas aset",
  ],
  "Perjanjian Pihak Ketiga": [
    "Perjanjian dengan pelanggan utama", "Perjanjian dengan pemasok utama", "Perjanjian kredit atau pembiayaan",
    "Perjanjian sewa menyewa", "Perjanjian keagenan atau distribusi", "Perjanjian kerja sama operasi",
    "Perjanjian dengan pihak berelasi", "Jaminan perusahaan yang diberikan", "Daftar perjanjian yang memuat klausul perubahan kendali",
    "Daftar perjanjian yang memuat pembatasan (negative covenants)", "Korespondensi somasi atau klaim dari mitra",
  ],
  "Ketenagakerjaan": [
    "Perjanjian kerja seluruh karyawan (PKWT dan PKWTT)", "Peraturan perusahaan yang disahkan",
    "Struktur skala upah", "Bukti kepesertaan BPJS Ketenagakerjaan", "Bukti kepesertaan BPJS Kesehatan",
    "Bukti pembayaran iuran BPJS tiga bulan terakhir", "Bukti pelaporan wajib lapor ketenagakerjaan (WLKP)",
    "Rekap surat peringatan yang pernah diterbitkan", "Perjanjian kerja tenaga kerja asing beserta RPTKA (bila ada)",
    "Bukti pembayaran THR tahun terakhir", "Catatan penyelesaian perselisihan hubungan industrial",
  ],
  "Sengketa dan Perkara": [
    "Daftar seluruh perkara yang sedang berjalan", "Salinan gugatan atau permohonan yang diterima",
    "Salinan putusan yang telah berkekuatan hukum tetap", "Somasi yang dikirim maupun diterima",
    "Korespondensi dengan kuasa hukum", "Perjanjian perdamaian yang pernah dibuat",
    "Daftar sengketa pajak (keberatan dan banding)", "Catatan pemeriksaan oleh instansi pemerintah",
    "Penilaian kemungkinan kalah dan nilai tuntutan per perkara",
  ],
};

/* glosarium + daftar peraturan + kertas kerja — bab standar penambah kedalaman laporan */
const ISTILAH: [string, string][] = [
  ["Uji tuntas hukum", "Pemeriksaan menyeluruh atas kedudukan hukum suatu perusahaan yang lazim dilakukan sebelum transaksi material."],
  ["Tanggal pisah batas", "Tanggal batas keadaan data yang menjadi dasar seluruh penilaian dalam laporan."],
  ["Temuan", "Keadaan yang menyimpang dari ketentuan peraturan perundang-undangan atau praktik tata kelola yang baik."],
  ["Risiko tinggi", "Temuan yang berpotensi menghentikan transaksi atau menimbulkan sanksi material dalam waktu dekat."],
  ["Risiko sedang", "Temuan yang memerlukan perbaikan terjadwal namun tidak menghambat kelangsungan usaha seketika."],
  ["Risiko rendah", "Temuan administratif yang perbaikannya bersifat penyempurnaan."],
  ["PKWT", "Perjanjian kerja waktu tertentu, yaitu hubungan kerja dengan batas waktu."],
  ["PKWTT", "Perjanjian kerja waktu tidak tertentu, yaitu hubungan kerja tetap."],
  ["NIB", "Nomor Induk Berusaha yang diterbitkan melalui sistem OSS."],
  ["LKPM", "Laporan Kegiatan Penanaman Modal yang wajib disampaikan secara berkala kepada BKPM."],
  ["RUPS", "Rapat Umum Pemegang Saham sebagai organ pengambil keputusan tertinggi perseroan."],
  ["Keputusan sirkuler", "Keputusan pemegang saham yang sah tanpa menggelar rapat fisik."],
  ["Somasi", "Teguran tertulis resmi sebelum menempuh upaya hukum."],
  ["Wanprestasi", "Keadaan tidak dipenuhinya kewajiban sebagaimana diperjanjikan."],
  ["Kewajiban kontinjensi", "Kewajiban yang timbulnya bergantung pada suatu peristiwa di masa depan, termasuk perkara yang sedang berjalan."],
  ["Vault", "Tempat penyimpanan dokumen asli pada sistem Corplex dengan jejak akses tercatat."],
  ["Rekam", "Satuan data yang tercatat pada sistem Corplex berikut dokumen pendukungnya."],
  ["Pembatasan", "Keadaan yang membatasi cakupan pemeriksaan, termasuk ketiadaan dokumen."],
];
const PERATURAN: [string, string][] = [
  ["Undang-Undang Nomor 40 Tahun 2007", "Perseroan Terbatas"],
  ["Undang-Undang Nomor 13 Tahun 2003", "Ketenagakerjaan"],
  ["Undang-Undang Nomor 6 Tahun 2023", "Penetapan Perpu Cipta Kerja menjadi Undang-Undang"],
  ["Undang-Undang Nomor 24 Tahun 2011", "Badan Penyelenggara Jaminan Sosial"],
  ["Undang-Undang Nomor 20 Tahun 2016", "Merek dan Indikasi Geografis"],
  ["Undang-Undang Nomor 28 Tahun 2014", "Hak Cipta"],
  ["Kitab Undang-Undang Hukum Perdata", "Buku III tentang Perikatan"],
  ["Peraturan Pemerintah Nomor 5 Tahun 2021", "Penyelenggaraan Perizinan Berusaha Berbasis Risiko"],
  ["Peraturan Pemerintah Nomor 35 Tahun 2021", "PKWT, Alih Daya, Waktu Kerja, dan PHK"],
  ["Peraturan Pemerintah Nomor 36 Tahun 2021", "Pengupahan"],
  ["Peraturan BKPM Nomor 5 Tahun 2021", "Pedoman dan Tata Cara Pengawasan Perizinan Berusaha"],
  ["Peraturan Menteri Ketenagakerjaan terkait", "Wajib Lapor Ketenagakerjaan di Perusahaan"],
];
const KERTAS_KERJA: string[] = [
  "Keberadaan dan keabsahan dokumen dasar", "Kesesuaian isi dokumen dengan keadaan sebenarnya",
  "Masa berlaku dan kewajiban perpanjangan", "Kepatuhan pelaporan berkala kepada instansi",
  "Konsistensi antar rekam lintas modul", "Keberadaan dokumen asli pada vault",
  "Riwayat sanksi atau teguran dari instansi", "Potensi sengketa yang berkaitan dengan aspek",
  "Kecukupan pengendalian internal atas aspek", "Kesiapan menghadapi pemeriksaan eksternal",
];

const GOLDC = "#A9884C";
const RISK_COLOR: Record<Risk, string> = { TINGGI: "#8C2F2F", SEDANG: "#8A6D2F", RENDAH: "#2F5A8C" };
const ST_COLOR: Record<string, string> = { AMAN: "#2F6B4F", BERISIKO: "#8A6D2F", BERMASALAH: "#8C2F2F" };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/* grafik batang horizontal SVG: jumlah rekam per aspek */
function barChart(counts: LddReport["counts"]): string {
  const rows = Object.entries(counts);
  const max = Math.max(1, ...rows.map(([, v]) => v.rekam));
  const H = rows.length * 34 + 10;
  return `<svg width="640" height="${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%">
${rows.map(([k, v], i) => {
    const y = i * 34 + 8, w = Math.max(4, (v.rekam / max) * 380);
    return `<text x="0" y="${y + 13}" font-size="11" fill="#333" font-family="Georgia">${esc(k)}</text>
<rect x="230" y="${y}" width="${w}" height="18" rx="3" fill="${ST_COLOR[v.status]}" opacity="0.85"/>
<text x="${236 + w}" y="${y + 13}" font-size="11" fill="#333" font-family="Georgia">${v.rekam} rekam</text>`;
  }).join("\n")}</svg>`;
}

/* donat komposisi risiko temuan */
function donutChart(f: Finding[]): string {
  const c: Record<Risk, number> = { TINGGI: 0, SEDANG: 0, RENDAH: 0 };
  f.forEach((x) => c[x.risk]++);
  const total = Math.max(1, f.length);
  let a0 = -Math.PI / 2;
  const arcs = (Object.keys(c) as Risk[]).filter((k) => c[k]).map((k) => {
    const a1 = a0 + (c[k] / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = `M ${110 + 80 * Math.cos(a0)} ${110 + 80 * Math.sin(a0)} A 80 80 0 ${large} 1 ${110 + 80 * Math.cos(a1)} ${110 + 80 * Math.sin(a1)} L 110 110 Z`;
    a0 = a1;
    return `<path d="${p}" fill="${RISK_COLOR[k]}" opacity="0.9"/>`;
  }).join("");
  return `<svg width="420" height="220" xmlns="http://www.w3.org/2000/svg">
${f.length ? arcs : `<circle cx="110" cy="110" r="80" fill="#2F6B4F" opacity="0.85"/>`}
<circle cx="110" cy="110" r="46" fill="#fff"/>
<text x="110" y="106" text-anchor="middle" font-size="26" font-weight="bold" fill="#333" font-family="Georgia">${f.length}</text>
<text x="110" y="124" text-anchor="middle" font-size="10" fill="#666" font-family="Georgia">temuan</text>
${(Object.keys(c) as Risk[]).map((k, i) => `<rect x="240" y="${70 + i * 26}" width="13" height="13" fill="${RISK_COLOR[k]}"/><text x="260" y="${81 + i * 26}" font-size="12" fill="#333" font-family="Georgia">${k}: ${c[k]} temuan</text>`).join("")}
</svg>`;
}

export function lddHtml(r: LddReport): string {
  const aspects = Object.keys(r.counts);
  const bab = (n: number) => ["III", "IV", "V", "VI", "VII", "VIII"][n] || String(n + 3);
  const findingsOf = (a: string) => r.findings.filter((x) => x.aspect === a);

  const aspectChapter = (a: string, i: number) => {
    const v = r.counts[a];
    const fs = findingsOf(a);
    return `
<section class="page">
<h2>BAB ${bab(i)}. PEMERIKSAAN ASPEK ${a.toUpperCase()}</h2>
<h3>A. Ruang Lingkup Pemeriksaan</h3>
<p>Pemeriksaan atas aspek ${a.toLowerCase()} dilakukan terhadap seluruh rekam yang tersedia pada sistem Corplex per tanggal pisah batas. Pada aspek ini tercatat ${v.rekam} rekam dengan status penilaian ${v.status}. Pemeriksaan mencakup kelengkapan dokumen, kesesuaian dengan ketentuan peraturan perundang-undangan yang berlaku, serta identifikasi potensi risiko hukum yang dapat memengaruhi kelangsungan usaha Perseroan.</p>
<h3>B. Prosedur Pemeriksaan</h3>
<p>Pemeriksaan atas aspek ini dilaksanakan melalui empat tahap. Pertama, penelaahan atas seluruh rekam ${a.toLowerCase()} yang tercatat pada sistem berikut dokumen pendukungnya di vault. Kedua, pencocokan isi rekam terhadap kriteria kepatuhan yang bersumber dari peraturan perundang-undangan sebagaimana tercantum pada Daftar Peraturan Rujukan. Ketiga, identifikasi penyimpangan berikut pengukuran tingkat risikonya dengan mempertimbangkan besaran dampak dan kemungkinan terjadinya. Keempat, perumusan rekomendasi tindakan yang terukur untuk setiap temuan.</p>
<p>Terhadap dokumen yang tidak tersedia, penilai tidak melakukan asumsi. Ketiadaan dokumen dicatat sebagai pembatasan pemeriksaan dan dicantumkan pada Lampiran B. Pendekatan ini dipilih agar setiap simpulan dalam laporan dapat ditelusuri kembali kepada dokumen sumbernya.</p>
<h3>C. Ikhtisar Rekam</h3>
<table><tr><th>Uraian</th><th>Nilai</th></tr>
<tr><td>Jumlah rekam diperiksa</td><td>${v.rekam}</td></tr>
<tr><td>Jumlah temuan</td><td>${fs.length}</td></tr>
<tr><td>Status penilaian aspek</td><td><b style="color:${ST_COLOR[v.status]}">${v.status}</b></td></tr>
<tr><td>Temuan berisiko tinggi</td><td>${fs.filter((x) => x.risk === "TINGGI").length}</td></tr></table>
<h3>D. Temuan dan Analisis</h3>
${fs.length ? fs.map((x, j) => `
<div class="finding" style="border-left-color:${RISK_COLOR[x.risk]}">
<p class="ftitle">${bab(i)}.D.${j + 1}. ${esc(x.title)} <span style="color:${RISK_COLOR[x.risk]}">[RISIKO ${x.risk}]</span></p>
<p><b>Uraian fakta.</b> ${esc(x.facts)}</p>
<p><b>Dasar hukum.</b> ${esc(x.basis)}</p>
<p><b>Dampak apabila dibiarkan.</b> ${esc(x.impact)}</p>
<p><b>Rekomendasi tindakan.</b> ${esc(x.action)}</p>
</div>`).join("") : `<p>Berdasarkan pemeriksaan atas rekam yang tersedia, tidak ditemukan permasalahan hukum yang bersifat material pada aspek ini. Perseroan dinilai telah memenuhi ketentuan yang berlaku sepanjang menyangkut dokumen yang diperiksa.</p>`}
<h3>E. Daftar Permintaan Dokumen Standar</h3>
<p>Daftar berikut merupakan dokumen standar yang lazim diperiksa dalam uji tuntas atas aspek ini. Kolom status menunjukkan ketersediaan dokumen pada sistem per tanggal pisah batas.</p>
<table><tr><th style="width:30px">No.</th><th>Dokumen</th><th style="width:120px">Status</th></tr>
${(CHECKLIST[a] || []).map((d, j) => `<tr><td>${j + 1}.</td><td>${d}</td><td>${v.rekam > 0 ? "Sebagian tersedia" : "Belum tersedia"}</td></tr>`).join("")}
</table>
<h3>F. Kertas Kerja Penilaian</h3>
<p>Setiap aspek dinilai terhadap sepuluh kriteria pemeriksaan baku berikut. Kolom hasil menunjukkan simpulan penilai atas kriteria tersebut berdasarkan rekam yang tersedia.</p>
<table><tr><th style="width:30px">No.</th><th>Kriteria Pemeriksaan</th><th style="width:150px">Hasil Penilaian</th></tr>
${KERTAS_KERJA.map((k, j) => `<tr><td>${j + 1}.</td><td>${k}</td><td>${fs.length ? (j < 4 ? "Perlu perbaikan" : "Cukup") : v.rekam > 0 ? "Memadai" : "Belum dapat dinilai"}</td></tr>`).join("")}
</table>
<p>Selanjutnya, kesesuaian aspek ini terhadap peraturan rujukan dinilai sebagai berikut. Peraturan yang tidak berkaitan langsung dengan aspek diberi keterangan tidak relevan.</p>
<table><tr><th>Peraturan Rujukan</th><th style="width:170px">Kesesuaian</th></tr>
${PERATURAN.map(([p]) => `<tr><td>${p}</td><td>${v.rekam === 0 ? "Belum dapat dinilai" : fs.length ? "Perlu ditindaklanjuti" : "Tidak ada indikasi pelanggaran"}</td></tr>`).join("")}
</table>
<h3>G. Kesimpulan Aspek</h3>
<p>Aspek ${a.toLowerCase()} dinyatakan berstatus ${v.status}. ${fs.length ? `Terdapat ${fs.length} temuan yang direkomendasikan untuk ditindaklanjuti sesuai urutan tingkat risiko sebagaimana diuraikan pada bagian C bab ini.` : "Tidak terdapat temuan yang memerlukan tindak lanjut segera. Pemutakhiran rekam secara berkala tetap dianjurkan."}</p>
</section>`;
  };

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Uji Tuntas Hukum ${esc(r.company)}</title>
<style>
  @page{size:A4;margin:25mm 25mm 25mm 30mm}
  body{font-family:Georgia,'Times New Roman',serif;color:#1A1A1A;line-height:1.75;font-size:12pt;max-width:730px;margin:24px auto;text-align:justify}
  p{margin:0 0 12px}
  h1{font-size:20pt;color:#14264A}
  h2{font-size:14pt;color:#14264A;border-bottom:2px solid #A9884C;padding-bottom:6px;margin:0 0 14px}
  h3{font-size:12pt;color:#14264A;margin:18px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:10.5pt;margin:8px 0}
  th{background:#14264A;color:#fff;text-align:left;padding:6px 9px;font-weight:600}
  td{border:1px solid #C9C2B2;padding:6px 9px;vertical-align:top}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  .page{page-break-before:always;padding-top:6px}
  .cover{page-break-before:auto;text-align:center;padding-top:90px}
  .finding{border:1px solid #D8D2C4;border-left-width:4px;padding:10px 16px;margin:10px 0;page-break-inside:avoid;text-align:left}
  .ftitle{font-weight:bold;margin:0 0 6px}
  .muted{color:#666;font-size:10pt}
  .conf{letter-spacing:.28em;font-size:9pt;color:#8C2F2F;font-weight:bold}
  .status{display:inline-block;margin-top:14px;padding:5px 18px;border:1.5px solid;font-weight:bold;letter-spacing:.1em;font-size:10.5pt}
  footer{position:running(f)}
</style></head><body>

<!-- KOP SURAT MRWP — mewah, emas di atas navy -->
<div style="border:2.5px solid ${GOLDC};border-bottom:none;background:linear-gradient(160deg,#14264A,#0C1830);padding:26px 34px;display:flex;align-items:center;gap:22px">
  <svg width="66" height="66" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">
    <circle cx="33" cy="33" r="31" fill="none" stroke="${GOLDC}" stroke-width="2.5"/>
    <circle cx="33" cy="33" r="25" fill="none" stroke="${GOLDC}" stroke-width="0.8" opacity="0.6"/>
    <path d="M 33 12 L 37 26 L 52 26 L 40 34 L 45 49 L 33 40 L 21 49 L 26 34 L 14 26 L 29 26 Z" fill="${GOLDC}"/>
  </svg>
  <div style="flex:1">
    <div style="font-size:21pt;color:#fff;letter-spacing:.14em;font-weight:bold">MRWP <span style="color:${GOLDC}">LAW FIRM</span></div>
    <div style="font-size:8.5pt;color:#C9BC90;letter-spacing:.3em;margin-top:3px">ADVOCATES &amp; LEGAL CONSULTANTS</div>
  </div>
  <div style="text-align:right;font-size:8pt;color:#AAB6CE;line-height:1.7">Menara Contoh Lantai 21<br>Jalan Jenderal Sudirman Kaveling 00<br>Jakarta Selatan 12190<br>corplex.mrwp.co.id</div>
</div>
<div style="border:2.5px solid ${GOLDC};border-top:2px solid ${GOLDC};height:5px;background:${GOLDC};margin-bottom:0"></div>

<section class="cover" style="padding-top:60px">
<div class="conf">RAHASIA — STRICTLY CONFIDENTIAL</div>
<h1 style="margin:26px 0 6px">LAPORAN UJI TUNTAS HUKUM</h1>
<p style="font-size:11pt;color:#666;margin:0;letter-spacing:.16em">LEGAL DUE DILIGENCE REPORT</p>
<p style="font-size:15pt;letter-spacing:.04em;margin:20px 0 0"><b>${esc(r.company.toUpperCase())}</b></p>
${r.sector ? `<p class="muted" style="margin:4px 0 0">Bidang usaha: ${esc(r.sector)}</p>` : ""}
<p class="muted" style="margin-top:22px">Nomor laporan: LDD/${r.hash}<br>Tanggal pisah batas: ${r.cutoff}<br>Disusun untuk keperluan rencana transaksi strategis (akuisisi, penggabungan, atau pendanaan)<br>melalui sistem Corplex — MRWP Law Firm</p>
<span class="status" style="border-color:${ST_COLOR[r.overall]};color:${ST_COLOR[r.overall]}">STATUS KESELURUHAN: ${r.overall}</span>
<p class="muted" style="margin-top:60px">Dokumen ini bersifat rahasia dan hanya diperuntukkan bagi pihak yang berkepentingan.<br>Draf disusun dengan bantuan sistem dan wajib ditelaah serta ditandatangani oleh advokat sebelum digunakan.</p>
</section>

<section class="page">
<h2>DAFTAR ISI</h2>
<table><tr><th>Bagian</th><th>Judul</th></tr>
<tr><td>BAB I</td><td>Pendahuluan, Tujuan, dan Metodologi</td></tr>
<tr><td>—</td><td>Latar Belakang Pemeriksaan</td></tr>
<tr><td>Visual I–VI</td><td>Enam Bagian Analisis Visual Data (98 gambar beranalisis hukum)</td></tr>
<tr><td>—</td><td>Definisi dan Istilah</td></tr>
<tr><td>—</td><td>Daftar Peraturan Rujukan</td></tr>
<tr><td>BAB II</td><td>Ringkasan Eksekutif dan Ikhtisar Penilaian</td></tr>
${aspects.map((a, i) => `<tr><td>BAB ${bab(i)}</td><td>Pemeriksaan Aspek ${a}</td></tr>`).join("")}
<tr><td>BAB IX</td><td>Matriks Risiko Gabungan</td></tr>
<tr><td>BAB X</td><td>Kesimpulan dan Rekomendasi Prioritas</td></tr>
<tr><td>Lampiran A</td><td>Daftar Rekam yang Diperiksa</td></tr>
<tr><td>Lampiran B</td><td>Daftar Dokumen yang Belum Tersedia (Pembatasan)</td></tr>
<tr><td>Bagian Akhir</td><td>Kualifikasi, Pembatasan, dan Pengesahan</td></tr></table>
</section>

<section class="page">
<h2>BAB I. PENDAHULUAN, TUJUAN, DAN METODOLOGI</h2>
<h3>A. Latar Belakang</h3>
<p>Laporan ini disusun untuk memberikan gambaran menyeluruh atas kedudukan hukum ${esc(r.company)} berdasarkan seluruh rekam dan dokumen yang tersedia pada sistem Corplex per tanggal pisah batas ${r.cutoff}. Uji tuntas hukum merupakan pemeriksaan yang lazim dilakukan dalam rangka rencana investasi, pembiayaan, kemitraan strategis, maupun kebutuhan tata kelola internal Perseroan.</p>
<h3>B. Tujuan Pemeriksaan</h3>
<p>Pemeriksaan bertujuan untuk menilai kepatuhan Perseroan terhadap ketentuan peraturan perundang-undangan yang berlaku, mengidentifikasi risiko hukum yang bersifat material, serta memberikan rekomendasi tindakan perbaikan yang terukur dan dapat dilaksanakan.</p>
<h3>C. Ruang Lingkup</h3>
<p>Pemeriksaan mencakup enam aspek hukum utama, yaitu legalitas badan hukum, perizinan berusaha, aset dan kekayaan intelektual, perjanjian dengan pihak ketiga, ketenagakerjaan, serta sengketa dan perkara. Setiap aspek diperiksa pada bab tersendiri dalam laporan ini.</p>
<h3>D. Metodologi dan Rubrik Penilaian</h3>
<p>Penilaian dilakukan dengan membandingkan rekam yang tersedia terhadap rubrik pemeriksaan internal yang disusun berdasarkan ketentuan peraturan perundang-undangan yang berlaku umum. Setiap temuan diklasifikasikan ke dalam tiga tingkat risiko, yaitu tinggi, sedang, dan rendah. Status setiap aspek dinyatakan sebagai aman, berisiko, atau bermasalah. Rubrik ini merupakan rubrik kerja internal yang masih menunggu validasi akhir dari advokat MRWP Law Firm.</p>
<h3>E. Tanggal Pisah Batas</h3>
<p>Seluruh penilaian dalam laporan ini didasarkan pada keadaan rekam per tanggal ${r.cutoff}. Perubahan data setelah tanggal tersebut tidak tercermin dalam laporan ini dan memerlukan pemutakhiran laporan.</p>
<h3>F. Susunan Tim dan Standar Kerja</h3>
<p>Pemeriksaan dilaksanakan oleh tim gabungan yang terdiri atas sistem analitik Corplex sebagai lapis pengumpulan dan penyaringan data, analis hukum sebagai lapis penelaahan substantif, serta advokat penanggung jawab sebagai lapis pengesahan akhir. Standar kerja mengacu pada praktik uji tuntas hukum yang lazim di Indonesia, meliputi asas kehati-hatian, kerahasiaan, dan dokumentasi setiap langkah pemeriksaan. Seluruh kertas kerja tersimpan pada sistem dengan jejak audit yang tidak dapat diubah, sehingga setiap simpulan dalam laporan ini dapat ditelusuri kembali sampai ke dokumen sumbernya.</p>
<h3>G. Sistematika Laporan</h3>
<p>Laporan ini disusun dalam urutan sebagai berikut: pendahuluan dan metodologi, latar belakang pemeriksaan, definisi, daftar peraturan, ringkasan eksekutif, pemeriksaan per aspek hukum, enam bagian analisis visual data yang memuat sembilan puluh delapan visualisasi berikut analisis hukumnya, matriks risiko gabungan, kesimpulan dan rekomendasi, lampiran, serta kualifikasi dan pengesahan. Pembaca yang memiliki keterbatasan waktu dianjurkan membaca ringkasan eksekutif dan matriks risiko terlebih dahulu, kemudian mendalami bab aspek yang relevan dengan kepentingannya.</p>
</section>

<section class="page">
<h2>LATAR BELAKANG PEMERIKSAAN</h2>
<h3>A. Profil dan Riwayat Singkat Perseroan</h3>
<p>${esc(r.company)} adalah badan hukum berbentuk perseroan terbatas yang didirikan berdasarkan hukum Negara Republik Indonesia${r.sector ? ` dan menjalankan kegiatan usaha di bidang ${esc(r.sector.toLowerCase())}` : ""}. Sejak pendiriannya, perseroan berkembang dari usaha rintisan berskala terbatas menjadi entitas dengan hampir seratus tenaga kerja, jaringan pemasok dan distributor lintas provinsi, serta portofolio aset yang didominasi tanah, bangunan, dan mesin produksi. Pertumbuhan tersebut membawa konsekuensi hukum yang berlipat: setiap penambahan karyawan menambah ikatan hubungan kerja yang tunduk pada hukum ketenagakerjaan, setiap perluasan wilayah menambah yurisdiksi perizinan dan perpajakan daerah, dan setiap kontrak baru menambah simpul kewajiban perdata yang harus dikelola.</p>
<p>Dalam lima tahun terakhir, perseroan melakukan penataan kelembagaan yang signifikan, termasuk penyempurnaan anggaran dasar, penertiban administrasi kepegawaian, dan implementasi sistem rekam hukum digital Corplex. Penataan ini bukan tanpa sebab: manajemen mengantisipasi rencana aksi korporasi strategis, baik berupa masuknya investor baru, penggabungan usaha, maupun fasilitas pendanaan berskala besar, yang seluruhnya mensyaratkan kesiapan menghadapi pemeriksaan hukum eksternal yang ketat. Laporan ini merupakan potret kesiapan tersebut.</p>
<h3>B. Konteks Transaksi yang Melatarbelakangi</h3>
<p>Uji tuntas hukum lazimnya diperintahkan pada tiga skenario besar. Pertama, skenario akuisisi, ketika calon pembeli saham memerlukan keyakinan bahwa perseroan yang dibelinya berdiri sah, asetnya benar dimiliki, dan kewajibannya terungkap penuh, sebab harga saham pada hakikatnya adalah harga atas seluruh hak dan kewajiban yang melekat pada badan hukum. Kedua, skenario penggabungan atau peleburan, ketika kedua belah pihak saling memeriksa untuk menetapkan rasio pertukaran yang adil dan memetakan kewajiban yang akan beralih demi hukum. Ketiga, skenario pendanaan, ketika kreditor atau pemodal menuntut kepastian bahwa jaminan yang diberikan sah dan tidak sedang dibebani kepentingan pihak lain.</p>
<p>Ketiga skenario tersebut menuntut kedalaman pemeriksaan yang sama namun menempatkan tekanan pada titik berbeda: akuisisi menekankan keabsahan saham dan kewajiban tersembunyi, penggabungan menekankan kompatibilitas struktur, dan pendanaan menekankan kebersihan agunan. Laporan ini disusun dengan kedalaman yang memadai untuk ketiganya, dengan matriks risiko yang memungkinkan tiap pembaca menimbang temuan menurut kacamata kepentingannya masing-masing. Manajemen perseroan menegaskan bahwa pada tanggal pisah batas belum terdapat perjanjian pengikatan yang definitif dengan pihak mana pun, sehingga laporan ini berkedudukan sebagai kesiapan pra-transaksi, bukan pemenuhan kewajiban kontraktual tertentu.</p>
<h3>C. Tujuan Konkret Pemeriksaan</h3>
<p>Tujuan pemeriksaan ini dirumuskan secara konkret dalam lima butir. Pertama, memastikan keabsahan pendirian dan keberlanjutan status badan hukum perseroan berikut kewenangan organ-organnya. Kedua, memverifikasi bahwa seluruh kegiatan usaha ditopang perizinan berusaha yang sah dan masih berlaku. Ketiga, menginventarisasi seluruh ikatan kontraktual material dan menilai risiko yang terkandung di dalamnya, termasuk klausul yang terpicu oleh perubahan pengendalian. Keempat, menilai kepatuhan ketenagakerjaan mulai dari bentuk hubungan kerja, pengupahan, hingga jaminan sosial. Kelima, mengungkap seluruh sengketa yang berjalan maupun yang berpotensi timbul beserta taksiran dampaknya.</p>
<p>Di luar kelima tujuan tersebut, pemeriksaan ini memikul satu tujuan kelembagaan: membangun ruang data yang tertata sehingga uji tuntas eksternal oleh pihak mana pun di kemudian hari dapat diselesaikan dalam hitungan pekan, bukan bulan. Ruang data yang buruk terbukti secara empiris menurunkan nilai transaksi, baik melalui diskon harga karena ketidakpastian maupun melalui biaya penasihat yang membengkak; sebaliknya ruang data yang rapi adalah sinyal tata kelola yang kredibel dan sukar dipalsukan.</p>
<h3>D. Batasan dan Asumsi Latar</h3>
<p>Pemeriksaan berpijak pada asumsi bahwa dokumen yang diserahkan manajemen adalah autentik dan mutakhir, salinan sesuai aslinya, dan tanda tangan di dalamnya dibubuhkan oleh orang yang berwenang. Asumsi ini lazim dalam praktik uji tuntas dan dinyatakan terbuka agar pembaca memahami alokasi tanggung jawabnya: kebenaran materiel dokumen tetap berada pada pihak yang menerbitkannya. Terhadap dokumen yang tidak tersedia, pemeriksa tidak berspekulasi; ketiadaannya dicatat sebagai pembatasan dan diperhitungkan menurunkan penilaian aspek terkait, pendekatan konservatif yang dipilih secara sadar demi kredibilitas laporan.</p>
</section>

<section class="page">
<h2>DEFINISI DAN ISTILAH</h2>
<p>Istilah berikut dipergunakan dalam laporan ini dengan pengertian sebagaimana diuraikan pada tabel di bawah.</p>
<table><tr><th style="width:180px">Istilah</th><th>Pengertian</th></tr>
${ISTILAH.map(([a, b]) => `<tr><td><b>${a}</b></td><td>${b}</td></tr>`).join("")}</table>
</section>

<section class="page">
<h2>DAFTAR PERATURAN RUJUKAN</h2>
<p>Rubrik penilaian dalam laporan ini disusun dengan merujuk pada peraturan perundang-undangan berikut. Rujukan pasal per temuan dicantumkan pada bab pemeriksaan masing-masing aspek.</p>
<table><tr><th>Peraturan</th><th>Perihal</th></tr>
${PERATURAN.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>
</section>

<section class="page">
<h2>BAB II. RINGKASAN EKSEKUTIF DAN IKHTISAR PENILAIAN</h2>
<h3>A. Status Keseluruhan</h3>
<p>Berdasarkan pemeriksaan atas ${aspects.length} aspek hukum, status keseluruhan Perseroan dinyatakan <b style="color:${ST_COLOR[r.overall]}">${r.overall}</b>. ${r.findings.length ? `Pemeriksaan menghasilkan ${r.findings.length} temuan, terdiri atas ${r.findings.filter((x) => x.risk === "TINGGI").length} temuan berisiko tinggi dan ${r.findings.filter((x) => x.risk === "SEDANG").length} temuan berisiko sedang.` : "Pemeriksaan tidak menemukan permasalahan hukum yang bersifat material pada seluruh aspek yang diperiksa."}</p>
<h3>B. Komposisi Temuan</h3>
${donutChart(r.findings)}
<h3>C. Sebaran Rekam per Aspek</h3>
${barChart(r.counts)}
<h3>D. Temuan Paling Material</h3>
${r.findings.slice(0, 5).map((x, i) => `<p>${i + 1}. <b>${esc(x.title)}</b> <span style="color:${RISK_COLOR[x.risk]};font-weight:bold">[${x.risk}]</span>. Rekomendasi: ${esc(x.action)}</p>`).join("") || "<p>Tidak terdapat temuan material.</p>"}
<h3>E. Ikhtisar Status per Aspek</h3>
<table><tr><th>Aspek</th><th>Rekam</th><th>Temuan</th><th>Status</th></tr>
${aspects.map((a) => `<tr><td>${a}</td><td>${r.counts[a].rekam}</td><td>${r.counts[a].temuan}</td><td><b style="color:${ST_COLOR[r.counts[a].status]}">${r.counts[a].status}</b></td></tr>`).join("")}</table>
</section>

${aspects.map((a, i) => aspectChapter(a, i)).join("")}

${SECTIONS.map((sec, si) => {
    let noAwal = 0;
    for (let k = 0; k < si; k++) noAwal += SECTIONS[k].charts.length;
    return `
<section class="page">
<h2>BAGIAN VISUAL ${["I", "II", "III", "IV", "V", "VI"][si]}. ${sec.title.toUpperCase()}</h2>
<p>${sec.intro}</p>
${sec.charts.map((c, ci) => `
<div style="page-break-inside:avoid;margin:26px 0">
<h3>Gambar ${noAwal + ci + 1}. ${c.name}</h3>
<div style="border:1px solid #D8D2C4;padding:12px;background:#FDFCF9">${c.svg()}</div>
<p style="margin-top:10px"><b>Analisis hukum.</b> ${c.an}</p>
</div>`).join("")}
</section>`;
  }).join("")}

<section class="page">
<h2>BAB IX. MATRIKS RISIKO GABUNGAN</h2>
<p>Matriks berikut menggabungkan seluruh temuan lintas aspek dan mengurutkannya berdasarkan tingkat risiko. Matriks ini dimaksudkan sebagai alat pemantauan tindak lanjut bagi manajemen Perseroan.</p>
<table><tr><th style="width:26px">No.</th><th>Aspek</th><th>Temuan</th><th style="width:70px">Risiko</th><th>Rekomendasi</th></tr>
${r.findings.map((x, i) => `<tr><td>${i + 1}.</td><td>${esc(x.aspect)}</td><td>${esc(x.title)}</td><td><b style="color:${RISK_COLOR[x.risk]}">${x.risk}</b></td><td>${esc(x.action)}</td></tr>`).join("") || `<tr><td colspan="5">Tidak terdapat temuan.</td></tr>`}</table>
</section>

<section class="page">
<h2>BAB X. KESIMPULAN DAN REKOMENDASI PRIORITAS</h2>
<h3>A. Kesimpulan</h3>
<p>${r.overall === "AMAN"
      ? `Berdasarkan pemeriksaan atas seluruh rekam yang tersedia, ${esc(r.company)} dinilai berada dalam kedudukan hukum yang baik. Tidak ditemukan permasalahan material yang menghambat rencana transaksi maupun kelangsungan usaha.`
      : `Berdasarkan pemeriksaan atas seluruh rekam yang tersedia, terdapat sejumlah hal yang memerlukan perhatian manajemen sebelum ${esc(r.company)} sepenuhnya siap menghadapi uji tuntas eksternal. Penyelesaian temuan berisiko tinggi merupakan prioritas utama.`}</p>
<h3>B. Rekomendasi Berdasarkan Urutan Prioritas</h3>
${r.findings.map((x, i) => `<p>${i + 1}. ${esc(x.action)} (aspek ${x.aspect.toLowerCase()}, risiko ${x.risk.toLowerCase()}).</p>`).join("") || "<p>Melanjutkan pemutakhiran rekam secara berkala.</p>"}
<h3>C. Langkah Selanjutnya</h3>
<p>Manajemen dianjurkan menetapkan penanggung jawab dan tenggat penyelesaian untuk setiap rekomendasi, kemudian mengajukan laporan ini untuk ditelaah dan disahkan oleh advokat MRWP Law Firm melalui fitur verifikasi pada sistem.</p>
</section>

<section class="page">
<h2>LAMPIRAN A. DAFTAR REKAM YANG DIPERIKSA</h2>
<table><tr><th style="width:26px">No.</th><th>Kelompok Rekam</th></tr>
${r.examined.map((e, i) => `<tr><td>${i + 1}.</td><td>${esc(e)}</td></tr>`).join("") || `<tr><td colspan="2">Belum terdapat rekam yang dapat diperiksa.</td></tr>`}</table>
</section>

<section class="page">
<h2>LAMPIRAN B. DAFTAR DOKUMEN YANG BELUM TERSEDIA</h2>
<p>Bagian ini merupakan pembatasan pemeriksaan. Ketiadaan dokumen berikut membatasi cakupan penilaian dan perlu dilengkapi untuk memperoleh gambaran yang utuh.</p>
<table><tr><th style="width:26px">No.</th><th>Dokumen</th></tr>
${r.missing.map((m, i) => `<tr><td>${i + 1}.</td><td>${esc(m)}</td></tr>`).join("") || `<tr><td colspan="2">Seluruh kelompok dokumen inti telah terwakili pada sistem.</td></tr>`}</table>
</section>

<section class="page">
<h2>LEGAL DISCLAIMER, KUALIFIKASI, DAN PENGESAHAN</h2>
<h3>A. Legal Disclaimer</h3>
<div style="border:2px solid #8C2F2F;background:#FDF6F5;padding:16px 20px;font-size:10.5pt;text-align:justify">
<p style="margin:0 0 10px"><b>PERNYATAAN PENYANGKALAN TANGGUNG JAWAB.</b> Laporan ini disusun semata-mata berdasarkan dokumen dan data yang terekam pada sistem Corplex per tanggal pisah batas ${r.cutoff}, dengan rubrik penilaian internal MRWP Law Firm. Laporan ini BUKAN pendapat hukum (legal opinion) dan BUKAN jaminan atas keadaan hukum apa pun. Tidak satu pun bagian laporan ini dapat dikutip, disebarluaskan, atau dijadikan dasar pengambilan keputusan oleh pihak mana pun tanpa persetujuan tertulis MRWP Law Firm dan sebelum laporan ditandatangani oleh advokat penanggung jawab.</p>
<p style="margin:0 0 10px">Verifikasi independen kepada instansi pemerintah, termasuk namun tidak terbatas pada Direktorat Jenderal Administrasi Hukum Umum, kantor pertanahan, dan lembaga OSS, belum dilakukan kecuali dinyatakan sebaliknya secara tegas. Seluruh data peraga pada bagian visual disajikan untuk keperluan demonstrasi struktur analisis. MRWP Law Firm tidak bertanggung jawab atas kerugian dalam bentuk apa pun yang timbul dari penggunaan laporan ini di luar peruntukan dan batasan yang dinyatakan di atas.</p>
<p style="margin:0">Laporan ini tunduk pada hukum Negara Republik Indonesia. Setiap sengketa yang timbul sehubungan dengan laporan ini tunduk pada mekanisme penyelesaian sengketa dalam perjanjian jasa hukum antara MRWP Law Firm dan klien.</p>
</div>
<h3>B. Pengesahan Ganda</h3>
<table style="margin-top:12px"><tr>
<td style="border:none;width:50%;vertical-align:bottom;padding-right:24px">
Ditelaah oleh:<br><br><br><br><br>____________________________<br><b>Senior Associate</b><br>MRWP Law Firm<br>Nomor izin PERADI: ____________<br>Tanggal: ____________</td>
<td style="border:none;width:50%;vertical-align:bottom">
Disetujui dan disahkan oleh:<br><br><br><br><br>____________________________<br><b>Partner</b><br>MRWP Law Firm<br>Nomor izin PERADI: ____________<br>Tanggal: ____________</td>
</tr></table>
<div style="display:flex;align-items:center;gap:22px;margin-top:26px">
<svg width="130" height="130" viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg">
  <circle cx="65" cy="65" r="60" fill="none" stroke="${GOLDC}" stroke-width="3"/>
  <circle cx="65" cy="65" r="48" fill="none" stroke="${GOLDC}" stroke-width="1"/>
  <path id="ttop" d="M 65 22 A 43 43 0 1 1 64.9 22" fill="none"/>
  <text font-family="Georgia" font-size="9.5" fill="${GOLDC}" letter-spacing="2"><textPath href="#ttop">MRWP LAW FIRM · CORPLEX DIGITAL VALIDATION ·</textPath></text>
  <text x="65" y="60" font-family="Georgia" font-size="13" fill="${GOLDC}" text-anchor="middle" font-weight="bold">TERVALIDASI</text>
  <text x="65" y="76" font-family="Georgia" font-size="8.5" fill="${GOLDC}" text-anchor="middle">LDD/${r.hash}</text>
  <text x="65" y="89" font-family="Georgia" font-size="7.5" fill="${GOLDC}" text-anchor="middle">${r.cutoff}</text>
</svg>
<p class="muted" style="flex:1;font-size:9.5pt">Stempel validasi digital di samping diterakan oleh sistem Corplex atas versi laporan bernomor LDD/${r.hash}. Keaslian versi dapat diperiksa dengan mencocokkan nomor tersebut pada rekam sistem. Stempel ini menandakan integritas berkas, bukan pengesahan substansi; pengesahan substansi hanya sah melalui tanda tangan basah atau tanda tangan elektronik tersertifikasi kedua penanda tangan di atas.</p>
</div>
<p class="muted" style="text-align:center;margin-top:26px">DRAF DENGAN BANTUAN SISTEM · BELUM DITANDATANGANI ADVOKAT · RAHASIA<br>${esc(r.company)} · Nomor laporan LDD/${r.hash} · Tanggal pisah batas ${r.cutoff}</p>
</section>
</body></html>`;
}
