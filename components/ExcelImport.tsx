"use client";
/* Impor Excel massal per-modul — LEWAT DROPZONE (bukan tombol). Template diunduh di Alat Legal.
 * useExcelImport(mod): tryFile(file) → true bila .xlsx (buka pratinjau), false bila bukan (caller lanjut jalur dokumen/AI).
 * Bungkus mesin deterministik parseWorkbook/toPayload (teruji). */
import React, { useState } from "react";
import { Modal } from "@/components/ui";
import { api, empToRow } from "@/lib/api";
import { parseWorkbook, toPayload, SHEETS, ParsedItem } from "@/lib/impor";
import { useStore } from "@/lib/store";

const tid = () => localStorage.getItem("corplex_tid") || "";

export function useExcelImport(mod: string) {
  const { ten, toast } = useStore();
  const [prev, setPrev] = useState<ParsedItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [prog, setProg] = useState(0);

  /* true = file Excel (pratinjau dibuka); false = bukan Excel (caller tangani sebagai dokumen/AI). */
  const tryFile = (file: File): boolean => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) return false;
    void (async () => {
      const r = parseWorkbook(await file.arrayBuffer());
      const items = r.items.filter((x) => x.mod === mod); // hanya sheet modul ini
      if (!items.length) { toast("Tak ada baris valid", "Gunakan template yang sesuai (unduh di Alat Legal) — periksa header & isi.", "warn"); return; }
      setPrev(items);
    })();
    return true;
  };

  const simpan = async () => {
    if (!prev) return;
    setSaving(true); setProg(0);
    const name = ten?.name || ""; let ok = 0, gagal = 0;
    for (let i = 0; i < prev.length; i++) {
      const p = toPayload(prev[i], name);
      const res = mod === "emp"
        ? await api.employees.create(tid(), empToRow(p as unknown as Parameters<typeof empToRow>[0], "excel"))
        : await api.records.create(tid(), mod, p, "excel");
      res.ok ? ok++ : gagal++;
      setProg(Math.round(((i + 1) / prev.length) * 100));
    }
    setSaving(false); setPrev(null);
    toast("Impor selesai", `${ok} tersimpan${gagal ? ` · ${gagal} gagal` : ""}. Memuat ulang…`, gagal ? "warn" : "ok");
    if (ok) setTimeout(() => location.reload(), 1200); // hidrasi DB ulang → seluruh layar ikut
  };

  /* Kolom pratinjau = 4 field pertama form modul ini (label sama persis dengan template/form),
   * + berapa kolom terisi per baris supaya terlihat data lengkap ikut terbawa. */
  const spec = SHEETS.find((s) => s.mod === mod);
  const kolom = (spec?.fields || []).slice(0, 4);
  /* Kolom ber-opsi yang isinya di luar daftar sah — TIDAK memblokir, tapi wajib terlihat.
   * (mis. "Golongan Darah = C" atau "SIM = B" lolos diam-diam sebelum ini.) */
  const peringatan = (prev || []).flatMap((it) =>
    (spec?.fields || [])
      .filter((f) => f.opts && it.vals[f.k] && !f.opts.some((o) => o.toLowerCase() === it.vals[f.k].trim().toLowerCase()))
      .map((f) => `${it.label || "(tanpa nama)"} — ${f.l.replace(" *", "")}: "${it.vals[f.k]}" tidak ada di daftar (${f.opts!.join(" / ")})`)
  );

  const modal = (
    <Modal right open={!!prev} title="Pratinjau Impor Excel" onClose={() => setPrev(null)}
      footer={<><button className="btn btn-line" onClick={() => setPrev(null)}>Batal</button>
        <button className="btn btn-gold" disabled={saving} aria-busy={saving} onClick={() => void simpan()}>{saving ? `Menyimpan… ${prog}%` : `Simpan ${prev?.length || 0} Baris`}</button></>}>
      <div className="note" style={{ marginBottom: 12 }}><b>{prev?.length || 0}</b> baris terbaca. Kolom di bawah hanya ringkasan — <b>seluruh kolom yang Anda isi tetap tersimpan</b> (lihat angka “kolom terisi”).</div>
      {peringatan.length > 0 && (
        <div className="note" style={{ marginBottom: 12, borderLeft: "3px solid var(--gold)" }}>
          <b>{peringatan.length} nilai di luar daftar pilihan</b> — tetap bisa disimpan, tetapi periksa dulu:
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
            {peringatan.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
      <div className="tblwrap" style={{ maxHeight: 380 }}>
        {/* minWidth:0 mengalahkan aturan global table{min-width:640px} — tanpa ini tabel terpotong di drawer */}
        <table style={{ minWidth: 0 }}>
          <thead><tr>{kolom.map((f) => <th key={f.k}>{f.l.replace(" *", "")}</th>)}<th>Kolom terisi</th></tr></thead>
          <tbody>
            {prev?.map((it, i) => (
              <tr key={i}>
                {kolom.map((f, j) => <td key={f.k}>{j === 0 ? <b>{it.vals[f.k] || "—"}</b> : (it.vals[f.k] || "—")}</td>)}
                <td>{Object.values(it.vals).filter(Boolean).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );

  return { tryFile, modal };
}
