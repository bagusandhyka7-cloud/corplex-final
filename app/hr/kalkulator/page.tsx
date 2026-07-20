"use client";
/*
 * Kalkulator Hukum — 3 panel: kategori (teks murni) · form dinamis · hasil + riwayat (DB).
 * Rumus HANYA yang dasar hukumnya pasti (PP 35/2021, UU HPP, UU 1/2023, KUHPerdata).
 * ponytail: kalkulator lain (waris, konverter pasal, daluwarsa, PPh badan/23) menyusul
 * setelah rumusnya divalidasi advokat — lebih baik kosong daripada mengarang angka hukum.
 * Riwayat perhitungan tersimpan nyata di module_records (module 'kalk').
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Scale, ChevronDown, MoreHorizontal } from "lucide-react";
import { ViewHead } from "@/components/ui";
import { fmt, useStore } from "@/lib/store";
import { api } from "@/lib/api";

type KField = { k: string; l: string; tipe: "num" | "sel" | "emp"; opts?: string[]; ph?: string; sat?: string; ops?: boolean };
type Hasil = { utama: string; rows: [string, string][] };
type Kalk = { id: string; cat: string; t: string; d: string; dasar: string; fields: KField[]; hitung: (v: Record<string, string>) => Hasil };

const num = (s?: string) => Number((s || "0").replace(/[^\d]/g, "")) || 0;

/* PP 35/2021 Pasal 40 */
const pesangonBln = (th: number) => th < 1 ? 1 : th < 2 ? 2 : th < 3 ? 3 : th < 4 ? 4 : th < 5 ? 5 : th < 6 ? 6 : th < 7 ? 7 : th < 8 ? 8 : 9;
const upmkBln = (th: number) => th < 3 ? 0 : th < 6 ? 2 : th < 9 ? 3 : th < 12 ? 4 : th < 15 ? 5 : th < 18 ? 6 : th < 21 ? 7 : th < 24 ? 8 : 10;
const ALASAN_PHK: Record<string, { p: number; u: number }> = {
  "Efisiensi (mencegah kerugian)": { p: 1, u: 1 },
  "Efisiensi (perusahaan rugi)": { p: 0.5, u: 1 },
  "Perusahaan tutup (rugi)": { p: 0.5, u: 1 },
  "Keadaan memaksa (force majeure)": { p: 0.5, u: 1 },
  "Perusahaan pailit / PKPU": { p: 0.5, u: 1 },
  "Pensiun": { p: 1.75, u: 1 },
  "Pekerja meninggal dunia": { p: 2, u: 1 },
  "Sakit berkepanjangan / cacat kerja": { p: 2, u: 1 },
  "Pelanggaran (setelah SP-3)": { p: 0.5, u: 1 },
  "Akuisisi / merger / peleburan": { p: 1, u: 1 },
  "PHK oleh pengusaha (umum)": { p: 1, u: 1 },
  "Mengundurkan diri (resign)": { p: 0, u: 0 },
};
const KUHP_DENDA: Record<string, number> = { "Kategori I": 1e6, "Kategori II": 10e6, "Kategori III": 50e6, "Kategori IV": 200e6, "Kategori V": 500e6, "Kategori VI": 2e9, "Kategori VII": 5e9, "Kategori VIII": 50e9 };

