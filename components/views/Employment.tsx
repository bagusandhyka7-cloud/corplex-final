"use client";
import React, { useRef, useState } from "react";
import { ChevronRight, Download, FileText, Scale, Upload } from "lucide-react";
import { Emp, SP } from "@/lib/data";
import { clone, fmt, useStore } from "@/lib/store";
import { downloadDoc, registerVault, vaultHash } from "@/lib/vault";
import { api, withRetry } from "@/lib/api";
import { useAsyncAction, useUpload } from "@/lib/hooks";
import { Chip, Field, Kpi, Modal, Panel, Row, Spark, Tabs, ViewHead } from "@/components/ui";

const spExpired = (s: SP) => !!(s.expISO && new Date(s.expISO + "T23:59:59") < new Date());
const hasExpiredSP = (e: Emp) => (e.sp || []).some(spExpired);
const hasActiveSP = (e: Emp, t: string) => (e.sp || []).some((s) => s.t === t && !spExpired(s) && s.st !== "ESKALASI");
const spState = (s: SP): [string, string] =>
  s.st === "ESKALASI" ? ["c-gold", "ESKALASI ADVOKAT"] : spExpired(s) ? ["c-red", "HABIS MASA BERLAKU"] : s.ver ? ["c-ver", "AKTIF · VERIFIED"] : ["c-draft", "AKTIF · DRAF AI"];

