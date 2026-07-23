"use client";
/* Kepatuhan Pajak — NOL DUMMY. Kalender kewajiban = rekam nyata (module_records mod 'tax');
 * Profil Pajak & Integrasi Lintas Modul dihitung dari rekam hidup (employees, lic, assets, agr). */
import React, { useEffect, useMemo, useState } from "react";
import { Plus, Scale } from "lucide-react";
import { fmt, useStore, ViewId } from "@/lib/store";
import { api } from "@/lib/api";
import { aiExtract } from "@/lib/extract";
import { useExcelImport } from "@/components/ExcelImport";
import { askConfirm, Chip, Field, Kpi, Modal, Panel, Row } from "@/components/ui";
import { ModuleShell } from "@/components/ModuleShell";

const SUBJUDUL = ["Kalender Kewajiban", "Profil Pajak"];
type Tax = { id?: string; nama: string; jenis: string; tenggat: string; status: "TERBUKA" | "DIPENUHI" };
const JENIS = ["PPN Masa", "PPh 21", "PPh 25 Angsuran", "PPh Badan Tahunan", "PBB", "PPh Final UMKM", "Lainnya"];
const TAX_AI = [
  { k: "nama", l: "Nama kewajiban pajak (mis. SPT Masa PPN Juli 2026)" },
  { k: "jenis", l: "Jenis pajak", opts: JENIS },
  { k: "tenggat", l: "Tanggal tenggat / jatuh tempo (format YYYY-MM-DD)" },
];

