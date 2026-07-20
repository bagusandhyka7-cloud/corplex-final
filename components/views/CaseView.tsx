"use client";
/* Perkara — DB murni (module_records mod 'case', jsonb: head/tab/tl/bukti/biaya).
 * CRUD nyata: tambah perkara, catat tahapan, bukti via dropzone (upload Storage),
 * biaya per tahap, hapus. Buka = split-panel /rekam/case/[id]. Nol seed. */
import React, { useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { Case } from "@/lib/data";
import { useStore } from "@/lib/store";
import { askConfirm, Chip, Field, Kpi, Modal, Panel, Row, Timeline } from "@/components/ui";
import { ModuleShell } from "@/components/ModuleShell";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

const tglID = () => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
const tid = () => localStorage.getItem("corplex_tid") || "";

export default function CaseView() {
  const { ten, toast, patchTen, pushQueue } = useStore();
  const t = ten!;
  const router = useRouter();
  const cases = t.cases;
  const [cur, setCur] = useState(0);
  const c = cases[cur];

  /* form tambah perkara */
  const [addOpen, setAddOpen] = useState(false);
  const [judul, setJudul] = useState("");
  const [jenis, setJenis] = useState("Perdata");
  const [tahap, setTahap] = useState("");
  /* input tahapan/biaya inline */
  const [tlBaru, setTlBaru] = useState("");
  const [biayaL, setBiayaL] = useState("");
  const [biayaN, setBiayaN] = useState("");

  const simpanTen = (list: Case[]) => patchTen({ cases: list });

  const tambahPerkara = async () => {
    if (!judul.trim()) return toast("Judul wajib diisi", "Tulis nama perkara.", "warn");
    const rec: Omit<Case, "id"> = {
      tab: `${jenis} — ${judul.trim().slice(0, 24)}`, head: `Perkara: ${jenis} — ${judul.trim()}`,
      tl: [[tglID(), tahap.trim() || "Perkara dibuka", "Dicatat dari modul Perkara", "next"]],
      bukti: [], biaya: [], aksi: [],
    };
    const r = await api.records.create(tid(), "case", rec);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    simpanTen([{ ...rec, id: r.data.id }, ...cases]);
    setCur(0); setAddOpen(false); setJudul(""); setTahap("");
    toast("Perkara tercatat", "Tersimpan ke rekam tenant — timeline siap diisi.", "ok");
  };

  const updateCase = async (idx: number, patch: Partial<Case>) => {
    const x = { ...cases[idx], ...patch };
    if (!x.id) return;
    const { id, dokUrl, dokNama, ...data } = x;
    const r = await api.records.update(id, data);
    if (!r.ok) return toast("Gagal memperbarui", r.error.message, "warn");
    simpanTen(cases.map((y, i) => (i === idx ? x : y)));
  };

  const catatTahap = async () => {
    if (!tlBaru.trim() || !c) return;
    await updateCase(cur, { tl: [...c.tl.map((s) => [s[0], s[1], s[2], "done"]), [tglID(), tlBaru.trim(), "Dicatat manual", "next"]] });
    setTlBaru("");
    toast("Tahapan tercatat", "Timeline perkara diperbarui.", "ok");
  };

  const tambahBiaya = async () => {
    if (!biayaL.trim() || !biayaN.trim() || !c) return;
    await updateCase(cur, { biaya: [...c.biaya, [biayaL.trim(), biayaN.trim()]] });
    setBiayaL(""); setBiayaN("");
  };

  const hapusPerkara = async () => {
    if (!c?.id || !(await askConfirm(`Hapus perkara "${c.tab}"?`))) return;
    const r = await api.records.remove(c.id);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    simpanTen(cases.filter((_, i) => i !== cur));
    setCur(0);
  };

  /* bukti via dropzone: upload Storage + append daftar bukti + dokumen terakhir jadi dok rekam */
  const dropDok = async (file: File) => {
    if (!c?.id) return toast("Belum ada perkara", "Buat perkara dulu — bukti menempel pada perkara terpilih.", "warn");
    const up = await api.records.uploadDoc(tid(), file);
    if (!up.ok) return toast("Gagal mengunggah", up.error.message, "warn");
    const nama = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    const bukti = [...c.bukti, [nama, `Diunggah ${tglID()} · tersimpan di vault`, "SAH"]];
    const { id, dokUrl, dokNama, ...data } = { ...c, bukti };
    const r = await api.records.update(c.id, data, up.data);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    simpanTen(cases.map((y, i) => (i === cur ? { ...c, bukti, dokUrl: up.data.url, dokNama: up.data.nama } : y)));
    toast("Bukti terindeks", `${nama} — tersimpan pada rekam perkara.`, "ok");
  };

  const totalBukti = cases.reduce((s, x) => s + x.bukti.length, 0);

  return (
    <ModuleShell h1="Perkara"
      sub="Pantau perkara berjalan — tahapan, dokumen bukti, dan biayanya."
      dropNote="Bukti perkara (putusan, risalah, korespondensi) — menempel pada perkara terpilih, dokumen asli tersimpan di vault."
      onDrop={(f) => void dropDok(f)}
      acts={<button className="btn btn-gold" onClick={() => setAddOpen(true)}><Plus size={14} /> Buka Perkara</button>}>

      <div className="grid g4 mb16">
        <Kpi v={cases.length} label="Perkara aktif" />
        <Kpi v={totalBukti} label="Bukti terindeks" tr={totalBukti ? "Tersimpan di vault" : "—"} />
        <Kpi v={cases.filter((x) => x.tl.some((s) => /somasi/i.test(s[1]))).length} label="Pra-litigasi (somasi)" />
        <Kpi v={cases.reduce((s, x) => s + x.biaya.length, 0)} label="Pos biaya tercatat" />
      </div>

      {!cases.length ? (
        <Panel title="Belum Ada Perkara">
          <p style={{ fontSize: 12.5, color: "var(--muted)" }}>Rekam perkara kosong — klik <b>Buka Perkara</b> untuk mencatat perkara/somasi pertama. Nol data contoh.</p>
        </Panel>
      ) : (
        <>
          <div className="filters">
            {cases.map((x, i) => (
              <button key={x.id || i} className={`fchip${i === cur ? " on" : ""}`} onClick={() => setCur(i)}>{x.tab || `Perkara ${i + 1}`}</button>
            ))}
          </div>

          <div className="grid g-wide">
            <Panel title={<>{c.head}
              <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
                {c.id && <button className="btn-act" onClick={() => router.push(`/rekam/case/${c.id}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button>}
                <button className="btn btn-red btn-sm" onClick={() => void hapusPerkara()}><Trash2 size={11} /></button>
              </span></>}>
              <div className="grid g2" style={{ gap: 14 }}>
                <div>
                  <Timeline items={c.tl} />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <input className="finput" style={{ flex: 1 }} placeholder="Catat tahapan baru…" value={tlBaru} onChange={(e) => setTlBaru(e.target.value)} />
                    <button className="btn btn-navy btn-sm" onClick={() => void catatTahap()}>Catat</button>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontFamily: "var(--serif)", fontSize: 14, marginBottom: 10 }}>Bukti Terindeks</h4>
                  <div className="rows">
                    {c.bukti.map((b, i) => <Row key={i} b={b[0]} d={b[1]} right={<Chip c={b[2] === "SAH" ? "c-ver" : "c-mon"}>{b[2]}</Chip>} />)}
                    {!c.bukti.length && <Row b="Belum ada bukti" d="Seret berkas ke dropzone di atas — bukti menempel ke perkara ini." right={<Chip c="c-mon">KOSONG</Chip>} />}
                  </div>
                  <h4 style={{ fontFamily: "var(--serif)", fontSize: 14, margin: "16px 0 10px" }}>Biaya per Tahap</h4>
                  <div className="rows">
                    {c.biaya.map((b, i) => <Row key={i} b={b[0]} right={<b style={{ color: "var(--ink)" }}>{b[1]}</b>} />)}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input className="finput" style={{ flex: 1 }} placeholder="Pos biaya…" value={biayaL} onChange={(e) => setBiayaL(e.target.value)} />
                    <input className="finput" style={{ width: 110 }} placeholder="Rp…" value={biayaN} onChange={(e) => setBiayaN(e.target.value)} />
                    <button className="btn btn-line btn-sm" onClick={() => void tambahBiaya()}>+</button>
                  </div>
                </div>
              </div>
            </Panel>
            <div style={{ display: "grid", gap: 16, alignContent: "start", marginLeft: 10 }}>
              <Panel title="Eskalasi Advokat">
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Naikkan perkara ini ke advokat MRWP — seluruh timeline & bukti tertaut otomatis.</p>
                <button className="btn btn-gold btn-sm" onClick={() => { pushQueue(`Perkara — ${c.tab}`, `Eskalasi dari modul Perkara · ${c.bukti.length} bukti · ${c.tl.length} tahapan`, "c-gold", "ESKALASI"); }}>⚖ Eskalasi ke Advokat</button>
              </Panel>
              <Panel className="dark" title="Jenis Perkara Didukung">
                <p style={{ fontSize: 12, lineHeight: 1.8 }}>Perdata · Pidana · PHI · Kepailitan &amp; PKPU · Arbitrase · PTUN · Pertanahan · Persaingan Usaha · Sengketa Pajak</p>
              </Panel>
            </div>
          </div>
        </>
      )}

      <Modal right open={addOpen} title="Buka Perkara" onClose={() => setAddOpen(false)}
        footer={<><button className="btn btn-line" onClick={() => setAddOpen(false)}>Batal</button>
          <button className="btn btn-gold" onClick={() => void tambahPerkara()}>Simpan ke Rekam</button></>}>
        <Field label="Judul perkara *"><input value={judul} placeholder="mis. Wanprestasi CV X" onChange={(e) => setJudul(e.target.value)} /></Field>
        <Field label="Jenis"><select value={jenis} onChange={(e) => setJenis(e.target.value)}>{["Perdata", "Pidana", "PHI", "HKI", "Kepailitan & PKPU", "Arbitrase", "PTUN", "Pajak"].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Tahapan awal"><input value={tahap} placeholder="mis. Somasi I dikirim" onChange={(e) => setTahap(e.target.value)} /></Field>
        <div className="note">Timeline, bukti (via dropzone), dan biaya diisi setelah perkara tercatat.</div>
      </Modal>
    </ModuleShell>
  );
}
