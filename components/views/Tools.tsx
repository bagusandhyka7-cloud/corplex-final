"use client";
/* Alat Legal — full-width (panel "Sifat Modul" dihapus). Translator = 2 panel sejajar,
 * terjemahan NYATA via /api/chat (Gemini). Template Form = grid nyata unduh .xlsx. */
import React, { useRef, useState } from "react";
import { ArrowLeftRight, Download, FileText, Globe, KeyRound, Paperclip, PenTool, RefreshCw, Scale, ScanSearch, Upload } from "lucide-react";
import { TOOLS } from "@/lib/data";
import { api, empToRow } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Chip, Modal, Panel, Row, ViewHead } from "@/components/ui";
import { parseWorkbook, SHEETS, buatTemplateSatu, toPayload } from "@/lib/impor";

const ICONS: Record<string, React.ReactNode> = {
  convert: <RefreshCw size={19} />, clip: <Paperclip size={19} />, sign: <PenTool size={19} />,
  note: <FileText size={19} />, globe: <Globe size={19} />, key: <KeyRound size={19} />,
  scale: <Scale size={19} />, scan: <ScanSearch size={19} />,
};

/* Translator nyata — INPUT FILE SAJA (tanpa ketik manual): unggah dokumen teks,
 * isinya dibaca lalu diterjemahkan streaming Gemini. Dua panel sejajar penuh. */
const PANEL_DOC: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 10, background: "#0A1830", padding: 14, minHeight: 300, maxHeight: 420, overflowY: "auto", fontSize: 12.5, lineHeight: 1.8, whiteSpace: "pre-wrap", color: "var(--txt)" };

function Translator() {
  const { toast } = useStore();
  const [dir, setDir] = useState<"ID→EN" | "EN→ID">("ID→EN");
  const [fileNama, setFileNama] = useState("");
  const [src, setSrc] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const terima = async (f: File) => {
    /* ponytail: ekstraksi teks nyata baru utk berkas teks (.txt/.md) — PDF/DOCX menunggu
     * engine ekstraksi server (blueprint /api/tools); jujur, tidak pura-pura membaca. */
    if (!/\.(txt|md|csv)$/i.test(f.name)) {
      toast("Format menunggu engine ekstraksi", "Saat ini unggah berkas teks (.txt/.md/.csv). PDF & Word menyusul saat engine konversi tersambung.", "warn");
      return;
    }
    const teks = await f.text();
    setFileNama(f.name); setSrc(teks); setOut("");
  };

  const jalankan = async () => {
    if (!src.trim()) { toast("Belum ada dokumen", "Unggah berkas teks pada dropzone.", "warn"); return; }
    setBusy(true); setOut("");
    abortRef.current = new AbortController();
    const [dari, ke] = dir === "ID→EN" ? ["Indonesia", "Inggris"] : ["Inggris", "Indonesia"];
    const r = await api.ai.chatStream({
      model: "Jago 1.5", signal: abortRef.current.signal,
      messages: [{ role: "user", content: `Terjemahkan teks hukum berikut dari bahasa ${dari} ke bahasa ${ke}. Gunakan istilah hukum yang tepat. Balas HANYA hasil terjemahan tanpa penjelasan.\n\n${src.slice(0, 12000)}` }],
      onDelta: (t) => setOut((o) => o + t),
    });
    setBusy(false);
    if (!r.ok && r.error.code !== "aborted") toast("Terjemahan gagal", r.error.message, "warn");
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf,.doc,.docx" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void terima(f); e.target.value = ""; }} />
      <div className="dropzone mb16" onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gold)"; }}
        onDragLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = ""; const f = e.dataTransfer.files?.[0]; if (f) void terima(f); }}>
        <b>{fileNama ? `${fileNama} — siap diterjemahkan` : "Letakkan dokumen di sini, atau klik untuk memilih."}</b>
        Berkas teks (.txt/.md/.csv) dibaca langsung · PDF/Word menyusul saat engine ekstraksi tersambung.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button className="btn btn-line btn-sm" onClick={() => setDir(dir === "ID→EN" ? "EN→ID" : "ID→EN")}><ArrowLeftRight size={12} /> {dir}</button>
        <button className="btn btn-gold btn-sm" disabled={busy || !src} aria-busy={busy} onClick={() => void jalankan()}>{busy ? "Menerjemahkan…" : "Terjemahkan Dokumen"}</button>
        <span className="sub" style={{ fontSize: 10.5 }}>Glosarium hukum — hasil AI, periksa sebelum dipakai resmi.</span>
      </div>
      <div className="grid g2" style={{ gap: 16 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>{dir === "ID→EN" ? "Dokumen asal (Bahasa Indonesia)" : "Source document (English)"}</label>
          <div style={{ ...PANEL_DOC, color: src ? "var(--txt)" : "var(--muted)" }}>{src || "Isi dokumen tampil di sini setelah berkas diunggah…"}</div>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>{dir === "ID→EN" ? "Translation (English)" : "Terjemahan (Bahasa Indonesia)"}</label>
          <div style={{ ...PANEL_DOC, color: out ? "var(--txt)" : "var(--muted)" }}>{out || "Hasil terjemahan tampil di sini…"}</div>
        </div>
      </div>
    </div>
  );
}

