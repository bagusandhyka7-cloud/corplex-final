"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  BadgeCheck, Bell, Bot, Building2, Coins, FileBadge, FileSignature, FileText, Gavel, Gem,
  HardHat, Landmark, LayoutDashboard, Lock, LogOut, PenLine, RadioTower, ReceiptText, Scale,
  Shield, ShieldCheck, Users, Wrench, CircleUser, ChevronDown, ChevronRight, Search,
  Home, Sparkles, Briefcase, FileSearch,
  BarChart3, IdCard, FileWarning, Calculator, Copyright, Vault, Umbrella, ClipboardList, Link2, CalendarDays, FileUp,
} from "lucide-react";
import { useStore, ViewId } from "@/lib/store";
import { ROUTE } from "@/lib/routes";
import { useRouter, usePathname } from "next/navigation";

import logoMrwp from "./logo-mrwp.svg";

const BrandMark = ({ size, className = "" }: { size?: number, className?: string }) => (
  <img src={(logoMrwp as any).src || logoMrwp} alt="MRWP Logo" className={`object-contain ${className}`} style={size ? { width: size, height: size } : undefined} />
);

/* ===== SIDEBAR ===== */
export const NAV: { v: ViewId; label: string; icon: React.ReactNode; section: string; subItems?: { label: string; tab: number; icon?: React.ReactNode }[] }[] = [
  { v: "ringkasan", label: "Ringkasan", icon: <LayoutDashboard size={16} />, section: "" },
  { v: "ldd", label: "Legal Due Diligence", icon: <FileSearch size={16} />, section: "" },
  { v: "lawyer", label: "Pengacara MRWP", icon: <Gavel size={16} />, section: "" },
  { v: "assistant", label: "AI Assistant", icon: <Bot size={16} />, section: "AI" },
  { v: "drafter", label: "AI Drafting", icon: <PenLine size={16} />, section: "AI" },
  { v: "hr-dashboard" as ViewId, label: "Dashboard", icon: <BarChart3 size={16} />, section: "Employment" },
  { v: "hr-database" as ViewId, label: "Database Karyawan", icon: <IdCard size={16} />, section: "Employment" },
  { v: "hr-sp" as ViewId, label: "Surat Peringatan", icon: <FileWarning size={16} />, section: "Employment" },
  { v: "hr-kalkulator" as ViewId, label: "Kalkulator Hukum", icon: <Calculator size={16} />, section: "Employment" },
  { v: "hr-compliance" as ViewId, label: "Kepatuhan", icon: <ShieldCheck size={16} />, section: "Employment" },
  { v: "asset", label: "Aset & Merek", icon: <Gem size={16} />, section: "", subItems: [
    { label: "Asset Management", tab: 0, icon: <Building2 size={13} /> },
    { label: "Intellectual Property", tab: 1, icon: <Copyright size={13} /> },
    { label: "Digital Vault", tab: 2, icon: <Vault size={13} /> },
  ]},
  { v: "asuransi", label: "Asuransi", icon: <Umbrella size={16} />, section: "", subItems: [
    { label: "Polis & Pertanggungan", tab: 0, icon: <FileSignature size={13} /> },
    { label: "Klaim", tab: 1, icon: <ClipboardList size={13} /> },
    { label: "Integrasi Aset & Karyawan", tab: 2, icon: <Link2 size={13} /> },
  ]},
  { v: "pajak", label: "Kepatuhan Pajak", icon: <ReceiptText size={16} />, section: "", subItems: [
    { label: "Kalender Kewajiban", tab: 0, icon: <CalendarDays size={13} /> },
    { label: "Profil Pajak", tab: 1, icon: <Landmark size={13} /> },
    { label: "Integrasi Lintas Modul", tab: 2, icon: <Link2 size={13} /> },
  ]},
  { v: "licensing", label: "Perizinan", icon: <FileBadge size={16} />, section: "" },
  { v: "corpsec", label: "Sekretaris Perusahaan", icon: <Landmark size={16} />, section: "" },
  { v: "case", label: "Perkara", icon: <Scale size={16} />, section: "" },
  { v: "tools", label: "Alat Legal", icon: <Wrench size={16} />, section: "" },
  { v: "agreement", label: "Perjanjian", icon: <FileSignature size={16} />, section: "" },
];

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "AI": <Sparkles size={13} />,
  "OPERASIONAL": <Briefcase size={13} />,
  "Employment": <Users size={13} />,
};

