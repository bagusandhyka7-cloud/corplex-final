"use client";
/* Dashboard Employment — SEMUA angka dihitung dari rekam employees DB (nol dummy).
 * Daftar provinsi/kota >5 item = scrollable (tanpa "lihat selengkapnya"). */
import React, { useEffect, useState } from "react";
import { ViewHead } from "@/components/ui";
import { useStore } from "@/lib/store";
import { api, AttRow } from "@/lib/api";
import { Users, FileText, Globe, ShieldCheck, MapPin, GraduationCap, CalendarClock, Briefcase, Award, ShieldAlert } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

const BLUE = "#5F84C4";
const TIP = { backgroundColor: "#0A1830", borderColor: "rgba(255,255,255,0.1)", color: "#fff", fontSize: "12px", borderRadius: "8px" } as const;
const card: React.CSSProperties = { background: "var(--sur)", border: "1px solid var(--line)", borderRadius: "14px", padding: "20px", overflow: "hidden" };
const hd: React.CSSProperties = { fontSize: "12.5px", fontWeight: 700, color: "#fff", letterSpacing: ".08em", marginBottom: 4, display: "flex", alignItems: "center", gap: 7 };
const sub: React.CSSProperties = { fontSize: "10.5px", color: "var(--muted)", marginBottom: 14 };

const umurDari = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso); if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 31_557_600_000);
};
const hitung = <T,>(xs: T[], key: (x: T) => string | undefined) =>
  Object.entries(xs.reduce<Record<string, number>>((a, x) => { const k = key(x); if (k) a[k] = (a[k] || 0) + 1; return a; }, {}))
    .map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

