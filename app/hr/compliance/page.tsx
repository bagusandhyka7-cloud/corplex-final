"use client";
/* Kepatuhan Ketenagakerjaan — NOL DUMMY.
 * Semua angka dihitung langsung dari rekam nyata: employees (Supabase) + SP (module_records 'sp').
 * Audit yang belum punya sumber data (mis. upah vs UMK) TIDAK ditampilkan — bukan diarang. */
import React, { useEffect, useMemo, useState } from "react";
import { Chip, Panel, Row, ViewHead } from "@/components/ui";
import { fmt, useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Scale, ShieldCheck } from "lucide-react";

type SPRec = { nama: string; tingkat: string; alasan: string; tgl: string };

export default function Compliance() {
  const { ten, toast, pushQueue } = useStore();
  const emp = ten?.emp ?? [];
  const [sp, setSp] = useState<SPRec[]>([]);

  useEffect(() => {
    const tid = localStorage.getItem("corplex_tid") || "";
    if (!tid) return;
    void api.records.list(tid).then((r) => {
      if (r.ok) setSp(r.data.filter((x) => x.module === "sp").map((x) => x.data as SPRec));
    });
  }, []);

  /* Kompensasi PKWT — PP 35/2021 Pasal 15: (masa kerja bulan / 12) × upah sebulan.
   * Masa kerja dari kolom `mulai_kerja`; upah = gaji pokok + tunjangan tetap (kolom generated).
   * Karyawan tanpa salah satu data TIDAK dikarang nominalnya — ditandai "data belum lengkap". */
  const pkwt = useMemo(() => emp.filter((e) => e.s === "PKWT").map((e) => {
    const upah = e.upah ?? 0;
    const bulan = e.mulaiKerja
      ? Math.max(0, Math.floor((Date.now() - new Date(e.mulaiKerja).getTime()) / 2_629_800_000))
      : null;
    const lengkap = upah > 0 && bulan !== null;
    return { e, upah, bulan, lengkap, komp: lengkap ? Math.round((bulan! / 12) * upah) : null };
  }), [emp]);
  const totalKomp = pkwt.reduce((s, x) => s + (x.komp || 0), 0);
  const belumLengkap = pkwt.filter((x) => !x.lengkap).length;

  const audit = useMemo(() => {
    const tanpaDok = emp.filter((e) => !e.dokUrl && !e.dok);
    const tanpaBpjs = emp.filter((e) => !e.bpjsKes || !e.bpjsTk);
    const tanpaNik = emp.filter((e) => !e.nik);
    const spBanyak = Object.entries(sp.reduce<Record<string, number>>((a, s) => { a[s.nama] = (a[s.nama] || 0) + 1; return a; }, {})).filter(([, n]) => n >= 2);
    return [
      { b: "Perjanjian kerja tertaut dokumen", d: `${emp.length - tanpaDok.length}/${emp.length} karyawan punya dokumen kerja di vault`, ok: tanpaDok.length === 0, sisa: tanpaDok.length },
      { b: "Kepesertaan BPJS lengkap", d: `${emp.length - tanpaBpjs.length}/${emp.length} karyawan punya BPJS Kesehatan & Ketenagakerjaan`, ok: tanpaBpjs.length === 0, sisa: tanpaBpjs.length },
      { b: "Identitas NIK tercatat", d: `${emp.length - tanpaNik.length}/${emp.length} karyawan punya NIK KTP pada rekam`, ok: tanpaNik.length === 0, sisa: tanpaNik.length },
      { b: "Karyawan dengan SP berulang", d: spBanyak.length ? `${spBanyak.map(([n, c]) => `${n} (${c} SP)`).join(", ")} — pantau eskalasi berjenjang` : "Tidak ada karyawan dengan 2 SP atau lebih", ok: spBanyak.length === 0, sisa: spBanyak.length },
    ];
  }, [emp, sp]);

  const skor = audit.length ? Math.round((audit.filter((a) => a.ok).length / audit.length) * 100) : 0;

  return (
    <div>
      <ViewHead h1="Kepatuhan Ketenagakerjaan" sub="Audit kepatuhan dihitung langsung dari rekam karyawan dan surat peringatan." />

      {!emp.length ? (
        <Panel title="Belum Ada Rekam Karyawan">
          <p className="note">Audit kepatuhan aktif setelah ada karyawan di database. Tambahkan lewat <b>Database Karyawan</b>.</p>
        </Panel>
      ) : (
        <>
          <div className="grid g4 mb16">
            <div className="kpi"><b>{skor}%</b><span>Skor kepatuhan</span></div>
            <div className="kpi"><b>{emp.length}</b><span>Karyawan diaudit</span></div>
            <div className="kpi"><b style={{ fontSize: 20 }}>{fmt(totalKomp)}</b><span>Estimasi kewajiban kompensasi PKWT</span></div>
            <div className="kpi"><b>{sp.length}</b><span>Surat peringatan tercatat</span></div>
          </div>

          <Panel title={`Estimasi Kewajiban Kompensasi PKWT — ${pkwt.length} karyawan`}>
            {pkwt.length ? (
              <>
                <div className="tblwrap"><table style={{ minWidth: 0 }}>
                  <thead><tr><th>Karyawan</th><th>Departemen</th><th>Upah/bulan</th><th>Masa Kerja</th><th>Estimasi Kompensasi</th></tr></thead>
                  <tbody>
                    {pkwt.map(({ e, upah, bulan, lengkap, komp }) => (
                      <tr key={e.id}>
                        <td><b>{e.n}</b></td>
                        <td>{e.dept || "—"}</td>
                        <td>{upah > 0 ? fmt(upah) : <span style={{ color: "var(--muted)" }}>belum diisi</span>}</td>
                        <td>{bulan !== null ? `${bulan} bulan` : <span style={{ color: "var(--muted)" }}>tgl mulai kosong</span>}</td>
                        <td>{lengkap ? <b style={{ color: "var(--gold-deep)" }}>{fmt(komp!)}</b> : <Chip c="c-draft">DATA BELUM LENGKAP</Chip>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr>
                    <td colSpan={4} style={{ fontWeight: 700, color: "var(--ink)" }}>TOTAL ESTIMASI KEWAJIBAN</td>
                    <td style={{ fontWeight: 700, color: "var(--gold-deep)" }}>{fmt(totalKomp)}</td>
                  </tr></tfoot>
                </table></div>
                <div style={{ display: "flex", gap: 9, marginTop: 14, flexWrap: "wrap" }}>
                  <button className="btn btn-gold btn-sm" onClick={() => pushQueue(`Rekap kompensasi ${pkwt.length} PKWT — ${fmt(totalKomp)}`, "Dari Kepatuhan Ketenagakerjaan · dihitung dari upah & masa kerja rekam", "c-draft", "DRAF AI")}><Scale size={12} /> Ajukan Verifikasi</button>
                </div>
                <p className="note mt16">
                  Rumus PP 35/2021 Pasal 15: <b>(masa kerja bulan ÷ 12) × upah sebulan</b>; upah = gaji pokok + tunjangan tetap.
                  {belumLengkap > 0 && <> <b style={{ color: "var(--gold-bright)" }}>{belumLengkap} karyawan belum masuk hitungan</b> — lengkapi upah &amp; tanggal mulai kerja di Database Karyawan.</>}
                </p>
              </>
            ) : <p className="note">Tidak ada karyawan PKWT — kewajiban kompensasi nihil.</p>}
          </Panel>

          <div className="grid g2" style={{ marginTop: 16 }}>
            <Panel title="Audit Kepatuhan — Dihitung dari Rekam">
              <div className="rows">
                {audit.map((a, i) => (
                  <Row key={i} b={a.b} d={a.d} right={<Chip c={a.ok ? "c-ver" : "c-draft"}>{a.ok ? "LOLOS" : `${a.sisa} PERBAIKI`}</Chip>} />
                ))}
              </div>
              <p className="note mt16">Skor {skor}% = {audit.filter((a) => a.ok).length} dari {audit.length} butir audit lolos. Butir bertambah otomatis saat modul lain terisi.</p>
            </Panel>

            <Panel title="Surat Peringatan Tercatat">
              <div className="rows">
                {sp.slice(0, 8).map((s, i) => (
                  <Row key={i} b={`${s.tingkat} — ${s.nama}`} d={`${s.alasan} · ${s.tgl}`}
                    right={<Chip c={s.tingkat === "SP3" ? "c-red" : s.tingkat === "SP2" ? "c-draft" : "c-mon"}>{s.tingkat}</Chip>} />
                ))}
                {!sp.length && <Row b="Rekam SP bersih" d="Belum ada surat peringatan diterbitkan." right={<Chip c="c-ver"><ShieldCheck size={11} style={{ display: "inline", marginRight: 4 }} />BERSIH</Chip>} />}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
