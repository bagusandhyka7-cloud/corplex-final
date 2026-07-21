"use client";
/* Perkara — DB murni (module_records mod 'case'). S5: list ala tabel memanjang
 * (Judul · Tanggal · tahapan/bukti/biaya · Buka di ujung kanan). Detail + CRUD tahapan,
 * bukti, dan biaya pindah ke /rekam/case/[id] (terbuka hanya lewat tombol Buka). */
import React, { useMemo, useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { Case } from "@/lib/data";
import { useStore } from "@/lib/store";
import { askConfirm, Chip, Field, Kpi, Modal, Panel } from "@/components/ui";
import { ModuleShell } from "@/components/ModuleShell";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

const tglID = () => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
const tid = () => localStorage.getItem("corplex_tid") || "";
const JENIS = ["Perdata", "Pidana", "PHI", "Kepailitan & PKPU", "Arbitrase", "PTUN", "Pertanahan", "Persaingan Usaha", "Sengketa Pajak"];
/* tab tersimpan "Jenis — Judul" — pisahkan untuk tampilan list tanpa mengulang kategori */
const jenisOf = (c: Case) => (c.tab || "").split("—")[0].trim();
const judulOf = (c: Case) => (c.head || c.tab || "").replace(/^Perkara:\s*/i, "").split("—").slice(1).join("—").trim() || c.tab;

export default function CaseView() {
  const { ten, toast, patchTen } = useStore();
  const t = ten!;
  const router = useRouter();
  const cases = t.cases;

  const [addOpen, setAddOpen] = useState(false);
  const [judul, setJudul] = useState("");
  const [jenis, setJenis] = useState("Perdata");
  const [tahap, setTahap] = useState("");
  const [f, setF] = useState("semua");
  const [q, setQ] = useState("");

  const jenisAda = useMemo(() => ["semua", ...Array.from(new Set(cases.map(jenisOf).filter(Boolean)))], [cases]);
  const rows = cases.filter((c) => (f === "semua" || jenisOf(c) === f) && (c.tab + " " + c.head).toLowerCase().includes(q.toLowerCase()));

  const tambahPerkara = async () => {
    if (!judul.trim()) return toast("Judul wajib diisi", "Tulis nama perkara.", "warn");
    const rec: Omit<Case, "id"> = {
      tab: `${jenis} — ${judul.trim().slice(0, 24)}`, head: `Perkara: ${jenis} — ${judul.trim()}`,
      tl: [[tglID(), tahap.trim() || "Perkara dibuka", "Dicatat dari modul Perkara", "next"]],
      bukti: [], biaya: [], aksi: [],
    };
    const r = await api.records.create(tid(), "case", rec);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    patchTen({ cases: [{ ...rec, id: r.data.id }, ...cases] });
    setAddOpen(false); setJudul(""); setTahap("");
    toast("Perkara tercatat", "Klik Buka pada baris untuk mengelola tahapan, bukti, dan biaya.", "ok");
  };

  const hapusPerkara = async (c: Case) => {
    if (!c.id || !(await askConfirm(`Hapus perkara "${c.tab}"?`))) return;
    const r = await api.records.remove(c.id);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    patchTen({ cases: cases.filter((x) => x.id !== c.id) });
  };

  const totalBukti = cases.reduce((s, x) => s + x.bukti.length, 0);

  return (
    <ModuleShell h1="Perkara"
      sub="Perkara tanpa rekam berpotensi jadi temuan BERMASALAH saat uji tuntas. Catat tahapan, bukti, dan biayanya di sini."
      filters={jenisAda} active={f} onFilter={setF} q={q} setQ={setQ} cariPh="Cari perkara…"
      acts={<button className="btn btn-gold" onClick={() => setAddOpen(true)}><Plus size={14} /> Buka Perkara</button>}
      kpi={<div className="grid g4 mb16">
        <Kpi v={cases.length} label="Perkara aktif" />
        <Kpi v={totalBukti} label="Bukti terindeks" tr={totalBukti ? "Tersimpan di vault" : "—"} />
        <Kpi v={cases.filter((x) => x.tl.some((s) => /somasi/i.test(s[1]))).length} label="Pra-litigasi (somasi)" />
        <Kpi v={cases.reduce((s, x) => s + x.biaya.length, 0)} label="Pos biaya tercatat" />
      </div>}>

      {!rows.length ? (
        <Panel title="Belum Ada Perkara">
          <p style={{ fontSize: 12.5, color: "var(--muted)" }}>Rekam perkara kosong{f !== "semua" ? " pada kategori ini" : ""}. Klik <b>Buka Perkara</b> untuk mencatat perkara atau somasi pertama.</p>
        </Panel>
      ) : (
        <div className="tblwrap">
          <table>
            <thead><tr><th>Judul Perkara</th><th>Jenis</th><th>Tahapan Terakhir</th><th>Tanggal</th><th>Tahapan</th><th>Bukti</th><th>Biaya</th><th>Aksi</th></tr></thead>
            <tbody>
              {rows.map((c) => {
                const last = c.tl[c.tl.length - 1] || [];
                return (
                  <tr key={c.id}>
                    <td>{judulOf(c)}</td>
                    <td><Chip c="c-mon">{jenisOf(c).toUpperCase()}</Chip></td>
                    <td>{last[1] || "—"}</td>
                    <td>{last[0] || "—"}</td>
                    <td>{c.tl.length}</td>
                    <td>{c.bukti.length}</td>
                    <td>{c.biaya.length}</td>
                    <td><div>
                      <button className="btn-act" onClick={() => c.id && router.push(`/rekam/case/${c.id}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button>
                      <button className="btn btn-red btn-sm" onClick={() => void hapusPerkara(c)}><Trash2 size={11} /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="note mt16">Jenis perkara didukung: {JENIS.join(" · ")}. Kelola tahapan, bukti, dan biaya lewat tombol <b>Buka</b> pada tiap baris.</p>

      <Modal open={addOpen} title="Buka Perkara Baru" right onClose={() => setAddOpen(false)}
        footer={<><button className="btn btn-line" onClick={() => setAddOpen(false)}>Batal</button>
          <button className="btn btn-gold" onClick={() => void tambahPerkara()}>Simpan</button></>}>
        <Field label="Judul perkara *"><input value={judul} placeholder="mis. Wanprestasi CV X" onChange={(e) => setJudul(e.target.value)} /></Field>
        <Field label="Jenis"><select value={jenis} onChange={(e) => setJenis(e.target.value)}>{JENIS.map((j) => <option key={j}>{j}</option>)}</select></Field>
        <Field label="Tahapan awal"><input value={tahap} placeholder="mis. Somasi I dikirim" onChange={(e) => setTahap(e.target.value)} /></Field>
        <div className="note">Setelah tersimpan, kelola tahapan, unggah bukti, dan catat biaya lewat tombol Buka pada baris perkara.</div>
      </Modal>
    </ModuleShell>
  );
}
