"use client";
import React, { useState } from "react";
import { Sidebar, Toasts, Topbar } from "@/components/shell";
import { ConfirmHost } from "@/components/ui";
import { useStore } from "@/lib/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ten } = useStore();
  const [sbOpen, setSbOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      <div className={`app ${isCollapsed ? "lg:!grid-cols-[72px_1fr]" : ""}`} style={{ transition: "grid-template-columns 0.3s ease" }} key={ten?.id || "shell"}>
        <Sidebar open={sbOpen} onClose={() => setSbOpen(false)} isCollapsed={isCollapsed} />
        <div className="main">
          <Topbar onBurger={() => { setSbOpen((v) => !v); setIsCollapsed((v) => !v); }} />
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
