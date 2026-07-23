"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck, Bell, Bot, Building2, Coins, FileBadge, FileSignature, FileText, Gavel, Gem,
  HardHat, Landmark, LayoutDashboard, Lock, LogOut, PenLine, RadioTower, ReceiptText, Scale,
  Shield, ShieldCheck, Users, Wrench, CircleUser, ChevronDown, ChevronLeft, ChevronRight, Search,
  Home, Sparkles, Briefcase, FileSearch,
  BarChart3, IdCard, FileWarning, Calculator, Copyright, Vault, Umbrella, ClipboardList, Link2, CalendarDays, FileUp,
} from "lucide-react";
import { useStore, useToasts, ViewId } from "@/lib/store";
import { lblJaga, tenggatJaga } from "@/lib/jaga";
import { ROUTE } from "@/lib/routes";
import { useRouter, usePathname } from "next/navigation";

import logoMrwp from "./logo-mrwp.svg";

const BrandMark = ({ size, className = "" }: { size?: number, className?: string }) => (
  <img src={(logoMrwp as any).src || logoMrwp} alt="MRWP Logo" className={`object-contain ${className}`} style={size ? { width: size, height: size } : undefined} />
);

/* ===== SIDEBAR ===== */
/* Urutan (arahan owner 22 Jul): prioritas Ringkasan + Pengacara, lalu SEMUA menu tanpa dropdown,
 * baru kelompok ber-dropdown (AI, Ketenagakerjaan, Aset, Asuransi, Pajak) di bawah. */
export const NAV: { v: ViewId; label: string; icon: React.ReactNode; section: string; subItems?: { label: string; tab: number; icon?: React.ReactNode }[] }[] = [
  { v: "ringkasan", label: "Ringkasan", icon: <LayoutDashboard size={16} />, section: "" },
  { v: "lawyer", label: "Pengacara MRWP", icon: <Gavel size={16} />, section: "" },
  { v: "agreement", label: "Manajemen Kontrak", icon: <FileSignature size={16} />, section: "" },
  { v: "licensing", label: "Perizinan", icon: <FileBadge size={16} />, section: "" },
  { v: "corpsec", label: "Sekretaris Perusahaan", icon: <Landmark size={16} />, section: "" },
  { v: "case", label: "Perkara", icon: <Scale size={16} />, section: "" },
  { v: "tools", label: "Alat Legal", icon: <Wrench size={16} />, section: "" },
  { v: "assistant", label: "AI Assistant", icon: <Bot size={16} />, section: "AI" },
  { v: "drafter", label: "AI Drafting", icon: <PenLine size={16} />, section: "AI" },
  { v: "hr-database" as ViewId, label: "Database Karyawan", icon: <IdCard size={16} />, section: "Ketenagakerjaan" },
  { v: "hr-sp" as ViewId, label: "Surat Peringatan", icon: <FileWarning size={16} />, section: "Ketenagakerjaan" },
  { v: "hr-kalkulator" as ViewId, label: "Kalkulator Hukum", icon: <Calculator size={16} />, section: "Ketenagakerjaan" },
  { v: "asset", label: "Aset & Merek", icon: <Gem size={16} />, section: "", subItems: [
    { label: "Asset Management", tab: 0, icon: <Building2 size={13} /> },
    { label: "Intellectual Property", tab: 1, icon: <Copyright size={13} /> },
    { label: "Digital Vault", tab: 2, icon: <Vault size={13} /> },
  ]},
  { v: "asuransi", label: "Asuransi", icon: <Umbrella size={16} />, section: "", subItems: [
    { label: "Polis & Pertanggungan", tab: 0, icon: <FileSignature size={13} /> },
    { label: "Klaim", tab: 1, icon: <ClipboardList size={13} /> },
  ]},
  { v: "pajak", label: "Kepatuhan Pajak", icon: <ReceiptText size={16} />, section: "", subItems: [
    { label: "Kalender Kewajiban", tab: 0, icon: <CalendarDays size={13} /> },
    { label: "Profil Pajak", tab: 1, icon: <Landmark size={13} /> },
  ]},
];

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "AI": <Sparkles size={13} />,
  "OPERASIONAL": <Briefcase size={13} />,
  "Ketenagakerjaan": <Users size={13} />,
};

/* Dual-bahasa (5y-A): kamus EN utk label MENU & judul (fokus arahan owner: menu tak boleh campur).
 * ponytail: terjemah isi tiap modul = inkremental + istilah hukum wajib review MRWP — tak dipalsukan AI. */
const EN: Record<string, string> = {
  "Ringkasan": "Summary", "Pengacara MRWP": "MRWP Lawyers", "AI Assistant": "AI Assistant", "AI Drafting": "AI Drafting",
  "Database Karyawan": "Employee Database", "Surat Peringatan": "Warning Letter", "Kalkulator Hukum": "Legal Calculator",
  "Aset & Merek": "Assets & Trademark", "Asuransi": "Insurance", "Kepatuhan Pajak": "Tax Compliance",
  "Perizinan": "Licensing", "Sekretaris Perusahaan": "Corporate Secretary", "Perkara": "Litigation",
  "Alat Legal": "Legal Tools", "Manajemen Kontrak": "Contract Management", "Ketenagakerjaan": "Employment",
  "Asset Management": "Asset Management", "Intellectual Property": "Intellectual Property", "Digital Vault": "Digital Vault",
  "Polis & Pertanggungan": "Policies & Coverage", "Klaim": "Claims",
  "Kalender Kewajiban": "Obligation Calendar", "Profil Pajak": "Tax Profile",
};
export const tr = (s: string, lang: string) => (lang === "en" && EN[s]) ? EN[s] : s;

