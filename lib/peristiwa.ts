/*
 * PERISTIWA KORPORASI — mesin Sekretaris Perusahaan (arahan Pak Rheza: "memantau akta
 * pendirian, perubahan, dan RUPS · aspek korporasi").
 *
 * Objek utamanya BUKAN dokumen melainkan peristiwa, mengikuti alur hukum Indonesia:
 *   keputusan RUPS → akta notaris (maks 30 hari) → pengesahan/pemberitahuan Menkumham
 *   (maks 30 hari) → BERLAKU
 * Dua tenggat 30 hari itulah satu-satunya tempat perusahaan bisa terlambat, dan keduanya
 * dihitung dari tanggal yang sudah dicatat — nol input manual, nol cron.
 *
 * ATURAN PENTING: status TIDAK PERNAH DISIMPAN. Semuanya diturunkan dari tanggal + kelengkapan
 * rantai, jadi kelas bug "status basi" (lupa memutakhirkan saat akta diunggah) mustahil terjadi.
 */

export type Jalur = "persetujuan" | "pemberitahuan" | "internal";
export type StatusPeristiwa = "berlaku" | "proses" | "telat-akta" | "telat-lapor";

export type Ubah = { hal: string; dari: string; jadi: string };
export type Peristiwa = {
  id?: string;
  jenis: string;
  jalur: Jalur;
  /* Riwayat lama yang dicatat mundur (akta 2019 diketik hari ini). Tenggat & alarm TIDAK
   * berlaku — tanpa penanda ini seluruh arsip perusahaan akan berteriak "TELAT 2.700 HARI". */
  historis?: boolean;
  dasar: { bentuk: string; tanggal: string; agenda?: string };
  /* Berkas menempel pada TAHAPNYA, bukan satu lampiran per peristiwa: satu perubahan bisa
   * punya risalah RUPS, akta notaris, dan SK Menkumham sekaligus — menumpuknya jadi satu
   * kolom membuat pembuktian kehilangan konteks (dokumen mana untuk tahap mana). */
  akta?: { nomor: string; tanggal: string; notaris?: string; dokUrl?: string; dokNama?: string };
  sah?: { bentuk: string; nomor: string; tanggal: string; dokUrl?: string; dokNama?: string };
  ubah?: Ubah[];
  /* Keputusan Sirkuler Pemegang Saham (Pasal 91 UU PT 40/2007) sah HANYA bila SELURUH pemegang
   * saham dengan hak suara menyetujui secara tertulis — tak ada mekanisme suara terbanyak.
   * Karena itu daftar ini melekat pada peristiwanya, dan status sah dihitung dari kelengkapannya. */
  ttd?: { nama: string; jabatan?: string; setuju?: string }[];
  dokUrl?: string | null;
  dokNama?: string | null;
};

/* Sirkuler hanya sah bila 100% menyetujui — bukan mayoritas. Dipakai UI & pemeriksaan LDD. */
export const sirkuler = (p: Peristiwa) => /sirkuler/i.test(p.dasar.bentuk);
export const sirkulerSah = (p: Peristiwa) =>
  !!p.ttd?.length && p.ttd.every((x) => !!x.setuju);

/* Pasal 21 UU PT 40/2007 — jenis perubahan menentukan jalurnya, jadi pengguna tak perlu hafal.
 * "internal" = rantai berhenti di keputusan (RUPS tahunan penerimaan laporan keuangan,
 * Pasal 78: wajib digelar maks 6 bulan setelah tutup buku, tanpa akta perubahan). */
export const JENIS_PERISTIWA: { nama: string; jalur: Jalur }[] = [
  { nama: "Pendirian Perseroan", jalur: "persetujuan" },
  { nama: "Perubahan Nama Perseroan", jalur: "persetujuan" },
  { nama: "Perubahan Tempat Kedudukan", jalur: "persetujuan" },
  { nama: "Perubahan Maksud & Tujuan", jalur: "persetujuan" },
  { nama: "Perubahan Jangka Waktu Perseroan", jalur: "persetujuan" },
  { nama: "Peningkatan Modal Dasar", jalur: "persetujuan" },
  { nama: "Pengurangan Modal Ditempatkan/Disetor", jalur: "persetujuan" },
  { nama: "Perubahan Status Tertutup/Terbuka", jalur: "persetujuan" },
  { nama: "Perubahan Susunan Direksi", jalur: "pemberitahuan" },
  { nama: "Perubahan Susunan Komisaris", jalur: "pemberitahuan" },
  { nama: "Perubahan Pemegang Saham", jalur: "pemberitahuan" },
  { nama: "Penambahan Modal Ditempatkan", jalur: "pemberitahuan" },
  { nama: "RUPS Tahunan (penerimaan laporan keuangan)", jalur: "internal" },
];
export const jalurJenis = (nama: string): Jalur =>
  JENIS_PERISTIWA.find((j) => j.nama === nama)?.jalur || "pemberitahuan";

