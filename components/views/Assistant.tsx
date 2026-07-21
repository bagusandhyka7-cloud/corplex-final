"use client";
/* AI Assistant — produksi: sesi & pesan di Supabase, jawaban streaming dari /api/chat.
 * Tanpa data dummy. Tinggal isi AI_API_KEY di .env.local. */
import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, BrainCircuit, Check, Copy, Lightbulb, Link as LinkIcon, MoreHorizontal, Plus, RadioTower, RefreshCw, Search, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useMountedRef } from "@/lib/hooks";
import { askConfirm, Chip, Md, Row } from "@/components/ui";

type Sess = { id: string; title: string; domain: string };
type CMsg = { role: "user" | "assistant"; content: string; citations?: number };

const MODELS = [
  { n: "Jago 1.5", tag: "TERJANGKAU", d: "Cepat untuk pertanyaan hukum umum" },
  { n: "Jago 2.0", tag: "PROFESIONAL", d: "Analisis hukum mendalam & berargumen" },
];
const RELATED = [
  "Bagaimana cara menghitung pesangon jika masa kerja tepat satu tahun?",
  "Apa saja kewajiban perusahaan sebelum melakukan PHK efisiensi?",
  "Dokumen apa yang wajib disiapkan untuk verifikasi advokat?",
];
const salam = () => { const h = new Date().getHours(); return h < 11 ? "pagi" : h < 15 ? "siang" : h < 19 ? "sore" : "malam"; };

/* Tahapan berpikir — berputar selama menunggu jawaban pertama. */
const THINK_STEPS = [
  "Membaca pertanyaan Anda…",
  "Menelusuri konteks hukum perusahaan…",
  "Mencocokkan regulasi yang relevan…",
  "Menyusun jawaban…",
];
/* Deteksi isu hukum rumit → tombol Verifikasi ke Advokat muncul otomatis.
 * ponytail: heuristik kata kunci atas jawaban AI — ganti klasifikasi model bila meleset. */
const perluEskalasi = (s: string) =>
  /PHK|pesangon|sengketa|gugatan|pidana|somasi|litigasi|wanprestasi|pailit|arbitrase|SP3|risiko tinggi|verifikasi advokat|berakibat hukum/i.test(s);