/* 6 alat statis — simulasi proses 3,5 dtk lalu pesan integrasi engine.
 * Engine gratis per alat sudah diblueprint-kan di /api/tools (Gotenberg · pdf-lib ·
 * crypto · Gemini · diff-match-patch). */
/* Semua alat = INPUT FILE SAJA (tanpa ketik manual); Comparison butuh 2 berkas. */
const STUB_KEY: Record<string, { key: string; dua?: boolean; ket: string }> = {
  "Konversi Dokumen": { key: "convert", ket: "PDF · Word · pindaian dokumen hukum." },
  "Keabsahan Dokumen": { key: "sign", ket: "Dokumen final untuk stempel & tanda tangan digital." },
  "AI Summarizer": { key: "summarize", ket: "Perjanjian/kontrak yang ingin diringkas per pasal." },
  "AI Clause Extraction": { key: "clause", ket: "Kontrak — pasal kunci diekstrak jadi metadata terstruktur." },
  "AI Comparison": { key: "compare", dua: true, ket: "Dua versi kontrak yang ingin dibandingkan." },
};
const TAHAP = ["Membaca dokumen…", "Menyiapkan mesin pemroses…", "Menyusun hasil…"];

function StubTool({ nama }: { nama: string }) {
  const cfg = STUB_KEY[nama];
  const [files, setFiles] = useState<File[]>([]);
  const [fase, setFase] = useState<"idle" | "proses" | "selesai">("idle");
  const [tahap, setTahap] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const butuh = cfg.dua ? 2 : 1;

  const terima = (fs: FileList | null) => {
    if (!fs?.length) return;
    setFiles((xs) => [...xs, ...Array.from(fs)].slice(-butuh));
    setFase("idle");
  };

  const jalankan = async () => {
    setFase("proses"); setTahap(0);
    const iv = setInterval(() => setTahap((n) => (n + 1) % TAHAP.length), 1200);
    await Promise.all([
      fetch("/api/tools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool: cfg.key }) }).catch(() => null),
      new Promise((res) => setTimeout(res, 3500)), // simulasi pemrosesan 3-5 dtk
    ]);
    clearInterval(iv);
    setFase("selesai");
  };

  return (
    <div>
      <input ref={fileRef} type="file" multiple={!!cfg.dua} style={{ display: "none" }} onChange={(e) => { terima(e.target.files); e.target.value = ""; }} />
      <div className="dropzone mb16" onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gold)"; }}
        onDragLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = ""; terima(e.dataTransfer.files); }}>
        <b>{files.length ? files.map((f) => f.name).join("  ·  ") : `Letakkan ${cfg.dua ? "2 berkas" : "berkas"} di sini, atau klik untuk memilih.`}</b>
        {files.length ? (files.length < butuh ? `Butuh ${butuh - files.length} berkas lagi.` : "Berkas siap diproses.") : cfg.ket}
      </div>
      {fase === "proses" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 4px" }}>
          <span className="dd-spin" />
          <span className="sub mono" style={{ fontSize: 11, letterSpacing: ".08em" }}>{TAHAP[tahap]}</span>
        </div>
      ) : fase === "selesai" ? (
        <div className="note" style={{ borderColor: "var(--gold)", display: "flex", alignItems: "center", gap: 10 }}>
          <Chip c="c-gold">DALAM PENGEMBANGAN</Chip>
          <span><b>Layanan dalam tahap integrasi engine</b> — alat ini belum memproses berkas Anda dan tidak menyimpan apa pun; aktif begitu mesin pemroses tersambung.</span>
        </div>
      ) : null}
      <button className="btn btn-gold" style={{ marginTop: 4 }} disabled={fase === "proses" || files.length < butuh}
        onClick={() => void jalankan()}>{fase === "proses" ? "Memproses…" : "Proses"}</button>
    </div>
  );
}