export function Sidebar({ open, onClose, isCollapsed }: { open: boolean; onClose: () => void; isCollapsed?: boolean }) {
  const { queueCount, logout, activeTab, setActiveTab, lang } = useStore();
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
      {/* Bug scroll: aside kini mengisi SELURUH kolom (background solid tanpa celah);
          bagian sticky = .sb-body agar navigasi tetap statis saat konten di-scroll. */}
      <div className="sb-body">
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
                {tr(sec, lang)}
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
                        <span className={isCollapsed ? "!hidden" : ""}>{tr(n.label, lang)}</span>
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
                                  <span>{tr(sub.label, lang)}</span>
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
      </div>
    </aside>
  );
}

/* ===== TOPBAR ===== */
/* BELL_ICONS dihapus: hanya melayani `ten.bell` (seed) yang tak pernah terisi untuk tenant nyata. */

export function Topbar({ onBurger, collapsed }: { onBurger: () => void; collapsed?: boolean }) {
  const { ten, go, lang, setLang } = useStore();
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
  /* PENCARIAN GLOBAL — dulu membaca `ten.idx` yang TIDAK PERNAH diisi untuk tenant nyata
   * (emptyTenant → []), jadi bar pencarian paling menonjol di layar selalu "Tidak ditemukan".
   * Kini indeks dibangun dari koleksi hidup; ikut ter-update sendiri lewat realtime store. */
  const idx = useMemo(() => {
    const out: { t: string; s: string; v: string }[] = [];
    ten.emp.forEach((e) => out.push({ t: e.n, s: `Karyawan · ${e.j || "—"} · ${e.s}`, v: "hr-database" }));
    ten.lic.forEach((r) => { const a = r as unknown[]; out.push({ t: String(a[0]), s: `Izin · ${String(a[1] || "")} · ${String(a[7] || "")}`, v: "licensing" }); });
    ten.assets.forEach((r) => { const a = r as unknown[]; out.push({ t: String(a[0]), s: `Aset · ${String(a[2] || "")}`, v: "asset" }); });
    ten.hki.forEach((r) => { const a = r as unknown[]; out.push({ t: String(a[0]), s: `HKI · ${String(a[1] || "")}`, v: "asset" }); });
    ten.asr.pol.forEach((r) => { const a = r as unknown[]; out.push({ t: String(a[0]), s: `Polis · ${String(a[1] || "")}`, v: "asuransi" }); });
    ten.agr.forEach((a) => { const x = a as { n?: string; p2?: string }; out.push({ t: x.n || "Perjanjian", s: `Perjanjian · dengan ${x.p2 || "—"}`, v: "agreement" }); });
    ten.cases.forEach((c) => { const x = c as { judul?: string; n?: string }; out.push({ t: x.judul || x.n || "Perkara", s: "Perkara", v: "case" }); });
    return out;
  }, [ten]);
  const hits = q.trim() ? idx.filter((x) => (x.t + " " + x.s).toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];
  /* LONCENG — sumber sama dengan panel Pengingat (lib/jaga.ts). Dulu `ten.bell` selalu kosong
   * padahal titik merah "ada notifikasi" menyala permanen. */
  const jaga = useMemo(() => tenggatJaga(ten), [ten]);

  const activeNav = NAV.find((n) => n.v !== ("logout" as ViewId) && pathname.startsWith(ROUTE[n.v]));
  const modTitle = tr(activeNav?.label || "Ringkasan", lang);

  return (
    <div className="topbar">
      {/* S1: panah dinamis — terbuka=kiri (lipat), terlipat=kanan (buka) */}
      <button className="burger !flex items-center justify-center" onClick={onBurger} aria-label="Menu" style={{ display: 'flex' }}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="ent"><Building2 size={15} /> {ten.name}</div>
      
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
        {/* Toggle dual-bahasa (5y-A): ID | EN — menu tak campur */}
        <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", fontSize: 11, fontFamily: "var(--mono)" }}>
          {(["id", "en"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} style={{ padding: "6px 10px", cursor: "pointer", border: "none", fontWeight: 700, letterSpacing: ".08em", color: lang === l ? "#0B1526" : "var(--txt2)", background: lang === l ? "var(--gold-bright)" : "transparent" }}>{l.toUpperCase()}</button>
          ))}
        </div>
        <div ref={bellRef} style={{ position: "relative" }}>
          <button className="bell" onClick={() => setBellOpen(!bellOpen)} aria-label="Notifikasi">
            <Bell size={15} />{/* titik merah HANYA bila benar-benar ada tenggat mendesak */}
            {jaga.some((x) => x.hari === null || x.hari <= 30) && <span className="dot" />}
          </button>
          <div className={`bell-drop${bellOpen ? " open" : ""}`}>
            <h6>PENGINGAT FUNGSI JAGA — {jaga.length} AKTIF</h6>
            <div>
              {/* Maks 5 notifikasi tampil; klik = routing ke menu terkait */}
              {jaga.slice(0, 5).map((b, i) => (
                <button key={i} className="bell-item" onClick={() => { go(b.v as ViewId); setBellOpen(false); }}>
                  <Bell size={15} />
                  <div><b>{b.b}</b><span>{lblJaga(b.hari)} · {b.d}</span></div>
                </button>
              ))}
              {!jaga.length && <div style={{ padding: "12px 14px", fontSize: 11.5, color: "var(--muted)" }}>Belum ada tenggat mendesak. Pengingat muncul otomatis dari rekam izin, perjanjian, dan kontrak kerja.</div>}
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
  const toasts = useToasts();
  return (
    <div id="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.k || ""}`}><b>{t.t}</b><span>{t.d}</span></div>
      ))}
    </div>
  );
}
