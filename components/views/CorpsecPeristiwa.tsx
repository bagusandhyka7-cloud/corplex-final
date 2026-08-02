"use client";
/*
 * SEKRETARIS PERUSAHAAN — pusat pemantauan aspek korporasi (arahan Pak Rheza).
 * Objek utamanya PERISTIWA, bukan dokumen: keputusan → akta (30 hari) → pengesahan (30 hari).
 *
 * Semua status & tenggat DITURUNKAN oleh lib/peristiwa.ts (murni, ada testnya) — nol status
 * tersimpan, jadi tak ada kelas bug "status basi". Data: module_records mod 'corpev',
 * satu baris per peristiwa — mewarisi RLS, realtime, hash dokumen, dan rute detail yang ada.
 */
import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Building2, FileText, Landmark, Plus, Scale, ScrollText, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { bukaDok } from "@/lib/dok";
import { Batas, Chip, Field, Kpi, Modal, Panel, Row } from "@/components/ui";
import { askConfirm } from "@/components/ui";
import {
  BENTUK_DASAR, JENIS_PERISTIWA, bentukPengesahan, jalurJenis, keadaanTerkini,
  periksaKorporasi, ringkasPeristiwa, sirkuler, sirkulerSah, statusPeristiwa,
  type Peristiwa, type StatusPeristiwa,
} from "@/lib/peristiwa";

const tid = () => localStorage.getItem("corplex_tid") || "";
const hariIniISO = () => new Date().toISOString().slice(0, 10);
const CHIP: Record<StatusPeristiwa, { c: string; label: string }> = {
  berlaku: { c: "c-ver", label: "BERLAKU" },
  proses: { c: "c-draft", label: "DALAM PROSES" },
  "telat-akta": { c: "c-red", label: "TERLAMBAT AKTA" },
  "telat-lapor": { c: "c-red", label: "TERLAMBAT LAPOR" },
};
export const FILTER_PERISTIWA = ["semua", "perlu tindakan", "dalam proses", "berlaku"];

/* IKHTISAR — dipasang lewat prop `kpi` milik ModuleShell agar mengikuti hierarki baku
 * seluruh modul (Judul → KPI → Ekstrak → Cari+Kategori → Isi). Peringatan sengaja berada
 * DI ATAS angka: layar pantau menjawab "ada masalah tidak hari ini?" sebelum hal lain. */
export function IkhtisarKorporasi() {
  const { ten } = useStore();
  const hariIni = hariIniISO();
  const list = ten?.corpev || [];
  const dengan = list.map((p) => ({ p, s: statusPeristiwa(p, hariIni) }));
  const perluTindakan = dengan.filter((x) => x.s.perluTindakan);
  const menunggu = dengan.filter((x) => x.s.status === "proses" && x.p.akta && !x.p.sah);
  const berlaku = dengan.filter((x) => x.s.status === "berlaku");
  const periksa = periksaKorporasi(list, hariIni, ten?.corp?.tutupBuku || 12);
  const terpenuhi = periksa.filter((x) => x.ok).length;

  return (
    <>
      {perluTindakan.slice(0, 2).map(({ p, s }) => (
        <div key={p.id} className={`flag${s.status === "telat-lapor" ? " w" : ""}`}>
          <b>{s.status === "telat-akta" ? "Keputusan belum dituangkan ke akta notaris" : "Akta belum memperoleh pengesahan Menkumham"} — {p.jenis}</b>
          <span>{ringkasPeristiwa(p)} · batas {s.tenggat?.tanggal} terlampaui {Math.abs(s.tenggat!.sisaHari)} hari.
            {s.status === "telat-akta"
              ? " Perubahan belum sah dan tak dapat diajukan ke Menkumham tanpa keputusan ulang."
              : " Perubahan belum berlaku terhadap pihak ketiga."}</span>
        </div>
      ))}
      <div className="grid g4 mb16">
        <Kpi v={list.length} label="Peristiwa tercatat" tr={list.length ? `${berlaku.length} berlaku · ${dengan.length - berlaku.length} dalam proses` : "belum ada peristiwa korporasi"} />
        <Kpi v={perluTindakan.length} label="Perlu tindakan segera" tr={perluTindakan.length ? "batas 30 hari terlampaui" : "tak ada tenggat terlampaui"} trCls={perluTindakan.length ? "dn" : undefined} />
        <Kpi v={menunggu.length} label="Menunggu Menkumham" tr={menunggu.length ? "akta sudah terbit, masih dalam tenggat" : "tidak ada akta tertunggak"} />
        <Kpi v={terpenuhi} label="Kesiapan uji tuntas" tr={`dari ${periksa.length} pemeriksaan aspek korporasi`} trCls={terpenuhi === periksa.length ? "up" : "md"} />
      </div>
    </>
  );
}

