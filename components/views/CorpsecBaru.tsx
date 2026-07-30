"use client";
/*
 * PROTOTIPE — Sekretaris Perusahaan v2 (pusat pemantauan aspek korporasi).
 *
 * Tujuan redesign: modul berhenti menjadi lemari arsip dan menjadi PEMANTAU riwayat hukum
 * badan usaha. Objek utamanya bukan lagi dokumen, melainkan PERISTIWA KORPORASI:
 *   RUPS/keputusan  →  Akta Notaris (maks 30 hari)  →  Pengesahan Menkumham (maks 30 hari)  →  BERLAKU
 *
 * Halaman ini memakai token & komponen design system Corplex yang sudah ada (panel, chip,
 * btn, row, vh, var(--gold)/(--navy)) — nol tema baru, supaya pemindahan ke modul asli
 * nyaris tanpa penyesuaian visual.
 *
 * DATA DI SINI DUMMY (peraga untuk owner). Nol pemanggilan DB/API — sesuai lingkup prototipe.
 */
import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Building2, Check, FileText, Landmark, Plus, ScrollText, Users } from "lucide-react";
import { Chip, Field, Modal, Panel, Row, ViewHead } from "@/components/ui";

/* ── Model peristiwa (bentuk yang diusulkan; di sini sebagai data peraga) ───────────── */
type Status = "berlaku" | "proses" | "telat-akta" | "telat-lapor";
/* "internal" = peristiwa yang rantainya berhenti di tahap keputusan (mis. RUPS tahunan
 * penerimaan laporan keuangan) — tak ada kewajiban akta/pelaporan, dicatat sebagai riwayat. */
type Jalur = "persetujuan" | "pemberitahuan" | "internal";
type Ubah = { hal: string; dari: string; jadi: string };
type Peristiwa = {
  id: string;
  jenis: string;
  tanggalBerlaku?: string;      // tanggal pengesahan terbit
  status: Status;
  jalur: Jalur;
  /* Riwayat lama yang dicatat mundur: tenggat & alarm TIDAK berlaku — status dihitung dari
   * kelengkapan rantai, bukan keterlambatan. Tanpa ini, akta 2019 yang baru dicatat hari ini
   * akan berteriak "TERLAMBAT 2.700 HARI" — alarm palsu, dosa yang sama dengan dummy. */
  historis?: boolean;
  dasar: { bentuk: string; tanggal: string; agenda: string };
  akta?: { nomor: string; tanggal: string; notaris: string; berkas: string };
  sah?: { bentuk: string; nomor: string; tanggal: string; berkas: string };
  tenggat?: { label: string; tanggal: string; sisaHari: number };
  ubah: Ubah[];
};

