"use client";
import React, { useEffect, useState } from "react";
import { Bot, FileSignature, FolderArchive, Building, Hourglass, PenLine, ReceiptText, Scale, ShieldCheck, Wrench, LifeBuoy, CheckCircle2, Circle } from "lucide-react";
import { useStore, ViewId } from "@/lib/store";
import { Chip, Kpi, Panel, Row } from "@/components/ui";
import Ldd from "@/components/views/Ldd";
import HRDashboard from "@/components/views/HRDashboard";
import { buildLdd } from "@/lib/ldd";
import { api } from "@/lib/api";

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

/* Onboarding 5 menit (5c-1): 3 langkah menuju Laporan LDD pertama.
 * Progres diturunkan dari rekam nyata (corp/lic/emp) — nol tabel baru, tersimpan per tenant otomatis.
 * Hilang sendiri saat ketiganya terisi. */
function OnboardChecklist() {
  const { ten, go } = useStore();
  const t = ten!;
  const steps: [boolean, string, string, ViewId][] = [
    [!!t.corp.id || t.corp.docs.length > 0, "Unggah akta / dokumen perseroan", "Dasar aspek Legalitas Badan Hukum pada Laporan LDD.", "corpsec"],
    [t.lic.length > 0, "Daftarkan izin usaha", "Izin terpantau tenggatnya — telat = risiko sanksi + status BERISIKO.", "licensing"],
    [t.emp.length > 0, "Tambah karyawan pertama", "Dasar aspek Ketenagakerjaan (kontrak, BPJS, SP).", "hr-database"],
  ];
  const done = steps.filter((s) => s[0]).length;
  if (done === steps.length) return null;
  return (
    <Panel title={`Mulai di sini — ${done}/3 langkah menuju Laporan LDD pertama Anda`} className="mt16">
      <div style={{ display: "grid", gap: 10 }}>
        {steps.map(([ok, b, d, view], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: ok ? 0.55 : 1 }}>
            {ok ? <CheckCircle2 size={17} color="var(--gold-bright)" /> : <Circle size={17} color="var(--muted)" />}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: "#fff", fontWeight: 600, textDecoration: ok ? "line-through" : undefined }}>{b}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{d}</div>
            </div>
            {!ok && <button className="btn btn-line btn-sm" onClick={() => go(view)}>Buka</button>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function Ringkasan({ onOpenWizard }: { onOpenWizard: () => void }) {
  const { ten, go, queueCount, quota, quotaMax, rekamVer } = useStore();
  const t = ten!;

  /* ===== KPI dihitung dari rekam HIDUP (bukan field statis tenant) — "Data A masuk, semua layar ikut".
   * Skor kesehatan menumpang mesin LDD yang sudah menilai 6 aspek dari rekam nyata (nol mesin baru). */
  const ldd = React.useMemo(() => buildLdd(t), [t]);
  const aspek = Object.values(ldd.counts);
  /* Keputusan owner: aspek TANPA rekam = "BELUM DINILAI", bukan AMAN — nol rekam bukan berarti aman.
   * Penyebut tetap seluruh aspek → skor = ukuran kelengkapan + kepatuhan; tenant baru mulai 0%. */
  const aspekBelum = aspek.filter((a) => a.rekam === 0).length;
  const aspekAman = aspek.filter((a) => a.rekam > 0 && a.status === "AMAN").length;
  const skorSehat = aspek.length ? Math.round((aspekAman / aspek.length) * 100) : 0;
  const totalRekam = t.corp.docs.length + t.lic.length + t.assets.length + t.hki.length + t.asr.pol.length + t.agr.length + t.emp.length;
  const izinAktif = t.lic.filter((r) => (r as unknown[])[7] === "AKTIF").length;
  const asetPerhatian = t.assets.filter((r) => (r as unknown[])[6] !== "AMAN").length;

  /* Kewajiban pajak ada di module_records mod 'tax' (di luar `ten`) — satu fetch, sama seperti modul Pajak. */
  const [pajak, setPajak] = useState({ skor: 0, next: "—", nextTr: "belum ada kewajiban tercatat", total: 0 });
  useEffect(() => {
    const tid = localStorage.getItem("corplex_tid") || "";
    if (!tid) return;
    void api.records.list(tid).then((r) => {
      if (!r.ok) return;
      const rows = r.data.filter((x) => x.module === "tax").map((x) => x.data as { nama?: string; tenggat?: string; status?: string });
      if (!rows.length) return;
      const dipenuhi = rows.filter((x) => x.status === "DIPENUHI").length;
      const terbuka = rows.filter((x) => x.status !== "DIPENUHI" && x.tenggat).sort((a, b) => (a.tenggat || "").localeCompare(b.tenggat || ""));
      setPajak({
        skor: Math.round((dipenuhi / rows.length) * 100),
        next: terbuka[0]?.nama || "—",
        nextTr: terbuka[0]?.tenggat ? `tenggat ${terbuka[0].tenggat}` : "seluruh kewajiban dipenuhi",
        total: rows.length,
      });
    });
  }, [rekamVer]); // realtime: rekam berubah di menu lain → segarkan

  const docs = useCountUp(totalRekam);
  const score = useCountUp(skorSehat, 1150);
  const taxScore = useCountUp(pajak.skor);
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }, []);

  /* NOL DUMMY: dulu daftar ini dipadatkan baris karangan (HGB, LKPM, somasi) saat rekam klien sedikit —
   * berbahaya di platform hukum. Kini murni rekam nyata + empty state jujur. */
  const verifData = t.verif;
  const remData = t.rem;

  /* Rekam per Bab dihitung dari koleksi nyata (bar relatif terhadap bab terbanyak). */
  const babRows: [string, number, number][] = (() => {
    const items: [string, number][] = [
      ["Perizinan", t.lic.length], ["Aset & HKI", t.assets.length + t.hki.length],
      ["Perjanjian", t.agr.length], ["Ketenagakerjaan", t.emp.length],
      ["Asuransi", t.asr.pol.length], ["Tata Kelola", t.corp.docs.length],
    ];
    const max = Math.max(1, ...items.map((i) => i[1]));
    return items.map(([l, n]) => [l, n, Math.round((n / max) * 100)]);
  })();

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
          <button className="btn btn-gold" onClick={() => go("lawyer")}>⚖️ Verifikasi ke Advokat</button>
        </div>
      </div>

      <OnboardChecklist />

      <div className="grid g4">
        <Kpi ico={<FolderArchive size={42} strokeWidth={1} opacity={0.15} />} v={docs} label="Rekam tercatat (CATAT)" tr={`${t.emp.length} karyawan · ${t.lic.length} izin · ${t.agr.length} perjanjian`} trCls="up" />
        <Kpi ico={<ShieldCheck size={42} strokeWidth={1} opacity={0.15} />} v={izinAktif} label="Izin aktif dipantau (JAGA)" tr={t.lic.length ? `dari ${t.lic.length} izin dalam rekam` : "belum ada izin terdaftar"} trCls="dn" onClick={() => go("licensing")} />
        <Kpi ico={<Scale size={42} strokeWidth={1} opacity={0.15} />} v={queueCount} label="Draf menunggu verifikasi (JAMIN)" tr="SLA prioritas < 24 jam" trCls="md" onClick={() => go("lawyer")} />
        <div className="kpi">
          <div className="score-ring">
            <div className="ring" id="scoreRing"><i>{score}</i></div>
            <div>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Skor Kesehatan Hukum</span>
              <span className="tr up" style={{ display: "block" }}>{aspekAman}/{aspek.length} aspek terpenuhi{aspekBelum ? ` · ${aspekBelum} belum dinilai` : ""}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g4 mt16">
        <Kpi ico={<Building size={42} strokeWidth={1} opacity={0.15} />} v={t.assets.length + t.hki.length} label="Aset & HKI tercatat" tr={asetPerhatian ? `${asetPerhatian} aset perlu perhatian` : `${t.hki.length} HKI terdaftar`} trCls="md" onClick={() => go("asset")} />
        <Kpi ico={<ReceiptText size={42} strokeWidth={1} opacity={0.15} />} v={taxScore} label="Skor kepatuhan pajak" tr={pajak.total ? `${pajak.total} kewajiban tercatat` : "belum ada kewajiban tercatat"} trCls="up" onClick={() => go("pajak")} />
        <Kpi ico={<LifeBuoy size={42} strokeWidth={1} opacity={0.15} />} v={t.asr.pol.length} label="Polis asuransi dipantau" tr={t.asr.pol.length ? "seluruh polis dalam rekam" : "belum ada polis terdaftar"} trCls="md" onClick={() => go("asuransi")} />
        <Kpi ico={<Hourglass size={42} strokeWidth={1} opacity={0.15} />} v={<span style={{ fontSize: 21 }}>{pajak.next}</span>} label="Kewajiban pajak terdekat" tr={pajak.nextTr} trCls="dn" onClick={() => go("pajak")} />
      </div>

      <div className="grid g-wide mt16" style={{ alignItems: "stretch" }}>
        <Panel title="Pengingat Kepatuhan — Deteksi Dini Fungsi Jaga">
          <div className="rows">
            {remData.map((r, i) => (
              <Row key={i} b={r[0]} d={r[1]} right={<Chip c={r[2]}>{r[3]}</Chip>} onClick={() => go(r[4] as ViewId)} />
            ))}
            {!remData.length && <p className="note">Belum ada pengingat. Tenggat muncul otomatis begitu izin, perjanjian, atau kewajiban pajak tercatat.</p>}
          </div>
        </Panel>
        <Panel title="Alur Verifikasi — Fungsi Jamin" className="flex flex-col">
          <div className="rows">
            {verifData.map((v, i) => (
              <Row key={i} b={v[0]} d={v[1]} right={<Chip c={v[2]}>{v[3]}</Chip>} />
            ))}
            {!verifData.length && <p className="note">Belum ada pengajuan. Ajukan dokumen ke advokat dari modul mana pun — statusnya muncul di sini.</p>}
          </div>
          <div className="quota" style={{ marginTop: "auto", paddingTop: 14 }}>
            <div className="lbl"><span>Kuota verifikasi bulan ini</span><b>{quota} / {quotaMax}</b></div>
            <div className="bar"><i className="bl" style={{ width: `${Math.min(100, (quota / quotaMax) * 100)}%` }} /></div>
          </div>
        </Panel>
      </div>

      <div className="grid g3 mt16">
        {/* ponytail: riwayat skor belum punya tabel — kurva peraga DIBUANG (nol dummy).
            Ganti grafik nyata saat tabel snapshot skor bulanan dibuat. */}
        <Panel title="Skor Kesehatan Hukum — Aspek LDD" className="flex flex-col">
          <div style={{ display: "grid", gap: 8, fontSize: 11.5 }}>
            {aspek.length ? Object.entries(ldd.counts).map(([nama, c]) => (
              <div key={nama} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nama}</span>
                {c.rekam === 0
                  ? <Chip c="c-mon">BELUM DINILAI</Chip>
                  : <Chip c={c.status === "AMAN" ? "c-ver" : c.status === "BERMASALAH" ? "c-red" : "c-draft"}>{c.status}</Chip>}
              </div>
            )) : <p className="note">Belum ada rekam untuk dinilai.</p>}
          </div>
          <p className="note mt16">Riwayat tren bulanan tampil setelah snapshot skor terkumpul.</p>
        </Panel>
        <Panel title="Rekam per Bab">
          <div style={{ display: "grid", gap: 8, fontSize: 11.5 }}>
            {babRows.map((b, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>{b[0]}</span><b>{b[1]}</b></div>
                <div className="bar"><i className="bl" style={{ width: `${b[2]}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="dark" title="Regulasi & Dasar Hukum">
          <p>Tanyakan perubahan regulasi yang relevan dengan bidang usaha Anda kepada AI Assistant — jawaban merujuk sumber resmi (JDIH · peraturan.go.id · Lembaran Negara).</p>
          <button className="btn btn-gold btn-sm mt16" onClick={() => go("assistant")}>Tanyakan ke AI Assistant</button>
        </Panel>
      </div>

      {/* Revisi owner 5y-#1: menu LDD & dashboard Employment dilebur ke Ringkasan. */}
      <div className="mt16" style={{ borderTop: "1px solid var(--line)", paddingTop: 22 }}>
        <Ldd embed />
      </div>
      <div className="mt16" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
        <HRDashboard />
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
