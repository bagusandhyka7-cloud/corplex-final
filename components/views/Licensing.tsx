"use client";
import React, { useState } from "react";
import { Plus } from "lucide-react";
import { clone, useStore } from "@/lib/store";
import { Chip, Kpi, Panel, Row, Timeline, ViewHead } from "@/components/ui";

export default function Licensing() {
  const { ten, toast } = useStore();
  const t = ten!;
  const [f, setF] = useState("semua");
  const [lic, setLic] = useState(() => clone(t.lic));
  const [kwj, setKwj] = useState([
    { b: "LKPM Triwulan III 2026", d: "OSS · tenggat maju otomatis setelah dilaporkan", chip: "c-draft", lbl: "48 HARI", next: "LKPM Triwulan IV — 138 hari", can: true, done: false },
    { b: "Laporan berkala UKL-UPL Semester II", d: "Persetujuan Lingkungan", chip: "c-mon", lbl: "TERJADWAL", next: "Semester I 2027 — terjadwal", can: true, done: false },
    { b: "Pembaruan data OSS pasca perubahan pengurus", d: "Dipicu event corpsec.pengurus_berubah", chip: "c-mon", lbl: "TERJADWAL", next: "", can: false, done: false },
  ]);
  const [track, setTrack] = useState([
    ["1 JUL 2026", "Permohonan diajukan", "Berkas lengkap diunggah melalui OSS", "done"],
    ["6 JUL 2026", "Verifikasi administratif lolos", "Tidak ada kekurangan berkas", "done"],
    ["MENUNGGU", "Evaluasi teknis BPOM", "Estimasi 15 hari kerja", "next"],
    ["—", "Penerbitan izin edar", "Otomatis tercatat ke rekam perizinan", ""],
  ]);

  const advanceTrack = () => {
    const i = track.findIndex((x) => x[3] === "next");
    if (i < 0) { toast("Tracking", "Seluruh tahap selesai — izin terbit tercatat ke rekam.", "ok"); return; }
    setTrack((tr) => {
      const n = clone(tr);
      n[i] = ["13 JUL 2026", n[i][1], n[i][2], "done"];
      if (n[i + 1]) n[i + 1][3] = "next";
      return n;
    });
    toast("Tahap maju", "Evaluasi teknis BPOM selesai → menunggu penerbitan izin edar. Notifikasi terkirim.", "ok");
  };

  const startRenewal = (i: number) => {
    setLic((ls) => {
      const n = clone(ls);
      n[i][7] = "PENGURUSAN"; n[i][8] = "c-mon"; n[i][9] = "PENGURUSAN"; n[i][10] = "track";
      return n;
    });
    toast("Pengurusan perpanjangan dimulai", "Record pengurusan dibuat — tahapan + stempel waktu; entri rekam ditulis otomatis.", "ok");
  };

  const laporKwj = (i: number) => {
    setKwj((ks) => {
      const n = [...ks];
      n[i] = { ...n[i], done: true, chip: "c-ver", lbl: "DILAPORKAN", d: "Bukti tersimpan ke vault · tenggat berikutnya: " + n[i].next, can: false };
      return n;
    });
    toast("Kewajiban dilaporkan", "Tenggat_berikut maju otomatis — bukti pelaporan tertaut ke rekam perizinan.", "ok");
  };

  return (
    <div>
      <ViewHead en="Modul 4.4 · Regulatory & Licensing Compliance System · Layer 2" h1="Licensing Management"
        sub="Registrasi cerdas (AI membaca dokumen izin), mesin status masa berlaku harian, kalender kewajiban pasca-izin, tracking pengurusan OSS."
        acts={<button className="btn btn-navy" onClick={() => toast("Registrasi cerdas", "Unggah dokumen izin → AI mengekstrak nomor, jenis, KBLI, masa berlaku → konfirmasi → aturan JAGA otomatis dibuat.")}><Plus size={14} /> Daftarkan Izin (AI Ekstraksi)</button>} />

      <div className="grid g4 mb16">
        <Kpi v={t.kpiIzin} label="Izin aktif dipantau" />
        <Kpi v={lic.filter((r) => r[7] === "SEGERA").length} label="Mendekati tenggat" tr="Reminder bertahap aktif" trCls="dn" />
        <Kpi v={lic.filter((r) => r[7] === "PENGURUSAN").length} label="Dalam pengurusan" tr="Tracking OSS" />
        <Kpi v={kwj.length} label="Kewajiban pasca-izin" tr="LKPM & laporan berkala" />
      </div>

      <div className="filters">
        {["semua", "AKTIF", "SEGERA", "PENGURUSAN"].map((x) => (
          <button key={x} className={`fchip${f === x ? " on" : ""}`} onClick={() => setF(x)}>
            {x === "semua" ? "Semua" : x === "AKTIF" ? "Aktif" : x === "SEGERA" ? "Segera berakhir" : "Pengurusan"}
          </button>
        ))}
      </div>
      <div className="tblwrap">
        <table>
          <thead><tr><th>Perizinan</th><th>Entitas / Lokasi</th><th>KBLI</th><th>Masa Berlaku</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {lic.map((r, i) => (f === "semua" || r[7] === f) ? (
              <tr key={i}>
                <td><b>{r[0]}</b><span className="sub">{r[1]}</span></td>
                <td>{r[2]}</td>
                <td>{r[3]}</td>
                <td>{r[4] ? <div className="bar"><i className={String(r[4])} style={{ width: `${r[5]}%` }} /></div> : null}<span className="sub">{r[6]}</span></td>
                <td><Chip c={String(r[8])}>{r[9]}</Chip></td>
                <td>
                  {r[10] === "renew" ? <button className="btn btn-gold btn-sm" onClick={() => startRenewal(i)}>Perpanjang</button>
                    : r[10] === "track" ? <button className="btn btn-line btn-sm" onClick={advanceTrack}>Lacak</button>
                      : <button className="btn btn-line btn-sm" onClick={() => toast("Detail izin", "Riwayat, dokumen tertaut, dan kewajiban turunannya.")}>Detail</button>}
                </td>
              </tr>
            ) : null)}
          </tbody>
        </table>
      </div>

      <div className="grid g2 mt16">
        <Panel title="Kewajiban Pasca-Perizinan — Kalender">
          <div className="rows">
            {kwj.map((k, i) => (
              <Row key={i} b={k.b} d={k.d} right={<>
                <Chip c={k.chip}>{k.lbl}</Chip>
                {k.can ? <button className="btn btn-line btn-sm" onClick={() => laporKwj(i)}>Lapor + Bukti</button> : null}
              </>} />
            ))}
          </div>
        </Panel>
        <Panel title="Tracking Pengurusan — Izin Edar BPOM MD">
          <Timeline items={track} />
        </Panel>
      </div>
    </div>
  );
}
