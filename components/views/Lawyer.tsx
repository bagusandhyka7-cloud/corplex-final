"use client";
/*
 * Lawyer MRWP — TAMPILAN KLIEN (user-view).
 * User hanya melihat: progress pengajuan (timeline 4 langkah) + sisa kuota + penugasan premium.
 * Aksi advokat (setujui/koreksi/tolak + ttd) pindah ke Konsol Advokat di /adminmrwp (slice berikutnya).
 */
import React, { useState } from "react";
import { Download, FileText, Plus, RefreshCw } from "lucide-react";
import { QItem } from "@/lib/data";
import { useStore } from "@/lib/store";
import { downloadDoc } from "@/lib/vault";
import { Chip, Field, Modal, Panel, Row, ViewHead } from "@/components/ui";

const STEPS = ["Diajukan", "Antre verifikasi", "Ditinjau advokat", "Selesai"];

/* S4: tanpa badge status — status dibaca dari timeline (lingkaran akhir hijau "Terverifikasi" / merah) */
const progress = (q: QItem): { at: number; done: boolean; kalimat: string } => {
  if (q.status === "verified") return { at: 3, done: true, kalimat: "Selesai — ditandatangani digital oleh advokat MRWP." };
  if (q.status === "rejected") return { at: 3, done: true, kalimat: "Dikembalikan dengan catatan advokat — perbaiki lalu ajukan ulang." };
  return { at: 1, done: false, kalimat: "Sedang antre verifikasi advokat — estimasi selesai < 24 jam." };
};

