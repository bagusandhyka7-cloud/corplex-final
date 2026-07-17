"use client";
import React, { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Doc } from "@/lib/data";
import { clone, useStore } from "@/lib/store";
import { Chip, Field, Modal, Panel, ViewHead } from "@/components/ui";

export default function Drafter({ wizOpen, setWizOpen }: { wizOpen: boolean; setWizOpen: (v: boolean) => void }) {
  const { ten, toast, pushQueue } = useStore();
  const t = ten!;
  const [docs, setDocs] = useState<Doc[]>(() => clone(t.docs));
  const [cur, setCur] = useState(0);
  const [wStep, setWStep] = useState(0);
  const [wJenis, setWJenis] = useState("Perjanjian Jasa");
  const [wPihak, setWPihak] = useState("CV Mitra Kirim");
  const d = docs[cur];

  const applyFix = (id: number) => {
    setDocs((ds) => {
      const n = clone(ds);
      const doc = n[cur];
      const f = doc.flags.find((x) => x.id === id)!;
      f.done = true;
      doc.risk = Math.max(6, (doc.risk || 0) - f.w);
      doc.body = doc.body.replace(
        new RegExp(`(<span class="hl[^"]*" id="hl${id}">)[\\s\\S]*?(</span>)`),
        `<span class="hl fixed" id="hl${id}">${f.fixText}</span>`
      );
      doc.vers = [`v${doc.vers.length + 1} (terkini)`, ...doc.vers];
      toast("Klausul diterapkan → versi baru", `Skor risiko dihitung ulang: ${doc.risk} — delta tercatat pada riwayat versi.`, "ok");
      return n;
    });
  };

  const submitVerify = () => {
    setDocs((ds) => {
      const n = clone(ds);
      const doc = n[cur];
      doc.status = "MENUNGGU"; doc.cls = "c-mon";
      doc.sub = doc.sub.split(" ·")[0] + " · menunggu verifikasi";
      pushQueue(doc.name.replace(".docx", "").replace(/_/g, " "), `Dari Legal Drafter · risk ${doc.risk} · temuan & klausul pengganti terlampir`, (doc.risk || 0) >= 60 ? "c-red" : "c-draft", (doc.risk || 0) >= 60 ? "RISIKO TINGGI" : "DRAF AI");
      return n;
    });
  };

  const wizFinish = () => {
    setWizOpen(false); setWStep(0);
    setDocs((ds) => [{
      name: wJenis.replace(/ /g, "_") + "_" + wPihak.replace(/ /g, "_") + ".docx",
      sub: "v1 · dari wawancara terstruktur", status: "DRAF AI", cls: "c-draft", vers: ["v1 (terkini)"], risk: 14,
      body: `<h5>${wJenis.toUpperCase()}</h5><p>Dirakit dari clause library MRWP (klausul tervalidasi diprioritaskan) — AI menjahit dan mengisi parameter dari jawaban wawancara Anda.</p><p style="color:var(--muted);font-size:12px">Risk score rendah — mayoritas klausul berasal dari library tervalidasi.</p>`,
      flags: [],
    }, ...ds]);
    setCur(0);
    toast("Draf dirakit", `${wJenis} — ${wPihak} · DRAF AI v1 · risk 14 (dijelaskan).`, "ok");
  };

  const riskColor = (r: number | null) => r === null ? "var(--muted)" : r >= 60 ? "var(--danger)" : r >= 30 ? "var(--warn)" : "var(--ok)";
  const riskLbl = (r: number | null) => r === null ? "BELUM DINILAI" : (r >= 60 ? "RISIKO TINGGI" : r >= 30 ? "RISIKO SEDANG" : "RISIKO RENDAH") + " · DASAR PENILAIAN DIJELASKAN";

  return (
    <div>
      <ViewHead en="Modul 4.2 · Intelligent Legal Document Automation · Layer 1" h1="Legal Drafter"
        sub="Drafting via wawancara terstruktur, review dua arah, clause library MRWP, red flag detection, version control, dan risk scoring yang dijelaskan dasar penilaiannya."
        acts={<>
          <button className="btn btn-navy" onClick={() => { setWStep(0); setWizOpen(true); }}><Plus size={14} /> Dokumen Baru</button>
          <button className="btn btn-line" onClick={() => toast("Unggah dokumen pihak lawan", "Parsing pasal → review terhadap clause library → temuan red flag.")}><Upload size={14} /> Unggah Dokumen Pihak Lawan</button>
        </>} />

      <div className="grid g-work">
        <Panel title="Antrean Dokumen">
          <div className="doclist">
            {docs.map((x, i) => (
              <div key={i} className={`doc-it${i === cur ? " on" : ""}`} onClick={() => setCur(i)}>
                <b>{x.name.replace(".docx", "").replace(/_/g, " ")}</b>
                <span>{x.sub}</span>
                <div style={{ marginTop: 5 }}><Chip c={x.cls}>{x.status}</Chip></div>
              </div>
            ))}
          </div>
          <div className="note mt16"><b>Katalog:</b> NDA · MoU · Perjanjian Kerja/Jasa/Sewa · Surat Kuasa · Somasi · Legal Opinion · Gugatan · Jawaban · Replik · Duplik · Kesimpulan · Akta korporasi.</div>
        </Panel>

        <div className="editor">
          <div className="ed-bar">
            <b>{d.name}</b>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select style={{ padding: "5px 9px", fontSize: 11 }} onChange={() => toast("Versi dimuat", "Version control: berkas lama tidak pernah ditimpa.")}>
                {d.vers.map((v) => <option key={v}>{v}</option>)}
              </select>
              <Chip c={d.cls}>{d.status}</Chip>
              <button className="btn btn-gold btn-sm" disabled={d.status !== "DRAF AI"} onClick={submitVerify}>Ajukan Verifikasi Advokat</button>
            </div>
          </div>
          <div className="ed-body" dangerouslySetInnerHTML={{ __html: d.body }} />
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title={<>Risk Scoring <span style={{ fontSize: 9, color: "var(--muted)" }}>TERIKAT VERSI</span></>}>
            <div className="riskmeter">
              <b style={{ color: riskColor(d.risk) }}>{d.risk ?? "—"}</b>
              <span>{riskLbl(d.risk)}</span>
            </div>
            {d.flags.length ? d.flags.map((f) => (
              <div key={f.id} className={`flag ${f.cls}${f.done ? " done" : ""}`}>
                <b>{f.t}{f.done ? " — DIPERBAIKI" : ""}</b>
                <span>{f.d} Kontribusi skor: {f.w}.</span>
                {!f.done ? <button className="btn btn-navy btn-sm" onClick={() => applyFix(f.id)}>Terapkan Klausul Pengganti</button> : null}
              </div>
            )) : <p className="note">Tidak ada temuan aktif pada dokumen ini.</p>}
          </Panel>
          <Panel title="Clause Library MRWP">
            {d.flags.filter((f) => !f.done).length ? d.flags.filter((f) => !f.done).map((f) => (
              <div key={f.id} className="clause-sug"><b>{f.fix}</b><span>TERVALIDASI ADVOKAT</span></div>
            )) : <div className="note">{d.flags.length ? "Seluruh temuan telah diperbaiki — skor diperbarui pada versi baru." : "Pilih temuan red flag untuk melihat klausul pengganti tervalidasi advokat."}</div>}
          </Panel>
        </div>
      </div>

      <Modal open={wizOpen} title="Dokumen Baru — Wawancara Terstruktur" onClose={() => setWizOpen(false)}
        footer={<>
          <button className="btn btn-line" disabled={wStep === 0} onClick={() => setWStep((s) => Math.max(0, s - 1))}>← Kembali</button>
          <button className="btn btn-navy" onClick={() => (wStep === 2 ? wizFinish() : setWStep((s) => s + 1))}>{wStep === 2 ? "Rakit Draf (AI)" : "Lanjut →"}</button>
        </>}>
        <div className="wiz-dots">{[0, 1, 2].map((i) => <i key={i} className={i <= wStep ? "on" : ""} />)}</div>
        {wStep === 0 && (
          <div>
            <Field label="Jenis dokumen">
              <select value={wJenis} onChange={(e) => setWJenis(e.target.value)}>
                <option>Perjanjian Jasa</option><option>NDA</option><option>MoU</option><option>Perjanjian Sewa</option><option>Surat Kuasa</option><option>Somasi</option>
              </select>
            </Field>
            <Field label="Pihak lawan"><input value={wPihak} placeholder="Nama perusahaan / perorangan" onChange={(e) => setWPihak(e.target.value)} /></Field>
          </div>
        )}
        {wStep === 1 && (
          <div>
            <Field label="Nilai perikatan (Rp)"><input type="number" defaultValue={250000000} /></Field>
            <Field label="Jangka waktu"><select><option>12 bulan</option><option>24 bulan</option><option>Sekali selesai</option></select></Field>
            <Field label="Klausul opsional">
              <select multiple size={3} defaultValue={["Kerahasiaan", "Force majeure"]}>
                <option>Kerahasiaan</option><option>Force majeure</option><option>Eksklusivitas</option>
              </select>
            </Field>
          </div>
        )}
        {wStep === 2 && (
          <div>
            <p style={{ fontSize: 13, marginBottom: 10 }}>Draf akan dirakit <b>dari clause library MRWP terlebih dahulu</b> (klausul tervalidasi diprioritaskan) — AI hanya menjahit dan mengisi parameter.</p>
            <div className="note">Keluaran berstatus <b>DRAF AI</b> · versi 1 · risk score dihitung dan dijelaskan dasar penilaiannya. Verifikasi advokat wajib sebelum final.</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
