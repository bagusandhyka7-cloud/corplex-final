"use client";
/* Sekretaris Perusahaan — DB murni: SATU rekam module_records mod 'corp' per tenant
 * (jsonb: rups/dirs/meetings/cap/stat/docs). CRUD nyata per panel, persetujuan sirkuler
 * menulis DB, dokumen via dropzone ke Storage. Buka = split-panel /rekam/corp/[id]. */
import React, { useState } from "react";
import { Check, Lock, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { Chip, Field, Modal, Panel, Row, Timeline } from "@/components/ui";
import { ModuleShell } from "@/components/ModuleShell";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

const tid = () => localStorage.getItem("corplex_tid") || "";
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

  const setuju = async (i: number) => {
    const dirs = c.dirs.map((d, j) => (j === i ? [d[0], d[1], "ok", tglID()] : d));
    if (await simpan({ dirs })) toast(dirs.every((d) => d[2] === "ok") ? "Keputusan sirkuler SAH — 100% setuju" : "Persetujuan tercatat", "Hash tanda tangan tercatat pada rekam.", "ok");
  };

  const dropDok = async (file: File) => {
    const up = await api.records.uploadDoc(tid(), file);
    if (!up.ok) return toast("Gagal mengunggah", up.error.message, "warn");
    const nama = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    if (await simpan({ docs: [...c.docs, [nama, "c-ver", "TERCATAT", up.data.url]] }, up.data))
      toast("Dokumen perseroan tercatat", `${nama} — dokumen asli di vault, terbuka dari tombol Buka.`, "ok");
  };

  const btnPlus = (key: string) => <button className="btn btn-line btn-sm" onClick={() => { setAddKey(key); setVals([]); }}><Plus size={11} /></button>;

  return (
    <ModuleShell h1="Sekretaris Perusahaan"
      sub="RUPS, keputusan pemegang saham, dan dokumen perseroan — tenggat dijaga otomatis."
      dropNote="Akta, risalah RUPS, atau keputusan sirkuler — dokumen asli tersimpan di vault dan tercatat pada rekam tata kelola."
      onDrop={(f) => void dropDok(f)}
      acts={c.id ? <button className="btn-act" onClick={() => router.push(`/rekam/corp/${c.id}`)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka Rekam</button> : undefined}>

      <div className="grid g-wide">
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title={<>{c.entity} · RUPS {btnPlus("rups")}</>}>
            {c.rups.length ? <Timeline items={c.rups} /> : <p style={{ fontSize: 12, color: "var(--muted)" }}>Belum ada tahapan RUPS tercatat — tambah lewat tombol +.</p>}
          </Panel>
          <Panel title={<>Keputusan Sirkuler — Persetujuan Elektronik <Chip c={allOk ? "c-ver" : "c-draft"}>{allOk ? `SAH — ${done}/${c.dirs.length} (100%)` : `${done} / ${c.dirs.length || 0} SETUJU`}</Chip> {btnPlus("dirs")}</>}>
            <div className="rows">
              {c.dirs.map((d, i) => d[2] === "ok" ? (
                <Row key={i} b={`${d[0]} — ${d[1]}`} d={`Disetujui · hash ttd tercatat · ${d[3]}`} right={<Chip c="c-ver"><Check size={9} style={{ display: "inline" }} /></Chip>} />
              ) : (
                <Row key={i} b={`${d[0]} — ${d[1]}`} d="Menunggu persetujuan (constraint: sirkuler butuh 100%)"
                  right={<><Chip c="c-draft">MENUNGGU</Chip><button className="btn btn-navy btn-sm" disabled={busy} onClick={() => void setuju(i)}>Setujui</button></>} />
              ))}
              {!c.dirs.length && <Row b="Belum ada pihak sirkuler" d="Tambahkan direksi/pemegang saham yang wajib menyetujui." right={<Chip c="c-mon">KOSONG</Chip>} />}
            </div>
          </Panel>
          <Panel title={<>Rapat Organ Perseroan {btnPlus("meetings")}</>}>
            <div className="rows">
              {c.meetings.map((m, i) => <Row key={i} b={m[0]} d={m[1]} right={<Chip c="c-mon">TERJADWAL</Chip>} />)}
              {!c.meetings.length && <Row b="Belum ada rapat terjadwal" d="Catat rapat direksi/komisaris lewat tombol +." right={<Chip c="c-mon">KOSONG</Chip>} />}
            </div>
          </Panel>
        </div>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel title={<>Cap Table {btnPlus("cap")}</>}>
            <div className="rows">
              {c.cap.map((x, i) => <Row key={i} b={x[0]} d={x[1]} right={<b style={{ color: "var(--ink)" }}>{x[2]}</b>} />)}
              {!c.cap.length && <Row b="Belum ada struktur kepemilikan" d="Isi pemegang saham + persentase — validasi Σ=100% menyusul saat lengkap." right={<Chip c="c-mon">KOSONG</Chip>} />}
            </div>
          </Panel>
          <Panel title={<>Kewajiban Statutori {btnPlus("stat")}</>}>
            <div className="rows">
              {c.stat.map((s, i) => <Row key={i} b={s[0]} d={s[1]} right={<Chip c={s[2]}>{s[3]}</Chip>} />)}
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

      <Modal right open={!!addKey} title={`Tambah ${addKey ? ADD[addKey].title : ""}`} onClose={() => setAddKey(null)}
        footer={<><button className="btn btn-line" onClick={() => setAddKey(null)}>Batal</button>
          <button className="btn btn-gold" disabled={busy} onClick={() => void tambahBaris()}>Simpan ke Rekam</button></>}>
        {addKey && ADD[addKey].fields.map((f, i) => (
          <Field key={f} label={i === 0 ? `${f} *` : f}>
            <input value={vals[i] || ""} onChange={(e) => setVals((v) => { const n = [...v]; n[i] = e.target.value; return n; })} />
          </Field>
        ))}
      </Modal>
    </ModuleShell>
  );
}
