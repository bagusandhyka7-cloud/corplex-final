"use client";
import React, { useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LockScreen, Sidebar, Toasts, Topbar } from "@/components/shell";
import Ringkasan from "@/components/views/Ringkasan";
import Assistant from "@/components/views/Assistant";
import Drafter from "@/components/views/Drafter";
import Employment from "@/components/views/Employment";
import Licensing from "@/components/views/Licensing";
import Corpsec from "@/components/views/Corpsec";
import Asset from "@/components/views/Asset";
import CaseView from "@/components/views/CaseView";
import Tools from "@/components/views/Tools";
import Agreement from "@/components/views/Agreement";
import Asuransi from "@/components/views/Asuransi";
import Pajak from "@/components/views/Pajak";
import Lawyer from "@/components/views/Lawyer";

function App() {
  const { ten, view } = useStore();
  const [sbOpen, setSbOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [wizOpen, setWizOpen] = useState(false);

  return (
    <>
      <LockScreen />
      {ten ? (
        <div className={`app ${isCollapsed ? "lg:!grid-cols-[72px_1fr]" : ""}`} style={{ transition: "grid-template-columns 0.3s ease" }} key={ten.id}>
          <Sidebar open={sbOpen} onClose={() => setSbOpen(false)} isCollapsed={isCollapsed} />
          <div className="main">
            <Topbar onBurger={() => { setSbOpen((v) => !v); setIsCollapsed((v) => !v); }} />
            <div className="content">
              <ErrorBoundary key={view}>
              <div id="v-ringkasan" className={`view${view === "ringkasan" ? " on" : ""}`}>{view === "ringkasan" && <Ringkasan onOpenWizard={() => setWizOpen(true)} />}</div>
              <div className={`view${view === "assistant" ? " on" : ""}`}>{view === "assistant" && <Assistant />}</div>
              <div className={`view${view === "drafter" ? " on" : ""}`}><Drafter wizOpen={wizOpen} setWizOpen={setWizOpen} /></div>
              <div className={`view${view === "employment" ? " on" : ""}`}><Employment /></div>
              <div className={`view${view === "licensing" ? " on" : ""}`}><Licensing /></div>
              <div className={`view${view === "corpsec" ? " on" : ""}`}>{view === "corpsec" && <Corpsec />}</div>
              <div className={`view${view === "asset" ? " on" : ""}`}><Asset /></div>
              <div className={`view${view === "case" ? " on" : ""}`}>{view === "case" && <CaseView />}</div>
              <div className={`view${view === "tools" ? " on" : ""}`}>{view === "tools" && <Tools />}</div>
              <div className={`view${view === "agreement" ? " on" : ""}`}><Agreement /></div>
              <div className={`view${view === "asuransi" ? " on" : ""}`}><Asuransi /></div>
              <div className={`view${view === "pajak" ? " on" : ""}`}><Pajak /></div>
              <div className={`view${view === "lawyer" ? " on" : ""}`}>{view === "lawyer" && <Lawyer />}</div>
              </ErrorBoundary>
            </div>
          </div>
        </div>
      ) : null}
      <Toasts />
    </>
  );
}

export default function Page() {
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  );
}
