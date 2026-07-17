"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, BadgeCheck, Bell, Bot, Building2, Coins, FileBadge, FileSignature, FileText,
  Gavel, Gem, HardHat, Landmark, LayoutDashboard, LifeBuoy, Lock, LogOut, Menu, PenLine,
  RadioTower, ReceiptText, Scale, Shield, ShieldCheck, Users, Wrench, CircleUser, ChevronRight, Search,
  Eye, EyeOff, ChevronDown, User, Mail,
} from "lucide-react";
import { ACCOUNTS, TENANTS } from "@/lib/data";
import { useStore, ViewId } from "@/lib/store";
import { api, withRetry } from "@/lib/api";
import { useAsyncAction } from "@/lib/hooks";

import logoMrwp from "./logo-mrwp.svg";

const BrandMark = ({ size, className = "" }: { size?: number, className?: string }) => (
  <img src={(logoMrwp as any).src || logoMrwp} alt="MRWP Logo" className={`object-contain ${className}`} style={size ? { width: size, height: size } : undefined} />
);

/* ===== LOCK SCREEN ===== */
export function LockScreen() {
  const { ten, login, toast } = useStore();
  const [picked, setPicked] = useState(ACCOUNTS[0].tid);
  const acc = ACCOUNTS.find((a) => a.tid === picked)!;
  const t = TENANTS[picked];
  const [email, setEmail] = useState(acc.email);
  const [username, setUsername] = useState(acc.email.split("@")[0]);
  const [pw, setPw] = useState(acc.pw);
  const [showPw, setShowPw] = useState(false);

  const onTenant = (tid: string) => {
    const a = ACCOUNTS.find((x) => x.tid === tid)!;
    setPicked(tid); setEmail(a.email); setUsername(a.email.split("@")[0]); setPw(a.pw);
  };

  const { run: doLogin, pending: loggingIn } = useAsyncAction(async () => {
    if (!username.trim()) { toast("Username wajib diisi", "Lengkapi username untuk melanjutkan.", "warn"); return; }
    if (!pw.trim()) { toast("Kata sandi wajib diisi", "Masukkan kata sandi demo untuk melanjutkan.", "warn"); return; }
    if (pw !== acc.pw) { toast("Autentikasi gagal", "Kata sandi tidak cocok — coba “demo123”.", "warn"); return; }
    const res = await withRetry(() => api.auth.login({ tid: acc.tid, email, password: pw }));
    if (!res.ok) { toast("Autentikasi gagal", res.error.message, "warn"); return; }
    login(acc.tid);
  });

  return (
    <div id="lock" className={ten ? "off" : ""} style={{ padding: 0 }}>
      <style>{`
        #lock{padding:0 !important}
        .cx-card{width:100vw;height:100vh;height:100dvh;display:grid;grid-template-columns:1fr 1fr;background:#fff;overflow:hidden;animation:cxRise .55s cubic-bezier(.2,.8,.25,1) both}
        .cx-left{position:relative;overflow:hidden;color:#fff;background:linear-gradient(155deg,#081020 0%,#0B1526 52%,#0e1c33 100%)}
        .cx-left::before{content:"";position:absolute;inset:-35%;z-index:0;filter:blur(16px);animation:cxDrift 22s ease-in-out infinite alternate;background:
          radial-gradient(38% 38% at 26% 24%,rgba(176,138,62,.55),transparent 62%),
          radial-gradient(44% 44% at 82% 30%,rgba(30,58,107,.85),transparent 60%),
          radial-gradient(52% 52% at 68% 88%,rgba(176,138,62,.34),transparent 62%),
          radial-gradient(46% 46% at 12% 84%,rgba(8,16,32,.95),transparent 60%)}
        .cx-left::after{content:"";position:absolute;inset:-20%;z-index:0;mix-blend-mode:screen;opacity:.6;animation:cxSpin 30s linear infinite;background:conic-gradient(from 0deg at 50% 50%,rgba(176,138,62,.14),transparent 26%,rgba(30,58,107,.18) 52%,transparent 78%,rgba(176,138,62,.14))}
        .cx-dots{position:absolute;inset:0;z-index:1;background-image:radial-gradient(rgba(217,188,128,.28) 1px,transparent 1.6px);background-size:26px 26px;-webkit-mask-image:radial-gradient(115% 90% at 32% 42%,#000 0%,transparent 74%);mask-image:radial-gradient(115% 90% at 32% 42%,#000 0%,transparent 74%);opacity:.8;pointer-events:none}
        .cx-glow{position:absolute;z-index:1;width:560px;height:560px;border-radius:50%;top:-170px;left:-130px;background:radial-gradient(closest-side,rgba(176,138,62,.5),transparent 70%);filter:blur(34px);animation:cxPulse 7s ease-in-out infinite;pointer-events:none}
        .cx-glow.g2{top:auto;left:auto;bottom:-190px;right:-140px;width:480px;height:480px;background:radial-gradient(closest-side,rgba(30,58,107,.6),transparent 70%);animation-delay:2.5s}
        .cx-vig{position:absolute;inset:0;z-index:1;background:radial-gradient(130% 90% at 50% -10%,transparent 42%,rgba(5,10,20,.6) 100%);pointer-events:none}
        .cx-spark{position:absolute;z-index:2;width:3px;height:3px;border-radius:50%;background:#F4E4BC;box-shadow:0 0 9px 2px rgba(217,188,128,.9);animation:cxTwinkle 3.4s ease-in-out infinite;pointer-events:none}
        .cx-body{position:relative;z-index:3;height:100%;padding:clamp(40px,5vw,64px);display:flex;flex-direction:column;justify-content:space-between}
        .cx-right{position:relative;padding:clamp(28px,4vw,56px);display:flex;flex-direction:column;justify-content:center;align-items:center;background:#fff;overflow:auto}
        .cx-form{width:100%;max-width:400px}
        .cx-in{width:100%;border:1px solid #E3E6EE;border-radius:12px;padding:12px 14px;background:#fff;color:#0B1526;font-size:13.5px;outline:none;transition:.18s;box-shadow:0 1px 2px rgba(6,12,26,.04)}
        .cx-in::placeholder{color:#9AA3B2}
        .cx-in:focus{border-color:#B08A3E;box-shadow:0 0 0 4px rgba(176,138,62,.16)}
        .cx-in option{background:#fff;color:#0B1526}
        select.cx-in{appearance:none;-webkit-appearance:none;-moz-appearance:none;cursor:pointer;padding-right:38px}
        .cx-btn{width:100%;border:none;cursor:pointer;border-radius:12px;padding:13px;font-weight:700;font-size:14px;color:#0B1526;background:linear-gradient(135deg,#D9BC80 0%,#B08A3E 62%,#9c7a34 100%);box-shadow:0 12px 26px -10px rgba(176,138,62,.8),inset 0 1px 0 rgba(255,255,255,.4);transition:.18s;letter-spacing:.01em}
        .cx-btn:hover{filter:brightness(1.05);transform:translateY(-1px);box-shadow:0 16px 32px -10px rgba(176,138,62,.9),inset 0 1px 0 rgba(255,255,255,.4)}
        .cx-btn:active{transform:translateY(0)}
        .cx-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#8A93A3;display:grid;place-items:center;padding:4px}
        .cx-eye:hover{color:#0B1526}
        @keyframes cxDrift{0%{transform:translate3d(-4%,-2%,0) scale(1.06)}100%{transform:translate3d(4%,3%,0) scale(1.16)}}
        @keyframes cxSpin{to{transform:rotate(1turn)}}
        @keyframes cxPulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:.9;transform:scale(1.12)}}
        @keyframes cxTwinkle{0%,100%{opacity:.12;transform:scale(.6)}50%{opacity:1;transform:scale(1.35)}}
        @keyframes cxRise{from{opacity:0}to{opacity:1}}
        @media(max-width:820px){.cx-card{grid-template-columns:1fr}.cx-left{display:none}}
      `}</style>

      <div className="cx-card">
        {/* ===== LEFT — hyper-abstract navy+gold ===== */}
        <div className="cx-left">
          <div className="cx-glow" />
          <div className="cx-glow g2" />
          <div className="cx-dots" />
          <div className="cx-vig" />
          {[[18, 22, 0], [30, 68, .6], [52, 40, 1.2], [44, 82, .9], [70, 26, 1.8], [83, 58, .3], [12, 52, 1.5], [62, 74, 2.1], [26, 12, 1.0], [76, 88, 1.7]].map(([tp, lf, d], i) => (
            <span key={i} className="cx-spark" style={{ top: `${tp}%`, left: `${lf}%`, animationDelay: `${d}s` }} />
          ))}

          <div className="cx-body">
            <div className="flex items-center gap-3">
              <img src="/logo-mrwp.svg" alt="MRWP Logo" style={{ width: 54, height: 54, objectFit: "contain" }} />
              <div>
                <b style={{ fontFamily: "var(--serif)", fontSize: 19, letterSpacing: ".02em", display: "block", lineHeight: 1 }}>CORPLEX</b>
                <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: ".22em", color: "#D9BC80" }}>MRWP LAW FIRM</span>
              </div>
            </div>

            <div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".26em", color: "#D9BC80", display: "block", marginBottom: 14 }}>PORTAL KLIEN · MULTI-TENANT</span>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(30px,3.4vw,44px)", lineHeight: 1.16, fontWeight: 700, color: "#fff", margin: 0, maxWidth: 460 }}>
                Rekam hukum hidup, terjaga dengan otoritas penuh.
              </h2>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: "rgba(214,223,238,.72)", marginTop: 16, maxWidth: 380 }}>
                Setiap dokumen, izin, dan perkara — terisolasi per tenant, teraudit, dan siap kapan saja.
              </p>
              <div className="flex items-center gap-2" style={{ marginTop: 24, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".14em", color: "rgba(214,223,238,.55)" }}>
                <ShieldCheck size={13} style={{ color: "#D9BC80" }} /> TLS 1.3 · MFA · ROW-LEVEL SECURITY
              </div>
            </div>
          </div>
        </div>

        {/* ===== RIGHT — login form ===== */}
        <div className="cx-right">
          <div className="cx-form">
          <img src="/logo-mrwp.svg" alt="MRWP Logo" style={{ width: 46, height: 46, objectFit: "contain", marginBottom: 18 }} />
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 700, color: "#0B1526", margin: 0 }}>Masuk ke Portal</h2>
          <p style={{ fontSize: 12.5, color: "#6B7280", marginTop: 6, marginBottom: 22, lineHeight: 1.55 }}>
            Autentikasi tenant untuk membuka rekam hukum perusahaan Anda.
          </p>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#0B1526", display: "block", marginBottom: 6 }}>Nama Perusahaan</label>
              <div style={{ position: "relative" }}>
                <select className="cx-in" value={picked} onChange={(e) => onTenant(e.target.value)}>
                  {ACCOUNTS.map((a) => <option key={a.tid} value={a.tid}>{TENANTS[a.tid].name}</option>)}
                </select>
                <ChevronDown size={16} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3", pointerEvents: "none" }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#0B1526", display: "block", marginBottom: 6 }}>Email Terdaftar</label>
              <div style={{ position: "relative" }}>
                <input className="cx-in" style={{ paddingLeft: 40 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="legal@perusahaan.co.id" />
                <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3" }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#0B1526", display: "block", marginBottom: 6 }}>Username</label>
              <div style={{ position: "relative" }}>
                <input className="cx-in" style={{ paddingLeft: 40 }} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
                <User size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3" }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#0B1526", display: "block", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input className="cx-in" style={{ paddingLeft: 40, paddingRight: 40 }} type={showPw ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }} placeholder="Kata sandi" />
                <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3" }} />
                <button type="button" className="cx-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Sembunyikan sandi" : "Tampilkan sandi"}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button className="cx-btn" style={{ marginTop: 4, opacity: loggingIn ? 0.75 : undefined, cursor: loggingIn ? "wait" : undefined }} disabled={loggingIn} onClick={() => void doLogin()} aria-busy={loggingIn}>{loggingIn ? "Memverifikasi…" : "Login"}</button>

            <p style={{ textAlign: "center", fontSize: 12.5, color: "#6B7280", margin: "2px 0 0" }}>
              Lupa sandi? <button type="button" onClick={() => toast("Laporan diteruskan", "Permintaan reset sandi dikirim ke advokat MRWP — Anda akan dihubungi via kanal resmi.", "ok")} style={{ background: "none", border: "none", cursor: "pointer", color: "#B08A3E", fontWeight: 700, fontSize: 12.5, padding: 0 }}>Lapor advokat MRWP</button>
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== SIDEBAR ===== */
export const NAV: { v: ViewId; label: string; icon: React.ReactNode; section: string }[] = [
  { v: "ringkasan", label: "Ringkasan Rekam Hukum", icon: <LayoutDashboard size={16} />, section: "BERANDA" },
  { v: "lawyer", label: "Lawyer MRWP", icon: <Gavel size={16} />, section: "BERANDA" },
  { v: "assistant", label: "Legal AI Assistant", icon: <Bot size={16} />, section: "ARTIFICIAL INTELLIGENCE" },
  { v: "drafter", label: "Legal Drafter", icon: <PenLine size={16} />, section: "ARTIFICIAL INTELLIGENCE" },
  { v: "employment", label: "Employment", icon: <Users size={16} />, section: "LEGAL OPERATIONS" },
  { v: "licensing", label: "Licensing", icon: <FileBadge size={16} />, section: "LEGAL OPERATIONS" },
  { v: "corpsec", label: "Corporate Secretary", icon: <Landmark size={16} />, section: "LEGAL OPERATIONS" },
  { v: "asset", label: "Asset & IP", icon: <Gem size={16} />, section: "LEGAL OPERATIONS" },
  { v: "case", label: "Case Management", icon: <Scale size={16} />, section: "LEGAL OPERATIONS" },
  { v: "tools", label: "Legal Tools", icon: <Wrench size={16} />, section: "LEGAL OPERATIONS" },
  { v: "agreement", label: "Agreement Management", icon: <FileSignature size={16} />, section: "LEGAL OPERATIONS" },
  { v: "asuransi", label: "Manajemen Asuransi", icon: <ShieldCheck size={16} />, section: "LEGAL OPERATIONS" },
  { v: "pajak", label: "Kepatuhan Pajak", icon: <ReceiptText size={16} />, section: "LEGAL OPERATIONS" },
  { v: "logout" as ViewId, label: "Keluar", icon: <LogOut size={16} />, section: "LEGAL OPERATIONS" },
];

