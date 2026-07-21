"use client";
/* Layout standar modul berbasis data — format Database Karyawan:
 * [judul submenu] · [dropzone Ekstrak AI lebar] · [filter kiri | search kanan] · [konten].
 * Satu komponen dipakai Aset, Asuransi, Perizinan, Perkara, Sekretaris, Perjanjian. */
import React, { useRef } from "react";
import { Upload } from "lucide-react";
import { ViewHead } from "@/components/ui";

/* Singkatan resmi boleh kapital semua; label lain jadi Title Case (aturan hierarki owner). */
const ABBR = new Set(["TKI", "TKA", "PKWT", "PKWTT", "PTUN", "KBLI", "HKI", "SP1", "SP2", "SP3", "LKPM", "NIB", "SPT", "PPN", "PPH"]);
const chipLabel = (x: string) => x === "semua" ? "Semua"
  : x.split(/\s+/).map((w) => ABBR.has(w.toUpperCase()) && w === w.toUpperCase() ? w : /^[A-Z0-9&]+$/.test(w) ? w[0] + w.slice(1).toLowerCase() : w).join(" ");

export function ModuleShell({
  h1, sub, acts, kpi, dropNote, onDrop, filters, active, onFilter, q, setQ, cariPh, children,
}: {
  h1: string; sub?: string; acts?: React.ReactNode;
  /* Hierarki baku: Judul → KPI → Ekstrak → Search+Kategori → Tabel */
  kpi?: React.ReactNode;
  /* dropNote/onDrop dihilangkan pada menu murni pemantauan (mis. Digital Vault) */
  dropNote?: string; onDrop?: (f: File) => void;
  filters?: string[]; active?: string; onFilter?: (f: string) => void;
  q?: string; setQ?: (v: string) => void; cariPh?: string;
  children: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <ViewHead h1={h1} sub={sub} acts={acts} />

      {kpi}

      {onDrop && (
        <>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onDrop(f); e.target.value = ""; }} />
          <div className="dropzone mb16" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gold)"; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = ""; const f = e.dataTransfer.files?.[0]; if (f) onDrop(f); }}>
            <b><Upload size={14} style={{ display: "inline", marginRight: 6 }} />Letakkan dokumen di sini — atau klik untuk memilih berkas</b>
            {dropNote}
          </div>
        </>
      )}

      {/* S2: search KIRI · kategori KANAN — seragam semua modul; tanpa kategori = chip "Semua" agar struktur sejajar */}
      {(filters || setQ) && (
        <div style={{ display: "flex", alignItems: "stretch", gap: 12, marginBottom: 16 }}>
          {setQ && <input className="finput" style={{ flex: 1, minWidth: 0, margin: 0 }} placeholder={cariPh || "Cari…"} value={q ?? ""} onChange={(e) => setQ(e.target.value)} />}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {(filters || ["semua"]).map((x) => (
              <button key={x} className={`fchip${(active ?? "semua") === x ? " on" : ""}`} onClick={() => onFilter?.(x)}>{chipLabel(x)}</button>
            ))}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
