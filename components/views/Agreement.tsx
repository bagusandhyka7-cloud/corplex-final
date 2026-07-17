"use client";
import React, { useRef, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import { Agr } from "@/lib/data";
import { clone, useStore } from "@/lib/store";
import { downloadDoc, registerVault, vaultHash } from "@/lib/vault";
import { api, withRetry } from "@/lib/api";
import { useAsyncAction, useUpload } from "@/lib/hooks";
import { Chip, Field, Kpi, Modal, ViewHead } from "@/components/ui";

export default function Agreement() {
  const { ten, toast, pushQueue } = useStore();
  const t = ten!;
  const [agr, setAgr] = useState<Agr[]>(() => clone(t.agr));
  const [f, setF] = useState("semua");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [axOpen, setAxOpen] = useState(false);
  const [ax, setAx] = useState({ dok: "", nama: "", p1: "", p2: "", mulai: "", akhir: "", nilai: "" });

  /* Upload → vault (progress/cancel/retry) → AI extraction modal. */
  const { start: startUpload, retry: retryUpload, uploading } = useUpload((file) => {
    registerVault(file);
    setAx({ dok: file.name, nama: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(), p1: t.name, p2: "", mulai: "", akhir: "", nilai: "" });
    setAxOpen(true);
  });
  const upload = async (file: File) => {
    if (uploading) return; // double-submit guard
    toast("AI membaca perjanjian…", "Ekstraksi: para pihak · tanggal mulai/berakhir · nilai perikatan · jenis perjanjian · klausul kunci.");
    const res = await startUpload(file);
    if (!res.ok && res.error.code !== "aborted") { toast("Unggahan gagal", res.error.message + " — mencoba ulang…", "warn"); retryUpload(); }
  };

  const { run: save, pending: saving } = useAsyncAction(async () => {
    if (!ax.nama.trim() || !ax.p2.trim()) { toast("Data belum lengkap", "Nama perjanjian dan Pihak Kedua wajib diisi.", "warn"); return; }
    const rec = {
      n: ax.nama, p1: ax.p1.trim() || t.name, p2: ax.p2,
      mulai: ax.mulai.trim() || "—", akhir: ax.akhir.trim() || "—", nilai: ax.nilai.trim() || "—",
      st: "DRAF", cls: "c-draft", lbl: "DRAF AI", dok: ax.dok,
    };
    const res = await withRetry(() => api.agreements.create(rec));
    if (!res.ok) { toast("Gagal menyimpan", res.error.message, "warn"); return; }
    setAgr((as) => [rec as Agr, ...as]);
    setAxOpen(false);
    pushQueue("Registrasi perjanjian — " + ax.nama, "Dari Agreement Management · hasil ekstraksi AI atas dokumen terunggah", "c-draft", "DRAF AI");
    toast("Perjanjian tercatat — DRAF AI", `Dokumen tersimpan di vault (hash tercatat)${ax.akhir ? " · aturan JAGA dibuat dari tanggal berakhir " + ax.akhir : ""} · diajukan ke antrean verifikasi advokat.`, "ok");
  });

  const rows = agr.filter((a) => {
    if (f !== "semua" && a.st !== f) return false;
    return (a.n + " " + a.p1 + " " + a.p2).toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div>
      <ViewHead en="Modul 4.9 · Agreement Lifecycle Management · Layer 2" h1="Agreement Management"
        sub={<>Registrasi <b>berbasis unggah dokumen</b> — AI membaca perjanjian → mengekstrak para pihak, tanggal mulai/berakhir, nilai, dan klausul kunci → aturan pengingat fungsi JAGA dibuat otomatis dari tanggal berakhir.</>}
        acts={<>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ""; }} />
          <button className="btn btn-navy" onClick={() => fileRef.current?.click()}><Upload size={14} /> Unggah Perjanjian (AI Ekstraksi)</button>
        </>} />

      <div className="grid g4 mb16">
        <Kpi v={agr.filter((a) => a.st !== "DRAF").length} label="Perjanjian aktif dipantau" />
        <Kpi v={agr.filter((a) => a.st === "SEGERA").length} label="Mendekati berakhir" tr="Reminder bertahap aktif" trCls="dn" />
        <Kpi v={agr.filter((a) => a.cls === "c-ver").length} label="Terverifikasi advokat" />
        <Kpi v={agr.filter((a) => a.st === "DRAF").length} label="Menunggu verifikasi" tr="Status DRAF AI" />
      </div>

      <div className="dropzone mb16" onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gold)"; }}
        onDragLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = ""; const file = e.dataTransfer.files?.[0]; if (file) upload(file); }}>
        <b>Letakkan dokumen perjanjian di sini — atau klik untuk memilih berkas</b>
        PDF · Word · hasil pindaian (OCR) — AI mengekstrak: para pihak (siapa dengan siapa) · tanggal mulai · tanggal berakhir · nilai perikatan · jenis perjanjian → Anda mengonfirmasi sebelum tersimpan ke rekam
      </div>

      <div className="filters">
        <input className="finput" placeholder="Cari perjanjian / pihak…" value={q} onChange={(e) => setQ(e.target.value)} />
        {["semua", "AKTIF", "SEGERA", "DRAF"].map((x) => (
          <button key={x} className={`fchip${f === x ? " on" : ""}`} onClick={() => setF(x)}>
            {x === "semua" ? "Semua" : x === "AKTIF" ? "Aktif" : x === "SEGERA" ? "Segera berakhir" : "Draf / menunggu"}
          </button>
        ))}
      </div>
      <div className="tblwrap">
        <table>
          <thead><tr><th>Perjanjian</th><th>Para Pihak</th><th>Tanggal Mulai</th><th>Tanggal Berakhir</th><th>Nilai</th><th>Status</th><th>Dokumen Sumber</th></tr></thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={i}>
                <td><b>{a.n}</b></td>
                <td><b style={{ fontSize: 12 }}>{a.p1}</b><span className="sub">dengan {a.p2}</span></td>
                <td>{a.mulai}</td>
                <td>{a.akhir}</td>
                <td>{a.nilai}</td>
                <td><Chip c={a.cls}>{a.lbl}</Chip></td>
                <td>
                  <div className="flex items-center gap-2">
                    <button className="btn btn-line btn-sm" onClick={() => { downloadDoc(a.dok, t.name); toast("Unduhan dimulai", `${a.dok} · hash ${vaultHash(a.dok)} · akses unduh tercatat pada jejak audit.`, "ok"); }}><Download size={11} /></button>
                    <span className="sub mono" style={{ fontSize: 10 }}><FileText size={10} style={{ display: "inline" }} /> {a.dok}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note mt16"><b>Rantai status:</b> hasil ekstraksi berstatus <b>DRAF AI</b> hingga dikonfirmasi; perjanjian yang berakibat hukum masuk alur verifikasi advokat MRWP. Tanggal berakhir otomatis menjadi aturan JAGA (tangga pengingat H-90 → H-60 → H-30 → H-14). Berkas asli tersimpan di vault dengan hash — setiap baris menunjuk dokumen sumbernya.</p>

      <Modal open={axOpen} title="Ekstraksi AI — Registrasi Perjanjian" onClose={() => setAxOpen(false)}
        footer={<>
          <button className="btn btn-line" onClick={() => setAxOpen(false)}>Batal</button>
          <button className="btn btn-navy" disabled={saving} aria-busy={saving} onClick={() => void save()}>{saving ? "Menyimpan…" : "Simpan ke Rekam"}</button>
        </>}>
        <Field label="Dokumen sumber"><input readOnly value={ax.dok} /></Field>
        <Field label="Nama / judul perjanjian"><input value={ax.nama} onChange={(e) => setAx({ ...ax, nama: e.target.value })} /></Field>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Pihak Pertama"><input value={ax.p1} onChange={(e) => setAx({ ...ax, p1: e.target.value })} /></Field>
          <Field label="Pihak Kedua"><input value={ax.p2} onChange={(e) => setAx({ ...ax, p2: e.target.value })} /></Field>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Tanggal mulai"><input value={ax.mulai} placeholder="mis. 1 Agu 2026" onChange={(e) => setAx({ ...ax, mulai: e.target.value })} /></Field>
          <Field label="Tanggal berakhir"><input value={ax.akhir} placeholder="mis. 31 Jul 2028" onChange={(e) => setAx({ ...ax, akhir: e.target.value })} /></Field>
        </div>
        <Field label="Nilai perikatan"><input value={ax.nilai} placeholder="mis. Rp 500 jt / tahun" onChange={(e) => setAx({ ...ax, nilai: e.target.value })} /></Field>
        <div className="note">Hasil <b>ekstraksi AI dari dokumen terunggah</b> — koreksi bila perlu. Tanggal berakhir otomatis menjadi aturan JAGA (tangga pengingat H-90 → H-14). Berstatus <b>DRAF AI</b> hingga verifikasi advokat bila berakibat hukum.</div>
      </Modal>
    </div>
  );
}