export function Sidebar({ open, onClose, isCollapsed }: { open: boolean; onClose: () => void; isCollapsed?: boolean }) {
  const { view, go, queueCount, logout } = useStore();
  const asideRef = useRef<HTMLElement>(null);
  const inkRef = useRef<HTMLElement>(null);
  const sections = Array.from(new Set(NAV.map((n) => n.section)));

  useEffect(() => {
    const move = () => {
      const aside = asideRef.current;
      const ink = inkRef.current;
      if (!aside || !ink) return;
      const s = aside.getBoundingClientRect();
      const on = aside.querySelector(".on");
      if (!on) { ink.style.opacity = "0"; return; }
      ink.style.opacity = "1";
      const r = on.getBoundingClientRect();
      ink.style.height = r.height + "px";
      ink.style.transform = `translateY(${r.top - s.top + aside.scrollTop}px)`;
    };
    move();
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [view]);

  return (
    <aside ref={asideRef} className={`sidebar${open ? " open" : ""}`} style={isCollapsed ? { overflowX: "hidden" } : undefined}>
      <i id="sbInk" ref={inkRef} />
      <div className={`sb-brand ${isCollapsed ? "!px-0 !justify-center" : ""}`}>
        <BrandMark className="w-10 h-10 scale-[1.85] origin-center" />
        <div className={isCollapsed ? "!hidden" : ""}><b>CORPLEX</b><span>MRWP LAW FIRM</span></div>
      </div>
      {sections.map((sec) => (
        <React.Fragment key={sec}>
          <div className={`sb-label ${isCollapsed ? "!hidden" : ""}`}>{sec}</div>
          <div className="sb-nav">
            {NAV.filter((n) => n.section === sec).map((n) => (
              <button key={n.v} className={`${view === n.v ? "on" : ""} ${isCollapsed ? "!p-0 !h-10 !w-full !justify-center" : ""}`} onClick={() => {
                if (n.v === "logout" as any) logout();
                else { go(n.v); onClose(); }
              }}>
                {n.icon}
                <span className={isCollapsed ? "!hidden" : ""}>{n.label}</span>
                {n.v === "lawyer" && !isCollapsed ? <span className="bdg">{queueCount}</span> : null}
              </button>
            ))}
          </div>
        </React.Fragment>
      ))}
      <div className={`sb-foot ${isCollapsed ? "!hidden" : ""}`}>
        <div className="chainline">AI <i>→</i> LAWYER <i>→</i> CLIENT</div>
        <span className="mono">TERCATAT · TERJAGA · TERJAMIN</span>
        <span className="mono">© 2026 MRWP LAW FIRM · CONFIDENTIAL</span>
      </div>
    </aside>
  );
}

/* ===== TOPBAR ===== */
const BELL_ICONS: Record<string, React.ReactNode> = {
  shield: <Shield size={16} />, users: <Users size={16} />, scroll: <FileSignature size={16} />,
  file: <FileText size={16} />, landmark: <Landmark size={16} />, radar: <RadioTower size={16} />,
  receipt: <ReceiptText size={16} />, lifebuoy: <ShieldCheck size={16} />, hardhat: <HardHat size={16} />,
  coins: <Coins size={16} />, lock: <Lock size={16} />, badge: <BadgeCheck size={16} />,
};

export function Topbar({ onBurger }: { onBurger: () => void }) {
  const { ten, view, go, logout } = useStore();
  const [q, setQ] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  if (!ten) return null;
  const hits = q.trim() ? ten.idx.filter((x) => (x.t + " " + x.s).toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];
  const modTitle = NAV.find((n) => n.v === view)?.label || "Ringkasan";
  return (
    <div className="topbar">
      <button className="burger !flex items-center justify-center" onClick={onBurger} aria-label="Menu" style={{ display: 'flex' }}>
        <ChevronRight size={16} />
      </button>
      
      <div className="ent"><Building2 size={15} /> {ten.name} <span className="badge-plan">{ten.plan}</span></div>
      
      <div className="search ml-4 mr-6">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--txt2)]">
          <Search size={16} />
        </div>
        <input
          className="w-full !pl-9"
          placeholder="Cari dalam rekam hukum — dokumen, perjanjian, izin, perkara, karyawan…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setResOpen(!!e.target.value.trim()); }}
          onBlur={() => setTimeout(() => setResOpen(false), 200)}
        />
        <div className={`search-res${resOpen ? " open" : ""}`}>
          {hits.length ? hits.map((h, i) => (
            <button key={i} onMouseDown={() => { go(h.v as ViewId); setQ(""); setResOpen(false); }}>
              <b>{h.t}</b><span>{h.s}</span>
            </button>
          )) : q.trim() ? (
            <button><b>Tidak ditemukan</b><span>Coba kata kunci lain — pencarian FTS lintas {ten.kpiDocs} dokumen rekam</span></button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <div className="jaga-live"><span className="pulse" /><span>FUNGSI JAGA AKTIF</span></div>
        
        <div style={{ position: "relative" }}>
          <button className="bell" onClick={() => setBellOpen(!bellOpen)} aria-label="Notifikasi"><Bell size={15} /><span className="dot" /></button>
          <div className={`bell-drop${bellOpen ? " open" : ""}`}>
            <h6>PENGINGAT FUNGSI JAGA — {ten.bell.length} AKTIF</h6>
            <div>
              {ten.bell.map((b, i) => (
                <button key={i} className="bell-item" onClick={() => { go(b[3] as ViewId); setBellOpen(false); }}>
                  {BELL_ICONS[b[0]] || <Bell size={15} />}
                  <div><b>{b[1]}</b><span>{b[2]}</span></div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="cursor-pointer flex items-center justify-center w-[38px] h-[38px] rounded-[10px] border border-[var(--line)] bg-[var(--sur)] hover:border-[var(--blue-400)] transition-all" title="Sesi aktif">
          <CircleUser size={30} style={{ color: "var(--txt2)" }} />
        </div>
      </div>
    </div>
  );
}

/* ===== TOASTS ===== */
export function Toasts() {
  const { toasts } = useStore();
  return (
    <div id="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.k || ""}`}><b>{t.t}</b><span>{t.d}</span></div>
      ))}
    </div>
  );
}
