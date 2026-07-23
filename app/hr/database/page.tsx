"use client";
import React, { useRef, useState } from "react";
import { FileText, Lock, Scale, UserPlus } from "lucide-react";
import { Emp } from "@/lib/data";
import { fmt, useStore } from "@/lib/store";
import { dokRingkas, downloadDoc, registerVault, vaultHash } from "@/lib/vault";
import { api, empToRow, empFromRow, withRetry } from "@/lib/api";
import { useAsyncAction, useUpload } from "@/lib/hooks";
import { askConfirm, Chip, Field, Jargon, Kpi, Modal, Panel, Row, RpInput, ViewHead } from "@/components/ui";
import { RowActions } from "@/components/RecordModal";
import { aiExtract } from "@/lib/extract";
import { useExcelImport } from "@/components/ExcelImport";
import { useRouter } from "next/navigation";

const hasExpiredSP = (e: Emp) => (e.sp || []).some(s => !!(s.expISO && new Date(s.expISO + "T23:59:59") < new Date()));
const fmtTgl = (s?: string) => s ? new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const tidNow = () => localStorage.getItem("corplex_tid") || "";

/* Field yang diminta ke AI dari dokumen — cocok dengan isian modal Ekstraksi (ex). */
const EX_FIELDS = [
  { k: "nama", l: "Nama lengkap tenaga kerja" },
  { k: "jab", l: "Jabatan sesuai perjanjian kerja" },
  { k: "jk", l: "Jenis kelamin", opts: ["L", "P"] },
  { k: "wn", l: "Klasifikasi: TKI (WNI) atau TKA (WNA)", opts: ["TKI", "TKA"] },
  { k: "lok", l: "Domisili lokal setempat: 1 (ya) atau 0 (tidak)", opts: ["1", "0"] },
  { k: "status", l: "Status hubungan kerja", opts: ["PKWT", "PKWTT"] },
  { k: "masa", l: "Masa kerja / periode kontrak (mis. Sep 2026 – Agu 2028)" },
];
const BLANK = {
  n: "", j: "", jk: "L" as "L" | "P", wn: "TKI" as "TKI" | "TKA", lok: true, s: "PKWT" as "PKWT" | "PKWTT", m: "", prov: "", kota: "", desa: "", foto: null as string | null,
  nik: "", kk: "", npwp: "", bpjsKes: "", bpjsTk: "", sim: "", pend: "", lahir: "", dept: "", kdNama: "", kdTelp: "", pengalaman: "", dokUrl: null as string | null,
  agama: "", nikah: "", golDarah: "", bankNama: "", bankRek: "", alamatKtp: "", pendInst: "",
  gajiPokok: "", tunjTetap: "", mulaiKerja: "", akhirKontrak: "",
};
const PENDIDIKAN = ["", "SD", "SMP", "SMA/SMK", "D3", "S1", "S2", "S3"];
const SIM_OPTS = ["", "A", "B1", "B2", "C", "A & C", "Tidak punya"];
const AGAMA = ["", "Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lainnya"];
const NIKAH = ["", "Belum menikah (TK)", "Menikah (K)", "Menikah anak 1 (K1)", "Menikah anak 2 (K2)", "Menikah anak 3 (K3)", "Cerai"];
const GOLDARAH = ["", "A", "B", "AB", "O"];

/* Crop foto — canvas native (nol dependency): geser utk posisi, slider utk zoom, hasil 480×480 JPEG.
 * Single-form: dirender DI DALAM modal form (menggantikan isian), bukan pop-up bertumpuk. */
