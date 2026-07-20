"use client";
import React, { useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Lock, Mail, Paperclip, ShieldCheck, User } from "lucide-react";
import { ACCOUNTS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { api, withRetry } from "@/lib/api";
import { sb } from "@/lib/supabase";
import { useAsyncAction } from "@/lib/hooks";
import { useRouter } from "next/navigation";

/* Deterministic sparkle positions [top%, left%, delay s] — no Math.random (stable across renders). */
const SPARKS: [number, number, number][] = [
  [18, 22, 0], [30, 68, 0.6], [52, 40, 1.2], [44, 82, 0.9], [70, 26, 1.8],
  [83, 58, 0.3], [12, 52, 1.5], [62, 74, 2.1], [26, 12, 1.0], [76, 88, 1.7],
];

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
const STEPS = ["Kode Undangan", "Buat Akun", "Data Perusahaan", "Dokumen"];

type Mode = "login" | "daftar" | "demo";

export function AuthScreen() {
  const { ten, login, toast } = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const router = useRouter();

  /* ---- login ---- */
  const [email, setEmail] = useState(ACCOUNTS[0].email);
  const [pw, setPw] = useState(ACCOUNTS[0].pw);
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
        #lock{padding:0 !important}
        .cx-card{width:100vw;height:100vh;height:100dvh;display:grid;grid-template-columns:1fr 1fr;background:#fff;overflow:hidden;animation:cxRise .55s cubic-bezier(.2,.8,.25,1) both}
        .cx-left{position:relative;overflow:hidden;color:#fff;background:linear-gradient(155deg,#081020 0%,#0B1526 52%,#0e1c33 100%)}
        .cx-left::before{content:"";position:absolute;inset:-35%;z-index:0;filter:blur(16px);animation:cxDrift 22s ease-in-out infinite alternate;background:
          radial-gradient(38% 38% at 26% 24%,rgba(176,138,62,.55),transparent 62%),
          radial-gradient(44% 44% at 82% 30%,rgba(30,58,107,.85),transparent 60%),
          radial-gradient(52% 52% at 68% 88%,rgba(176,138,62,.34),transparent 62%),
          radial-gradient(46% 46% at 12% 84%,rgba(8,16,32,.95),transparent 60%)}
        .cx-left::after{content:"";position:absolute;inset:-20%;z-index:0;mix-blend-mode:screen;opacity:.6;animation:cxSpin 30s linear infinite;background:conic-gradient(from 0deg at 50% 50%,rgba(176,138,62,.14),transparent 26%,rgba(30,58,107,.18) 52%,transparent 78%,rgba(176,138,62,.14))}
        .cx-dots{position:absolute;inset:0;z-index:1;background-image:radial-gradient(rgba(217,188,128,.28) 1px,transparent 1.6px);background-size:26px 26px;-webkit-mask-image:radial-gradient(115% 90% at 32% 42%,#000 0%,transparent 74%);mask-image:radial-gradient(115% 90% at 32% 42%,#000 0%,transparent 74%);opacity:.8;pointer-events:none}
        .cx-glow{position:absolute;z-index:1;width:560px;height:560px;border-radius:50%;top:-170px;left:-130px;background:radial-gradient(closest-side,rgba(176,138,62,.5),transparent 70%);filter:blur(34px);animation:cxPulse 7s ease-in-out infinite;pointer-events:none}
        .cx-glow.g2{top:auto;left:auto;bottom:-190px;right:-140px;width:480px;height:480px;background:radial-gradient(closest-side,rgba(30,58,107,.6),transparent 70%);animation-delay:2.5s}
        .cx-vig{position:absolute;inset:0;z-index:1;background:radial-gradient(130% 90% at 50% -10%,transparent 42%,rgba(5,10,20,.6) 100%);pointer-events:none}
        .cx-spark{position:absolute;z-index:2;width:3px;height:3px;border-radius:50%;background:#F4E4BC;box-shadow:0 0 9px 2px rgba(217,188,128,.9);animation:cxTwinkle 3.4s ease-in-out infinite;pointer-events:none}
        .cx-body{position:relative;z-index:3;height:100%;padding:clamp(40px,5vw,64px);display:flex;flex-direction:column;justify-content:space-between}
        .cx-right{position:relative;padding:clamp(14px,2vw,28px);display:flex;flex-direction:column;justify-content:center;align-items:center;background:#fff;overflow:hidden}
        .cx-form{width:100%;max-width:412px}
        .cx-back{position:absolute;top:18px;left:22px;display:inline-flex;align-items:center;gap:6px;background:none;border:1px solid #E3E6EE;border-radius:100px;padding:7px 14px;font-size:12px;font-weight:600;color:#6B7280;cursor:pointer;transition:.18s;z-index:2}
        .cx-back:hover{border-color:#B08A3E;color:#0B1526}
        .cx-in{width:100%;border:1px solid #E3E6EE;border-radius:10px;padding:8px 13px;background:#fff;color:#0B1526;font-size:13px;font-family:inherit;font-weight:500;outline:none;transition:.18s;box-shadow:0 1px 2px rgba(6,12,26,.04)}
        .cx-in::placeholder{color:#9AA3B2;font-weight:400;letter-spacing:.01em}
        .cx-in:focus{border-color:#B08A3E;box-shadow:0 0 0 4px rgba(176,138,62,.16)}
        .cx-in option{background:#fff;color:#0B1526}
        select.cx-in{appearance:none;-webkit-appearance:none;-moz-appearance:none;cursor:pointer;padding-right:38px}
        textarea.cx-in{min-height:42px;resize:none;font-family:inherit}
        .cx-lbl{font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;font-weight:600;color:#6E7787;display:block;margin-bottom:5px}
        .cx-lbl i{color:#B08A3E;font-style:normal}
        .cx-lbl em{color:#9AA3B2;font-style:normal;font-weight:400}
        .cx-btn{width:100%;border:none;cursor:pointer;border-radius:12px;padding:13px;font-weight:700;font-size:14px;color:#0B1526;background:linear-gradient(135deg,#D9BC80 0%,#B08A3E 62%,#9c7a34 100%);box-shadow:0 12px 26px -10px rgba(176,138,62,.8),inset 0 1px 0 rgba(255,255,255,.4);transition:.18s;letter-spacing:.01em}
        .cx-btn:hover:not(:disabled){filter:brightness(1.05);transform:translateY(-1px)}
        .cx-btn:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
        .cx-btn.ghost{background:none;color:#6B7280;border:1px solid #E3E6EE;box-shadow:none;font-weight:600}
        .cx-btn.ghost:hover:not(:disabled){filter:none;border-color:#B08A3E;color:#0B1526;transform:none}
        .cx-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#8A93A3;display:grid;place-items:center;padding:4px}
        .cx-eye:hover{color:#0B1526}
        .cx-link{background:none;border:none;padding:0;cursor:pointer;color:#B08A3E;font-weight:700;font-size:12.5px}
        .cx-link:hover{text-decoration:underline}
        .cx-wiz{display:flex;align-items:flex-start;margin-bottom:12px}
        .cx-wz{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;position:relative}
        .cx-wz::before{content:"";position:absolute;top:14px;left:-50%;width:100%;height:1px;background:#E3E6EE}
        .cx-wz:first-child::before{display:none}
        .cx-wz.done::before,.cx-wz.now::before{background:#B08A3E}
        .cx-wz .dot{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:11.5px;font-weight:700;background:#EEF0F5;color:#9AA3B2;border:1px solid #E3E6EE;transition:.25s;position:relative;z-index:1}
        .cx-wz.done .dot,.cx-wz.now .dot{background:linear-gradient(150deg,#D9BC80,#B08A3E);color:#0B1526;border-color:#B08A3E;box-shadow:0 4px 12px -4px rgba(176,138,62,.7)}
        .cx-wz .cap{font-family:var(--mono);font-size:7.5px;letter-spacing:.1em;text-transform:uppercase;color:#9AA3B2;text-align:center;line-height:1.35}
        .cx-wz.now .cap{color:#B08A3E;font-weight:700}
        .cx-wz.done .cap{color:#6B7280}
        .cx-doc{border:1px solid #E3E6EE;border-radius:12px;padding:14px 15px;background:#fff;transition:.18s}
        .cx-doc.ok{border-color:#B08A3E;background:rgba(176,138,62,.04)}
        .cx-doc .t{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:#0B1526}
        .cx-doc .t i{color:#B08A3E;font-style:normal;font-size:11px}
        .cx-doc .m{font-size:11px;color:#8A93A3;margin:4px 0 11px}
        .cx-pick{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(176,138,62,.4);background:rgba(176,138,62,.08);border-radius:9px;padding:8px 13px;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#8a6c2c;cursor:pointer;transition:.18s}
        .cx-pick:hover{background:rgba(176,138,62,.16);border-color:#B08A3E;color:#0B1526}
        .cx-count{font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:#9AA3B2}
        .cx-ok{text-align:center}
        .cx-ok .ico{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;margin:0 auto 16px;background:rgba(176,138,62,.12);color:#B08A3E}
        @keyframes cxDrift{0%{transform:translate3d(-4%,-2%,0) scale(1.06)}100%{transform:translate3d(4%,3%,0) scale(1.16)}}
        @keyframes cxSpin{to{transform:rotate(1turn)}}
        @keyframes cxPulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:.9;transform:scale(1.12)}}
        @keyframes cxTwinkle{0%,100%{opacity:.12;transform:scale(.6)}50%{opacity:1;transform:scale(1.35)}}
        @keyframes cxRise{from{opacity:0}to{opacity:1}}
        @media(max-width:820px){.cx-card{grid-template-columns:1fr}.cx-left{display:none}}
      `}</style>

      <div className="cx-card">
        {/* ===== KIRI — panel visual ===== */}
        <div className="cx-left">
          <div className="cx-glow" />
          <div className="cx-glow g2" />
          <div className="cx-dots" />
          <div className="cx-vig" />
          {SPARKS.map(([tp, lf, d], i) => (
            <span key={i} className="cx-spark" style={{ top: `${tp}%`, left: `${lf}%`, animationDelay: `${d}s` }} />
          ))}

          <div className="cx-body">
            <div className="flex items-center gap-3">
              <img src="/logo-mrwp.svg" alt="MRWP Logo" style={{ width: 54, height: 54, objectFit: "contain" }} />
              <div>
                <b style={{ fontFamily: "var(--serif)", fontSize: 19, letterSpacing: ".02em", display: "block", lineHeight: 1 }}>CORPLEX</b>
                <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: ".22em", color: "#D9BC80" }}>MRWP LAW FIRM</span>
              </div>
            </div>

            <div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".26em", color: "#D9BC80", display: "block", marginBottom: 14 }}>PORTAL KLIEN · MULTI-TENANT</span>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(30px,3.4vw,44px)", lineHeight: 1.16, fontWeight: 700, color: "#fff", margin: 0, maxWidth: 460 }}>
                Rekam hukum hidup, terjaga dengan otoritas penuh.
              </h2>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: "rgba(214,223,238,.72)", marginTop: 16, maxWidth: 380 }}>
                Setiap dokumen, izin, dan perkara — terisolasi per tenant, teraudit, dan siap kapan saja.
              </p>
              <div className="flex items-center gap-2" style={{ marginTop: 24, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".14em", color: "rgba(214,223,238,.55)" }}>
                <ShieldCheck size={13} style={{ color: "#D9BC80" }} /> TLS 1.3 · MFA · ROW-LEVEL SECURITY
              </div>
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
            {mode !== "daftar" && (
              <img src="/logo-mrwp.svg" alt="MRWP Logo" style={{ width: 44, height: 44, objectFit: "contain", marginBottom: 12 }} />
            )}

            {/* --- sukses: pendaftaran terkirim --- */}
            {mode === "daftar" && submitted ? (
              <div className="cx-ok">
                <div className="ico"><ShieldCheck size={28} /></div>
                <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 700, color: "#0B1526", margin: 0 }}>Pendaftaran Terkirim</h2>
                <p style={{ fontSize: 13, color: "#6B7280", marginTop: 10, lineHeight: 1.65 }}>
                  Tim MRWP sedang meninjau dokumen perusahaan Anda — biasanya kurang dari 1×24 jam.
                  Kami akan mengirim email begitu akses disetujui.
                </p>
                <button className="cx-btn ghost" style={{ marginTop: 22 }} onClick={() => goMode("login")}>Kembali ke Masuk</button>
              </div>
            ) : mode === "demo" && demoSent ? (
              <div className="cx-ok">
                <div className="ico"><Mail size={28} /></div>
                <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 700, color: "#0B1526", margin: 0 }}>Permintaan Terkirim</h2>
                <p style={{ fontSize: 13, color: "#6B7280", marginTop: 10, lineHeight: 1.65 }}>
                  Terima kasih. Tim MRWP akan meninjau permintaan Anda dan mengirimkan
                  <b> kode undangan</b> ke <b>{demo.email}</b>.
                </p>
                <button className="cx-btn ghost" style={{ marginTop: 22 }} onClick={() => goMode("login")}>Kembali ke Masuk</button>
              </div>
            ) : (
              <>
                {mode === "daftar" && (
                  <div className="cx-wiz">
                    {STEPS.map((label, i) => (
                      <div key={label} className={`cx-wz${i < step ? " done" : i === step ? " now" : ""}`}>
                        <div className="dot">{i < step ? <Check size={14} strokeWidth={3} /> : i + 1}</div>
                        <span className="cap">{label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <h2 style={{ fontFamily: "var(--serif)", fontSize: 25, fontWeight: 700, color: "#0B1526", margin: 0 }}>{heading.h}</h2>
                <p style={{ fontSize: 12.5, color: "#6B7280", marginTop: 5, marginBottom: 16, lineHeight: 1.55 }}>{heading.s}</p>

                {/* ============ MODE: LOGIN ============ */}
                {mode === "login" && (
                  <div style={{ display: "grid", gap: 11 }}>
                    <div>
                      <label className="cx-lbl">Email Terdaftar <i>*</i></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="legal@perusahaan.co.id" />
                        <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3" }} />
                      </div>
                    </div>
                    <div>
                      <label className="cx-lbl">Password <i>*</i></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40, paddingRight: 40 }} type={showPw ? "text" : "password"} value={pw}
                          onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void doLogin(); }} placeholder="Kata sandi" />
                        <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3" }} />
                        <button type="button" className="cx-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Sembunyikan sandi" : "Tampilkan sandi"}>
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <button className="cx-btn" style={{ marginTop: 4 }} disabled={loggingIn} aria-busy={loggingIn} onClick={() => void doLogin()}>
                      {loggingIn ? "Memverifikasi…" : "Masuk"}
                    </button>
                    <p style={{ textAlign: "center", margin: "2px 0 0" }}>
                      <button type="button" className="cx-link" onClick={() => toast("Laporan diteruskan", "Permintaan reset sandi dikirim ke advokat MRWP — Anda akan dihubungi via kanal resmi.", "ok")}>Lupa sandi</button>
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
                      <p style={{ fontSize: 11.5, color: "#8A93A3", marginTop: 7, lineHeight: 1.5 }}>
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
                      <div style={{ fontSize: 11.5, color: "#0B1526", background: "rgba(176,138,62,.08)", border: "1px solid rgba(176,138,62,.3)", borderRadius: 10, padding: "9px 12px" }}>
                        Paket <b>{invite.tier}</b> · berlaku {invite.expiresIn} · {invite.seats} kursi
                      </div>
                    )}
                    <div>
                      <label className="cx-lbl">Nama Lengkap <i>*</i></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40 }} value={akun.nama} onChange={(e) => setAkun({ ...akun, nama: e.target.value })} placeholder="Maria Sari, S.H." />
                        <User size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3" }} />
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
                        <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3" }} />
                      </div>
                    </div>
                    <div>
                      <label className="cx-lbl">Password <em>(min 8 karakter)</em></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40, paddingRight: 40 }} type={showPw ? "text" : "password"} value={akun.pw} onChange={(e) => setAkun({ ...akun, pw: e.target.value })} placeholder="••••••••" />
                        <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3" }} />
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
                        <input className="cx-in" value={pt.nama} onChange={(e) => setPt({ ...pt, nama: e.target.value })} placeholder="PT Contoh Sejahtera" />
                      </div>
                      <div>
                        <label className="cx-lbl">Bidang Usaha <i>*</i></label>
                        <div style={{ position: "relative" }}>
                          <select className="cx-in" style={{ color: pt.bidang ? undefined : "#9AA3B2" }} value={pt.bidang} onChange={(e) => setPt({ ...pt, bidang: e.target.value })}>
                            <option value="">Pilih bidang usaha</option>
                            {BIDANG.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                          <ChevronDown size={16} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3", pointerEvents: "none" }} />
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
                        <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3" }} />
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
                        <User size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3" }} />
                      </div>
                    </div>
                    <div>
                      <label className="cx-lbl">Nama Perusahaan <i>*</i></label>
                      <input className="cx-in" value={demo.perusahaan} onChange={(e) => setDemo({ ...demo, perusahaan: e.target.value })} placeholder="PT Contoh Sejahtera" />
                    </div>
                    <div>
                      <label className="cx-lbl">Email <i>*</i></label>
                      <div style={{ position: "relative" }}>
                        <input className="cx-in" style={{ paddingLeft: 40 }} type="email" value={demo.email} onChange={(e) => setDemo({ ...demo, email: e.target.value })} placeholder="nama@perusahaan.com" />
                        <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8A93A3" }} />
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
                  <p style={{ textAlign: "center", fontSize: 12.5, color: "#C9CEDA", marginTop: 20, paddingTop: 18, borderTop: "1px solid #EEF0F5", display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
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