/* Manajemen PDF — ENGINE NYATA (pdf-lib di /api/tools): merge · split · watermark.
 * Hasil langsung terunduh sebagai PDF. */
function PdfTool() {
  const { toast } = useStore();
  const [op, setOp] = useState<"merge" | "split" | "watermark">("merge");
  const [files, setFiles] = useState<File[]>([]);
  const [rentang, setRentang] = useState("");
  const [teks, setTeks] = useState("RAHASIA — " + "CORPLEX");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const butuh = op === "merge" ? 2 : 1;

  const terima = (fs: FileList | null) => {
    if (!fs?.length) return;
    const pdfs = Array.from(fs).filter((f) => /\.pdf$/i.test(f.name));
    if (!pdfs.length) return toast("Hanya PDF", "Alat ini memproses berkas .pdf.", "warn");
    setFiles((xs) => (op === "merge" ? [...xs, ...pdfs] : pdfs.slice(0, 1)));
  };

  const proses = async () => {
    if (files.length < butuh) return toast("Berkas kurang", op === "merge" ? "Merge butuh minimal 2 PDF." : "Unggah 1 PDF.", "warn");
    setBusy(true);
    const fd = new FormData();
    fd.append("op", op);
    files.forEach((f) => fd.append("file", f));
    if (rentang) fd.append("rentang", rentang);
    if (teks) fd.append("teks", teks);
    const r = await fetch("/api/tools", { method: "POST", body: fd }).catch(() => null);
    setBusy(false);
    if (!r) return toast("Gagal menghubungi server", "Coba lagi.", "warn");
    if (!r.ok) { const j = await r.json().catch(() => null); return toast("Gagal memproses", j?.error || `HTTP ${r.status}`, "warn"); }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (r.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]) || "hasil.pdf";
    a.click(); URL.revokeObjectURL(a.href);
    toast("PDF selesai diproses", `${a.download} terunduh — hasil pdf-lib on-premise, nol layanan pihak ketiga.`, "ok");
  };

  return (
    <div>
      <div className="filters" style={{ marginBottom: 14 }}>
        {([["merge", "Gabung (Merge)"], ["split", "Pecah (Split)"], ["watermark", "Watermark"]] as const).map(([k, l]) => (
          <button key={k} className={`fchip${op === k ? " on" : ""}`} onClick={() => { setOp(k); setFiles([]); }}>{l}</button>
        ))}
      </div>
      <input ref={fileRef} type="file" accept=".pdf" multiple={op === "merge"} style={{ display: "none" }}
        onChange={(e) => { terima(e.target.files); e.target.value = ""; }} />
      <div className="dropzone mb16" onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gold)"; }}
        onDragLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = ""; terima(e.dataTransfer.files); }}>
        <b>{files.length ? files.map((f) => f.name).join("  ·  ") : op === "merge" ? "Letakkan 2+ PDF (urutan = urutan gabung)." : "Letakkan 1 PDF di sini."}</b>
        {op === "merge" ? `${files.length} berkas dipilih — klik lagi untuk menambah.` : "Diproses on-premise dengan pdf-lib — berkas tidak keluar server Corplex."}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        {op === "split" && <div className="field" style={{ margin: 0, width: 180 }}><label>Rentang halaman</label><input value={rentang} placeholder="mis. 1-3 (kosong = semua)" onChange={(e) => setRentang(e.target.value)} /></div>}
        {op === "watermark" && <div className="field" style={{ margin: 0, width: 280 }}><label>Teks watermark</label><input value={teks} onChange={(e) => setTeks(e.target.value)} /></div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-gold" disabled={busy || files.length < butuh} aria-busy={busy} onClick={() => void proses()}>{busy ? "Memproses…" : "Proses & Unduh"}</button>
          {!!files.length && <button className="btn btn-line" onClick={() => setFiles([])}>Kosongkan</button>}
        </div>
      </div>
    </div>
  );
}

/* Template Form: unduh template kosong + UNGGAH terisi → pratinjau → simpan massal (tanpa AI).
 * ponytail: simpan loop sekuensial; batch/pool jika ribuan baris terasa lambat. */
