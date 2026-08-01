"use client";
/* Sekretaris Perusahaan — DB murni: SATU rekam module_records mod 'corp' per tenant
 * (jsonb: rups/dirs/meetings/cap/stat/docs). CRUD nyata per panel, persetujuan sirkuler
 * menulis DB, dokumen via dropzone ke Storage. Buka = split-panel /rekam/corp/[id]. */
import React, { useState } from "react";
import { Check, Lock, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { askConfirm, Chip, Field, Jargon, Modal, Panel, Row, Timeline } from "@/components/ui";
import { ModuleShell } from "@/components/ModuleShell";
import CorpsecPeristiwa from "@/components/views/CorpsecPeristiwa";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

const tid = () => localStorage.getItem("corplex_tid") || "";

/* Tombol hapus baris — seragam dengan gaya btn-act yang sudah dipakai modul lain. */
const BtnHapus = ({ onClick }: { onClick: () => void }) => (
  <button className="btn-act" title="Hapus baris" onClick={onClick}>Hapus</button>
);
const tglID = () => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();

/* satu definisi form per panel — baris baru masuk array jsonb terkait */
const ADD: Record<string, { title: string; fields: string[]; make: (v: string[]) => string[] }> = {
  rups: { title: "Tahapan RUPS", fields: ["Tanggal (mis. 18 MEI 2026)", "Judul tahapan", "Keterangan"], make: (v) => [v[0], v[1], v[2], "next"] },
  dirs: { title: "Pihak Sirkuler", fields: ["Nama", "Jabatan"], make: (v) => [v[0], v[1], "wait", ""] },
  meetings: { title: "Rapat Organ", fields: ["Judul rapat", "Jadwal & agenda"], make: (v) => [v[0], v[1]] },
  cap: { title: "Baris Cap Table", fields: ["Pemegang saham", "Keterangan lembar", "Persentase (mis. 60%)"], make: (v) => [v[0], v[1], v[2]] },
  stat: { title: "Kewajiban Statutori", fields: ["Kewajiban", "Keterangan/pemicu", "Tenggat (mis. 30 HARI)"], make: (v) => [v[0], v[1], "c-draft", v[2]] },
};

export default function Corpsec() {
  const { ten, toast, patchTen } = useStore();
  const t = ten!;
  const router = useRouter();
  const c = t.corp;
  const [addKey, setAddKey] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false); // satu pintu masuk manual (ganti 5 tombol + bertebaran)
  const [vals, setVals] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const done = c.dirs.filter((d) => d[2] === "ok").length;
  const allOk = c.dirs.length > 0 && done === c.dirs.length;

  /* singleton: pastikan rekam corp ada di DB, kembalikan id */
  const ensureId = async (): Promise<string | null> => {
    if (c.id) return c.id;
    const { id: _drop, ...data } = c;
    const r = await api.records.create(tid(), "corp", { ...data, entity: t.name });
    if (!r.ok) { toast("Gagal membuat rekam", r.error.message, "warn"); return null; }
    patchTen({ corp: { ...c, id: r.data.id } });
    return r.data.id;
  };

  const simpan = async (patch: Partial<typeof c>, dok?: { url: string; nama: string }) => {
    setBusy(true);
    const id = await ensureId();
    if (!id) { setBusy(false); return false; }
    const next = { ...c, id, ...patch };
    const { id: _x, ...data } = next;
    const r = await api.records.update(id, data, dok);
    setBusy(false);
    if (!r.ok) { toast("Gagal menyimpan", r.error.message, "warn"); return false; }
    patchTen({ corp: next });
    return true;
  };

  const tambahBaris = async () => {
    if (!addKey) return;
    const spec = ADD[addKey];
    if (!vals[0]?.trim()) return toast("Kolom pertama wajib diisi", spec.fields[0], "warn");
    const row = spec.make(vals.map((v) => (v || "").trim()));
    if (await simpan({ [addKey]: [...(c[addKey as "rups"] || []), row] } as Partial<typeof c>)) {
      setAddKey(null); setVals([]);
      toast(`${spec.title} tercatat`, "Tersimpan ke rekam tata kelola.", "ok");
    }
  };

  /* Hapus satu baris panel. Sebelumnya modul ini SATU-SATUNYA yang datanya tak bisa dikoreksi:
   * salah ketik atau baris kembar menetap selamanya (modul lain punya RecActions Edit/Hapus).
   * Menumpang simpan() yang sudah ada — array jsonb ditulis ulang tanpa indeks tsb. */
  const hapusBaris = async (key: keyof typeof ADD, i: number, label: string) => {
    if (!(await askConfirm(`Hapus "${label}" dari rekam tata kelola?`))) return;
    const sisa = (c[key as "rups"] || []).filter((_, j) => j !== i);
    if (await simpan({ [key]: sisa } as Partial<typeof c>)) toast("Baris dihapus", "Rekam tata kelola diperbarui.", "ok");
  };

  const setuju = async (i: number) => {
    const dirs = c.dirs.map((d, j) => (j === i ? [d[0], d[1], "ok", tglID()] : d));
    /* Dulu berbunyi "Hash tanda tangan tercatat pada rekam" — nol hash, nol tanda tangan digital
     * di jalur ini. Yang benar-benar tersimpan hanya nama, jabatan, dan tanggal persetujuan. */
    if (await simpan({ dirs })) toast(dirs.every((d) => d[2] === "ok") ? "Keputusan sirkuler SAH — 100% setuju" : "Persetujuan tercatat", `Persetujuan atas nama ${c.dirs[i]?.[0] || "pihak ini"} tercatat pada rekam beserta tanggalnya (${tglID()}).`, "ok");
  };

  const dropDok = async (file: File) => {
    const up = await api.records.uploadDoc(tid(), file);
    if (!up.ok) return toast("Gagal mengunggah", up.error.message, "warn");
    const nama = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    if (await simpan({ docs: [...c.docs, [nama, "c-ver", "TERCATAT", up.data.url]] }, up.data))
      toast("Dokumen perseroan tercatat", `${nama} — dokumen asli di vault, terbuka dari tombol Buka.`, "ok");
  };


  return (
    <ModuleShell h1="Sekretaris Perusahaan"
      sub="RUPS, keputusan pemegang saham, dan dokumen perseroan — tercatat rapi dan siap diaudit."
      dropNote="Akta, risalah RUPS, atau keputusan sirkuler — dokumen asli tersimpan di vault dan tercatat pada rekam tata kelola."
      onDrop={(f) => void dropDok(f)}
      acts={<>
        <button className="btn btn-gold" onClick={() => setPickOpen(true)}><Plus size={14} /> Tambah Data</button>
        {c.id && <button className="btn-act" onClick={() => router.push(`/rekam/corp/${c.id}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka Rekam</button>}
      </>}>

      {/* PUSAT PEMANTAUAN — objek utama modul ini sejak redesign: peristiwa korporasi. */}
      <CorpsecPeristiwa />

      {/* ARSIP — enam panel lama dipertahankan apa adanya untuk tenant yang sudah mengisinya.
        * Sengaja TIDAK dimigrasikan: isinya teks bebas yang tak dapat dipetakan otomatis ke
        * rantai keputusan→akta→pengesahan; memaksa pemetaan akan mengarang data hukum. */}
      <details open={!!(c.rups.length || c.dirs.length || c.meetings.length || c.cap.length || c.stat.length || c.docs.length)} style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".18em", color: "var(--muted)", padding: "10px 0" }}>
          ARSIP TATA KELOLA (CATATAN LAMA — TIDAK IKUT DIPANTAU TENGGATNYA)
        </summary>
      <div className="grid g-wide">
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title={<>{c.entity} · RUPS</>}>
            {c.rups.length ? <Timeline items={c.rups} onHapus={(i) => void hapusBaris("rups", i, c.rups[i][1] || c.rups[i][0])} /> :<p style={{ fontSize: 12, color: "var(--muted)" }}>Belum ada tahapan RUPS tercatat — lewat tombol Tambah Data di atas.</p>}
          </Panel>
          <Panel title={<><Jargon k="keputusan sirkuler">Keputusan Sirkuler</Jargon> — Persetujuan Elektronik <Chip c={allOk ? "c-ver" : "c-draft"}>{allOk ? `SAH — ${done}/${c.dirs.length} (100%)` : `${done} / ${c.dirs.length || 0} SETUJU`}</Chip></>}>
            <div className="rows">
              {c.dirs.map((d, i) => d[2] === "ok" ? (
                <Row key={i} b={`${d[0]} — ${d[1]}`} d={`Disetujui · tercatat ${d[3]}`}
                  right={<><Chip c="c-ver"><Check size={9} style={{ display: "inline" }} /></Chip><BtnHapus onClick={() => void hapusBaris("dirs", i, d[0])} /></>} />
              ) : (
                <Row key={i} b={`${d[0]} — ${d[1]}`} d="Menunggu persetujuan (constraint: sirkuler butuh 100%)"
                  right={<><Chip c="c-draft">MENUNGGU</Chip><button className="btn btn-navy btn-sm" disabled={busy} onClick={() => void setuju(i)}>Setujui</button><BtnHapus onClick={() => void hapusBaris("dirs", i, d[0])} /></>} />
              ))}
              {!c.dirs.length && <Row b="Belum ada pihak sirkuler" d="Tambahkan direksi/pemegang saham yang wajib menyetujui." right={<Chip c="c-mon">KOSONG</Chip>} />}
            </div>
          </Panel>
          <Panel title={<>Rapat Organ Perseroan</>}>
            <div className="rows">
              {c.meetings.map((m, i) => <Row key={i} b={m[0]} d={m[1]} right={<><Chip c="c-mon">TERJADWAL</Chip><BtnHapus onClick={() => void hapusBaris("meetings", i, m[0])} /></>} />)}
              {!c.meetings.length && <Row b="Belum ada rapat terjadwal" d="Catat rapat direksi/komisaris lewat tombol Tambah Data di atas." right={<Chip c="c-mon">KOSONG</Chip>} />}
            </div>
          </Panel>
        </div>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title={<>Cap Table</>}>
            <div className="rows">
              {c.cap.map((x, i) => <Row key={i} b={x[0]} d={x[1]} right={<><b style={{ color: "var(--ink)" }}>{x[2]}</b><BtnHapus onClick={() => void hapusBaris("cap", i, x[0])} /></>} />)}
              {/* Janji "validasi Σ=100% menyusul" dicabut — tak ada validasi jumlah persentase
                  di kode mana pun, dan menjanjikan pemeriksaan yang tak ada = klaim palsu. */}
              {!c.cap.length && <Row b="Belum ada struktur kepemilikan" d="Isi pemegang saham berikut persentasenya — jumlah persentase dihitung sendiri oleh pengguna, Corplex belum memeriksanya." right={<Chip c="c-mon">KOSONG</Chip>} />}
            </div>
          </Panel>
          <Panel title={<>Kewajiban Statutori</>}>
            <div className="rows">
              {c.stat.map((s, i) => <Row key={i} b={s[0]} d={s[1]} right={<><Chip c={s[2]}>{s[3]}</Chip><BtnHapus onClick={() => void hapusBaris("stat", i, s[0])} /></>} />)}
              {!c.stat.length && <Row b="Tidak ada kewajiban tercatat" d="Tenggat statutori (Menkumham, laporan tahunan) dicatat di sini." right={<Chip c="c-ver">BERSIH</Chip>} />}
            </div>
          </Panel>
          <Panel title="Dokumen Tata Kelola">
            <div className="rows">
              {c.docs.map((d, i) => <Row key={i} b={d[0]} right={<><Chip c={d[1]}>{d[2]}</Chip>{d[3] && c.id ? <button className="btn-act" onClick={() => router.push(`/rekam/corp/${c.id}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button> : null}</>} />)}
              {!c.docs.length && <Row b="Belum ada dokumen" d="Seret akta/risalah ke dropzone di atas — dokumen asli masuk vault." right={<Chip c="c-mon">KOSONG</Chip>} />}
            </div>
          </Panel>
        </div>
      </div>
      </details>

      {/* Satu pintu masuk: pilih jenis data → form. Dokumen asli lewat dropzone di atas. */}
      <Modal right open={pickOpen} title="Tambah Data Perseroan" onClose={() => setPickOpen(false)}>
        <p className="note" style={{ marginBottom: 12 }}>Untuk dokumen asli (akta, risalah RUPS): seret ke <b>dropzone di atas</b> — tersimpan ke vault. Untuk mencatat data terstruktur, pilih:</p>
        <div className="rows">
          {Object.entries(ADD).map(([k, s]) => (
            <Row key={k} b={s.title} d={s.fields.join(" · ")} onClick={() => { setAddKey(k); setVals([]); setPickOpen(false); }} />
          ))}
        </div>
      </Modal>

      <Modal right open={!!addKey} title={`Tambah ${addKey ? ADD[addKey].title : ""}`} onClose={() => setAddKey(null)}
        footer={<><button className="btn btn-line" onClick={() => setAddKey(null)}>Batal</button>
          <button className="btn btn-gold" disabled={busy} onClick={() => void tambahBaris()}>Simpan</button></>}>
        {addKey && ADD[addKey].fields.map((f, i) => (
          <Field key={f} label={i === 0 ? `${f} *` : f}>
            <input value={vals[i] || ""} onChange={(e) => setVals((v) => { const n = [...v]; n[i] = e.target.value; return n; })} />
          </Field>
        ))}
      </Modal>
    </ModuleShell>
  );
}
