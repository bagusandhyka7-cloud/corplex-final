"use client";
import React, { useState } from "react";
import { RadioTower, Scale, Upload } from "lucide-react";
import { Klaim } from "@/lib/data";
import { clone, useStore, ViewId } from "@/lib/store";
import { Chip, Field, Kpi, Panel, Row, Tabs, Timeline, ViewHead } from "@/components/ui";

export default function Asuransi() {
  const { ten, go, toast, pushQueue } = useStore();
  const t = ten!;
  const [tab, setTab] = useState(0);
  const [f, setF] = useState("semua");
  const [pol, setPol] = useState(() => clone(t.asr.pol));
  const [klaim, setKlaim] = useState<Klaim[]>(() => clone(t.asr.klaim));
  const [nkObj, setNkObj] = useState(t.asr.pol[0] ? `${t.asr.pol[0][3]} — ${t.asr.pol[0][0]}` : "");
  const [nkDesc, setNkDesc] = useState("");

  const renew = (i: number) => {
    setPol((ps) => {
      const n = clone(ps);
      n[i][7] = "PENGURUSAN"; n[i][8] = "c-mon"; n[i][9] = "PENGURUSAN";
      return n;
    });
    toast("Perpanjangan polis dimulai", "Permintaan penawaran terkirim ke penanggung — tenggat JAGA tetap aktif hingga polis baru terbit dan tertaut ke rekam.", "ok");
  };

  const newKlaim = () => {
    if (!nkDesc.trim()) { toast("Kronologi wajib diisi", "Uraikan kejadian sebagai dasar klaim.", "warn"); return; }
    setKlaim((ks) => [{
      t: "Klaim Baru — " + nkObj.split(" — ")[0], obj: nkObj, nilai: "Taksiran menyusul", cls: "c-draft", lbl: "DRAF AI",
      tl: [["HARI INI", "Klaim diajukan", "Berkas dirakit AI dari rekam — menunggu nomor registrasi penanggung", "next"]],
    }, ...ks]);
    setNkDesc("");
    pushQueue("Klaim asuransi — " + nkObj.split(" — ")[0], "Berkas klaim dirakit AI · verifikasi sebelum dikirim ke penanggung", "c-draft", "DRAF AI");
    toast("Klaim disusun — DRAF AI", "Dokumen pendukung ditarik dari vault · masuk antrean verifikasi advokat sebelum dikirim ke penanggung.", "ok");
  };

  return (
    <div>
      <ViewHead en="Modul 4.10 · Insurance & Risk Transfer Management · Layer 2" h1="Manajemen Asuransi"
        sub={<>Registrasi polis berbasis unggah dokumen — objek pertanggungan <b>tertaut langsung ke rekam Aset &amp; Karyawan</b>. Jatuh tempo polis, iuran BPJS, dan alur klaim dipantau fungsi JAGA; kesenjangan proteksi terdeteksi otomatis.</>}
        acts={<button className="btn btn-navy" onClick={() => toast("Registrasi polis", "Unggah dokumen polis → AI mengekstrak penanggung, objek, nilai pertanggungan, masa berlaku → tautan otomatis ke aset/karyawan pada rekam.")}><Upload size={14} /> Daftarkan Polis (AI Ekstraksi)</button>} />

      <div className="grid g4 mb16">
        <Kpi v={pol.length} label="Polis aktif dipantau" tr={t.asr.polTr} />
        <Kpi v={<span style={{ fontSize: 21 }}>{t.asr.nilai}</span>} label="Total nilai pertanggungan" tr="Tertaut rekam aset" trCls="up" />
        <Kpi v={klaim.filter((k) => k.tl).length} label="Klaim berjalan" tr="Alur klaim terpantau" />
        <Kpi v={t.asr.gap.length} label="Kesenjangan proteksi" tr="Objek tanpa polis tertaut" trCls="dn" />
      </div>

      <Tabs items={["Polis & Pertanggungan", "Klaim", "Integrasi Aset & Karyawan"]} cur={tab} onSel={setTab} />

      {tab === 0 && (
        <div>
          <div className="filters">
            {["semua", "AKTIF", "SEGERA", "KLAIM"].map((x) => (
              <button key={x} className={`fchip${f === x ? " on" : ""}`} onClick={() => setF(x)}>
                {x === "semua" ? "Semua" : x === "AKTIF" ? "Aktif" : x === "SEGERA" ? "Segera berakhir" : "Klaim berjalan"}
              </button>
            ))}
          </div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Polis</th><th>Objek Pertanggungan (Tertaut Rekam)</th><th>Nilai Pertanggungan</th><th>Masa Berlaku</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {pol.map((p, i) => (f === "semua" || p[7] === f) ? (
                  <tr key={i}>
                    <td><b>{p[0]}</b><span className="sub mono" style={{ fontSize: 10 }}>{p[1]} · No. {p[2]}</span></td>
                    <td style={{ cursor: "pointer" }} onClick={() => go(p[4] as ViewId)} title="Buka rekam sumber">
                      <b style={{ fontSize: 12 }}>{p[3]}</b><span className="sub" style={{ color: "var(--gold-deep)" }}>↗ buka rekam tertaut</span>
                    </td>
                    <td>{p[5]}</td><td>{p[6]}</td>
                    <td><Chip c={p[8]}>{p[9]}</Chip></td>
                    <td>
                      {p[7] === "SEGERA" ? <button className="btn btn-gold btn-sm" onClick={() => renew(i)}>Perpanjang</button>
                        : p[7] === "KLAIM" ? <button className="btn btn-line btn-sm" onClick={() => setTab(1)}>Lihat Klaim</button>
                          : p[7] === "PENGURUSAN" ? <button className="btn btn-line btn-sm" onClick={() => toast("Tracking perpanjangan", "Penawaran penanggung ditunggu — perbandingan premi dan klausul disiapkan AI.")}>Lacak</button>
                            : <button className="btn btn-line btn-sm" onClick={() => toast("Detail polis", "Dokumen polis, klausul pertanggungan, dan riwayat premi — tersimpan di vault dengan hash.")}>Detail</button>}
                    </td>
                  </tr>
                ) : null)}
              </tbody>
            </table>
          </div>
          <p className="note mt16"><b>Aliran data:</b> registrasi aset (4.6) dan tenaga kerja (4.3) menawarkan penautan polis otomatis; tanggal akhir polis menjadi aturan JAGA (H-90 → H-14); premi jatuh tempo tampil pada satu kalender kepatuhan bersama pajak (4.11).</p>
        </div>
      )}

      {tab === 1 && (
        <div className="grid g-wide">
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            {klaim.map((k, i) => k.tl ? (
              <Panel key={i} title={<>{k.t} <Chip c={k.cls}>{k.lbl}</Chip></>}>
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>{k.obj} · {k.nilai}</p>
                <Timeline items={k.tl} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button className="btn btn-line btn-sm" onClick={() => toast("Bundel dokumen klaim", "Polis + berita acara + bukti kepemilikan ditarik otomatis dari vault — hash terverifikasi.", "ok")}>Bundel Dokumen</button>
                  <button className="btn btn-gold btn-sm" onClick={() => pushQueue(k.t, "Eskalasi klaim asuransi · dokumen dan kronologi terlampir", "c-gold", "ESKALASI")}><Scale size={12} /> Dampingi Advokat</button>
                </div>
              </Panel>
            ) : (
              <Panel key={i}>
                <div className="rows"><Row b={k.t} d={`${k.obj} · ${k.nilai}`} right={<Chip c={k.cls}>{k.lbl}</Chip>} /></div>
              </Panel>
            ))}
          </div>
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <Panel title="Ajukan Klaim Baru">
              <Field label="Objek & polis (dari rekam)">
                <select value={nkObj} onChange={(e) => setNkObj(e.target.value)}>
                  {pol.map((p, i) => <option key={i}>{p[3]} — {p[0]}</option>)}
                </select>
              </Field>
              <Field label="Kronologi kejadian">
                <textarea rows={3} value={nkDesc} placeholder="Uraikan insiden — tanggal, lokasi, taksiran kerugian…" onChange={(e) => setNkDesc(e.target.value)} />
              </Field>
              <button className="btn btn-navy" onClick={newKlaim}>Ajukan Klaim (AI Menyusun Berkas)</button>
              <p className="note mt16"><b>Otomatis dari rekam:</b> polis, bukti kepemilikan aset / perjanjian kerja, dan dokumen pendukung ditarik dari vault — Anda tidak mengunggah ulang.</p>
            </Panel>
          </div>
        </div>
      )}

      {tab === 2 && (
        <div className="grid g2">
          <Panel title="Peta Proteksi — Aset ↔ Polis · Karyawan ↔ Jaminan">
            <div className="rows">
              {pol.map((p, i) => (
                <Row key={i} b={p[3]} d={`↔ ${p[0]} · ${p[5]}`} right={<Chip c={p[8]}>{p[9]}</Chip>} onClick={() => go(p[4] as ViewId)} />
              ))}
            </div>
          </Panel>
          <Panel title={<>Deteksi Kesenjangan Proteksi <Chip c="c-gold"><RadioTower size={9} style={{ display: "inline" }} /> OTOMATIS</Chip></>}>
            <div className="rows">
              {t.asr.gap.map((g, i) => (
                <Row key={i} b={g[0]} d={g[1]} right={<>
                  <Chip c={g[2]}>{g[3]}</Chip>
                  <button className="btn btn-gold btn-sm" onClick={() => pushQueue("Kesenjangan proteksi — " + g[0], "Dari Manajemen Asuransi · rekomendasi penutupan polis", "c-draft", "DRAF AI")}>Eskalasi</button>
                </>} />
              ))}
            </div>
            <p className="note mt16">Temuan kesenjangan tersinkron dengan hasil <b>Due Diligence aset (4.6)</b> — objek bernilai tanpa polis tertaut menurunkan skor kesehatan hukum pada Ringkasan.</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