export const BENTUK_DASAR = ["RUPS Tahunan", "RUPS Luar Biasa", "Keputusan Sirkuler Pemegang Saham", "Akta Pendirian"];
export const bentukPengesahan = (jalur: Jalur) =>
  jalur === "persetujuan" ? "Keputusan Menteri" : "Surat Penerimaan Pemberitahuan";

const HARI = 86_400_000;
const isISO = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
/* Tanggal hukum tak punya jam: SELURUH aritmetika di UTC. Mengurai "2026-07-20T00:00:00"
 * (waktu lokal) lalu memformat hasilnya dengan toISOString (UTC) menggeser tenggat satu hari
 * penuh di WIB — di modul yang seluruh gunanya adalah batas 30 hari, itu fatal. */
const hariKe = (iso: string) => Math.floor(Date.parse(iso + "T00:00:00Z") / HARI);
export const tambahHari = (iso: string, n: number) =>
  new Date(Date.parse(iso + "T00:00:00Z") + n * HARI).toISOString().slice(0, 10);

export type HasilStatus = {
  status: StatusPeristiwa;
  /* Tenggat aktif berikutnya. null bila peristiwa sudah berlaku, historis, atau internal. */
  tenggat: { label: string; tanggal: string; sisaHari: number } | null;
  /* true = perlu tindakan segera (dipakai ikhtisar, pengingat, dan penilaian LDD). */
  perluTindakan: boolean;
};

/**
 * Status satu peristiwa. `hariIni` wajib diberikan pemanggil (bukan Date.now() di dalam)
 * supaya fungsinya murni dan dapat diuji tanpa memalsukan waktu sistem.
 */
export function statusPeristiwa(p: Peristiwa, hariIni: string): HasilStatus {
  const lengkap = !!p.sah;
  const internal = p.jalur === "internal";

  /* Internal (RUPS tahunan): tak ada kewajiban akta maupun lapor — begitu keputusan tercatat,
   * peristiwanya selesai. */
  if (internal) return { status: "berlaku", tenggat: null, perluTindakan: false };
  if (lengkap) return { status: "berlaku", tenggat: null, perluTindakan: false };

  /* Riwayat lama: nilai dari KELENGKAPAN rantai, bukan keterlambatan. Peristiwa 2019 yang
   * belum lengkap tetap "dalam proses" (perlu dilengkapi), tetapi tak pernah "telat". */
  if (p.historis) return { status: "proses", tenggat: null, perluTindakan: false };

  const now = isISO(hariIni) ? hariKe(hariIni) : 0;

  if (!p.akta) {
    if (!isISO(p.dasar.tanggal)) return { status: "proses", tenggat: null, perluTindakan: false };
    const batas = tambahHari(p.dasar.tanggal, 30);
    const sisa = hariKe(batas) - now;
    return {
      status: sisa < 0 ? "telat-akta" : "proses",
      tenggat: { label: "Batas penuangan ke akta notaris", tanggal: batas, sisaHari: sisa },
      perluTindakan: sisa < 0,
    };
  }

  if (!isISO(p.akta.tanggal)) return { status: "proses", tenggat: null, perluTindakan: false };
  const batas = tambahHari(p.akta.tanggal, 30);
  const sisa = hariKe(batas) - now;
  const label = p.jalur === "persetujuan"
    ? "Batas pengajuan persetujuan Menkumham"
    : "Batas pemberitahuan ke Menkumham";
  return {
    status: sisa < 0 ? "telat-lapor" : "proses",
    tenggat: { label, tanggal: batas, sisaHari: sisa },
    perluTindakan: sisa < 0,
  };
}

/* Keadaan organ terkini = hasil peristiwa yang SUDAH berlaku, bukan input terpisah.
 * Nilai `jadi` terakhir per `hal` menang (urut tanggal berlaku/keputusan). */
export function keadaanTerkini(list: Peristiwa[], hariIni: string): { hal: string; nilai: string; perTanggal: string }[] {
  const berlaku = list
    .filter((p) => statusPeristiwa(p, hariIni).status === "berlaku")
    .map((p) => ({ p, tgl: p.sah?.tanggal || p.akta?.tanggal || p.dasar.tanggal }))
    .sort((a, b) => (a.tgl || "").localeCompare(b.tgl || ""));
  const peta = new Map<string, { nilai: string; perTanggal: string }>();
  berlaku.forEach(({ p, tgl }) => (p.ubah || []).forEach((u) => {
    if (u.hal?.trim()) peta.set(u.hal.trim(), { nilai: u.jadi, perTanggal: tgl || "" });
  }));
  return [...peta.entries()].map(([hal, v]) => ({ hal, nilai: v.nilai, perTanggal: v.perTanggal }));
}

export type Periksa = { hal: string; ok: boolean; ket: string };

/* Pemeriksaan aspek korporasi — PENGGANTI penilaian lama "hitung jumlah berkas", yang membuat
 * unggahan 3 berkas apa pun berstatus AMAN pada bab pertama Laporan Uji Tuntas. */
