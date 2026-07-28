"use client";
/*
 * Lawyer MRWP — TAMPILAN KLIEN (user-view).
 * User hanya melihat: progress pengajuan (timeline 4 langkah) + sisa kuota + penugasan premium.
 * Aksi advokat (setujui/koreksi/tolak + ttd) pindah ke Konsol Advokat di /adminmrwp (slice berikutnya).
 */
import React, { useRef, useState } from "react";
import { Download, FileText, Paperclip, Plus, RefreshCw } from "lucide-react";
import { QItem } from "@/lib/data";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { downloadDoc } from "@/lib/vault";
import { Chip, Field, Modal, Panel, Row, ViewHead, VqThread } from "@/components/ui";

const STEPS = ["Diajukan", "Antre verifikasi", "Ditinjau advokat", "Selesai"];

/* Pengajuan masih di meja advokat? Hanya yang terbuka boleh menerima balasan klien. */
const terbuka = (q: QItem) => q.status === "masuk" || q.status === "meninjau";
/* Label tombol mengikuti PENULIS pesan terakhir — dulu selalu "Pertanyaan advokat" walau
 * pertanyaannya sudah dijawab klien (kolom `note` ikut berubah, labelnya tidak). */
const labelUtas = (q: QItem) => {
  const akhir = q.msgs?.[q.msgs.length - 1];
  return akhir?.by === "advokat" && terbuka(q) ? "Pertanyaan advokat" : "Lihat percakapan";
};
const adaUtas = (q: QItem) => !!(q.msgs?.length || q.note);

/* S4: tanpa badge status — status dibaca dari timeline (lingkaran akhir hijau "Terverifikasi" / merah) */
const progress = (q: QItem): { at: number; done: boolean; kalimat: string } => {
  if (q.status === "verified") return { at: 3, done: true, kalimat: "Selesai — disetujui advokat MRWP, keputusan tercatat beserta waktunya." };
  if (q.status === "rejected") return { at: 3, done: true, kalimat: "Dikembalikan dengan catatan advokat — perbaiki lalu ajukan ulang." };
  if (q.status === "meninjau") return { at: 2, done: false, kalimat: "Sedang ditinjau advokat MRWP — dokumen dibuka di meja advokat." };
  return { at: 1, done: false, kalimat: "Sedang antre verifikasi advokat — estimasi selesai < 24 jam." };
};