function CropPane({ src, onDone, onClose }: { src: string; onDone: (f: File) => void; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const SIZE = 280;
  const base = nat.w ? SIZE / Math.min(nat.w, nat.h) : 1; // cover
  const dw = nat.w * base * zoom, dh = nat.h * base * zoom;
  const ox = (SIZE - dw) / 2 + pos.x, oy = (SIZE - dh) / 2 + pos.y;
  const apply = () => {
    const img = imgRef.current; if (!img || !nat.w) return;
    const s = base * zoom;
    const c = document.createElement("canvas"); c.width = c.height = 480;
    c.getContext("2d")!.drawImage(img, -ox / s, -oy / s, SIZE / s, SIZE / s, 0, 0, 480, 480);
    c.toBlob((b) => { if (b) onDone(new File([b], "foto-crop.jpg", { type: "image/jpeg" })); }, "image/jpeg", 0.9);
  };
  return (
    <div>
      <div className="sub mono" style={{ fontSize: 10, letterSpacing: ".12em", marginBottom: 12 }}>CROP FOTO — GESER & ZOOM</div>
      <div style={{ width: SIZE, height: SIZE, margin: "0 auto", overflow: "hidden", position: "relative", border: "1px solid var(--gold)", cursor: "grab", touchAction: "none", background: "#0A1830" }}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
        onPointerMove={(e) => { if (drag.current) setPos({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); }}
        onPointerUp={() => { drag.current = null; }}>
        <img ref={imgRef} src={src} alt="Crop" draggable={false} crossOrigin="anonymous"
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={{ position: "absolute", left: ox, top: oy, width: dw || SIZE, height: dh || SIZE, maxWidth: "none", userSelect: "none", pointerEvents: "none" }} />
      </div>
      <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(+e.target.value)} style={{ width: "100%", margin: "14px 0" }} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn-line" onClick={onClose}>Batal</button>
        <button className="btn btn-gold" onClick={apply}>Terapkan Crop</button>
      </div>
    </div>
  );
}

/* Avatar bulat: foto bila ada, inisial bila tidak — selaras palet navy/gold. */
function Ava({ e }: { e: Emp }) {
  const ini = e.n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return e.foto
    ? <img src={e.foto} alt={e.n} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }} />
    : <span style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: "var(--gold-deep)", background: "rgba(176,138,62,.12)", border: "1px solid rgba(176,138,62,.3)" }}>{ini}</span>;
}