/* Hari ini pada peraga = 29 Juli 2026 (mengikuti tanggal demo Corplex). */
const PERISTIWA: Peristiwa[] = [
  {
    id: "p5", jenis: "Perubahan Alamat Kedudukan", status: "telat-akta", jalur: "persetujuan",
    dasar: { bentuk: "RUPS Luar Biasa", tanggal: "2 Jun 2026", agenda: "Pemindahan tempat kedudukan perseroan ke Kota Bandung" },
    tenggat: { label: "Batas penuangan ke akta notaris", tanggal: "2 Jul 2026", sisaHari: -27 },
    ubah: [{ hal: "Tempat kedudukan", dari: "Kota Cirebon", jadi: "Kota Bandung" }],
  },
  {
    id: "p4", jenis: "Perubahan Susunan Komisaris", status: "proses", jalur: "pemberitahuan",
    dasar: { bentuk: "RUPS Tahunan", tanggal: "8 Jul 2026", agenda: "Pengangkatan Komisaris Independen" },
    akta: { nomor: "14/2026", tanggal: "15 Jul 2026", notaris: "Andi Prasetyo, S.H., M.Kn.", berkas: "Akta_Perubahan_14_2026.pdf" },
    tenggat: { label: "Batas pemberitahuan ke Menkumham", tanggal: "14 Agu 2026", sisaHari: 16 },
    ubah: [{ hal: "Komisaris Independen", dari: "—", jadi: "Dewi Anggraini" }],
  },
  {
    id: "p6", jenis: "RUPS Tahunan — Laporan Keuangan 2024", tanggalBerlaku: "12 Mei 2025", status: "berlaku", jalur: "internal", historis: true,
    dasar: { bentuk: "RUPS Tahunan", tanggal: "12 Mei 2025", agenda: "Penerimaan laporan keuangan & pelunasan tanggung jawab (acquit et de charge) tahun buku 2024" },
    ubah: [{ hal: "Laporan keuangan tahun buku 2024", dari: "Belum diterima RUPS", jadi: "Diterima & disahkan" }],
  },
  {
    id: "p3", jenis: "Peningkatan Modal Dasar", tanggalBerlaku: "2 Okt 2023", status: "berlaku", jalur: "persetujuan", historis: true,
    dasar: { bentuk: "RUPS Luar Biasa", tanggal: "10 Sep 2023", agenda: "Peningkatan modal dasar untuk rencana ekspansi" },
    akta: { nomor: "41/2023", tanggal: "17 Sep 2023", notaris: "Ny. Siti Rahmawati, S.H., M.Kn.", berkas: "Akta_Perubahan_41_2023.pdf" },
    sah: { bentuk: "Keputusan Menteri", nomor: "AHU-0056789.AH.01.02.TAHUN 2023", tanggal: "2 Okt 2023", berkas: "SK_Menkumham_2023.pdf" },
    ubah: [
      { hal: "Modal dasar", dari: "Rp 5.000.000.000", jadi: "Rp 20.000.000.000" },
      { hal: "Modal ditempatkan & disetor", dari: "Rp 1.250.000.000", jadi: "Rp 5.000.000.000" },
    ],
  },
  {
    id: "p2", jenis: "Perubahan Susunan Direksi", tanggalBerlaku: "19 Feb 2021", status: "berlaku", jalur: "pemberitahuan", historis: true,
    dasar: { bentuk: "Keputusan Sirkuler Pemegang Saham", tanggal: "28 Jan 2021", agenda: "Pergantian Direktur Utama" },
    akta: { nomor: "9/2021", tanggal: "4 Feb 2021", notaris: "Andi Prasetyo, S.H., M.Kn.", berkas: "Akta_Perubahan_9_2021.pdf" },
    sah: { bentuk: "Surat Penerimaan Pemberitahuan", nomor: "AHU-AH.01.03-0089123", tanggal: "19 Feb 2021", berkas: "Surat_Penerimaan_2021.pdf" },
    ubah: [{ hal: "Direktur Utama", dari: "Hendra Wijaya", jadi: "Budi Santoso" }],
  },
  {
    id: "p1", jenis: "Pendirian Perseroan", tanggalBerlaku: "28 Mar 2019", status: "berlaku", jalur: "persetujuan", historis: true,
    dasar: { bentuk: "Akta Pendirian", tanggal: "12 Mar 2019", agenda: "Pendirian PT Uji Coba Sejahtera" },
    akta: { nomor: "27/2019", tanggal: "12 Mar 2019", notaris: "Ny. Siti Rahmawati, S.H., M.Kn.", berkas: "Akta_Pendirian_27_2019.pdf" },
    sah: { bentuk: "Keputusan Menteri (pengesahan badan hukum)", nomor: "AHU-0012345.AH.01.01.TAHUN 2019", tanggal: "28 Mar 2019", berkas: "SK_Pengesahan_2019.pdf" },
    ubah: [{ hal: "Status badan hukum", dari: "—", jadi: "Sah sebagai Perseroan Terbatas" }],
  },
];

/* Keadaan organ terkini = hasil peristiwa yang SUDAH berlaku (bukan input terpisah). */
const ORGAN = {
  direksi: [["Budi Santoso", "Direktur Utama"], ["Rina Kartika", "Direktur"]],
  komisaris: [["Ahmad Fauzi", "Komisaris Utama"]],
  saham: [["PT Mitra Abadi Nusantara", "60%"], ["Budi Santoso", "40%"]],
  modal: [["Modal dasar", "Rp 20.000.000.000"], ["Ditempatkan & disetor", "Rp 5.000.000.000"]],
  perTanggal: "2 Okt 2023",
};

