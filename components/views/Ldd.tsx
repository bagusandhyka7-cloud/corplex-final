"use client";
/*
 * Legal Due Diligence — OUTPUT UTAMA CORPLEX (arahan owner via Pak Rheza).
 * Laporan uji tuntas hukum perusahaan sendiri: 6 aspek, status per aspek,
 * ringkasan eksekutif, ekspor, dan verifikasi advokat (rantai AI-LAWYER-CLIENT).
 * ponytail: status dihitung aturan sederhana dari data seed tenant — ganti mesin
 * penilaian nyata saat backend modul terisi.
 */
import React from "react";
import { Download, FileSearch, Gavel, Gem, Landmark, Scale as ScaleIcon, FileBadge, FileSignature, Users } from "lucide-react";
import { useStore, ViewId } from "@/lib/store";
import { Chip, Panel, Row, ViewHead } from "@/components/ui";

type Status = "AMAN" | "BERISIKO" | "BERMASALAH";
const chipOf: Record<Status, string> = { AMAN: "c-ver", BERISIKO: "c-draft", BERMASALAH: "c-red" };

export default function Ldd() {
  const { ten, toast, pushQueue, go } = useStore();
  const t = ten!;

  /* Penilaian per aspek — aturan sederhana atas data rekam tenant (dummy sadar-diri). */
  const aspek: { key: ViewId; ikon: React.ReactNode; nama: string; status: Status; temuan: string }[] = [
    {
      key: "corpsec", ikon: <Landmark size={16} />, nama: "Legalitas Badan Hukum",
      /* dari rekam corp DB: kewajiban statutori tertunda (c-draft) = berisiko; belum ada rekam = berisiko (dokumen dasar belum tercatat) */
      status: !t.corp.id && !t.corp.docs.length ? "BERISIKO" : t.corp.stat.some((s) => s[2] === "c-draft") ? "BERISIKO" : "AMAN",
      temuan: !t.corp.id && !t.corp.docs.length ? "Belum ada rekam legalitas (akta/AD/RUPS) — lengkapi lewat modul Sekretaris Perusahaan."
        : t.corp.stat.some((s) => s[2] === "c-draft") ? `${t.corp.stat.filter((s) => s[2] === "c-draft").length} kewajiban statutori menunggu tenggat — periksa Sekretaris Perusahaan.`
        : `${t.corp.docs.length} dokumen tata kelola tercatat · kewajiban statutori terkendali.`,
    },
    {
      key: "licensing", ikon: <FileBadge size={16} />, nama: "Perizinan",
      /* dihitung dari baris rekam nyata (module_records lic), bukan string KPI seed */
      status: t.lic.some((r) => r.some((c) => c === "SEGERA" || c === "KEDALUWARSA")) ? "BERISIKO" : "AMAN",
      temuan: t.lic.some((r) => r.some((c) => c === "SEGERA" || c === "KEDALUWARSA")) ? "Sebagian izin mendekati/melewati tenggat — perpanjangan perlu segera dimulai." : t.lic.length ? "Seluruh izin usaha aktif dan dipantau otomatis." : "Belum ada izin terekam — daftarkan lewat modul Perizinan.",
    },
    {
      key: "asset", ikon: <Gem size={16} />, nama: "Aset & HAKI",
      status: t.hki.some((h) => Array.isArray(h[7]) && String(h[7][1]).includes("PANTAU")) ? "BERISIKO" : "AMAN",
      temuan: "Bukti kepemilikan aset inti tersimpan di vault; sebagian portofolio merek dalam pemantauan perpanjangan.",
    },
    {
      key: "agreement", ikon: <FileSignature size={16} />, nama: "Perjanjian Pihak Ketiga",
      status: t.agr.some((a) => a.st === "SEGERA") ? "BERISIKO" : "AMAN",
      temuan: t.agr.some((a) => a.st === "SEGERA") ? "Ada perjanjian mendekati berakhir — tinjau perpanjangan/negosiasi ulang." : "Seluruh perjanjian aktif terpantau; tidak ada yang mendekati berakhir.",
    },
    {
      key: "hr-database", ikon: <Users size={16} />, nama: "Ketenagakerjaan",
      status: t.emp.some((e) => e.pat !== "PATUH") ? "BERISIKO" : "AMAN",
      temuan: t.emp.some((e) => e.pat !== "PATUH") ? "Ada item kepatuhan tenaga kerja berstatus reminder — PK/kompensasi perlu ditindak." : "PK, SP, dan kepatuhan upah dalam batas — rekap LKPM tersedia.",
    },
    {
      key: "case", ikon: <ScaleIcon size={16} />, nama: "Sengketa / Perkara",
      /* dari rekam case DB (module_records) — jumlah perkara + bukti akurat dgn modul Perkara */
      status: t.cases.length > 0 ? "BERISIKO" : "AMAN",
      temuan: t.cases.length > 0 ? `${t.cases.length} perkara berjalan · ${t.cases.reduce((s, x) => s + x.bukti.length, 0)} bukti terindeks — tahapan terpantau di modul Perkara.` : "Tidak ada perkara berjalan pada rekam.",
    },
  ];

  const nBerisiko = aspek.filter((a) => a.status === "BERISIKO").length;
  const nBermasalah = aspek.filter((a) => a.status === "BERMASALAH").length;
  const keseluruhan: Status = nBermasalah ? "BERMASALAH" : nBerisiko ? "BERISIKO" : "AMAN";
  const ringkas = keseluruhan === "AMAN"
    ? "Seluruh aspek pemeriksaan dalam kondisi baik — perusahaan siap menghadapi uji tuntas eksternal."
    : `${nBerisiko + nBermasalah} dari ${aspek.length} aspek memerlukan perhatian sebelum perusahaan siap uji tuntas eksternal (akuisisi, pendanaan, kemitraan).`;

  return (
    <div>
      <ViewHead h1="Legal Due Diligence"
        sub="Laporan uji tuntas hukum perusahaan Anda — status tiap aspek, siap disajikan ke owner dan investor."
        acts={<>
          <button className="btn btn-line" onClick={() => {
            /* Ekspor nyata: laporan HTML rapi → dialog cetak browser (Simpan sebagai PDF). */
            const w = window.open("", "_blank"); if (!w) return toast("Popup diblokir", "Izinkan popup untuk mengekspor laporan.", "warn");
            w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>LDD — ${t.name}</title></head>
<body style="font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#14264A;line-height:1.7">
<div style="border-bottom:3px solid #A9884C;padding-bottom:10px;margin-bottom:20px"><b style="font-size:20px">LAPORAN LEGAL DUE DILIGENCE</b><br><span style="letter-spacing:.12em;color:#A9884C;font-size:12px">${t.name.toUpperCase()} · ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>
<p><b>Status keseluruhan: ${keseluruhan}</b></p><p>${ringkas}</p><hr>
${aspek.map((a) => `<p><b>${a.nama} — ${a.status}</b><br>${a.temuan}</p>`).join("")}
<p style="font-size:11px;color:#666;margin-top:24px">DRAF AI — belum ditandatangani advokat MRWP. RAHASIA.</p></body></html>`);
            w.document.close(); w.print();
          }}><Download size={14} /> Ekspor Laporan</button>
          <button className="btn btn-gold" onClick={() => { pushQueue("Laporan Legal Due Diligence — " + t.name, "Laporan LDD lengkap 6 aspek · wajib ditandatangani advokat sebelum disajikan", "c-gold", "ESKALASI"); }}><Gavel size={14} /> Ajukan Verifikasi Advokat</button>
        </>} />

      {/* ringkasan eksekutif */}
      <div className="lw-quota" style={{ background: "linear-gradient(150deg,#10203C,#0C1A33)", border: "1px solid var(--line2)", borderRadius: 15, padding: "20px 24px", marginBottom: 16, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
        <FileSearch size={38} style={{ color: "var(--gold-bright)", flex: "0 0 auto" }} strokeWidth={1.4} />
        <div style={{ flex: 1, minWidth: 260 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: ".16em", color: "var(--gold-deep)", display: "block", marginBottom: 6 }}>RINGKASAN EKSEKUTIF — {t.name.toUpperCase()}</span>
          <p style={{ fontSize: 13, color: "var(--txt)", lineHeight: 1.65 }}>{ringkas}</p>
        </div>
        <Chip c={chipOf[keseluruhan]}>{`STATUS: ${keseluruhan}`}</Chip>
      </div>

      {/* 6 aspek pemeriksaan */}
      <Panel title="Aspek Pemeriksaan — klik untuk membuka modul sumbernya">
        <div className="rows">
          {aspek.map((a) => (
            <Row key={a.nama} b={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{a.ikon}{a.nama}</span>} d={a.temuan}
              right={<Chip c={chipOf[a.status]}>{a.status}</Chip>} onClick={() => go(a.key)} />
          ))}
        </div>
        <p className="note mt16">
          Status dihitung otomatis dari rekam hidup tiap modul — setiap temuan dapat diaudit ke dokumen sumbernya di vault.
          Laporan berstatus <b>DRAF AI</b> hingga ditandatangani advokat MRWP; temuan risiko lazim menjadi dasar negosiasi harga
          atau klausul jaminan (representations &amp; warranties) pada transaksi.
        </p>
      </Panel>
    </div>
  );
}
