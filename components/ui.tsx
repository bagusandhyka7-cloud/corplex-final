"use client";
import React from "react";
import { X } from "lucide-react";

export const Chip = ({ c, children }: { c: string; children: React.ReactNode }) => (
  <span className={`chip ${c}`}>{children}</span>
);

export function Row({ b, d, right, onClick, extra }: { b: React.ReactNode; d?: React.ReactNode; right?: React.ReactNode; onClick?: () => void; extra?: React.ReactNode }) {
  return (
    <div className={`row${onClick ? " clickable" : ""}`} onClick={onClick}>
      <div><b>{b}</b>{d ? <span className="d">{d}</span> : null}{extra}</div>
      {right ? <div className="right">{right}</div> : null}
    </div>
  );
}

export function Panel({ title, className, style, children }: { title?: React.ReactNode; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className={`panel ${className || ""}`} style={style}>
      {title ? <h4>{title}</h4> : null}
      {children}
    </div>
  );
}

export function Kpi({ v, label, tr, trCls, ico, onClick }: { v: React.ReactNode; label: React.ReactNode; tr?: React.ReactNode; trCls?: string; ico?: React.ReactNode; onClick?: () => void }) {
  return (
    <div className={`kpi${onClick ? " clickable" : ""}`} onClick={onClick}>
      {ico ? <i className="kico">{ico}</i> : null}
      <b>{v}</b>
      <span>{label}</span>
      {tr ? <span className={`tr ${trCls || "md"}`}>{tr}</span> : null}
    </div>
  );
}

export function Tabs({ items, cur, onSel }: { items: string[]; cur: number; onSel: (i: number) => void }) {
  return (
    <div className="tabs">
      {items.map((t, i) => (
        <button key={t} className={i === cur ? "on" : ""} onClick={() => onSel(i)}>{t}</button>
      ))}
    </div>
  );
}

import { createPortal } from "react-dom";

