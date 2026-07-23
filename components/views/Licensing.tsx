"use client";
import React, { useEffect, useState } from "react";
import { Lock, Plus } from "lucide-react";
import { clone, useStore } from "@/lib/store";
import { Chip, Jargon, Kpi, Panel, Row } from "@/components/ui";
import { ModuleShell } from "@/components/ModuleShell";
import { RecActions, RecordModal } from "@/components/RecordModal";
import { idOf, RecRow, SPECS, withId } from "@/lib/records";
import { aiExtract } from "@/lib/extract";
import { useExcelImport } from "@/components/ExcelImport";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function Licensing() {
  const { ten, toast, patchTen, rekamVer } = useStore();
  const t = ten!;
  const router = useRouter();
  const [f, setF] = useState("semua");
  const [q, setQ] = useState("");
  const [lic, setLic] = useState(() => clone(t.lic));
  useEffect(() => setLic(clone(t.lic)), [t.lic]); // hidrasi DB menyusul mount
  const [mOpen, setMOpen] = useState(false);
  const [mEdit, setMEdit] = useState<RecRow | null>(null);
  const [pfill, setPfill] = useState<Record<string, string> | undefined>();  // hasil ekstraksi AI (rekam baru)
  const [pfile, setPfile] = useState<File | null>(null);                     // dokumen sumber ikut tersimpan
  const bukaManual = () => { setPfill(undefined); setPfile(null); setMEdit(null); setMOpen(true); };
  const xlsx = useExcelImport("lic"); // .xlsx via dropzone → pratinjau impor massal
  const onDone = (row: RecRow, editId: string | null) =>
    patchTen({ lic: (editId ? t.lic.map((x) => idOf("lic", x) === editId ? row : x) : [row, ...t.lic]) as typeof t.lic });

  /* Dropzone: gambar/PDF → ekstraksi AI NYATA → modal terisi utk dikonfirmasi (dokumen ikut disimpan). */
  const dropDok = async (file: File) => {
    toast("AI membaca dokumen…", "Ekstraksi field izin dari dokumen — Anda konfirmasi sebelum tersimpan.");
    const vals = await aiExtract(file, SPECS.lic.fields);
    setPfill(vals || {}); setPfile(file); setMEdit(null); setMOpen(true);
  };
  type Kwj = { b: string; d: string; chip: string; lbl: string; next: string; can: boolean; done: boolean; id?: string };
  /* NOL DUMMY: daftar ini dulu mengarang tenggat MILIK TENANT — "LKPM Triwulan III 2026 · 48 HARI",
   * "UKL-UPL Semester II", dan otomatisasi "Dipicu event corpsec.pengurus_berubah" yang tidak ada.
   * Klien bisa mengira 48 hari itu tenggat aslinya. Kewajibannya sendiri NYATA menurut peraturan,
   * jadi disajikan sebagai DAFTAR ACUAN tanpa angka tenggat karangan; begitu klien menekan
   * "Lapor + Bukti", barisnya jadi rekam DB miliknya sendiri. */
  const KWJ_DEFAULT: Kwj[] = [
    { b: "LKPM (Laporan Kegiatan Penanaman Modal)", d: "Wajib berkala bagi pemegang NIB — tenggat mengikuti kalender OSS perusahaan Anda", chip: "c-mon", lbl: "ACUAN", next: "", can: true, done: false },
    { b: "Laporan berkala UKL-UPL / Persetujuan Lingkungan", d: "Wajib bila kegiatan usaha memiliki dokumen lingkungan", chip: "c-mon", lbl: "ACUAN", next: "", can: true, done: false },
    { b: "Pembaruan data OSS setelah perubahan pengurus", d: "Dilakukan setiap ada perubahan direksi/komisaris pada akta", chip: "c-mon", lbl: "ACUAN", next: "", can: true, done: false },
  ];
  const [kwj, setKwj] = useState<Kwj[]>(KWJ_DEFAULT);
  /* S6: kalender kewajiban tersambung DB — status pelaporan bertahan lintas sesi (module_records mod 'kwj') */
  useEffect(() => {
    const tid = localStorage.getItem("corplex_tid") || "";
    void api.records.list(tid).then((r) => {
      if (!r.ok) return;
      const rows = r.data.filter((x) => x.module === "kwj").map((x) => ({ ...(x.data as unknown as Kwj), id: x.id }));
      if (rows.length) setKwj(KWJ_DEFAULT.map((d) => rows.find((x) => x.b === d.b) || d)); // merge by judul: yang dilaporkan menimpa default
    });
  }, [rekamVer]); // realtime: rekam berubah di menu lain → segarkan


  /* Dulu hanya mengubah state LOKAL sambil menoast "entri rekam ditulis otomatis" — refresh
   * mengembalikan status semula. Kini benar-benar menulis ke module_records. */
  const startRenewal = async (row: RecRow) => {
    const id = idOf("lic", row);
    if (!id) return toast("Rekam belum tersimpan", "Baris ini belum punya id database.", "warn");
    const data = (row as unknown[]).slice(0, 11);
    data[7] = "PENGURUSAN"; data[8] = "c-mon"; data[9] = "PENGURUSAN"; data[10] = "detail";
    const r = await api.records.update(id, data as RecRow);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    patchTen({ lic: t.lic.map((x) => (idOf("lic", x) === id ? withId("lic", data as RecRow, id) : x)) as typeof t.lic });
    toast("Status diubah — PENGURUSAN", "Tersimpan ke rekam; bertahan lintas sesi dan terlihat di seluruh layar.", "ok");
  };

  const laporKwj = async (i: number) => {
    const tid = localStorage.getItem("corplex_tid") || "";
    const cur = kwj[i];
    /* Jangan klaim "bukti tersimpan ke vault" — laporKwj tidak mengunggah berkas apa pun.
     * `cur.next` kini kosong (tenggat karangan sudah dibuang), jadi tak lagi ditempel. */
    const next = { ...cur, done: true, chip: "c-ver", lbl: "DILAPORKAN", d: `Ditandai dilaporkan pada ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`, can: false };
    /* persist: baris DB per kewajiban (buat saat pertama dilaporkan; simpan SEMUA item agar hidrasi utuh) */
    const { id: _x, ...data } = next;
    const r = cur.id ? await api.records.update(cur.id, data as never) : await api.records.create(tid, "kwj", data as never);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    setKwj((ks) => ks.map((k, j) => (j === i ? { ...next, id: cur.id || (r.data as { id?: string }).id } : k)));
    toast("Kewajiban dilaporkan", "Status tersimpan ke rekam — bertahan lintas sesi.", "ok");
  };

  const rows = lic.filter((r) => (f === "semua" || r[7] === f) && (r[0] + " " + r[1] + " " + r[2]).toString().toLowerCase().includes(q.toLowerCase()));

  return (
    <ModuleShell h1="Perizinan" sub="Izin lewat tenggat = risiko sanksi + status BERISIKO pada Laporan LDD — masa berlaku diingatkan otomatis."
      acts={<button className="btn btn-gold" onClick={bukaManual}><Plus size={14} /> Daftarkan Izin</button>}
      dropNote="PDF · Word · pindaian (OCR) — AI mengekstrak nomor izin, jenis, KBLI, dan masa berlaku; dokumen asli tersimpan di vault. Atau letakkan file Excel (template di Alat Legal) untuk impor massal."
      onDrop={(f2) => { if (!xlsx.tryFile(f2)) void dropDok(f2); }}
      filters={["semua", "AKTIF", "SEGERA", "PENGURUSAN"]} active={f} onFilter={setF}
      q={q} setQ={setQ} cariPh="Cari izin / entitas / KBLI…"
      kpi={<div className="grid g4 mb16">
        <Kpi v={lic.length} label="Izin dalam rekam" tr="NIB & izin sektoral tercatat" />
        <Kpi v={lic.filter((r) => r[7] === "SEGERA").length} label="Mendekati tenggat" tr="Reminder bertahap aktif" trCls="dn" />
        <Kpi v={lic.filter((r) => r[7] === "PENGURUSAN").length} label="Dalam pengurusan" tr="Ditandai manual" />
        <Kpi v={kwj.length} label="Kewajiban pasca-izin" tr={<><Jargon k="LKPM" /> & laporan berkala</>} />
      </div>}>

      <div className="tblwrap">
        <table>
          <thead><tr><th>Perizinan</th><th>Entitas / Lokasi</th><th>KBLI</th><th>Masa Berlaku</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><b>{r[0]}</b><span className="sub">{r[1]}</span></td>
                <td>{r[2]}</td>
                <td>{r[3]}</td>
                <td>{r[4] ? <div className="bar"><i className={String(r[4])} style={{ width: `${r[5]}%` }} /></div> : null}<span className="sub">{String(r[6] || "").replace(/(\d+) berkas tertaut:.*$/, "$1 dokumen tertaut")}</span></td>
                <td><Chip c={String(r[8])}>{r[9]}</Chip></td>
                <td>
                  <div className="flex items-center gap-2">
                    {/* S6: urutan Perpanjang dulu, baru Buka */}
                    {r[10] === "renew" ? <button className="btn-act" onClick={() => void startRenewal(r as RecRow)}>Perpanjang</button> : null}
                    {idOf("lic", r as RecRow) && <button className="btn-act" onClick={() => router.push(`/rekam/lic/${idOf("lic", r as RecRow)}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button>}
                    <RecActions mod="lic" row={r as RecRow} toast={toast} onEdit={(row) => { setMEdit(row); setMOpen(true); }}
                      onDeleted={(id) => patchTen({ lic: t.lic.filter((x) => idOf("lic", x) !== id) as typeof t.lic })} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid g2 mt16">
        <Panel title="Kewajiban Pasca-Perizinan — Kalender">
          <div className="rows">
            {kwj.map((k, i) => (
              <Row key={i} b={k.b} d={k.d} right={<>
                <Chip c={k.chip}>{k.lbl}</Chip>
                {k.can ? <button className="btn btn-line btn-sm" onClick={() => laporKwj(i)}>Tandai Dilaporkan</button> : null}
              </>} />
            ))}
          </div>
        </Panel>
        {/* NOL DUMMY: dulu timeline BPOM dikarang lengkap dengan tanggal ("1 JUL 2026 Permohonan
            diajukan", "Evaluasi teknis BPOM") padahal nol integrasi OSS/BPOM. Kini daftar nyata. */}
        <Panel title="Izin Dalam Pengurusan">
          <div className="rows">
            {lic.filter((r) => r[7] === "PENGURUSAN").map((r, i) => (
              <Row key={i} b={String(r[0])} d={String(r[6] || "Masa berlaku belum dicatat")} right={<Chip c="c-mon">PENGURUSAN</Chip>} />
            ))}
            {!lic.some((r) => r[7] === "PENGURUSAN") && <p className="note">Tidak ada izin yang sedang diurus. Tandai lewat tombol Perpanjang pada tabel di atas.</p>}
          </div>
          <p className="note mt16">Status diperbarui manual — sinkronisasi otomatis dengan OSS/BPOM belum tersambung, jadi kami tidak menampilkan tahapan yang tidak kami ketahui.</p>
        </Panel>
      </div>

      <RecordModal mod="lic" open={mOpen} editRow={mEdit} tenantName={t.name} toast={toast} onClose={() => setMOpen(false)} onDone={onDone} prefill={pfill} prefillFile={pfile} />
      {xlsx.modal}
    </ModuleShell>
  );
}
