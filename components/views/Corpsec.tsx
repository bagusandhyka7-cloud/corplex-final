"use client";
/* Sekretaris Perusahaan — DB murni: SATU rekam module_records mod 'corp' per tenant
 * (jsonb: rups/dirs/meetings/cap/stat/docs). CRUD nyata per panel, persetujuan sirkuler
 * menulis DB, dokumen via dropzone ke Storage. Buka = split-panel /rekam/corp/[id]. */
import React, { useState } from "react";
import { Check, Lock, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { askConfirm, Batas, Chip, Field, Modal, Panel, Row } from "@/components/ui";
import { ModuleShell } from "@/components/ModuleShell";
import CorpsecPeristiwa, { FILTER_PERISTIWA, IkhtisarKorporasi } from "@/components/views/CorpsecPeristiwa";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

const tid = () => localStorage.getItem("corplex_tid") || "";

/* Tombol hapus baris — seragam dengan gaya btn-act yang sudah dipakai modul lain. */
const BtnHapus = ({ onClick }: { onClick: () => void }) => (
  <button className="btn-act" title="Hapus baris" onClick={onClick}>Hapus</button>
);
const tglID = () => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();

/* satu definisi form per panel — baris baru masuk array jsonb terkait */
/* Tinggal dua: RUPS, keputusan sirkuler, dan rapat organ kini dicatat sebagai PERISTIWA
 * korporasi (lihat CorpsecPeristiwa) — menyediakan dua pintu untuk hal yang sama justru
 * memecah riwayat perusahaan ke dua tempat yang tak saling tahu. */
const ADD: Record<string, { title: string; fields: string[]; make: (v: string[]) => string[] }> = {
  cap: { title: "Baris Struktur Kepemilikan", fields: ["Pemegang saham", "Keterangan lembar", "Persentase (mis. 60%)"], make: (v) => [v[0], v[1], v[2]] },
  stat: { title: "Kewajiban Statutori", fields: ["Kewajiban", "Keterangan/pemicu", "Tenggat (mis. 30 HARI)"], make: (v) => [v[0], v[1], "c-draft", v[2]] },
};

export default function Corpsec() {
  const { ten, toast, patchTen } = useStore();
  const t = ten!;
  const router = useRouter();
  const c = t.corp;
  const [addKey, setAddKey] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false); // satu pintu masuk manual (ganti 5 tombol + bertebaran)
  /* Tapis & cari peristiwa dipegang di sini karena UI-nya milik ModuleShell (seragam semua modul). */
  const [fEv, setFEv] = useState("semua");
  const [qEv, setQEv] = useState("");
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
      kpi={<IkhtisarKorporasi />}
      filters={FILTER_PERISTIWA} active={fEv} onFilter={setFEv}
      q={qEv} setQ={setQEv} cariPh="Cari peristiwa / nomor akta / nomor pengesahan…"
      acts={<>
        <button className="btn btn-gold" onClick={() => setPickOpen(true)}><Plus size={14} /> Tambah Data</button>
        {c.id && <button className="btn-act" onClick={() => router.push(`/rekam/corp/${c.id}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka Rekam</button>}
      </>}>

      {/* PUSAT PEMANTAUAN — objek utama modul ini sejak redesign: peristiwa korporasi.
        * Dokumen Tata Kelola menyambung kolom kanan (mengisi ruang di sisi garis waktu),
        * sedangkan kepemilikan & kewajiban statutori memanjang penuh di bawah dua kolom —
        * keduanya tabel pendek yang sesak bila dipaksa masuk kolom sempit. */}
      <CorpsecPeristiwa filter={fEv} q={qEv}
        kananBawah={
          <Panel title="Dokumen Tata Kelola">
            <Batas className="rows">
              {c.docs.map((d, i) => <Row key={i} b={d[0]} right={<><Chip c={d[1]}>{d[2]}</Chip>{d[3] && c.id ? <button className="btn-act" onClick={() => router.push(`/rekam/corp/${c.id}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button> : null}</>} />)}
              {!c.docs.length && <Row b="Belum ada dokumen" d="Seret akta/risalah ke dropzone di atas — dokumen asli masuk vault." right={<Chip c="c-mon">KOSONG</Chip>} />}
            </Batas>
          </Panel>
        }
        bawah={<>
          <Panel title={<>Struktur Kepemilikan (Cap Table)</>}>
            <Batas className="rows">
              {c.cap.map((x, i) => <Row key={i} b={x[0]} d={x[1]} right={<><b style={{ color: "var(--ink)" }}>{x[2]}</b><BtnHapus onClick={() => void hapusBaris("cap", i, x[0])} /></>} />)}
              {/* Janji "validasi Σ=100% menyusul" dicabut — tak ada validasi jumlah persentase
                  di kode mana pun, dan menjanjikan pemeriksaan yang tak ada = klaim palsu. */}
              {!c.cap.length && <Row b="Belum ada struktur kepemilikan" d="Isi pemegang saham berikut persentasenya — jumlah persentase dihitung sendiri oleh pengguna, Corplex belum memeriksanya." right={<Chip c="c-mon">KOSONG</Chip>} />}
            </Batas>
          </Panel>
          <Panel title={<>Kewajiban Statutori</>}>
            <Batas className="rows">
              {c.stat.map((s, i) => <Row key={i} b={s[0]} d={s[1]} right={<><Chip c={s[2]}>{s[3]}</Chip><BtnHapus onClick={() => void hapusBaris("stat", i, s[0])} /></>} />)}
              {!c.stat.length && <Row b="Tidak ada kewajiban tercatat" d="Tenggat statutori (Menkumham, laporan tahunan) dicatat di sini." right={<Chip c="c-ver">BERSIH</Chip>} />}
            </Batas>
          </Panel>
        </>} />

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
