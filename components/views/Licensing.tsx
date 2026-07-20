"use client";
import React, { useEffect, useState } from "react";
import { Lock, Plus } from "lucide-react";
import { clone, useStore } from "@/lib/store";
import { Chip, Kpi, Panel, Row, Timeline } from "@/components/ui";
import { ModuleShell } from "@/components/ModuleShell";
import { RecActions, RecordModal } from "@/components/RecordModal";
import { idOf, RecRow } from "@/lib/records";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function Licensing() {
  const { ten, toast, patchTen } = useStore();
  const t = ten!;
  const router = useRouter();
  const [f, setF] = useState("semua");
  const [q, setQ] = useState("");
  const [lic, setLic] = useState(() => clone(t.lic));
  useEffect(() => setLic(clone(t.lic)), [t.lic]); // hidrasi DB menyusul mount
  const [mOpen, setMOpen] = useState(false);
  const [mEdit, setMEdit] = useState<RecRow | null>(null);
  const onDone = (row: RecRow, editId: string | null) =>
    patchTen({ lic: (editId ? t.lic.map((x) => idOf("lic", x) === editId ? row : x) : [row, ...t.lic]) as typeof t.lic });

  /* Dropzone: dokumen izin diunggah ke Storage, rekam dibuat dgn dok_url tertaut. */
  const dropDok = async (file: File) => {
    const tid = localStorage.getItem("corplex_tid") || "";
    const up = await api.records.uploadDoc(tid, file);
    if (!up.ok) return toast("Gagal mengunggah", up.error.message, "warn");
    const nama = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    const data = [nama, "Hasil ekstraksi dokumen", t.name, "", "", 0, "", "AKTIF", "c-ver", "AKTIF", "detail"];
    const r = await api.records.create(tid, "lic", data, "ai", up.data);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    patchTen({ lic: [[...data.slice(0, 11), r.data.id] as unknown as typeof t.lic[number], ...t.lic] as typeof t.lic });
  };
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

  const rows = lic.filter((r) => (f === "semua" || r[7] === f) && (r[0] + " " + r[1] + " " + r[2]).toString().toLowerCase().includes(q.toLowerCase()));

  return (
    <ModuleShell h1="Perizinan" sub="Semua izin usaha di satu tempat — masa berlaku diingatkan otomatis."
      acts={<button className="btn btn-gold" onClick={() => { setMEdit(null); setMOpen(true); }}><Plus size={14} /> Daftarkan Izin</button>}
      dropNote="PDF · Word · pindaian (OCR) — AI mengekstrak nomor izin, jenis, KBLI, dan masa berlaku; dokumen asli tersimpan di vault."
      onDrop={(f2) => void dropDok(f2)}
      filters={["semua", "AKTIF", "SEGERA", "PENGURUSAN"]} active={f} onFilter={setF}
      q={q} setQ={setQ} cariPh="Cari izin / entitas / KBLI…">

      <div className="grid g4 mb16">
        <Kpi v={lic.length} label="Izin dalam rekam" />
        <Kpi v={lic.filter((r) => r[7] === "SEGERA").length} label="Mendekati tenggat" tr="Reminder bertahap aktif" trCls="dn" />
        <Kpi v={lic.filter((r) => r[7] === "PENGURUSAN").length} label="Dalam pengurusan" tr="Tracking OSS" />
        <Kpi v={kwj.length} label="Kewajiban pasca-izin" tr="LKPM & laporan berkala" />
      </div>

      <div className="tblwrap">
        <table>
          <thead><tr><th>Perizinan</th><th>Entitas / Lokasi</th><th>KBLI</th><th>Masa Berlaku</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><b>{r[0]}</b><span className="sub">{r[1]}</span></td>
                <td>{r[2]}</td>
                <td>{r[3]}</td>
                <td>{r[4] ? <div className="bar"><i className={String(r[4])} style={{ width: `${r[5]}%` }} /></div> : null}<span className="sub">{r[6]}</span></td>
                <td><Chip c={String(r[8])}>{r[9]}</Chip></td>
                <td>
                  <div className="flex items-center gap-2">
                    {idOf("lic", r as RecRow) && <button className="btn-act" onClick={() => router.push(`/rekam/lic/${idOf("lic", r as RecRow)}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button>}
                    {r[10] === "renew" ? <button className="btn-act" onClick={() => startRenewal(lic.indexOf(r))}>Perpanjang</button>
                      : r[10] === "track" ? <button className="btn-act" onClick={advanceTrack}>Lacak</button>
                        : null}
                    <RecActions mod="lic" row={r as RecRow} toast={toast} onEdit={(row) => { setMEdit(row); setMOpen(true); }}
                      onDeleted={(id) => patchTen({ lic: t.lic.filter((x) => idOf("lic", x) !== id) as typeof t.lic })} />
                  </div>
                </td>
              </tr>
            ))}
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

      <RecordModal mod="lic" open={mOpen} editRow={mEdit} tenantName={t.name} toast={toast} onClose={() => setMOpen(false)} onDone={onDone} />
    </ModuleShell>
  );
}
