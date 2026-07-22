"use client";
import React, { useState } from "react";
import { Sidebar, Toasts, Topbar } from "@/components/shell";
import { ConfirmHost } from "@/components/ui";
import { useStore } from "@/lib/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ten } = useStore();
  const [sbOpen, setSbOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  /* Mode pengawasan MRWP (admin masuk dashboard klien) — banner mencolok + pintu keluar */
  const [pengawasan, setPengawasan] = useState<string | null>(null);
  React.useEffect(() => { setPengawasan(localStorage.getItem("corplex_impersonate")); }, []);
  const tutupPengawasan = () => {
    ["corplex_impersonate", "corplex_tid", "corplex_ten"].forEach((k) => localStorage.removeItem(k));
    window.location.href = "/adminmrwp";
  };

  return (
    <>
      {pengawasan && (
        /* minimalis, tema gold di atas navy — tanpa nada "anda diawasi" */
        <div style={{ background: "var(--bg-1, #0B1526)", borderBottom: "1px solid var(--gold)", padding: "6px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 900, fontSize: 12 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: ".18em", color: "var(--gold-bright)" }}>MODE ADMIN</span>
          <span style={{ flex: 1, color: "var(--txt2)" }}>Dashboard {pengawasan}</span>
          <button onClick={tutupPengawasan} style={{ background: "transparent", color: "var(--gold-bright)", border: "1px solid var(--gold)", borderRadius: 8, padding: "4px 14px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Kembali ke Panel</button>
        </div>
      )}
      <div className={`app ${isCollapsed ? "lg:!grid-cols-[72px_1fr]" : ""}`} style={{ transition: "grid-template-columns 0.3s ease" }} key={ten?.id || "shell"}>
        <Sidebar open={sbOpen} onClose={() => setSbOpen(false)} isCollapsed={isCollapsed} />
        <div className="main">
          <Topbar collapsed={isCollapsed} onBurger={() => { setSbOpen((v) => !v); setIsCollapsed((v) => !v); }} />
          <div className="content">
            {children}
          </div>
        </div>
      </div>
      <Toasts />
      <ConfirmHost />
    </>
  );
}
