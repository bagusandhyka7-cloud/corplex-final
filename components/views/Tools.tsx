"use client";
import React, { useState } from "react";
import { FileText, Globe, KeyRound, Paperclip, PenTool, RefreshCw, Scale, ScanSearch } from "lucide-react";
import { TOOLS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { Chip, Panel, Row, ViewHead } from "@/components/ui";

const ICONS: Record<string, React.ReactNode> = {
  convert: <RefreshCw size={19} />, clip: <Paperclip size={19} />, sign: <PenTool size={19} />,
  note: <FileText size={19} />, globe: <Globe size={19} />, key: <KeyRound size={19} />,
  scale: <Scale size={19} />, scan: <ScanSearch size={19} />,
};

export default function Tools() {
  const { toast } = useStore();
  const [cur, setCur] = useState(7);
  const tool = TOOLS[cur];

  return (
    <div>
      <ViewHead en="Modul 4.8 · Productivity & Legal Utility Suite · Layer 1" h1="Legal Tools"
        sub={<>Alat teknis-administratif — dapat dipakai langsung <b>tanpa alur verifikasi</b>, tetap tercatat di jejak audit. Pilih alat untuk membuka lembar kerjanya.</>} />

      <div className="grid g4">
        {TOOLS.map((x, i) => (
          <div key={i} className={`tool${i === cur ? " on" : ""}`} onClick={() => { setCur(i); toast("Lembar kerja dibuka", `${x.t} — hasil tercatat sebagai berkas turunan di rekam.`); }}>
            <div className="ic">{ICONS[x.ic]}</div>
            <b>{x.t}</b><span>{x.s}</span>
          </div>
        ))}
      </div>

      <div className="grid g2 mt20">
        <Panel title={`Lembar Kerja — ${tool.t}`}>
          {tool.kind === "drop" && tool.drop ? (
            <div className="dropzone" onClick={() => tool.dropToast && toast(tool.dropToast[0], tool.dropToast[1], "ok")}>
              <b>{tool.drop[0]}</b>{tool.drop[1]}
            </div>
          ) : tool.kind === "mono" && tool.mono ? (
            <div className="mono-out" dangerouslySetInnerHTML={{ __html: tool.mono }} />
          ) : tool.kind === "rows" && tool.rows ? (
            <>
              <div className="rows">
                {tool.rows.map((r, i) => <Row key={i} b={r[0]} d={r[1]} right={<Chip c={r[2]}>{r[3]}</Chip>} />)}
              </div>
              {tool.note ? <p className="note mt16">{tool.note}</p> : null}
            </>
          ) : null}
        </Panel>
        <Panel title="Sifat Modul">
          <div className="rows" style={{ gap: 16 }}>
            <Row b="Tanpa alur verifikasi" d="Teknis-administratif — dapat dipakai langsung" right={<Chip c="c-ver">LANGSUNG</Chip>} />
            <Row b="Tetap tercatat audit" d="Setiap pemakaian masuk jejak audit + kuota wajar" right={<Chip c="c-mon">AUDIT</Chip>} />
            <Row b="Terhubung rekam" d="Hasil ekstraksi/konversi menaut berkas asal di vault" right={<Chip c="c-gold">TERTAUT</Chip>} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
