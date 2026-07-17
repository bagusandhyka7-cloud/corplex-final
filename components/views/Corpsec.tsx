"use client";
import React, { useState } from "react";
import { Check, Plus } from "lucide-react";
import { clone, useStore } from "@/lib/store";
import { Chip, Field, Panel, Row, Timeline, ViewHead } from "@/components/ui";

export default function Corpsec() {
  const { ten, toast } = useStore();
  const t = ten!;
  const [dirs, setDirs] = useState(() => clone(t.corp.dirs));
  const c = t.corp;
  const done = dirs.filter((d) => d[2] === "ok").length;
  const allOk = done === dirs.length;

  const approve = () => {
    setDirs((ds) => ds.map((d) => [d[0], d[1], "ok", d[3] || "baru saja"]));
    toast("Keputusan sirkuler SAH", "Constraint 100% terpenuhi — dokumen masuk jalur verifikasi advokat lalu tercatat ke rekam tata kelola.", "ok");
  };

  return (
    <div>
      <ViewHead en="Modul 4.5 · Digital Corporate Governance Platform · Layer 2" h1="Corporate Secretary Management"
        sub="Mesin RUPS end-to-end dengan guard kuorum & tenggat undangan, keputusan sirkuler 100%, tenggat Menkumham otomatis, cap table time-travel."
        acts={<button className="btn btn-navy" onClick={() => toast("Jadwalkan rapat", "Generator undangan menghitung tenggat minimal dari AD/UU PT (parameterisasi per entitas).")}><Plus size={14} /> Jadwalkan Rapat</button>} />

      <div className="grid g-wide">
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title={<>{c.entity} · {c.rupsTitle} <Chip c="c-ver">SAH</Chip></>}>
            <Timeline items={c.rups} />
          </Panel>
          <Panel title={<>Keputusan Sirkuler {c.circNo} — Persetujuan Elektronik <Chip c={allOk ? "c-ver" : "c-draft"}>{allOk ? `SAH — ${done}/${dirs.length} (100%)` : `${done} / ${dirs.length} SETUJU`}</Chip></>}>
            <div className="rows">
              {dirs.map((d, i) => d[2] === "ok" ? (
                <Row key={i} b={`${d[0]} — ${d[1]}`} d={`Disetujui · hash ttd tercatat · ${d[3]}`} right={<Chip c="c-ver"><Check size={9} style={{ display: "inline" }} /></Chip>} />
              ) : (
                <Row key={i} b={`${d[0]} — ${d[1]}`} d="Menunggu persetujuan (constraint: sirkuler butuh 100%)"
                  right={<><Chip c="c-draft">MENUNGGU</Chip><button className="btn btn-navy btn-sm" onClick={approve}>Simulasikan Setuju</button></>} />
              ))}
            </div>
          </Panel>
          <Panel title={`Rapat Organ ${t.plan === "BASIC" ? "Badan Usaha" : "Perseroan"}`}>
            <div className="rows">
              {c.meetings.map((m, i) => <Row key={i} b={m[0]} d={m[1]} right={<Chip c="c-mon">TERJADWAL</Chip>} />)}
            </div>
          </Panel>
        </div>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title={`${t.plan === "BASIC" ? "Struktur Sekutu" : "Cap Table"} — Validasi Σ=100% ✓`}>
            <div className="rows">
              {c.cap.map((x, i) => <Row key={i} b={x[0]} d={x[1]} right={<b style={{ color: "var(--ink)" }}>{x[2]}</b>} />)}
            </div>
            <div className="field mt16">
              <label>Time-travel: lihat pada tanggal</label>
              <select onChange={() => toast("Snapshot dimuat", "Riwayat kepemilikan — setiap perubahan menunjuk dasar_dokumen (akta/keputusan).")}>
                <option>13 Juli 2026 (terkini)</option><option>Snapshot sebelumnya</option><option>Pendirian</option>
              </select>
            </div>
          </Panel>
          <Panel title="Kewajiban Statutori">
            <div className="rows">
              {c.stat.map((s, i) => <Row key={i} b={s[0]} d={s[1]} right={<Chip c={s[2]}>{s[3]}</Chip>} />)}
            </div>
          </Panel>
          <Panel title="Dokumen Tata Kelola">
            <div className="rows">
              {c.docs.map((d, i) => <Row key={i} b={d[0]} right={<Chip c={d[1]}>{d[2]}</Chip>} />)}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
