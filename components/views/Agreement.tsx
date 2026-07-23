"use client";
import React, { useEffect, useRef, useState } from "react";
import { FileText, Lock, Plus } from "lucide-react";
import { Agr } from "@/lib/data";
import { clone, useStore } from "@/lib/store";
import { downloadDoc, registerVault, vaultHash } from "@/lib/vault";
import { api, withRetry } from "@/lib/api";
import { useAsyncAction, useUpload } from "@/lib/hooks";
import { Chip, Field, Kpi, Modal } from "@/components/ui";
import { ModuleShell } from "@/components/ModuleShell";
import { useRouter } from "next/navigation";
import { RecActions, RecordModal } from "@/components/RecordModal";
import { idOf, RecRow } from "@/lib/records";
import { aiExtract } from "@/lib/extract";
import { useExcelImport } from "@/components/ExcelImport";

/* Field yang diminta ke AI dari dokumen perjanjian — cocok isian modal ax. */
const AGR_FIELDS = [
  { k: "nama", l: "Nama atau judul perjanjian/kontrak" },
  { k: "p1", l: "Pihak Pertama (nama badan hukum/orang)" },
  { k: "p2", l: "Pihak Kedua (nama badan hukum/orang)" },
  { k: "mulai", l: "Tanggal mulai berlaku" },
  { k: "akhir", l: "Tanggal berakhir / jatuh tempo" },
  { k: "nilai", l: "Nilai perikatan (mis. Rp 500.000.000)" },
];