export function Sidebar({ open, onClose, isCollapsed }: { open: boolean; onClose: () => void; isCollapsed?: boolean }) {
  const { queueCount, logout, activeTab, setActiveTab } = useStore();
  const [shut, setShut] = useState<Record<string, boolean>>({}); // seksi tertutup; default semua terbuka
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const asideRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (v: ViewId) => pathname.startsWith(ROUTE[v]);

  // Group adjacent NAV items by section to respect the exact array order
  const groupedNav: { section: string; items: typeof NAV }[] = [];
  let currentSec: string | null = null;
  let currentGroup: typeof NAV = [];

  NAV.forEach((n) => {
    if (n.section !== currentSec) {
      if (currentGroup.length > 0) {
        groupedNav.push({ section: currentSec || "", items: currentGroup });
      }
      currentSec = n.section;
      currentGroup = [n];
    } else {
      currentGroup.push(n);
    }
  });
  if (currentGroup.length > 0) {
    groupedNav.push({ section: currentSec || "", items: currentGroup });
  }

  /* ponytail: indikator #sbInk (garis emas mengambang) DIHAPUS — border-left gold pada
   * .on sudah menandai menu aktif; ink sering nyasar/tertinggal saat submenu ditutup. */
  return (
    <aside ref={asideRef} className={`sidebar${open ? " open" : ""}`} style={isCollapsed ? { overflowX: "hidden" } : undefined}>
      <div className={`sb-brand ${isCollapsed ? "!px-0 !justify-center" : ""}`}>
        <BrandMark className="w-10 h-10 scale-[1.85] origin-center" />
        <div className={isCollapsed ? "!hidden" : ""}><b>CORPLEX</b><span>MRWP LAW FIRM</span></div>
      </div>
      {groupedNav.map((group, i) => {
        const sec = group.section;
        const open = sec ? shut[sec] !== true : true; // standalone items are always open
        return (
          <React.Fragment key={`${sec}-${i}`}>
            {sec && (
              <button className={`sb-label sb-sec ${isCollapsed ? "!hidden" : ""}`} onClick={() => setShut((s) => ({ ...s, [sec]: open }))} aria-expanded={open}>
                {SECTION_ICONS[sec]}
                {sec}
                <ChevronDown size={13} className="sb-chev" style={{ transform: open ? "rotate(180deg)" : "none" }} />
              </button>
            )}
            <div className={`sb-drop${open || isCollapsed ? " open" : ""}`}>
              <div className="sb-nav" style={sec ? undefined : { paddingLeft: 0 }}>
                {group.items.map((n) => {
                  const hasSub = n.subItems && n.subItems.length > 0;
                  const isMenuOpen = openMenus[n.v];
                  const active = isActive(n.v);

                  return (
                    <div key={n.v} className="w-full">
                      <button className={`sb-it ${active && !hasSub ? "on" : ""} ${isCollapsed ? "!p-0 !h-10 !w-full !justify-center" : ""}`} onClick={() => {
                        if (hasSub) {
                          setOpenMenus(s => ({ ...s, [n.v]: !s[n.v] }));
                          return;
                        }
                        if (n.v === "logout" as any) {
                          logout();
                          router.replace("/login");
                        } else {
                          setActiveTab(0); // reset tab menu sebelumnya (bug #3)
                          router.push(ROUTE[n.v]);
                          onClose();
                        }
                      }}>
                        {n.icon}
                        <span className={isCollapsed ? "!hidden" : ""}>{n.label}</span>
                        {n.v === "lawyer" && !isCollapsed ? <span className="bdg">{queueCount}</span> : null}
                        {hasSub && !isCollapsed && (
                          <ChevronDown size={14} className="ml-auto transition-transform duration-200" style={{ transform: isMenuOpen ? "rotate(180deg)" : "none", color: "var(--txt2)" }} />
                        )}
                      </button>
                      
                      {hasSub && !isCollapsed && (
                        <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: isMenuOpen ? "300px" : "0", opacity: isMenuOpen ? 1 : 0 }}>
                          <div className="pt-1 pb-2 flex flex-col gap-1">
                            {n.subItems!.map(sub => {
                              const isSubActive = active && activeTab === sub.tab;
                              return (
                                <button key={sub.label} className={`sb-it sub-it ${isSubActive ? "on" : ""}`} style={{ marginLeft: "20px", paddingLeft: "15px", width: "calc(100% - 20px)", fontSize: "13px", minHeight: "36px", color: isSubActive ? "var(--gold-bright)" : "var(--txt2)" }} onClick={() => {
                                  router.push(ROUTE[n.v]);
                                  setActiveTab(sub.tab);
                                  onClose();
                                }}>
                                  {sub.icon}
                                  <span>{sub.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <div className={`sb-foot ${isCollapsed ? "!hidden" : ""}`} style={{ padding: "10px 0 14px" }}>
        <div className="sb-nav">
          <button className="sb-it" onClick={() => { logout(); router.replace("/login"); }}>
            <LogOut size={16} /><span>Keluar</span>
          </button>
        </div>
        <span className="mono" style={{ paddingLeft: 20 }}>@2026 MRWP LAW FIRM</span>
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
  const { ten, go } = useStore();
  const [q, setQ] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const bellRef = useRef<HTMLDivElement>(null);
  /* Click-outside: notifikasi tertutup saat klik area luar */
  useEffect(() => {
    if (!bellOpen) return;
    const h = (e: MouseEvent) => { if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [bellOpen]);
  if (!ten) return null;
  const hits = q.trim() ? ten.idx.filter((x) => (x.t + " " + x.s).toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];

  const activeNav = NAV.find((n) => n.v !== ("logout" as ViewId) && pathname.startsWith(ROUTE[n.v]));
  const modTitle = activeNav?.label || "Ringkasan";

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
        <div ref={bellRef} style={{ position: "relative" }}>
          <button className="bell" onClick={() => setBellOpen(!bellOpen)} aria-label="Notifikasi"><Bell size={15} /><span className="dot" /></button>
          <div className={`bell-drop${bellOpen ? " open" : ""}`}>
            <h6>PENGINGAT FUNGSI JAGA — {ten.bell.length} AKTIF</h6>
            <div>
              {/* Maks 5 notifikasi tampil; klik = routing ke menu terkait */}
              {ten.bell.slice(0, 5).map((b, i) => (
                <button key={i} className="bell-item" onClick={() => { go(b[3] as ViewId); setBellOpen(false); }}>
                  {BELL_ICONS[b[0]] || <Bell size={15} />}
                  <div><b>{b[1]}</b><span>{b[2]}</span></div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="cursor-pointer flex items-center justify-center w-[38px] h-[38px] rounded-[10px] border border-[var(--line)] bg-[var(--sur)] hover:border-[var(--blue-400)] transition-all" title="Profil"
          onClick={() => router.push("/profil")}>
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
