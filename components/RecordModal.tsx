"use client";
/* Modal CRUD generik modul (lic/assets/hki/pol/agr) — satu mesin, spec dari lib/records.ts.
 * Dipakai: <RecordModal mod="lic" open editRow onClose onDone /> + tombol Edit/Hapus via recActions. */
import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { idOf, RecRow, SPECS, stripId, withId } from "@/lib/records";
import { askConfirm, Field, Modal } from "@/components/ui";

const tidNow = () => localStorage.getItem("corplex_tid") || "";

export function RecordModal({ mod, open, editRow, tenantName, onClose, onDone, toast, prefill, prefillFile }: {
  mod: string; open: boolean; editRow: RecRow | null; tenantName: string;
  onClose: () => void;
  onDone: (row: RecRow, editId: string | null) => void;
  toast: (t: string, d: string, k?: string) => void;
  prefill?: Record<string, string>;      // rekam baru diisi hasil ekstraksi AI (dikonfirmasi user sebelum Simpan)
  prefillFile?: File | null;             // dokumen sumber ikut tersimpan
}) {
  const spec = SPECS[mod];
  const editId = editRow ? idOf(mod, editRow) || null : null;
  const [v, setV] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  /* Berkas: `file` = unggahan baru · `dokLama` = berkas tersimpan · `hapusDok` = tandai buang */
  const [file, setFile] = useState<File | null>(null);
  const [dokLama, setDokLama] = useState<{ url: string; nama: string } | null>(null);
  const [hapusDok, setHapusDok] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const blank = Object.fromEntries(spec.fields.map((f) => [f.k, f.opts ? f.opts[0] : ""]));
    // rekam baru + prefill AI: blank ditimpa nilai ekstraksi (hanya key yang berisi); mode edit tak terpengaruh.
    setV(editRow ? spec.fromData(stripId(mod, editRow)) : { ...blank, ...Object.fromEntries(Object.entries(prefill || {}).filter(([, val]) => val)) });
    setFile(editRow ? null : prefillFile || null); setHapusDok(false); setDokLama(null);
    // mode edit: ambil berkas tersimpan supaya bisa diganti/dihapus
    if (editId) void api.records.get(editId).then((r) => { if (r.ok && r.data.dok_url) setDokLama({ url: r.data.dok_url, nama: r.data.dok_nama || "dokumen" }); });
  }, [open, editRow, mod]); // eslint-disable-line react-hooks/exhaustive-deps

  const simpan = async () => {
    const wajib = spec.fields.find((f) => f.l.includes("*") && !(v[f.k] || "").trim());
    if (wajib) { toast("Data belum lengkap", `${wajib.l.replace(" *", "")} wajib diisi.`, "warn"); return; }
    setSaving(true);
    const data = spec.toData(v, tenantName);

    let dok: { url: string; nama: string } | null | undefined;
    if (file) {
      const up = await api.records.uploadDoc(tidNow(), file);
      if (!up.ok) { setSaving(false); toast("Gagal mengunggah berkas", up.error.message, "warn"); return; }
      dok = up.data;
    } else if (hapusDok) dok = null;

    const res = editId
      ? await api.records.update(editId, data, dok)
      : await api.records.create(tidNow(), mod, data, "manual", dok ?? undefined);
    setSaving(false);
    if (!res.ok) { toast("Gagal menyimpan", res.error.message, "warn"); return; }
    const id = editId || (res.data as { id: string }).id;
    onDone(withId(mod, data, id), editId);
    onClose();
    toast(editId ? `${spec.title} diperbarui` : `${spec.title} tercatat`, "Tersimpan ke rekam tenant — seluruh layar terkait ikut ter-update.", "ok");
  };

  return (
    <Modal right open={open} title={`${editId ? "Edit" : "Tambah"} ${spec.title}`} onClose={onClose}
      footer={<><button className="btn btn-line" onClick={onClose}>Batal</button>
        <button className="btn btn-gold" disabled={saving} aria-busy={saving} onClick={() => void simpan()}>{saving ? "Menyimpan…" : editId ? "Simpan" : "Simpan"}</button></>}>
      {/* Format Employment: field pendek berpasangan 2 kolom, presisi sejajar */}
      <div className="grid g2" style={{ gap: 10, gridAutoRows: "min-content" }}>
        {spec.fields.map((f, i) => (
          <div key={f.k} className="field" style={i === 0 ? { gridColumn: "1 / -1" } : undefined}>
            <label>{f.l}</label>
            {f.opts
              ? <select value={v[f.k] || f.opts[0]} onChange={(e) => setV({ ...v, [f.k]: e.target.value })}>{f.opts.map((o) => <option key={o}>{o}</option>)}</select>
              : <input value={v[f.k] || ""} placeholder={f.ph} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />}
          </div>
        ))}
      </div>
      {/* Berkas pendukung → bucket module-docs; tampil di panel kanan halaman detail */}
      <Field label="Dokumen pendukung (PDF / gambar)">
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setHapusDok(false); } e.target.value = ""; }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-line btn-sm" onClick={() => fileRef.current?.click()}>
            {file || (dokLama && !hapusDok) ? "Ganti berkas" : "Pilih berkas"}
          </button>
          <span className="sub" style={{ fontSize: 11, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
            {file ? file.name : hapusDok ? "berkas akan dihapus saat disimpan" : dokLama ? dokLama.nama : "belum ada berkas"}
          </span>
          {(file || (dokLama && !hapusDok)) && (
            <button type="button" className="btn btn-red btn-sm" onClick={() => { setFile(null); if (dokLama) setHapusDok(true); }}>
              <Trash2 size={11} /> Hapus
            </button>
          )}
        </div>
      </Field>
      <div className="note">Rekam tersimpan per-tenant di database — berkas asli masuk vault dan bisa dibaca lewat tombol <b>Buka</b> pada tabel.</div>
    </Modal>
  );
}

/* Kebab generik — dipakai tabel yang BUKAN module_records (mis. karyawan). */
export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button className="rec-dots" title="Opsi" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}><MoreHorizontal size={14} /></button>
      {open && (
        <div className="rec-menu" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setOpen(false); onEdit(); }}><Pencil size={11} /> Edit</button>
          <button className="del" onClick={() => { setOpen(false); onDelete(); }}><Trash2 size={11} /> Hapus</button>
        </div>
      )}
    </div>
  );
}

/* Aksi baris = ikon titik-tiga (Edit / Hapus). Minimalis & seragam di semua modul.
 * Baris tanpa id DB (seed) tidak menampilkan apa pun. */
export function RecActions({ mod, row, onEdit, onDeleted, toast }: {
  mod: string; row: RecRow;
  onEdit: (row: RecRow) => void;
  onDeleted: (id: string) => void;
  toast: (t: string, d: string, k?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = idOf(mod, row);

  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);

  if (!id) return <span className="sub mono" style={{ fontSize: 9 }} title="Data peraga — bukan rekam DB">SEED</span>;

  const hapus = async () => {
    setOpen(false);
    if (!(await askConfirm("Hapus rekam ini?"))) return;
    const r = await api.records.remove(id);
    if (!r.ok) return toast("Gagal menghapus", r.error.message, "warn");
    onDeleted(id);
  };

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button className="rec-dots" title="Opsi rekam" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}><MoreHorizontal size={14} /></button>
      {open && (
        <div className="rec-menu" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setOpen(false); onEdit(row); }}><Pencil size={11} /> Edit</button>
          <button className="del" onClick={() => void hapus()}><Trash2 size={11} /> Hapus</button>
        </div>
      )}
    </div>
  );
}