/* Pemeriksaan aspek korporasi — pengganti penilaian "hitung jumlah dokumen". */
const PERIKSA: { hal: string; ok: boolean; ket: string }[] = [
  { hal: "Akta pendirian & pengesahan badan hukum", ok: true, ket: "Akta 27/2019 · SK 28 Mar 2019" },
  { hal: "Setiap peristiwa dituangkan dalam akta", ok: false, ket: "1 keputusan RUPS belum diaktakan" },
  { hal: "Setiap akta memperoleh pengesahan", ok: false, ket: "Akta 14/2026 menunggu Surat Penerimaan" },
  { hal: "Tenggat 30 hari dipenuhi", ok: false, ket: "1 tenggat terlampaui 27 hari" },
  { hal: "Susunan organ sesuai pengesahan terakhir", ok: true, ket: "Sinkron per 2 Okt 2023" },
  /* RUPS bukan hanya pemicu perubahan — RUPS tahunan wajib digelar maks 6 bulan
   * setelah tutup buku (Pasal 78 UU PT), meski tak melahirkan akta apa pun. */
  { hal: "RUPS tahunan tahun berjalan", ok: false, ket: "Tahun buku 2025 — batas 30 Jun 2026 terlampaui, belum tercatat" },
];

const CHIP: Record<Status, { c: string; label: string }> = {
  berlaku: { c: "c-ver", label: "BERLAKU" },
  proses: { c: "c-draft", label: "DALAM PROSES" },
  "telat-akta": { c: "c-red", label: "TERLAMBAT AKTA" },
  "telat-lapor": { c: "c-red", label: "TERLAMBAT LAPOR" },
};
const FILTER = ["Semua", "Berlaku", "Dalam proses", "Perlu tindakan"];

/* Jenis peristiwa → jalur wajib (Pasal 21 UU PT). Dipakai form agar admin tak perlu hafal. */
const JENIS: { nama: string; jalur: Jalur }[] = [
  { nama: "Perubahan Nama Perseroan", jalur: "persetujuan" },
  { nama: "Perubahan Alamat Kedudukan", jalur: "persetujuan" },
  { nama: "Perubahan Maksud & Tujuan", jalur: "persetujuan" },
  { nama: "Peningkatan Modal Dasar", jalur: "persetujuan" },
  { nama: "Perubahan Susunan Direksi", jalur: "pemberitahuan" },
  { nama: "Perubahan Susunan Komisaris", jalur: "pemberitahuan" },
  { nama: "Perubahan Pemegang Saham", jalur: "pemberitahuan" },
  { nama: "RUPS Tahunan (penerimaan laporan keuangan)", jalur: "internal" },
];