export function Modal({ open, title, onClose, children, footer, right }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; right?: boolean }) {
  /* Scroll lock: modal terbuka → scrollbar halaman mati, hanya scrollbar form yang hidup. */
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  const content = (
    <div className={`modal-bg${open ? " open" : ""}${right ? " right" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-h"><b>{title}</b><button onClick={onClose} aria-label="Tutup"><X size={17} /></button></div>
        <div className="modal-b">{children}</div>
        {footer ? <div className="modal-f">{footer}</div> : null}
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}

/* Konfirmasi standar Enterprise — drawer kanan, pengganti window.confirm (dilarang).
 * Pakai: `if (!(await askConfirm("Hapus X?"))) return;` — ConfirmHost dimount sekali per shell. */
let openConfirm: ((m: string) => Promise<boolean>) | null = null;
export const askConfirm = (m: string): Promise<boolean> => openConfirm ? openConfirm(m) : Promise.resolve(false);
export function ConfirmHost() {
  const [msg, setMsg] = React.useState<string | null>(null);
  const res = React.useRef<((v: boolean) => void) | null>(null);
  React.useEffect(() => {
    openConfirm = (m) => new Promise((r) => { setMsg(m); res.current = r; });
    return () => { openConfirm = null; };
  }, []);
  const done = (v: boolean) => { setMsg(null); res.current?.(v); res.current = null; };
  return (
    <Modal right open={!!msg} title="Konfirmasi" onClose={() => done(false)}
      footer={<><button className="btn btn-line" onClick={() => done(false)}>Batal</button>
        <button className="btn btn-red" onClick={() => done(true)}>Ya, Lanjutkan</button></>}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--txt)" }}>{msg}</p>
      <div className="note">Tindakan tercatat pada jejak audit.</div>
    </Modal>
  );
}

export function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

export function Timeline({ items }: { items: string[][] }) {
  return (
    <div className="tl">
      {items.map((t, i) => (
        <div key={i} className={`tl-it ${t[3]}`}>
          <span className="dt">{t[0]}</span><b>{t[1]}</b><span>{t[2]}</span>
        </div>
      ))}
    </div>
  );
}

export function Spark({ points, stroke = "url(#sparkStroke)", fill }: { points: string; stroke?: string; fill?: boolean }) {
  return (
    <svg className="spark" viewBox="0 0 300 60" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3A60A6" /><stop offset="1" stopColor="#B08A3E" />
        </linearGradient>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(176,138,62,0.45)" />
          <stop offset="1" stopColor="rgba(176,138,62,.05)" />
        </linearGradient>
      </defs>
      {fill ? <polyline points={`${points} 300,60 0,60`} fill="url(#sparkFill)" stroke="none" /> : null}
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Bantuan jargon (5c-5): istilah hukum + "?" kecil, hover/focus tampilkan 1 kalimat awam. */
export const GLOSARIUM: Record<string, string> = {
  "PKWT": "Kontrak kerja dengan batas waktu (karyawan kontrak).",
  "PKWTT": "Kontrak kerja tanpa batas waktu (karyawan tetap).",
  "LKPM": "Laporan kegiatan penanaman modal yang wajib disetor berkala ke BKPM.",
  "RPTKA": "Rencana penggunaan tenaga kerja asing — wajib sebelum mempekerjakan TKA.",
  "wanprestasi": "Ingkar janji: salah satu pihak tidak memenuhi isi perjanjian.",
  "somasi": "Surat teguran resmi sebelum menempuh jalur hukum.",
  "keputusan sirkuler": "Keputusan pemegang saham yang sah tanpa menggelar rapat fisik.",
  "chain of custody": "Catatan urutan siapa memegang bukti — menjaga bukti sah di persidangan.",
  "uji tuntas": "Pemeriksaan menyeluruh status hukum perusahaan (legal due diligence).",
  "eskalasi": "Meneruskan persoalan ke advokat MRWP untuk ditangani langsung.",
};
export function Jargon({ k, children }: { k: string; children?: React.ReactNode }) {
  const tip = GLOSARIUM[k];
  return (
    <span className="jargon" tabIndex={0} data-tip={tip || k}>
      {children || k}<i>?</i>
    </span>
  );
}

export function ViewHead({ h1, sub, acts }: { en?: string; h1: string; sub?: React.ReactNode; acts?: React.ReactNode }) {
  return (
    <div className="vh">
      <div>
        <h1>{h1}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {acts ? <div className="vh-acts">{acts}</div> : null}
    </div>
  );
}

export function Ring({ score, size = 76 }: { score: number; size?: number }) {
  const deg = Math.max(0, Math.min(100, score)) * 3.6;
  return (
    <div className="ring" style={{ width: size, height: size, background: `conic-gradient(var(--gold) ${deg}deg, var(--sunken) ${deg}deg 360deg)` }}>
      <i>{score}</i>
    </div>
  );
}

/* Markdown ringan (bold/italic) — jawaban AI tampil rapi tanpa simbol bintang.
 * Escape HTML dulu (teks AI = untrusted), lalu **→<b>, *→<i>. */
export const mdHtml = (s: string) => s
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
  .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");
export function Md({ t }: { t: string }) {
  return <span dangerouslySetInnerHTML={{ __html: mdHtml(t) }} />;
}

/* Input rupiah: tampil "6.000.000" saat diketik, nilai balik angka murni. */
export const rpFormat = (v: string | number) => {
  const n = String(v ?? "").replace(/[^\d]/g, "");
  return n ? Number(n).toLocaleString("id-ID") : "";
};
export const rpValue = (v: string) => Number(String(v ?? "").replace(/[^\d]/g, "")) || 0;
export function RpInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--muted)", pointerEvents: "none" }}>Rp</span>
      <input inputMode="numeric" style={{ paddingLeft: 34 }} value={rpFormat(value)} placeholder={placeholder}
        onChange={(e) => onChange(String(rpValue(e.target.value) || ""))} />
    </div>
  );
}