export default function Agreement() {
  const { ten, toast, pushQueue, patchTen } = useStore();
  const router = useRouter();
  const t = ten!;
  const [agr, setAgr] = useState<Agr[]>(() => clone(t.agr));
  useEffect(() => setAgr(clone(t.agr)), [t.agr]); // hidrasi DB menyusul mount
  const [mOpen, setMOpen] = useState(false);
  const [mEdit, setMEdit] = useState<RecRow | null>(null);
  const onDone = (row: RecRow, editId: string | null) =>
    patchTen({ agr: (editId ? t.agr.map((x) => idOf("agr", x as unknown as RecRow) === editId ? row : x) : [row, ...t.agr]) as typeof t.agr });
  const [f, setF] = useState("semua");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [axOpen, setAxOpen] = useState(false);
  const [ax, setAx] = useState({ dok: "", nama: "", p1: "", p2: "", mulai: "", akhir: "", nilai: "" });

  /* Word/doc (tak terbaca model) → jalur lama: tebak nama dari file. */
  const { start: startUpload, retry: retryUpload, uploading } = useUpload((file) => {
    registerVault(file);
    setAx({ dok: file.name, nama: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(), p1: t.name, p2: "", mulai: "", akhir: "", nilai: "" });
    setAxOpen(true);
  });
  const [extracting, setExtracting] = useState(false);
  const xlsx = useExcelImport("agr");
  const upload = async (file: File) => {
    if (uploading || extracting) return; // double-submit guard
    setExtracting(true);
    toast("AI membaca perjanjian…", "Ekstraksi: para pihak · tanggal mulai/berakhir · nilai perikatan.");
    // Gambar/PDF → ekstraksi AI NYATA; Word/doc → null → jalur unggah lama (heuristik nama).
    const vals = await aiExtract(file, AGR_FIELDS);
    setExtracting(false);
    if (vals === null) {
      const res = await startUpload(file);
      if (!res.ok && res.error.code !== "aborted") { toast("Unggahan gagal", res.error.message + " — mencoba ulang…", "warn"); retryUpload(); }
      return;
    }
    registerVault(file);
    setAx({
      dok: file.name, nama: vals.nama || file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(),
      p1: vals.p1 || t.name, p2: vals.p2 || "", mulai: vals.mulai || "", akhir: vals.akhir || "", nilai: vals.nilai || "",
    });
    setAxOpen(true);
  };

  const { run: save, pending: saving } = useAsyncAction(async () => {
    if (!ax.nama.trim() || !ax.p2.trim()) { toast("Data belum lengkap", "Nama perjanjian dan Pihak Kedua wajib diisi.", "warn"); return; }
    const rec = {
      n: ax.nama, p1: ax.p1.trim() || t.name, p2: ax.p2,
      mulai: ax.mulai.trim() || "—", akhir: ax.akhir.trim() || "—", nilai: ax.nilai.trim() || "—",
      st: "DRAF", cls: "c-draft", lbl: "DRAF AI", dok: ax.dok,
    };
    // NYATA: tersimpan ke module_records (source 'ai') — bertahan lintas refresh.
    const res = await withRetry(() => api.records.create(localStorage.getItem("corplex_tid") || "", "agr", rec, "ai"));
    if (!res.ok) { toast("Gagal menyimpan", res.error.message, "warn"); return; }
    patchTen({ agr: [{ ...rec, id: res.data.id } as unknown as Agr, ...t.agr] });
    setAxOpen(false);
    pushQueue("Registrasi perjanjian — " + ax.nama, "Dari Agreement Management · hasil ekstraksi AI atas dokumen terunggah", "c-draft", "DRAF AI");
    toast("Perjanjian tercatat — DRAF AI", `Dokumen tersimpan di vault (hash tercatat)${ax.akhir ? " · aturan JAGA dibuat dari tanggal berakhir " + ax.akhir : ""} · diajukan ke antrean verifikasi advokat.`, "ok");
  });

  const rows = agr.filter((a) => {
    if (f !== "semua" && a.st !== f) return false;
    return (a.n + " " + a.p1 + " " + a.p2).toLowerCase().includes(q.toLowerCase());
  });

  return (
    <ModuleShell h1="Manajemen Kontrak"
      sub="Unggah perjanjian — sistem membaca isinya dan mengingatkan Anda sebelum jatuh tempo."
      acts={<button className="btn btn-gold" onClick={() => { setMEdit(null); setMOpen(true); }}><Plus size={14} /> Tambah Manual</button>}
      dropNote="PDF · Word · pindaian (OCR) — AI mengekstrak para pihak, tanggal mulai/berakhir, dan nilai perikatan; dokumen asli tersimpan di vault."
      onDrop={(file) => { if (!xlsx.tryFile(file)) void upload(file); }}
      filters={["semua", "AKTIF", "SEGERA", "DRAF"]} active={f} onFilter={setF}
      q={q} setQ={setQ} cariPh="Cari perjanjian / pihak…"
      kpi={<div className="grid g4 mb16">
        <Kpi v={agr.filter((a) => a.st !== "DRAF").length} label="Perjanjian aktif dipantau" />
        <Kpi v={agr.filter((a) => a.st === "SEGERA").length} label="Mendekati berakhir" tr="Reminder bertahap aktif" trCls="dn" />
        <Kpi v={agr.filter((a) => a.cls === "c-ver").length} label="Terverifikasi advokat" />
        <Kpi v={agr.filter((a) => a.st === "DRAF").length} label="Menunggu verifikasi" tr="Status DRAF AI" />
      </div>}>

      <div className="tblwrap">
        <table>
          <thead><tr><th>Perjanjian</th><th>Para Pihak</th><th>Tanggal Mulai</th><th>Tanggal Berakhir</th><th>Nilai</th><th>Status</th><th>Dokumen Sumber</th><th>Aksi</th></tr></thead>
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
                  <span className="sub mono" style={{ fontSize: 10, display: "block", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><FileText size={10} style={{ display: "inline" }} /> {a.dok || "—"}</span>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {idOf("agr", a as unknown as RecRow) && <button className="btn-act" onClick={() => router.push(`/rekam/agr/${idOf("agr", a as unknown as RecRow)}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button>}
                    <RecActions mod="agr" row={a as unknown as RecRow} toast={toast} onEdit={(row) => { setMEdit(row); setMOpen(true); }}
                      onDeleted={(id) => patchTen({ agr: t.agr.filter((x) => idOf("agr", x as unknown as RecRow) !== id) as typeof t.agr })} />
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
          <button className="btn btn-navy" disabled={saving} aria-busy={saving} onClick={() => void save()}>{saving ? "Menyimpan…" : "Simpan"}</button>
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

      <RecordModal mod="agr" open={mOpen} editRow={mEdit} tenantName={t.name} toast={toast} onClose={() => setMOpen(false)} onDone={onDone} />
      {xlsx.modal}
    </ModuleShell>
  );
}
