"use client";
/* Detail Dokumen — SATU rute untuk semua modul (lic/assets/hki/pol/agr/…).
 * Split-panel: kiri grid info dari module_records, kanan render dokumen asli dari Storage.
 * Menggantikan pop-up kecil "Detail"/"Buka" di tabel tiap modul. */
import React, { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, Scale, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { RecRow, SPECS, stripId } from "@/lib/records";
import { Chip, Timeline, ViewHead } from "@/components/ui";
import { useStore } from "@/lib/store";

/* case/corp: struktur timeline jsonb — dirender kronologis, bukan grid field SPECS */
type CaseData = { head?: string; tab?: string; tl?: string[][]; bukti?: string[][]; biaya?: string[][] };
type CorpData = { entity?: string; rups?: string[][]; dirs?: string[][]; stat?: string[][]; docs?: string[][] };
const JUDUL_TL: Record<string, string> = { case: "Perkara", corp: "Tata Kelola Perseroan" };

const isImg = (u: string) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u);

export default function DetailRekam({ params }: { params: Promise<{ mod: string; id: string }> }) {
  const { mod, id } = use(params);
  const router = useRouter();
  const { toast, pushQueue, patchTen, ten } = useStore();
  const [rec, setRec] = useState<{ data: unknown; dok_url: string | null; dok_nama: string | null; created_at: string; source: string } | null>(null);
  const [err, setErr] = useState(false);
  const [view, setView] = useState<{ url: string; nama: string } | null>(null); // preview berkas terpilih (bundel)
  /* S5: CRUD perkara (tahapan/bukti/biaya) pindah ke sini — list Perkara tinggal daftar */
  const [tlBaru, setTlBaru] = useState("");
  const [biayaL, setBiayaL] = useState("");
  const [biayaN, setBiayaN] = useState("");
  const buktiRef = useRef<HTMLInputElement>(null);
  const tglID = () => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();

  useEffect(() => { void api.records.get(id).then((r) => (r.ok ? setRec(r.data) : setErr(true))); }, [id]);

  /* tulis patch jsonb case ke DB + sinkron store (ten.cases) */
  const saveCase = async (patch: Partial<CaseData>, dok?: { url: string; nama: string }) => {
    if (!rec) return;
    const data = { ...(rec.data as CaseData), ...patch };
    const r = await api.records.update(id, data, dok);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    setRec({ ...rec, data, dok_url: dok?.url ?? rec.dok_url, dok_nama: dok?.nama ?? rec.dok_nama });
    if (ten) patchTen({ cases: ten.cases.map((x) => (x.id === id ? { ...x, ...patch } as typeof x : x)) });
  };
  const caseTahap = async () => {
    if (!tlBaru.trim() || !rec) return;
    const d = rec.data as CaseData;
    await saveCase({ tl: [...(d.tl || []).map((s) => [s[0], s[1], s[2], "done"]), [tglID(), tlBaru.trim(), "Dicatat manual", "next"]] });
    setTlBaru(""); toast("Tahapan tercatat", "Kronologi diperbarui.", "ok");
  };
  const caseBiaya = async () => {
    if (!biayaL.trim() || !biayaN.trim() || !rec) return;
    await saveCase({ biaya: [...((rec.data as CaseData).biaya || []), [biayaL.trim(), biayaN.trim()]] });
    setBiayaL(""); setBiayaN("");
  };
  const caseBukti = async (file: File) => {
    const up = await api.records.uploadDoc(localStorage.getItem("corplex_tid") || "", file);
    if (!up.ok) return toast("Gagal mengunggah", up.error.message, "warn");
    const nama = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    await saveCase({ bukti: [...((rec?.data as CaseData)?.bukti || []), [nama, `Diunggah ${tglID()}, tersimpan di vault`, "SAH"]] }, up.data);
    toast("Bukti terindeks", `${nama} tersimpan pada rekam perkara.`, "ok");
  };

  const spec = SPECS[mod];
  /* bundel (lic index 11): daftar berkas [nama, url] — preview + unduh per berkas */
  const files = Array.isArray((rec?.data as unknown[])?.[11]) ? ((rec!.data as unknown[])[11] as [string, string][]) : null;
  const shownUrl = view?.url ?? rec?.dok_url ?? null;
  const shownNama = view?.nama ?? rec?.dok_nama ?? null;
  const judul = JUDUL_TL[mod] || spec?.title || "Rekam";
  const vals = rec && spec ? spec.fromData(stripId(mod, rec.data as RecRow)) : null;
  const cd = mod === "case" && rec ? (rec.data as CaseData) : null;
  const cp = mod === "corp" && rec ? (rec.data as CorpData) : null;

  if (err) return (
    <div>
      <ViewHead h1="Rekam Tidak Ditemukan" sub="Dokumen yang Anda cari tidak ada di rekam tenant." />
      <button className="btn btn-line" onClick={() => router.back()}><ArrowLeft size={14} /> Kembali</button>
    </div>
  );

  return (
    <div>
      <button className="btn btn-line btn-sm" onClick={() => router.back()} style={{ marginBottom: 16 }}><ArrowLeft size={14} /> Kembali</button>
      <ViewHead h1={`Detail ${judul}`} sub={vals ? String(Object.values(vals)[0] || "") : "Memuat rekam…"} />

      <div className="split-detail">
        {/* KIRI: grid informasi dari DB — tinggi sejajar presisi dgn panel dokumen kanan */}
        <div style={{ background: "var(--sur)", border: "1px solid var(--line)", borderRadius: 14, padding: 20, height: "calc(100vh - 260px)", minHeight: 420, overflowY: "auto" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".16em", color: "var(--gold-deep)", marginBottom: 14 }}>INFORMASI REKAM</div>
          {!rec ? <span style={{ fontSize: 12, color: "var(--muted)" }}>Memuat…</span> : (
            <>
              {(cd || cp) && (
                <div style={{ marginBottom: 8 }}>
                  {cd && <>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600, marginBottom: 10 }}>{cd.head || cd.tab}</div>
                    <div className="sub mono" style={{ fontSize: 9, letterSpacing: ".12em", marginBottom: 8 }}>KRONOLOGI</div>
                    {cd.tl?.length ? <Timeline items={cd.tl} /> : <span style={{ fontSize: 12, color: "var(--muted)" }}>Belum ada tahapan.</span>}
                    {!!cd.bukti?.length && <><div className="sub mono" style={{ fontSize: 9, letterSpacing: ".12em", margin: "12px 0 6px" }}>BUKTI</div>
                      {cd.bukti.map((b, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}><b style={{ color: "var(--ink)" }}>{b[0]}</b><span style={{ color: "var(--muted)" }}> — {b[1]}</span></div>)}</>}
                    {!!cd.biaya?.length && <><div className="sub mono" style={{ fontSize: 9, letterSpacing: ".12em", margin: "12px 0 6px" }}>BIAYA</div>
                      {cd.biaya.map((b, i) => <div key={i} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}><span>{b[0]}</span><b style={{ color: "var(--ink)" }}>{b[1]}</b></div>)}</>}
                    {/* Kelola perkara — blok berlabel, rapi & mudah dipahami non-teknis */}
                    <div style={{ marginTop: 18, borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 14, display: "grid", gap: 14 }}>
                      <div>
                        <div className="sub mono" style={{ fontSize: 9, letterSpacing: ".12em", marginBottom: 6 }}>1 · CATAT PERKEMBANGAN TERBARU</div>
                        <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 6px" }}>Tulis apa yang baru terjadi pada perkara ini, misalnya "Sidang pertama digelar". Otomatis masuk kronologi di atas.</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <input className="finput" style={{ flex: 1, minWidth: 160 }} placeholder="mis. Sidang pertama digelar" value={tlBaru} onChange={(e) => setTlBaru(e.target.value)} />
                          <button className="btn btn-navy btn-sm" onClick={() => void caseTahap()}>Simpan</button>
                        </div>
                      </div>
                      <div>
                        <div className="sub mono" style={{ fontSize: 9, letterSpacing: ".12em", marginBottom: 6 }}>2 · CATAT BIAYA PERKARA</div>
                        <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 6px" }}>Isi nama pengeluaran dan jumlahnya, misalnya "Biaya panjar" dan "Rp 2.500.000".</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <input className="finput" style={{ flex: 2, minWidth: 140 }} placeholder="Nama pengeluaran" value={biayaL} onChange={(e) => setBiayaL(e.target.value)} />
                          <input className="finput" style={{ flex: 1, minWidth: 90 }} placeholder="Rp…" value={biayaN} onChange={(e) => setBiayaN(e.target.value)} />
                          <button className="btn btn-navy btn-sm" onClick={() => void caseBiaya()}>Simpan</button>
                        </div>
                      </div>
                      <div>
                        <div className="sub mono" style={{ fontSize: 9, letterSpacing: ".12em", marginBottom: 6 }}>3 · BUKTI &amp; BANTUAN ADVOKAT</div>
                        <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 6px" }}>Unggah dokumen bukti (putusan, surat, foto) — tersimpan aman di vault. Butuh advokat? Klik tombol emas.</p>
                        <input ref={buktiRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: "none" }}
                          onChange={(e) => { const fl = e.target.files?.[0]; if (fl) void caseBukti(fl); e.target.value = ""; }} />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn btn-line btn-sm" onClick={() => buktiRef.current?.click()}><Upload size={12} /> Unggah bukti</button>
                          <button className="btn btn-gold btn-sm" onClick={() => { pushQueue(`Perkara — ${cd.tab}`, `Verifikasi dari modul Perkara · ${cd.bukti?.length || 0} bukti · ${cd.tl?.length || 0} tahapan`, "c-gold", "ESKALASI", [{ mod: "case", id, label: `Rekam Perkara — ${cd.tab || ""}` }],
                            `${cd.head || cd.tab}\n\nKronologi:\n${(cd.tl || []).map((s) => `${s[0]} · ${s[1]}`).join("\n") || "-"}\n\nBukti terindeks:\n${(cd.bukti || []).map((b) => b[0]).join("\n") || "— belum ada"}`); }}><Scale size={12} /> Verifikasi ke Advokat</button>
                        </div>
                      </div>
                    </div>
                  </>}
                  {cp && <>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600, marginBottom: 10 }}>{cp.entity}</div>
                    <div className="sub mono" style={{ fontSize: 9, letterSpacing: ".12em", marginBottom: 8 }}>KRONOLOGI RUPS</div>
                    {cp.rups?.length ? <Timeline items={cp.rups} /> : <span style={{ fontSize: 12, color: "var(--muted)" }}>Belum ada tahapan RUPS.</span>}
                    {!!cp.stat?.length && <><div className="sub mono" style={{ fontSize: 9, letterSpacing: ".12em", margin: "12px 0 6px" }}>KEWAJIBAN STATUTORI</div>
                      {cp.stat.map((s, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}><b style={{ color: "var(--ink)" }}>{s[0]}</b><span style={{ color: "var(--muted)" }}> — {s[3]}</span></div>)}</>}
                    {!!cp.docs?.length && <><div className="sub mono" style={{ fontSize: 9, letterSpacing: ".12em", margin: "12px 0 6px" }}>DOKUMEN</div>
                      {cp.docs.map((d, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>{d[0]}</div>)}</>}
                  </>}
                </div>
              )}
              {spec?.fields.map((f) => (
                <div key={f.k} style={{ marginBottom: 11, borderTop: "1px solid rgba(255,255,255,.05)", paddingTop: 9 }}>
                  <span style={{ fontSize: 10.5, color: "var(--mon)", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 3 }}>{f.l.replace(" *", "")}</span>
                  <span style={{ fontSize: 13, color: vals?.[f.k] ? "var(--ink)" : "var(--muted)" }}>{vals?.[f.k] || "— belum diisi"}</span>
                </div>
              ))}
              {files && files.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="sub mono" style={{ fontSize: 9, letterSpacing: ".12em", marginBottom: 8 }}>DOKUMEN TERTAUT — {files.length} BERKAS</div>
                  {files.map(([nama, url], i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid rgba(255,255,255,.05)" }}>
                      <FileText size={12} style={{ color: "var(--gold-deep)", flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nama}</span>
                      <button className="btn btn-line btn-sm" onClick={() => setView({ url, nama })}>Preview</button>
                      <a className="btn btn-navy btn-sm" href={url} target="_blank" rel="noreferrer" download><Download size={11} /></a>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Chip c="c-mon">{rec.source === "ai" ? "EKSTRAKSI AI" : rec.source === "excel" ? "IMPOR EXCEL" : "INPUT MANUAL"}</Chip>
                <Chip c="c-ver">{new Date(rec.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</Chip>
              </div>
            </>
          )}
        </div>

        {/* KANAN: render dokumen asli dari Storage */}
        <div style={{ background: "var(--sur)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", height: "calc(100vh - 260px)", minHeight: 420 }}>
          <div style={{ padding: "11px 15px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: "var(--muted)" }}>DOKUMEN ASLI — {shownNama || "VAULT"}</span>
            {shownUrl && <a className="btn btn-line btn-sm" href={shownUrl} target="_blank" rel="noreferrer"><Download size={11} /> Unduh</a>}
          </div>
          {shownUrl ? (
            isImg(shownUrl)
              ? <div style={{ flex: 1, overflow: "auto", display: "grid", placeItems: "center", background: "#0A1830" }}><img src={shownUrl} alt="Dokumen" style={{ maxWidth: "100%" }} /></div>
              : <iframe src={shownUrl} style={{ flex: 1, border: "none", background: "#fff" }} title="Dokumen rekam" />
          ) : (
            <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12.5, textAlign: "center", padding: 30 }}>
              <div>
                <FileText size={30} style={{ opacity: .4, marginBottom: 10 }} />
                <div>Belum ada dokumen asli terunggah untuk rekam ini.</div>
                <div style={{ fontSize: 11, marginTop: 6 }}>Seret berkas ke dropzone di halaman modul saat mendaftarkan rekam.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