function TemplateForm() {
  const { ten, toast } = useStore();
  const [prev, setPrev] = useState<{ items: ReturnType<typeof parseWorkbook>["items"]; skipped: number; unknownSheets: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [prog, setProg] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const tid = () => localStorage.getItem("corplex_tid") || "";

  const pick = async (f: File) => {
    const r = parseWorkbook(await f.arrayBuffer());
    if (!r.items.length) { toast("Tak ada baris valid", `Sheet dikenal: ${SHEETS.map((s) => s.sheet).join(", ")}. Pastikan header & isi sesuai template.`, "warn"); return; }
    setPrev(r);
  };

  const simpan = async () => {
    if (!prev) return;
    setSaving(true); setProg(0);
    const name = ten?.name || "";
    let ok = 0, gagal = 0;
    for (let i = 0; i < prev.items.length; i++) {
      const it = prev.items[i];
      const p = toPayload(it, name);
      const res = it.mod === "emp"
        ? await api.employees.create(tid(), empToRow(p as unknown as Parameters<typeof empToRow>[0]))
        : await api.records.create(tid(), it.mod, p);
      res.ok ? ok++ : gagal++;
      setProg(Math.round(((i + 1) / prev.items.length) * 100));
    }
    setSaving(false); setPrev(null);
    toast("Impor selesai", `${ok} tersimpan${gagal ? ` · ${gagal} gagal` : ""} — layar menyusul otomatis.`, gagal ? "warn" : "ok");
    // Nol muat-ulang: realtime module_records/employees di store menyegarkan seluruh layar sendiri.
  };

  const perMod = prev ? prev.items.reduce<Record<string, number>>((a, x) => ((a[x.mod] = (a[x.mod] || 0) + 1), a), {}) : {};

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className="btn btn-gold" onClick={() => fileRef.current?.click()}><Upload size={14} /> Unggah Template Terisi</button>
        <span className="sub" style={{ fontSize: 11, alignSelf: "center" }}>Isi template lalu unggah di sini — data masuk otomatis, tanpa ketik ulang.</span>
      </div>
      <div className="rows">
        {SHEETS.map((s) => (
          <Row key={s.sheet} b={`Template ${s.sheet}`} d={`${s.fields.length} kolom · .xlsx siap isi`}
            right={<button className="btn btn-line btn-sm" onClick={() => buatTemplateSatu(s.sheet)}><Download size={12} /> Unduh</button>} />
        ))}
      </div>

      <Modal open={!!prev} title="Pratinjau Impor" onClose={() => setPrev(null)}
        footer={<><button className="btn btn-line" onClick={() => setPrev(null)}>Batal</button>
          <button className="btn btn-gold" disabled={saving} aria-busy={saving} onClick={() => void simpan()}>{saving ? `Menyimpan… ${prog}%` : `Simpan ${prev?.items.length || 0} Baris`}</button></>}>
        {prev && (
          <div className="rows">
            {SHEETS.filter((s) => perMod[s.mod]).map((s) => (
              <Row key={s.mod} b={s.sheet} d={`${perMod[s.mod]} baris siap disimpan`} right={<Chip c="c-ver">{perMod[s.mod]}</Chip>} />
            ))}
            {prev.skipped > 0 && <Row b="Baris dilewati" d="Field wajib (*) kosong" right={<Chip c="c-draft">{prev.skipped}</Chip>} />}
            {prev.unknownSheets.length > 0 && <Row b="Sheet tak dikenal" d={prev.unknownSheets.join(", ")} right={<Chip c="c-red">{prev.unknownSheets.length}</Chip>} />}
            {!prev.items.length && <Row b="Tidak ada baris valid" d="Periksa header & isi template." right={<Chip c="c-red">0</Chip>} />}
          </div>
        )}
        <div className="note mt16">Baris contoh bawaan template & baris kosong dilewati otomatis. Nilai berkonsekuensi hukum diambil apa adanya dari sel — koreksi di modul bila ada salah ketik.</div>
      </Modal>
    </>
  );
}

export default function Tools() {
  const { toast } = useStore();
  const [cur, setCur] = useState(7);
  const tool = TOOLS[cur];

  return (
    <div>
      <ViewHead h1="Alat Legal"
        sub="Alat bantu siap pakai — pilih alat untuk mulai bekerja." />

      <div className="grid g4">
        {TOOLS.map((x, i) => (
          <div key={i} className={`tool${i === cur ? " on" : ""}`} onClick={() => setCur(i)}>
            <div className="ic">{ICONS[x.ic]}</div>
            <b>{x.t}</b><span>{x.s}</span>
          </div>
        ))}
      </div>

      {/* Lembar kerja full-width — panel "Sifat Modul" dihapus */}
      <div style={{ marginTop: 32 }}>
        <Panel title={`Lembar Kerja — ${tool.t}`}>
          {tool.t === "AI Translator" ? (
            <Translator />
          ) : tool.t === "Manajemen PDF" ? (
            <PdfTool />
          ) : STUB_KEY[tool.t] ? (
            <StubTool nama={tool.t} />
          ) : tool.kind === "template" ? (
            <TemplateForm />
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
