"use client";
/*
 * AI Drafting — word processor ala JagaHukum. Split resizable kiri(chat)/kanan(editor).
 * Backend nyata: draft_projects + chat_sessions/chat_messages (sama dgn AI Assistant) +
 * streaming dari /api/chat. contentEditable + execCommand dipakai untuk rich text —
 * ponytail: cukup buat toolbar dasar, ganti ke TipTap kalau butuh skema dokumen kompleks.
 *
 * Alur generasi (2 tahap): kirim instruksi → AI "berpikir" sebentar (tanpa panggilan API,
 * hemat token) → form "Beberapa detail kunci" (boleh dilewati) → Susun Draft memanggil AI
 * SATU KALI dengan format balasan "ringkasan===DRAFT===dokumen" (lihat /api/chat/route.ts) —
 * ringkasan asli dari AI tampil di chat (bukan teks hardcode), dokumen diketik ke editor kanan.
 * Mode Generate = terapkan langsung; Plan = tampilkan usulan dulu, user klik "Terapkan ke Draft".
 */
import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowUp, Brain, Check, ChevronDown, ClipboardList, Copy, MoreHorizontal,
  Plus, RefreshCw, Save, Sparkles, ThumbsDown, ThumbsUp, Trash2, Zap,
} from "lucide-react";
import "remixicon/fonts/remixicon.css";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { askConfirm, Md, mdHtml } from "@/components/ui";
import { useMountedRef } from "@/lib/hooks";
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Extension } from '@tiptap/core';

