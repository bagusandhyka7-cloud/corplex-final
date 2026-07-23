"use client";
import React, { useEffect, useState } from "react";
import { Lock, Plus, RadioTower, Scale } from "lucide-react";
import { Klaim } from "@/lib/data";
import { clone, useStore, ViewId } from "@/lib/store";
import { Chip, Field, Kpi, Panel, Row, Timeline } from "@/components/ui";
import { ModuleShell } from "@/components/ModuleShell";
import { RecActions, RecordModal } from "@/components/RecordModal";
import { idOf, RecRow, stripId, SPECS } from "@/lib/records";
import { aiExtract } from "@/lib/extract";
import { useExcelImport } from "@/components/ExcelImport";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

const SUBJUDUL = ["Polis & Pertanggungan", "Klaim"];

export default function Asuransi() {
  const { ten, toast, activeTab: tab, setActiveTab: setTab, pushQueue, patchTen, go, queue } = useStore();
  const t = ten!;
  const router = useRouter();
  const [f, setF] = useState("semua");
  const [q, setQ] = useState("");
  const [pol, setPol] = useState(() => clone(t.asr.pol));
  useEffect(() => setPol(clone(t.asr.pol)), [t.asr.pol]); // hidrasi DB menyusul mount
  const [mOpen, setMOpen] = useState(false);
  const [mEdit, setMEdit] = useState<RecRow | null>(null);
  const [pfill, setPfill] = useState<Record<string, string> | undefined>();
  const [pfile, setPfile] = useState<File | null>(null);
  const bukaManual = () => { setPfill(undefined); setPfile(null); setMEdit(null); setMOpen(true); };
  const xlsx = useExcelImport("pol");
  const onDone = (row: RecRow, editId: string | null) =>
    patchTen({ asr: { ...t.asr, pol: (editId ? t.asr.pol.map((x) => idOf("pol", x) === editId ? row : x) : [row, ...t.asr.pol]) as typeof t.asr.pol } });
  /* Klaim dulu HANYA state lokal: kartu muncul lalu HILANG saat refresh, padahal pengajuannya
   * sudah masuk antrean advokat — terlihat seperti data hilang. Kini diturunkan dari `queue`
   * (verification_queue) memakai pola yang sama dengan Penugasan Premium di menu Pengacara:
   * bertahan lintas sesi, ikut realtime, nol tabel baru. */
  const klaim: Klaim[] = queue.filter((it) => it.t.startsWith("Klaim asuransi — ")).map((it) => ({
    t: it.t.replace("Klaim asuransi — ", "Klaim — "),
    obj: it.m, nilai: "Taksiran menyusul",
    cls: it.status === "verified" ? "c-ver" : it.status === "rejected" ? "c-red" : "c-draft",
    lbl: it.status === "verified" ? "SELESAI" : it.status === "rejected" ? "PERLU REVISI" : it.status === "meninjau" ? "DITINJAU" : "DRAF AI",
    tl: it.status === "verified" ? undefined : [["BERJALAN", "Klaim diajukan", it.m, "next"]],
  })) as Klaim[];
  const [nkObj, setNkObj] = useState(t.asr.pol[0] ? `${t.asr.pol[0][3]} — ${t.asr.pol[0][0]}` : "");
  const [nkDesc, setNkDesc] = useState("");

  /* Perpanjang: status ditulis NYATA ke module_records (bukan mutasi lokal). */
  const renew = async (row: RecRow) => {
    const id = idOf("pol", row);
    const next = [...(stripId("pol", row) as unknown[])];
    next[7] = "PENGURUSAN"; next[8] = "c-mon"; next[9] = "PENGURUSAN";
    if (id) {
      const r = await api.records.update(id, next);
      if (!r.ok) return toast("Gagal", r.error.message, "warn");
      patchTen({ asr: { ...t.asr, pol: t.asr.pol.map((x) => (idOf("pol", x) === id ? ([...next, id] as unknown as typeof t.asr.pol[number]) : x)) as typeof t.asr.pol } });
    } else {
      setPol((ps) => ps.map((p) => (p === row ? (next as typeof p) : p)));
    }
  };

  /* Klaim: kronologi → draf AI → langsung sinkron ke antrean Pengacara (verification_queue). */
  const [kirimKlaim, setKirimKlaim] = useState(false);
  const newKlaim = async () => {
    if (!nkDesc.trim()) { toast("Kronologi wajib diisi", "Uraikan kejadian sebagai dasar klaim.", "warn"); return; }
    setKirimKlaim(true);
    const objek = nkObj.split(" — ")[0];
    let ringkas = `Klaim atas ${objek}. Kronologi: ${nkDesc.trim()}`;
    // AI menyusun draf berkas klaim; bila AI tak tersedia, kronologi mentah tetap terkirim
    const ai = await api.ai.chatStream({
      messages: [{ role: "user", content: `Susun ringkasan berkas klaim asuransi (maks 4 kalimat, bahasa hukum Indonesia) untuk objek "${objek}". Kronologi kejadian: ${nkDesc.trim()}` }],
      model: "Jago 1.5", company: { name: t.name, sector: t.sector }, onDelta: () => {},
    });
    if (ai.ok && ai.data.trim()) ringkas = ai.data.trim();
    setNkDesc("");
    /* smart attachment: lampirkan rekam polis terpilih agar advokat membukanya instan */
    const polRow = pol.find((p) => `${p[3]} — ${p[0]}` === nkObj);
    const polId = polRow ? idOf("pol", polRow as RecRow) : null;
    pushQueue("Klaim asuransi — " + objek, ringkas.slice(0, 240), "c-draft", "DRAF AI",
      polId ? [{ mod: "pol", id: polId, label: `Polis — ${String(polRow![0])}` }] : undefined,
      `Objek & polis: ${nkObj}\n\nKronologi kejadian (dari klien):\n${nkDesc.trim()}\n\nRingkasan berkas (AI):\n${ringkas}`);
    setKirimKlaim(false);
  };

  /* Bundel dokumen: rakit daftar berkas nyata (rekam modul + dokumen karyawan) lalu simpan
   * sebagai rekam bundel yang bisa dibuka di halaman detail. */
  const bundelDokumen = async (judul: string, objek: string) => {
    const tid = localStorage.getItem("corplex_tid") || "";
    const r = await api.records.list(tid);
    /* daftar berkas ber-URL ikut tersimpan (index 11) — halaman detail merender preview + unduh per berkas */
    const files = r.ok ? r.data.filter((x) => x.dok_url).map((x) => [x.dok_nama || x.module, x.dok_url as string]) : [];
    const isi = [`Bundel — ${judul}`, `Objek: ${objek}`, t.name, "", "", 0, `${files.length} dokumen tertaut`, "AKTIF", "c-mon", "BUNDEL", "detail", files];
    const c = await api.records.create(tid, "lic", isi as never, "ai");
    if (!c.ok) return toast("Gagal membuat bundel", c.error.message, "warn");
    pushQueue(`Bundel dokumen klaim — ${objek}`, `${files.length} dokumen ditarik dari vault · siap dikirim ke penanggung`, "c-mon", "BUNDEL");
  };

  /* Dropzone polis: gambar/PDF → ekstraksi AI NYATA → modal terisi utk dikonfirmasi (dokumen ikut disimpan). */
  const dropDok = async (file: File) => {
    toast("AI membaca dokumen…", "Ekstraksi field polis dari dokumen — Anda konfirmasi sebelum tersimpan.");
    const vals = await aiExtract(file, SPECS.pol.fields);
    setPfill(vals || {}); setPfile(file); setMEdit(null); setMOpen(true);
  };

  /* Relasi ke tabel employees (bukan angka hardcode) */
  const bpjsTk = t.emp.filter((e) => e.bpjsTk).length;
  const bpjsKes = t.emp.filter((e) => e.bpjsKes).length;
  const kurangBpjs = t.emp.filter((e) => !e.bpjsTk || !e.bpjsKes);
  /* Aset yang namanya tak disebut di polis mana pun = objek tanpa proteksi tertaut. */
  const asetTanpaPolis = t.assets.filter((a) => {
    const nama = String((a as unknown[])[0] || "").toLowerCase();
    return nama && !t.asr.pol.some((p) => (String(p[0]) + " " + String(p[3] || "")).toLowerCase().includes(nama));
  }).length;

  const polRows = pol.filter((p) => (f === "semua" || p[7] === f) && (String(p[0]) + p[1] + p[3]).toLowerCase().includes(q.toLowerCase()));

  return (
    <ModuleShell h1={SUBJUDUL[tab] || "Asuransi"}
      sub="Polis kedaluwarsa = aset & karyawan tanpa perlindungan — jatuh tempo dan klaim diingatkan otomatis."
      acts={<button className="btn btn-gold" onClick={bukaManual}><Plus size={14} /> Daftarkan Polis</button>}
      dropNote="Dokumen polis (PDF/pindaian) — AI mengekstrak penanggung, objek, nilai pertanggungan, dan masa berlaku; berkas asli tersimpan di vault. Atau letakkan file Excel (template di Alat Legal) untuk impor massal."
      onDrop={(f2) => { if (!xlsx.tryFile(f2)) void dropDok(f2); }}
      filters={tab === 0 ? ["semua", "AKTIF", "SEGERA", "KLAIM", "PENGURUSAN"] : undefined} active={f} onFilter={setF}
      q={tab === 0 ? q : undefined} setQ={tab === 0 ? setQ : undefined} cariPh="Cari polis / penanggung / objek…"
      kpi={<div className="grid g4 mb16">
        <Kpi v={pol.filter((p) => p[7] === "AKTIF").length} label="Polis aktif dipantau" tr={pol.length ? `dari ${pol.length} polis dalam rekam` : "belum ada polis terdaftar"} />
        {/* Dulu membaca t.asr.nilai (statis, "—" selamanya). Nilai pertanggungan tersimpan sebagai
            teks bebas sehingga TIDAK bisa dijumlahkan — tampilkan kelengkapannya, jangan mengarang total. */}
        <Kpi v={pol.filter((p) => String(p[5] || "").trim()).length} label="Polis bernilai tercatat" tr={`dari ${pol.length} polis`} trCls="up" />
        <Kpi v={klaim.filter((k) => k.tl).length} label="Klaim berjalan" tr="Alur klaim terpantau" />
        {/* Dulu membaca t.asr.gap yang TIDAK PERNAH diisi → selalu 0, seolah nol kesenjangan.
            Kini dihitung nyata: aset yang tak disebut polis mana pun + karyawan tanpa BPJS lengkap. */}
        <Kpi v={asetTanpaPolis + kurangBpjs.length} label="Kesenjangan proteksi" tr={`${asetTanpaPolis} aset tanpa polis · ${kurangBpjs.length} karyawan BPJS belum lengkap`} trCls="dn" />
      </div>}>



      {tab === 0 && (
        <div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Polis</th><th>Objek Pertanggungan (Tertaut Rekam)</th><th>Nilai Pertanggungan</th><th>Masa Berlaku</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {polRows.map((p, i) => (
                  <tr key={i}>
                    <td><b>{p[0]}</b><span className="sub mono" style={{ fontSize: 10 }}>{p[1]} · No. {p[2]}</span></td>
                    <td style={{ cursor: "pointer" }} onClick={() => go(p[4] as ViewId)} title="Buka rekam sumber">
                      <b style={{ fontSize: 12 }}>{p[3]}</b><span className="sub" style={{ color: "var(--gold-deep)" }}>↗ buka rekam tertaut</span>
                    </td>
                    <td>{p[5]}</td><td>{p[6]}</td>
                    <td><Chip c={p[8]}>{p[9]}</Chip></td>
                    <td>
                      <div className="flex items-center gap-2">
                        {idOf("pol", p as RecRow) && <button className="btn-act" onClick={() => router.push(`/rekam/pol/${idOf("pol", p as RecRow)}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button>}
                        {p[7] === "SEGERA" ? <button className="btn-act" onClick={() => void renew(p as RecRow)}>Perpanjang</button>
                          : p[7] === "KLAIM" ? <button className="btn-act" onClick={() => setTab(1)}>Lihat Klaim</button> : null}
                        <RecActions mod="pol" row={p as RecRow} toast={toast} onEdit={(row) => { setMEdit(row); setMOpen(true); }}
                          onDeleted={(id) => patchTen({ asr: { ...t.asr, pol: t.asr.pol.filter((x) => idOf("pol", x) !== id) as typeof t.asr.pol } })} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note mt16"><b>Aliran data:</b> registrasi aset (4.6) dan tenaga kerja (4.3) menawarkan penautan polis otomatis; tanggal akhir polis menjadi aturan JAGA (H-90 → H-14); premi jatuh tempo tampil pada satu kalender kepatuhan bersama pajak (4.11).</p>
        </div>
      )}

      {tab === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(300px,1fr)", gap: 16, alignItems: "stretch" }}>
          <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
            {klaim.filter((k) => k.tl).map((k, i) => (
              <Panel key={i} title={<>{k.t} <Chip c={k.cls}>{k.lbl}</Chip></>}>
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>{k.obj} · {k.nilai}</p>
                <Timeline items={k.tl!} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button className="btn btn-line btn-sm" onClick={() => void bundelDokumen(k.t, k.obj)}>Bundel Dokumen</button>
                  <button className="btn btn-gold btn-sm" onClick={() => { pushQueue(k.t, `Dampingi advokat · objek ${k.obj} · dokumen & kronologi terlampir`, "c-gold", "ESKALASI"); go("lawyer"); }}><Scale size={12} /> Dampingi Advokat</button>
                </div>
              </Panel>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Panel title="Ajukan Klaim Baru" style={{ flex: 1 }}>
              <Field label="Objek & polis (dari rekam)">
                <select value={nkObj} onChange={(e) => setNkObj(e.target.value)}>
                  {pol.map((p, i) => <option key={i}>{p[3]} — {p[0]}</option>)}
                </select>
              </Field>
              <Field label="Kronologi kejadian">
                <textarea rows={3} value={nkDesc} placeholder="Uraikan insiden — tanggal, lokasi, taksiran kerugian…" onChange={(e) => setNkDesc(e.target.value)} />
              </Field>
              <button className="btn btn-navy" disabled={kirimKlaim} aria-busy={kirimKlaim} onClick={() => void newKlaim()}>{kirimKlaim ? "AI menyusun berkas…" : "Ajukan Klaim (AI Menyusun Berkas)"}</button>
              <p className="note mt16"><b>Otomatis dari rekam:</b> polis, bukti kepemilikan aset / perjanjian kerja, dan dokumen pendukung ditarik dari vault — Anda tidak mengunggah ulang.</p>
            </Panel>
          </div>
        </div>
      )}
      {tab === 1 && klaim.some((k) => !k.tl) && (
        /* S6: riwayat klaim selesai — satu panel FULL-WIDTH (tak menyisakan area kosong kanan) */
        <Panel title="Riwayat Klaim Selesai" className="mt16">
          <div className="rows">
            {klaim.filter((k) => !k.tl).map((k, i) => <Row key={i} b={k.t} d={`${k.obj} · ${k.nilai}`} right={<Chip c={k.cls}>{k.lbl}</Chip>} />)}
          </div>
        </Panel>
      )}

      {/* Revisi owner (5y-#5): tab Integrasi Aset & Karyawan dihapus. */}

      <RecordModal mod="pol" open={mOpen} editRow={mEdit} tenantName={t.name} toast={toast} onClose={() => setMOpen(false)} onDone={onDone} prefill={pfill} prefillFile={pfile} />
      {xlsx.modal}
    </ModuleShell>
  );
}
