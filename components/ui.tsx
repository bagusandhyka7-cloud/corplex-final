"use client";
import React from "react";
import { X } from "lucide-react";
import type { VqMsg } from "@/lib/api";

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

/* Batasi daftar pada N baris pertama lalu gulir di dalam wadahnya sendiri.
 * Tingginya DIUKUR dari baris ke-N yang benar-benar tergambar, bukan ditebak lewat angka px:
 * tinggi baris di modul ini berkisar 65–248px (teks membungkus berbeda-beda), sehingga
 * max-height tetap pasti memotong di tengah baris atau menyisakan ruang kosong. */
/* Pratinjau dokumen (gambar/PDF) dengan URL bertanda tangan. Bucket privat sejak penutupan
 * kebocoran storage, jadi src mentah dari DB tak lagi bisa dipakai langsung. */
export function DokPratinjau({ url, judul, tinggi }: { url?: string | null; judul?: string; tinggi?: number | string }) {
  const [src, setSrc] = React.useState<string | null>(null);
  const [gagal, setGagal] = React.useState(false);
  React.useEffect(() => {
    let batal = false;
    setSrc(null); setGagal(false);
    if (!url) return;
    void import("@/lib/dok").then(({ urlDok }) => urlDok(url).then((s) => {
      if (batal) return;
      if (s) setSrc(s); else setGagal(true);
    }));
    return () => { batal = true; };
  }, [url]);
  const gaya: React.CSSProperties = { flex: 1, height: tinggi, border: "none", background: "#fff" };
  if (gagal) return <div className="note" style={{ margin: 0, padding: 18 }}>Dokumen tak dapat ditampilkan — berkas tidak ditemukan atau Anda tak berhak mengaksesnya.</div>;
  if (!src) return <div className="note" style={{ margin: 0, padding: 18 }}>Menyiapkan dokumen…</div>;
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url || "")
    ? <div style={{ flex: 1, overflow: "auto", display: "grid", placeItems: "center", background: "#0A1830", height: tinggi }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={judul || "Dokumen"} style={{ maxWidth: "100%", maxHeight: "100%" }} />
      </div>
    : <iframe src={src} style={gaya} title={judul || "Dokumen"} />;
}

export function Batas({ n = 5, className, children }: { n?: number; className?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [h, setH] = React.useState<number>();
  const jml = React.Children.count(children);
  React.useLayoutEffect(() => {
    const ukur = () => {
      const el = ref.current;
      if (!el) return;
      const anak = [...el.children] as HTMLElement[];
      if (anak.length <= n) return setH(undefined);
      const a = anak[0], b = anak[n - 1];
      setH(b.offsetTop + b.offsetHeight - a.offsetTop + 6); // +6: sisakan sedikit agar baris ke-6 terlihat terpotong (isyarat masih ada lanjutannya)
    };
    ukur();
    window.addEventListener("resize", ukur);
    return () => window.removeEventListener("resize", ukur);
  }, [jml, n, children]);
  return (
    <div ref={ref} className={className}
      style={h ? { maxHeight: h, overflowY: "auto", paddingRight: 6 } : undefined}>
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

/* onHapus opsional: dipakai modul yang barisnya boleh dikoreksi pemakai (mis. tahapan RUPS).
 * Tanpa prop ini perilaku lama tak berubah — nol tombol baru di pemanggil yang tak meminta. */
export function Timeline({ items, onHapus }: { items: string[][]; onHapus?: (i: number) => void }) {
  return (
    <div className="tl">
      {items.map((t, i) => (
        <div key={i} className={`tl-it ${t[3]}`}>
          <span className="dt">{t[0]}</span><b>{t[1]}</b><span>{t[2]}</span>
          {onHapus && <button className="btn-act" style={{ marginTop: 6 }} onClick={() => onHapus(i)}>Hapus</button>}
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

/* Utas percakapan pengajuan advokat (verification_queue.msgs). Dipakai dua sisi:
 * portal klien (Lawyer) & Konsol Advokat (/adminmrwp) — `me` cuma menentukan kata "Anda". */
export function VqThread({ msgs, me }: { msgs: VqMsg[]; me: "advokat" | "klien" }) {
  if (!msgs.length) return <p className="note" style={{ margin: 0 }}>Belum ada percakapan pada pengajuan ini.</p>;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {msgs.map((m, i) => {
        const mine = m.by === me;
        return (
          <div key={i} style={{
            border: "1px solid var(--line2)", borderRadius: 10, padding: "10px 12px",
            borderLeft: `3px solid ${m.by === "advokat" ? "var(--gold-bright)" : "#5F84C4"}`,
            background: mine ? "rgba(255,255,255,.03)" : "transparent",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
              <b style={{ fontSize: 11.5, letterSpacing: ".04em", color: m.by === "advokat" ? "var(--gold-bright)" : "#8FB0E0" }}>
                {m.by === "advokat" ? "ADVOKAT MRWP" : "KLIEN"}{mine ? " (Anda)" : ""}
              </b>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{new Date(m.at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--ink)", whiteSpace: "pre-wrap", margin: 0 }}>{m.text}</p>
            {m.dok_url && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {/* URL mentah tak lagi dipasang di DOM: bucket privat, tautan ditandatangani
                    saat diklik dan hanya berlaku beberapa menit. */}
                <button className="btn btn-line btn-sm" onClick={() => void import("@/lib/dok").then(({ bukaDok }) => bukaDok(m.dok_url, alert))}>Buka {m.dok_nama || "lampiran"}</button>
                <button className="btn btn-navy btn-sm" onClick={() => void import("@/lib/dok").then(({ unduhDok }) => unduhDok(m.dok_url, m.dok_nama, alert))}>Unduh</button>
              </div>
            )}
            <HashChip hash={m.dok_hash} label="SHA-256 lampiran" />
          </div>
        );
      })}
    </div>
  );
}

/* Sidik SHA-256 isi dokumen. Sengaja mengembalikan null bila hash belum ada — dokumen lama
 * (dan yang gagal dihitung) tak boleh menampilkan klaim integritas apa pun, sekalipun berupa
 * placeholder. Klaim hash pernah dicabut total dari UI pada 27 Jul karena tak berdasar;
 * ia hanya boleh kembali bersama nilainya yang nyata. */
export function HashChip({ hash, label = "SHA-256 isi dokumen" }: { hash?: string | null; label?: string }) {
  const [buka, setBuka] = React.useState(false);
  if (!hash) return null;
  return (
    <div style={{ marginTop: 8, fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--mono)", wordBreak: "break-all", lineHeight: 1.6 }}
      title="Diverifikasi server dari isi berkas yang tersimpan — bukan dari nama berkas.">
      <span style={{ color: "var(--gold-bright)", letterSpacing: ".08em" }}>{label}</span>{" "}
      <button className="btn-act" style={{ padding: 0, background: "none", border: "none", color: "inherit", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}
        onClick={() => setBuka(!buka)}>
        {buka ? hash : hash.slice(0, 16) + "…"}
      </button>
    </div>
  );
}