const LineSpacing = Extension.create({
  name: 'lineSpacing',
  addOptions() { return { types: ['paragraph', 'heading', 'list_item'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineSpacing: {
          default: null,
          parseHTML: element => element.style.lineHeight || null,
          renderHTML: attributes => {
            if (!attributes.lineSpacing) return {};
            return { style: `line-height: ${attributes.lineSpacing}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setLineSpacing: (spacing: string) => ({ commands }: any) => {
        return this.options.types.every((type: string) => commands.updateAttributes(type, { lineSpacing: spacing }));
      },
      unsetLineSpacing: () => ({ commands }: any) => {
        return this.options.types.every((type: string) => commands.resetAttributes(type, 'lineSpacing'));
      },
    } as any;
  },
});

type Project = { id: string; session_id: string | null; title: string; body: string; tone: string; model: string; status: string };
type CMsg = { role: "user" | "assistant"; content: string; stagedHtml?: string; applied?: boolean };

const MODELS = [
  { n: "Jago 1.5", tag: "TERJANGKAU", d: "Cepat untuk pertanyaan hukum umum", speed: "sangat cepat" },
  { n: "Jago 2.0", tag: "PROFESIONAL", d: "Analisis hukum mendalam & berargumen", speed: "sedang" },
];
const TONES = ["Tegas", "Diplomatik", "Strategis", "Ringkas"];
const CONTOH = [
  "Buatkan somasi untuk pelanggan yang belum bayar pengadaan barang Rp 200 juta",
  "Drafting gugatan cerai untuk klien tanpa anak dan harta bersama rumah",
  "Perjanjian kerjasama bisnis antara dua PT untuk distribusi produk",
  "MoU NDA antara konsultan dan klien untuk proyek IT 12 bulan",
];
const TENGGAT_OPTS = ["Tidak ada", "7 hari", "14 hari", "30 hari"];
const EXEC_MODES = [
  { k: "plan" as const, label: "Plan", d: "Diskusikan dulu — draft tidak diubah sampai disetujui", Ico: ClipboardList },
  { k: "generate" as const, label: "Generate", d: "Eksekusi revisi langsung ke draft", Ico: Zap },
];

const DRAFTING_STEPS = [
  "Menganalisis instruksi & konteks hukum...",
  "Mengidentifikasi para pihak & objek hukum...",
  "Memilih template & kerangka dokumen...",
  "Menyusun draf klausul & pasal-pasal...",
  "Memvalidasi kepatuhan regulasi (UU & KUHP)...",
  "Merapikan format & struktur hierarki...",
  "Merampungkan finalisasi draf..."
];

/* Balasan AI mode draft = "ringkasan===DRAFT===dokumen" (lihat api/chat/route.ts).
 * Fallback: kalau model lupa pemisah, seluruh balasan diperlakukan sebagai dokumen. */
const DRAFT_SEP = "===DRAFT===";
function splitDraft(raw: string): [string, string] {
  const idx = raw.indexOf(DRAFT_SEP);
  if (idx === -1) return ["Draf telah disusun — silakan tinjau di panel kanan.", raw.trim()];
  return [raw.slice(0, idx).trim(), raw.slice(idx + DRAFT_SEP.length).trim()];
}

export default function Drafter() {
  const { ten, toast } = useStore();
  const mounted = useMountedRef();
  const [projects, setProjects] = useState<Project[]>([]);
  const [rightView, setRightView] = useState<'editor' | 'projek' | 'empty'>('empty');
  const [curId, setCurId] = useState<string | null>(null);       // projek tersimpan yang aktif
  const [sessionId, setSessionId] = useState<string | null>(null); // sesi chat penyusun (tersimpan atau belum)
  const [msgs, setMsgs] = useState<CMsg[]>([]);
  const [body, setBody] = useState("");                          // isi dokumen kanan (belum tentu tersimpan)
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);                   // beat "AI berpikir" sebelum form
  const [model, setModel] = useState(MODELS[0].n);
  const [tone, setTone] = useState(TONES[0]);
  const [modelOpen, setModelOpen] = useState(false);
  const [execMode, setExecMode] = useState<"generate" | "plan">("generate");
  const [execOpen, setExecOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);
  const [toneOpen, setToneOpen] = useState(false);
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const [leftW, setLeftW] = useState(340);
  const [isDrafting, setIsDrafting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [draftingStepsOpen, setDraftingStepsOpen] = useState(true);
  const [streamHtml, setStreamHtml] = useState<string | null>(null);
  const [version, setVersion] = useState(1);
  const [draftReady, setDraftReady] = useState(false);           // sudah ada dokumen di sesi ini?
  const [awaitingForm, setAwaitingForm] = useState(false);
  const [formA, setFormA] = useState("");
  const [formB, setFormB] = useState("");
  const [formTenggat, setFormTenggat] = useState(TENGGAT_OPTS[0]);
  const [selPopup, setSelPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const [selRevOpen, setSelRevOpen] = useState(false);
  const [selRevInput, setSelRevInput] = useState("");
  const dragging = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const docBodyRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const askCtrl = useRef<AbortController | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInstruksi = useRef("");
  const lastPrompt = useRef("");
  const lastOpts = useRef<{ revision?: boolean; toneOverride?: string } | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const execMenuRef = useRef<HTMLDivElement>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);
  const toneMenuRef = useRef<HTMLDivElement>(null);
  const selPopRef = useRef<HTMLDivElement>(null);

  const kosongTotal = !sessionId && msgs.length === 0;
  const adaDokumen = body.trim().length > 0 || curId !== null;
  const placeholderCount = (body.match(/\[[^\]]+\]/g) || []).length;

  const onEdit = (html: string) => {
    if (!curId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void api.drafts.updateBody(curId, html), 600);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LineSpacing,
    ],
    content: body,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'w-full bg-white text-black min-h-[1056px] shadow-2xl rounded-none focus:outline-none focus:ring-0 border-none outline-none tiptap mx-auto',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setBody(html);
      onEdit(html);
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== body) {
      editor.commands.setContent(body);
    }
  }, [body, editor]);

  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }); }, [msgs, typing, activeStep, draftingStepsOpen, awaitingForm]);
  useEffect(() => () => askCtrl.current?.abort(), []);

  /* Tahapan berjalan tiap 1,5s lalu TERTAHAN di langkah akhir — penyelesaian dipicu
   * selesainya panggilan AI nyata (generateDraft). */
  useEffect(() => {
    if (!isDrafting || activeStep >= DRAFTING_STEPS.length - 1) return;
    const timer = setTimeout(() => setActiveStep((s) => s + 1), 1500);
    return () => clearTimeout(timer);
  }, [isDrafting, activeStep]);

  /* Efek mengetik — HTML hasil AI ditulis ke editor bertahap (token/tag demi token). */
  useEffect(() => {
    if (!streamHtml) return;
    const tokens: string[] = [];
    let i = 0;
    while (i < streamHtml.length) {
      if (streamHtml[i] === '<') {
        let end = streamHtml.indexOf('>', i);
        if (end === -1) end = streamHtml.length - 1;
        tokens.push(streamHtml.slice(i, end + 1));
        i = end + 1;
      } else {
        let textChunk = streamHtml.slice(i, i + 2);
        let tagOpen = textChunk.indexOf('<');
        if (tagOpen !== -1) textChunk = textChunk.slice(0, tagOpen);
        tokens.push(textChunk);
        i += textChunk.length;
      }
    }

    let currentIdx = 0;
    let currentHtml = "";
    const timer = setInterval(() => {
      if (currentIdx >= tokens.length) {
        clearInterval(timer);
        setStreamHtml(null);
        return;
      }
      currentHtml += tokens[currentIdx];
      setBody(currentHtml);
      currentIdx++;
    }, 10);

    return () => clearInterval(timer);
  }, [streamHtml]);

  useEffect(() => {
    void api.drafts.list().then((r) => { if (mounted.current && r.ok) setProjects(r.data); });
  }, [mounted]);

  useEffect(() => {
    if (menuAt === null) return;
    const h = () => setMenuAt(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [menuAt]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) setModelOpen(false);
    };
    if (modelOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [modelOpen]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (execMenuRef.current && !execMenuRef.current.contains(e.target as Node)) setExecOpen(false);
    };
    if (execOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [execOpen]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (historyMenuRef.current && !historyMenuRef.current.contains(e.target as Node)) setHistoryOpen(false);
    };
    if (historyOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [historyOpen]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (toneMenuRef.current && !toneMenuRef.current.contains(e.target as Node)) setToneOpen(false);
    };
    if (toneOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [toneOpen]);

  /* Riwayat dropdown → sesi chat Drafter dari Supabase (domain 'draft'). */
  useEffect(() => {
    if (!historyOpen) return;
    void api.chat.listSessions("draft").then((r) => { if (mounted.current && r.ok) setSessions(r.data); });
  }, [historyOpen, mounted]);

  /* Popup "Revisi dengan Jago" — pantau di level document: seleksi panjang (mouseup di mana pun)
   * tetap terdeteksi; tutup hanya bila seleksi kosong dan klik di luar popup. */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (selPopRef.current?.contains(e.target as Node)) return; // klik di dalam popup
      const sel = window.getSelection();
      const ok = sel && !sel.isCollapsed && sel.toString().trim() &&
        docBodyRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer);
      if (ok) {
        const rect = sel!.getRangeAt(0).getBoundingClientRect();
        setSelPopup({ x: rect.left + rect.width / 2, y: rect.top, text: sel!.toString() });
        setSelRevOpen(false); setSelRevInput("");
      } else {
        setSelPopup(null); setSelRevOpen(false);
      }
    };
    document.addEventListener("mouseup", h);
    return () => document.removeEventListener("mouseup", h);
  }, []);

  // resizable divider — native mouse events, tanpa dependency
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const newW = e.clientX - rect.left;
      setLeftW(Math.min(560, Math.max(260, newW)));
    };
    const up = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  const bersihkanKompose = () => {
    setCurId(null); setSessionId(null); setMsgs([]); setBody(""); setModel(MODELS[0].n); setTone(TONES[0]);
    setRightView('empty'); setDraftReady(false); setVersion(1); setAwaitingForm(false);
    setFormA(""); setFormB(""); setFormTenggat(TENGGAT_OPTS[0]); setSelPopup(null);
  };

  const bukaProjek = async (p: Project) => {
    setRightView('editor');
    setCurId(p.id); setSessionId(p.session_id); setBody(p.body); setModel(p.model); setTone(p.tone);
    setMsgs([]); setDraftReady(!!p.body.trim()); setVersion(1); setAwaitingForm(false);
    if (p.session_id) {
      const r = await api.chat.listMessages(p.session_id);
      if (mounted.current && r.ok) setMsgs(r.data.map((m) => ({ role: m.role, content: m.content })));
    }
  };

  /* Inline rename sesi & projek — edit di posisi teks, tanpa pop-up */
  const [editSesi, setEditSesi] = useState<string | null>(null);
  const [editProj, setEditProj] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const simpanRenameSesi = async () => {
    const id = editSesi; const nama = editVal.trim();
    setEditSesi(null);
    if (!id || !nama) return;
    const r = await api.chat.renameSession(id, nama);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setSessions((xs) => xs.map((x) => (x.id === id ? { ...x, title: nama } : x)));
  };
  const simpanRenameProj = async () => {
    const id = editProj; const nama = editVal.trim();
    setEditProj(null);
    if (!id || !nama) return;
    const r = await api.drafts.rename(id, nama);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setProjects((xs) => xs.map((x) => (x.id === id ? { ...x, title: nama } : x)));
  };

  const hapusSesi = async (s: { id: string; title: string }) => {
    setMenuAt(null);
    if (!(await askConfirm(`Hapus percakapan "${s.title}"? Pesan di dalamnya ikut terhapus.`))) return;
    const r = await api.chat.deleteSession(s.id);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setSessions((xs) => xs.filter((x) => x.id !== s.id));
    if (sessionId === s.id) bersihkanKompose();
    toast("Percakapan dihapus", `"${s.title}" dikeluarkan dari riwayat.`, "warn");
  };

  const hapusProjek = async (p: Project) => {
    setMenuAt(null);
    if (!(await askConfirm(`Hapus projek "${p.title}"?`))) return;
    const r = await api.drafts.remove(p.id);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setProjects((xs) => xs.filter((x) => x.id !== p.id));
    if (curId === p.id) bersihkanKompose();
  };

  /* Simpan manual ke Projek (ikon simpan di toolbar). Draft sudah auto-simpan saat pertama jadi;
   * tombol ini menyimpan ulang bila user membuka sesi lama tanpa projek, atau memaksa snapshot. */
  const simpanKeProjek = async () => {
    if (!body.trim()) { toast("Draft kosong", "Belum ada dokumen untuk disimpan.", "warn"); return; }
    if (curId) { // sudah jadi projek — cukup dorong isi terbaru
      const r = await api.drafts.updateBody(curId, body);
      if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
      setProjects((xs) => xs.map((p) => (p.id === curId ? { ...p, body } : p)));
      return toast("Projek diperbarui", "Isi draft terbaru tersimpan.", "ok");
    }
    const title = (msgs.find((m) => m.role === "user")?.content || "Draft baru").slice(0, 44);
    const r = await api.drafts.create(sessionId, title, body, model, tone);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    setProjects((xs) => [r.data, ...xs]);
    setCurId(r.data.id);
    toast("Tersimpan ke Projek", `${title} — muncul di daftar Projek.`, "ok");
  };

  /* Klik item Riwayat: kalau sesi punya projek (draft_projects.session_id) buka utuh
   * (chat + dokumen); kalau tidak, muat pesan chat-nya saja. */
  const bukaSesi = async (s: { id: string; title: string }) => {
    const p = projects.find((x) => x.session_id === s.id);
    if (p) { void bukaProjek(p); return; }
    setCurId(null); setSessionId(s.id); setBody(""); setRightView("empty"); setDraftReady(false);
    const r = await api.chat.listMessages(s.id);
    if (mounted.current && r.ok) { setMsgs(r.data.map((m) => ({ role: m.role, content: m.content }))); setDraftReady(r.data.length > 0); }
  };

  /* Prompt final ke AI: instruksi + nada, dan (revisi) dokumen berjalan sebagai konteks —
   * bukan riwayat multi-turn, supaya token tak membengkak oleh dokumen panjang berulang. */
  const buildDraftPrompt = (base: string, opts?: { revision?: boolean; toneOverride?: string }) => {
    const parts = [base, `Nada penulisan: ${opts?.toneOverride ?? tone}.`];
    if (opts?.revision) {
      const plain = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (plain) parts.push(`Dokumen saat ini (revisi ini — kembalikan versi LENGKAP hasil revisi, jangan buat dari nol):\n${plain.slice(0, 6000)}`);
    }
    return parts.join("\n\n");
  };

  const applyToEditor = (html: string) => {
    setRightView("editor");
    setVersion((v) => v + 1);
    setDraftReady(true);
    setStreamHtml(html);
    if (curId) { void api.drafts.updateBody(curId, html); return; }
    // auto-simpan ke Projek saat draf pertama jadi — edit selanjutnya tersimpan real-time (onEdit)
    const title = (pendingInstruksi.current || msgs.find((m) => m.role === "user")?.content || "Draft baru").slice(0, 44);
    void api.drafts.create(sessionId, title, html, model, tone).then((r) => {
      if (!mounted.current || !r.ok) return;
      setProjects((xs) => [r.data, ...xs]);
      setCurId(r.data.id);
    });
  };

  const generateDraft = async (basePrompt: string, opts?: { revision?: boolean; toneOverride?: string }) => {
    lastPrompt.current = basePrompt; lastOpts.current = opts;
    setSelPopup(null); setSelRevOpen(false);
    setIsDrafting(true); setActiveStep(0); setDraftingStepsOpen(true);
    askCtrl.current?.abort();
    const ctrl = new AbortController();
    askCtrl.current = ctrl;
    const res = await api.ai.chatStream({
      messages: [{ role: "user", content: buildDraftPrompt(basePrompt, opts) }],
      model, signal: ctrl.signal, mode: "draft",
      company: ten ? { name: ten.name, sector: ten.sector, entity: ten.corp.entity } : undefined,
      onDelta: () => {}, // tahapan visual sudah mewakili "sedang bekerja" — teks mentah tak ditampilkan
    });
    setIsDrafting(false);
    if (!mounted.current) return;
    if (!res.ok) {
      if (res.error.code !== "aborted") toast("AI belum merespons", res.error.message, "warn");
      return;
    }
    const [ringkasan, dok] = splitDraft(res.data);
    const html = dok.split(/\n{2,}/).map((p) => `<p>${mdHtml(p).replace(/\n/g, "<br/>")}</p>`).join("");
    const sid = sessionId;
    if (execMode === "plan") {
      setMsgs((m) => [...m, { role: "assistant", content: ringkasan, stagedHtml: html }]);
    } else {
      setMsgs((m) => [...m, { role: "assistant", content: ringkasan }]);
      applyToEditor(html);
    }
    if (sid) void api.chat.addMessage(sid, "assistant", ringkasan, model);
  };

  const terapkan = (idx: number) => {
    const m = msgs[idx];
    if (!m.stagedHtml) return;
    applyToEditor(m.stagedHtml);
    setMsgs((ms) => ms.map((x, i) => (i === idx ? { ...x, applied: true } : x)));
  };

  const submitForm = (skip: boolean) => {
    setAwaitingForm(false);
    const detail = skip ? "" : [
      formA.trim() && `Pihak terkait/penerima: ${formA.trim()}`,
      formB.trim() && `Inti permintaan/tuntutan: ${formB.trim()}`,
      formTenggat !== TENGGAT_OPTS[0] && `Tenggat pemenuhan: ${formTenggat}`,
    ].filter(Boolean).join(" · ");
    const base = detail ? `${pendingInstruksi.current}\n\nDetail tambahan: ${detail}` : pendingInstruksi.current;
    setFormA(""); setFormB(""); setFormTenggat(TENGGAT_OPTS[0]);
    void generateDraft(base);
  };

  const sending = useRef(false);
  const kirim = async (teksAwal?: string) => {
    const text = (teksAwal ?? input).trim();
    if (!text || sending.current) return;
    sending.current = true;
    setInput("");

    let sid = sessionId;
    if (!sid) {
      const r = await api.chat.createSession("draft");
      if (!r.ok) { sending.current = false; toast("Gagal", r.error.message, "warn"); setInput(text); return; }
      setSessionId(r.data.id); sid = r.data.id;
      void api.chat.renameSession(sid, text.slice(0, 38) + (text.length > 38 ? "…" : "")); // judul riwayat
    }
    setMsgs((m) => [...m, { role: "user", content: text }]);
    void api.chat.addMessage(sid, "user", text);

    if (!draftReady) {
      // dokumen pertama di sesi ini: beat "berpikir" singkat (tanpa panggilan API — hemat token),
      // lalu form detail kunci; AI baru benar-benar dipanggil setelah user Susun Draft.
      pendingInstruksi.current = text;
      setTyping(true);
      await new Promise((r) => setTimeout(r, 850));
      sending.current = false;
      if (!mounted.current) return;
      setTyping(false);
      setAwaitingForm(true);
      return;
    }
    sending.current = false;
    void generateDraft(text, { revision: true });
  };

  const gantiTone = (t: string) => {
    setTone(t);
    if (curId) void api.drafts.updateTone(curId, t);
    if (draftReady) void generateDraft(`Ubah nada penulisan dokumen menjadi "${t}" tanpa mengubah substansi hukum atau struktur pasal.`, { revision: true, toneOverride: t });
  };

  const dropFile = (f?: File) => {
    if (!f) return;
    toast("Dokumen pendukung diterima", `${f.name} — AI akan ekstrak fakta (pihak, tanggal, nominal) untuk mengisi draf.`, "ok");
  };

  const submitSelRevision = () => {
    if (!selPopup) return;
    const instr = selRevInput.trim() || "Perbaiki dan perjelas redaksi bagian ini";
    void generateDraft(`Revisi khusus pada bagian berikut sesuai instruksi: "${instr}".\n\nBagian terpilih:\n"""${selPopup.text}"""`, { revision: true });
    setSelPopup(null); setSelRevOpen(false);
  };

  return (
    <div>
      <style>{`
        .content:has(.dr-wrap){padding-bottom:26px}
        .dr-wrap{display:flex;height:calc(100vh - 114px);min-height:460px;background:var(--sur);border:1px solid var(--line);border-radius:14px;overflow:hidden}
        .dr-left{display:flex;flex-direction:column;min-width:0;border-right:1px solid var(--line)}
        .dr-drag{width:5px;flex:0 0 auto;cursor:col-resize;background:transparent;position:relative}
        .dr-drag:hover::after,.dr-drag.on::after{content:"";position:absolute;inset:0 2px;background:var(--blue-400)}
        .dr-right{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
        .dr-hd{padding:12px 15px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:9px}
        .dr-navpill{display:grid;grid-template-columns:repeat(3, 1fr);width:100%;max-width:680px;background:#0A1830;border:1px solid var(--line);border-radius:12px;padding:4px;gap:4px}
        .dr-navpill > div > button, .dr-navpill > button{width:100%;background:none;border:none;color:var(--txt2);font-size:13px;font-weight:600;padding:9px;border-radius:9px;cursor:pointer;transition:.15s;display:flex;align-items:center;justify-content:center;gap:6px}
        .dr-navpill > div > button:hover, .dr-navpill > button:hover{background:rgba(58,96,166,.15);color:#fff}
        .dr-navpill > div > button.on, .dr-navpill > button.on{background:linear-gradient(170deg,var(--navy-600),var(--navy-700));color:#fff;box-shadow:0 2px 5px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.1)}
        .dr-lbl{font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:#5E76A8;margin:8px 13px 4px;display:flex;align-items:center;gap:6px}
        .dr-pit{position:relative;display:flex;align-items:center;gap:6px;border-radius:9px;padding:9px 10px;cursor:pointer;transition:.15s}
        .dr-pit:hover{background:rgba(58,96,166,.12)}
        .dr-pit.on{background:rgba(58,96,166,.22)}
        .dr-pit b{flex:1;min-width:0;font-size:12px;color:var(--txt);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .dr-menu{position:absolute;top:32px;right:6px;background:#0E1C38;border:1px solid var(--line2);border-radius:10px;box-shadow:var(--shadow-lg);z-index:650;overflow:hidden;min-width:120px;animation:drop .15s ease}
        .dr-menu button{display:block;width:100%;text-align:left;background:none;border:none;padding:9px 12px;font-size:12px;color:var(--txt);cursor:pointer}
        .dr-menu button:hover{background:var(--sur-2)}
        .dr-menu .del{color:#F07A76}
        .dr-chat{flex:1;min-height:0;overflow-y:auto;padding:14px}
        .dr-hero{text-align:center;padding:8px 4px 4px}
        .dr-hero b{display:block;font-size:14px;color:#fff;margin-bottom:3px}
        .dr-hero p{font-size:11.5px;color:var(--muted);margin-bottom:12px}
        .dr-ex{display:block;width:100%;text-align:left;background:rgba(16,33,61,.6);border:1px solid rgba(28,48,84,.8);border-radius:11px;padding:10px 12px;font-size:12px;color:var(--txt2);cursor:pointer;margin-bottom:8px;transition:.15s;line-height:1.5}
        .dr-ex:hover{border-color:var(--blue-400);color:#fff}
        .dr-bub{margin-bottom:10px}
        .dr-bub.q{background:rgba(58,96,166,.22);border-radius:11px 11px 3px;padding:9px 12px;font-size:12.5px;color:#fff;margin-left:20%}
        .dr-bub.a{background:rgba(16,33,61,.55);border:1px solid rgba(28,48,84,.8);border-radius:11px;padding:10px 13px;font-size:12px;color:var(--txt2);line-height:1.6}
        .dr-bub.a .acts{display:flex;gap:2px;margin-top:7px}
        .dr-bub.a .acts button{background:none;border:none;color:var(--muted);cursor:pointer;padding:4px;border-radius:6px}
        .dr-bub.a .acts button:hover{color:#fff;background:rgba(58,96,166,.18)}
        .dr-doc{width:26px;height:32px;border:1.5px solid var(--gold-bright);border-radius:3px;position:relative;flex:0 0 auto}
        .dr-doc::before,.dr-doc::after{content:"";position:absolute;left:4px;right:4px;height:2px;background:rgba(217,188,128,.5);animation:drline 1.6s ease-in-out infinite}
        .dr-doc::before{top:8px}
        .dr-doc::after{top:14px;animation-delay:.3s}
        @keyframes drline{0%,100%{opacity:.25;transform:scaleX(.4)}50%{opacity:1;transform:scaleX(1)}}
        .ai-think{display:flex;align-items:center;gap:10px;padding:4px 2px;font-size:12.5px;color:var(--txt2)}
        .ai-think .brain{color:var(--gold-bright);animation:pl 1.3s ease-in-out infinite}
        .caret{display:inline-block;width:7px;height:14px;margin-left:3px;vertical-align:middle;background:var(--gold-bright);animation:pl 1s steps(2) infinite}
        .dr-input{padding:12px 16px;border-top:1px solid var(--line);display:flex;justify-content:center}
        .dr-pill{display:flex;align-items:center;gap:6px;width:100%;background:#0A1830;border:1px solid var(--line);border-radius:100px;padding:6px 8px 6px 10px;transition:.2s}
        .dr-pill:focus-within{border-color:var(--blue-400)}
        .dr-pill input[type="text"],.dr-pill input:not([type]){flex:1 1 70px;min-width:70px;background:none;border:none;outline:none;font-size:13px;color:var(--txt);font-family:inherit}
        .dr-attach{flex:0 0 auto;background:none;border:none;color:var(--muted);cursor:pointer;padding:7px;border-radius:50%;display:grid;place-items:center}
        .dr-attach:hover{color:#fff;background:rgba(58,96,166,.15)}
        .dr-modelbtn{display:flex;align-items:center;gap:4px;background:none;border:none;border-radius:8px;padding:6px 8px;font-size:12px;font-weight:600;color:var(--blue-300);cursor:pointer;white-space:nowrap}
        .dr-modelbtn:hover{background:rgba(58,96,166,.15)}
        .dr-pick{position:absolute;bottom:calc(100% + 8px);right:0;width:264px;background:#0E1C38;border:1px solid var(--line2);border-radius:13px;box-shadow:var(--shadow-lg);overflow:hidden;z-index:9999;animation:drop .18s ease}
        .dr-pick-it{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;padding:11px 14px;cursor:pointer;transition:.15s}
        .dr-pick-it:hover{background:var(--sur-2)}
        .dr-pick-it b{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#fff;font-weight:600}
        .dr-pick-it b i{font-style:normal;font-family:var(--mono);font-size:8px;letter-spacing:.1em;color:var(--blue-300);margin-left:4px}
        .dr-pick-it span{font-size:11px;color:var(--muted)}
        .dr-pick-it div{flex:1}
        .dr-send2{flex:0 0 auto;width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;display:grid;place-items:center;color:#fff;background:linear-gradient(150deg,var(--navy-600),var(--navy-800));transition:.18s}
        .dr-send2:hover{filter:brightness(1.2)}
        .dr-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:30px;overflow-y:auto}
        .dr-skel{width:160px;height:96px;background:rgba(16,33,61,.6);border:1px solid rgba(28,48,84,.8);border-radius:11px;padding:14px;display:flex;flex-direction:column;gap:8px;margin-bottom:6px}
        .dr-skel i{height:6px;border-radius:4px;background:rgba(90,130,200,.28)}
        .dr-banner{background:rgba(176,138,62,.12);border-bottom:1px solid rgba(176,138,62,.35);color:var(--gold-deep);font-size:11.5px;font-weight:600;padding:8px 15px;display:flex;align-items:center;gap:8px}
        .dr-toolbar{display:flex;align-items:center;gap:4px;padding:8px 12px;border-bottom:1px solid var(--line);flex-wrap:wrap}
        .dr-toolbar button{background:none;border:none;color:var(--txt2);cursor:pointer;padding:6px;border-radius:7px;display:grid;place-items:center}
        .dr-toolbar button:hover{background:rgba(58,96,166,.15);color:#fff}
        .dr-toolbar button.on{background:rgba(58,96,166,.25);color:var(--blue-300)}
        .dr-toolbar select.dr-select{border:1px solid var(--line);border-radius:7px;padding:5px 7px;font-size:11px;background:#0A1830;color:var(--txt2);margin:0 4px;outline:none;cursor:pointer}
        .dr-toolbar select.dr-select:focus{border-color:var(--blue-400)}
        .dr-sep{width:1px;height:20px;background:var(--line);margin:0 6px}
        .dr-save{display:grid;place-items:center;background:linear-gradient(135deg,var(--gold-bright),var(--gold));color:#0B1526;border:none;border-radius:8px;padding:6px;cursor:pointer;margin-left:8px}
        .dr-doc-body{flex:1;min-height:0;overflow-y:auto;padding:48px;background:var(--sur);display:flex;justify-content:center;position:relative}
        .dr-manage{padding:30px 40px;flex:1;overflow-y:auto;background:var(--sur)}
        .dr-manage h2{font-family:var(--serif);font-size:22px;color:#fff;margin-bottom:20px}
        .dr-table{display:flex;flex-direction:column;gap:8px}
        .dr-table .tr{display:flex;align-items:center;justify-content:space-between;background:rgba(16,33,61,.4);border:1px solid var(--line);border-radius:11px;padding:14px 18px;transition:.15s}
        .dr-table .tr:hover{background:rgba(58,96,166,.12);border-color:var(--blue-400)}
        .dr-table .tr b{display:block;font-size:14px;color:#fff;font-weight:600;margin-bottom:4px}
        .dr-table .tr span{font-size:12px;color:var(--muted)}
        .dr-table .tr button{background:none;border:none;color:var(--muted);cursor:pointer;padding:4px;border-radius:6px}
        .dr-table .tr button:hover{color:#fff;background:rgba(58,96,166,.2)}
        .dr-hist{max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:0 4px 4px}
        .dr-menu .dr-it{padding-right:34px} /* ruang utk titik-tiga: judul tak tertabrak */
        .dr-menu .dr-it .dr-dots{position:absolute;right:6px;top:50%;transform:translateY(-50%)}
        .dr-it{position:relative;display:flex;align-items:center;gap:6px;border-radius:9px;padding:8px 11px;cursor:pointer;transition:.15s}
        .dr-it b{flex:1;min-width:0;font-size:12.5px;color:var(--txt);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .dr-it:hover{background:rgba(58,96,166,.12)}
        .dr-it.on{background:rgba(58,96,166,.22)}
        .dr-it.on b{color:#fff}
        .dr-dots{flex:0 0 auto;background:none;border:none;cursor:pointer;color:var(--muted);padding:2px;border-radius:6px;opacity:0;transition:.15s;display:grid;place-items:center}
        .dr-it:hover .dr-dots{opacity:1}
        .dr-dots:hover{color:#fff;background:rgba(58,96,166,.3)}
        .dr-menu-opts{position:absolute;top:32px;right:6px;background:#0E1C38;border:1px solid var(--line2);border-radius:10px;box-shadow:var(--shadow-lg);z-index:1000;overflow:hidden;min-width:130px;animation:drop .15s ease}
        .dr-menu-opts button{display:block;width:100%;text-align:left;background:none;border:none;padding:9px 13px;font-size:12px;color:var(--txt);cursor:pointer}
        .dr-menu-opts button:hover{background:var(--sur-2)}
        .dr-menu-opts .del{color:#F07A76}
        .dr-pulse{animation:pulse 2.5s cubic-bezier(.4,0,.6,1) infinite}
        .dr-loader { width: 16px; aspect-ratio: 1; display: grid; flex: 0 0 auto; border-radius: 50%; }
        .dr-loader::before, .dr-loader::after { content: ""; grid-area: 1/1; border-radius: 50%; --c1: no-repeat radial-gradient(circle closest-side, var(--gold-bright) 92%, transparent); --c2: no-repeat radial-gradient(circle closest-side, var(--blue-400) 92%, transparent); background: var(--c1) 50% 0, var(--c2) 50% 100%, var(--c2) 100% 50%, var(--c1) 0 50%; background-size: 4px 4px; animation: dr-l12 1s infinite; }
        .dr-loader::before { margin: 2px; filter: brightness(1.2); background-size: 3px 3px; animation-timing-function: linear; }
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes dr-l12{100%{transform: rotate(.5turn)}}
        .dr-attach input[type=file]{display:none}
        .dr-formcard{background:rgba(16,33,61,.65);border:1px solid rgba(58,96,166,.35);border-radius:13px;padding:14px 15px;margin-top:4px}
        .dr-formcard-hd{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:#fff;margin-bottom:4px}
        .dr-formcard p{font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:12px}
        .dr-formcard label{display:block;font-size:11px;font-weight:600;color:var(--txt2);margin-bottom:5px}
        .dr-formcard input{width:100%;background:#0A1830;border:1px solid var(--line);border-radius:8px;padding:8px 11px;font-size:12px;color:#fff;outline:none;margin-bottom:12px}
        .dr-formcard input:focus{border-color:var(--blue-400)}
        .dr-chipgroup{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
        .dr-chipgroup button{background:#0A1830;border:1px solid var(--line);color:var(--txt2);font-size:11px;padding:6px 11px;border-radius:100px;cursor:pointer;transition:.15s}
        .dr-chipgroup button.on{background:var(--blue-400);border-color:var(--blue-400);color:#fff;font-weight:600}
        .dr-formcard .row{display:flex;justify-content:space-between;align-items:center}
        .dr-formcard .skip{background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer}
        .dr-formcard .skip:hover{color:#fff}
        .dr-tonelbl{font-family:var(--mono);font-size:9px;letter-spacing:.14em;color:#5E76A8;margin-right:2px}
        .dr-tonepill{background:none;border:1px solid var(--line);color:var(--txt2);font-size:11.5px;font-weight:600;padding:5px 11px;border-radius:100px;cursor:pointer;transition:.15s}
        .dr-tonepill:hover{border-color:var(--blue-400);color:#fff}
        .dr-tonepill.on{background:linear-gradient(170deg,var(--navy-600),var(--navy-700));border-color:transparent;color:#fff}
        .dr-badge{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;color:var(--gold-deep);background:rgba(176,138,62,.12);border:1px solid rgba(176,138,62,.3);border-radius:100px;padding:3px 9px}
        .dr-apply{margin-top:8px;background:linear-gradient(135deg,var(--gold-bright),var(--gold));color:#0B1526;border:none;font-size:11.5px;font-weight:700;padding:7px 13px;border-radius:8px;cursor:pointer}
        .dr-selpop{position:fixed;transform:translate(-50%,calc(-100% - 8px));z-index:2000}
        .dr-selpop-btn{display:flex;align-items:center;gap:6px;background:linear-gradient(150deg,var(--navy-700),var(--navy-900));border:1px solid var(--blue-400);color:#fff;font-size:12px;font-weight:600;padding:8px 13px;border-radius:100px;cursor:pointer;box-shadow:var(--shadow-lg);white-space:nowrap}
        .dr-selpop-btn:hover{filter:brightness(1.15)}
        .dr-selpop-box{display:flex;align-items:center;gap:6px;background:#0E1C38;border:1px solid var(--line2);border-radius:100px;padding:5px 6px 5px 14px;box-shadow:var(--shadow-lg);width:260px}
        .dr-selpop-box input{flex:1;background:none;border:none;outline:none;color:#fff;font-size:12px}
        .dr-selpop-box button{flex:0 0 auto;width:26px;height:26px;border-radius:50%;border:none;background:var(--blue-400);color:#fff;display:grid;place-items:center;cursor:pointer}
      `}</style>

      <div className="dr-wrap" ref={wrapRef}>
        {/* ===== KIRI ===== */}
        <div className="dr-left" style={{ width: leftW }}>
          <div className="dr-hd" style={{ justifyContent: "center" }}>
            <div className="dr-navpill">
              <div style={{ position: "relative" }} ref={historyMenuRef}>
                <button className={historyOpen ? "on" : ""} onClick={() => setHistoryOpen(!historyOpen)}>
                  Riwayat <ChevronDown size={12} style={{ transition: ".2s", transform: historyOpen ? "rotate(180deg)" : "none" }} />
                </button>
                {historyOpen && (
                  <div className="dr-menu" style={{ top: "calc(100% + 8px)", left: 0, minWidth: 260, zIndex: 999 }}>
                    <div style={{ padding: "10px 13px 4px", fontSize: 10, fontWeight: 700, color: "#5E76A8", letterSpacing: "0.08em" }}>PERCAKAPAN TERAKHIR</div>
                    <div className="dr-hist">
                      {sessions.map((s) => (
                        <div key={s.id} className={`dr-it${s.id === sessionId ? " on" : ""}`} onClick={() => { if (editSesi !== s.id) { void bukaSesi(s); setHistoryOpen(false); } }}>
                          {editSesi === s.id ? (
                            <input autoFocus value={editVal} onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditVal(e.target.value)}
                              onBlur={() => void simpanRenameSesi()}
                              onKeyDown={(e) => { if (e.key === "Enter") void simpanRenameSesi(); if (e.key === "Escape") setEditSesi(null); }}
                              style={{ background: "var(--sur-2)", border: "1px solid var(--gold)", borderRadius: 6, color: "var(--txt)", fontSize: 12, padding: "3px 8px", width: "100%" }} />
                          ) : <b title={s.title}>{s.title}</b>}
                          <button className="dr-dots" onClick={(e) => { e.stopPropagation(); setMenuAt(menuAt === s.id ? null : s.id); }} aria-label="Opsi percakapan"><MoreHorizontal size={14} /></button>
                          {menuAt === s.id && (
                            <div className="dr-menu-opts" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => { setMenuAt(null); setEditSesi(s.id); setEditVal(s.title); }}>Ganti nama</button>
                              <button className="del" onClick={() => void hapusSesi(s)}>Hapus</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {!sessions.length && <span style={{ fontSize: 11.5, color: "var(--muted)", padding: "8px 12px", display: "block" }}>Belum ada percakapan.</span>}
                    </div>
                  </div>
                )}
              </div>

              <button className={!curId && rightView === 'empty' && !historyOpen ? "on" : ""} onClick={() => { bersihkanKompose(); setHistoryOpen(false); }}>
                <Plus size={14} /> Baru
              </button>

              <button className={rightView === 'projek' && !historyOpen ? "on" : ""} onClick={() => { setRightView('projek'); setHistoryOpen(false); }}>
                Projek
              </button>
            </div>
          </div>

          <div className="dr-chat" ref={bodyRef}>
            {kosongTotal && (
              <div className="dr-hero">
                <b>Halo! Saya Corplex AI Drafter</b>
                <p>Tuliskan kebutuhan dokumen Anda. Beberapa contoh:</p>
                {CONTOH.map((c) => <button key={c} className="dr-ex" onClick={() => void kirim(c)}>{c}</button>)}
              </div>
            )}
            {msgs.map((m, i) => m.role === "user" ? (
              <div key={i} className="dr-bub q">{m.content}</div>
            ) : (
              <div key={i} className="dr-bub a">
                <Md t={m.content} />
                {m.stagedHtml && !m.applied && (
                  <button className="dr-apply" onClick={() => terapkan(i)}>Terapkan ke Draft</button>
                )}
                <div className="acts">
                  <button title="Suka" onClick={() => toast("Terima kasih", "Masukan Anda tercatat.", "ok")}><ThumbsUp size={14} /></button>
                  <button title="Tidak suka" onClick={() => toast("Terima kasih", "Masukan Anda membantu perbaikan.", "ok")}><ThumbsDown size={14} /></button>
                  <button title="Ulangi jawaban" onClick={() => { if (lastPrompt.current) void generateDraft(lastPrompt.current, lastOpts.current); }}><RefreshCw size={14} /></button>
                  <button title="Salin" onClick={() => { void navigator.clipboard?.writeText(m.content); toast("Disalin", "", "ok"); }}><Copy size={14} /></button>
                </div>
              </div>
            ))}
            {isDrafting && (
              <div style={{ marginTop: 8, padding: "0 4px" }}>
                <div style={{ color: "var(--blue-300)", display: "flex", justifyContent: "space-between", width: "100%", cursor: "pointer", fontSize: "11.5px" }} onClick={() => setDraftingStepsOpen(!draftingStepsOpen)}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={13} className="dr-pulse" /> Jago sedang berpikir...</span>
                  <ChevronDown size={14} style={{ transform: draftingStepsOpen ? "rotate(180deg)" : "none", transition: "transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateRows: draftingStepsOpen ? "1fr" : "0fr",
                  transition: "grid-template-rows 1.2s cubic-bezier(0.4, 0, 0.2, 1), margin-top 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  marginTop: draftingStepsOpen ? "14px" : "0px",
                }}>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "4px" }}>
                      {DRAFTING_STEPS.map((stepTxt, idx) => {
                        const isCompleted = idx < activeStep;
                        const isActive = idx === activeStep;
                        const isPending = idx > activeStep;
                        return (
                          <div key={idx} style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            opacity: isPending ? 0.4 : 1,
                            color: isActive ? "#fff" : "var(--txt2)",
                            transition: ".2s"
                          }}>
                            {isCompleted ? (
                              <Check size={14} style={{ color: "var(--ok)", flex: "0 0 auto" }} />
                            ) : isActive ? (
                              <div className="dr-loader" />
                            ) : (
                              <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--muted)", flex: "0 0 auto" }} />
                            )}
                            <span style={{
                              fontSize: isActive ? "12.5px" : isCompleted ? "11.5px" : "12px",
                              fontWeight: isActive ? 700 : 400
                            }}>{stepTxt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {typing && (
              <div className="ai-think">
                <i className="ri-brain-line brain"></i><span>Menganalisis permintaan</span><span className="caret"></span>
              </div>
            )}
          </div>

          <div className="dr-input">
            <div className="dr-pill">
              <input ref={attachRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) dropFile(f); e.target.value = ""; }} />
              <button className="dr-attach" title="Tambah dokumen pendukung" onClick={() => attachRef.current?.click()}><Plus size={15} /></button>
              <input placeholder="Tuliskan dokumen yang Anda butuhkan…" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void kirim(); } }} />

              <div style={{ position: "relative", flex: "0 0 auto" }} ref={execMenuRef}>
                <button className="dr-modelbtn" title="Mode eksekusi" onClick={() => setExecOpen((v) => !v)}>
                  {execMode === "generate" ? <Zap size={13} /> : <ClipboardList size={13} />}
                  <ChevronDown size={11} style={{ transition: ".2s", transform: execOpen ? "rotate(180deg)" : "none" }} />
                </button>
                {execOpen && (
                  <div className="dr-pick" style={{ width: 240 }}>
                    {EXEC_MODES.map((m) => (
                      <button key={m.k} className="dr-pick-it" onClick={() => { setExecMode(m.k); setExecOpen(false); }}>
                        <m.Ico size={14} style={{ color: "var(--blue-300)", flex: "0 0 auto" }} />
                        <div><b>{m.label}</b><span>{m.d}</span></div>
                        {execMode === m.k && <Check size={15} style={{ color: "var(--blue-300)" }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ position: "relative", flex: "0 0 auto" }} ref={modelMenuRef}>
                <button className="dr-modelbtn" title={`Model: ${model}`} onClick={() => setModelOpen((v) => !v)}>
                  <Brain size={14} />
                  <ChevronDown size={11} style={{ transition: ".2s", transform: modelOpen ? "rotate(180deg)" : "none" }} />
                </button>
                {modelOpen && (
                  <div className="dr-pick">
                    {MODELS.map((m) => (
                      <button key={m.n} className="dr-pick-it" onClick={() => { setModel(m.n); setModelOpen(false); }}>
                        <div><b>{m.n} <i>{m.tag}</i></b><span>{m.d}</span></div>
                        {model === m.n && <Check size={15} style={{ color: "var(--blue-300)" }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="dr-send2" onClick={() => void kirim()} aria-label="Kirim"><ArrowUp size={16} /></button>
            </div>
          </div>
        </div>

        <div className={`dr-drag${dragging.current ? " on" : ""}`} onMouseDown={() => { dragging.current = true; document.body.style.userSelect = "none"; }} />

        {/* ===== KANAN ===== */}
        <div className="dr-right">
          {awaitingForm ? (
            <div className="dr-empty">
              <div className="dr-formcard" style={{ width: "min(460px, 92%)" }}>
                <div className="dr-formcard-hd"><Sparkles size={13} style={{ color: "var(--blue-300)" }} /> Beberapa detail kunci dulu</div>
                <p>Isi term penting agar draf pakai data nyata (boleh dilewati — nanti tinggal diedit).</p>
                <label>Pihak terkait / penerima?</label>
                <input value={formA} onChange={(e) => setFormA(e.target.value)} placeholder="mis. PT Mitra Jaya" />
                <label>Inti permintaan / tuntutan?</label>
                <input value={formB} onChange={(e) => setFormB(e.target.value)} placeholder="mis. Pembayaran Rp 200.000.000 dalam 14 hari" />
                <label>Tenggat pemenuhan?</label>
                <div className="dr-chipgroup">
                  {TENGGAT_OPTS.map((o) => <button key={o} className={formTenggat === o ? "on" : ""} onClick={() => setFormTenggat(o)}>{o}</button>)}
                </div>
                <div className="row">
                  <button className="skip" onClick={() => submitForm(true)}>Lewati</button>
                  <button className="dr-apply" style={{ padding: "5px 11px", fontSize: 11 }} onClick={() => submitForm(false)}>Susun Draft →</button>
                </div>
              </div>
            </div>
          ) : rightView === 'empty' ? (
            <div className="dr-empty">
              <div className="dr-skel" style={{ opacity: 0.6, marginBottom: 16 }}><i style={{ width: "70%" }} /><i style={{ width: "45%" }} /><i style={{ width: "85%" }} /><i style={{ width: "55%" }} /></div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Area Drafting</h2>
              <p style={{ color: "var(--muted)", fontSize: 13, maxWidth: 360, textAlign: "center", lineHeight: 1.5 }}>
                Tuliskan instruksi dokumen di panel obrolan sebelah kiri. AI akan menyusun draf Anda secara otomatis di area ini.
              </p>
            </div>
          ) : rightView === 'editor' ? (
            <>
              {adaDokumen && (
                <div className="dr-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '12px', flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={14} style={{ flex: "0 0 auto" }} /> DRAF · wajib direview advokat profesional
                  </div>
                  <div style={{ position: "relative" }} ref={toneMenuRef}>
                    <button className={`dr-tonepill${toneOpen ? " on" : ""}`} onClick={() => setToneOpen((v) => !v)}>Nada · {tone} <ChevronDown size={11} style={{ display: "inline", transition: ".2s", transform: toneOpen ? "rotate(180deg)" : "none" }} /></button>
                    {toneOpen && (
                      <div className="dr-menu" style={{ top: "calc(100% + 6px)", right: 0, minWidth: 150 }}>
                        {TONES.map((t) => (
                          <button key={t} onClick={() => { gantiTone(t); setToneOpen(false); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            {t} {tone === t && <Check size={13} style={{ color: "var(--gold-bright)" }} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="dr-toolbar">
                <button className={editor?.isActive('bold') ? 'on' : ''} onClick={() => editor?.chain().focus().toggleBold().run()}><i className="ri-bold"></i></button>
                <button className={editor?.isActive('italic') ? 'on' : ''} onClick={() => editor?.chain().focus().toggleItalic().run()}><i className="ri-italic"></i></button>
                <button className={editor?.isActive('underline') ? 'on' : ''} onClick={() => editor?.chain().focus().toggleUnderline().run()}><i className="ri-underline"></i></button>
                <button className={editor?.isActive('strike') ? 'on' : ''} onClick={() => editor?.chain().focus().toggleStrike().run()}><i className="ri-strikethrough"></i></button>

                <div className="dr-sep" />
                <button className={editor?.isActive('heading', { level: 1 }) ? 'on' : ''} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><i className="ri-h-1"></i></button>
                <button className={editor?.isActive('heading', { level: 2 }) ? 'on' : ''} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><i className="ri-h-2"></i></button>
                <button className={editor?.isActive('heading', { level: 3 }) ? 'on' : ''} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><i className="ri-h-3"></i></button>

                <div className="dr-sep" />
                <button className={editor?.isActive({ textAlign: 'left' }) ? 'on' : ''} onClick={() => editor?.chain().focus().setTextAlign('left').run()}><i className="ri-align-left"></i></button>
                <button className={editor?.isActive({ textAlign: 'center' }) ? 'on' : ''} onClick={() => editor?.chain().focus().setTextAlign('center').run()}><i className="ri-align-center"></i></button>
                <button className={editor?.isActive({ textAlign: 'right' }) ? 'on' : ''} onClick={() => editor?.chain().focus().setTextAlign('right').run()}><i className="ri-align-right"></i></button>
                <button className={editor?.isActive({ textAlign: 'justify' }) ? 'on' : ''} onClick={() => editor?.chain().focus().setTextAlign('justify').run()}><i className="ri-align-justify"></i></button>

                <div className="dr-sep" />
                <button className={editor?.isActive('bulletList') ? 'on' : ''} onClick={() => editor?.chain().focus().toggleBulletList().run()}><i className="ri-list-unordered"></i></button>
                <button className={editor?.isActive('orderedList') ? 'on' : ''} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><i className="ri-list-ordered"></i></button>
                <button className={editor?.isActive('blockquote') ? 'on' : ''} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><i className="ri-double-quotes-l"></i></button>

                <div className="dr-sep" />
                <button onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}><i className="ri-arrow-go-back-line"></i></button>
                <button onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}><i className="ri-arrow-go-forward-line"></i></button>

                <button className="dr-save" title="Simpan ke Projek" onClick={() => void simpanKeProjek()}><Save size={15} /></button>
                <button className="dr-save" style={{ background: "none", color: "#F07A76", border: "1px solid rgba(240,122,118,.35)", marginLeft: 6 }} title="Hapus draft ini"
                  onClick={async () => {
                    if (!(await askConfirm("Hapus draft ini beserta projeknya?"))) return;
                    const p = projects.find((x) => x.id === curId);
                    if (p) { void api.drafts.remove(p.id); setProjects((xs) => xs.filter((x) => x.id !== p.id)); }
                    bersihkanKompose();
                    toast("Draft dihapus", "Dokumen dikeluarkan dari projek.", "warn");
                  }}><Trash2 size={15} /></button>
              </div>
              <div className="dr-doc-body" ref={docBodyRef}>
                <EditorContent editor={editor} className="w-full" />
              </div>
            </>
          ) : rightView === 'projek' ? (
            <div className="dr-manage">
              <h2>Projek Tersimpan</h2>
              <div className="dr-table">
                {projects.map(p => (
                  <div className="tr" key={p.id}>
                    <div>
                      {editProj === p.id ? (
                        <input autoFocus value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onBlur={() => void simpanRenameProj()}
                          onKeyDown={(e) => { if (e.key === "Enter") void simpanRenameProj(); if (e.key === "Escape") setEditProj(null); }}
                          style={{ background: "var(--sur-2)", border: "1px solid var(--gold)", borderRadius: 6, color: "var(--txt)", fontSize: 13, padding: "4px 9px", width: "100%" }} />
                      ) : <b>{p.title}</b>}
                      <span>Model: {p.model} · Tone: {p.tone}</span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <button onClick={(e) => { e.stopPropagation(); setMenuAt(menuAt === p.id ? null : p.id); }}><MoreHorizontal size={14} /></button>
                      {menuAt === p.id && (
                        <div className="dr-menu" style={{ right: 0, top: 30 }} onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { setMenuAt(null); setEditProj(p.id); setEditVal(p.title); }}>Ganti nama</button>
                          <button className="del" onClick={() => void hapusProjek(p)}>Hapus</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {!projects.length && <p style={{ color: "var(--muted)", fontSize: 13 }}>Belum ada projek tersimpan.</p>}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {selPopup && (
        <div ref={selPopRef} className="dr-selpop" style={{ left: selPopup.x, top: selPopup.y }} onMouseDown={(e) => e.preventDefault()}>
          {!selRevOpen ? (
            <button className="dr-selpop-btn" onClick={() => setSelRevOpen(true)}><Sparkles size={12} /> Revisi dengan Jago</button>
          ) : (
            <div className="dr-selpop-box">
              <input autoFocus value={selRevInput} placeholder="Instruksi revisi…" onChange={(e) => setSelRevInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitSelRevision(); if (e.key === "Escape") { setSelRevOpen(false); setSelPopup(null); } }} />
              <button onClick={submitSelRevision} aria-label="Kirim revisi"><ArrowUp size={13} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