export default function CorpsecBaru() {
  const [filter, setFilter] = useState("Semua");
  const [buka, setBuka] = useState<Peristiwa | null>(null);
  const [tambah, setTambah] = useState(false);
  const [jenisBaru, setJenisBaru] = useState(JENIS[4].nama);
  const [historisBaru, setHistorisBaru] = useState(false);

  const rows = useMemo(() => PERISTIWA.filter((p) =>
    filter === "Semua" ? true
      : filter === "Berlaku" ? p.status === "berlaku"
        : filter === "Dalam proses" ? p.status === "proses"
          : p.status.startsWith("telat")), [filter]);

  const perluTindakan = PERISTIWA.filter((p) => p.status.startsWith("telat")).length;
  const dalamProses = PERISTIWA.filter((p) => p.status === "proses").length;
  const jalurBaru = JENIS.find((j) => j.nama === jenisBaru)?.jalur || "pemberitahuan";

  return (
    <div>
      <style>{`
        /* Rel riwayat — satu tulang punggung vertikal, memakai warna sistem. */
        .cs-rail{position:relative;padding-left:26px}
        .cs-rail::before{content:"";position:absolute;left:7px;top:6px;bottom:6px;width:2px;
          background:linear-gradient(180deg,var(--gold-deep),rgba(28,48,84,.9))}
        .cs-node{position:relative;margin-bottom:10px}
        .cs-node::before{content:"";position:absolute;left:-23px;top:18px;width:12px;height:12px;border-radius:50%;
          background:var(--bg-1);border:2px solid var(--line2)}
        .cs-node.ok::before{border-color:var(--ok)}
        .cs-node.warn::before{border-color:var(--warn)}
        .cs-node.bad::before{border-color:var(--danger)}
        /* Rantai tahap: Keputusan → Akta → Pengesahan */
        .cs-chain{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:7px}
        .cs-step{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:9.5px;
          letter-spacing:.06em;padding:3px 9px;border-radius:7px;border:1px solid var(--line);color:var(--muted)}
        .cs-step.done{border-color:var(--ok-line);color:var(--ok);background:var(--ok-bg)}
        .cs-step.now{border-color:var(--warn-line);color:var(--warn);background:var(--warn-bg)}
        .cs-step.miss{border-color:var(--danger-line);color:var(--danger);background:var(--danger-bg)}
        .cs-sep{color:var(--line2);font-size:11px}
        /* Ikhtisar: fakta besar bergaya serif, sejalan dengan KPI Ringkasan */
        .cs-fakta b{font-family:var(--serif);font-size:22px;color:#fff;display:block;line-height:1.2}
        .cs-fakta span{font-size:11px;color:var(--muted)}
        .cs-delta{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;
          background:rgba(16,33,61,.55);border:1px solid rgba(28,48,84,.8);border-radius:11px;padding:11px 14px}
        @media(max-width:640px){.cs-delta{grid-template-columns:1fr}}
      `}</style>

      <ViewHead h1="Sekretaris Perusahaan"
        sub="Riwayat hukum badan usaha — pendirian, setiap perubahan, dan pengesahannya, dalam satu alur."
        acts={<button className="btn btn-gold" onClick={() => setTambah(true)}><Plus size={14} /> Catat Peristiwa</button>} />

      {/* ── LAPIS 1 · Ikhtisar: PENYIMPANGAN DULU, identitas belakangan ─────────────────
        * Layar pantau menjawab "ada masalah tidak hari ini?" sebelum hal lain — alarm di
        * puncak, fakta statis (tanggal berdiri) di ekor. Maks 2 peringatan tetap dijaga. */}
      <Panel className="mb16">
        {perluTindakan > 0 && (
          <div className="flag" style={{ marginTop: 0 }}>
            <b>Keputusan RUPS 2 Juni 2026 belum dituangkan ke akta notaris</b>
            <span>Batas 30 hari terlampaui 27 hari. Perubahan alamat kedudukan belum sah dan tak dapat lagi diajukan ke Menkumham tanpa RUPS ulang.</span>
          </div>
        )}
        {dalamProses > 0 && (
          <div className="flag w" style={{ marginTop: 0 }}>
            <b>Akta 14/2026 menunggu pemberitahuan ke Menkumham</b>
            <span>Sisa 16 hari dari batas 30 hari sejak tanggal akta (14 Agustus 2026).</span>
          </div>
        )}
        <div className="grid g4" style={{ gap: 14 }}>
          <div className="cs-fakta">
            <b style={{ color: perluTindakan ? "var(--danger)" : "var(--ok)" }}>{perluTindakan || "—"}</b>
            <span>{perluTindakan ? "Perlu tindakan segera" : "Tak ada tenggat terlampaui"}</span>
          </div>
          <div className="cs-fakta"><b>{dalamProses}</b><span>Dalam proses pengesahan</span></div>
          <div className="cs-fakta"><b>2 Okt 2023</b><span>Perubahan berlaku terakhir</span></div>
          <div className="cs-fakta"><b>12 Mar 2019</b><span>Berdiri · Akta 27/2019</span></div>
        </div>
      </Panel>

      <div className="grid g-wide">
        {/* ── LAPIS 2 · Riwayat hukum: satu garis waktu, bukan enam kotak ──────────── */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title={<>Riwayat Hukum Perusahaan <Chip c="c-mon">{PERISTIWA.length} PERISTIWA</Chip></>}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {FILTER.map((f) => (
                <button key={f} className={`fchip${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>

            <div className="cs-rail">
              {rows.map((p) => {
                const nada = p.status === "berlaku" ? "ok" : p.status === "proses" ? "warn" : "bad";
                return (
                  <div key={p.id} className={`cs-node ${nada}`}>
                    <div className="row clickable" style={{ alignItems: "flex-start" }} onClick={() => setBuka(p)}>
                      <div style={{ minWidth: 0 }}>
                        <b>{p.jenis}</b>
                        <span className="d">
                          {p.tanggalBerlaku ? `Berlaku ${p.tanggalBerlaku}` : `${p.dasar.bentuk} ${p.dasar.tanggal}`}
                          {" · "}{p.jalur === "internal" ? "tanpa kewajiban lapor" : `jalur ${p.jalur}`}
                        </span>
                        <div className="cs-chain">
                          <span className="cs-step done">{p.dasar.bentuk.startsWith("Akta") ? "AKTA PENDIRIAN" : "KEPUTUSAN"}</span>
                          {p.jalur === "internal" ? (
                            <span className="cs-step" style={{ borderStyle: "dashed" }}>TANPA KEWAJIBAN AKTA</span>
                          ) : (<>
                            <span className="cs-sep">›</span>
                            <span className={`cs-step ${p.akta ? "done" : p.status === "telat-akta" ? "miss" : "now"}`}>AKTA</span>
                            <span className="cs-sep">›</span>
                            <span className={`cs-step ${p.sah ? "done" : p.akta ? "now" : ""}`}>PENGESAHAN</span>
                          </>)}
                        </div>
                      </div>
                      <div className="right" style={{ flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <Chip c={CHIP[p.status].c}>{CHIP[p.status].label}</Chip>
                        {p.tenggat && (
                          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: p.tenggat.sisaHari < 0 ? "var(--danger)" : "var(--warn)" }}>
                            {p.tenggat.sisaHari < 0 ? `LEWAT ${Math.abs(p.tenggat.sisaHari)} HARI` : `SISA ${p.tenggat.sisaHari} HARI`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!rows.length && <p className="note" style={{ margin: 0 }}>Tidak ada peristiwa pada tapis ini.</p>}
            </div>
            <p className="note mt16">Klik satu baris untuk melihat dasar keputusan, akta, pengesahan, dan rincian apa yang berubah.</p>
          </Panel>
        </div>

        {/* ── Panel pendamping: keadaan sekarang + kesiapan uji tuntas ─────────────── */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title={<><Users size={12} /> Keadaan Terkini</>}>
            <div className="rows">
              {ORGAN.direksi.map(([n, j]) => <Row key={n} b={n} d={j} right={<Chip c="c-mon">DIREKSI</Chip>} />)}
              {ORGAN.komisaris.map(([n, j]) => <Row key={n} b={n} d={j} right={<Chip c="c-mon">KOMISARIS</Chip>} />)}
              {ORGAN.saham.map(([n, p]) => <Row key={n} b={n} d="Pemegang saham" right={<b style={{ color: "var(--ink)" }}>{p}</b>} />)}
              {ORGAN.modal.map(([n, v]) => <Row key={n} b={n} right={<b style={{ color: "var(--ink)" }}>{v}</b>} />)}
            </div>
            <p className="note mt16">
              Berdasarkan pengesahan terakhir <b>{ORGAN.perTanggal}</b>. Perubahan komisaris 15 Jul 2026 <b>belum berlaku</b> — menunggu Surat Penerimaan Menkumham.
            </p>
          </Panel>

          <Panel title={<><ScrollText size={12} /> Aspek Korporasi — Kesiapan Uji Tuntas</>}>
            <div className="rows">
              {PERIKSA.map((x) => (
                <Row key={x.hal} b={x.hal} d={x.ket}
                  right={<Chip c={x.ok ? "c-ver" : "c-red"}>{x.ok ? "TERPENUHI" : "TEMUAN"}</Chip>} />
              ))}
            </div>
            <p className="note mt16">Aspek pertama Laporan Uji Tuntas Hukum mengambil datanya dari halaman ini — bukan dari jumlah berkas yang diunggah.</p>
          </Panel>
        </div>
      </div>

      {/* ── LAPIS 3 · Detail satu peristiwa: tiga tahap berurut + apa yang berubah ─── */}
      <Modal right open={!!buka} title={buka?.jenis || ""} onClose={() => setBuka(null)}
        footer={<>
          <button className="btn btn-line" onClick={() => setBuka(null)}>Tutup</button>
          {buka && buka.jalur !== "internal" && !buka.akta && <button className="btn btn-gold"><FileText size={12} /> Unggah Akta</button>}
          {buka && buka.jalur !== "internal" && buka.akta && !buka.sah && <button className="btn btn-gold"><Landmark size={12} /> Unggah Pengesahan</button>}
        </>}>
        {buka && <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <Chip c={CHIP[buka.status].c}>{CHIP[buka.status].label}</Chip>
            <Chip c="c-mon">{buka.jalur === "internal" ? "TANPA KEWAJIBAN LAPOR" : `JALUR ${buka.jalur.toUpperCase()}`}</Chip>
            {buka.historis && <Chip c="c-mon">RIWAYAT — TANPA ALARM</Chip>}
          </div>

          <Field label="1 · Dasar keputusan">
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div><b>{buka.dasar.bentuk} — {buka.dasar.tanggal}</b><span className="d">{buka.dasar.agenda}</span></div>
              <Chip c="c-ver"><Check size={9} /></Chip>
            </div>
          </Field>

          {buka.jalur === "internal" ? (
            <Field label="2 · Kewajiban lanjutan">
              <p className="note" style={{ margin: 0 }}>
                Jenis peristiwa ini selesai pada tahap keputusan — tidak menimbulkan kewajiban akta
                maupun pelaporan ke Menkumham. Dicatat sebagai bukti kepatuhan RUPS tahunan (Pasal 78 UU PT).
              </p>
            </Field>
          ) : (<>
          <Field label="2 · Akta notaris">
            {buka.akta ? (
              <div className="row" style={{ alignItems: "flex-start" }}>
                <div><b>Akta No. {buka.akta.nomor} — {buka.akta.tanggal}</b>
                  <span className="d">{buka.akta.notaris} · {buka.akta.berkas}</span></div>
                <button className="btn-act">Buka</button>
              </div>
            ) : (
              <div className="flag" style={{ marginBottom: 0 }}>
                <b>Belum ada akta</b>
                <span>{buka.tenggat?.label} — {buka.tenggat?.tanggal}{buka.tenggat && buka.tenggat.sisaHari < 0 ? ` (lewat ${Math.abs(buka.tenggat.sisaHari)} hari)` : ""}</span>
              </div>
            )}
          </Field>

          <Field label="3 · Pengesahan Menkumham">
            {buka.sah ? (
              <div className="row" style={{ alignItems: "flex-start" }}>
                <div><b>{buka.sah.bentuk}</b><span className="d">{buka.sah.nomor} · {buka.sah.tanggal} · {buka.sah.berkas}</span></div>
                <button className="btn-act">Buka</button>
              </div>
            ) : (
              <div className={`flag ${buka.akta ? "w" : ""}`} style={{ marginBottom: 0 }}>
                <b>{buka.akta ? "Menunggu pengesahan" : "Belum dapat diajukan"}</b>
                <span>{buka.akta
                  ? `Jalur ${buka.jalur} · batas ${buka.tenggat?.tanggal}`
                  : "Akta notaris harus terbit lebih dahulu sebelum diajukan ke Menkumham."}</span>
              </div>
            )}
          </Field>
          </>)}

          <Field label="Yang berubah">
            <div style={{ display: "grid", gap: 9 }}>
              {buka.ubah.map((u) => (
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
        </>}
      </Modal>

      {/* ── Catat peristiwa: jalur & tenggat ditentukan sistem, bukan dihafal admin ── */}
      <Modal right open={tambah} title="Catat Peristiwa Korporasi" onClose={() => setTambah(false)}
        footer={<>
          <button className="btn btn-line" onClick={() => setTambah(false)}>Batal</button>
          <button className="btn btn-gold" onClick={() => setTambah(false)}>Simpan Peristiwa</button>
        </>}>
        {/* Pilihan pertama & paling menentukan: riwayat lama TIDAK boleh melahirkan alarm. */}
        <Field label="Peristiwa ini *">
          <div style={{ display: "grid", gap: 8 }}>
            {([["Sedang berjalan", "dipantau — dua tenggat 30 hari dipasang otomatis", false],
               ["Riwayat lama", "sudah selesai di masa lalu — dicatat tanpa alarm keterlambatan", true]] as const).map(([b, d, v]) => (
              <label key={b} className="row clickable" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="radio" name="cs-mode" checked={historisBaru === v} onChange={() => setHistorisBaru(v)} style={{ marginTop: 3 }} />
                <div><b>{b}</b><span className="d">{d}</span></div>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Jenis peristiwa *">
          <select value={jenisBaru} onChange={(e) => setJenisBaru(e.target.value)}>
            {JENIS.map((j) => <option key={j.nama}>{j.nama}</option>)}
          </select>
        </Field>
        <Field label="Dasar keputusan *">
          <select defaultValue="RUPS Tahunan"><option>RUPS Tahunan</option><option>RUPS Luar Biasa</option><option>Keputusan Sirkuler Pemegang Saham</option></select>
        </Field>
        <Field label="Tanggal keputusan *"><input type="date" defaultValue="2026-07-29" /></Field>
        <Field label="Agenda / ringkasan keputusan"><textarea rows={3} placeholder="mis. Pengangkatan Direktur Keuangan menggantikan pejabat lama" /></Field>

        <div className="panel" style={{ marginTop: 4, background: "rgba(37,29,14,.35)", borderColor: "var(--warn-line)" }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <AlertTriangle size={15} style={{ color: "var(--warn)", flex: "0 0 auto", marginTop: 2 }} />
            <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--txt2)" }}>
              {jalurBaru === "internal" ? (<>
                Jenis ini <b style={{ color: "var(--warn)" }}>selesai pada tahap keputusan</b> — tanpa kewajiban akta
                maupun pelaporan ke Menkumham. Dicatat sebagai bukti kepatuhan RUPS tahunan
                (wajib digelar maks 6 bulan setelah tutup buku, Pasal 78 UU PT).
              </>) : (<>
                Sistem menetapkan jalur <b style={{ color: "var(--warn)" }}>{jalurBaru}</b> untuk jenis ini
                {jalurBaru === "persetujuan"
                  ? " — wajib memperoleh Keputusan Menteri sebelum berlaku."
                  : " — cukup Surat Penerimaan Pemberitahuan."}
                <br />
                {historisBaru
                  ? <>Riwayat lama: <b>tenggat & alarm tidak diberlakukan</b> — lengkapi akta dan pengesahannya dari halaman detail; status dihitung dari kelengkapan rantai.</>
                  : <>Dua tenggat otomatis dipasang: <b>akta paling lambat 30 hari</b> sejak keputusan, dan <b>pengajuan ke Menkumham 30 hari</b> sejak tanggal akta.</>}
              </>)}
            </div>
          </div>
        </div>
        <p className="note mt16">Akta dan pengesahan diunggah menyusul dari halaman detail peristiwa — satu berkas pada tahapnya masing-masing, bukan ditumpuk di satu daftar.</p>
      </Modal>

      <p className="note mt16" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Building2 size={13} style={{ color: "var(--gold-deep)" }} />
        <span><b>Prototipe</b> — seluruh angka di halaman ini data peraga untuk menilai arah rancangan. Belum tersambung ke database.</span>
      </p>
    </div>
  );
}
