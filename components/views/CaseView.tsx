"use client";
import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { Chip, Kpi, Panel, Row, Timeline, ViewHead } from "@/components/ui";

export default function CaseView() {
  const { ten, toast } = useStore();
  const t = ten!;
  const [cur, setCur] = useState(0);
  const [cust, setCust] = useState([
    { b: "P-2 diajukan_sidang", d: "Adv. Ratna · 24 Jun 10:12 · hash cocok ✓" },
  ]);
  const c = t.cases[cur];

  return (
    <div>
      <ViewHead en="Modul 4.7 · Litigation & Dispute Management System · Layer 2" h1="Case Management"
        sub="Tahapan per jenis perkara sebagai konfigurasi, chain of custody kriptografis, biaya per tahap, dan interkoneksi rekam lintas modul."
        acts={<button className="btn btn-navy" onClick={() => toast("Registrasi perkara", "Somasi Legal Drafter yang tak dipenuhi dapat dinaikkan menjadi perkara satu aksi — membawa seluruh riwayat.")}><Plus size={14} /> Registrasi Perkara</button>} />

      <div className="grid g4 mb16">
        <Kpi v={t.cases.length} label="Perkara aktif" />
        <Kpi v={1} label="Pra-litigasi (somasi)" />
        <Kpi v={14} label="Bukti terindeks" tr="Integritas hash terjaga" trCls="up" />
        <Kpi v="Rp 86 jt" label="Biaya litigasi berjalan" tr="Capped fee: sisa plafon 62%" />
      </div>

      <div className="filters">
        {t.cases.map((x, i) => (
          <button key={i} className={`fchip${i === cur ? " on" : ""}`} onClick={() => setCur(i)}>{x.tab || `Perkara ${i + 1}`}</button>
        ))}
      </div>

      <div className="grid g-wide">
        <Panel title={c.head}>
          <div className="grid g2" style={{ gap: 14 }}>
            <div><Timeline items={c.tl} /></div>
            <div>
              <h4 style={{ fontFamily: "var(--serif)", fontSize: 14, marginBottom: 10 }}>Bukti Terindeks</h4>
              <div className="rows">
                {c.bukti.map((b, i) => <Row key={i} b={b[0]} d={b[1]} right={<Chip c={b[2] === "SAH" ? "c-ver" : "c-mon"}>{b[2]}</Chip>} />)}
              </div>
              <h4 style={{ fontFamily: "var(--serif)", fontSize: 14, margin: "16px 0 10px" }}>Biaya per Tahap</h4>
              <div className="rows">
                {c.biaya.map((b, i) => <Row key={i} b={b[0]} right={<b style={{ color: "var(--ink)" }}>{b[1]}</b>} />)}
              </div>
            </div>
          </div>
        </Panel>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {c.custody ? (
            <Panel title="Manajemen Bukti — Chain of Custody">
              <div className="rows">
                {cust.map((x, i) => <Row key={i} b={x.b} d={x.d} right={<Chip c="c-ver">TERCATAT</Chip>} />)}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-line btn-sm" onClick={() => { setCust((l) => [{ b: "P-3 disalin untuk bundel sidang", d: "Staf legal · baru saja · rantai custody bertambah" }, ...l]); toast("Perlakuan bukti dicatat", "Rantai custody bertambah — setiap perlakuan wajib melalui endpoint custody.", "ok"); }}>+ Catat Perlakuan Bukti</button>
                <button className="btn btn-line btn-sm" onClick={() => toast("Integritas terverifikasi ✓", "Hash berkas di vault identik dengan hash tercatat — SHA-256 cocok untuk seluruh bukti.", "ok")}>Verifikasi Integritas Hash</button>
                <button className="btn btn-navy btn-sm" onClick={() => toast("Bundel diekspor", "Daftar bukti bernomor + berita acara custody — siap untuk persidangan.", "ok")}>Ekspor Bundel</button>
              </div>
            </Panel>
          ) : (
            <Panel title="Aksi Pra-Litigasi">
              <div className="rows">
                {c.aksi.map((a, i) => (
                  <Row key={i} b={a.t} d={a.d} right={<button className={`btn btn-sm ${a.btn === "Naikkan" ? "btn-navy" : "btn-line"}`} onClick={() => a.toast && toast(a.toast[0], a.toast[1], "ok")}>{a.btn}</button>} />
                ))}
              </div>
            </Panel>
          )}
          <Panel className="dark" title="Jenis Perkara Didukung">
            <p style={{ fontSize: 12, lineHeight: 1.8 }}>Perdata · Pidana · PHI · Kepailitan &amp; PKPU · Arbitrase · PTUN · Pertanahan · Persaingan Usaha · Sengketa Pajak</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
