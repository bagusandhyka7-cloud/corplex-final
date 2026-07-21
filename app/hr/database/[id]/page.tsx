"use client";
import React, { useEffect, useState, use } from "react";
import { ArrowLeft, Download, Briefcase, GraduationCap, HeartPulse, ShieldAlert, FileText, CreditCard, Eye } from "lucide-react";
import { useStore } from "@/lib/store";
import { downloadDoc, vaultHash, vaultUrl } from "@/lib/vault";
import { api, AttRow } from "@/lib/api";
import { Chip, Field, Panel, Row, ViewHead } from "@/components/ui";
import { useRouter } from "next/navigation";

/* SP karyawan = rekam module_records (module 'sp') milik nama ini — satu sumber dgn submenu Surat Peringatan. */
type SpRow = { id: string; tingkat: string; alasan: string; tgl: string; chip: string; lbl: string; dok_url: string | null; dok_nama: string | null };

/* NOL DUMMY: seluruh biodata dirender dari kolom tabel `employees`.
 * Field kosong tampil "—" (belum diisi), bukan angka karangan. */
const umurDari = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso); if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 31_557_600_000);
};
const tglID = (iso?: string) => iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";
/* Viewer dokumen dropdown — dipakai Administrasi & tiap baris SP. Sumber: URL Storage atau vault sesi. */
const DocViewer = ({ url, name }: { url: string | null; name?: string }) => (
  <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", height: 380, display: "flex", flexDirection: "column" }}>
    <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--line)", background: "var(--sur-2)" }}>
      <span className="sub mono" style={{ fontSize: 10, letterSpacing: ".1em" }}>PREVIEW — {name || "DOKUMEN"}</span>
    </div>
    {url ? (
      /\.(jpe?g|png|webp)(\?|$)/i.test(url) || /\.(jpe?g|png|webp)$/i.test(name || "")
        ? <div style={{ flex: 1, overflow: "auto", display: "grid", placeItems: "center", background: "#0A1830" }}><img src={url} alt="Dokumen" style={{ maxWidth: "100%" }} /></div>
        : <iframe src={url} style={{ flex: 1, border: "none", background: "#fff" }} title="Preview dokumen" />
    ) : (
      <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12.5, textAlign: "center", padding: 30 }}>
        Berkas asli tidak tersedia untuk dipreview — belum ada unggahan tersimpan.<br />Unggah ulang dokumen untuk mengaktifkan preview.
      </div>
    )}
  </div>
);

