"use client";
import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { api, withRetry } from "@/lib/api";
import { useAsyncAction } from "@/lib/hooks";
import { Chip, Field, Kpi, Modal, Panel, Row, ViewHead } from "@/components/ui";

export default function Lawyer() {
  const { ten, toast, queue, setQueue, quota, quotaMax, setQuota, verified, setVerified, queueCount } = useStore();
  const t = ten!;
  const [premOpen, setPremOpen] = useState(false);
  const [prBidang, setPrBidang] = useState("Legal Due Diligence");
  const [prSkema, setPrSkema] = useState("Fixed fee");
  const [premList, setPremList] = useState([
    { b: "Pendampingan restrukturisasi", d: "Strategic Advisory · fixed fee · tahap 3/5", chip: "c-ver", lbl: "BERJALAN" },
    { b: "PHI eks-karyawan", d: "Litigation · capped fee · sisa plafon 62%", chip: "c-mon", lbl: "SIDANG" },
  ]);

  const doVerify = (i: number, mode: "setuju" | "koreksi" | "tolak") => {
    if (mode === "tolak") {
      const alasan = prompt("Catatan profesional (wajib):", "Perlu penyesuaian dasar hukum pada bagian III");
      if (alasan === null) return;
      setQueue((qs) => qs.map((q, j) => j === i ? { ...q, status: "rejected" as const, note: "Catatan: " + alasan } : q));
      toast("Ditolak dengan catatan", "Dokumen kembali ke DRAF AI — catatan advokat tercatat pada jejak audit.", "warn");
    } else {
      let note = "Disetujui tanpa koreksi.";
      if (mode === "koreksi") {
        const k = prompt("Ringkasan koreksi (tersimpan sebagai koreksi_diff → versi baru):", "Klausul denda disesuaikan ke standar library");
        if (k === null) return;
        note = "Disetujui dengan koreksi: " + k + " · versi baru dibuat.";
      }
      setQueue((qs) => qs.map((q, j) => j === i ? { ...q, status: "verified" as const, note: note + " · ttd digital atas hash versi final" + (mode === "koreksi" ? " · pola koreksi masuk tinjauan kurator library." : ".") } : q));
      setQuota((x) => Math.min(quotaMax, x + 1));
      setVerified((v) => v + 1);
      toast("TERVERIFIKASI ADVOKAT ✓", `Tanda tangan digital tercatat · kuota +1 (${Math.min(quotaMax, quota + 1)}/${quotaMax}) · event verifikasi.selesai → billing & rekam.`, "ok");
      /* PROD: quota increment happens server-side in api.queue.verify via advisory lock — client state is a projection. */
    }
  };

  const { run: sendPremium, pending: sendingPremium } = useAsyncAction(async () => {
    const res = await withRetry(() => api.premium.request({ bidang: prBidang, skema: prSkema }));
    if (!res.ok) { toast("Gagal mengirim permintaan", res.error.message, "warn"); return; }
    setPremOpen(false);
    setPremList((l) => [{ b: prBidang, d: `${prSkema} · cek konflik kepentingan berjalan → penawaran disusun`, chip: "c-draft", lbl: "PENAWARAN" }, ...l]);
    toast("Permintaan terkirim", "Cek konflik kepentingan dijalankan sebelum penugasan tim — penawaran transparan menyusul.", "ok");
  });

  return (
    <div>
      <ViewHead en="Modul 4.12 · Human Verified Premium Legal Services · Layer 3" h1="Corporate Lawyer by MRWP Law Firm"
        sub="Fungsi JAMIN: antrean prioritas terhitung f(SLA paket, risiko, umur, eskalasi), tanda tangan digital atas hash versi, pagar etik konflik kepentingan."
        acts={<button className="btn btn-gold" onClick={() => setPremOpen(true)}><Plus size={14} /> Ajukan Penugasan Premium</button>} />

      <div className="grid g4 mb16">
        <Kpi v={queueCount} label="Antrean verifikasi" tr={`Kuota: ${quota}/${quotaMax} terpakai`} />
        <Kpi v={2} label="Penugasan premium aktif" />
        <Kpi v="< 24 jam" label="SLA verifikasi" tr={`Paket ${t.plan} · prioritas`} trCls="up" />
        <Kpi v={verified} label="Dokumen verified bulan ini" tr="Adopsi model hybrid ▲" trCls="up" />
      </div>

      <div className="grid g-wide">
        <Panel title={<>Antrean Verifikasi — Prioritas Terhitung <span style={{ fontSize: 9, color: "var(--muted)" }}>DRAF AI → HUMAN VERIFIED</span></>}>
          <div className="vq">
            {queue.length ? queue.map((q, i) => {
              if (q.status === "verified") return (
                <div key={i} className="vq-it ok">
                  <div><b>{q.t}</b><span className="meta">{q.note}</span></div>
                  <div className="vq-acts"><Chip c="c-ver">TERVERIFIKASI ADVOKAT ✓ TTD DIGITAL</Chip></div>
                </div>
              );
              if (q.status === "rejected") return (
                <div key={i} className="vq-it rej">
                  <div><b>{q.t}</b><span className="meta">Ditolak — kembali ke DRAF AI untuk revisi. {q.note}</span></div>
                  <div className="vq-acts"><Chip c="c-red">DITOLAK</Chip></div>
                </div>
              );
              return (
                <div key={i} className="vq-it">
                  <div>
                    <b>{q.t}</b><span className="meta">{q.m}</span>
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}><Chip c={q.chip}>{q.lbl}</Chip><Chip c="c-mon">{q.sla}</Chip></div>
                  </div>
                  <div className="vq-acts">
                    <button className="btn btn-ok btn-sm" onClick={() => doVerify(i, "setuju")}>Setujui</button>
                    <button className="btn btn-navy btn-sm" onClick={() => doVerify(i, "koreksi")}>Koreksi</button>
                    <button className="btn btn-red btn-sm" onClick={() => doVerify(i, "tolak")}>Tolak</button>
                  </div>
                </div>
              );
            }) : <p className="note">Antrean kosong — seluruh dokumen telah diproses.</p>}
          </div>
          <div className="note mt16"><b>Prinsip tata kelola:</b> nasihat hukum final hanya lahir dari status TERVERIFIKASI ADVOKAT — tanda tangan digital atas hash versi final, dalam tanggung jawab profesional advokat MRWP. Seluruh interaksi tercatat pada jejak audit.</div>
        </Panel>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title="Kuota Verifikasi Bulanan">
            <div className="quota">
              <div className="lbl"><span>Terpakai</span><b>{quota} / {quotaMax}</b></div>
              <div className="bar"><i style={{ width: `${Math.min(100, (quota / quotaMax) * 100)}%` }} /></div>
            </div>
            <p className="note mt16">Kelebihan kuota otomatis menjadi item tagihan per dokumen (metering event <span className="mono" style={{ fontSize: 10 }}>verifikasi.selesai</span>).</p>
          </Panel>
          <Panel title="Penugasan Premium Aktif">
            <div className="rows">
              {premList.map((p, i) => <Row key={i} b={p.b} d={p.d} right={<Chip c={p.chip}>{p.lbl}</Chip>} />)}
            </div>
          </Panel>
          <Panel className="gold" title="Bidang Layanan">
            <p style={{ fontSize: 12, lineHeight: 1.8 }}>General Corporate · Litigation · Industrial Relation · Pertanahan · Legal DD · M&amp;A · Restrukturisasi · Kepailitan &amp; PKPU · Arbitrase · Legal Audit · Regulatory Compliance</p>
            <p style={{ fontSize: 11, marginTop: 8, opacity: 0.85 }}>Skema transparan di muka: fixed · capped · hourly. Pagar etik: cek konflik kepentingan sebelum penugasan.</p>
          </Panel>
        </div>
      </div>

      <Modal open={premOpen} title="Penugasan Premium — Permintaan Penawaran" onClose={() => setPremOpen(false)}
        footer={<>
          <button className="btn btn-line" onClick={() => setPremOpen(false)}>Batal</button>
          <button className="btn btn-gold" disabled={sendingPremium} aria-busy={sendingPremium} onClick={() => void sendPremium()}>{sendingPremium ? "Mengirim…" : "Kirim Permintaan"}</button>
        </>}>
        <Field label="Bidang">
          <select value={prBidang} onChange={(e) => setPrBidang(e.target.value)}>
            <option>Legal Due Diligence</option><option>Merger &amp; Acquisition</option><option>Litigation</option><option>Legal Audit</option><option>Restrukturisasi</option>
          </select>
        </Field>
        <Field label="Uraian kebutuhan"><textarea rows={3} defaultValue="Due diligence atas rencana akuisisi 60% saham PT Target Pangan." /></Field>
        <Field label="Preferensi skema">
          <select value={prSkema} onChange={(e) => setPrSkema(e.target.value)}>
            <option>Fixed fee</option><option>Capped fee</option><option>Hourly</option>
          </select>
        </Field>
        <div className="note">Penawaran transparan di muka. Pagar etik: sistem menjalankan <b>cek konflik kepentingan</b> sebelum penugasan tim.</div>
      </Modal>
    </div>
  );
}