export default function Assistant() {
  const { ten, toast, pushQueue } = useStore();
  const [sess, setSess] = useState<Sess[]>([]);
  const [curId, setCurId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<CMsg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);        // menunggu delta pertama
  const [streamTxt, setStreamTxt] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [model, setModel] = useState(MODELS[1].n);
  const [deep, setDeep] = useState(true);
  const [pickOpen, setPickOpen] = useState(false);
  const [mode, setMode] = useState<"chat" | "monitor">("chat");
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const mounted = useMountedRef();
  const askCtrl = useRef<AbortController | null>(null);
  const [thinkStep, setThinkStep] = useState(0);
  /* typewriter: target penuh dari stream, tampilan menyusul beberapa karakter per tik */
  const twTarget = useRef("");
  const twShown = useRef(0);
  const twTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const kosong = msgs.length === 0 && streamTxt === null;

  /* tahapan berpikir berputar selama menunggu delta pertama */
  useEffect(() => {
    if (!typing) { setThinkStep(0); return; }
    const t = setInterval(() => setThinkStep((s) => (s + 1) % THINK_STEPS.length), 1400);
    return () => clearInterval(t);
  }, [typing]);

  useEffect(() => () => { if (twTimer.current) clearInterval(twTimer.current); }, []);

  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }); }, [msgs, typing, streamTxt]);
  useEffect(() => () => askCtrl.current?.abort(), []);

  /* muat sesi dari DB */
  useEffect(() => {
    void api.chat.listSessions().then((r) => {
      if (!mounted.current) return;
      if (r.ok) { const xs = r.data.filter((s) => s.domain !== "draft"); setSess(xs); if (xs[0]) setCurId(xs[0].id); }
      // senyap saat memuat daftar (arahan owner: nol toast pada load)
    });
  }, [mounted, toast]);

  /* muat pesan saat sesi berganti */
  useEffect(() => {
    if (!curId) { setMsgs([]); return; }
    void api.chat.listMessages(curId).then((r) => {
      if (mounted.current && r.ok) setMsgs(r.data);
    });
  }, [curId, mounted]);

  /* menu titik-3 tutup saat klik di luar */
  useEffect(() => {
    if (menuAt === null) return;
    const h = () => setMenuAt(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [menuAt]);

  const newConsult = async () => {
    const r = await api.chat.createSession();
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setSess((s) => [r.data, ...s]);
    setCurId(r.data.id);
    setMode("chat");
  };

  /* Inline rename — edit langsung di posisi teks (tanpa pop-up) */
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const mulaiRename = (s: Sess) => { setMenuAt(null); setEditId(s.id); setEditVal(s.title); };
  const simpanRename = async () => {
    const id = editId; const nama = editVal.trim();
    setEditId(null);
    if (!id || !nama) return;
    const r = await api.chat.renameSession(id, nama);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setSess((xs) => xs.map((x) => x.id === id ? { ...x, title: nama } : x));
  };

  const deleteConv = async (s: Sess) => {
    setMenuAt(null);
    if (!(await askConfirm(`Hapus percakapan “${s.title}”?`))) return;
    const r = await api.chat.deleteSession(s.id);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setSess((xs) => { const n = xs.filter((x) => x.id !== s.id); if (curId === s.id) setCurId(n[0]?.id ?? null); return n; });
  };

  const sending = useRef(false); // guard double-submit sync
  const sendChat = async () => {
    if (!input.trim() || sending.current) return;
    sending.current = true;
    const text = input.trim();
    setInput("");

    // pastikan ada sesi
    let sid = curId;
    if (!sid) {
      const r = await api.chat.createSession();
      if (!r.ok) { sending.current = false; toast("Gagal", r.error.message, "warn"); setInput(text); return; }
      setSess((s) => [r.data, ...s]); setCurId(r.data.id); sid = r.data.id;
    }

    const history = [...msgs, { role: "user" as const, content: text }];
    setMsgs(history);
    void api.chat.addMessage(sid, "user", text);
    // judul otomatis dari pertanyaan pertama
    if (history.filter((m) => m.role === "user").length === 1) {
      const title = text.slice(0, 38) + (text.length > 38 ? "…" : "");
      void api.chat.renameSession(sid, title);
      setSess((xs) => xs.map((x) => x.id === sid ? { ...x, title } : x));
    }

    setTyping(true);
    askCtrl.current?.abort();
    const ctrl = new AbortController();
    askCtrl.current = ctrl;
    // typewriter: delta masuk ke target; interval menampilkan ±3 karakter/24ms (efek mengetik
    // walau Gemini mengirim bongkahan besar)
    twTarget.current = ""; twShown.current = 0;
    if (twTimer.current) clearInterval(twTimer.current);
    let first = true;
    twTimer.current = setInterval(() => {
      if (!mounted.current || twShown.current >= twTarget.current.length) return;
      twShown.current = Math.min(twShown.current + 3, twTarget.current.length);
      setStreamTxt(twTarget.current.slice(0, twShown.current));
    }, 24);
    const res = await api.ai.chatStream({
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      model, signal: ctrl.signal,
      company: ten ? { name: ten.name, sector: ten.sector, entity: ten.corp.entity } : undefined,
      onDelta: (t) => {
        if (!mounted.current) return;
        if (first) { first = false; setTyping(false); }
        twTarget.current += t;
      },
    });
    sending.current = false;
    if (!mounted.current) return;
    setTyping(false);
    if (!res.ok) {
      if (twTimer.current) clearInterval(twTimer.current);
      setStreamTxt(null);
      if (res.error.code !== "aborted") toast("AI belum merespons", res.error.message, "warn");
      setInput(text);
      setMsgs(history); // pertanyaan tetap tersimpan
      return;
    }
    // tunggu ketikan menyusul sampai tuntas, baru pindah ke daftar pesan
    await new Promise<void>((r) => {
      const cek = setInterval(() => {
        if (!mounted.current || twShown.current >= twTarget.current.length) { clearInterval(cek); r(); }
      }, 40);
    });
    if (twTimer.current) clearInterval(twTimer.current);
    setStreamTxt(null);
    setMsgs([...history, { role: "assistant", content: res.data }]);
    void api.chat.addMessage(sid, "assistant", res.data, model);
  };

  const escalate = () => {
    const lastQ = [...msgs].reverse().find((m) => m.role === "user")?.content.slice(0, 60) || "Konsultasi AI";
    pushQueue(lastQ, "Eskalasi dari AI Assistant · transkrip terlampir", "c-gold", "ESKALASI");
    toast("Eskalasi terkirim", "Masuk antrean verifikasi advokat MRWP — SLA < 24 jam.", "ok");
  };

  const hist = sess.filter((s) => s.title.toLowerCase().includes(cari.toLowerCase()));
  const kirimTeks = (teks: string) => { setInput(teks); setTimeout(() => document.querySelector<HTMLButtonElement>(".ai-send")?.click(), 50); };
  const retry = () => { const q = [...msgs].reverse().find((m) => m.role === "user"); if (q) kirimTeks(q.content); };
  const salin = (teks: string) => { void navigator.clipboard?.writeText(teks); toast("Disalin", "Jawaban tersalin ke clipboard.", "ok"); };

  const pill = (
    <div className="ai-pill">
      <Plus size={16} style={{ color: "var(--muted)", flex: "0 0 auto" }} />
      <input value={input} placeholder="Tanya apa saja tentang hukum perusahaan Anda…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} />
      <div style={{ position: "relative", flex: "0 0 auto" }}>
        <button className="ai-model" onClick={() => setPickOpen((v) => !v)}>{model} <span style={{ fontSize: 9, transform: pickOpen ? "rotate(180deg)" : "none", display: "inline-block", transition: ".2s" }}>▾</span></button>
        {pickOpen && (
          <div className="ai-pick">
            {MODELS.map((m) => (
              <button key={m.n} className="ai-pick-it" onClick={() => { setModel(m.n); setPickOpen(false); }}>
                <div><b>{m.n} <i>{m.tag}</i></b><span>{m.d}</span></div>
                {model === m.n && <Check size={15} style={{ color: "var(--blue-300)" }} />}
              </button>
            ))}
            <div className="ai-pick-it tgl" onClick={() => setDeep((v) => !v)}>
              <Lightbulb size={14} style={{ color: "var(--muted)", flex: "0 0 auto" }} />
              <div><b>Berpikir mendalam</b><span>Tampilkan proses penalaran</span></div>
              <span className={`ai-tgl${deep ? " on" : ""}`}><i /></span>
            </div>
          </div>
        )}
      </div>
      <button className="ai-send" onClick={sendChat} aria-label="Kirim"><ArrowUp size={16} /></button>
    </div>
  );

  return (
    <div>
      <style>{`
        .content:has(.ai-wrap){padding-bottom:26px}
        .ai-wrap{display:grid;grid-template-columns:250px 1fr;height:calc(100vh - 114px);min-height:440px;background:var(--sur);border:1px solid var(--line);border-radius:14px;overflow:hidden}
        .ai-side{display:flex;flex-direction:column;gap:10px;padding:13px;border-right:1px solid var(--line);overflow:hidden}
        .ai-cari{position:relative}
        .ai-cari input{width:100%;border:1px solid var(--line);border-radius:9px;height:32px;padding:0 12px 0 32px;font-size:12px;background:#0A1830;color:var(--txt);outline:none;transition:.2s}
        .ai-cari input:focus{border-color:var(--blue-400)}
        .ai-cari .lucide{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted)}
        .ai-lbl{font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:#5E76A8;margin:4px 2px 0}
        .ai-hist{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px}
        .ai-navit{display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;border-radius:9px;padding:9px 12px;font-size:12.5px;font-weight:600;color:var(--txt2);cursor:pointer;transition:.15s;text-align:left}
        .ai-navit:hover{background:rgba(58,96,166,.12);color:#fff}
        .ai-navit.on{background:rgba(58,96,166,.22);color:#fff}
        .ai-it{position:relative;display:flex;align-items:center;gap:6px;border-radius:9px;padding:9px 11px;cursor:pointer;transition:.15s}
        .ai-it b{flex:1;min-width:0;font-size:12.5px;color:var(--txt);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ai-it:hover{background:rgba(58,96,166,.12)}
        .ai-it.on{background:rgba(58,96,166,.22)}
        .ai-it.on b{color:#fff}
        .ai-dots{flex:0 0 auto;background:none;border:none;cursor:pointer;color:var(--muted);padding:2px;border-radius:6px;opacity:0;transition:.15s}
        .ai-it:hover .ai-dots{opacity:1}
        .ai-dots:hover{color:#fff;background:rgba(58,96,166,.3)}
        .ai-menu{position:absolute;top:34px;right:6px;background:#0E1C38;border:1px solid var(--line2);border-radius:10px;box-shadow:var(--shadow-lg);z-index:650;overflow:hidden;min-width:130px;animation:drop .15s ease}
        .ai-menu button{display:block;width:100%;text-align:left;background:none;border:none;padding:9px 13px;font-size:12px;color:var(--txt);cursor:pointer}
        .ai-menu button:hover{background:var(--sur-2)}
        .ai-menu .del{color:#F07A76}
        .ai-main{display:flex;flex-direction:column;min-width:0;min-height:0}
        .ai-hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px}
        .ai-hero .ai-spark{color:var(--blue-300);margin-bottom:8px;animation:pl 2.2s infinite}
        .ai-hero h1{font-family:var(--serif);font-size:clamp(28px,3.4vw,42px);color:#fff;font-weight:700}
        .ai-hero h1 i{color:var(--blue-300);font-style:italic}
        .ai-hero p{font-size:13px;color:var(--txt2);margin-bottom:20px}
        .ai-pill{display:flex;align-items:center;gap:10px;width:min(680px,100%);background:#0A1830;border:1px solid var(--line);border-radius:100px;padding:8px 8px 8px 16px;transition:.2s}
        .ai-pill:focus-within{border-color:var(--blue-400)}
        .ai-pill input{flex:1;min-width:0;background:none;border:none;outline:none;font-size:13.5px;color:var(--txt)}
        .ai-model{background:none;border:none;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--blue-300);white-space:nowrap;padding:6px 8px;border-radius:8px}
        .ai-model:hover{background:rgba(58,96,166,.15)}
        .ai-send{flex:0 0 auto;width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;display:grid;place-items:center;color:#fff;background:linear-gradient(150deg,var(--navy-600),var(--navy-800));transition:.18s}
        .ai-send:hover{filter:brightness(1.2)}
        .ai-pick{position:absolute;bottom:44px;right:0;width:264px;background:#0E1C38;border:1px solid var(--line2);border-radius:13px;box-shadow:var(--shadow-lg);overflow:hidden;z-index:600;animation:drop .18s ease}
        .ai-pick-it{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;padding:11px 14px;cursor:pointer;transition:.15s}
        .ai-pick-it:hover{background:var(--sur-2)}
        .ai-pick-it b{display:block;font-size:12.5px;color:#fff;font-weight:600}
        .ai-pick-it b i{font-style:normal;font-family:var(--mono);font-size:8px;letter-spacing:.1em;color:var(--blue-300);margin-left:4px}
        .ai-pick-it span{font-size:11px;color:var(--muted)}
        .ai-pick-it div{flex:1}
        .ai-pick-it.tgl{border-top:1px solid rgba(28,48,84,.6)}
        .ai-tgl{flex:0 0 auto;width:34px;height:19px;border-radius:100px;background:#1C3054;position:relative;transition:.2s}
        .ai-tgl.on{background:var(--blue-400)}
        .ai-tgl i{position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:.2s}
        .ai-tgl.on i{left:17px}
        .ai-chat{flex:1;min-height:0;overflow-y:auto;padding:18px 22px}
        .ai-thread{width:100%;max-width:740px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
        .mq{align-self:flex-end;max-width:70%;background:rgba(58,96,166,.26);border:1px solid rgba(90,130,200,.22);border-radius:14px 14px 4px 14px;padding:10px 15px;font-size:13.5px;color:#fff;line-height:1.6;white-space:pre-wrap}
        .ma{font-size:13.5px;color:var(--txt);line-height:1.75;white-space:pre-wrap}
        .rel{border-top:1px solid var(--line);margin-top:14px;padding-top:12px}
        .rel h5{font-size:12.5px;font-weight:600;color:var(--txt2);margin-bottom:8px}
        .rel-q{display:flex;gap:8px;width:100%;text-align:left;background:none;border:none;padding:6px 8px;border-radius:8px;font-size:12.5px;color:var(--txt2);cursor:pointer;transition:.15s;line-height:1.5}
        .rel-q i{font-style:normal;color:var(--muted);flex:0 0 auto}
        .rel-q:hover{background:rgba(58,96,166,.12);color:#fff}
        .acts{display:flex;gap:4px;margin-top:10px}
        .acts button{background:none;border:none;cursor:pointer;color:var(--muted);padding:6px;border-radius:7px;transition:.15s;display:grid;place-items:center}
        .acts button:hover{color:#fff;background:rgba(58,96,166,.18)}
        .ai-foot{padding:12px 16px;border-top:1px solid var(--line);display:flex;justify-content:center}
        .ai-think{display:flex;align-items:center;gap:10px;padding:4px 2px;font-size:12.5px;color:var(--txt2)}
        .ai-think .brain{color:var(--gold-bright);animation:pl 1.3s ease-in-out infinite}
        .caret{display:inline-block;width:7px;height:14px;margin-left:3px;vertical-align:middle;background:var(--gold-bright);animation:pl 1s steps(2) infinite}
        .cits{display:flex;align-items:center;gap:5px;margin-top:10px}
        .cits .lbl{font-style:normal;font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;color:var(--muted)}
        .cits .ic{display:grid;place-items:center;width:20px;height:20px;border-radius:6px;background:rgba(58,96,166,.18);border:1px solid rgba(90,130,200,.25);color:var(--blue-300);font-style:normal;cursor:pointer;transition:.15s}
        .cits .ic:hover{background:rgba(58,96,166,.35);color:#fff}
        .cits .more{font-style:normal;font-size:10px;color:var(--muted);background:rgba(58,96,166,.14);border-radius:100px;padding:2px 7px}
        .think-txt{animation:fade .4s ease}
        .esk-pulse{animation:eskGlow 2.2s ease-in-out infinite}
        @keyframes eskGlow{0%,100%{box-shadow:0 0 0 0 rgba(217,188,128,.45)}50%{box-shadow:0 0 14px 2px rgba(217,188,128,.55)}}
      `}</style>

      <div className="ai-wrap">
        {/* sisi riwayat */}
        <div className="ai-side">
          <button className="ai-navit" onClick={() => void newConsult()}><Plus size={14} /> Percakapan baru</button>
          <button className={`ai-navit${mode === "monitor" ? " on" : ""}`} onClick={() => setMode("monitor")}><RadioTower size={14} /> Monitor Regulasi</button>
          <div className="ai-cari">
            <Search size={13} />
            <input placeholder="Cari percakapan…" value={cari} onChange={(e) => setCari(e.target.value)} />
          </div>
          <div className="ai-lbl">RIWAYAT</div>
          <div className="ai-hist">
            {hist.map((s) => (
              <div key={s.id} className={`ai-it${s.id === curId && mode === "chat" ? " on" : ""}`} onClick={() => { setCurId(s.id); setMode("chat"); }}>
                {editId === s.id ? (
                  <input autoFocus value={editVal} onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditVal(e.target.value)}
                    onBlur={() => void simpanRename()}
                    onKeyDown={(e) => { if (e.key === "Enter") void simpanRename(); if (e.key === "Escape") setEditId(null); }}
                    style={{ background: "var(--sur-2)", border: "1px solid var(--gold)", borderRadius: 6, color: "var(--txt)", fontSize: 12, padding: "3px 8px", width: "100%" }} />
                ) : <b>{s.title}</b>}
                <button className="ai-dots" onClick={(e) => { e.stopPropagation(); setMenuAt(menuAt === s.id ? null : s.id); }} aria-label="Opsi percakapan"><MoreHorizontal size={14} /></button>
                {menuAt === s.id && (
                  <div className="ai-menu" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => mulaiRename(s)}>Ganti nama</button>
                    <button className="del" onClick={() => void deleteConv(s)}>Hapus</button>
                  </div>
                )}
              </div>
            ))}
            {!hist.length && <span style={{ fontSize: 11.5, color: "var(--muted)", padding: 8 }}>Belum ada percakapan.</span>}
          </div>
        </div>

        {/* panel utama */}
        <div className="ai-main">
          {mode === "monitor" ? (
            <div className="ai-chat" style={{ gap: 0 }}>
              <div className="ai-lbl" style={{ marginBottom: 10 }}>MONITOR REGULASI</div>
              <div className="rows">
                <Row b="Perubahan aturan pelaksana perizinan sektor pangan olahan" d="Cocok dengan profil usaha Anda · ringkasan dampak tersedia"
                  right={<><Chip c="c-mon">BARU</Chip><button className="btn btn-line btn-sm" onClick={() => toast("Ringkasan dampak dibuka", "Analisis DRAF AI — rujukan tertaut sumber resmi.", "ok")}>Baca</button></>} />
                <Row b="Penyesuaian formula UMK 2027 (rancangan)" d="Berdampak pada perhitungan pesangon & upah" right={<Chip c="c-gray">PANTAU</Chip>} />
                <Row b="Pembaruan tata cara pelaporan LKPM" d="Kalender kewajiban diperbarui otomatis" right={<Chip c="c-ver">DITERAPKAN</Chip>} />
              </div>
              <p className="note mt16">Peraturan baru dari sumber resmi dicocokkan dengan profil perusahaan Anda — tiap kecocokan membuat pengingat otomatis.</p>
            </div>
          ) : kosong && !typing ? (
            <div className="ai-hero">
              <Sparkles size={26} className="ai-spark" />
              <h1>Selamat {salam()}, <i>Sobat Corplex</i></h1>
              <p>Apa yang ingin Anda telusuri hari ini?</p>
              {pill}
            </div>
          ) : (
            <>
              <div className="ai-chat" ref={bodyRef}>
                <div className="ai-thread">
                  {msgs.map((m, i) =>
                    m.role === "user" ? (
                      <div key={i} className="mq">{m.content}</div>
                    ) : (
                      <div key={i} className="ma">
                        <Md t={m.content} />
                        {(m.citations ?? 0) > 0 && (
                          <span className="cits" title={`${m.citations} rujukan sumber resmi`}>
                            <i className="lbl">RUJUKAN</i>
                            {Array.from({ length: Math.min(m.citations!, 3) }).map((_, k) => <i key={k} className="ic"><LinkIcon size={11} /></i>)}
                            {m.citations! > 3 && <i className="more">+{m.citations! - 3}</i>}
                          </span>
                        )}
                        {i === msgs.length - 1 && (
                          <>
                            <div className="rel">
                              <h5>Pertanyaan Terkait:</h5>
                              {RELATED.map((q, qi) => (
                                <button key={qi} className="rel-q" onClick={() => kirimTeks(q)}><i>{qi + 1}.</i> {q}</button>
                              ))}
                            </div>
                            <div className="acts">
                              <button title="Suka" onClick={() => toast("Terima kasih", "Masukan Anda tercatat.", "ok")}><ThumbsUp size={14} /></button>
                              <button title="Tidak suka" onClick={() => toast("Terima kasih", "Masukan Anda membantu perbaikan jawaban.", "ok")}><ThumbsDown size={14} /></button>
                              <button title="Ulangi jawaban" onClick={retry}><RefreshCw size={14} /></button>
                              <button title="Salin" onClick={() => salin(m.content)}><Copy size={14} /></button>
                              {/* muncul otomatis hanya bila AI mendeteksi isu hukum rumit */}
                              {perluEskalasi(m.content) && (
                                <button title="Isu hukum rumit terdeteksi — eskalasikan ke advokat MRWP" className="btn btn-gold btn-sm esk-pulse" style={{ marginLeft: 6 }} onClick={escalate}>⚖ Verifikasi ke Advokat</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  {streamTxt !== null && (
                    <div className="ma"><Md t={streamTxt} /><span className="caret" /></div>
                  )}
                  {typing && (
                    <div className="ai-think">
                      <BrainCircuit size={17} className="brain" />
                      <span key={thinkStep} className="think-txt">{THINK_STEPS[thinkStep]}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="ai-foot" style={{ flexDirection: "column", gap: 6 }}>
                {pill}
                <span style={{ fontSize: 10, color: "var(--muted)", textAlign: "center" }}>Informasi AI — bukan nasihat hukum sampai diverifikasi advokat MRWP.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