export function periksaKorporasi(list: Peristiwa[], hariIni: string, tutupBukuBulan = 12): Periksa[] {
  /* Sirkuler yang belum lengkap tanda tangannya = keputusan BELUM SAH (Pasal 91 UU PT), jadi
   * tak boleh lolos diam-diam sekadar karena aktanya sudah terbit. */
  const sirkulerTimpang = list.filter((p) => sirkuler(p) && !sirkulerSah(p));
  const st = list.map((p) => ({ p, s: statusPeristiwa(p, hariIni) }));
  const pendirian = list.find((p) => /pendirian/i.test(p.jenis));
  const telatAkta = st.filter((x) => x.s.status === "telat-akta");
  const telatLapor = st.filter((x) => x.s.status === "telat-lapor");
  const menunggu = st.filter((x) => x.s.status === "proses" && x.p.akta && !x.p.sah);

  /* RUPS tahunan wajib digelar maks 6 bulan setelah tutup buku (Pasal 78 UU PT) — kewajiban
   * yang TIDAK melahirkan akta, jadi tak akan tertangkap rantai akta di atas. */
  const thnIni = Number(hariIni.slice(0, 4));
  const tahunBuku = thnIni - 1;
  const batasRups = tambahHari(`${tahunBuku + (tutupBukuBulan === 12 ? 1 : 0)}-${String(tutupBukuBulan === 12 ? 1 : tutupBukuBulan + 1).padStart(2, "0")}-01`, 180);
  const adaRupsTahunan = list.some((p) => p.jalur === "internal" && p.dasar.tanggal >= `${tahunBuku + 1}-01-01`);

  return [
    {
      hal: "Akta pendirian & pengesahan badan hukum",
      ok: !!pendirian?.sah,
      ket: pendirian?.sah
        ? `Akta ${pendirian.akta?.nomor || "—"} · disahkan ${pendirian.sah.tanggal}`
        : pendirian ? "Pendirian tercatat, pengesahan Menkumham belum dilengkapi" : "Belum ada peristiwa pendirian tercatat",
    },
    /* "Tak ada yang terlambat" pada perusahaan yang NOL peristiwanya bukan kabar baik — itu
     * artinya belum ada yang dinilai. Keputusan owner untuk skor LDD berlaku sama di sini:
     * nol data = BELUM DINILAI, bukan AMAN. */
    {
      hal: "Setiap keputusan dituangkan dalam akta",
      ok: list.length > 0 && telatAkta.length === 0,
      ket: !list.length ? "Belum ada peristiwa korporasi tercatat"
        : telatAkta.length ? `${telatAkta.length} keputusan lewat batas 30 hari tanpa akta` : "Tidak ada keputusan yang lewat batas",
    },
    {
      hal: "Setiap akta memperoleh pengesahan",
      ok: list.length > 0 && telatLapor.length === 0,
      ket: !list.length ? "Belum ada peristiwa korporasi tercatat"
        : telatLapor.length ? `${telatLapor.length} akta lewat batas 30 hari tanpa pengesahan`
        : menunggu.length ? `${menunggu.length} akta menunggu pengesahan (masih dalam tenggat)` : "Tidak ada akta yang tertunggak",
    },
    {
      hal: "Susunan organ mengikuti pengesahan terakhir",
      ok: keadaanTerkini(list, hariIni).length > 0,
      ket: keadaanTerkini(list, hariIni).length
        ? `${keadaanTerkini(list, hariIni).length} butir keadaan terkini diturunkan dari peristiwa berlaku`
        : "Belum ada perubahan berlaku yang dapat diturunkan",
    },
    {
      hal: `RUPS tahunan buku ${tahunBuku}`,
      ok: adaRupsTahunan,
      ket: adaRupsTahunan ? `Tercatat · batas ${batasRups}` : `Belum tercatat — batas penyelenggaraan ${batasRups} (Pasal 78 UU PT)`,
    },
    {
      hal: "Keputusan sirkuler disetujui seluruh pemegang saham",
      /* Perusahaan tanpa satu pun peristiwa tetap BELUM DINILAI — sama seperti pemeriksaan
       * lain; "tidak ada sirkuler" hanya sah disebut aman bila ada riwayat yang diperiksa. */
      ok: list.length > 0 && sirkulerTimpang.length === 0,
      ket: !list.length ? "Belum ada peristiwa korporasi tercatat"
        : sirkulerTimpang.length
          ? `${sirkulerTimpang.length} keputusan sirkuler belum lengkap persetujuannya — Pasal 91 UU PT menuntut persetujuan seluruh pemegang saham, bukan suara terbanyak`
          : list.some(sirkuler) ? "Seluruh keputusan sirkuler lengkap disetujui" : "Tidak ada keputusan sirkuler tercatat",
    },
  ];
}

/* Ringkasan satu baris untuk pengingat & eskalasi ke advokat. */
export const ringkasPeristiwa = (p: Peristiwa) =>
  `${p.jenis} — ${p.dasar.bentuk} ${p.dasar.tanggal}`;
