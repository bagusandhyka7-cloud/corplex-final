"use client";
/* Impor Excel massal per-modul — LEWAT DROPZONE (bukan tombol). Template diunduh di Alat Legal.
 * useExcelImport(mod): tryFile(file) → true bila .xlsx (buka pratinjau), false bila bukan (caller lanjut jalur dokumen/AI).
 * Bungkus mesin deterministik parseWorkbook/toPayload (teruji). */
import React, { useState } from "react";
import { Modal } from "@/components/ui";
import { api, empToRow } from "@/lib/api";
import { parseWorkbook, toPayload, ParsedItem } from "@/lib/impor";
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

  const modal = (
    <Modal open={!!prev} title="Pratinjau Impor Excel" onClose={() => setPrev(null)}
      footer={<><button className="btn btn-line" onClick={() => setPrev(null)}>Batal</button>
        <button className="btn btn-gold" disabled={saving} aria-busy={saving} onClick={() => void simpan()}>{saving ? `Menyimpan… ${prog}%` : `Simpan ${prev?.length || 0} Baris`}</button></>}>
      <div className="note" style={{ marginBottom: 12 }}><b>{prev?.length || 0}</b> baris terbaca dari template. Seluruh kolom terisi ikut tersimpan; periksa lalu simpan (koreksi detail via Edit setelah tersimpan).</div>
      <div className="tblwrap" style={{ maxHeight: 320 }}>
        <table><thead><tr><th>Baris siap disimpan</th></tr></thead>
          <tbody>{prev?.map((it, i) => <tr key={i}><td><b>{it.label || "—"}</b></td></tr>)}</tbody>
        </table>
      </div>
    </Modal>
  );

  return { tryFile, modal };
}