const Info = ({ l, v }: { l: string; v?: string | null }) => (
  <div>
    <div style={{ fontSize: "11px", color: "var(--mon)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{l}</div>
    <div style={{ fontSize: "13px", color: v ? "var(--ink)" : "var(--muted)", lineHeight: 1.4 }}>{v || "— belum diisi"}</div>
  </div>
);

export default function EmployeeProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { ten, toast, pushQueue, patchTen } = useStore();
  const t = ten!;

  /* Baca store HIDUP — bukan snapshot: karyawan dimuat async dari Supabase, snapshot saat mount
   * membuat buka URL langsung tampil "tidak ditemukan". */
  const emp = t.emp;
  const detIdx = emp.findIndex(e => e.n.toLowerCase().replace(/\s+/g, '-') === id);
  const det = detIdx >= 0 ? emp[detIdx] : null;

  /* absensi nyata (tabel attendance) */
  const [attList, setAttList] = useState<AttRow[]>([]);
  const [att, setAtt] = useState({ periode: new Date().toISOString().slice(0, 7), hadir: "", izin: "", sakit: "", alpha: "" });
  const tid = () => localStorage.getItem("corplex_tid") || "";
  useEffect(() => {
    const eid = det?.id;
    if (!eid) return;
    void api.attendance.list(tid()).then((r) => { if (r.ok) setAttList(r.data.filter((a) => a.employee_id === eid)); });
  }, [det?.id]);

  const simpanAbsensi = async () => {
    if (!det?.id) { toast("Rekam belum tersimpan", "Karyawan ini belum ada di database.", "warn"); return; }
    const n = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
    const r = await api.attendance.upsert(tid(), det.id, att.periode, { hadir: n(att.hadir), izin: n(att.izin), sakit: n(att.sakit), alpha: n(att.alpha) });
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setAttList((xs) => [r.data, ...xs.filter((x) => x.periode !== att.periode)]);
    setAtt({ ...att, hadir: "", izin: "", sakit: "", alpha: "" });
    toast("Kehadiran tercatat", `${att.periode} tersimpan — peringkat karyawan rajin di dashboard diperbarui.`, "ok");
  };
  const hapusAbsensi = async (aid: string) => {
    const r = await api.attendance.remove(aid);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setAttList((xs) => xs.filter((x) => x.id !== aid));
  };

  const [dokOpen, setDokOpen] = useState(false);       // preview dropdown dokumen kerja
  const [spOpen, setSpOpen] = useState<string | null>(null); // id SP yang dipreview
  const [spRecs, setSpRecs] = useState<SpRow[]>([]);
  useEffect(() => {
    const n = det?.n;
    if (!n) return;
    void api.records.list(tid()).then((r) => {
      if (!r.ok) return;
      setSpRecs(r.data.filter((x) => x.module === "sp" && (x.data as { nama?: string }).nama === n)
        .map((x) => ({ id: x.id, dok_url: x.dok_url ?? null, dok_nama: x.dok_nama ?? null, ...(x.data as Omit<SpRow, "id" | "dok_url" | "dok_nama">) })));
    });
  }, [det?.n]);

  if (!det) {
    return (
      <div>
        <ViewHead h1="Karyawan Tidak Ditemukan" sub="Karyawan yang Anda cari tidak ada di database." />
        <button className="btn btn-line" onClick={() => router.push('/hr/database')}><ArrowLeft size={14} /> Kembali ke Database</button>
      </div>
    );
  }

  const inisial = det.n.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  const umur = umurDari(det.lahir);
  const domisili = [det.desa && `Desa ${det.desa}`, det.kota, det.prov].filter(Boolean).join(", ");

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <button className="btn btn-line btn-sm" onClick={() => router.push('/hr/database')} style={{ marginRight: 16 }}>
          <ArrowLeft size={14} /> Kembali ke Database
        </button>
      </div>

      <ViewHead h1={`${det.n}`} sub="Profil Karyawan & Rekam Hukum" />

      {/* GRID LAYOUT SPLIT-VIEW */}
      <div className="split-detail" style={{ marginTop: 24 }}>
        
        {/* KOLOM KIRI: MAIN PROFILE CARD */}
        <div style={{ background: "var(--sur)", borderRadius: 16, border: "1px solid var(--line)", overflow: "hidden" }}>
          {/* Cover & Avatar */}
          <div style={{ height: "100px", background: "linear-gradient(135deg, var(--sur-2) 0%, var(--surf) 100%)", position: "relative" }}>
            <div style={{ 
              position: "absolute", bottom: "-72px", left: "24px", width: "144px", height: "144px", 
              borderRadius: "20px", background: "var(--ink)", border: "6px solid var(--sur)", 
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--bg)", fontSize: "56px", fontWeight: "bold", fontFamily: "var(--mono)"
            }}>
              {det.foto ? <img src={det.foto} alt={det.n} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} /> : inisial}
            </div>
          </div>

          <div style={{ padding: "88px 24px 24px 24px" }}>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", color: "var(--ink)" }}>{det.n}</h2>
            <div style={{ color: "var(--gold)", fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>{det.j}</div>
            <div style={{ color: "var(--mon)", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "24px" }}>
              <Briefcase size={12} /> {det.dept || "Departemen belum diisi"}
            </div>

            <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <Info l="Tanggal Lahir" v={tglID(det.lahir)} />
              <Info l="Usia" v={umur !== null ? `${umur} Tahun` : ""} />
              <div>
                <div style={{ fontSize: "11px", color: "var(--mon)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Status Kelokalan & Kewarganegaraan</div>
                <div style={{ fontSize: "13px", color: "var(--ink)", display: "flex", alignItems: "center", gap: "10px" }}>
                  <Chip c={det.wn === "TKA" ? "c-gold" : "c-mon"}>{det.wn}</Chip>
                  <span>{det.lok ? "Lokal Setempat" : "Non-Lokal"}</span>
                </div>
              </div>
              <Info l="Agama & Pernikahan" v={[det.agama, det.nikah].filter(Boolean).join(" · ")} />
              <div>
                <div style={{ fontSize: "11px", color: "var(--mon)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Masa Kerja & Perjanjian</div>
                <div style={{ fontSize: "13px", color: "var(--ink)", display: "flex", alignItems: "center", gap: "10px" }}>
                  <Chip c={det.s === "PKWTT" ? "c-mon" : "c-gold"}>{det.s}</Chip>
                  <span>{det.m}</span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "20px", marginTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--gold-deep)", letterSpacing: ".14em", marginBottom: "4px" }}>DATA ADMINISTRATIF & PAJAK</div>

              <Info l="NIK KTP" v={det.nik} />
              <Info l="Kartu Keluarga" v={det.kk} />
              <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "12px" }}><Info l="Alamat KTP" v={det.alamatKtp} /></div>
              <Info l="Domisili" v={domisili} />
              <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "12px" }}><Info l="NPWP" v={det.npwp} /></div>
              <Info l="BPJS Kesehatan" v={det.bpjsKes} />
              <Info l="BPJS Ketenagakerjaan" v={det.bpjsTk} />
              <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "12px" }}><Info l="SIM" v={det.sim} /></div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: DETAILS, DOCS, COMPLIANCE */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", height: "100%" }}>
          
          {/* SECTION 1: Kualifikasi & Pengalaman */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <Panel title={<><GraduationCap size={14} style={{ display: "inline", marginBottom: "-2px", marginRight: "6px" }}/> Riwayat Pendidikan</>}>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--sur-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <GraduationCap size={16} style={{ color: "var(--mon)" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px", color: det.pend ? "var(--ink)" : "var(--muted)" }}>{det.pend || "— belum diisi"}</div>
                  <div style={{ fontSize: "12px", color: "var(--mon)" }}>{det.pendInst || "Institusi belum diisi"}</div>
                </div>
              </div>
            </Panel>

            <Panel title={<><Briefcase size={14} style={{ display: "inline", marginBottom: "-2px", marginRight: "6px" }}/> Pengalaman Kerja</>}>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--sur-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Briefcase size={16} style={{ color: "var(--mon)" }} />
                </div>
                <div style={{ fontSize: "13px", color: det.pengalaman ? "var(--ink)" : "var(--muted)", lineHeight: 1.5 }}>{det.pengalaman || "— belum diisi"}</div>
              </div>
            </Panel>
          </div>

          {/* SECTION 2: Kesehatan & Aktifitas */}
          {/* Absensi NYATA dari tabel attendance — dasar metrik "Karyawan Paling Rajin" di dashboard */}
          <Panel title={<><HeartPulse size={14} style={{ display: "inline", marginBottom: "-2px", marginRight: "6px" }}/> Rekap Kehadiran</>}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
              <Field label="Periode"><input type="month" value={att.periode} onChange={(e) => setAtt({ ...att, periode: e.target.value })} /></Field>
              {(["hadir", "izin", "sakit", "alpha"] as const).map((k) => (
                <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                  <input inputMode="numeric" style={{ width: 64 }} value={att[k]} onChange={(e) => setAtt({ ...att, [k]: e.target.value })} />
                </Field>
              ))}
              {/* marginLeft auto = rata kanan, sejajar kolom tombol Hapus di daftar — input Alpha tak bergeser */}
              <button className="btn btn-navy btn-sm" style={{ marginBottom: 2, marginLeft: "auto", marginRight: 15 }} onClick={() => void simpanAbsensi()}>Simpan</button>
            </div>
            <div className="rows">
              {attList.map((a) => (
                <Row key={a.id} b={a.periode} d={`Hadir ${a.hadir} · Izin ${a.izin} · Sakit ${a.sakit} · Alpha ${a.alpha}`}
                  right={<><Chip c={a.alpha === 0 ? "c-ver" : "c-draft"}>{a.alpha === 0 ? "TANPA ALPHA" : `${a.alpha} ALPHA`}</Chip>
                    <button className="btn btn-red btn-sm" onClick={() => void hapusAbsensi(a.id)}>Hapus</button></>} />
              ))}
              {!attList.length && <Row b="Belum ada rekap kehadiran" d="Catat kehadiran bulanan untuk mengaktifkan peringkat karyawan paling rajin." right={<Chip c="c-mon">KOSONG</Chip>} />}
            </div>
          </Panel>

          {/* SECTION 3: Administrasi & Dokumen */}
          <Panel title={<><FileText size={14} style={{ display: "inline", marginBottom: "-2px", marginRight: "6px" }}/> Administrasi & Dokumen Tertaut</>}>
            <div className="rows">
              <Row b={`Perjanjian Kerja (${det.s})`} d={`${det.dok} · hash ${vaultHash(det.dok)} · tersimpan di vault`}
                right={
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={`btn btn-sm ${dokOpen ? "btn-gold" : "btn-line"}`} onClick={() => setDokOpen(!dokOpen)}><Eye size={11} /> Preview</button>
                    <button className="btn btn-navy btn-sm" onClick={() => { downloadDoc(det.dok, t.name); toast("Unduhan dimulai", `${det.dok} · hash ${vaultHash(det.dok)} · akses unduh tercatat pada jejak audit.`, "ok"); }}><Download size={11} /> Unduh</button>
                  </div>
                } />
              {det.wn === "TKA" ? <Row b="Pengesahan RPTKA" d="Wajib bagi TKA · masa berlaku dipantau fungsi JAGA" right={<Chip c="c-ver">TERTAUT</Chip>} /> : null}
            </div>
            {/* Preview dropdown — tertutup = panel sepadat bagian SP */}
            {dokOpen && <DocViewer url={det.dokUrl || vaultUrl(det.dok)} name={det.dok || "DOKUMEN KERJA"} />}
          </Panel>

          {/* SECTION 4: Surat Peringatan — baca-saja dari module_records; penerbitan lewat submenu Surat Peringatan */}
          <div style={{ background: "var(--sur)", padding: 24, borderRadius: 16, border: "1px solid var(--line)" }}>
            <h4 style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--gold-deep)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldAlert size={14} /> RIWAYAT SURAT PERINGATAN (SP)
            </h4>
            <div className="rows">
              {spRecs.length ? spRecs.map((s) => (
                <React.Fragment key={s.id}>
                  <Row b={`${s.tingkat} — ${s.alasan}`} d={`Terbit ${s.tgl} · berlaku 6 bulan${s.dok_nama ? ` · ${s.dok_nama}` : ""}`}
                    right={<div style={{ display: "flex", gap: 8 }}>
                      <button className={`btn btn-sm ${spOpen === s.id ? "btn-gold" : "btn-line"}`} onClick={() => setSpOpen(spOpen === s.id ? null : s.id)}><Eye size={11} /> Preview</button>
                      <button className="btn btn-navy btn-sm" onClick={() => {
                        if (s.dok_url) { const a = document.createElement("a"); a.href = s.dok_url; a.download = s.dok_nama || "SP"; a.target = "_blank"; a.click(); }
                        else downloadDoc(`${s.tingkat}_${det.n}.pdf`, t.name);
                        toast("Unduhan dimulai", `${s.dok_nama || s.tingkat} · akses unduh tercatat pada jejak audit.`, "ok");
                      }}><Download size={11} /> Unduh</button></div>} />
                  {spOpen === s.id && <DocViewer url={s.dok_url} name={s.dok_nama || `${s.tingkat} — ${det.n}`} />}
                </React.Fragment>
              )) : <Row b="Belum ada Surat Peringatan" d="Riwayat SP kosong — rekam bersih. Penerbitan SP lewat submenu Surat Peringatan." right={<Chip c="c-ver">BERSIH</Chip>} />}
            </div>
          </div>
          
          {/* SECTION 5: Payroll & Darurat */}
          <Panel style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start" }} title={<><CreditCard size={14} style={{ display: "inline", marginBottom: "-2px", marginRight: "6px" }}/> Informasi Payroll & Darurat</>}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <Info l="Informasi Rekening" v={det.bankNama ? `${det.bankNama} · ${det.bankRek || "—"}` : ""} />
              <Info l="Kontak Darurat" v={det.kdNama ? `${det.kdNama} · ${det.kdTelp || "—"}` : ""} />
              <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--line)", paddingTop: "16px" }}>
                <Info l="Golongan Darah" v={det.golDarah} />
              </div>
            </div>
          </Panel>

        </div>
      </div>

      {/* Footer Note (Full Width) */}
      <div className="note" style={{ marginTop: "24px", textAlign: "center" }}>
        Corplex <b>merekam dan menjaga basis data hukum</b> perusahaan: setiap dokumen terunggah (PK · SP · KTP · RPTKA) tersimpan di vault dengan hash, dapat <b>diunduh ulang kapan pun</b>, dan masa berlakunya dipantau fungsi JAGA.
      </div>
    </div>
  );
}