export default function Employment() {
  const { ten, toast, pushQueue } = useStore();
  const t = ten!;
  const [tab, setTab] = useState(0);
  const [emp, setEmp] = useState<Emp[]>(() => clone(t.emp));
  const [f, setF] = useState("semua");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const spFileRef = useRef<HTMLInputElement>(null);

  /* modal ekstraksi karyawan */
  const [exOpen, setExOpen] = useState(false);
  const [ex, setEx] = useState({ dok: "", nama: "", jk: "L", wn: "TKI", lok: "1", status: "PKWT", jab: "", masa: "" });

  /* detail karyawan */
  const [detIdx, setDetIdx] = useState(-1);
  const [spForm, setSpForm] = useState<{ dok: string; tingkat: string; tgl: string; masa: string; alasan: string } | null>(null);
  const det = detIdx >= 0 ? emp[detIdx] : null;

  /* kalkulator */
  const [pWage, setPWage] = useState(5200000);
  const [pYears, setPYears] = useState(2);
  const [pReason, setPReason] = useState("ef");
  const [pName, setPName] = useState("Rina Wulandari — PKWT (32 hari tersisa)");
  const [out, setOut] = useState({ pes: 0, pmk: 0, hak: 0, komp: 0 });

  /* SP issuance form */
  const [spNama, setSpNama] = useState("Joko Susilo (SP1 aktif s.d. Jan 2027)");
  const [spTingkat, setSpTingkat] = useState("SP1");
  const [spAlasan, setSpAlasan] = useState("Pelanggaran SOP gudang berulang");
  const [spList, setSpList] = useState([
    { t: "SP1 — Joko Susilo", d: "Keterlambatan berulang · 3 Jul 2026 · berlaku 6 bulan", chip: "c-ver", lbl: "VERIFIED" },
    { t: "SP2 — Rudi Hartawan", d: "Pelanggaran SOP gudang · draf AI dari riwayat SP1", chip: "c-draft", lbl: "DRAF AI" },
  ]);

  const rows = emp.map((e, i) => ({ e, i })).filter(({ e }) => {
    if (f === "PKWTT" && e.s !== "PKWTT") return false;
    if (f === "PKWT" && e.s !== "PKWT") return false;
    if (f === "TKI" && e.wn !== "TKI") return false;
    if (f === "TKA" && e.wn !== "TKA") return false;
    if (f === "reminder" && !e.rem) return false;
    return (e.n + " " + e.j).toLowerCase().includes(q.toLowerCase());
  });

  /* Upload karyawan → vault (progress/cancel/retry) → AI extraction modal. */
  const empUp = useUpload((file) => {
    registerVault(file);
    const fn = file.name;
    const guess = fn.replace(/\.[^.]+$/, "").replace(/^(PK[_ -]?)?(PKWTT?[_ -]?)?(KTP[_ -]?)?(Pengesahan[_ -]?)?(RPTKA[_ -]?)?/i, "").replace(/[_-]+/g, " ").trim();
    const isTKA = /rptka|imta|kitas/i.test(fn), isPKWTT = /pkwtt/i.test(fn);
    setEx({ dok: fn, nama: guess, jk: "L", wn: isTKA ? "TKA" : "TKI", lok: isTKA ? "0" : "1", status: isPKWTT ? "PKWTT" : "PKWT", jab: "", masa: "" });
    setExOpen(true);
  });
  const empUpload = async (file: File) => {
    if (empUp.uploading) return; // double-submit guard
    toast("AI membaca dokumen…", "Ekstraksi field tenaga kerja sesuai format LKPM: nama · jenis kelamin · TKI/TKA · lokal setempat · status hubungan kerja.");
    const res = await empUp.start(file);
    if (!res.ok && res.error.code !== "aborted") { toast("Unggahan gagal", res.error.message + " — mencoba ulang…", "warn"); empUp.retry(); }
  };

  const { run: empSave, pending: empSaving } = useAsyncAction(async () => {
    if (!ex.nama.trim()) { toast("Nama wajib diisi", "Lengkapi hasil ekstraksi sebelum menyimpan.", "warn"); return; }
    const rec = {
      n: ex.nama, j: ex.jab.trim() || "—", jk: ex.jk as "L" | "P", wn: ex.wn as "TKI" | "TKA",
      lok: ex.lok === "1", s: ex.status as "PKWT" | "PKWTT",
      m: ex.masa.trim() || (ex.status === "PKWTT" ? "Sejak 2026" : "2026 – 2027"),
      sisa: ex.status === "PKWT" ? 60 : null, hari: ex.status === "PKWT" ? "baru terdaftar" : null,
      komp: ex.status === "PKWT" ? "Terjadwal" : "—", pat: "PATUH", rem: false, dok: ex.dok,
    } as Emp;
    const res = await withRetry(() => api.employees.create(rec as unknown as Record<string, unknown>));
    if (!res.ok) { toast("Gagal menyimpan", res.error.message, "warn"); return; }
    setEmp((es) => [rec, ...es]);
    setExOpen(false);
    toast("Tenaga kerja tercatat — DRAF AI", `Dokumen tersimpan di vault (hash tercatat) · rekap LKPM diperbarui otomatis${ex.wn === "TKA" ? " · validasi keterkaitan RPTKA dijalankan" : ""}.`, "ok");
  });

  /* Upload SP → vault → form ekstraksi SP. */
  const spUp = useUpload((file) => {
    registerVault(file);
    const m = file.name.match(/SP\s*([123])/i);
    setSpForm({ dok: file.name, tingkat: m ? "SP" + m[1] : "SP1", tgl: new Date().toISOString().slice(0, 10), masa: "6", alasan: "" });
  });
  const spUpload = async (file: File) => {
    if (spUp.uploading) return; // double-submit guard
    toast("AI membaca dokumen SP…", "Ekstraksi: tingkat SP · tanggal terbit · masa berlaku · alasan pelanggaran.");
    const res = await spUp.start(file);
    if (!res.ok && res.error.code !== "aborted") { toast("Unggahan gagal", res.error.message + " — mencoba ulang…", "warn"); spUp.retry(); }
  };

  const { run: spCommit, pending: spSaving } = useAsyncAction(async () => {
    if (!spForm || detIdx < 0) return;
    const e = emp[detIdx];
    if (!spForm.alasan.trim()) { toast("Alasan wajib diisi", "Uraikan pelanggaran sebagai dasar SP.", "warn"); return; }
    if (spForm.tingkat === "SP2" && !hasActiveSP(e, "SP1")) { toast("Ditolak oleh guard", "SP2 hanya sah bila ada SP1 yang masih berlaku — SP1 tenaga kerja ini tidak ada / telah habis masa.", "warn"); return; }
    if (spForm.tingkat === "SP3" && !hasActiveSP(e, "SP2")) { toast("Ditolak oleh guard", "SP3 hanya sah bila ada SP2 yang masih berlaku.", "warn"); return; }
    const d = new Date(spForm.tgl);
    const x = new Date(d); x.setMonth(x.getMonth() + +spForm.masa);
    const fmtD = (dt: Date) => dt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    const rec: SP = { t: spForm.tingkat, tgl: fmtD(d), exp: fmtD(x), expISO: x.toISOString().slice(0, 10), alasan: spForm.alasan, dok: spForm.dok, ver: false };
    const res = await withRetry(() => api.employees.issueSp(rec as unknown as Record<string, unknown>));
    if (!res.ok) { toast("Gagal menyimpan SP", res.error.message, "warn"); return; }
    if (spForm.tingkat === "SP3") {
      rec.st = "ESKALASI";
      pushQueue("SP3 — " + e.n, "Unggahan SP3 dari detail karyawan · eskalasi wajib: berujung risiko PHK (berakibat_hukum=true)", "c-gold", "ESKALASI");
    }
    setEmp((es) => { const n = clone(es); n[detIdx].sp = [rec, ...(n[detIdx].sp || [])]; return n; });
    setSpForm(null);
    toast(spForm.tingkat + " tercatat" + (spForm.tingkat === "SP3" ? " — dieskalasikan" : ""), `Dokumen di vault · masa berlaku ${spForm.masa} bulan dipantau fungsi JAGA — status otomatis menjadi HABIS MASA BERLAKU saat jatuh tempo.`, spForm.tingkat === "SP3" ? "warn" : "ok");
  });

  const issueSP = () => {
    if (spTingkat === "SP2" && spNama.startsWith("Dedi")) { toast("Ditolak oleh guard backend", "SP2 hanya sah bila ada SP1 aktif — karyawan ini tanpa SP1.", "warn"); return; }
    if (spTingkat === "SP3") {
      pushQueue("SP3 — " + spNama.split(" (")[0], "Eskalasi wajib: SP3 berujung risiko PHK (berakibat_hukum=true)", "c-gold", "ESKALASI");
      toast("SP3 dieskalasikan", "Guard: penerbitan SP3 selalu melalui verifikasi advokat MRWP.", "warn"); return;
    }
    setSpList((l) => [{ t: `${spTingkat} — ${spNama.split(" (")[0]}`, d: `${spAlasan} · draf AI dari riwayat pelanggaran`, chip: "c-draft", lbl: "DRAF AI" }, ...l]);
    toast(`Draf ${spTingkat} disusun`, "Alur berjenjang tervalidasi · masa berlaku 6 bulan · siap diajukan verifikasi.", "ok");
  };

  const calcPHK = () => {
    let pes = 0, pmk = 0, hak = 0, komp = 0;
    if (pReason === "pkwt") komp = pWage * Math.min(pYears, 5);
    else {
      const bulanPes = pYears < 1 ? 1 : Math.min(Math.floor(pYears) + 1, 9);
      pes = bulanPes * pWage * (pReason === "ef" ? 0.5 : 1);
      const bulanPMK = pYears >= 3 ? Math.min(Math.floor(pYears / 3) + 1, 10) : 0;
      pmk = bulanPMK * pWage; hak = (pes + pmk) * 0.15;
    }
    setOut({ pes, pmk, hak, komp });
  };

  const c = (wn: string, jk: string) => emp.filter((e) => e.wn === wn && e.jk === jk).length;
  const massTotal = t.mass.reduce((s, r) => s + r[1] * (r[2] / 12), 0);

  return (
    <div>
      <ViewHead en="Modul 4.3 · Legal Human Capital Compliance System · Layer 2" h1="Employment Management"
        sub={<>Parameter regulasi tersimpan bervolusi (aturan_versi) — regulasi berubah, sistem mengikuti; setiap perhitungan dapat diaudit &quot;dihitung dengan aturan mana&quot;.</>}
        acts={<>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) empUpload(file); e.target.value = ""; }} />
          <button className="btn btn-navy" onClick={() => fileRef.current?.click()}><Upload size={14} /> Unggah Dokumen Karyawan (AI Ekstraksi)</button>
        </>} />

      <Tabs items={["Database Karyawan", "Surat Peringatan", "Kalkulator PHK", "Rekap PKWT Massal", "Compliance Report"]} cur={tab} onSel={setTab} />

      {tab === 0 && (
        <div>
          <div className="grid g4 mb16">
            <Kpi v={emp.length} label="Total tenaga kerja" tr="di luar Komisaris & Direksi" />
            <Kpi v={emp.filter((e) => e.wn === "TKI").length} label="Tenaga Kerja Indonesia (TKI)" />
            <Kpi v={emp.filter((e) => e.wn === "TKA").length} label="Tenaga Kerja Asing (TKA)" tr="RPTKA terpantau" />
            <Kpi v={emp.filter((e) => e.lok).length} label="Tenaga kerja lokal setempat" />
          </div>

          <div className="dropzone mb16" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gold)"; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = ""; const file = e.dataTransfer.files?.[0]; if (file) empUpload(file); }}>
            <b>Letakkan dokumen karyawan di sini — atau klik untuk memilih berkas</b>
            Perjanjian Kerja (PKWT/PKWTT) · KTP · Pengesahan RPTKA — AI mengekstrak field sesuai format pelaporan tenaga kerja LKPM (jenis kelamin · TKI/TKA · lokal setempat) → Anda mengonfirmasi sebelum tersimpan
          </div>

          <div className="filters">
            <input className="finput" placeholder="Cari nama / jabatan…" value={q} onChange={(e) => setQ(e.target.value)} />
            {["semua", "TKI", "TKA", "PKWTT", "PKWT", "reminder"].map((x) => (
              <button key={x} className={`fchip${f === x ? " on" : ""}`} onClick={() => setF(x)}>{x === "semua" ? "Semua" : x === "reminder" ? "Reminder aktif" : x}</button>
            ))}
          </div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Tenaga Kerja</th><th>Jenis Kelamin</th><th>TKI / TKA</th><th>Lokal Setempat</th><th>Status &amp; Masa Kerja</th><th>Dokumen Sumber</th><th>Kepatuhan</th></tr></thead>
              <tbody>
                {rows.map(({ e, i }) => (
                  <tr key={i}>
                    <td className="emp-name" onClick={() => { setDetIdx(i); setSpForm(null); }} title="Klik untuk detail, dokumen & SP">
                      <b>{e.n} <ChevronRight size={11} style={{ display: "inline", color: "var(--gold)" }} /></b><span className="sub">{e.j}</span>
                    </td>
                    <td>{e.jk === "P" ? "Perempuan" : "Laki-laki"}</td>
                    <td><Chip c={e.wn === "TKA" ? "c-gold" : "c-mon"}>{e.wn}</Chip></td>
                    <td>{e.lok ? "Ya" : "—"}</td>
                    <td><Chip c={e.s === "PKWTT" ? "c-mon" : "c-gold"}>{e.s}</Chip><span className="sub">{e.m}{e.sisa !== null && e.hari ? ` · sisa ${e.hari}` : ""}</span></td>
                    <td>
                      <span className="sub mono" style={{ fontSize: 10 }}><FileText size={10} style={{ display: "inline" }} /> {e.dok}</span>
                      <button className="btn btn-line btn-sm" onClick={() => { downloadDoc(e.dok, t.name); toast("Unduhan dimulai", `${e.dok} · hash ${vaultHash(e.dok)} · akses unduh tercatat pada jejak audit.`, "ok"); }}><Download size={11} /></button>
                    </td>
                    <td>
                      <Chip c={e.pat === "PATUH" ? "c-ver" : "c-draft"}>{e.pat === "PATUH" ? "PATUH" : "REMINDER AKTIF"}</Chip>
                      {hasExpiredSP(e) ? <> <Chip c="c-red">SP HABIS MASA</Chip></> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid g2 mt16">
            <Panel title="Rekap LKPM — Penggunaan Tenaga Kerja (Periode Pelaporan Berjalan)">
              <div className="tblwrap"><table style={{ minWidth: 0 }}><tbody>
                {[
                  ["Tenaga Kerja Indonesia — Laki-laki", c("TKI", "L")],
                  ["Tenaga Kerja Indonesia — Perempuan", c("TKI", "P")],
                  ["Tenaga Kerja Asing — Laki-laki", c("TKA", "L")],
                  ["Tenaga Kerja Asing — Perempuan", c("TKA", "P")],
                  ["Tenaga kerja lokal setempat", emp.filter((e) => e.lok).length],
                  ["Pengurangan tenaga kerja periode pelaporan", t.empOut],
                ].map((r, i) => (
                  <tr key={i}><td>{r[0]}</td><td style={{ textAlign: "right", fontWeight: 700, color: "var(--ink)" }}>{r[1]}</td></tr>
                ))}
                <tr><td style={{ fontWeight: 700, color: "var(--ink)" }}>TOTAL (di luar Komisaris &amp; Direksi)</td><td style={{ textAlign: "right", fontWeight: 700, color: "var(--gold-deep)" }}>{emp.length}</td></tr>
              </tbody></table></div>
              <div style={{ display: "flex", gap: 9, marginTop: 14, flexWrap: "wrap" }}>
                <button className="btn btn-navy btn-sm" onClick={() => toast("Rekap LKPM disalin", "Angka penggunaan tenaga kerja siap diinput ke formulir LKPM OSS-RBA — bukti dokumen sumber tertaut per baris.", "ok")}>Salin ke LKPM Triwulan Berjalan</button>
                <button className="btn btn-gold btn-sm" onClick={() => pushQueue("Rekap tenaga kerja LKPM", "Agregasi dari dokumen terunggah · periode pelaporan berjalan", "c-draft", "DRAF AI")}><Scale size={12} /> Ajukan Verifikasi</button>
              </div>
            </Panel>
            <Panel title="Ketentuan Pencatatan">
              <div className="rows">
                <Row b="Di luar Komisaris & Direksi" d="Tenaga kerja yang dicatat pada LKPM tidak termasuk jabatan Komisaris dan Direksi" right={<Chip c="c-ver">DITERAPKAN</Chip>} />
                <Row b="Rincian TKI & TKA per jenis kelamin" d="Klasifikasi mengikuti kolom formulir LKPM OSS-RBA · TKA wajib tertaut pengesahan RPTKA" right={<Chip c="c-ver">DITERAPKAN</Chip>} />
                <Row b="Pengurangan tenaga kerja periode pelaporan" d="PHK / berakhirnya PKWT pada periode berjalan tercatat otomatis dari rekam" right={<Chip c="c-mon">OTOMATIS</Chip>} />
              </div>
              <p className="note mt16">Setiap baris tabel bersumber dari <b>dokumen terunggah</b> (PK/KTP/RPTKA) yang tersimpan di vault dengan hash — angka rekap LKPM selalu dapat diaudit ke dokumen asalnya. Kolom data pribadi tunduk UU PDP (register pemrosesan: dasar kontraktual).</p>
            </Panel>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className="grid g2">
          <Panel title="Terbitkan Surat Peringatan — State Machine Berjenjang">
            <Field label="Karyawan">
              <select value={spNama} onChange={(e) => setSpNama(e.target.value)}>
                <option>Joko Susilo (SP1 aktif s.d. Jan 2027)</option><option>Rudi Hartawan (SP2 draf)</option><option>Dedi Firmansyah (tanpa SP)</option>
              </select>
            </Field>
            <Field label="Tingkat"><select value={spTingkat} onChange={(e) => setSpTingkat(e.target.value)}><option>SP1</option><option>SP2</option><option>SP3</option></select></Field>
            <Field label="Alasan"><input value={spAlasan} placeholder="Uraian pelanggaran…" onChange={(e) => setSpAlasan(e.target.value)} /></Field>
            <button className="btn btn-navy" onClick={issueSP}>Susun Draf SP (AI)</button>
            <p className="note mt16"><b>Guard backend:</b> SP2 hanya sah bila ada SP1 aktif; <b>SP3 selalu memaksa eskalasi advokat</b> karena berujung risiko PHK.</p>
          </Panel>
          <Panel title="SP Aktif">
            <div className="rows">
              {spList.map((s, i) => <Row key={i} b={s.t} d={s.d} right={<Chip c={s.chip}>{s.lbl}</Chip>} />)}
            </div>
          </Panel>
        </div>
      )}

      {tab === 2 && (
        <div className="grid g2">
          <Panel title="Simulasi Perhitungan — Pesangon, PMK, Penggantian Hak">
            <Field label="Nama karyawan">
              <select value={pName} onChange={(e) => setPName(e.target.value)}>
                <option>Rina Wulandari — PKWT (32 hari tersisa)</option><option>Andi Prasetyo — PKWTT (7 tahun)</option><option>Siti Nurhaliza — PKWTT (5 tahun)</option>
              </select>
            </Field>
            <div className="grid g2" style={{ gap: 10 }}>
              <Field label="Upah/bulan (Rp)"><input type="number" value={pWage} onChange={(e) => setPWage(+e.target.value || 0)} /></Field>
              <Field label="Masa kerja (tahun)"><input type="number" step={0.5} value={pYears} onChange={(e) => setPYears(+e.target.value || 0)} /></Field>
            </div>
            <Field label="Alasan PHK">
              <select value={pReason} onChange={(e) => setPReason(e.target.value)}>
                <option value="ef">Efisiensi (mencegah kerugian)</option>
                <option value="ef2">Efisiensi (perusahaan tidak merugi)</option>
                <option value="pkwt">PKWT diakhiri sebelum waktunya</option>
              </select>
            </Field>
            <button className="btn btn-navy" onClick={calcPHK}>Hitung Otomatis</button>
            <div className="disclaimer">DRAF AI — perhitungan awal (aturan_versi: KETENAGAKERJAAN-2026.07), bukan nasihat hukum final. Verifikasi advokat wajib sebelum dipakai sebagai dasar PHK.</div>
          </Panel>
          <div className="calc-out">
            <h4>HASIL PERHITUNGAN OTOMATIS</h4>
            <div className="line"><span>Pesangon</span><b>{fmt(out.pes)}</b></div>
            <div className="line"><span>Penghargaan masa kerja</span><b>{fmt(out.pmk)}</b></div>
            <div className="line"><span>Penggantian hak (15%)</span><b>{fmt(out.hak)}</b></div>
            <div className="line"><span>Kompensasi PKWT</span><b>{fmt(out.komp)}</b></div>
            <div className="line total"><span>TOTAL KEWAJIBAN</span><b>{fmt(out.pes + out.pmk + out.hak + out.komp)}</b></div>
            <button className="btn btn-gold btn-sm mt16" onClick={() => pushQueue("Perhitungan PHK — " + pName.split(" —")[0], "Dari kalkulator PHK · aturan_versi 2026.07", "c-draft", "DRAF AI")}><Scale size={12} /> Ajukan Verifikasi Advokat</button>
          </div>
        </div>
      )}

      {tab === 3 && (
        <Panel title={`Rekap Kompensasi Massal — ${t.mass.length} PKWT Berakhir Agustus 2026`}>
          <div className="tblwrap"><table style={{ minWidth: 0 }}>
            <thead><tr><th>Karyawan</th><th>Upah/bulan</th><th>Masa PKWT</th><th>Kompensasi</th></tr></thead>
            <tbody>
              {t.mass.map((r, i) => (
                <tr key={i}><td><b>{r[0]}</b></td><td>{fmt(r[1])}</td><td>{r[2]} bulan</td><td>{fmt(r[1] * (r[2] / 12))}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3} style={{ fontWeight: 700, color: "var(--ink)" }}>TOTAL KEWAJIBAN KOMPENSASI</td><td style={{ fontWeight: 700, color: "var(--gold-deep)" }}>{fmt(massTotal)}</td></tr></tfoot>
          </table></div>
          <div style={{ display: "flex", gap: 9, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn btn-navy btn-sm" onClick={() => toast("Rekap diekspor", `${t.mass.length} perhitungan + rekap dibuat — status DRAF AI, aturan_versi 2026.07.`, "ok")}>Ekspor Rekap</button>
            <button className="btn btn-gold btn-sm" onClick={() => pushQueue(`Rekap kompensasi ${t.mass.length} PKWT`, "Perhitungan massal · Agustus 2026", "c-draft", "DRAF AI")}><Scale size={12} /> Ajukan Verifikasi</button>
          </div>
        </Panel>
      )}

      {tab === 4 && (
        <div className="grid g2">
          <Panel title="Audit Bulanan — Juli 2026">
            <div className="rows">
              <Row b="Upah vs UMK provinsi" d="48/48 karyawan di atas UMK — tabel referensi 2026" right={<Chip c="c-ver">LOLOS</Chip>} />
              <Row b="Akumulasi masa PKWT vs batas regulasi" d="17/17 dalam batas · trigger validasi aktif" right={<Chip c="c-ver">LOLOS</Chip>} />
              <Row b="SP kedaluwarsa belum ditutup" d="1 SP1 melewati masa berlaku tanpa penutupan" right={<Chip c="c-draft">PERBAIKI</Chip>} />
              <Row b="Kontrak tanpa dokumen tertaut" d="1 addendum belum diunggah ke rekam" right={<Chip c="c-draft">PERBAIKI</Chip>} />
            </div>
          </Panel>
          <Panel title="Riwayat Kepatuhan">
            <Spark points="0,28 60,24 120,30 180,16 240,14 300,10" stroke="#1E7F5C" />
            <p className="note">Skor compliance 96% — dua item perbaikan otomatis menjadi tugas berpemilik dengan tenggat, terpantau fungsi JAGA.</p>
          </Panel>
        </div>
      )}

      {/* MODAL EKSTRAKSI KARYAWAN */}
      <Modal open={exOpen} title="Ekstraksi AI — Data Tenaga Kerja (Format LKPM)" onClose={() => setExOpen(false)}
        footer={<>
          <button className="btn btn-line" onClick={() => setExOpen(false)}>Batal</button>
          <button className="btn btn-navy" disabled={empSaving} aria-busy={empSaving} onClick={() => void empSave()}>{empSaving ? "Menyimpan…" : "Simpan ke Rekam"}</button>
        </>}>
        <Field label="Dokumen sumber"><input readOnly value={ex.dok} /></Field>
        <Field label="Nama tenaga kerja"><input value={ex.nama} onChange={(e) => setEx({ ...ex, nama: e.target.value })} /></Field>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Jenis kelamin"><select value={ex.jk} onChange={(e) => setEx({ ...ex, jk: e.target.value })}><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></Field>
          <Field label="Klasifikasi"><select value={ex.wn} onChange={(e) => setEx({ ...ex, wn: e.target.value })}><option value="TKI">TKI — Tenaga Kerja Indonesia</option><option value="TKA">TKA — Tenaga Kerja Asing</option></select></Field>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Tenaga kerja lokal setempat"><select value={ex.lok} onChange={(e) => setEx({ ...ex, lok: e.target.value })}><option value="1">Ya — domisili sesuai lokasi usaha</option><option value="0">Tidak</option></select></Field>
          <Field label="Status hubungan kerja"><select value={ex.status} onChange={(e) => setEx({ ...ex, status: e.target.value })}><option>PKWT</option><option>PKWTT</option></select></Field>
        </div>
        <Field label="Jabatan"><input value={ex.jab} placeholder="Jabatan sesuai perjanjian kerja" onChange={(e) => setEx({ ...ex, jab: e.target.value })} /></Field>
        <Field label="Masa kerja / kontrak"><input value={ex.masa} placeholder="mis. Sep 2026 – Agu 2028 atau Sejak 2026" onChange={(e) => setEx({ ...ex, masa: e.target.value })} /></Field>
        <div className="note">Hasil <b>ekstraksi AI dari dokumen terunggah</b> — koreksi bila perlu. Klasifikasi mengikuti kolom pelaporan tenaga kerja LKPM OSS-RBA (di luar Komisaris &amp; Direksi). TKA memicu validasi keterkaitan pengesahan RPTKA.</div>
      </Modal>

      {/* MODAL DETAIL KARYAWAN */}
      <Modal open={detIdx >= 0} title={det ? `${det.n} — ${det.j}` : "Detail Tenaga Kerja"} onClose={() => setDetIdx(-1)}>
        {det ? (
          <div>
            <h4 style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--gold-deep)", marginBottom: 10 }}>IDENTITAS &amp; DOKUMEN TERTAUT</h4>
            <div className="rows">
              <Row b="Identitas (format LKPM)" d={`${det.jk === "P" ? "Perempuan" : "Laki-laki"} · ${det.wn}${det.lok ? " · lokal setempat" : ""} · ${det.s} · ${det.m}`} right={<Chip c={det.wn === "TKA" ? "c-gold" : "c-mon"}>{det.wn}</Chip>} />
              <Row b={`Perjanjian Kerja (${det.s})`} d={`${det.dok} · hash ${vaultHash(det.dok)} · tersimpan di vault`}
                right={<button className="btn btn-line btn-sm" onClick={() => { downloadDoc(det.dok, t.name); toast("Unduhan dimulai", `${det.dok} · hash ${vaultHash(det.dok)} · akses unduh tercatat pada jejak audit.`, "ok"); }}><Download size={11} /> Unduh</button>} />
              {det.wn === "TKA" ? <Row b="Pengesahan RPTKA" d="Wajib bagi TKA · masa berlaku dipantau fungsi JAGA" right={<Chip c="c-ver">TERTAUT</Chip>} /> : null}
            </div>

            <h4 style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--gold-deep)", margin: "18px 0 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              RIWAYAT SURAT PERINGATAN
              <span>
                <input ref={spFileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) spUpload(file); e.target.value = ""; }} />
                <button className="btn btn-navy btn-sm" onClick={() => spFileRef.current?.click()}><Upload size={11} /> Unggah SP (AI Ekstraksi)</button>
              </span>
            </h4>
            <div className="rows">
              {det.sp?.length ? det.sp.map((s, i) => {
                const st = spState(s);
                return (
                  <Row key={i} b={`${s.t} — ${s.alasan}`} d={`Terbit ${s.tgl} · berlaku s.d. ${s.exp} · ${s.dok} · hash ${vaultHash(s.dok)}`}
                    extra={spExpired(s) && s.st !== "ESKALASI" ? <span className="d" style={{ color: "var(--danger)" }}>⚠ SP habis masa waktu — tidak lagi menjadi dasar SP berjenjang berikutnya; terbitkan SP baru bila pelanggaran berulang.</span> : null}
                    right={<><Chip c={st[0]}>{st[1]}</Chip><button className="btn btn-line btn-sm" onClick={() => { downloadDoc(s.dok, t.name); toast("Unduhan dimulai", `${s.dok} · hash ${vaultHash(s.dok)} · akses unduh tercatat pada jejak audit.`, "ok"); }}><Download size={11} /></button></>} />
                );
              }) : <Row b="Belum ada Surat Peringatan" d="Riwayat SP kosong — rekam bersih untuk tenaga kerja ini." right={<Chip c="c-ver">BERSIH</Chip>} />}
            </div>

            {spForm ? (
              <div style={{ display: "grid", gap: 10, marginTop: 14, background: "var(--sur-2)", border: "1px solid var(--line-2)", borderRadius: 12, padding: 14 }}>
                <Field label="Dokumen sumber"><input readOnly value={spForm.dok} /></Field>
                <div className="grid g2" style={{ gap: 10 }}>
                  <Field label="Tingkat SP"><select value={spForm.tingkat} onChange={(e) => setSpForm({ ...spForm, tingkat: e.target.value })}><option>SP1</option><option>SP2</option><option>SP3</option></select></Field>
                  <Field label="Tanggal terbit"><input type="date" value={spForm.tgl} onChange={(e) => setSpForm({ ...spForm, tgl: e.target.value })} /></Field>
                </div>
                <div className="grid g2" style={{ gap: 10 }}>
                  <Field label="Masa berlaku"><select value={spForm.masa} onChange={(e) => setSpForm({ ...spForm, masa: e.target.value })}><option value="6">6 bulan</option><option value="3">3 bulan</option><option value="12">12 bulan</option></select></Field>
                  <Field label="Alasan pelanggaran"><input value={spForm.alasan} placeholder="Uraian pelanggaran…" onChange={(e) => setSpForm({ ...spForm, alasan: e.target.value })} /></Field>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn btn-line btn-sm" onClick={() => setSpForm(null)}>Batal</button>
                  <button className="btn btn-navy btn-sm" disabled={spSaving} aria-busy={spSaving} onClick={() => void spCommit()}>{spSaving ? "Menyimpan…" : "Simpan SP ke Rekam"}</button>
                </div>
                <p className="note" style={{ margin: 0 }}><b>Guard berjenjang:</b> SP2 hanya sah bila ada SP1 yang <b>masih berlaku</b> (SP habis masa tidak dihitung); SP3 mensyaratkan SP2 aktif dan selalu memaksa eskalasi advokat.</p>
              </div>
            ) : null}

            <div className="note mt16">Corplex <b>merekam dan menjaga basis data hukum</b> perusahaan: setiap dokumen terunggah (PK · SP · KTP · RPTKA) tersimpan di vault dengan hash, dapat <b>diunduh ulang kapan pun</b>, dan masa berlakunya dipantau fungsi JAGA — SP yang lewat masa otomatis berketerangan <b>HABIS MASA BERLAKU</b>.</div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