export default function Lawyer() {
  const { ten, toast, queue, pushQueue, quota, quotaMax } = useStore();
  const t = ten!;
  const [f, setF] = useState("semua");
  const [cari, setCari] = useState("");
  const [premOpen, setPremOpen] = useState(false);
  const [noteQ, setNoteQ] = useState<QItem | null>(null); // drawer kanan: catatan advokat
  const [prBidang, setPrBidang] = useState("Legal Due Diligence");
  const [prSkema, setPrSkema] = useState("Fixed fee");
  const [premList, setPremList] = useState([
    { b: "Pendampingan restrukturisasi", d: "Strategic Advisory · fixed fee · tahap 3/5", chip: "c-ver", lbl: "BERJALAN" },
    { b: "PHI eks-karyawan", d: "Litigation · capped fee · sisa plafon 62%", chip: "c-mon", lbl: "SIDANG" },
  ]);

  const sisa = Math.max(0, quotaMax - quota);
  const rows = queue.filter((q) => {
    if (f === "berjalan" && q.status !== "masuk") return false;
    if (f === "selesai" && q.status !== "verified") return false;
    if (f === "revisi" && q.status !== "rejected") return false;
    return (q.t + " " + q.m).toLowerCase().includes(cari.toLowerCase());
  });

  const ajukanUlang = (q: QItem) => {
    pushQueue(q.t + " (revisi)", "Diajukan ulang setelah perbaikan · " + (q.note || "catatan advokat ditindaklanjuti"), "c-draft", "DRAF AI");
    toast("Diajukan ulang", "Pengajuan revisi masuk antrean prioritas.", "ok");
  };

  const sendPremium = () => {
    setPremOpen(false);
    setPremList((l) => [{ b: prBidang, d: `${prSkema} · cek konflik kepentingan berjalan → penawaran disusun`, chip: "c-draft", lbl: "PENAWARAN" }, ...l]);
    toast("Permintaan terkirim", "Cek konflik kepentingan dijalankan sebelum penugasan tim — penawaran transparan menyusul.", "ok");
  };

  return (
    <div>
      <style>{`
        .lw-quota{background:linear-gradient(150deg,#10203C,#0C1A33);border:1px solid var(--line2);border-radius:15px;padding:20px 24px;margin-bottom:16px;display:flex;align-items:center;gap:26px;flex-wrap:wrap}
        .lw-quota .big{font-family:var(--serif);font-size:24px;color:#fff;line-height:1;display:flex;align-items:center;gap:8px;white-space:nowrap}
        .lw-quota .big i{font-style:normal;color:var(--gold-bright)}
        .lw-quota .bar{flex:1;min-width:180px;height:9px;border-radius:100px;background:rgba(28,48,84,.8);overflow:hidden}
        .lw-quota .bar i{display:block;height:100%;border-radius:100px;background:linear-gradient(90deg,var(--gold-bright),var(--gold));transition:width .5s ease}
        .lw-card{background:rgba(16,33,61,.55);border:1px solid rgba(28,48,84,.8);border-radius:13px;padding:16px 18px;margin-bottom:12px}
        .lw-tl{display:flex;align-items:flex-start;margin:14px 0 4px}
        .lw-st{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;position:relative}
        .lw-st::before{content:"";position:absolute;top:11px;left:-50%;width:100%;height:2px;background:rgba(28,48,84,.9)}
        .lw-st:first-child::before{display:none}
        .lw-st.on::before{background:linear-gradient(90deg,var(--gold),var(--gold-bright))}
        .lw-st .dot{width:23px;height:23px;border-radius:50%;display:grid;place-items:center;font-size:10.5px;font-weight:700;background:#152A4E;color:#5E76A8;border:1px solid rgba(28,48,84,.9);position:relative;z-index:1}
        .lw-st.on .dot{background:linear-gradient(150deg,var(--gold-bright),var(--gold));color:#060E1D;border-color:var(--gold)}
        .lw-st .cap{font-family:var(--mono);font-size:7.5px;letter-spacing:.08em;text-transform:uppercase;color:#5E76A8;text-align:center}
        .lw-st.on .cap{color:var(--gold-deep)}
        .lw-st.ok .dot{background:linear-gradient(150deg,#3FB37E,#35A56C);color:#04160C;border-color:#35A56C}
        .lw-st.ok .cap{color:#3FB37E}
        .lw-st.bad .dot{background:linear-gradient(150deg,#C4574F,#A93E37);color:#fff;border-color:#A93E37}
        .lw-st.bad .cap{color:#C4574F}
      `}</style>

      <ViewHead h1="Pengacara MRWP"
        sub="Pantau progress pengajuan Anda dan sisa kuota bulan ini."
        acts={<button className="btn btn-gold" onClick={() => setPremOpen(true)}><Plus size={14} /> Ajukan Penugasan Premium</button>} />

      {/* kartu kuota — sederhana: angka · bar · label */}
      <div className="lw-quota">
        <div className="big"><i>{sisa}</i> <span style={{ fontSize: 14, color: "var(--txt2)" }}>dari {quotaMax} tersisa</span></div>
        <div className="bar" style={{ flex: 1, minWidth: 220 }}><i style={{ width: `${Math.min(100, (quota / quotaMax) * 100)}%` }} /></div>
        <Chip c="c-mon">KUOTA PENGAJUAN BULAN INI</Chip>
      </div>

      {/* filter + pencarian full-width — kolom kiri & kanan mulai sejajar */}
      <div className="filters" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        {[["semua", "Semua"], ["berjalan", "Berjalan"], ["selesai", "Selesai"], ["revisi", "Perlu revisi"]].map(([k, l]) => (
          <button key={k} className={`fchip${f === k ? " on" : ""}`} onClick={() => setF(k)}>{l}</button>
        ))}
        <input className="finput" style={{ flex: 1, minWidth: 160 }} placeholder="Cari pengajuan…" value={cari} onChange={(e) => setCari(e.target.value)} />
      </div>

      {/* list FULL-WIDTH, ±3 kartu terlihat lalu scroll; tanpa badge; tombol aksi ujung kanan sejajar judul */}
      <div style={{ maxHeight: 430, overflowY: "auto", paddingRight: rows.length > 3 ? 6 : 0 }}>
        {rows.length ? rows.map((q, i) => {
          const p = progress(q);
          return (
            <div key={i} className="lw-card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <b style={{ flex: 1, minWidth: 200, color: "#fff", fontSize: 13.5 }}>
                  {q.t.replace(/\s*—\s*/g, " ")}
                  <span style={{ color: "var(--muted)", fontWeight: 500 }}> — {(q.m.split("·")[0].trim().replace(/^Dari\s+/i, "Dari ")) || "Pengajuan"}</span>
                </b>
                {q.status === "verified" && <span style={{ display: "inline-flex", gap: 8 }}>
                  <button className="btn btn-navy btn-sm" onClick={() => { downloadDoc(q.t.replace(/[^\w]+/g, "_") + ".pdf", t.name); toast("Unduhan dimulai", "Dokumen final ber-ttd digital · akses tercatat pada jejak audit.", "ok"); }}>
                    <Download size={12} /> Unduh dokumen final
                  </button>
                  {q.note && <button className="btn btn-line btn-sm" onClick={() => setNoteQ(q)}><FileText size={12} /> Lihat catatan</button>}
                </span>}
                {q.status === "rejected" && (
                  <button className="btn btn-red btn-sm" onClick={() => setNoteQ(q)}><FileText size={12} /> Ditolak, lihat catatan</button>
                )}
              </div>

              <div className="lw-tl">
                {STEPS.map((s, si) => {
                  const last = si === 3;
                  const cls = si <= p.at ? (last && q.status === "verified" ? " on ok" : last && q.status === "rejected" ? " on bad" : " on") : "";
                  const cap = last && q.status === "verified" ? "Terverifikasi" : last && q.status === "rejected" ? "Perlu revisi" : s;
                  return (
                    <div key={s} className={`lw-st${cls}`}>
                      <div className="dot">{si < p.at || (si === p.at && p.done) ? "✓" : si + 1}</div>
                      <span className="cap">{cap}</span>
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: 12, color: "var(--txt2)", margin: "8px 0 0" }}>{p.kalimat}</p>
            </div>
          );
        }) : (
          <div className="panel"><p className="note">Belum ada pengajuan{f !== "semua" ? " pada filter ini" : ""} — ajukan dokumen dari modul mana pun (Agreement, Employment, AI Assistant) dan pantau progresnya di sini.</p></div>
        )}
      </div>

      {/* S4: Penugasan Premium pindah ke BAWAH daftar */}
      <Panel title="Penugasan Premium Aktif" className="mt16">
        <div className="rows">
          {premList.map((p, i) => <Row key={i} b={p.b} d={p.d} right={<Chip c={p.chip}>{p.lbl}</Chip>} />)}
        </div>
      </Panel>

      {/* drawer kanan: catatan advokat (gaya form) */}
      <Modal open={!!noteQ} right title="Catatan Advokat" onClose={() => setNoteQ(null)}
        footer={<>
          <button className="btn btn-line" onClick={() => setNoteQ(null)}>Tutup</button>
          {noteQ?.status === "rejected" && <button className="btn btn-gold" onClick={() => { ajukanUlang(noteQ); setNoteQ(null); }}><RefreshCw size={12} /> Perbaiki &amp; ajukan ulang</button>}
        </>}>
        {noteQ && <>
          <Field label="Pengajuan"><input value={noteQ.t} readOnly /></Field>
          <Field label="Status"><input value={noteQ.status === "verified" ? "Disetujui / terverifikasi" : "Ditolak — perlu revisi"} readOnly /></Field>
          <Field label="Catatan dari advokat"><textarea rows={7} value={noteQ.note || "— tidak ada catatan —"} readOnly /></Field>
        </>}
      </Modal>

      <Modal open={premOpen} title="Penugasan Premium — Permintaan Penawaran" onClose={() => setPremOpen(false)}
        footer={<>
          <button className="btn btn-line" onClick={() => setPremOpen(false)}>Batal</button>
          <button className="btn btn-gold" onClick={sendPremium}>Kirim Permintaan</button>
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