const KALK: Kalk[] = [
  {
    id: "phk", cat: "Ketenagakerjaan", t: "Pesangon PHK",
    d: "Hitung pesangon, penghargaan masa kerja, dan penggantian hak sesuai alasan PHK — biar jelas hak yang wajib dibayar, tanpa tebak-tebakan.",
    dasar: "PP No. 35 Tahun 2021 Pasal 40–57 jo. UU No. 6 Tahun 2023",
    fields: [
      { k: "emp", l: "Nama karyawan", tipe: "emp" },
      { k: "dept", l: "Departemen", tipe: "num", ph: "otomatis dari data karyawan", ops: true },
      { k: "pos", l: "Posisi", tipe: "num", ph: "otomatis dari data karyawan", ops: true },
      { k: "masa", l: "Masa kerja", tipe: "num", ph: "mis. 5", sat: "tahun" },
      { k: "upah", l: "Upah per bulan (gaji pokok + tunjangan tetap)", tipe: "num", ph: "mis. 6.000.000", sat: "Rp" },
      { k: "alasan", l: "Alasan PHK", tipe: "sel", opts: Object.keys(ALASAN_PHK) },
      { k: "uph", l: "Penggantian hak (sisa cuti dll — opsional)", tipe: "num", ph: "0", sat: "Rp", ops: true },
    ],
    hitung: (v) => {
      const th = num(v.masa), upah = num(v.upah), m = ALASAN_PHK[v.alasan] || ALASAN_PHK["PHK oleh pengusaha (umum)"];
      const pes = pesangonBln(th) * m.p, upmk = upmkBln(th) * m.u, uph = num(v.uph);
      const total = upah * (pes + upmk) + uph;
      return {
        utama: fmt(total),
        rows: [
          [`Pesangon ${pesangonBln(th)} bln × ${m.p}`, fmt(upah * pes)],
          [`Penghargaan masa kerja ${upmkBln(th)} bln × ${m.u}`, fmt(upah * upmk)],
          ["Penggantian hak", fmt(uph)],
          [v.alasan === "Mengundurkan diri (resign)" ? "Catatan" : "Alasan", v.alasan === "Mengundurkan diri (resign)" ? "resign hanya berhak uang pisah + penggantian hak" : v.alasan],
        ],
      };
    },
  },
  {
    id: "thr", cat: "Ketenagakerjaan", t: "THR",
    d: "Masa kerja 12 bulan ke atas dapat 1 bulan upah penuh; di bawah itu dihitung proporsional. Simpel, tapi sering salah hitung.",
    dasar: "PP No. 36 Tahun 2021 jo. Permenaker No. 6 Tahun 2016",
    fields: [
      { k: "emp", l: "Nama karyawan", tipe: "emp" },
      { k: "masa", l: "Masa kerja", tipe: "num", ph: "mis. 8", sat: "bulan" },
      { k: "upah", l: "Upah per bulan", tipe: "num", ph: "mis. 5.000.000", sat: "Rp" },
    ],
    hitung: (v) => {
      const m = num(v.masa), u = num(v.upah);
      const thr = m >= 12 ? u : Math.round((m / 12) * u);
      return { utama: fmt(thr), rows: [["Rumus", m >= 12 ? "1 × upah sebulan" : `${m}/12 × upah`], ["Masa kerja", `${m} bulan`]] };
    },
  },
  {
    id: "lembur", cat: "Ketenagakerjaan", t: "Upah Lembur",
    d: "Hitung upah lembur per jam (1,5×–4× upah sejam) untuk hari kerja maupun hari libur — sesuai PP 35/2021.",
    dasar: "PP No. 35 Tahun 2021 jo. Kepmenaker No. 102 Tahun 2004",
    fields: [
      { k: "emp", l: "Nama karyawan", tipe: "emp" },
      { k: "jam", l: "Jumlah jam lembur", tipe: "num", ph: "mis. 3", sat: "jam" },
      { k: "upah", l: "Upah per bulan", tipe: "num", ph: "mis. 4.000.000", sat: "Rp" },
      { k: "waktu", l: "Waktu lembur", tipe: "sel", opts: ["Hari kerja biasa", "Hari libur / istirahat mingguan"] },
    ],
    hitung: (v) => {
      const jam = num(v.jam), sejam = num(v.upah) / 173;
      let total = 0;
      const rincian: [string, string][] = [];
      if (v.waktu === "Hari kerja biasa") {
        for (let i = 1; i <= jam; i++) total += sejam * (i === 1 ? 1.5 : 2);
        rincian.push(["Jam ke-1 × 1,5", fmt(Math.min(jam, 1) * sejam * 1.5)], [`Jam ke-2 dst × 2 (${Math.max(jam - 1, 0)} jam)`, fmt(Math.max(jam - 1, 0) * sejam * 2)]);
      } else {
        for (let i = 1; i <= jam; i++) total += sejam * (i <= 8 ? 2 : i === 9 ? 3 : 4);
        rincian.push(["8 jam pertama × 2", fmt(Math.min(jam, 8) * sejam * 2)], ["Jam ke-9 × 3", fmt((jam >= 9 ? 1 : 0) * sejam * 3)], ["Jam ke-10–11 × 4", fmt(Math.max(jam - 9, 0) * sejam * 4)]);
      }
      rincian.push(["Upah sejam (1/173 × upah bulan)", fmt(sejam)]);
      return { utama: fmt(Math.round(total)), rows: rincian };
    },
  },
  {
    id: "pkwt", cat: "Ketenagakerjaan", t: "Kompensasi PKWT (Karyawan Kontrak)",
    d: "Kontrak selesai atau diputus? Karyawan PKWT berhak kompensasi proporsional masa kerjanya.",
    dasar: "PP No. 35 Tahun 2021 Pasal 15–16",
    fields: [
      { k: "emp", l: "Nama karyawan", tipe: "emp" },
      { k: "masa", l: "Masa kerja", tipe: "num", ph: "mis. 18", sat: "bulan" },
      { k: "upah", l: "Upah per bulan", tipe: "num", ph: "mis. 5.000.000", sat: "Rp" },
    ],
    hitung: (v) => {
      const m = num(v.masa), u = num(v.upah);
      const k = m < 1 ? 0 : Math.round((m / 12) * u);
      return { utama: fmt(k), rows: [["Rumus", "masa kerja/12 × upah sebulan"], ["Syarat", "minimal 1 bulan kerja terus-menerus"]] };
    },
  },
  {
    id: "pph21", cat: "Pajak", t: "Pajak Penghasilan (PPh 21)",
    d: "Hitung PPh 21 setahun dari gaji bulanan: PTKP sesuai status keluarga, lalu tarif progresif 5%–35% — sesuai UU HPP.",
    dasar: "Pasal 17 & Pasal 7 UU No. 7 Tahun 2021 (HPP)",
    fields: [
      { k: "bruto", l: "Penghasilan bruto per bulan", tipe: "num", ph: "mis. 10.000.000", sat: "Rp" },
      { k: "status", l: "Status perkawinan", tipe: "sel", opts: ["Belum kawin (TK)", "Kawin (K)"] },
      { k: "tang", l: "Jumlah tanggungan (maks 3)", tipe: "sel", opts: ["Tidak ada", "1", "2", "3"] },
      { k: "jenis", l: "Jenis penghasilan", tipe: "sel", opts: ["Karyawan/pegawai (dapat biaya jabatan 5%)", "Bukan pegawai"] },
      { k: "npwp", l: "Punya NPWP?", tipe: "sel", opts: ["Ya", "Tidak (tarif +20%)"] },
    ],
    hitung: (v) => {
      const bruto12 = num(v.bruto) * 12;
      const bj = v.jenis?.startsWith("Karyawan") ? Math.min(bruto12 * 0.05, 6_000_000) : 0;
      const ptkp = 54_000_000 + (v.status?.startsWith("Kawin") ? 4_500_000 : 0) + (v.tang === "Tidak ada" ? 0 : num(v.tang)) * 4_500_000;
      let pkp = Math.max(0, bruto12 - bj - ptkp);
      const kenaPajak = pkp;
      const lapis: [number, number][] = [[60e6, 0.05], [190e6, 0.15], [250e6, 0.25], [4.5e9, 0.3], [Infinity, 0.35]];
      let pajak = 0;
      for (const [batas, tarif] of lapis) { const kena = Math.min(pkp, batas); pajak += kena * tarif; pkp -= kena; if (pkp <= 0) break; }
      if (v.npwp?.startsWith("Tidak")) pajak *= 1.2;
      return {
        utama: `${fmt(Math.round(pajak))} / tahun`,
        rows: [["PPh per bulan", fmt(Math.round(pajak / 12))], ["Biaya jabatan", fmt(bj)], ["PTKP", fmt(ptkp)], ["PKP", fmt(kenaPajak)]],
      };
    },
  },
  {
    id: "umkm", cat: "Pajak", t: "Pajak UMKM (PPh Final 0,5%)",
    d: "Omzet UMKM sampai Rp4,8 M setahun cukup bayar PPh final 0,5% dari omzet bruto bulanan.",
    dasar: "PP No. 55 Tahun 2022",
    fields: [{ k: "omzet", l: "Omzet bruto per bulan", tipe: "num", ph: "mis. 50.000.000", sat: "Rp" }],
    hitung: (v) => ({ utama: fmt(Math.round(num(v.omzet) * 0.005)), rows: [["Tarif", "0,5% × omzet bruto"], ["Syarat", "omzet ≤ Rp4,8 M / tahun"]] }),
  },
  {
    id: "kuhp", cat: "Pidana & Lalu Lintas", t: "Denda Kategori KUHP Baru",
    d: "KUHP baru (UU 1/2023) memakai sistem kategori denda I–VIII. Pilih kategorinya, langsung tahu nominal maksimalnya.",
    dasar: "Pasal 79 UU No. 1 Tahun 2023 (KUHP Baru)",
    fields: [{ k: "kat", l: "Kategori denda", tipe: "sel", opts: Object.keys(KUHP_DENDA) }],
    hitung: (v) => ({ utama: fmt(KUHP_DENDA[v.kat] || 0), rows: [["Kategori", v.kat || "—"], ["Sifat", "nominal maksimal denda"]] }),
  },
  {
    id: "meterai", cat: "Perdata & Kontrak", t: "Bea Meterai",
    d: "Dokumen perdata bernilai di atas Rp5 juta wajib meterai Rp10.000 — satu tarif, tak peduli nilai dokumennya.",
    dasar: "UU No. 10 Tahun 2020",
    fields: [{ k: "nilai", l: "Nilai dokumen", tipe: "num", ph: "mis. 100.000.000", sat: "Rp" }],
    hitung: (v) => { const n = num(v.nilai); return { utama: n > 5_000_000 ? fmt(10_000) : "Rp 0", rows: [["Ketentuan", n > 5_000_000 ? "wajib meterai Rp10.000" : "di bawah Rp5 jt — tidak wajib"]] }; },
  },
  {
    id: "moratoir", cat: "Perdata & Kontrak", t: "Bunga Keterlambatan (Moratoir)",
    d: "Telat bayar utang perdata? Bunga moratoir 6% per tahun berjalan sejak jatuh tempo, dihitung harian.",
    dasar: "Pasal 1250 KUHPerdata jo. Lembaran Negara 1848 No. 22",
    fields: [
      { k: "pokok", l: "Pokok utang", tipe: "num", ph: "mis. 200.000.000", sat: "Rp" },
      { k: "hari", l: "Lama keterlambatan", tipe: "num", ph: "mis. 90", sat: "hari" },
    ],
    hitung: (v) => {
      const bunga = Math.round(num(v.pokok) * 0.06 * num(v.hari) / 365);
      return { utama: fmt(bunga), rows: [["Rumus", "pokok × 6%/tahun × hari/365"], ["Total tagihan", fmt(num(v.pokok) + bunga)]] };
    },
  },
];
const CATS = [...new Set(KALK.map((k) => k.cat))];

