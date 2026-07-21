"use client";
/* Surat Peringatan — karyawan dari DB (ten.emp), rekam SP nyata di module_records (module 'sp').
 * Guard: SP2 butuh SP1 aktif; SP3 memaksa eskalasi advokat. Nol data dummy. */
import React, { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { askConfirm, Chip, Field, Panel, Row, ViewHead } from "@/components/ui";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { idOf, RecRow, withId } from "@/lib/records";

type SPRec = { nama: string; tingkat: string; alasan: string; tgl: string; chip: string; lbl: string; dept?: string; pos?: string };

export default function SuratPeringatan() {
  const { ten, toast, pushQueue } = useStore();
  const emp = ten?.emp ?? [];
  const [nama, setNama] = useState("");
  const [tingkat, setTingkat] = useState("SP1");
  const [alasan, setAlasan] = useState("");
  const [dept, setDept] = useState("");
  const [pos, setPos] = useState("");
  const [list, setList] = useState<(SPRec & { id?: string })[]>([]);
  const [file, setFile] = useState<File | null>(null); // dokumen SP — dipilih dulu, simpan hanya saat "Susun Draft (AI)"
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tid = () => localStorage.getItem("corplex_tid") || "";

  useEffect(() => {
    void api.records.list(tid()).then((r) => {
      if (!r.ok) return;
      setList(r.data.filter((x) => x.module === "sp").map((x) => ({ ...(x.data as SPRec), id: x.id })));
    });
  }, []);
  useEffect(() => { if (!nama && emp[0]) setNama(emp[0].n); }, [emp, nama]);
  /* Departemen & posisi terisi otomatis dari rekam karyawan, tetap bisa dikoreksi. */
  useEffect(() => {
    const e = emp.find((x) => x.n === nama);
    if (e) { setDept(e.dept || ""); setPos(e.j && e.j !== "—" ? e.j : ""); }
  }, [nama, emp]);

  const issueSP = async () => {
    if (!nama) { toast("Pilih karyawan", "Belum ada karyawan di database — tambahkan dulu di Database Karyawan.", "warn"); return; }
    if (!alasan.trim()) { toast("Alasan wajib diisi", "Uraikan pelanggaran sebagai dasar SP.", "warn"); return; }
    const punyaSP1 = list.some((s) => s.nama === nama && s.tingkat === "SP1");
    if (tingkat === "SP2" && !punyaSP1) { toast("Ditolak oleh guard", "SP2 hanya sah bila ada SP1 aktif — karyawan ini tanpa SP1.", "warn"); return; }
    if (tingkat === "SP3") {
      pushQueue(`SP3 — ${nama}`, "Eskalasi wajib: SP3 berujung risiko PHK (berakibat_hukum=true)", "c-gold", "ESKALASI");
      toast("SP3 dieskalasikan", "Guard: penerbitan SP3 selalu melalui verifikasi advokat MRWP.", "warn");
      return;
    }
    setSaving(true);
    try {
      /* Simpan HANYA di sini: unggah dokumen ke Storage lalu tulis rekam + dok dalam satu aksi. */
      let dok: { url: string; nama: string } | undefined;
      if (file) {
        const up = await api.records.uploadDoc(tid(), file);
        if (!up.ok) { toast("Dokumen gagal diunggah", up.error.message, "warn"); return; }
        dok = up.data;
      }
      const rec: SPRec = { nama, tingkat, alasan: alasan.trim(), tgl: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }), chip: "c-draft", lbl: "DRAF AI", dept: dept.trim(), pos: pos.trim() };
      const r = await api.records.create(tid(), "sp", rec, file ? "manual" : "ai", dok);
      if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
      setList((xs) => [{ ...rec, id: r.data.id }, ...xs]);
      setAlasan(""); setFile(null);
      toast(`Draf ${tingkat} disusun`, `Tersimpan ke rekam${dok ? ` · dokumen ${dok.nama} di vault` : ""} · masa berlaku 6 bulan.`, "ok");
    } finally { setSaving(false); }
  };

  const hapus = async (s: SPRec & { id?: string }) => {
    if (!s.id || !(await askConfirm(`Hapus ${s.tingkat} — ${s.nama}?`))) return;
    const r = await api.records.remove(s.id);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setList((xs) => xs.filter((x) => x.id !== s.id));
  };

  return (
    <div>
      <ViewHead h1="Surat Peringatan" sub="SP tanpa rekam = PHK cacat prosedur — jenjang SP1 – SP3 tercatat sah di sini." />
      <div className="grid g2">
        <Panel title="Terbitkan Surat Peringatan — Alur Berjenjang SP1 → SP2 → SP3">
          <Field label="Karyawan">
            <select value={nama} onChange={(e) => setNama(e.target.value)}>
              {emp.map((e) => <option key={e.id || e.n}>{e.n}</option>)}
              {!emp.length && <option value="">— belum ada karyawan di database —</option>}
            </select>
          </Field>
          {/* Terisi otomatis dari rekam karyawan (readOnly) — sumber: tabel employees */}
          <div className="grid g2" style={{ gap: 10 }}>
            <Field label="Departemen"><input readOnly tabIndex={-1} value={dept || "— belum diisi di rekam"} style={{ color: dept ? undefined : "var(--muted)", cursor: "default" }} /></Field>
            <Field label="Posisi"><input readOnly tabIndex={-1} value={pos || "— belum diisi di rekam"} style={{ color: pos ? undefined : "var(--muted)", cursor: "default" }} /></Field>
          </div>
          <Field label="Tingkat"><select value={tingkat} onChange={(e) => setTingkat(e.target.value)}><option>SP1</option><option>SP2</option><option>SP3</option></select></Field>
          <Field label="Alasan"><input value={alasan} placeholder="Uraian pelanggaran…" onChange={(e) => setAlasan(e.target.value)} /></Field>
          {/* Alur: Unggah Dokumen dulu → tombol berubah "Susun Draft (AI)" → simpan DB hanya saat klik itu */}
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ""; }} />
          {!file ? (
            <button className="btn btn-navy" onClick={() => fileRef.current?.click()}><Upload size={13} /> Unggah Dokumen</button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-gold" disabled={saving} aria-busy={saving} onClick={() => void issueSP()}>{saving ? "Menyimpan…" : "Susun Draft (AI)"}</button>
              <span className="sub" style={{ fontSize: 10.5 }}>{file.name} · <a style={{ cursor: "pointer", color: "var(--blue-400)" }} onClick={() => setFile(null)}>ganti/batal</a></span>
            </div>
          )}
          <p className="note mt16"><b>Guard:</b> SP2 hanya sah bila ada SP1 aktif; <b>SP3 selalu memaksa eskalasi advokat</b> karena berujung risiko PHK.</p>
        </Panel>
        <Panel title="SP Aktif">
          <div className="rows">
            {list.map((s) => (
              <Row key={s.id} b={`${s.tingkat} — ${s.nama}`} d={`${[s.dept, s.pos].filter(Boolean).join(" · ") || "—"} · ${s.alasan} · ${s.tgl} · berlaku 6 bulan`}
                right={<><Chip c={s.chip}>{s.lbl}</Chip><button className="btn btn-red btn-sm" onClick={() => void hapus(s)}>Hapus</button></>} />
            ))}
            {!list.length && <span style={{ fontSize: 12, color: "var(--muted)", padding: 8 }}>Belum ada SP tercatat — rekam bersih.</span>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