export default function Lawyer() {
  const { ten, toast, queue, setQueue, pushQueue, quota, quotaMax } = useStore();
  const t = ten!;
  const [f, setF] = useState("semua");
  const [cari, setCari] = useState("");
  const [premOpen, setPremOpen] = useState(false);
  const [noteSel, setNoteSel] = useState<QItem | null>(null); // drawer kanan: utas percakapan
  /* Baca dari queue (bukan salinan beku) agar pesan baru advokat masuk lewat realtime
   * selagi drawer terbuka. Fallback ke salinan untuk pengajuan yang belum punya id DB. */
  const noteQ = noteSel ? queue.find((x) => x.id && x.id === noteSel.id) || noteSel : null;
  const setNoteQ = setNoteSel;
  const [balas, setBalas] = useState("");
  const [balasFile, setBalasFile] = useState<File | null>(null);
  const [balasKirim, setBalasKirim] = useState(false);
  const balasFileRef = useRef<HTMLInputElement>(null);
  const [prBidang, setPrBidang] = useState("Legal Due Diligence");
  const [prSkema, setPrSkema] = useState("Fixed fee");
  const [prUraian, setPrUraian] = useState(""); // bug lama: textarea uncontrolled — uraian dibuang saat submit
  /* Lampiran klien: advokat yang butuh dokumen dulu tak punya jalur menerimanya di aplikasi. */
  const [prFile, setPrFile] = useState<File | null>(null);
  const [prKirim, setPrKirim] = useState(false);
  const prFileRef = useRef<HTMLInputElement>(null);
  /* Penugasan Premium NYATA: baris verification_queue berjudul khusus (bug lama: seed lokal
   * yang hilang saat reload dan tak pernah sampai ke Konsol Advokat). */
  const isPrem = (t2: string) => t2.startsWith("Penugasan Premium");
  const premList = queue.filter((q) => isPrem(q.t));

  const sisa = Math.max(0, quotaMax - quota);
  const rows = queue.filter((q) => {
    if (isPrem(q.t)) return false; // tampil di panel Penugasan Premium, bukan daftar pengajuan
    if (f === "berjalan" && q.status !== "masuk" && q.status !== "meninjau") return false;
    if (f === "selesai" && q.status !== "verified") return false;
    if (f === "revisi" && q.status !== "rejected") return false;
    return (q.t + " " + q.m).toLowerCase().includes(cari.toLowerCase());
  });

  /* Balasan klien masuk UTAS (msgs), bukan menimpa `note` — dokumen susulan menumpang
   * bucket module-docs yang sudah dipakai lampiran pengajuan. */
  const kirimBalasan = async () => {
    if (!noteQ?.id || balasKirim) return;
    if (!balas.trim()) { toast("Balasan kosong", "Tulis jawaban untuk advokat terlebih dahulu.", "warn"); return; }
    setBalasKirim(true);
    let dok: { url: string; nama: string } | undefined;
    if (balasFile) {
      const up = await api.records.uploadDoc(localStorage.getItem("corplex_tid") || "", balasFile);
      if (!up.ok) { setBalasKirim(false); return toast("Lampiran gagal diunggah", up.error.message, "warn"); }
      dok = up.data;
    }
    const r = await api.verifq.reply(noteQ.id, balas.trim(), dok);
    setBalasKirim(false);
    if (!r.ok) return toast("Gagal mengirim", r.error.message, "warn");
    setQueue((qs) => qs.map((x) => (x.id === noteQ.id ? { ...x, msgs: r.data } : x)));
    setBalas(""); setBalasFile(null);
    toast("Balasan terkirim", "Advokat MRWP melihatnya di Konsol Advokat — riwayat percakapan tersimpan.", "ok");
  };

  const ajukanUlang = (q: QItem) => {
    pushQueue(q.t + " (revisi)", "Diajukan ulang setelah perbaikan · " + (q.note || "catatan advokat ditindaklanjuti"), "c-draft", "DRAF AI");
    toast("Diajukan ulang", "Pengajuan revisi masuk antrean verifikasi advokat.", "ok");
  };

  const sendPremium = async () => {
    if (prKirim) return;
    /* nyata: masuk verification_queue → tampil di panel ini, badge sidebar, dan Konsol Advokat admin */
    if (!prUraian.trim()) { toast("Uraian kebutuhan wajib diisi", "Advokat butuh konteks masalah untuk menyusun penawaran.", "warn"); return; }
    setPrKirim(true);
    let dok: { url: string; nama: string } | undefined;
    if (prFile) {
      const up = await api.records.uploadDoc(localStorage.getItem("corplex_tid") || "", prFile);
      if (!up.ok) { setPrKirim(false); return toast("Lampiran gagal diunggah", up.error.message, "warn"); }
      dok = up.data;
    }
    setPremOpen(false); setPrKirim(false);
    /* JANGAN klaim "cek konflik kepentingan dijalankan" — sistem tidak menjalankan pemeriksaan apa pun.
     * Cek konflik adalah kewajiban etik yang dilakukan MANUSIA di MRWP sebelum menerima penugasan. */
    pushQueue(`Penugasan Premium — ${prBidang}`, `${prSkema} · menunggu peninjauan & penawaran dari MRWP`, "c-gold", "PENAWARAN", undefined, prUraian.trim(), dok);
    setPrUraian(""); setPrFile(null);
    toast("Permintaan terkirim", "Tim MRWP meninjau permintaan Anda — termasuk pemeriksaan konflik kepentingan — sebelum penawaran disampaikan.", "ok");
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
                  <button className="btn btn-navy btn-sm" onClick={() => { downloadDoc(q.t.replace(/[^\w]+/g, "_") + ".pdf", t.name); toast("Unduhan dimulai", "Dokumen final hasil keputusan advokat.", "ok"); }}>
                    <Download size={12} /> Unduh dokumen final
                  </button>
                  {adaUtas(q) && <button className="btn btn-line btn-sm" onClick={() => setNoteQ(q)}><FileText size={12} /> {labelUtas(q)}</button>}
                </span>}
                {q.status === "rejected" && (
                  <button className="btn btn-red btn-sm" onClick={() => setNoteQ(q)}><FileText size={12} /> Ditolak, lihat catatan</button>
                )}
                {q.status === "meninjau" && adaUtas(q) && (
                  <button className="btn btn-gold btn-sm" onClick={() => setNoteQ(q)}><FileText size={12} /> {labelUtas(q)}</button>
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

      {/* Penugasan Premium — rekam nyata verification_queue (judul "Penugasan Premium — …") */}
      <Panel title="Penugasan Premium Aktif" className="mt16">
        <div className="rows">
          {premList.map((p, i) => (
            <Row key={p.id || i} b={p.t.replace(/^Penugasan Premium — /, "")} d={p.m}
              right={<>
                {adaUtas(p) && <button className="btn btn-gold btn-sm" onClick={() => setNoteQ(p)}><FileText size={12} /> {labelUtas(p)}</button>}
                <Chip c={p.status === "verified" ? "c-ver" : p.status === "rejected" ? "c-red" : p.status === "meninjau" ? "c-gold" : p.chip}>{p.status === "verified" ? "DISETUJUI" : p.status === "rejected" ? "DITOLAK" : p.status === "meninjau" ? "DITINJAU" : p.lbl}</Chip>
              </>} />
          ))}
          {!premList.length && <Row b="Belum ada penugasan premium" d="Ajukan lewat tombol Ajukan Penugasan Premium di atas — permintaan langsung masuk meja advokat MRWP." right={<Chip c="c-mon">KOSONG</Chip>} />}
        </div>
      </Panel>

      {/* drawer kanan: UTAS percakapan advokat<->klien (dulu textarea read-only satu catatan) */}
      <Modal open={!!noteQ} right title="Percakapan dengan Advokat" onClose={() => setNoteQ(null)}
        footer={<>
          <button className="btn btn-line" onClick={() => setNoteQ(null)}>Tutup</button>
          {noteQ?.status === "rejected" && <button className="btn btn-gold" onClick={() => { ajukanUlang(noteQ); setNoteQ(null); }}><RefreshCw size={12} /> Perbaiki &amp; ajukan ulang</button>}
        </>}>
        {noteQ && <>
          <Field label="Pengajuan"><input value={noteQ.t} readOnly /></Field>
          <Field label="Status"><input value={noteQ.status === "verified" ? "Disetujui / terverifikasi" : noteQ.status === "meninjau" ? "Sedang ditinjau — advokat butuh info tambahan" : "Ditolak — perlu revisi"} readOnly /></Field>
          <Field label="Riwayat percakapan"><VqThread msgs={noteQ.msgs || []} me="klien" /></Field>
          {/* Pengajuan yang SUDAH DIPUTUS keluar dari antrean kerja advokat — balasan di situ tak
            * akan pernah dibaca. Menampilkan kotak balasannya = menjanjikan sesuatu yang tak terjadi. */}
          {terbuka(noteQ) ? <>
            <Field label="Balasan Anda">
              <textarea rows={4} value={balas} placeholder="Jawab pertanyaan advokat — lampirkan dokumen susulan bila diminta." onChange={(e) => setBalas(e.target.value)} />
            </Field>
            <Field label="Dokumen susulan (opsional · PDF/gambar, maks 10MB)">
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input ref={balasFileRef} type="file" accept="application/pdf,image/*" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0] || null; if (f && f.size > 10 * 1024 * 1024) { toast("Berkas terlalu besar", "Maksimal 10MB.", "warn"); return; } setBalasFile(f); }} />
                <button className="btn btn-line btn-sm" onClick={() => balasFileRef.current?.click()}><Paperclip size={12} /> {balasFile ? "Ganti berkas" : "Pilih berkas"}</button>
                {balasFile && <><span style={{ fontSize: 12, color: "var(--ink)" }}>{balasFile.name}</span>
                  <button className="btn btn-line btn-sm" onClick={() => setBalasFile(null)}>Hapus</button></>}
              </div>
            </Field>
            <button className="btn btn-gold" disabled={balasKirim} aria-busy={balasKirim} onClick={() => void kirimBalasan()}>Kirim Balasan ke Advokat</button>
          </> : (
            <p className="note" style={{ marginTop: 4 }}>
              Pengajuan ini sudah <b>{noteQ.status === "verified" ? "diputus dan disetujui" : "ditolak"}</b> advokat, sehingga percakapannya ditutup — balasan baru tidak akan masuk meja advokat.
              {noteQ.status === "rejected" ? " Pakai tombol “Perbaiki & ajukan ulang” di bawah untuk melanjutkan." : " Ajukan permintaan baru bila masih ada yang perlu dibahas."}
            </p>
          )}
        </>}
      </Modal>

      <Modal right open={premOpen} title="Penugasan Premium — Permintaan Penawaran" onClose={() => setPremOpen(false)}
        footer={<>
          <button className="btn btn-line" onClick={() => setPremOpen(false)}>Batal</button>
          <button className="btn btn-gold" disabled={prKirim} aria-busy={prKirim} onClick={() => void sendPremium()}>Kirim Permintaan</button>
        </>}>
        <Field label="Bidang">
          <select value={prBidang} onChange={(e) => setPrBidang(e.target.value)}>
            <option>Legal Due Diligence</option><option>Merger &amp; Acquisition</option><option>Litigation</option><option>Legal Audit</option><option>Restrukturisasi</option>
          </select>
        </Field>
        <Field label="Uraian kebutuhan *"><textarea rows={3} value={prUraian} placeholder="Uraikan masalah/kebutuhan hukum Anda — dibaca langsung oleh advokat." onChange={(e) => setPrUraian(e.target.value)} /></Field>
        <Field label="Preferensi skema">
          <select value={prSkema} onChange={(e) => setPrSkema(e.target.value)}>
            <option>Fixed fee</option><option>Capped fee</option><option>Hourly</option>
          </select>
        </Field>
        {/* LAMPIRAN — jalur yang dulu tidak ada: advokat butuh dokumen, klien tak bisa mengirim. */}
        <Field label={<>Lampiran dokumen <em style={{ color: "var(--muted)", fontStyle: "normal", fontWeight: 400 }}>(opsional — PDF / gambar, maks 10MB)</em></>}>
          <input ref={prFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }}
            onChange={(e) => {
              const f2 = e.target.files?.[0];
              if (f2 && f2.size > 10 * 1024 * 1024) { toast("Berkas terlalu besar", "Maksimal 10MB per lampiran.", "warn"); e.target.value = ""; return; }
              if (f2) setPrFile(f2);
              e.target.value = "";
            }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-line btn-sm" onClick={() => prFileRef.current?.click()}>
              <Paperclip size={12} /> {prFile ? "Ganti berkas" : "Pilih berkas"}
            </button>
            <span className="sub" style={{ fontSize: 11, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
              {prFile ? `${prFile.name} · ${(prFile.size / 1024 / 1024).toFixed(2)} MB` : "belum ada lampiran"}
            </span>
            {prFile && <button type="button" className="btn btn-red btn-sm" onClick={() => setPrFile(null)}>Hapus</button>}
          </div>
        </Field>
        {/* Dulu: "sistem menjalankan cek konflik kepentingan" — tidak ada pemeriksaan otomatis apa pun. */}
        <div className="note">Lampiran terbuka langsung di meja advokat bersama pengajuan Anda. Penawaran transparan di muka; pagar etik: advokat MRWP melakukan <b>pemeriksaan konflik kepentingan</b> sebelum menerima penugasan.</div>
      </Modal>
    </div>
  );
}