/* Daftar tabel — >5 baris otomatis scroll. */
function Daftar({ rows, total }: { rows: { name: string; total: number }[]; total: number }) {
  return (
    <div style={{ maxHeight: rows.length > 5 ? 168 : undefined, overflowY: rows.length > 5 ? "auto" : undefined, marginTop: 8 }}>
      <table style={{ width: "100%", fontSize: 12, color: "var(--txt2)" }}>
        <tbody>
          {rows.map((p) => (
            <tr key={p.name} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <td style={{ padding: "6px 4px" }}>{p.name}</td>
              <td style={{ padding: "6px 4px", textAlign: "right", color: "#fff", fontWeight: 600 }}>{p.total}</td>
              <td style={{ padding: "6px 4px", textAlign: "right", color: "var(--muted)", width: 48 }}>{total ? Math.round((p.total / total) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Bar recharts (bentuk asli) — animasi bawaan recharts saat mount. */
function BarPanel({ title, icon, note, rows, total }: { title: string; icon: React.ReactNode; note: string; rows: { name: string; total: number }[]; total: number }) {
  return (
    <div style={card}>
      <h4 style={hd}>{icon} {title}</h4>
      <p style={sub}>{note}</p>
      {rows.length ? (
        <>
          <ResponsiveContainer width="100%" height={Math.min(5, rows.length) * 38 + 30}>
            <BarChart data={rows.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={96} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.length > 13 ? v.slice(0, 12) + "…" : v} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.02)" }} contentStyle={TIP} itemStyle={{ color: "var(--gold-bright)" }} formatter={(v) => [`${v} karyawan`, "Jumlah"]} />
              <Bar dataKey="total" fill="var(--gold-bright)" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
          <Daftar rows={rows} total={total} />
        </>
      ) : <p style={{ fontSize: 12, color: "var(--muted)" }}>Belum ada data — lengkapi biodata karyawan di Database Karyawan.</p>}
    </div>
  );
}

export default function HRDashboard() {
  const { ten } = useStore();
  const emp = ten?.emp ?? [];
  const [att, setAtt] = useState<AttRow[]>([]);
  const [spRows, setSpRows] = useState<{ nama: string; tingkat: string }[]>([]);

  /* Eskalasi data Employment: absensi (tabel attendance) + SP (module_records 'sp') */
  useEffect(() => {
    const tid = localStorage.getItem("corplex_tid") || "";
    if (!tid) return;
    void api.attendance.list(tid).then((r) => { if (r.ok) setAtt(r.data); });
    void api.records.list(tid).then((r) => {
      if (r.ok) setSpRows(r.data.filter((x) => x.module === "sp").map((x) => x.data as { nama: string; tingkat: string }));
    });
  }, []);

  /* Karyawan paling rajin: total hadir tertinggi, alpha jadi pengurang. */
  const rajin = Object.values(att.reduce<Record<string, { name: string; total: number; alpha: number }>>((a, r) => {
    const nama = emp.find((e) => e.id === r.employee_id)?.n;
    if (!nama) return a;
    a[r.employee_id] ||= { name: nama, total: 0, alpha: 0 };
    a[r.employee_id].total += r.hadir; a[r.employee_id].alpha += r.alpha;
    return a;
  }, {})).map((x) => ({ name: x.name, total: Math.max(0, x.total - x.alpha) })).sort((a, b) => b.total - a.total);

  const penerimaSP = hitung(spRows, (s) => s.nama);

  const nP = emp.filter((e) => e.jk === "P").length;
  const nTKA = emp.filter((e) => e.wn === "TKA").length;
  const nPKWT = emp.filter((e) => e.s === "PKWT").length;
  const nLokal = emp.filter((e) => e.lok).length;

  const byProv = hitung(emp, (e) => e.prov);
  const byKota = hitung(emp, (e) => e.kota);
  const byPend = hitung(emp, (e) => e.pend);
  const byDept = hitung(emp, (e) => e.dept || (e.j !== "—" ? e.j : undefined));
  const byUmur = hitung(emp, (e) => {
    const u = umurDari(e.lahir); if (u === null) return undefined;
    return u < 25 ? "< 25 th" : u < 35 ? "25–34 th" : u < 45 ? "35–44 th" : u < 55 ? "45–54 th" : "≥ 55 th";
  });

  const domData = [{ name: "Lokal", value: nLokal }, { name: "Non-Lokal", value: emp.length - nLokal }];
  const wnData = [{ name: "TKI", value: emp.length - nTKA }, { name: "TKA", value: nTKA }];
  const genderData = [{ name: "Laki-laki", value: emp.length - nP }, { name: "Perempuan", value: nP }];
  const kontrakData = [{ name: "PKWTT", value: emp.length - nPKWT }, { name: "PKWT", value: nPKWT }];

  const PiePanel = ({ title, data, colors }: { title: string; data: { name: string; value: number }[]; colors: string[] }) => (
    <div style={card}>
      <h4 style={{ ...hd, justifyContent: "center" }}>{title}</h4>
      {emp.length ? (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} innerRadius={62} outerRadius={78} paddingAngle={5} dataKey="value" stroke="none">
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip contentStyle={TIP} itemStyle={{ color: "#fff" }} />
            <Legend wrapperStyle={{ fontSize: "11px", color: "var(--txt2)" }} />
          </PieChart>
        </ResponsiveContainer>
      ) : <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>Belum ada data.</p>}
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <ViewHead h1="Dashboard Ketenagakerjaan" sub="Komposisi & demografi tenaga kerja dari rekam Database Karyawan — status kelokalan, kewarganegaraan (TKI/TKA), jenis kelamin, kontrak (PKWT/PKWTT), domisili, umur, pendidikan, departemen, kehadiran, dan surat peringatan. Seluruh angka dihitung langsung dari data karyawan, nol data contoh." />

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        {[
          { title: "Total Karyawan", value: emp.length, icon: <Users size={18} /> },
          { title: "Total PKWT", value: nPKWT, icon: <FileText size={18} /> },
          { title: "Tenaga Kerja Asing", value: nTKA, icon: <Globe size={18} /> },
          { title: "Lokal Setempat", value: nLokal, icon: <ShieldCheck size={18} /> },
        ].map((k, i) => (
          <div key={i} style={{ ...card, padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>{k.title}</span>
              <span style={{ fontSize: "26px", fontWeight: 800, color: "#fff" }}>{k.value}</span>
            </div>
            <span style={{ color: "var(--gold-bright)", opacity: 0.8 }}>{k.icon}</span>
          </div>
        ))}
      </div>

      {/* Status kelokalan · kewarganegaraan · gender · kontrak — 1 baris sejajar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "14px" }}>
        <PiePanel title="STATUS KELOKALAN" data={domData} colors={[BLUE, "var(--gold-bright)"]} />
        <PiePanel title="STATUS KEWARGANEGARAAN" data={wnData} colors={["var(--gold-bright)", BLUE]} />
        <PiePanel title="RASIO JENIS KELAMIN" data={genderData} colors={["var(--gold-bright)", BLUE]} />
        <PiePanel title="STATUS KONTRAK" data={kontrakData} colors={[BLUE, "var(--gold-bright)"]} />
      </div>

      {/* Domisili: provinsi + kota (baru) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px", marginBottom: "14px" }}>
        <BarPanel title="DOMISILI PER PROVINSI" icon={<MapPin size={13} style={{ color: "var(--gold-bright)" }} />}
          note="Dihitung dari biodata domisili tiap karyawan." rows={byProv} total={emp.length} />
        <BarPanel title="KOTA DOMISILI TERBANYAK" icon={<MapPin size={13} style={{ color: "var(--gold-bright)" }} />}
          note="Sebaran kabupaten/kota domisili karyawan." rows={byKota} total={emp.length} />
      </div>

      {/* Metrik HR: umur · pendidikan · departemen/posisi */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px" }}>
        <BarPanel title="DEMOGRAFI UMUR" icon={<CalendarClock size={13} style={{ color: "var(--gold-bright)" }} />}
          note="Kelompok umur dari tanggal lahir karyawan." rows={byUmur} total={emp.length} />
        <BarPanel title="PENDIDIKAN TERAKHIR" icon={<GraduationCap size={13} style={{ color: "var(--gold-bright)" }} />}
          note="SD s.d. S3 — dari biodata pendidikan." rows={byPend} total={emp.length} />
        <BarPanel title="DEPARTEMEN / POSISI" icon={<Briefcase size={13} style={{ color: "var(--gold-bright)" }} />}
          note="Sebaran departemen (fallback: jabatan)." rows={byDept} total={emp.length} />
      </div>

      {/* Eskalasi rekam Employment: kehadiran + surat peringatan */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px", marginTop: "14px" }}>
        <BarPanel title="KARYAWAN PALING RAJIN" icon={<Award size={13} style={{ color: "var(--gold-bright)" }} />}
          note="Peringkat hari hadir dikurangi alpha — dari rekap kehadiran di profil karyawan."
          rows={rajin} total={rajin.reduce((s, r) => s + r.total, 0)} />
        <BarPanel title="PENERIMA SP TERBANYAK" icon={<ShieldAlert size={13} style={{ color: "var(--gold-bright)" }} />}
          note="Jumlah surat peringatan tercatat per karyawan."
          rows={penerimaSP} total={spRows.length} />
      </div>
    </div>
  );
}