export default function Pajak() {
  const { ten, go, toast, pushQueue, activeTab: tab, setActiveTab: setTab } = useStore();
  const t = ten!;
  const [rows, setRows] = useState<Tax[]>([]);
  const [q, setQ] = useState("");
  const [f, setF] = useState("semua");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Tax>({ nama: "", jenis: JENIS[0], tenggat: "", status: "TERBUKA" });
  const [pfile, setPfile] = useState<File | null>(null); // dokumen sumber (dropzone) → ikut tersimpan saat Simpan
  const tid = () => localStorage.getItem("corplex_tid") || "";
  const bukaManual = () => { setPfile(null); setForm({ nama: "", jenis: JENIS[0], tenggat: "", status: "TERBUKA" }); setOpen(true); };
  const xlsx = useExcelImport("tax");

  useEffect(() => {
    void api.records.list(tid()).then((r) => {
      if (r.ok) setRows(r.data.filter((x) => x.module === "tax").map((x) => ({ ...(x.data as Tax), id: x.id })));
    });
  }, []);

  const simpan = async () => {
    if (!form.nama.trim()) { toast("Nama kewajiban wajib diisi", "Lengkapi nama kewajiban pajak.", "warn"); return; }
    let dok: { url: string; nama: string } | undefined;
    if (pfile) { const up = await api.records.uploadDoc(tid(), pfile); if (!up.ok) return toast("Gagal mengunggah", up.error.message, "warn"); dok = up.data; }
    const r = await api.records.create(tid(), "tax", form, pfile ? "ai" : "manual", dok);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    setRows((xs) => [{ ...form, id: r.data.id }, ...xs]);
    setOpen(false); setPfile(null); setForm({ nama: "", jenis: JENIS[0], tenggat: "", status: "TERBUKA" });
  };

  /* Dropzone: gambar/PDF → ekstraksi AI NYATA → modal terisi utk dikonfirmasi (dokumen ikut disimpan). */
  const dropDok = async (file: File) => {
    toast("AI membaca dokumen…", "Ekstraksi jenis & tenggat pajak — Anda konfirmasi sebelum tersimpan.");
    const vals = await aiExtract(file, TAX_AI);
    const v = vals || {};
    setForm({
      nama: v.nama || file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(),
      jenis: JENIS.includes(v.jenis) ? v.jenis : JENIS[0],
      tenggat: /^\d{4}-\d{2}-\d{2}$/.test(v.tenggat || "") ? v.tenggat : "",
      status: "TERBUKA",
    });
    setPfile(file); setOpen(true);
  };

  const penuhi = async (x: Tax) => {
    if (!x.id) return;
    const next = { ...x, status: "DIPENUHI" as const };
    const r = await api.records.update(x.id, { nama: next.nama, jenis: next.jenis, tenggat: next.tenggat, status: next.status });
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setRows((xs) => xs.map((y) => (y.id === x.id ? next : y)));
  };

  const hapus = async (x: Tax) => {
    if (!x.id || !(await askConfirm(`Hapus kewajiban "${x.nama}"?`))) return;
    const r = await api.records.remove(x.id);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setRows((xs) => xs.filter((y) => y.id !== x.id));
  };

  const terbuka = rows.filter((x) => x.status === "TERBUKA");
  const dipenuhi = rows.length - terbuka.length;
  const skor = rows.length ? Math.round((dipenuhi / rows.length) * 100) : 0;

  /* Relasi lintas modul — dasar pengenaan ditarik dari rekam hidup, bukan input manual. */
  const integ = useMemo(() => {
    const npwpKaryawan = t.emp.filter((e) => e.npwp).length;
    const upahTotal = t.emp.reduce((s, e) => s + (e.upah || 0), 0);
    return [
      { b: "PPh 21 ↔ modul Employment", d: `${t.emp.length} tenaga kerja tercatat · ${npwpKaryawan} ber-NPWP · dasar upah bulanan ${fmt(upahTotal)}`, v: "hr-database" as ViewId, ok: npwpKaryawan === t.emp.length && t.emp.length > 0, lbl: `${npwpKaryawan}/${t.emp.length} NPWP` },
      { b: "PBB & pajak aset ↔ modul Aset", d: `${t.assets.length} aset dalam rekam — dasar pengenaan PBB/pajak kendaraan`, v: "asset" as ViewId, ok: t.assets.length > 0, lbl: `${t.assets.length} ASET` },
      { b: "PPN ↔ modul Perjanjian", d: `${t.agr.length} perjanjian tercatat — nilai kontraktual jadi dasar DPP PPN keluaran`, v: "agreement" as ViewId, ok: t.agr.length > 0, lbl: `${t.agr.length} PERJANJIAN` },
      { b: "LKPM ↔ modul Perizinan", d: `${t.lic.length} izin dipantau — angka LKPM direkonsiliasi dengan omzet`, v: "licensing" as ViewId, ok: t.lic.length > 0, lbl: `${t.lic.length} IZIN` },
    ];
  }, [t]);

  const list = rows.filter((x) => (f === "semua" || x.status === f) && (x.nama + x.jenis).toLowerCase().includes(q.toLowerCase()));

  return (
    <ModuleShell h1={SUBJUDUL[tab] || "Kepatuhan Pajak"}
      sub="Telat lapor/setor = denda + bunga sanksi — tenggat pajak perusahaan diingatkan otomatis."
      acts={<button className="btn btn-gold" onClick={bukaManual}><Plus size={14} /> Tambah Kewajiban</button>}
      dropNote="SPT, bukti potong, atau tagihan pajak — AI mengekstrak jenis & tenggat; berkas asli tersimpan di vault."
      onDrop={(file) => { if (!xlsx.tryFile(file)) void dropDok(file); }}
      filters={tab === 0 ? ["semua", "TERBUKA", "DIPENUHI"] : undefined} active={f} onFilter={setF}
      q={tab === 0 ? q : undefined} setQ={tab === 0 ? setQ : undefined} cariPh="Cari kewajiban / jenis pajak…"
      kpi={<div className="grid g4 mb16">
        <Kpi v={`${skor}%`} label="Skor kepatuhan pajak" tr={rows.length ? `${dipenuhi}/${rows.length} dipenuhi` : "belum ada kewajiban"} trCls="up" />
        <Kpi v={terbuka.length} label="Kewajiban terbuka" tr="Masa + tahunan" trCls="dn" />
        <Kpi v={dipenuhi} label="Dipenuhi (bukti di vault)" trCls="up" />
        <Kpi v={t.emp.length} label="Dasar PPh 21 — tenaga kerja" tr="Relasi modul Employment" />
      </div>}>

      {tab === 0 && (
        <Panel title="Kalender Pemenuhan — Lapor & Setor">
          <div className="rows">
            {list.map((x) => (
              <Row key={x.id} b={x.nama} d={`${x.jenis}${x.tenggat ? ` · tenggat ${x.tenggat}` : ""}`} right={<>
                <Chip c={x.status === "DIPENUHI" ? "c-ver" : "c-draft"}>{x.status}</Chip>
                {x.status === "TERBUKA" && <button className="btn btn-line btn-sm" onClick={() => void penuhi(x)}>Lapor + Bukti</button>}
                <button className="btn btn-red btn-sm" onClick={() => void hapus(x)}>Hapus</button>
              </>} />
            ))}
            {!list.length && <Row b="Belum ada kewajiban pajak tercatat" d="Tambah manual atau seret dokumen SPT ke dropzone di atas." right={<Chip c="c-mon">KOSONG</Chip>} />}
          </div>
        </Panel>
      )}

      {tab === 1 && (
        <div className="grid g2">
          <Panel title="Identitas Perpajakan">
            <div className="rows">
              <Row b="Nama Wajib Pajak" d={t.name} right={<Chip c="c-ver">TERDAFTAR</Chip>} />
              <Row b="Bidang usaha" d={t.sector} right={<Chip c="c-mon">PROFIL</Chip>} />
              <Row b="NPWP karyawan terdata" d={`${t.emp.filter((e) => e.npwp).length} dari ${t.emp.length} tenaga kerja — dasar pemotongan PPh 21`}
                right={<Chip c={t.emp.length && t.emp.every((e) => e.npwp) ? "c-ver" : "c-draft"}>{t.emp.filter((e) => e.npwp).length}/{t.emp.length}</Chip>} onClick={() => go("hr-database")} />
              <Row b="Total upah bulanan (dasar PPh 21)" d="Dijumlah dari gaji pokok + tunjangan tetap rekam karyawan"
                right={<Chip c="c-gold">{fmt(t.emp.reduce((s, e) => s + (e.upah || 0), 0))}</Chip>} />
            </div>
          </Panel>
          <Panel title="Rekap Pemenuhan">
            <div className="rows">
              <Row b="Kewajiban tercatat" d="Seluruh kewajiban pada rekam tenant" right={<Chip c="c-mon">{rows.length}</Chip>} />
              <Row b="Dipenuhi" d="Bukti lapor/setor tersimpan" right={<Chip c="c-ver">{dipenuhi}</Chip>} />
              <Row b="Terbuka" d="Belum dilaporkan / disetor" right={<Chip c={terbuka.length ? "c-draft" : "c-ver"}>{terbuka.length}</Chip>} />
            </div>
            <p className="note mt16">Skor {skor}% dihitung dari rasio kewajiban dipenuhi — bukan angka tetap. Menjadi komponen skor kesehatan hukum pada Ringkasan.</p>
          </Panel>
        </div>
      )}

      {/* Revisi owner (5y-#6): tab Integrasi Lintas Modul dihapus. */}

      <Modal open={open} title="Tambah Kewajiban Pajak" onClose={() => setOpen(false)}
        footer={<><button className="btn btn-line" onClick={() => setOpen(false)}>Batal</button><button className="btn btn-gold" onClick={() => void simpan()}>Simpan</button></>}>
        <Field label="Nama kewajiban *"><input value={form.nama} placeholder="mis. PPN Masa Juli 2026" onChange={(e) => setForm({ ...form, nama: e.target.value })} /></Field>
        <Field label="Jenis pajak"><select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>{JENIS.map((j) => <option key={j}>{j}</option>)}</select></Field>
        <Field label="Tenggat"><input type="date" value={form.tenggat} onChange={(e) => setForm({ ...form, tenggat: e.target.value })} /></Field>
      </Modal>
      {xlsx.modal}
    </ModuleShell>
  );
}