export default function CorpsecPeristiwa({ filter = "semua", q = "", kananBawah, bawah, onTutupBuku }: {
  filter?: string; q?: string;
  /* Penyimpan setelan tahun buku dipegang modul induk (satu jalur tulis ke rekam corp). */
  onTutupBuku?: (bulan: number) => void;
  /* Panel milik modul induk dititipkan ke sini agar ikut mengisi kerangka yang sama:
   *   kananBawah = menyambung kolom kanan (dokumen) — mengisi ruang di sisi garis waktu
   *   bawah      = baris penuh di bawah dua kolom (cap table, lalu kewajiban statutori)
   * Dirender terpisah di modul induk membuat kolom kiri menyisakan ruang kosong sepanjang layar. */
  kananBawah?: React.ReactNode; bawah?: React.ReactNode;
}) {
  const { ten, toast, pushQueue, pengawasan } = useStore();
  const t = ten!;
  const hariIni = hariIniISO();
  const list = t.corpev || [];

  const [buka, setBuka] = useState<Peristiwa | null>(null);
  const [tambah, setTambah] = useState(false);
  const [busy, setBusy] = useState(false);
  /* form peristiwa baru */
  const [f, setF] = useState({ historis: false, jenis: JENIS_PERISTIWA[8].nama, bentuk: BENTUK_DASAR[0], tanggal: hariIni, agenda: "", hal: "", dari: "", jadi: "" });
  /* form tahap lanjutan (akta / pengesahan) */
  const [tahap, setTahap] = useState<{ p: Peristiwa; jenis: "akta" | "sah" } | null>(null);
  const [tf, setTf] = useState({ nomor: "", tanggal: hariIni, notaris: "" });
  const [berkas, setBerkas] = useState<File | null>(null);
  const berkasRef = useRef<HTMLInputElement>(null);
  /* form penanda tangan sirkuler */
  const [ttdForm, setTtdForm] = useState<Peristiwa | null>(null);
  const [tt, setTt] = useState({ nama: "", jabatan: "" });

  const dengan = useMemo(() => list.map((p) => ({ p, s: statusPeristiwa(p, hariIni) })), [list, hariIni]);
  const berlaku = dengan.filter((x) => x.s.status === "berlaku");
  /* Tapis + cari mengikuti pola modul lain (ModuleShell): kategori di kanan, cari di kiri.
   * Pencarian menyapu jenis, dasar, agenda, nomor akta, dan nomor pengesahan — nomor akta
   * justru yang paling sering dipakai advokat untuk menelusuri satu perubahan. */
  const cocokQ = (p: Peristiwa) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [p.jenis, p.dasar.bentuk, p.dasar.tanggal, p.dasar.agenda, p.akta?.nomor, p.akta?.notaris, p.sah?.nomor, ...(p.ubah || []).flatMap((u) => [u.hal, u.dari, u.jadi])]
      .filter(Boolean).join(" ").toLowerCase().includes(s);
  };
  const rows = dengan.filter(({ p, s }) => cocokQ(p) && (
    filter === "semua" ? true
      : filter === "perlu tindakan" ? s.perluTindakan
        : filter === "dalam proses" ? s.status === "proses"
          : s.status === "berlaku"));

  const organ = useMemo(() => keadaanTerkini(list, hariIni), [list, hariIni]);
  const tutupBuku = t.corp?.tutupBuku || 12;
  const periksa = useMemo(() => periksaKorporasi(list, hariIni, tutupBuku), [list, hariIni, tutupBuku]);
  const pendirian = list.find((p) => /pendirian/i.test(p.jenis));
  const berlakuTerakhir = berlaku
    .map((x) => x.p.sah?.tanggal || x.p.akta?.tanggal || x.p.dasar.tanggal)
    .sort().pop();

  const simpanBaru = async () => {
    if (!f.jenis || !f.tanggal) return toast("Lengkapi isian", "Jenis peristiwa dan tanggal keputusan wajib diisi.", "warn");
    setBusy(true);
    const p: Peristiwa = {
      jenis: f.jenis, jalur: jalurJenis(f.jenis), historis: f.historis || undefined,
      dasar: { bentuk: f.bentuk, tanggal: f.tanggal, agenda: f.agenda.trim() || undefined },
      ubah: f.hal.trim() ? [{ hal: f.hal.trim(), dari: f.dari.trim() || "—", jadi: f.jadi.trim() }] : [],
    };
    const r = await api.records.create(tid(), "corpev", p as unknown as Record<string, unknown>);
    setBusy(false);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    setTambah(false);
    setF({ ...f, agenda: "", hal: "", dari: "", jadi: "" });
    toast("Peristiwa tercatat", f.historis
      ? "Masuk riwayat hukum perusahaan — tanpa alarm keterlambatan."
      : "Dua tenggat 30 hari kini dipantau otomatis.", "ok");
  };

  const simpanTahap = async () => {
    if (!tahap) return;
    if (!tf.nomor.trim() || !tf.tanggal) return toast("Lengkapi isian", "Nomor dan tanggal wajib diisi.", "warn");
    setBusy(true);
    const p = tahap.p;
    /* Berkas diunggah lebih dulu supaya nomor/tanggal dan dokumennya tersimpan dalam SATU
     * tulisan — kalau unggahan gagal, rekamnya tidak berubah setengah jalan. */
    let dok: { url: string; nama: string } | undefined;
    if (berkas) {
      const up = await api.records.uploadDoc(tid(), berkas);
      if (!up.ok) { setBusy(false); return toast("Gagal mengunggah berkas", up.error.message, "warn"); }
      dok = up.data;
    }
    const next: Peristiwa = tahap.jenis === "akta"
      ? { ...p, akta: { nomor: tf.nomor.trim(), tanggal: tf.tanggal, notaris: tf.notaris.trim() || undefined, dokUrl: dok?.url || p.akta?.dokUrl, dokNama: dok?.nama || p.akta?.dokNama } }
      : { ...p, sah: { bentuk: bentukPengesahan(p.jalur), nomor: tf.nomor.trim(), tanggal: tf.tanggal, dokUrl: dok?.url || p.sah?.dokUrl, dokNama: dok?.nama || p.sah?.dokNama } };
    const { id, ...data } = next;
    /* dok diteruskan ke kolom rekam juga → SHA-256 isi dokumen dihitung server (lib/dokhash). */
    const r = await api.records.update(String(id), data as unknown as Record<string, unknown>, dok);
    setBusy(false);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    setTahap(null); setBuka(next); setBerkas(null);
    setTf({ nomor: "", tanggal: hariIni, notaris: "" });
    toast(tahap.jenis === "akta" ? "Akta tercatat" : "Pengesahan tercatat",
      tahap.jenis === "akta"
        ? "Tenggat berikutnya dipasang: 30 hari sejak tanggal akta."
        : "Peristiwa kini BERLAKU — keadaan terkini ikut diperbarui.", "ok");
  };

  /* Persetujuan sirkuler — Pasal 91 UU PT: seluruh pemegang saham wajib setuju tertulis.
   * Yang tersimpan hanya nama, jabatan, dan tanggal; TIDAK ada tanda tangan digital. */
  const simpanTtd = async (p: Peristiwa, ttd: NonNullable<Peristiwa["ttd"]>) => {
    const { id, ...data } = { ...p, ttd };
    const r = await api.records.update(String(id), data as unknown as Record<string, unknown>);
    if (!r.ok) { toast("Gagal menyimpan", r.error.message, "warn"); return false; }
    setBuka({ ...p, ttd });
    return true;
  };
  const tambahTtd = async () => {
    if (!ttdForm || !tt.nama.trim()) return toast("Nama wajib diisi", "Tulis nama pemegang saham atau organ yang harus menyetujui.", "warn");
    setBusy(true);
    const ok = await simpanTtd(ttdForm, [...(ttdForm.ttd || []), { nama: tt.nama.trim(), jabatan: tt.jabatan.trim() || undefined }]);
    setBusy(false);
    if (ok) { setTtdForm(null); setTt({ nama: "", jabatan: "" }); toast("Pihak ditambahkan", "Keputusan sirkuler baru sah setelah SELURUH pihak menyetujui.", "ok"); }
  };
  const setujuiTtd = async (p: Peristiwa, i: number) => {
    const ttd = (p.ttd || []).map((x, j) => (j === i ? { ...x, setuju: hariIni } : x));
    if (await simpanTtd(p, ttd)) {
      toast(ttd.every((x) => x.setuju) ? "Keputusan sirkuler SAH — seluruh pihak setuju" : "Persetujuan tercatat",
        `Atas nama ${p.ttd?.[i]?.nama} · tercatat ${hariIni}. Yang tersimpan nama dan tanggal — bukan tanda tangan digital.`, "ok");
    }
  };
  const hapusTtd = async (p: Peristiwa, i: number) => {
    if (!(await askConfirm(`Hapus "${p.ttd?.[i]?.nama}" dari daftar persetujuan?`))) return;
    if (await simpanTtd(p, (p.ttd || []).filter((_, j) => j !== i))) toast("Pihak dihapus", "Daftar persetujuan diperbarui.", "ok");
  };

  const hapus = async (p: Peristiwa) => {
    if (!p.id) return;
    if (!(await askConfirm(`Hapus peristiwa "${p.jenis}" beserta rantainya?`))) return;
    const r = await api.records.remove(p.id);
    if (!r.ok) return toast("Gagal menghapus", r.error.message, "warn");
    setBuka(null);
    toast("Peristiwa dihapus", "Riwayat hukum perusahaan diperbarui.", "ok");
  };

  /* JAMIN — keterlambatan adalah momen paling wajar klien butuh advokat. Pengajuan dibuat
   * dari data peristiwa itu sendiri (bukan formulir kosong), lengkap dengan rujukan rekamnya. */
  const ajukanAdvokat = (p: Peristiwa, s: ReturnType<typeof statusPeristiwa>) => {
    const telatAkta = s.status === "telat-akta";
    const lewat = Math.abs(s.tenggat?.sisaHari ?? 0);
    pushQueue(
      `${telatAkta ? "Keterlambatan akta" : "Keterlambatan pelaporan Menkumham"} — ${p.jenis}`,
      `${ringkasPeristiwa(p)} · batas ${s.tenggat?.tanggal} terlampaui ${lewat} hari`,
      "c-red", "ESKALASI",
      p.id ? [{ mod: "corpev", id: p.id, label: p.jenis }] : undefined,
      telatAkta
        ? `Keputusan ${p.dasar.bentuk} tanggal ${p.dasar.tanggal} belum dituangkan dalam akta notaris. Batas 30 hari (${s.tenggat?.tanggal}) terlampaui ${lewat} hari.\n\nDimohon arahan advokat MRWP: apakah keputusan ini masih dapat diaktakan, atau perlu RUPS ulang. Agenda keputusan: ${p.dasar.agenda || "—"}.`
        : `Akta No. ${p.akta?.nomor} tanggal ${p.akta?.tanggal} belum memperoleh ${bentukPengesahan(p.jalur)}. Batas 30 hari (${s.tenggat?.tanggal}) terlampaui ${lewat} hari.\n\nDimohon arahan advokat MRWP atas langkah pemulihan dan risiko keabsahan perubahan ini.`,
    );
    toast("Diteruskan ke advokat MRWP", "Pengajuan masuk antrean verifikasi — pantau statusnya di menu Lawyer perusahaan MRWP.", "ok");
    setBuka(null);
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <style>{`
        /* Rel & simpul: garis di x=7..9 (sumbu 8), simpul 12px dipasang pada x=2..14 sehingga
         * sumbunya IDENTIK 8px — sebelumnya left:-23px membuat simpul meleset 1px ke kanan dan
         * deretannya terlihat goyah. box-sizing dikunci agar hitungan tak bergantung reset global. */
        .cs-rail{position:relative;padding-left:26px}
        .cs-rail::before{content:"";position:absolute;left:7px;top:6px;bottom:6px;width:2px;
          background:var(--line2)}
        .cs-node{position:relative;margin-bottom:10px}
        /* Warna simpul SERAGAM emas (seperti versi lama). Status tetap terbaca dari chip dan
         * rantai tahap di setiap baris — mewarnai simpul hanya menambah bahasa warna kedua. */
        .cs-node::before{content:"";box-sizing:border-box;position:absolute;left:-24px;top:18px;
          width:12px;height:12px;border-radius:50%;background:var(--bg-1);border:2px solid var(--gold-deep)}
        .cs-chain{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:7px}
        /* Tahap rantai = TEKS, bukan tombol. Berkotak-berlatar membuatnya tampak dapat diklik
         * padahal tidak, dan bertabrakan dengan chip status di kanan baris. Pembedanya warna saja. */
        .cs-step{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;color:var(--muted)}
        .cs-step.done{color:var(--ok)}
        .cs-step.now{color:var(--warn)}
        .cs-step.miss{color:var(--danger)}
        .cs-sep{color:var(--line2);font-size:11px}
        /* Daftar dibatasi 5 baris lalu menggulir di dalam panelnya sendiri — halaman tetap
         * satu layar berapa pun banyak rekamnya, dan tinggi kedua kolom tak lagi timpang.
         * ponytail: tinggi dipatok dari tinggi baris saat ini; sesuaikan bila baris berubah. */
        /* Batang gulir tipis, sewarna garis — komponen <Batas> yang menentukan tingginya. */
        .cs-rail::-webkit-scrollbar,.rows::-webkit-scrollbar{width:6px}
        .cs-rail::-webkit-scrollbar-thumb,.rows::-webkit-scrollbar-thumb{background:var(--line2);border-radius:6px}
        .cs-delta{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;
          background:rgba(16,33,61,.55);border:1px solid rgba(28,48,84,.8);border-radius:11px;padding:11px 14px}
        @media(max-width:640px){.cs-delta{grid-template-columns:1fr}}
      `}</style>

      {/* Peringatan & KPI kini dirender lewat prop `kpi` ModuleShell (lihat IkhtisarKorporasi)
        * supaya urutannya sama dengan seluruh modul lain. */}

      {/* Dua kolom tetap: kolom kiri (garis waktu + kepemilikan + kewajiban) dan kolom kanan
        * (keadaan terkini + kesiapan uji tuntas + dokumen) kini sama-sama berisi, jadi tak ada
        * lagi separuh layar yang menganggur meski peristiwanya baru sedikit. */}
      <div className="grid g-wide">
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title={<>Riwayat Hukum Perusahaan <Chip c="c-mon">{rows.length} DARI {list.length} PERISTIWA</Chip></>}>
            {/* Identitas perseroan: fakta tetap, bukan angka pantauan — jadi baris tipis, bukan KPI. */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
              <span className="sub mono" style={{ fontSize: 9.5 }}>
                {pendirian ? `BERDIRI ${pendirian.dasar.tanggal}${pendirian.akta?.nomor ? ` · AKTA ${pendirian.akta.nomor}` : ""}` : "PENDIRIAN BELUM TERCATAT"}
                {berlakuTerakhir ? ` · PERUBAHAN BERLAKU TERAKHIR ${berlakuTerakhir}` : ""}
              </span>
              {!pengawasan && <button className="btn btn-gold btn-sm" style={{ marginLeft: "auto" }} onClick={() => setTambah(true)}><Plus size={13} /> Catat Peristiwa</button>}
            </div>
            <Batas className="cs-rail">
              {rows.map(({ p, s }) => {
                return (
                  <div key={p.id} className="cs-node">
                    <div className="row clickable" style={{ alignItems: "flex-start" }} onClick={() => setBuka(p)}>
                      <div style={{ minWidth: 0 }}>
                        <b>{p.jenis}</b>
                        <span className="d">
                          {p.sah ? `Berlaku ${p.sah.tanggal}` : `${p.dasar.bentuk} ${p.dasar.tanggal}`}
                          {" · "}{p.jalur === "internal" ? "tanpa kewajiban lapor" : `jalur ${p.jalur}`}
                          {p.historis ? " · riwayat" : ""}
                        </span>
                        <div className="cs-chain">
                          <span className="cs-step done">KEPUTUSAN</span>
                          {p.jalur === "internal" ? <span className="cs-step">· TANPA KEWAJIBAN AKTA</span> : (<>
                            <span className="cs-sep">›</span>
                            <span className={`cs-step ${p.akta ? "done" : s.status === "telat-akta" ? "miss" : "now"}`}>AKTA</span>
                            <span className="cs-sep">›</span>
                            <span className={`cs-step ${p.sah ? "done" : s.status === "telat-lapor" ? "miss" : p.akta ? "now" : ""}`}>PENGESAHAN</span>
                          </>)}
                        </div>
                      </div>
                      <div className="right" style={{ flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <Chip c={CHIP[s.status].c}>{CHIP[s.status].label}</Chip>
                        {s.tenggat && (
                          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: s.tenggat.sisaHari < 0 ? "var(--danger)" : "var(--warn)" }}>
                            {s.tenggat.sisaHari < 0 ? `LEWAT ${Math.abs(s.tenggat.sisaHari)} HARI` : `SISA ${s.tenggat.sisaHari} HARI`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!rows.length && (
                <p className="note" style={{ margin: 0 }}>
                  {list.length ? "Tidak ada peristiwa pada tapis ini."
                    : "Belum ada peristiwa tercatat. Mulai dari pendirian perseroan — pilih “Riwayat lama” agar akta lama tidak dihitung terlambat."}
                </p>
              )}
            </Batas>
          </Panel>
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title={<><Users size={12} /> Keadaan Terkini</>}>
            <Batas className="rows">
              {organ.map((o) => <Row key={o.hal} b={o.hal} d={`Berlaku sejak ${o.perTanggal}`} right={<b style={{ color: "var(--ink)" }}>{o.nilai}</b>} />)}
              {!organ.length && <Row b="Belum ada keadaan yang dapat diturunkan" d="Isi kotak “Yang berubah” pada peristiwa — nilainya otomatis menjadi keadaan terkini setelah peristiwa berlaku." right={<Chip c="c-mon">KOSONG</Chip>} />}
            </Batas>
            {!!organ.length && <p className="note mt16">Diturunkan dari peristiwa yang sudah <b>berlaku</b> — bukan diketik terpisah, jadi tak bisa berbeda dengan riwayatnya.</p>}
          </Panel>

          <Panel title={<><ScrollText size={12} /> Aspek Korporasi — Kesiapan Uji Tuntas</>}>
            <Batas className="rows">
              {periksa.map((x) => <Row key={x.hal} b={x.hal} d={x.ket} right={<Chip c={x.ok ? "c-ver" : "c-red"}>{x.ok ? "TERPENUHI" : "TEMUAN"}</Chip>} />)}
            </Batas>
            {/* Tutup buku menentukan batas RUPS tahunan (Pasal 78). Dulu dipatok 31 Desember —
              * benar untuk sebagian besar PT Indonesia, tetapi salah untuk yang tahun bukunya
              * mengikuti induk asing (mis. Maret/Juni), dan tenggatnya jadi menyesatkan. */}
            {onTutupBuku && !pengawasan && (
              <div className="row mt16" style={{ alignItems: "center" }}>
                <div><b>Akhir tahun buku</b><span className="d">Dasar hitung batas RUPS tahunan (6 bulan setelahnya)</span></div>
                <select value={tutupBuku} onChange={(e) => onTutupBuku(Number(e.target.value))} style={{ maxWidth: 190 }}>
                  {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
                    .map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
                </select>
              </div>
            )}
            <p className="note mt16">Bab <b>Legalitas Badan Hukum</b> pada Laporan Uji Tuntas membaca pemeriksaan ini — bukan jumlah berkas yang diunggah.</p>
          </Panel>
          {kananBawah}
        </div>
      </div>

      {/* Baris penuh: struktur kepemilikan lalu kewajiban statutori — keduanya tabel pendek yang
        * terlihat sesak di kolom sempit (judul kewajiban sempat membungkus jadi empat baris). */}
      {bawah && <div style={{ display: "grid", gap: 16, marginTop: 16 }}>{bawah}</div>}

      {/* LAPIS 3 · detail satu peristiwa */}
      <Modal right open={!!buka} title={buka?.jenis || ""} onClose={() => setBuka(null)}
        footer={buka ? (() => {
          const s = statusPeristiwa(buka, hariIni);
          return (<>
            <button className="btn btn-line" onClick={() => setBuka(null)}>Tutup</button>
            {!pengawasan && <button className="btn btn-red btn-sm" onClick={() => void hapus(buka)}>Hapus</button>}
            {!pengawasan && s.perluTindakan && (
              <button className="btn btn-navy" onClick={() => ajukanAdvokat(buka, s)}><Scale size={12} /> Ajukan ke Advokat</button>
            )}
            {!pengawasan && buka.jalur !== "internal" && !buka.akta && (
              <button className="btn btn-gold" onClick={() => { setTahap({ p: buka, jenis: "akta" }); setTf({ nomor: "", tanggal: hariIni, notaris: "" }); }}><FileText size={12} /> Catat Akta</button>
            )}
            {!pengawasan && buka.jalur !== "internal" && buka.akta && !buka.sah && (
              <button className="btn btn-gold" onClick={() => { setTahap({ p: buka, jenis: "sah" }); setTf({ nomor: "", tanggal: hariIni, notaris: "" }); }}><Landmark size={12} /> Catat Pengesahan</button>
            )}
          </>);
        })() : undefined}>
        {buka && (() => {
          const s = statusPeristiwa(buka, hariIni);
          return (<>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
              <Chip c={CHIP[s.status].c}>{CHIP[s.status].label}</Chip>
              <Chip c="c-mon">{buka.jalur === "internal" ? "TANPA KEWAJIBAN LAPOR" : `JALUR ${buka.jalur.toUpperCase()}`}</Chip>
              {buka.historis && <Chip c="c-mon">RIWAYAT — TANPA ALARM</Chip>}
            </div>

            <Field label="1 · Dasar keputusan">
              <div className="row" style={{ alignItems: "flex-start" }}>
                <div><b>{buka.dasar.bentuk} — {buka.dasar.tanggal}</b><span className="d">{buka.dasar.agenda || "tanpa catatan agenda"}</span></div>
              </div>
            </Field>

            {buka.jalur === "internal" ? (
              <Field label="2 · Kewajiban lanjutan">
                <p className="note" style={{ margin: 0 }}>Selesai pada tahap keputusan — tidak menimbulkan kewajiban akta maupun pelaporan ke Menkumham. Tercatat sebagai bukti kepatuhan RUPS tahunan (Pasal 78 UU PT 40/2007).</p>
              </Field>
            ) : (<>
              <Field label="2 · Akta notaris">
                {buka.akta ? (
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div><b>Akta No. {buka.akta.nomor} — {buka.akta.tanggal}</b>
                      <span className="d">{buka.akta.notaris || "notaris tidak dicatat"}{buka.akta.dokNama ? ` · ${buka.akta.dokNama}` : " · berkas belum dilampirkan"}</span></div>
                    {buka.akta.dokUrl
                      ? <button className="btn-act" onClick={() => void bukaDok(buka.akta!.dokUrl, (p) => toast("Dokumen tak terbuka", p, "warn"))}>Buka</button>
                      : !pengawasan && <button className="btn-act" onClick={() => { setTahap({ p: buka, jenis: "akta" }); setTf({ nomor: buka.akta!.nomor, tanggal: buka.akta!.tanggal, notaris: buka.akta!.notaris || "" }); setBerkas(null); }}>Lampirkan</button>}
                  </div>
                ) : (
                  <div className={`flag${s.status === "telat-akta" ? "" : " w"}`} style={{ marginBottom: 0 }}>
                    <b>Belum ada akta</b>
                    <span>{s.tenggat ? `${s.tenggat.label} — ${s.tenggat.tanggal}${s.tenggat.sisaHari < 0 ? ` (lewat ${Math.abs(s.tenggat.sisaHari)} hari)` : ` (sisa ${s.tenggat.sisaHari} hari)`}` : "Riwayat lama — lengkapi bila dokumennya ditemukan."}</span>
                  </div>
                )}
              </Field>
              <Field label="3 · Pengesahan Menkumham">
                {buka.sah ? (
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div><b>{buka.sah.bentuk}</b>
                      <span className="d">{buka.sah.nomor} · {buka.sah.tanggal}{buka.sah.dokNama ? ` · ${buka.sah.dokNama}` : " · berkas belum dilampirkan"}</span></div>
                    {buka.sah.dokUrl
                      ? <button className="btn-act" onClick={() => void bukaDok(buka.sah!.dokUrl, (p) => toast("Dokumen tak terbuka", p, "warn"))}>Buka</button>
                      : !pengawasan && <button className="btn-act" onClick={() => { setTahap({ p: buka, jenis: "sah" }); setTf({ nomor: buka.sah!.nomor, tanggal: buka.sah!.tanggal, notaris: "" }); setBerkas(null); }}>Lampirkan</button>}
                  </div>
                ) : (
                  <div className={`flag${s.status === "telat-lapor" ? "" : " w"}`} style={{ marginBottom: 0 }}>
                    <b>{buka.akta ? "Menunggu pengesahan" : "Belum dapat diajukan"}</b>
                    <span>{buka.akta
                      ? `${bentukPengesahan(buka.jalur)} · ${s.tenggat ? `batas ${s.tenggat.tanggal}` : "riwayat lama"}`
                      : "Akta notaris harus terbit lebih dahulu sebelum diajukan ke Menkumham."}</span>
                  </div>
                )}
              </Field>
            </>)}

            {/* Persetujuan sirkuler (Pasal 91 UU PT) — hanya untuk keputusan sirkuler. */}
            {sirkuler(buka) && (
              <Field label={`Persetujuan pemegang saham ${(buka.ttd || []).length ? `— ${(buka.ttd || []).filter((x) => x.setuju).length}/${(buka.ttd || []).length}${sirkulerSah(buka) ? " (SAH)" : ""}` : ""}`}>
                <div className="rows">
                  {(buka.ttd || []).map((x, i) => (
                    <Row key={`${x.nama}-${i}`} b={`${x.nama}${x.jabatan ? ` — ${x.jabatan}` : ""}`}
                      d={x.setuju ? `Menyetujui · tercatat ${x.setuju}` : "Belum menyetujui — keputusan belum sah"}
                      right={<>
                        <Chip c={x.setuju ? "c-ver" : "c-draft"}>{x.setuju ? "SETUJU" : "MENUNGGU"}</Chip>
                        {!pengawasan && !x.setuju && <button className="btn btn-navy btn-sm" onClick={() => void setujuiTtd(buka, i)}>Setujui</button>}
                        {!pengawasan && <button className="btn-act" onClick={() => void hapusTtd(buka, i)}>Hapus</button>}
                      </>} />
                  ))}
                  {!(buka.ttd || []).length && <Row b="Belum ada pihak tercatat" d="Tambahkan seluruh pemegang saham yang wajib menyetujui." right={<Chip c="c-mon">KOSONG</Chip>} />}
                </div>
                {!pengawasan && <button className="btn btn-line btn-sm mt16" onClick={() => { setTtdForm(buka); setTt({ nama: "", jabatan: "" }); }}><Plus size={12} /> Tambah pihak</button>}
                <p className="note mt16">
                  Pasal 91 UU PT 40/2007: keputusan di luar RUPS sah hanya bila <b>seluruh</b> pemegang saham
                  dengan hak suara menyetujui secara tertulis — tidak mengenal suara terbanyak. Yang tersimpan di sini
                  adalah nama, jabatan, dan tanggal persetujuan; <b>bukan tanda tangan digital</b>.
                </p>
              </Field>
            )}

            {!!(buka.ubah || []).length && (
              <Field label="Yang berubah">
                <div style={{ display: "grid", gap: 9 }}>
                  {(buka.ubah || []).map((u) => (
                    <div key={u.hal} className="cs-delta">
                      <div><span className="d" style={{ fontSize: 11, color: "var(--muted)" }}>{u.hal}</span>
                        <div style={{ color: "var(--muted)", textDecoration: "line-through" }}>{u.dari}</div></div>
                      <ArrowRight size={14} style={{ color: "var(--gold-bright)" }} />
                      <div style={{ textAlign: "right" }}><span className="d" style={{ fontSize: 11, color: "var(--muted)" }}>menjadi</span>
                        <div style={{ color: "var(--ink)", fontWeight: 600 }}>{u.jadi}</div></div>
                    </div>
                  ))}
                </div>
              </Field>
            )}

            {s.perluTindakan && (
              <p className="note mt16" style={{ borderLeft: "3px solid var(--danger)" }}>
                Keterlambatan ini <b>tidak dapat diperbaiki sendiri oleh sistem</b>. Tombol <b>Ajukan ke Advokat</b> meneruskan peristiwa ini beserta tanggal dan agendanya ke meja advokat MRWP.
              </p>
            )}
          </>);
        })()}
      </Modal>

      {/* Catat peristiwa — mode dulu, karena riwayat lama tak boleh melahirkan alarm */}
      <Modal right open={tambah} title="Catat Peristiwa Korporasi" onClose={() => setTambah(false)}
        footer={<><button className="btn btn-line" onClick={() => setTambah(false)}>Batal</button>
          <button className="btn btn-gold" disabled={busy} onClick={() => void simpanBaru()}>{busy ? "Menyimpan…" : "Simpan Peristiwa"}</button></>}>
        <Field label="Peristiwa ini *">
          <div style={{ display: "grid", gap: 8 }}>
            {([["Sedang berjalan", "dipantau — dua tenggat 30 hari dipasang otomatis", false],
               ["Riwayat lama", "sudah selesai di masa lalu — dicatat tanpa alarm keterlambatan", true]] as const).map(([b, d, v]) => (
              <label key={b} className="row clickable" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="radio" name="cs-mode" checked={f.historis === v} onChange={() => setF({ ...f, historis: v })} style={{ marginTop: 3 }} />
                <div><b>{b}</b><span className="d">{d}</span></div>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Jenis peristiwa *">
          <select value={f.jenis} onChange={(e) => setF({ ...f, jenis: e.target.value })}>
            {JENIS_PERISTIWA.map((j) => <option key={j.nama}>{j.nama}</option>)}
          </select>
        </Field>
        <Field label="Dasar keputusan *">
          <select value={f.bentuk} onChange={(e) => setF({ ...f, bentuk: e.target.value })}>
            {BENTUK_DASAR.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Tanggal keputusan *"><input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} /></Field>
        <Field label="Agenda / ringkasan keputusan"><textarea rows={2} value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} placeholder="mis. Pengangkatan Direktur Keuangan menggantikan pejabat lama" /></Field>

        <Field label="Yang berubah (opsional — jadi dasar Keadaan Terkini)">
          <div style={{ display: "grid", gap: 8 }}>
            <input value={f.hal} onChange={(e) => setF({ ...f, hal: e.target.value })} placeholder="Hal — mis. Direktur Utama · Modal dasar · Tempat kedudukan" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={f.dari} onChange={(e) => setF({ ...f, dari: e.target.value })} placeholder="Dari" />
              <input value={f.jadi} onChange={(e) => setF({ ...f, jadi: e.target.value })} placeholder="Menjadi" />
            </div>
          </div>
        </Field>

        <div className="panel" style={{ marginTop: 4, background: "rgba(37,29,14,.35)", borderColor: "var(--warn-line)" }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <AlertTriangle size={15} style={{ color: "var(--warn)", flex: "0 0 auto", marginTop: 2 }} />
            <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--txt2)" }}>
              {jalurJenis(f.jenis) === "internal" ? (<>
                Jenis ini <b style={{ color: "var(--warn)" }}>selesai pada tahap keputusan</b> — tanpa kewajiban akta maupun pelaporan (Pasal 78 UU PT: RUPS tahunan wajib digelar maks 6 bulan setelah tutup buku).
              </>) : (<>
                Sistem menetapkan jalur <b style={{ color: "var(--warn)" }}>{jalurJenis(f.jenis)}</b> untuk jenis ini
                {jalurJenis(f.jenis) === "persetujuan" ? " — wajib Keputusan Menteri sebelum berlaku." : " — cukup Surat Penerimaan Pemberitahuan."}
                <br />
                {f.historis
                  ? <>Riwayat lama: <b>tenggat & alarm tidak diberlakukan</b> — lengkapi akta dan pengesahannya dari halaman detail.</>
                  : <>Dua tenggat dipasang otomatis: <b>akta maks 30 hari</b> sejak keputusan, lalu <b>pengajuan ke Menkumham 30 hari</b> sejak tanggal akta.</>}
              </>)}
            </div>
          </div>
        </div>
      </Modal>

      {/* Tahap lanjutan: akta / pengesahan */}
      <Modal right open={!!tahap} title={tahap?.jenis === "akta" ? "Catat Akta Notaris" : `Catat ${tahap ? bentukPengesahan(tahap.p.jalur) : ""}`} onClose={() => setTahap(null)}
        footer={<><button className="btn btn-line" onClick={() => setTahap(null)}>Batal</button>
          <button className="btn btn-gold" disabled={busy} onClick={() => void simpanTahap()}>{busy ? "Menyimpan…" : "Simpan"}</button></>}>
        <Field label={tahap?.jenis === "akta" ? "Nomor akta *" : "Nomor surat/keputusan *"}>
          <input value={tf.nomor} onChange={(e) => setTf({ ...tf, nomor: e.target.value })} placeholder={tahap?.jenis === "akta" ? "mis. 14/2026" : "mis. AHU-0056789.AH.01.02.TAHUN 2026"} />
        </Field>
        <Field label="Tanggal *"><input type="date" value={tf.tanggal} onChange={(e) => setTf({ ...tf, tanggal: e.target.value })} /></Field>
        {tahap?.jenis === "akta" && (
          <Field label="Notaris"><input value={tf.notaris} onChange={(e) => setTf({ ...tf, notaris: e.target.value })} placeholder="mis. Andi Prasetyo, S.H., M.Kn." /></Field>
        )}
        {/* Berkas menempel pada tahap ini — bukan ke tumpukan dokumen umum yang tak tertaut. */}
        <Field label={`Berkas ${tahap?.jenis === "akta" ? "akta notaris" : "surat/keputusan"} (PDF / gambar)`}>
          <input ref={berkasRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setBerkas(f); e.target.value = ""; }} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-line btn-sm" onClick={() => berkasRef.current?.click()}>{berkas ? "Ganti berkas" : "Pilih berkas"}</button>
            <span className="sub" style={{ fontSize: 12 }}>{berkas ? berkas.name : "belum ada berkas — nomor & tanggal tetap dapat disimpan"}</span>
            {berkas && <button type="button" className="btn btn-red btn-sm" onClick={() => setBerkas(null)}>Buang</button>}
          </div>
        </Field>
        <p className="note mt16">
          {tahap?.jenis === "akta"
            ? "Setelah akta tercatat, tenggat berpindah otomatis ke batas 30 hari berikutnya (pengajuan ke Menkumham)."
            : "Setelah pengesahan tercatat, peristiwa menjadi BERLAKU dan isinya ikut memperbarui Keadaan Terkini."}
        </p>
      </Modal>

      {/* Tambah pihak penanda tangan sirkuler */}
      <Modal right open={!!ttdForm} title="Tambah Pihak yang Harus Menyetujui" onClose={() => setTtdForm(null)}
        footer={<><button className="btn btn-line" onClick={() => setTtdForm(null)}>Batal</button>
          <button className="btn btn-gold" disabled={busy} onClick={() => void tambahTtd()}>{busy ? "Menyimpan…" : "Tambah"}</button></>}>
        <Field label="Nama pemegang saham / organ *"><input value={tt.nama} onChange={(e) => setTt({ ...tt, nama: e.target.value })} placeholder="mis. PT Sentra Modal Nusantara" /></Field>
        <Field label="Jabatan / kedudukan"><input value={tt.jabatan} onChange={(e) => setTt({ ...tt, jabatan: e.target.value })} placeholder="mis. Pemegang Saham Mayoritas · Direktur Utama" /></Field>
        <p className="note mt16">Daftar ini harus memuat <b>seluruh</b> pemegang saham dengan hak suara. Selama satu pihak belum menyetujui, keputusan sirkuler dinyatakan belum sah dan muncul sebagai temuan pada kesiapan uji tuntas.</p>
      </Modal>

      <p className="note" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16 }}>
        <Building2 size={13} style={{ color: "var(--gold-deep)" }} />
        <span>Status dan tenggat di halaman ini <b>dihitung</b> dari tanggal yang Anda catat (UU PT 40/2007 Pasal 21 &amp; 78) — bukan diketik manual, sehingga tak bisa basi.</span>
      </p>
    </div>
  );
}
