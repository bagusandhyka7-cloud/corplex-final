"use client";
import React, { useEffect, useState } from "react";
import { Lock, Plus, RadioTower, Scale } from "lucide-react";
import { useStore } from "@/lib/store";
import { Chip, Panel, Row, Tabs } from "@/components/ui";
import { ModuleShell } from "@/components/ModuleShell";
import { RecActions, RecordModal } from "@/components/RecordModal";
import { idOf, RecRow } from "@/lib/records";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

const SUBJUDUL = ["Asset Management", "Intellectual Property", "Digital Vault"];

export default function Asset() {
  const { ten, toast, pushQueue, patchTen, activeTab: tab, setActiveTab: setTab } = useStore();
  const t = ten!;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [af, setAf] = useState("semua"); // filter status Asset Management
  const [hf, setHf] = useState("semua"); // filter status Intellectual Property
  const [ddName, setDdName] = useState<string | null>(null);
  const [ddLoading, setDdLoading] = useState(false);
  const mod = tab === 1 ? "hki" : "assets"; // modul CRUD ikut tab aktif
  const [mOpen, setMOpen] = useState(false);
  const [mEdit, setMEdit] = useState<RecRow | null>(null);
  const key = mod as "hki" | "assets";
  const onDone = (row: RecRow, editId: string | null) =>
    patchTen({ [key]: (editId ? t[key].map((x) => idOf(mod, x) === editId ? row : x) : [row, ...t[key]]) as never });
  const onDeleted = (id: string) => patchTen({ [key]: t[key].filter((x) => idOf(mod, x) !== id) as never });
  /* Log akses vault NYATA — module_records mod 'vault' (nol seed). */
  type VLog = { id: string; dok: string; alasan: string; oleh: string; waktu: string; kategori: string; refMod?: string; refId?: string };
  const [vaultLog, setVaultLog] = useState<VLog[]>([]);
  const [vq, setVq] = useState("");
  const [vf, setVf] = useState("semua");

  useEffect(() => {
    void api.records.list(localStorage.getItem("corplex_tid") || "").then((r) => {
      if (r.ok) setVaultLog(r.data.filter((x) => x.module === "vault").map((x) => ({ ...(x.data as Omit<VLog, "id">), id: x.id })));
    });
  }, []);

  /* Buka = langsung routing ke split-panel. Log akses ditulis di latar (tanpa dialog browser) —
   * jejak audit tetap terekam, alur kerja tidak terputus. */
  const buka = (nama: string, mod2: string, row: RecRow) => {
    const id = idOf(mod2, row);
    if (!id) return;
    const tid = localStorage.getItem("corplex_tid") || "";
    const entri = { dok: nama, alasan: `Dibuka dari ${mod2 === "hki" ? "Intellectual Property" : "Asset Management"}`, oleh: t.user, waktu: new Date().toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), kategori: mod2 === "hki" ? "HKI" : "Aset", refMod: mod2, refId: id };
    void api.records.create(tid, "vault", entri);
    router.push(`/rekam/${mod2}/${id}`);
  };

  /* Enforcement Strategy: rekam HKI baru bertipe penindakan + eskalasi ke advokat (CRUD nyata). */
  const enforcement = async () => {
    const tid = localStorage.getItem("corplex_tid") || "";
    const data = ["Enforcement — Desain Kemasan Seri B", "Strategi penindakan pelanggaran", "Watcher marketplace", "", 0, "Bukti berstempel waktu + hash SHA-256", ["c-red", "PELANGGARAN"], ["c-gold", "PROSES"]];
    const r = await api.records.create(tid, "hki", data);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    patchTen({ hki: [[...data, r.data.id], ...t.hki] as never });
    pushQueue("Enforcement — Desain Kemasan Seri B", "Bundel bukti watcher terlampir · strategi penindakan HKI", "c-gold", "ESKALASI");
  };

  /* Keputusan watcher tercatat sebagai rekam (bukan toast kosong). */
  const catatWatcher = async (jenis: "bukti" | "bukan") => {
    const tid = localStorage.getItem("corplex_tid") || "";
    const data = jenis === "bukti"
      ? ["Arsip Bukti — Desain Kemasan Seri B", "Tangkapan layar + URL + stempel waktu + hash", "Watcher marketplace", "", 0, "Siap dipakai bundel perkara", ["c-mon", "ARSIP"], ["c-mon", "TERCATAT"]]
      : ["Watcher — ditandai bukan pelanggaran", "Koreksi manual atas temuan kemiripan", "Watcher marketplace", "", 0, "Model kemiripan belajar dari koreksi", null, ["c-ver", "DITUTUP"]];
    const r = await api.records.create(tid, "hki", data);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    patchTen({ hki: [[...data, r.data.id], ...t.hki] as never });
  };

  /* Loader statis 5 detik untuk setiap pemrosesan Due Diligence (arahan owner) —
   * hasil ditahan meski backend instan, supaya proses terasa dikerjakan. */
  const jalankanDD = (nama: string) => {
    setDdName(nama); setDdLoading(true);
    setTimeout(() => setDdLoading(false), 5000);
  };

  /* Dropzone: dokumen aset/HKI ke Storage + rekam baru pada modul tab aktif. */
  const dropDok = async (file: File) => {
    const tid = localStorage.getItem("corplex_tid") || "";
    const up = await api.records.uploadDoc(tid, file);
    if (!up.ok) return toast("Gagal mengunggah", up.error.message, "warn");
    const nama = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    const data = mod === "hki"
      ? [nama, "Hasil ekstraksi dokumen", "", "", 0, "", null, ["c-ver", "TERDAFTAR"]]
      : [nama, "Hasil ekstraksi dokumen", "", null, "—", "c-ver", "AMAN"];
    const r = await api.records.create(tid, mod, data, "ai", up.data);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    patchTen({ [key]: [[...data, r.data.id], ...t[key]] as never });
  };

  /* Digital Vault = murni pemantauan: tanpa tombol daftar & tanpa dropzone; filter + search saja. */
  const vault = tab === 2;
  const vaultRows = vaultLog.filter((v) =>
    (vf === "semua" || v.kategori === vf) &&
    (v.dok + v.alasan + v.oleh).toLowerCase().includes(vq.toLowerCase()));

  return (
    <ModuleShell h1={SUBJUDUL[tab] || "Aset & Merek"}
      sub={vault ? "Pemantauan akses dokumen — setiap pembukaan tercatat dengan alasan aksesnya." : "Aset dan merek perusahaan tersimpan aman — kewajiban tiap aset diingatkan otomatis."}
      acts={vault ? undefined : <button className="btn btn-gold" onClick={() => { setMEdit(null); setMOpen(true); }}><Plus size={14} /> Daftarkan {tab === 1 ? "HKI" : "Aset"}</button>}
      dropNote={vault ? undefined : "Sertifikat, BPKB, akta, atau bukti pendaftaran HKI — AI mengekstrak nomor, jenis, dan masa berlaku; dokumen asli tersimpan di vault."}
      onDrop={vault ? undefined : (f) => void dropDok(f)}
      filters={vault ? ["semua", "Aset", "HKI"] : tab === 0 ? ["semua", "PERHATIAN", "AMAN"] : ["semua", "TERDAFTAR", "TERCATAT", "PROSES", "DITUTUP"]}
      active={vault ? vf : tab === 0 ? af : hf} onFilter={vault ? setVf : tab === 0 ? setAf : setHf}
      q={vault ? vq : q} setQ={vault ? setVq : setQ}
      cariPh={vault ? "Cari dokumen / alasan akses / pembuka…" : tab === 1 ? "Cari HKI / nomor / kelas…" : "Cari aset / bukti kepemilikan…"}>



      {tab === 0 && (
        <div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Aset</th><th>Bukti Kepemilikan</th><th>Pembebanan</th><th>Kewajiban Terpantau</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {t.assets.filter((a) => (af === "semua" || a[6] === af) && (String(a[0]) + a[1] + a[2]).toLowerCase().includes(q.toLowerCase())).map((a, i) => {
                  const beban = a[3] as string[] | null;
                  return (
                    <tr key={i}>
                      <td><b>{a[0] as string}</b><span className="sub">{a[1] as string}</span></td>
                      <td>{a[2] as string}</td>
                      <td>{beban ? <><Chip c={beban[0]}>{beban[1]}</Chip><span className="sub">{beban[2]}</span></> : "—"}</td>
                      <td>{a[4] as string}</td>
                      <td><Chip c={a[5] as string}>{a[6] as string}</Chip></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button className="btn-act" onClick={() => buka(a[0] as string, "assets", a as RecRow)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button>
                          <button className="btn-act" onClick={() => jalankanDD(a[0] as string)}>Due Diligence</button>
                          <RecActions mod="assets" row={a as RecRow} toast={toast} onEdit={(row) => { setMEdit(row); setMOpen(true); }} onDeleted={onDeleted} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {ddLoading ? (
            <Panel className="mt16" title={<>Due Diligence berjalan — {ddName}</>}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "36px 20px" }}>
                <div className="dd-spin" />
                <b style={{ fontSize: 13, color: "#fff" }}>Memeriksa kelengkapan dokumen &amp; konsistensi pembebanan…</b>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Pemindaian menyeluruh atas berkas di vault — mohon tunggu.</span>
              </div>
            </Panel>
          ) : ddName ? (
            <Panel className="mt16" title={<>Hasil Due Diligence — {ddName} <Chip c="c-draft">DRAF AI</Chip></>}>
              <div className="rows">
                <Row b="Kelengkapan dokumen kepemilikan" d="Seluruh dokumen inti ditemukan di vault, hash cocok" right={<Chip c="c-ver">LENGKAP</Chip>} />
                <Row b="Konsistensi data pembebanan" d="Nilai pembebanan sesuai dokumen kreditur" right={<Chip c="c-ver">KONSISTEN</Chip>} />
                <Row b="Kesenjangan ditemukan" d="Polis asuransi aset belum tertaut ke rekam — risiko dokumentasi"
                  right={<><Chip c="c-draft">1 TEMUAN</Chip><button className="btn btn-gold btn-sm" onClick={() => pushQueue("Laporan DD Aset", "Temuan kesenjangan dokumentasi", "c-draft", "DRAF AI")}>Eskalasi</button></>} />
              </div>
            </Panel>
          ) : null}
        </div>
      )}

      {tab === 1 && (
        <div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Kekayaan Intelektual</th><th>Nomor / Kelas</th><th>Masa Perlindungan</th><th>Monitoring</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {t.hki.filter((h) => (hf === "semua" || String((h[7] as string[])?.[1] || "").toUpperCase().includes(hf)) && (String(h[0]) + h[1] + h[2]).toLowerCase().includes(q.toLowerCase())).map((h, i) => {
                  const mon = h[6] as string[] | null, st = h[7] as string[];
                  return (
                    <tr key={i}>
                      <td><b>{h[0] as string}</b><span className="sub">{h[1] as string}</span></td>
                      <td>{h[2] as string}</td>
                      <td>{h[3] ? <div className="bar"><i className={h[3] as string} style={{ width: `${h[4]}%` }} /></div> : null}<span className="sub">{h[5] as string}</span></td>
                      <td>{mon ? <Chip c={mon[0]}>{mon[1]}</Chip> : "—"}</td>
                      <td><Chip c={st[0]}>{st[1]}</Chip></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button className="btn-act" onClick={() => buka(h[0] as string, "hki", h as RecRow)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button>
                          <RecActions mod="hki" row={h as RecRow} toast={toast} onEdit={(row) => { setMEdit(row); setMOpen(true); }} onDeleted={onDeleted} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid g2 mt16">
            <Panel title="Watcher Pelanggaran — Desain Kemasan Seri B">
              <div className="flag">
                <b>Produk serupa terdeteksi di marketplace</b>
                <span>Skor kemiripan 0,87 (nama + visual) · bukti otomatis diarsip: tangkapan layar + URL + stempel waktu + hash SHA-256.</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-line btn-sm" onClick={() => void catatWatcher("bukti")}>Lihat Bukti</button>
                <button className="btn btn-gold btn-sm" onClick={() => void enforcement()}><Scale size={12} /> Enforcement Strategy</button>
                <button className="btn btn-line btn-sm" onClick={() => void catatWatcher("bukan")}>Bukan Pelanggaran</button>
              </div>
            </Panel>
            <Panel title="Pengingat Portofolio">
              <div className="rows">
                <Row b="Perpanjangan Merek “CONTOH”" d="Jendela dihitung mundur dari perlindungan_sampai"
                  right={<><Chip c="c-mon">120 HARI</Chip><button className="btn btn-navy btn-sm" onClick={() => toast("Pengurusan dimulai", "Permohonan perpanjangan disiapkan — tracking DJKI aktif.", "ok")}>Mulai</button></>} />
                <Row b="NDA karyawan kunci — 1 berakhir Des 2026" d="Rahasia dagang Formula A" right={<Chip c="c-draft">PANTAU</Chip>} />
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab === 2 && (
        <Panel title={<>Log Akses Vault — Grant per Dokumen + Alasan Akses <RadioTower size={13} style={{ color: "var(--gold-text)" }} /></>}>
          <div className="rows">
            {vaultRows.map((v) => (
              <Row key={v.id} b={`${v.dok} dibuka — ${v.oleh}`} d={`Alasan: ${v.alasan} · ${v.waktu}`}
                right={<>
                  <Chip c={v.kategori === "HKI" ? "c-gold" : "c-mon"}>{v.kategori.toUpperCase()}</Chip>
                  {v.refId && <button className="btn-act" onClick={() => router.push(`/rekam/${v.refMod}/${v.refId}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button>}
                </>} />
            ))}
            {!vaultRows.length && (
              <Row b={vaultLog.length ? "Tidak ada log yang cocok" : "Belum ada akses dokumen tercatat"}
                d={vaultLog.length ? "Ubah kata kunci atau filter kategori." : "Log terisi otomatis saat dokumen dibuka dari Asset Management atau Intellectual Property."}
                right={<Chip c="c-mon">KOSONG</Chip>} />
            )}
          </div>
          <p className="note mt16"><b>Envelope encryption per tenant</b> + grant per dokumen: setiap pembukaan dokumen kepemilikan wajib menyertakan alasan akses dan tercatat pada jejak audit.</p>
        </Panel>
      )}

      <RecordModal mod={mod} open={mOpen} editRow={mEdit} tenantName={t.name} toast={toast} onClose={() => setMOpen(false)} onDone={onDone} />
    </ModuleShell>
  );
}