export default function DatabaseKaryawan() {
  const { ten, toast, pushQueue, patchTen } = useStore();
  const router = useRouter();
  const t = ten!;
  const emp = t.emp; // satu sumber: store — dashboard & profil ikut ter-update
  const [f, setF] = useState("semua");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  /* modal tambah/edit manual */
  const [edOpen, setEdOpen] = useState(false);
  const [edId, setEdId] = useState<string | null>(null); // null = tambah baru
  const [ed, setEd] = useState(BLANK);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null); // foto terpilih → wajib crop dulu
  const fotoRef = useRef<HTMLInputElement>(null);

  const bukaTambah = () => { setEdId(null); setEd(BLANK); setFotoFile(null); setEdOpen(true); };
  const [dokFile, setDokFile] = useState<File | null>(null);
  const dokRef = useRef<HTMLInputElement>(null);

  const bukaEdit = (e: Emp) => {
    setEdId(e.id!); setFotoFile(null); setDokFile(null);
    setEd({
      n: e.n, j: e.j === "—" ? "" : e.j, jk: e.jk, wn: e.wn, lok: e.lok, s: e.s, m: e.m, prov: e.prov || "", kota: e.kota || "", desa: e.desa || "", foto: e.foto || null,
      nik: e.nik || "", kk: e.kk || "", npwp: e.npwp || "", bpjsKes: e.bpjsKes || "", bpjsTk: e.bpjsTk || "", sim: e.sim || "", pend: e.pend || "", lahir: e.lahir || "",
      dept: e.dept || "", kdNama: e.kdNama || "", kdTelp: e.kdTelp || "", pengalaman: e.pengalaman || "", dokUrl: e.dokUrl || null,
      agama: e.agama || "", nikah: e.nikah || "", golDarah: e.golDarah || "", bankNama: e.bankNama || "", bankRek: e.bankRek || "", alamatKtp: e.alamatKtp || "", pendInst: e.pendInst || "",
      gajiPokok: e.gajiPokok ? String(e.gajiPokok) : "", tunjTetap: e.tunjTetap ? String(e.tunjTetap) : "", mulaiKerja: e.mulaiKerja || "", akhirKontrak: e.akhirKontrak || "",
    });
    setEdOpen(true);
  };

  const { run: simpanManual, pending: savingManual } = useAsyncAction(async () => {
    if (!ed.n.trim()) { toast("Nama wajib diisi", "Lengkapi nama karyawan.", "warn"); return; }
    const tid = tidNow();
    let foto = ed.foto;
    if (fotoFile) {
      const up = await api.employees.uploadPhoto(tid, fotoFile);
      if (!up.ok) { toast("Foto gagal diunggah", up.error.message, "warn"); return; }
      foto = up.data.url;
    }
    let dokUrl = ed.dokUrl, dokNama = "";
    if (dokFile) {
      const up = await api.employees.uploadDoc(tid, dokFile);
      if (!up.ok) { toast("Dokumen gagal diunggah", up.error.message, "warn"); return; }
      dokUrl = up.data.url; dokNama = up.data.name;
    }
    const rec = empToRow({
      ...ed, n: ed.n.trim(), j: ed.j.trim(),
      m: ed.mulaiKerja ? (ed.s === "PKWTT" ? `Sejak ${ed.mulaiKerja}` : `${ed.mulaiKerja} – ${ed.akhirKontrak || "?"}`) : (ed.m || (ed.s === "PKWTT" ? "Sejak 2026" : "2026 – 2027")),
      foto, dokUrl, dok: dokNama || undefined, sisa: ed.s === "PKWT" ? 60 : null,
      gajiPokok: ed.gajiPokok ? Number(ed.gajiPokok) : null, tunjTetap: ed.tunjTetap ? Number(ed.tunjTetap) : null,
    });
    if (!dokNama) delete (rec as Record<string, unknown>).dok; // jangan timpa nama dokumen lama bila tak unggah baru
    const res = edId
      ? await withRetry(() => api.employees.update(edId, rec))
      : await withRetry(() => api.employees.create(tid, rec));
    if (!res.ok) { toast("Gagal menyimpan", res.error.message, "warn"); return; }
    const row = empFromRow(res.data);
    patchTen({ emp: edId ? emp.map((x) => (x.id === edId ? { ...x, ...row } : x)) : [row, ...emp] });
    setEdOpen(false);
    toast(edId ? "Data karyawan diperbarui" : "Karyawan tercatat", `${row.n} — tersimpan ke rekam tenant · seluruh dashboard terkait diperbarui.`, "ok");
  });

  const hapus = async (e: Emp) => {
    if (!(await askConfirm(`Hapus ${e.n} dari rekam?`))) return;
    const res = await api.employees.remove(e.id!);
    if (!res.ok) return toast("Gagal menghapus", res.error.message, "warn");
    patchTen({ emp: emp.filter((x) => x.id !== e.id) });
    toast("Karyawan dihapus", `${e.n} dikeluarkan dari rekam.`, "warn");
  };

  /* modal ekstraksi karyawan */
  const [exOpen, setExOpen] = useState(false);
  const [ex, setEx] = useState({ dok: "", nama: "", jk: "L", wn: "TKI", lok: "1", status: "PKWT", jab: "", masa: "" });
  const [exFile, setExFile] = useState<File | null>(null); // berkas sumber → diunggah saat Simpan

  /* Impor Excel karyawan LEWAT DROPZONE (template diunduh di Alat Legal). Deteksi .xlsx otomatis. */
  const xlsx = useExcelImport("emp");

  const rows = emp.map((e, i) => ({ e, i })).filter(({ e }) => {
    if (f === "PKWTT" && e.s !== "PKWTT") return false;
    if (f === "PKWT" && e.s !== "PKWT") return false;
    if (f === "TKI" && e.wn !== "TKI") return false;
    if (f === "TKA" && e.wn !== "TKA") return false;
    if (f === "reminder" && !e.rem) return false;
    return (e.n + " " + e.j).toLowerCase().includes(q.toLowerCase());
  });

  const empUp = useUpload((file) => {
    registerVault(file);
    const fn = file.name;
    const guess = fn.replace(/\.[^.]+$/, "").replace(/^(PK[_ -]?)?(PKWTT?[_ -]?)?(KTP[_ -]?)?(Pengesahan[_ -]?)?(RPTKA[_ -]?)?/i, "").replace(/[_-]+/g, " ").trim();
    const isTKA = /rptka|imta|kitas/i.test(fn), isPKWTT = /pkwtt/i.test(fn);
    setEx({ dok: fn, nama: guess, jk: "L", wn: isTKA ? "TKA" : "TKI", lok: isTKA ? "0" : "1", status: isPKWTT ? "PKWTT" : "PKWT", jab: "", masa: "" });
    setExOpen(true);
  });

  const empUpload = async (file: File) => {
    if (empUp.uploading) return;
    const isImg = /\.(jpe?g|png|webp)$/i.test(file.name), isPdf = /\.pdf$/i.test(file.name);
    // Word/doc tak bisa dibaca model → pertahankan jalur lama (tebak dari nama file).
    if (!isImg && !isPdf) {
      const res = await empUp.start(file);
      if (!res.ok && res.error.code !== "aborted") { toast("Unggahan gagal", res.error.message + " — mencoba ulang…", "warn"); empUp.retry(); }
      return;
    }
    // Gambar/PDF → ekstraksi AI NYATA (Gemini multimodal, free tier). Hasil masuk modal untuk dikonfirmasi.
    toast("AI membaca dokumen…", "Ekstraksi field ketenagakerjaan dari dokumen — Anda konfirmasi sebelum tersimpan.");
    registerVault(file);
    setExFile(file);
    const vals = (await aiExtract(file, EX_FIELDS)) || {};
    setEx({
      dok: file.name, nama: vals.nama || "", jab: vals.jab || "",
      jk: vals.jk === "P" ? "P" : "L", wn: vals.wn === "TKA" ? "TKA" : "TKI",
      lok: vals.lok === "0" ? "0" : "1", status: vals.status === "PKWTT" ? "PKWTT" : "PKWT", masa: vals.masa || "",
    });
    setExOpen(true);
  };

  const { run: empSave, pending: empSaving } = useAsyncAction(async () => {
    if (!ex.nama.trim()) { toast("Nama wajib diisi", "Lengkapi hasil ekstraksi sebelum menyimpan.", "warn"); return; }
    // Berkas asli DIUNGGAH (dulu hanya namanya dicatat — hilang saat refresh).
    let dokUrl: string | null = null;
    if (exFile) {
      const up = await api.employees.uploadDoc(tidNow(), exFile);
      if (!up.ok) { toast("Gagal mengunggah dokumen", up.error.message, "warn"); return; }
      dokUrl = up.data.url;
    }
    const rec = empToRow({
      n: ex.nama, j: ex.jab.trim(), jk: ex.jk as "L" | "P", wn: ex.wn as "TKI" | "TKA",
      lok: ex.lok === "1", s: ex.status as "PKWT" | "PKWTT",
      m: ex.masa.trim() || (ex.status === "PKWTT" ? "Sejak 2026" : "2026 – 2027"),
      sisa: ex.status === "PKWT" ? 60 : null, komp: ex.status === "PKWT" ? "Terjadwal" : "—", dok: ex.dok, dokUrl,
    }, "ai");
    const res = await withRetry(() => api.employees.create(tidNow(), rec));
    if (!res.ok) { toast("Gagal menyimpan", res.error.message, "warn"); return; }
    patchTen({ emp: [empFromRow(res.data), ...emp] });
    setExOpen(false); setExFile(null);
    toast("Tenaga kerja tercatat — DRAF AI", `Dokumen tersimpan di vault (hash tercatat) · rekap LKPM diperbarui otomatis${ex.wn === "TKA" ? " · validasi keterkaitan RPTKA dijalankan" : ""}.`, "ok");
  });

  const c = (wn: string, jk: string) => emp.filter((e) => e.wn === wn && e.jk === jk).length;

  return (
    <div>
      <ViewHead h1="Database Karyawan"
        sub="Kontrak & BPJS tak lengkap = status BERISIKO pada aspek Ketenagakerjaan LDD — lengkapi rekam tiap karyawan di sini."
        acts={<>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file && !xlsx.tryFile(file)) empUpload(file); e.target.value = ""; }} />
          <button className="btn btn-gold" onClick={bukaTambah}><UserPlus size={14} /> Tambah Karyawan</button>
        </>} />

      <div>
        <div className="grid g4 mb16">
          <Kpi v={emp.length} label="Total tenaga kerja" tr="di luar Komisaris & Direksi" />
          <Kpi v={emp.filter((e) => e.wn === "TKI").length} label="Tenaga Kerja Indonesia (TKI)" tr="Mayoritas komposisi pekerja" />
          <Kpi v={emp.filter((e) => e.wn === "TKA").length} label="Tenaga Kerja Asing (TKA)" tr="RPTKA terpantau" />
          <Kpi v={emp.filter((e) => e.lok).length} label="Tenaga kerja lokal setempat" tr="Memenuhi standar domisili" />
        </div>

        <div className="dropzone mb16" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gold)"; }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = ""; const file = e.dataTransfer.files?.[0]; if (file && !xlsx.tryFile(file)) empUpload(file); }}>
          <b>Letakkan dokumen karyawan di sini, atau klik untuk memilih berkas.</b>
          Perjanjian Kerja (PKWT/PKWTT), KTP, Pengesahan RPTKA. AI mengekstrak field sesuai format pelaporan tenaga kerja LKPM (jenis kelamin, TKI/TKA, lokal). Anda mengonfirmasi sebelum tersimpan. Atau letakkan file Excel (template di Alat Legal) untuk impor massal.
        </div>

        <div className="filters" style={{ display: "flex", width: "100%", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
          <input className="finput" style={{ flex: 1, minWidth: 0 }} placeholder="Cari nama / jabatan…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {["semua", "TKI", "TKA", "PKWTT", "PKWT", "reminder"].map((x) => (
              <button key={x} className={`fchip${f === x ? " on" : ""}`} onClick={() => setF(x)}>{x === "semua" ? "Semua" : x === "reminder" ? "Reminder" : x}</button>
            ))}
          </div>
        </div>
        
        <div className="tblwrap">
          <table>
            <thead><tr><th>Tenaga Kerja</th><th>Jenis Kelamin</th><th>TKI / TKA</th><th>Lokal</th><th>Status</th><th>Tanggal Masuk</th><th>Habis Kontrak</th><th>Kontrak Kerja</th><th>Kepatuhan</th><th>Aksi</th></tr></thead>
            <tbody>
              {rows.map(({ e, i }) => {
                const slug = e.n.toLowerCase().replace(/\s+/g, '-');
                return (
                <tr key={e.id || i}>
                  {/* Nama TIDAK lagi bisa diklik — detail hanya lewat tombol Buka di kolom Aksi. */}
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Ava e={e} />
                      <div><b>{e.n}</b><span className="sub">{e.j}</span></div>
                    </div>
                  </td>
                  <td>{e.jk === "P" ? "Perempuan" : "Laki-laki"}</td>
                  <td><Chip c={e.wn === "TKA" ? "c-gold" : "c-mon"}>{e.wn}</Chip></td>
                  <td>{e.lok ? "Ya" : "—"}</td>
                  <td><Chip c={e.s === "PKWTT" ? "c-mon" : "c-gold"}>{e.s}</Chip></td>
                  <td><span className="sub mono" style={{ fontSize: 10.5 }}>{fmtTgl(e.mulaiKerja)}</span></td>
                  <td><span className="sub mono" style={{ fontSize: 10.5 }}>{e.s === "PKWTT" ? "Tetap" : fmtTgl(e.akhirKontrak)}</span></td>
                  <td>
                    <span className="sub mono" style={{ fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 5, maxWidth: 180 }}>
                      {(e.dok || e.dokUrl) && <FileText size={11} style={{ flexShrink: 0, color: "var(--gold-deep)" }} />}
                      {dokRingkas(e.dok) || (e.dokUrl ? "dokumen tersimpan" : "—")}
                    </span>
                  </td>
                  <td>
                    <Chip c={e.pat === "PATUH" ? "c-ver" : "c-draft"}>{e.pat === "PATUH" ? "PATUH" : "REMINDER"}</Chip>
                    {hasExpiredSP(e) ? <> <Chip c="c-red">SP HABIS MASA</Chip></> : null}
                  </td>
                  {/* Aksi standar: Buka (routing ke halaman detail, sama seperti Asset Management) lalu ikon titik-tiga */}
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button className="btn-act" onClick={() => router.push(`/hr/database/${slug}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button>
                      {e.id && <RowActions onEdit={() => bukaEdit(e)} onDelete={() => void hapus(e)} />}
                    </div>
                  </td>
                </tr>
              )})}
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

      {xlsx.modal}

      <Modal open={exOpen} title="Ekstraksi AI — Data Tenaga Kerja (Format LKPM)" onClose={() => setExOpen(false)}
        footer={<><button className="btn btn-line" onClick={() => setExOpen(false)}>Batal</button><button className="btn btn-navy" disabled={empSaving} aria-busy={empSaving} onClick={() => void empSave()}>{empSaving ? "Menyimpan…" : "Simpan & Rekap"}</button></>}>
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

      {/* modal tambah/edit manual — jaring pengaman di samping Extract AI */}
      <Modal right open={edOpen} title={edId ? "Edit Karyawan" : "Tambah Karyawan"} onClose={() => setEdOpen(false)}
        footer={cropSrc ? undefined : <><button className="btn btn-line" onClick={() => setEdOpen(false)}>Batal</button><button className="btn btn-gold" disabled={savingManual} aria-busy={savingManual} onClick={() => void simpanManual()}>{savingManual ? "Menyimpan…" : edId ? "Simpan" : "Simpan"}</button></>}>
        {/* Single-form: saat crop aktif, isi modal berganti jadi area crop — selesai/batal kembali ke form */}
        {cropSrc ? <CropPane src={cropSrc} onClose={() => setCropSrc(null)}
          onDone={(f2) => { setFotoFile(f2); setCropSrc(null); }} /> : <>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <input ref={fotoRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: "none" }}
            onChange={(e) => { const f2 = e.target.files?.[0]; if (f2) setCropSrc(URL.createObjectURL(f2)); e.target.value = ""; }} />
          {fotoFile || ed.foto
            ? <img src={fotoFile ? URL.createObjectURL(fotoFile) : ed.foto!} alt="Foto" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--gold)" }} />
            : <span style={{ width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 700, color: "var(--gold-deep)", background: "rgba(176,138,62,.12)", border: "1px dashed rgba(176,138,62,.45)" }}>{(ed.n.trim()[0] || "+").toUpperCase()}</span>}
          <div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-line btn-sm" onClick={() => fotoRef.current?.click()}>{fotoFile || ed.foto ? "Ganti foto" : "Unggah foto"}</button>
              {(fotoFile || ed.foto) && <button className="btn btn-line btn-sm" onClick={() => setCropSrc(fotoFile ? URL.createObjectURL(fotoFile) : ed.foto!)}>Crop</button>}
            </div>
            <span className="sub" style={{ display: "block", marginTop: 4, fontSize: 10.5 }}>JPG/PNG — opsional, tampil di profil &amp; tabel.</span>
          </div>
        </div>
        <Field label="Nama lengkap *"><input value={ed.n} onChange={(e) => setEd({ ...ed, n: e.target.value })} placeholder="Nama sesuai KTP" /></Field>
        <Field label="Jabatan"><input value={ed.j} onChange={(e) => setEd({ ...ed, j: e.target.value })} placeholder="Jabatan sesuai perjanjian kerja" /></Field>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Jenis kelamin"><select value={ed.jk} onChange={(e) => setEd({ ...ed, jk: e.target.value as "L" | "P" })}><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></Field>
          <Field label="Klasifikasi"><select value={ed.wn} onChange={(e) => setEd({ ...ed, wn: e.target.value as "TKI" | "TKA" })}><option value="TKI">TKI — Tenaga Kerja Indonesia</option><option value="TKA">TKA — Tenaga Kerja Asing</option></select></Field>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label={<>Status hubungan kerja — <Jargon k="PKWT" /> / <Jargon k="PKWTT" /></>}><select value={ed.s} onChange={(e) => setEd({ ...ed, s: e.target.value as "PKWT" | "PKWTT" })}><option>PKWT</option><option>PKWTT</option></select></Field>
          <Field label="Lokal setempat"><select value={ed.lok ? "1" : "0"} onChange={(e) => setEd({ ...ed, lok: e.target.value === "1" })}><option value="1">Ya — domisili sesuai lokasi usaha</option><option value="0">Tidak</option></select></Field>
        </div>
        {/* Revisi owner 5y-#2: masa kerja bebas dipisah jadi Tanggal Masuk + Tanggal Habis Kontrak. */}
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Tanggal masuk"><input type="date" value={ed.mulaiKerja} onChange={(e) => setEd({ ...ed, mulaiKerja: e.target.value })} /></Field>
          <Field label="Tanggal habis kontrak"><input type="date" value={ed.akhirKontrak} disabled={ed.s === "PKWTT"} onChange={(e) => setEd({ ...ed, akhirKontrak: e.target.value })} placeholder="—" /></Field>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Gaji pokok / bulan"><RpInput value={ed.gajiPokok} placeholder="5.000.000" onChange={(v) => setEd({ ...ed, gajiPokok: v })} /></Field>
          <Field label="Tunjangan tetap / bulan"><RpInput value={ed.tunjTetap} placeholder="1.000.000" onChange={(v) => setEd({ ...ed, tunjTetap: v })} /></Field>
        </div>
        <div className="note" style={{ marginTop: -4, marginBottom: 12 }}>
          Upah dasar perhitungan (PP 35/2021) = gaji pokok + tunjangan tetap ={" "}
          <b style={{ color: "var(--gold-bright)" }}>{fmt(Number(ed.gajiPokok || 0) + Number(ed.tunjTetap || 0))}</b> — dipakai kalkulator pesangon, THR, dan estimasi kewajiban di Kepatuhan.
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Provinsi domisili"><input value={ed.prov} onChange={(e) => setEd({ ...ed, prov: e.target.value })} placeholder="Jawa Barat" /></Field>
          <Field label="Kota / Kabupaten"><input value={ed.kota} onChange={(e) => setEd({ ...ed, kota: e.target.value })} placeholder="Cirebon" /></Field>
        </div>
        <Field label="Desa / Kelurahan"><input value={ed.desa} onChange={(e) => setEd({ ...ed, desa: e.target.value })} placeholder="Opsional" /></Field>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Tanggal lahir"><input type="date" value={ed.lahir} onChange={(e) => setEd({ ...ed, lahir: e.target.value })} /></Field>
          <Field label="Pendidikan terakhir"><select value={ed.pend} onChange={(e) => setEd({ ...ed, pend: e.target.value })}>{PENDIDIKAN.map((p) => <option key={p} value={p}>{p || "— pilih —"}</option>)}</select></Field>
        </div>
        <Field label="Institusi pendidikan"><input value={ed.pendInst} onChange={(e) => setEd({ ...ed, pendInst: e.target.value })} placeholder="mis. Universitas Indonesia · lulus 2018" /></Field>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Agama"><select value={ed.agama} onChange={(e) => setEd({ ...ed, agama: e.target.value })}>{AGAMA.map((a) => <option key={a} value={a}>{a || "— pilih —"}</option>)}</select></Field>
          <Field label="Status pernikahan"><select value={ed.nikah} onChange={(e) => setEd({ ...ed, nikah: e.target.value })}>{NIKAH.map((n) => <option key={n} value={n}>{n || "— pilih —"}</option>)}</select></Field>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="NIK KTP"><input value={ed.nik} onChange={(e) => setEd({ ...ed, nik: e.target.value })} placeholder="16 digit" /></Field>
          <Field label="No. Kartu Keluarga"><input value={ed.kk} onChange={(e) => setEd({ ...ed, kk: e.target.value })} placeholder="16 digit" /></Field>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="NPWP"><input value={ed.npwp} onChange={(e) => setEd({ ...ed, npwp: e.target.value })} placeholder="Opsional" /></Field>
          <Field label="SIM"><select value={ed.sim} onChange={(e) => setEd({ ...ed, sim: e.target.value })}>{SIM_OPTS.map((s) => <option key={s} value={s}>{s || "— pilih —"}</option>)}</select></Field>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="BPJS Kesehatan"><input value={ed.bpjsKes} onChange={(e) => setEd({ ...ed, bpjsKes: e.target.value })} placeholder="No. kartu" /></Field>
          <Field label="BPJS Ketenagakerjaan"><input value={ed.bpjsTk} onChange={(e) => setEd({ ...ed, bpjsTk: e.target.value })} placeholder="No. kartu" /></Field>
        </div>
        <Field label="Departemen"><input value={ed.dept} onChange={(e) => setEd({ ...ed, dept: e.target.value })} placeholder="mis. Operasional / Finance" /></Field>
        <Field label="Alamat sesuai KTP"><input value={ed.alamatKtp} onChange={(e) => setEd({ ...ed, alamatKtp: e.target.value })} placeholder="Jalan, RT/RW, kecamatan" /></Field>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Bank payroll"><input value={ed.bankNama} onChange={(e) => setEd({ ...ed, bankNama: e.target.value })} placeholder="mis. Bank Mandiri" /></Field>
          <Field label="No. rekening"><input value={ed.bankRek} onChange={(e) => setEd({ ...ed, bankRek: e.target.value })} placeholder="No. rekening payroll" /></Field>
        </div>
        <Field label="Golongan darah"><select value={ed.golDarah} onChange={(e) => setEd({ ...ed, golDarah: e.target.value })}>{GOLDARAH.map((g) => <option key={g} value={g}>{g || "— pilih —"}</option>)}</select></Field>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="Kontak darurat — nama"><input value={ed.kdNama} onChange={(e) => setEd({ ...ed, kdNama: e.target.value })} placeholder="Nama (hubungan)" /></Field>
          <Field label="Kontak darurat — telepon"><input value={ed.kdTelp} onChange={(e) => setEd({ ...ed, kdTelp: e.target.value })} placeholder="08…" /></Field>
        </div>
        <Field label="Pengalaman kerja"><input value={ed.pengalaman} onChange={(e) => setEd({ ...ed, pengalaman: e.target.value })} placeholder="Ringkas, mis. 3 th operator produksi PT X" /></Field>
        <Field label="Dokumen kerja (PK/KTP — PDF/JPG)">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input ref={dokRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const f2 = e.target.files?.[0]; if (f2) setDokFile(f2); e.target.value = ""; }} />
            <button type="button" className="btn btn-line btn-sm" onClick={() => dokRef.current?.click()}>{dokFile ? "Ganti berkas" : ed.dokUrl ? "Ganti dokumen" : "Pilih berkas"}</button>
            <span className="sub" style={{ fontSize: 10.5 }}>{dokFile ? dokFile.name : ed.dokUrl ? "dokumen tersimpan di vault" : "belum ada"}</span>
          </div>
        </Field>
        <div className="note">Rekam tersimpan per-tenant di database. Domisili mengisi otomatis grafik <b>Domisili Karyawan</b> pada Dashboard Employment.</div>
        </>}
      </Modal>

    </div>
  );
}
