"use client";
import React, { useEffect, useState } from "react";
import { Bot, FileSignature, FolderArchive, Building, Hourglass, PenLine, ReceiptText, Scale, ShieldCheck, Wrench, LifeBuoy } from "lucide-react";
import { useStore, ViewId } from "@/lib/store";
import { Chip, Kpi, Panel, Ring, Row, Spark } from "@/components/ui";

function useCountUp(target: number, dur = 1000) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

export default function Ringkasan({ onOpenWizard }: { onOpenWizard: () => void }) {
  const { ten, go, queueCount, quota, quotaMax } = useStore();
  const t = ten!;
  const docs = useCountUp(t.kpiDocs);
  const score = useCountUp(t.score, 1150);
  const taxScore = useCountUp(t.tax.score);
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }, []);

  const verifData = t.verif.length >= 8 ? t.verif : [
    ...t.verif,
    ["Perjanjian Sewa Kantor Cabang", "Menunggu tanda tangan direksi", "c-draft", "DRAF AI"],
    ["Perpanjangan Izin Usaha", "OSS RBA — Sedang diproses", "c-mon", "PENDING"],
    ["Somasi Pelanggaran HKI", "Draf awal dari Legal Assistant", "c-draft", "DRAF AI"]
  ];

  const remData = t.rem.length >= 11 ? t.rem : [
    ...t.rem,
    ["Laporan Penanaman Modal (LKPM)", "Kewajiban pelaporan investasi berkala ke BKPM", "c-red", "5 HARI", "licensing"],
    ["Perpanjangan Hak Guna Bangunan", "Sertifikat HGB akan habis masa berlakunya", "c-mon", "90 HARI", "asset"],
    ["Audit Kepatuhan Lingkungan", "Pemeriksaan standar baku mutu air limbah", "c-draft", "45 HARI", "licensing"]
  ];

  return (
    // id v-ringkasan + .on = kunci seluruh CSS hero animasi lama (aurora, heroShift, riseIn berjenjang) di globals.css
    <div id="v-ringkasan" className="view on">
      <div className="vh">
        <div>
          <h1>Ringkasan — {t.name}</h1>
          <div className="sub"><span id="heroDate">{today}</span> · Kesehatan hukum perusahaan Anda hari ini.</div>
          <div className="hero-meta">
            <span className="hpill"><span className="pulse" />PEMANTAUAN AKTIF</span>
          </div>
        </div>
        <div className="vh-acts">
          <button className="btn btn-gold" onClick={() => go("lawyer")}>⚖️ Eskalasi ke Advokat</button>
        </div>
      </div>

      <div className="grid g4">
        <Kpi ico={<FolderArchive size={42} strokeWidth={1} opacity={0.15} />} v={docs} label="Dokumen dalam rekam (CATAT)" tr={t.kpiDocsTr} trCls="up" />
        <Kpi ico={<ShieldCheck size={42} strokeWidth={1} opacity={0.15} />} v={t.kpiIzin} label="Izin aktif dipantau (JAGA)" tr={t.kpiIzinTr} trCls="dn" onClick={() => go("licensing")} />
        <Kpi ico={<Scale size={42} strokeWidth={1} opacity={0.15} />} v={queueCount} label="Draf menunggu verifikasi (JAMIN)" tr="SLA prioritas < 24 jam" trCls="md" onClick={() => go("lawyer")} />
        <div className="kpi">
          <div className="score-ring">
            <div className="ring" id="scoreRing"><i>{score}</i></div>
            <div>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Skor Kesehatan Hukum</span>
              <span className="tr up" style={{ display: "block" }}>{t.delta}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g4 mt16">
        <Kpi ico={<Building size={42} strokeWidth={1} opacity={0.15} />} v={<span style={{ fontSize: 21 }}>{t.asetVal}</span>} label="Nilai aset tercatat — Asset & IP" tr={t.asetTr} trCls="md" onClick={() => go("asset")} />
        <Kpi ico={<ReceiptText size={42} strokeWidth={1} opacity={0.15} />} v={taxScore} label="Skor kepatuhan pajak" tr={t.tax.trend} trCls="up" onClick={() => go("pajak")} />
        <Kpi ico={<LifeBuoy size={42} strokeWidth={1} opacity={0.15} />} v={t.asr.pol.length} label="Polis asuransi dipantau" tr={t.asr.polTr} trCls="md" onClick={() => go("asuransi")} />
        <Kpi ico={<Hourglass size={42} strokeWidth={1} opacity={0.15} />} v={<span style={{ fontSize: 21 }}>{t.tax.next}</span>} label="Kewajiban pajak terdekat" tr={t.tax.nextTr} trCls="dn" onClick={() => go("pajak")} />
      </div>

      <div className="grid g-wide mt16" style={{ alignItems: "stretch" }}>
        <Panel title="Pengingat Kepatuhan — Deteksi Dini Fungsi Jaga">
          <div className="rows">
            {remData.map((r, i) => (
              <Row key={i} b={r[0]} d={r[1]} right={<Chip c={r[2]}>{r[3]}</Chip>} onClick={() => go(r[4] as ViewId)} />
            ))}
          </div>
        </Panel>
        <Panel title="Alur Verifikasi — Fungsi Jamin" className="flex flex-col">
          <div className="rows">
            {verifData.map((v, i) => (
              <Row key={i} b={v[0]} d={v[1]} right={<Chip c={v[2]}>{v[3]}</Chip>} />
            ))}
          </div>
          <div className="quota" style={{ marginTop: "auto", paddingTop: 14 }}>
            <div className="lbl"><span>Kuota verifikasi bulan ini</span><b>{quota} / {quotaMax}</b></div>
            <div className="bar"><i className="bl" style={{ width: `${Math.min(100, (quota / quotaMax) * 100)}%` }} /></div>
          </div>
        </Panel>
      </div>

      <div className="grid g3 mt16">
        <Panel title="Tren Skor Kesehatan — 6 Bulan" className="flex flex-col">
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Spark points="0,38 60,34 120,40 180,26 240,18 300,12" fill />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", paddingTop: 8 }}>
            <span>FEB</span><span>MAR</span><span>APR</span><span>MEI</span><span>JUN</span>
            <span style={{ color: "var(--gold-deep)", fontWeight: 700 }}>JUL</span>
          </div>
        </Panel>
        <Panel title="Rekam per Bab">
          <div style={{ display: "grid", gap: 8, fontSize: 11.5 }}>
            {t.bab.map((b, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>{b[0]}</span><b>{b[1]}</b></div>
                <div className="bar"><i className="bl" style={{ width: `${b[2]}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="dark" title={<>Regulasi Terpantau <span className="chip c-ver">● PEMINDAIAN AKTIF</span></>}>
          <p>3 perubahan regulasi relevan dengan bidang usaha Anda terdeteksi bulan ini — seluruh rujukan tertaut sumber resmi (JDIH · peraturan.go.id · Lembaran Negara).</p>
          <button className="btn btn-gold btn-sm mt16" onClick={() => go("assistant")}>Tanyakan ke AI Assistant</button>
        </Panel>
      </div>

      <Panel title="Aksi Cepat" className="mt16">
        <div className="grid g4" style={{ gap: 12 }}>
          <button className="btn btn-line qa-btn" onClick={() => { go("drafter"); setTimeout(onOpenWizard, 350); }}><PenLine size={16} /> Susun dokumen baru</button>
          <button className="btn btn-line qa-btn" onClick={() => go("agreement")}><FileSignature size={16} /> Unggah &amp; Registrasi</button>
          <button className="btn btn-line qa-btn" onClick={() => go("assistant")}><Bot size={16} /> Konsultasi hukum</button>
          <button className="btn btn-line qa-btn" onClick={() => go("tools")}><Wrench size={16} /> Bandingkan Dokumen</button>
        </div>
      </Panel>
    </div>
  );
}
