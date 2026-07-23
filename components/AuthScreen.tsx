"use client";
import React, { useEffect, useState } from "react";
import { Building2, ChevronDown, Eye, EyeOff, Lock, Mail, Paperclip, ShieldCheck, User } from "lucide-react";
import { ACCOUNTS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { api, withRetry } from "@/lib/api";
import { sb } from "@/lib/supabase";
import { useAsyncAction } from "@/lib/hooks";
import { useRouter } from "next/navigation";

const BIDANG = [
  "Industri Pangan Olahan", "Perdagangan & Distribusi", "Konstruksi & Properti",
  "Teknologi & Digital", "Jasa Keuangan", "Logistik & Transportasi",
  "Pertambangan & Energi", "Agrikultur & Perkebunan", "Kesehatan & Farmasi", "Lainnya",
];

const DOKUMEN = [
  { key: "nib", label: "NIB / OSS" },
  { key: "akta", label: "Akta Pendirian" },
  { key: "npwp", label: "NPWP Perusahaan" },
] as const;

const MAX_MB = 5;

type Mode = "login" | "daftar" | "demo";

/* Teks panel kiri per-mode. Kartu mode "daftar" = langkah NYATA wizard (4 langkah diringkas jadi 3
 * kelompok); mode lain menampilkan tiga fungsi inti Corplex — bukan data karangan. */
const KIRI: Record<Mode, { judul: React.ReactNode; lead: string; kartu: string[] }> = {
  login: {
    judul: <>Rekam hukum<br />yang tak pernah<br />lengah</>,
    lead: "Masuk untuk melanjutkan pengelolaan dokumen, izin, dan perkara perusahaan Anda.",
    kartu: ["Catat setiap rekam legal", "Jaga tenggat sebelum lewat", "Jamin lewat advokat MRWP"],
  },
  daftar: {
    judul: <>Tiga langkah<br />menuju portal<br />Anda</>,
    lead: "Lengkapi data perusahaan, lalu tim MRWP meninjau sebelum akses diaktifkan.",
    kartu: ["Verifikasi kode undangan", "Buat akun & data perusahaan", "Unggah dokumen legalitas"],
  },
  demo: {
    judul: <>Lihat dulu,<br />putuskan<br />kemudian</>,
    lead: "Ceritakan kebutuhan hukum perusahaan Anda — kami kirimkan kode undangan.",
    kartu: ["Kirim permintaan", "Tim MRWP meninjau", "Kode undangan dikirim"],
  },
};
/* 4 langkah wizard → 3 kartu: (0)=kode, (1)=akun, (2)=data PT, (3)=dokumen. */
const langkahAktif = (s: number) => (s === 0 ? 0 : s === 3 ? 2 : 1);

export function AuthScreen() {
  const { ten, login, toast } = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const router = useRouter();

  /* ---- login ---- */
  /* Form masuk WAJIB kosong: dulu terisi otomatis kredensial akun seed (ACCOUNTS[0]) — kata sandi
   * demo terpampang di layar login produksi, dan klien nyata bingung melihat email orang lain. */
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  /* ---- daftar wizard ---- */
  const [step, setStep] = useState(0);
  const [kode, setKode] = useState("");
  const [invite, setInvite] = useState<{ tier: string; expiresIn: string; seats: number } | null>(null);
  const [akun, setAkun] = useState({ nama: "", jabatan: "", email: "", pw: "" });
  const [pt, setPt] = useState({ nama: "", bidang: "", nib: "", npwp: "", alamat: "", provinsi: "", kota: "", email: "" });
  const [docs, setDocs] = useState<Record<string, File | null>>({ nib: null, akta: null, npwp: null });
  const [submitted, setSubmitted] = useState(false);

  /* ---- demo ---- */
  const [demo, setDemo] = useState({ nama: "", perusahaan: "", email: "", kebutuhan: "" });
  const [demoSent, setDemoSent] = useState(false);

  const goMode = (m: Mode) => { setMode(m); setStep(0); setSubmitted(false); setDemoSent(false); };

  /* Tautan undangan admin: /login?kode=MRWP-XXXXXX → langsung mode daftar + kode terisi. */
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("kode");
    if (k) { setKode(k.toUpperCase()); setMode("daftar"); }
  }, []);

  /* ================= actions ================= */
  const { run: doLogin, pending: loggingIn } = useAsyncAction(async () => {
    const mail = email.trim().toLowerCase();
    if (!mail) { toast("Email wajib diisi", "Masukkan email terdaftar Anda.", "warn"); return; }
    if (!pw.trim()) { toast("Kata sandi wajib diisi", "Masukkan kata sandi untuk melanjutkan.", "warn"); return; }
    // Jalur demo seed (t1/t2/t3) — tetap hidup untuk peragaan.
    const acc = ACCOUNTS.find((a) => a.email === mail);
    if (acc && pw === acc.pw) {
      const res = await api.auth.signIn(mail, pw); // JWT wajib — RLS menolak sesi tanpa auth
      if (!res.ok) { toast("Autentikasi gagal", res.error.message, "warn"); return; }
      login(acc.tid);
      router.push("/");
      return;
    }
    // Jalur nyata — RPC login_user (bcrypt + cek status tenant di DB).
    const res = await api.auth.loginDb(mail, pw);
    if (!res.ok) { toast("Autentikasi gagal", res.error.message, "warn"); return; }
    login(res.data.tenant.id, res.data);
    router.push("/");
  });

  const { run: cekKode, pending: cekingKode } = useAsyncAction(async () => {
    const res = await api.auth.verifyInvite(kode);
    if (!res.ok) { toast("Kode ditolak", res.error.message, "warn"); return; }
    setInvite(res.data);
    setStep(1);
    toast("Kode undangan sah", `Paket ${res.data.tier} · berlaku ${res.data.expiresIn} · ${res.data.seats} kursi.`, "ok");
  });

  const nextFromAkun = () => {
    if (!akun.nama.trim()) { toast("Nama wajib diisi", "Lengkapi nama lengkap Anda.", "warn"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(akun.email)) { toast("Email tidak valid", "Periksa kembali format email.", "warn"); return; }
    if (akun.pw.length < 8) { toast("Kata sandi terlalu pendek", "Minimal 8 karakter.", "warn"); return; }
    setStep(2);
  };

  const nextFromPt = () => {
    if (!pt.nama.trim()) { toast("Nama perusahaan wajib diisi", "Lengkapi data perusahaan.", "warn"); return; }
    if (!pt.bidang) { toast("Bidang usaha wajib dipilih", "Pilih bidang usaha perusahaan.", "warn"); return; }
    setStep(3);
  };

  const pickDoc = (key: string, file?: File) => {
    if (!file) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) { toast("Format tidak didukung", "Gunakan PDF, JPG, atau PNG.", "warn"); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast("Ukuran terlalu besar", `Maksimal ${MAX_MB}MB per dokumen.`, "warn"); return; }
    setDocs((d) => ({ ...d, [key]: file }));
  };

  const docsReady = DOKUMEN.every((d) => docs[d.key]);

  const { run: selesaikan, pending: submitting } = useAsyncAction(async () => {
    if (!docsReady) { toast("Dokumen belum lengkap", "Ketiga dokumen wajib harus diunggah.", "warn"); return; }
    /* Berkas asli diunggah ke Storage (bucket company-docs) — admin mempreview saat Approval. */
    const dokumen: { jenis: string; nama: string; ukuran: number; url?: string }[] = [];
    for (const d of DOKUMEN) {
      const f = docs[d.key]!;
      const path = `daftar/${Date.now()}-${d.key}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
      const up = await sb.storage.from("company-docs").upload(path, f);
      if (up.error) { toast("Unggah dokumen gagal", `${f.name} — ${up.error.message}`, "warn"); return; }
      dokumen.push({ jenis: d.key, nama: f.name, ukuran: f.size, url: sb.storage.from("company-docs").getPublicUrl(path).data.publicUrl });
    }
    const res = await withRetry(() => api.auth.register({ kode, akun, perusahaan: pt, dokumen }));
    if (!res.ok) { toast("Pendaftaran gagal", res.error.message, "warn"); return; }
    setSubmitted(true);
    toast("Pendaftaran terkirim", "Tim MRWP akan meninjau dokumen Anda.", "ok");
  });

  const { run: kirimDemo, pending: sendingDemo } = useAsyncAction(async () => {
    /* Dulu NOL validasi: form kosong bisa dikirim → baris demo_requests kosong masuk panel admin,
     * padahal labelnya bertanda wajib (*). */
    if (!demo.nama.trim()) { toast("Nama wajib diisi", "Lengkapi nama lengkap Anda.", "warn"); return; }
    if (!demo.perusahaan.trim()) { toast("Nama perusahaan wajib diisi", "Tim MRWP perlu tahu perusahaan Anda.", "warn"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(demo.email)) { toast("Email tidak valid", "Kode undangan dikirim ke email ini — periksa formatnya.", "warn"); return; }
    const res = await withRetry(() => api.demo.request(demo));
    if (!res.ok) { toast("Gagal mengirim", res.error.message, "warn"); return; }
    setDemoSent(true);
    toast("Permintaan demo terkirim", "Tim MRWP akan mengirim kode undangan ke email Anda.", "ok");
  });

  /* ================= render ================= */
  const heading =
    mode === "login" ? { h: "Masuk ke Portal", s: "Gunakan email terdaftar perusahaan Anda." }
      : mode === "daftar" ? { h: "Daftarkan Perusahaan", s: "Lengkapi 4 langkah berikut untuk mengaktifkan akses." }
        : { h: "Minta Demo", s: "Tim MRWP akan mengirimkan kode undangan ke email Anda." };

  return (
    <div id="lock" style={{ padding: 0 }}>
      <style>{`
        /* ===== LANDING AUTH — KARTU MENGAMBANG =====
         * Kelas cx-* hanya hidup di komponen ini; aplikasi Corplex tidak tersentuh.
         * Performa: yang beranimasi hanya 2 lapis gradasi di panel kiri, murni transform/opacity
         * (dikompos GPU, nol reflow). Nol partikel, nol titik, nol kilau. */
        /* Latar halaman RATA gelap — menyatu dengan panel kanan (seperti referensi).
         * Nol gradasi/animasi di sini: kalau latar ikut bergerak, tepi kartu jadi terlihat
         * sebagai bingkai. Yang hidup HANYA panel kiri. */
        #lock{padding:clamp(26px,4.2vmin,62px) !important;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);place-items:stretch;overflow:auto;background:#0A0E15}
        /* Kartu berbingkai — jarak ke tepi layar SAMA di keempat sisi (padding #lock memakai vmin). */
        .cx-card{position:relative;z-index:1;width:100%;height:100%;max-width:1560px;justify-self:center;min-height:520px;
          display:grid;grid-template-columns:1.02fr .98fr;border-radius:22px;overflow:hidden;
          background:#0B0E14;border:1px solid rgba(255,255,255,.085);
          box-shadow:0 50px 110px -45px rgba(0,0,0,.85);
          animation:cxIn .6s cubic-bezier(.2,.8,.25,1) both}

        /* ===== KIRI — bidang warna bertekstur, beranimasi ===== */
        .cx-left{position:relative;min-height:0;margin:11px;border-radius:15px;overflow:hidden;isolation:isolate;
          background:linear-gradient(152deg,#0A2138 0%,#0C2C48 38%,#08192C 72%,#061525 100%)}
        /* dua massa cahaya besar = "tekstur modern" yang bergerak, bukan pola titik */
        /* CAUSTICS — dua kipas cahaya berputar berlawanan arah dengan blend berbeda.
           Perpotongannya menghasilkan pola yang tak pernah berulang sama; ini yang membedakannya
           dari gumpalan blur yang lazim dipakai di mana-mana. */
        .cx-left::before{content:'';position:absolute;inset:-45%;pointer-events:none;filter:blur(34px);
          mix-blend-mode:soft-light;
          background:conic-gradient(from 0deg at 52% 48%,rgba(72,186,220,0),rgba(72,186,220,.75) 16%,transparent 34%,rgba(96,150,232,.6) 56%,transparent 74%,rgba(72,186,220,0));
          animation:cxCausA 38s linear infinite;will-change:transform}
        .cx-left::after{content:'';position:absolute;inset:-50%;pointer-events:none;filter:blur(42px);
          mix-blend-mode:overlay;
          background:conic-gradient(from 200deg at 44% 56%,transparent,rgba(226,182,102,.6) 20%,transparent 42%,rgba(48,132,196,.62) 68%,transparent);
          animation:cxCausB 53s linear infinite reverse;will-change:transform}
        /* massa ketiga — biru royal, arah berlawanan; tiga warna bersilangan = tekstur, bukan gradasi biasa */
        .cx-mesh{position:absolute;inset:-25%;z-index:0;pointer-events:none;opacity:.4;
          background:repeating-linear-gradient(116deg,rgba(255,255,255,.045) 0 1px,transparent 1px 17px);
          animation:cxBrush 19s linear infinite;will-change:transform}
        /* sapuan halus diagonal — memberi "permukaan", tanpa butiran */
        .cx-sheen{position:absolute;inset:-45%;z-index:1;pointer-events:none;
          background:linear-gradient(110deg,transparent 36%,rgba(255,255,255,.10) 47%,rgba(168,220,244,.08) 53%,transparent 64%);
          animation:cxPass 21s ease-in-out infinite;will-change:transform}
        .cx-left-in{position:relative;z-index:2;height:100%;padding:clamp(24px,3vw,40px);
          display:flex;flex-direction:column;justify-content:flex-end}

        .cx-lrow{display:flex;align-items:flex-start;gap:clamp(18px,3vw,44px);flex-wrap:wrap}
        .cx-head{font-family:var(--serif);font-size:clamp(28px,3.1vw,42px);line-height:1.1;font-weight:700;
          color:#fff;margin:0;letter-spacing:-.015em;flex:1 1 240px}
        .cx-lead{font-size:12.5px;line-height:1.65;color:rgba(232,240,252,.72);margin:6px 0 0;flex:0 1 210px;max-width:230px}

        .cx-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-top:clamp(22px,3vw,38px)}
        .cx-step{border-radius:15px;padding:13px 13px 15px;min-height:104px;display:flex;flex-direction:column;
          justify-content:space-between;gap:14px;font-size:12px;line-height:1.38;
          background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.13);color:rgba(255,255,255,.84);
          -webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);transition:background .3s,color .3s,transform .3s}
        .cx-step .n{width:23px;height:23px;border-radius:50%;display:grid;place-items:center;
          font-family:var(--mono);font-size:10px;font-weight:700;background:rgba(255,255,255,.2);color:#fff;flex-shrink:0}
        .cx-step.on{background:#fff;color:#0A1B30;border-color:#fff;transform:translateY(-3px);
          box-shadow:0 20px 44px -20px rgba(0,0,0,.8)}
        .cx-step.on .n{background:#0A1B30;color:#fff}

        /* ===== KANAN — gelap rata, fokus ke form ===== */
        .cx-right{position:relative;min-height:0;display:flex;align-items:center;justify-content:center;
          padding:clamp(46px,7vh,76px) clamp(18px,2.6vw,44px);overflow-y:auto}
        .cx-form{width:100%;max-width:344px}
        .cx-title{font-family:var(--serif);font-size:23px;font-weight:700;color:#fff;text-align:center;margin:0;letter-spacing:-.01em}
        .cx-tsub{font-size:12px;line-height:1.6;color:rgba(206,218,238,.5);text-align:center;margin:7px 0 24px}
        .cx-back{position:absolute;top:20px;left:22px;display:inline-flex;align-items:center;gap:6px;
          background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:100px;
          padding:6px 14px;font-size:11.5px;font-weight:600;color:rgba(214,223,238,.72);cursor:pointer;transition:.2s;z-index:3}
        .cx-back:hover{border-color:rgba(217,188,128,.55);color:#fff}

        .cx-in{width:100%;border:1px solid rgba(255,255,255,.11);border-radius:11px;padding:11px 14px;
          background:rgba(255,255,255,.045);color:#EAF0FA;font-size:13px;font-family:inherit;font-weight:500;outline:none;
          transition:border-color .22s,background .22s,box-shadow .22s}
        .cx-in::placeholder{color:rgba(206,218,238,.34);font-weight:400}
        .cx-in:focus{border-color:rgba(217,188,128,.55);background:rgba(255,255,255,.075);box-shadow:0 0 0 3px rgba(176,138,62,.14)}
        .cx-in option{background:#0e1c33;color:#EAF0FA}
        select.cx-in{appearance:none;-webkit-appearance:none;-moz-appearance:none;cursor:pointer;padding-right:38px}
        textarea.cx-in{min-height:44px;resize:none;font-family:inherit}
        .cx-lbl{font-size:11.5px;font-weight:600;color:rgba(206,218,238,.72);display:block;margin-bottom:6px}
        .cx-lbl i{color:#D9BC80;font-style:normal}
        .cx-lbl em{color:rgba(206,218,238,.4);font-style:normal;font-weight:400}
        .cx-hint{font-size:10.5px;color:rgba(206,218,238,.42);margin:7px 0 0}

        .cx-btn{width:100%;border:none;cursor:pointer;border-radius:11px;padding:12px;font-weight:700;font-size:13.5px;color:#0B1526;
          background:linear-gradient(135deg,#EAD09A 0%,#C9A45C 56%,#AC8535 100%);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.35);
          transition:transform .18s,filter .18s,box-shadow .18s}
        .cx-btn:hover:not(:disabled){filter:brightness(1.05);transform:translateY(-1px)}
        .cx-btn:active:not(:disabled){transform:translateY(0)}
        .cx-btn:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
        .cx-btn.ghost{background:none;color:rgba(214,223,238,.8);border:1px solid rgba(255,255,255,.14);box-shadow:none;font-weight:600}
        .cx-btn.ghost:hover:not(:disabled){filter:none;border-color:rgba(217,188,128,.5);color:#fff;transform:none}
        .cx-eye{position:absolute;right:11px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;
          color:rgba(206,218,238,.5);display:grid;place-items:center;padding:4px}
        .cx-eye:hover{color:#fff}
        .cx-link{background:none;border:none;padding:0;cursor:pointer;color:#D9BC80;font-weight:700;font-size:12px;transition:.18s}
        .cx-link:hover{color:#F4E4BC}

        .cx-doc{border:1px solid rgba(255,255,255,.11);border-radius:12px;padding:13px 15px;background:rgba(255,255,255,.035);transition:.22s}
        .cx-doc.ok{border-color:rgba(217,188,128,.42);background:rgba(176,138,62,.09)}
        .cx-doc .t{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#EAF0FA}
        .cx-doc .t i{color:#D9BC80;font-style:normal;font-size:11px}
        .cx-doc .m{font-size:10.5px;color:rgba(206,218,238,.48);margin:5px 0 10px}
        .cx-pick{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(217,188,128,.32);background:rgba(176,138,62,.12);
          border-radius:9px;padding:7px 13px;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;
          font-weight:700;color:#E4CB92;cursor:pointer;transition:.2s}
        .cx-pick:hover{background:rgba(176,138,62,.2);border-color:rgba(217,188,128,.65);color:#fff}
        .cx-count{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;color:rgba(206,218,238,.42)}
        .cx-ok{text-align:center}
        .cx-ok .ico{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;margin:0 auto 16px;
          background:rgba(176,138,62,.13);border:1px solid rgba(217,188,128,.28);color:#D9BC80}

        @keyframes cxIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes cxCausA{0%{transform:rotate(0) scale(1)}50%{transform:rotate(180deg) scale(1.18)}100%{transform:rotate(360deg) scale(1)}}
        @keyframes cxCausB{0%{transform:rotate(0) scale(1.14)}50%{transform:rotate(180deg) scale(.96)}100%{transform:rotate(360deg) scale(1.14)}}
        @keyframes cxBrush{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(9.6%,4.7%,0)}}
        @keyframes cxPass{0%,100%{transform:translate3d(-24%,0,0)}50%{transform:translate3d(24%,0,0)}}

        @media(prefers-reduced-motion:reduce){
          .cx-card,.cx-left::before,.cx-left::after,.cx-mesh,.cx-sheen,.cx-step{animation:none!important;transition:none!important}
        }
        @media(max-width:900px){
          #lock{padding:0 !important;place-items:stretch}
          .cx-card{grid-template-columns:1fr;height:auto;min-height:100dvh;border-radius:0;border:none;max-width:none}
          .cx-left{display:none}
          .cx-right{min-height:100dvh}
        }
      `}</style>

      <div className="cx-card">
        {/* ===== KIRI — bidang warna bertekstur & beranimasi, tanpa lambang ===== */}
        <div className="cx-left">
          {/* tiga massa warna bersilangan + permukaan berputar = tekstur yang benar-benar bergerak */}
          <div className="cx-mesh" />
          <div className="cx-sheen" />
          <div className="cx-left-in">
            <div className="cx-lrow">
              <h2 className="cx-head">{KIRI[mode].judul}</h2>
              <p className="cx-lead">{KIRI[mode].lead}</p>
            </div>
            {/* Mode daftar: kartu mengikuti langkah SEBENARNYA (aktif menyala saat maju).
                Mode lain: tiga fungsi inti Corplex. Nol data karangan. */}
            <div className="cx-steps">
              {KIRI[mode].kartu.map((k, i) => (
                <div key={i} className={`cx-step${(mode === "daftar" ? langkahAktif(step) === i : i === 0) ? " on" : ""}`}>
                  <span className="n">{i + 1}</span>
                  <span>{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== KANAN — form ===== */}
        <div className="cx-right">
          {mode !== "login" && (
            <button type="button" className="cx-back" onClick={() => goMode("login")} aria-label="Kembali ke halaman masuk">
              ← Kembali
            </button>
          )}
          <div className="cx-form">

            {/* --- sukses: pendaftaran terkirim --- */}
            {mode === "daftar" && submitted ? (
              <div className="cx-ok">
                <div className="ico"><ShieldCheck size={28} /></div>
                <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>Pendaftaran Terkirim</h2>
                <p style={{ fontSize: 13, color: "rgba(214,223,238,.7)", marginTop: 10, lineHeight: 1.65 }}>
                  Tim MRWP sedang meninjau dokumen perusahaan Anda — biasanya kurang dari 1×24 jam.
                  Kami akan mengirim email begitu akses disetujui.
                </p>
                <button className="cx-btn ghost" style={{ marginTop: 22 }} onClick={() => goMode("login")}>Kembali ke Masuk</button>
              </div>
            ) : mode === "demo" && demoSent ? (
              <div className="cx-ok">
                <div className="ico"><Mail size={28} /></div>
                <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>Permintaan Terkirim</h2>
                <p style={{ fontSize: 13, color: "rgba(214,223,238,.7)", marginTop: 10, lineHeight: 1.65 }}>
                  Terima kasih. Tim MRWP akan meninjau permintaan Anda dan mengirimkan
                  <b> kode undangan</b> ke <b>{demo.email}</b>.
                </p>
                <button className="cx-btn ghost" style={{ marginTop: 22 }} onClick={() => goMode("login")}>Kembali ke Masuk</button>
              </div>
            ) : (
              <>

                <h2 className="cx-title">{heading.h}</h2>
                <p className="cx-tsub">{heading.s}</p>

                {/* ============ MODE: LOGIN ============ */}
                {mode === "login" && (
                  <div style={{ display: "grid", gap: 11 }}>
                    <div>
                      <label className="cx-lbl">Email Terdaftar <i>*</i></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="legal@perusahaan.co.id" />
                        <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)" }} />
                      </div>
                    </div>
                    <div>
                      <label className="cx-lbl">Password <i>*</i></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40, paddingRight: 40 }} type={showPw ? "text" : "password"} value={pw}
                          onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void doLogin(); }} placeholder="Kata sandi" />
                        <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)" }} />
                        <button type="button" className="cx-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Sembunyikan sandi" : "Tampilkan sandi"}>
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <button className="cx-btn" style={{ marginTop: 4 }} disabled={loggingIn} aria-busy={loggingIn} onClick={() => void doLogin()}>
                      {loggingIn ? "Memverifikasi…" : "Masuk"}
                    </button>
                    <p style={{ textAlign: "center", margin: "2px 0 0" }}>
                      {/* ponytail: JANGAN klaim "permintaan diteruskan" — tak ada apa pun yang terkirim.
                          Reset sungguhan = sb.auth.resetPasswordForEmail + halaman /reset, menunggu SMTP diatur. */}
                      <button type="button" className="cx-link" onClick={() => toast("Hubungi tim MRWP", "Reset kata sandi belum otomatis. Hubungi admin MRWP lewat kanal resmi perusahaan Anda untuk penyetelan ulang.", "warn")}>Lupa sandi</button>
                    </p>
                  </div>
                )}

                {/* ============ MODE: DAFTAR ============ */}
                {mode === "daftar" && step === 0 && (
                  <div style={{ display: "grid", gap: 11 }}>
                    <div>
                      <label className="cx-lbl">Kode Undangan <i>*</i></label>
                      <input className="cx-in" style={{ letterSpacing: ".18em", fontFamily: "var(--mono)", textTransform: "uppercase" }}
                        value={kode} onChange={(e) => setKode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void cekKode(); }} placeholder="MRWP-XXXXXX" />
                      <p style={{ fontSize: 11.5, color: "rgba(206,218,238,.5)", marginTop: 7, lineHeight: 1.5 }}>
                        Kode diterbitkan tim MRWP dan memiliki masa berlaku.
                      </p>
                    </div>
                    <button className="cx-btn" disabled={cekingKode} aria-busy={cekingKode} onClick={() => void cekKode()}>
                      {cekingKode ? "Memeriksa…" : "Verifikasi Kode"}
                    </button>
                  </div>
                )}

                {mode === "daftar" && step === 1 && (
                  <div style={{ display: "grid", gap: 11 }}>
                    {invite && (
                      <div style={{ fontSize: 11.5, color: "#fff", background: "rgba(176,138,62,.08)", border: "1px solid rgba(176,138,62,.3)", borderRadius: 10, padding: "9px 12px" }}>
                        Paket <b>{invite.tier}</b> · berlaku {invite.expiresIn} · {invite.seats} kursi
                      </div>
                    )}
                    <div>
                      <label className="cx-lbl">Nama Lengkap <i>*</i></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40 }} value={akun.nama} onChange={(e) => setAkun({ ...akun, nama: e.target.value })} placeholder="Maria Sari, S.H." />
                        <User size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)" }} />
                      </div>
                    </div>
                    <div>
                      <label className="cx-lbl">Jabatan <em>(opsional)</em></label>
                      <input className="cx-in" value={akun.jabatan} onChange={(e) => setAkun({ ...akun, jabatan: e.target.value })} placeholder="Head of Legal" />
                    </div>
                    <div>
                      <label className="cx-lbl">Email <i>*</i></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40 }} type="email" value={akun.email} onChange={(e) => setAkun({ ...akun, email: e.target.value })} placeholder="nama@perusahaan.com" />
                        <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)" }} />
                      </div>
                    </div>
                    <div>
                      <label className="cx-lbl">Password <em>(min 8 karakter)</em></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40, paddingRight: 40 }} type={showPw ? "text" : "password"} value={akun.pw} onChange={(e) => setAkun({ ...akun, pw: e.target.value })} placeholder="••••••••" />
                        <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)" }} />
                        <button type="button" className="cx-eye" onClick={() => setShowPw((s) => !s)} aria-label="Tampilkan sandi">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      <button className="cx-btn ghost" style={{ flex: "0 0 40%" }} onClick={() => setStep(0)}>← Kembali</button>
                      <button className="cx-btn" onClick={nextFromAkun}>Lanjut</button>
                    </div>
                  </div>
                )}

                {mode === "daftar" && step === 2 && (
                  <div style={{ display: "grid", gap: 9 }}>
                    {/* Nama + Bidang sejajar 2 kolom — pola sama NIB/NPWP */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="cx-lbl">Nama Perusahaan <i>*</i></label>
                        <div style={{ position: "relative" }}>
                          <input className="cx-in" style={{ paddingLeft: 40 }} value={pt.nama} onChange={(e) => setPt({ ...pt, nama: e.target.value })} placeholder="PT Contoh Sejahtera" />
                          <Building2 size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)" }} />
                        </div>
                      </div>
                      <div>
                        <label className="cx-lbl">Bidang Usaha <i>*</i></label>
                        <div style={{ position: "relative" }}>
                          <select className="cx-in" style={{ color: pt.bidang ? undefined : "rgba(206,218,238,.4)" }} value={pt.bidang} onChange={(e) => setPt({ ...pt, bidang: e.target.value })}>
                            <option value="">Pilih bidang usaha</option>
                            {BIDANG.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                          <ChevronDown size={16} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)", pointerEvents: "none" }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="cx-lbl">NIB <em>(opsional)</em></label>
                        <input className="cx-in" value={pt.nib} onChange={(e) => setPt({ ...pt, nib: e.target.value })} placeholder="13 digit" />
                      </div>
                      <div>
                        <label className="cx-lbl">NPWP <em>(opsional)</em></label>
                        <input className="cx-in" value={pt.npwp} onChange={(e) => setPt({ ...pt, npwp: e.target.value })} placeholder="NPWP perusahaan" />
                      </div>
                    </div>
                    <div>
                      <label className="cx-lbl">Alamat <em>(opsional)</em></label>
                      <textarea className="cx-in" value={pt.alamat} onChange={(e) => setPt({ ...pt, alamat: e.target.value })} placeholder="Alamat lengkap perusahaan" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="cx-lbl">Provinsi</label>
                        <input className="cx-in" value={pt.provinsi} onChange={(e) => setPt({ ...pt, provinsi: e.target.value })} placeholder="Jawa Barat" />
                      </div>
                      <div>
                        <label className="cx-lbl">Kota</label>
                        <input className="cx-in" value={pt.kota} onChange={(e) => setPt({ ...pt, kota: e.target.value })} placeholder="Cirebon" />
                      </div>
                    </div>
                    <div>
                      <label className="cx-lbl">Email Perusahaan <em>(opsional)</em></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40 }} type="email" value={pt.email} onChange={(e) => setPt({ ...pt, email: e.target.value })} placeholder="legal@perusahaan.co.id" />
                        <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                      <button className="cx-btn ghost" style={{ flex: "0 0 40%" }} onClick={() => setStep(1)}>← Kembali</button>
                      <button className="cx-btn" onClick={nextFromPt}>Lanjut</button>
                    </div>
                  </div>
                )}

                {mode === "daftar" && step === 3 && (
                  <div style={{ display: "grid", gap: 12 }}>
                    <span className="cx-lbl" style={{ marginBottom: 0 }}>Dokumen Wajib <i>({DOKUMEN.length})</i></span>
                    {DOKUMEN.map((d) => {
                      const f = docs[d.key];
                      return (
                        <div key={d.key} className={`cx-doc${f ? " ok" : ""}`}>
                          <div className="t"><i>✳</i>{d.label}</div>
                          <div className="m">
                            {f ? `${f.name} · ${(f.size / 1024 / 1024).toFixed(2)} MB` : `Wajib • PDF/JPG/PNG • Maks ${MAX_MB}MB`}
                          </div>
                          <label className="cx-pick">
                            <Paperclip size={12} />{f ? "Ganti file" : "Pilih file"}
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
                              onChange={(e) => { pickDoc(d.key, e.target.files?.[0]); e.target.value = ""; }} />
                          </label>
                        </div>
                      );
                    })}
                    <span className="cx-count">{DOKUMEN.filter((d) => docs[d.key]).length} dokumen siap di-upload</span>
                    <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                      <button className="cx-btn ghost" style={{ flex: "0 0 40%" }} onClick={() => setStep(2)}>← Kembali</button>
                      <button className="cx-btn" disabled={!docsReady || submitting} aria-busy={submitting} onClick={() => void selesaikan()}>
                        {submitting ? "Mengirim…" : "Selesaikan"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ============ MODE: DEMO ============ */}
                {mode === "demo" && (
                  <div style={{ display: "grid", gap: 11 }}>
                    <div>
                      <label className="cx-lbl">Nama Lengkap <i>*</i></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40 }} value={demo.nama} onChange={(e) => setDemo({ ...demo, nama: e.target.value })} placeholder="Maria Sari, S.H." />
                        <User size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)" }} />
                      </div>
                    </div>
                    <div>
                      <label className="cx-lbl">Nama Perusahaan <i>*</i></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40 }} value={demo.perusahaan} onChange={(e) => setDemo({ ...demo, perusahaan: e.target.value })} placeholder="PT Contoh Sejahtera" />
                        <Building2 size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)" }} />
                      </div>
                    </div>
                    <div>
                      <label className="cx-lbl">Email <i>*</i></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40 }} type="email" value={demo.email} onChange={(e) => setDemo({ ...demo, email: e.target.value })} placeholder="nama@perusahaan.com" />
                        <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)" }} />
                      </div>
                    </div>
                    <div>
                      <label className="cx-lbl">Kebutuhan <em>(opsional)</em></label>
                      <textarea className="cx-in" value={demo.kebutuhan} onChange={(e) => setDemo({ ...demo, kebutuhan: e.target.value })} placeholder="Ceritakan singkat kebutuhan hukum perusahaan Anda…" />
                    </div>
                    <button className="cx-btn" style={{ marginTop: 4 }} disabled={sendingDemo} aria-busy={sendingDemo} onClick={() => void kirimDemo()}>
                      {sendingDemo ? "Mengirim…" : "Kirim Permintaan Demo"}
                    </button>
                  </div>
                )}

                {/* --- pindah mode --- */}
                {mode === "login" && (
                  <p style={{ textAlign: "center", fontSize: 12.5, color: "rgba(206,218,238,.55)", marginTop: 20, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.1)", display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
                    <button type="button" className="cx-link" onClick={() => goMode("daftar")}>Daftarkan perusahaan</button>·
                    <button type="button" className="cx-link" onClick={() => goMode("demo")}>Minta demo</button>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