export default function KalkulatorHukum() {
  const { ten, toast } = useStore();
  const emp = ten?.emp ?? [];
  const [cur, setCur] = useState(KALK[0]);
  const [v, setV] = useState<Record<string, string>>({});
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [judulHasil, setJudulHasil] = useState(""); // judul kalkulator pemilik hasil yang tampil
  const [dasarHasil, setDasarHasil] = useState("");
  /* Riwayat menyimpan hasil UTUH (utama + rows + dasar) supaya klik = render ulang nyata dari DB. */
  const [riwayat, setRiwayat] = useState<{ id: string; t: string; utama: string; rows: [string, string][]; dasar: string }[]>([]);
  const [riwMenu, setRiwMenu] = useState<string | null>(null);
  const [empOpen, setEmpOpen] = useState(false);
  const empRef = useRef<HTMLDivElement>(null);
  const tid = () => localStorage.getItem("corplex_tid") || "";

  useEffect(() => {
    void api.records.list(tid()).then((r) => {
      if (!r.ok) return;
      setRiwayat(r.data.filter((x) => x.module === "kalk").map((x) => {
        const d = x.data as { t: string; utama?: string; hasil?: string; rows?: [string, string][]; dasar?: string };
        return { id: x.id, t: d.t, utama: d.utama ?? d.hasil ?? "—", rows: d.rows ?? [], dasar: d.dasar ?? "" };
      }));
    });
  }, []);

  useEffect(() => {
    if (!riwMenu) return;
    const h = () => setRiwMenu(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [riwMenu]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (empRef.current && !empRef.current.contains(e.target as Node)) setEmpOpen(false); };
    if (empOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [empOpen]);

  const pilih = (k: Kalk) => {
    setCur(k); setHasil(null);
    setV(Object.fromEntries(k.fields.filter((f) => f.tipe === "sel").map((f) => [f.k, f.opts![0]])));
  };

  /* Autofill dari rekam karyawan: upah (gaji pokok + tunjangan tetap) & masa kerja
   * (dari mulai_kerja) — pola sama dengan autofill departemen di form SP. */
  const pilihEmp = (nama: string) => {
    const e = emp.find((x) => x.n === nama);
    const bulan = e?.mulaiKerja ? Math.max(0, Math.floor((Date.now() - new Date(e.mulaiKerja).getTime()) / 2_629_800_000)) : null;
    setV((x) => {
      const n: Record<string, string> = { ...x, emp: nama, dept: e?.dept || "", pos: e?.j && e.j !== "—" ? e.j : "" };
      if (e?.upah) n.upah = String(Math.round(e.upah));
      if (bulan !== null) {
        // kalkulator pesangon pakai satuan TAHUN, THR & PKWT pakai BULAN
        if (cur.fields.some((f) => f.k === "masa" && f.sat === "tahun")) n.masa = String(Math.floor(bulan / 12));
        else if (cur.fields.some((f) => f.k === "masa")) n.masa = String(bulan);
      }
      return n;
    });
    setEmpOpen(false);
    if (!e?.upah) toast("Upah belum diisi", `${nama} belum punya data gaji pokok — lengkapi di Database Karyawan atau isi manual.`, "warn");
  };

  const hitung = async () => {
    const wajib = cur.fields.find((f) => !f.ops && f.tipe === "num" && !num(v[f.k]));
    if (wajib) { toast("Isian belum lengkap", `${wajib.l} wajib diisi.`, "warn"); return; }
    const h = cur.hitung(v);
    setHasil(h); setJudulHasil(cur.t); setDasarHasil(cur.dasar);
    const payload = { t: cur.t, utama: h.utama, rows: h.rows, dasar: cur.dasar };
    const r = await api.records.create(tid(), "kalk", payload);
    if (r.ok) setRiwayat((xs) => [{ id: r.data.id, ...payload }, ...xs]);
  };

  /* Klik riwayat: render ulang panel hasil dari data DB (bukan hitung ulang, bukan dummy). */
  const bukaRiwayat = (x: typeof riwayat[number]) => {
    setHasil({ utama: x.utama, rows: x.rows });
    setJudulHasil(x.t); setDasarHasil(x.dasar);
  };
  const hapusRiwayat = async (rid: string) => {
    setRiwMenu(null);
    const r = await api.records.remove(rid);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setRiwayat((xs) => xs.filter((x) => x.id !== rid));
  };

  const empList = useMemo(() => emp.map((e) => e.n), [emp]);

  return (
    <div>
      <style>{`
        .kh-wrap{display:grid;grid-template-columns:210px 1fr 250px;gap:22px;align-items:start;margin-top:26px}
        .kh-cat{font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:#5E76A8;margin:14px 0 7px}
        .kh-cat:first-child{margin-top:0}
        .kh-it{display:block;width:100%;text-align:left;background:none;border:none;padding:7px 10px;border-radius:8px;font-size:12.5px;color:var(--txt2);cursor:pointer;position:relative;transition:color .18s, transform .18s}
        .kh-it:hover{color:#fff;transform:translateX(3px)}
        .kh-it.on{color:#fff;font-weight:700;background:rgba(58,96,166,.18);transform:translateX(4px)}
        .kh-it.on::before{content:"";position:absolute;left:0;top:20%;bottom:20%;width:2.5px;border-radius:2px;background:var(--gold-bright);animation:khIn .25s ease}
        @keyframes khIn{from{transform:scaleY(0)}to{transform:scaleY(1)}}
        .kh-form{background:var(--sur);border:1px solid var(--line);border-radius:14px;padding:22px 24px}
        .kh-form h2{font-family:var(--serif);font-size:20px;color:#fff;margin:2px 0 6px}
        .kh-eyebrow{font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:var(--gold-deep)}
        .kh-desc{font-size:12.5px;color:var(--txt2);line-height:1.6;margin-bottom:8px}
        .kh-dasar{font-family:var(--mono);font-size:10px;color:var(--blue-300);margin-bottom:16px;display:block}
        .kh-f{margin-bottom:13px}
        .kh-f label{display:block;font-size:12px;font-weight:600;color:var(--txt);margin-bottom:6px}
        .kh-in{position:relative}
        .kh-in input,.kh-in select{width:100%;background:#0A1830;border:1px solid var(--line);border-radius:10px;padding:10px 13px;font-size:13px;color:#fff;outline:none}
        .kh-in input:focus,.kh-in select:focus{border-color:var(--blue-400)}
        .kh-in .sat{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted)}
        .kh-btn{width:100%;margin-top:6px;background:linear-gradient(150deg,var(--navy-600),var(--navy-800));color:#fff;border:none;border-radius:11px;padding:12px;font-size:13.5px;font-weight:700;cursor:pointer;transition:.18s}
        .kh-btn:hover{filter:brightness(1.15)}
        .kh-side{display:flex;flex-direction:column;gap:14px}
        .kh-hero{border:1px dashed var(--line2);border-radius:14px;padding:22px;text-align:center}
        .kh-hero .ic{width:44px;height:44px;border-radius:12px;background:rgba(58,96,166,.15);display:grid;place-items:center;color:var(--blue-300);margin:0 auto 10px}
        .kh-hero b{font-family:var(--serif);font-style:italic;font-size:16px;color:#fff;display:block;margin-bottom:5px}
        .kh-hero span{font-size:11.5px;color:var(--muted);line-height:1.5}
        /* Panel hasil — bahasa visual Corplex: header ikon + garis emas tipis, bukan kartu polos */
        .kh-hasil{background:linear-gradient(165deg,rgba(20,38,68,.9),rgba(11,21,40,.95));border:1px solid rgba(176,138,62,.32);border-radius:14px;padding:16px 18px 18px;position:relative;overflow:hidden}
        .kh-hasil::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--gold-bright),transparent 70%)}
        .kh-hasil-hd{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .kh-hasil-hd .ic{flex:0 0 auto;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:rgba(176,138,62,.14);border:1px solid rgba(176,138,62,.3);color:var(--gold-bright)}
        .kh-hasil-hd b{display:block;font-family:var(--serif);font-size:14px;color:#fff;margin-top:1px}
        .kh-hasil .total{font-size:24px;font-weight:800;color:var(--gold-bright);display:block;margin:2px 0 12px;letter-spacing:-.01em}
        .kh-hasil .r{display:flex;justify-content:space-between;gap:10px;font-size:11.5px;color:var(--txt2);padding:6px 0;border-top:1px solid rgba(255,255,255,.05)}
        .kh-hasil .r b{color:#fff;font-weight:600;text-align:right}
        .kh-dasar-box{margin-top:12px;font-family:var(--mono);font-size:9.5px;line-height:1.5;color:var(--blue-300);background:rgba(58,96,166,.12);border-left:2px solid var(--blue-400);border-radius:0 7px 7px 0;padding:7px 10px}
        .kh-riw{font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:#5E76A8;margin-bottom:6px}
        .kh-riw-list{max-height:186px;overflow-y:auto} /* 5 item tampil, sisanya scroll */
        .kh-riw-it{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--txt2);padding:7px 4px;border-top:1px solid rgba(255,255,255,.05);cursor:pointer;border-radius:7px;transition:.15s}
        .kh-riw-it:hover{background:rgba(58,96,166,.12);color:#fff}
        .kh-riw-it .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .kh-riw-it b{color:var(--gold-bright);white-space:nowrap;font-size:11px}
        .kh-riw-it .dots{flex:0 0 auto;background:none;border:none;color:var(--muted);padding:2px;border-radius:5px;opacity:0;transition:.15s;display:grid;place-items:center}
        .kh-riw-it:hover .dots{opacity:1}
        .kh-riw-it .dots:hover{color:#fff;background:rgba(58,96,166,.3)}
        .kh-riw-menu{position:absolute;top:28px;right:4px;background:#0E1C38;border:1px solid var(--line2);border-radius:9px;box-shadow:var(--shadow-lg);z-index:60;overflow:hidden}
        .kh-riw-menu button{display:block;width:100%;text-align:left;background:none;border:none;padding:8px 16px;font-size:11.5px;color:#F07A76;cursor:pointer}
        .kh-riw-menu button:hover{background:var(--sur-2)}
        .kh-emp{max-height:170px;overflow-y:auto} /* 5 nama tampil, sisanya scroll */
        .kh-emp button{display:block;width:100%;text-align:left;background:none;border:none;padding:8px 12px;font-size:12.5px;color:var(--txt);cursor:pointer}
        .kh-emp button:hover{background:rgba(58,96,166,.15)}
        @media(max-width:980px){.kh-wrap{grid-template-columns:1fr}}
      `}</style>

      <ViewHead h1="Kalkulator Hukum" sub="Hitung hak dan kewajiban hukum dengan rumus resmi — angka pasti, bukan perkiraan." />

      <div className="kh-wrap">
        {/* kiri: kategori teks murni */}
        <div>
          {CATS.map((c) => (
            <div key={c}>
              <div className="kh-cat">{c.toUpperCase()}</div>
              {KALK.filter((k) => k.cat === c).map((k) => (
                <button key={k.id} className={`kh-it${cur.id === k.id ? " on" : ""}`} onClick={() => pilih(k)}>{k.t}</button>
              ))}
            </div>
          ))}
        </div>

        {/* tengah: form dinamis */}
        <div className="kh-form">
          <span className="kh-eyebrow">{cur.cat.toUpperCase()}</span>
          <h2>{cur.t}</h2>
          <p className="kh-desc">{cur.d}</p>
          <span className="kh-dasar">{cur.dasar}</span>
          {cur.fields.map((f) => (
            <div className="kh-f" key={f.k}>
              <label>{f.l}{f.ops ? " (opsional)" : ""}</label>
              {f.tipe === "sel" ? (
                <div className="kh-in"><select value={v[f.k] || f.opts![0]} onChange={(e) => setV({ ...v, [f.k]: e.target.value })}>{f.opts!.map((o) => <option key={o}>{o}</option>)}</select></div>
              ) : f.tipe === "emp" ? (
                <div className="kh-in" style={{ position: "relative" }} ref={empRef}>
                  <button type="button" style={{ width: "100%", textAlign: "left", background: "#0A1830", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 13px", fontSize: 13, color: v.emp ? "#fff" : "var(--muted)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }} onClick={() => setEmpOpen((x) => !x)}>
                    {v.emp || "Pilih dari Database Karyawan…"} <ChevronDown size={13} />
                  </button>
                  {empOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#0E1C38", border: "1px solid var(--line2)", borderRadius: 10, zIndex: 50, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
                      <div className="kh-emp">
                        {emp.map((e) => (
                          <button key={e.id || e.n} onClick={() => pilihEmp(e.n)}>
                            {e.n}
                            <i style={{ fontStyle: "normal", fontSize: 10.5, color: e.upah ? "var(--gold-deep)" : "var(--muted)", marginLeft: 6 }}>
                              {e.upah ? fmt(e.upah) : "upah belum diisi"}
                            </i>
                          </button>
                        ))}
                        {!emp.length && <span style={{ display: "block", padding: "10px 12px", fontSize: 11.5, color: "var(--muted)" }}>Belum ada karyawan di database.</span>}
                      </div>
                    </div>
                  )}
                </div>
              ) : f.k === "dept" || f.k === "pos" ? (
                <div className="kh-in"><input value={v[f.k] || ""} placeholder={f.ph} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} /></div>
              ) : (
                <div className="kh-in">
                  <input inputMode="numeric" value={v[f.k] || ""} placeholder={f.ph} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} style={f.sat ? { paddingRight: 44 } : undefined} />
                  {f.sat && <span className="sat">{f.sat}</span>}
                </div>
              )}
            </div>
          ))}
          <button className="kh-btn" onClick={() => void hitung()}>Hitung Sekarang</button>
        </div>

        {/* kanan: hasil + riwayat */}
        <div className="kh-side">
          {hasil ? (
            <div className="kh-hasil">
              <div className="kh-hasil-hd">
                <span className="ic"><Scale size={15} /></span>
                <div>
                  <span className="kh-eyebrow">HASIL PERHITUNGAN</span>
                  <b>{judulHasil}</b>
                </div>
              </div>
              <span className="total">{hasil.utama}</span>
              {hasil.rows.map(([l, val], i) => <div className="r" key={i}><span>{l}</span><b>{val}</b></div>)}
              {dasarHasil && <div className="kh-dasar-box">{dasarHasil}</div>}
              <p className="note" style={{ marginTop: 10 }}>Indikatif — verifikasi advokat MRWP untuk kasus konkret.</p>
            </div>
          ) : (
            <div className="kh-hero">
              <div className="ic"><Scale size={20} /></div>
              <b>Angka pasti, bukan perkiraan.</b>
              <span>Isi form di samping — hasil, rincian pasal, dan rumusnya tampil di sini.</span>
            </div>
          )}
          <div>
            <div className="kh-riw">RIWAYAT</div>
            <div className="kh-riw-list">
              {riwayat.map((r) => (
                <div className="kh-riw-it" key={r.id} onClick={() => bukaRiwayat(r)}>
                  <span className="nm">{r.t}</span>
                  <b>{r.utama}</b>
                  <button className="dots" onClick={(e) => { e.stopPropagation(); setRiwMenu(riwMenu === r.id ? null : r.id); }} aria-label="Opsi riwayat"><MoreHorizontal size={13} /></button>
                  {riwMenu === r.id && (
                    <div className="kh-riw-menu" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => void hapusRiwayat(r.id)}>Hapus</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!riwayat.length && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Belum ada perhitungan.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
