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

export function Panel({ title, className, children }: { title?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={`panel ${className || ""}`}>
      {title ? <h4>{title}</h4> : null}
      {children}
    </div>
  );
}

export function Kpi({ v, label, tr, trCls, ico, onClick }: { v: React.ReactNode; label: string; tr?: React.ReactNode; trCls?: string; ico?: React.ReactNode; onClick?: () => void }) {
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

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className={`modal-bg${open ? " open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-h"><b>{title}</b><button onClick={onClose} aria-label="Tutup"><X size={17} /></button></div>
        <div className="modal-b">{children}</div>
        {footer ? <div className="modal-f">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
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

export function ViewHead({ en, h1, sub, acts }: { en: string; h1: string; sub?: React.ReactNode; acts?: React.ReactNode }) {
  return (
    <div className="vh">
      <div>
        <span className="en">{en}</span>
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
