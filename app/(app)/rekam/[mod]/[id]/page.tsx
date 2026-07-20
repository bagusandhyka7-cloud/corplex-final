"use client";
/* Detail Dokumen — SATU rute untuk semua modul (lic/assets/hki/pol/agr/…).
 * Split-panel: kiri grid info dari module_records, kanan render dokumen asli dari Storage.
 * Menggantikan pop-up kecil "Detail"/"Buka" di tabel tiap modul. */
import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { RecRow, SPECS, stripId } from "@/lib/records";
import { Chip, Timeline, ViewHead } from "@/components/ui";

/* case/corp: struktur timeline jsonb — dirender kronologis, bukan grid field SPECS */
type CaseData = { head?: string; tab?: string; tl?: string[][]; bukti?: string[][]; biaya?: string[][] };
type CorpData = { entity?: string; rups?: string[][]; dirs?: string[][]; stat?: string[][]; docs?: string[][] };
const JUDUL_TL: Record<string, string> = { case: "Perkara", corp: "Tata Kelola Perseroan" };

const isImg = (u: string) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u);

export default function DetailRekam({ params }: { params: Promise<{ mod: string; id: string }> }) {
  const { mod, id } = use(params);
  const router = useRouter();
  const [rec, setRec] = useState<{ data: unknown; dok_url: string | null; dok_nama: string | null; created_at: string; source: string } | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => { void api.records.get(id).then((r) => (r.ok ? setRec(r.data) : setErr(true))); }, [id]);

  const spec = SPECS[mod];
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
        {/* KIRI: grid informasi dari DB */}
        <div style={{ background: "var(--sur)", border: "1px solid var(--line)", borderRadius: 14, padding: 20 }}>
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
            <span className="mono" style={{ fontSize: 10, letterSpacing: ".12em", color: "var(--muted)" }}>DOKUMEN ASLI — {rec?.dok_nama || "VAULT"}</span>
            {rec?.dok_url && <a className="btn btn-line btn-sm" href={rec.dok_url} target="_blank" rel="noreferrer"><Download size={11} /> Unduh</a>}
          </div>
          {rec?.dok_url ? (
            isImg(rec.dok_url)
              ? <div style={{ flex: 1, overflow: "auto", display: "grid", placeItems: "center", background: "#0A1830" }}><img src={rec.dok_url} alt="Dokumen" style={{ maxWidth: "100%" }} /></div>
              : <iframe src={rec.dok_url} style={{ flex: 1, border: "none", background: "#fff" }} title="Dokumen rekam" />
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
