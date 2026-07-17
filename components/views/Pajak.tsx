"use client";
import React, { useState } from "react";
import { RefreshCw, Scale } from "lucide-react";
import { clone, useStore, ViewId } from "@/lib/store";
import { Chip, Kpi, Panel, Ring, Row, Spark, Tabs, ViewHead } from "@/components/ui";

export default function Pajak() {
  const { ten, go, toast, pushQueue } = useStore();
  const t = ten!;
  const [tab, setTab] = useState(0);
  const [kal, setKal] = useState(() => clone(t.tax.kal));
  const [done, setDone] = useState(t.tax.done);

  const taxAct = (i: number) => {
    setKal((ks) => {
      const n = clone(ks);
      const k = n[i];
      n[i] = [k[0], "Bukti lapor/setor tersimpan di vault (hash tercatat)" + (k[5] ? " · tenggat berikutnya: " + k[5] : ""), "c-ver", "DIPENUHI ✓", null, k[5]];
      return n;
    });
    setDone((d) => d + 1);
    toast("Kewajiban dipenuhi", "Bukti masuk vault · tenggat berikutnya dibuat otomatis · skor kepatuhan diperbarui.", "ok");
  };

  return (
    <div>
      <ViewHead en="Modul 4.11 · Tax Compliance Management · Layer 2" h1="Kepatuhan Pajak"
        sub={<>Kalender pemenuhan pajak terpadu — tenggat lapor &amp; setor <b>terintegrasi dengan Licensing (LKPM/OSS) dan Corporate Secretary</b>; dasar pengenaan ditarik dari rekam Employment, Aset, dan Kontraktual sehingga setiap angka dapat diaudit ke dokumen sumbernya.</>}
        acts={<button className="btn btn-navy" onClick={() => toast("Sinkronisasi kalender", "Kalender pajak digabung dengan kewajiban pasca-perizinan (4.4) dan tenggat statutori (4.5) — satu kalender kepatuhan.", "ok")}><RefreshCw size={14} /> Sinkronkan Kalender Kepatuhan</button>} />

      <div className="grid g4 mb16">
        <div className="kpi">
          <div className="score-ring">
            <Ring score={t.tax.score} />
            <div>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Skor Kepatuhan Pajak</span>
              <span className="tr up" style={{ display: "block" }}>{t.tax.trend}</span>
            </div>
          </div>
        </div>
        <Kpi v={<span style={{ fontSize: 19 }}>{t.tax.next}</span>} label="Kewajiban terdekat" tr={t.tax.nextTr} trCls="dn" />
        <Kpi v={kal.filter((k) => k[4]).length} label="Kewajiban terbuka" tr="Masa + tahunan" />
        <Kpi v={done} label="Dipenuhi tepat waktu (YTD)" tr="Bukti lapor di vault" trCls="up" />
      </div>

      <Tabs items={["Kalender Kewajiban", "Profil Pajak", "Integrasi Lintas Modul"]} cur={tab} onSel={setTab} />

      {tab === 0 && (
        <div className="grid g-wide">
          <Panel title="Kalender Pemenuhan — Lapor & Setor">
            <div className="rows">
              {kal.map((k, i) => (
                <Row key={i} b={k[0]} d={k[1]} right={<>
                  <Chip c={String(k[2])}>{k[3]}</Chip>
                  {k[4] ? <button className="btn btn-line btn-sm" onClick={() => taxAct(i)}>{k[4]}</button> : null}
                </>} />
              ))}
            </div>
          </Panel>
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <Panel title="Gabungan Kalender Kepatuhan">
              <div className="rows">
                {t.tax.join.map((x, i) => (
                  <Row key={i} b={x[0]} d={x[1]} right={<Chip c={x[3]}>{x[4]}</Chip>} onClick={() => go(x[2] as ViewId)} />
                ))}
              </div>
            </Panel>
            <Panel className="dark" title="Sengketa & Pemeriksaan">
              <p>Bila terbit SP2DK atau pemeriksaan, satu aksi membentuk perkara Sengketa Pajak di Case Management (4.7) — seluruh bukti lapor/setor terbawa dari vault dengan hash terverifikasi.</p>
              <button className="btn btn-gold btn-sm mt16" onClick={() => pushQueue("Konsultasi pajak — persiapan pemeriksaan", "Eskalasi dari Kepatuhan Pajak · rekap kepatuhan dan bukti terlampir", "c-gold", "ESKALASI")}><Scale size={12} /> Eskalasi ke Advokat</button>
            </Panel>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className="grid g2">
          <Panel title="Identitas Perpajakan">
            <div className="rows">
              {t.tax.prof.map((x, i) => <Row key={i} b={x[0]} d={x[1]} right={<Chip c={x[2]}>{x[3]}</Chip>} />)}
            </div>
          </Panel>
          <Panel title="Riwayat Kepatuhan — 6 Bulan">
            <Spark points="0,30 60,26 120,28 180,18 240,16 300,12" stroke="#1E7F5C" />
            <p className="note">Skor dihitung dari ketepatan lapor &amp; setor, kelengkapan bukti di vault, dan konsistensi dasar pengenaan terhadap rekam — menjadi komponen skor kesehatan hukum pada Ringkasan.</p>
          </Panel>
        </div>
      )}

      {tab === 2 && (
        <div>
          <div className="rows">
            {t.tax.integ.map((x, i) => (
              <Row key={i} b={x[0]} d={x[1]} right={<Chip c={x[3]}>{x[4]}</Chip>} onClick={() => go(x[2] as ViewId)} />
            ))}
          </div>
          <p className="note mt16"><b>Satu sumber kebenaran:</b> pajak tidak dihitung dari input manual — dasar pengenaan ditarik dari rekam hidup (kontraktual, tenaga kerja, aset), sehingga setiap angka dapat diaudit ke dokumen sumbernya.</p>
        </div>
      )}
    </div>
  );
}
