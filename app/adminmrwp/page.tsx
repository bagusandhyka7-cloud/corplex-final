"use client";
/*
 * Panel MRWP — back-office staf. Route tersembunyi /adminmrwp.
 * PROD: dilindungi auth server-side (role super_admin) + service-role di server saja.
 * Slice-1: menu Autentikasi & Akses (Kode Undangan / Akun & Seat / Approval Onboarding).
 */
import React, { useEffect, useState } from "react";
import { BadgeCheck, ChevronDown, Copy, Download, Gavel, KeyRound, LayoutDashboard, Lock, LogOut, Mail, Plus, ShieldCheck, Ticket, Trash2, UserPlus, Users } from "lucide-react";
import { StoreProvider, useStore } from "@/lib/store";
import { admin, api, InviteRow } from "@/lib/api";
import { sb } from "@/lib/supabase";
import { useAsyncAction } from "@/lib/hooks";
import { askConfirm, Chip, ConfirmHost, Field, Modal, Row } from "@/components/ui";
import { Toasts } from "@/components/shell";

/* ===== tipe & seed (in-memory; PROD: Supabase) ===== */
type Invite = { code: string; email: string; tier: string; expiresAt: number | null; status: "active" | "used" | "expired" | "revoked" };
type Seat = { nama: string; email: string; peran: string; status: "aktif" | "undangan" | "nonaktif" };
type Tenant = { id: string; nama: string; tier: string; seats: Seat[] };
type Pending = { id: string; nama: string; pendaftar: string; email: string; masuk: string; docs: { id: string; jenis: string; nama: string; dok_url: string | null }[] };

const DAY = 86_400_000;
const now = () => Date.now();
const fromRow = (r: InviteRow): Invite => ({
  code: r.code, email: r.email_target || "", tier: r.tier,
  expiresAt: r.expires_at ? new Date(r.expires_at).getTime() : null,
  status: r.status as Invite["status"],
});
const TIERS = ["Demo", "Tier 1", "Tier 2", "Tier 3 Lifetime"];
const EXP = [["24 jam", DAY], ["3 hari", 3 * DAY], ["7 hari", 7 * DAY], ["30 hari", 30 * DAY], ["Tanpa batas", 0]] as const;

const sisaLabel = (inv: Invite) => {
  if (inv.status === "revoked") return "dicabut";
  if (inv.status === "used") return "terpakai";
  if (!inv.expiresAt) return "tanpa batas";
  const d = inv.expiresAt - now();
  if (d <= 0) return "kedaluwarsa";
  return `berlaku ${Math.ceil(d / DAY)} hari lagi`;
};
const chipOf = (inv: Invite) => {
  const eff = inv.status === "active" && inv.expiresAt && inv.expiresAt < now() ? "expired" : inv.status;
  return eff === "active" ? ["c-ver", "AKTIF"] : eff === "used" ? ["c-mon", "TERPAKAI"] : eff === "revoked" ? ["c-red", "DICABUT"] : ["c-red", "KEDALUWARSA"];
};
const genCode = () => "MRWP-" + Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ123456789"[b % 33]).join("");

/* Password admin diverifikasi server-side (route /api/admin, env ADMIN_PASSWORD) —
 * tak ada konstanta kredensial di klien. Password tersimpan di sessionStorage,
 * dilampirkan tiap panggilan back-office (service-role). */
const SESSION_KEY = "adminmrwp_pw";

function AdminLogin({ onOk }: { onOk: () => void }) {
  const { toast } = useStore();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const { run: masuk, pending } = useAsyncAction(async () => {
    if (!email.trim() || !pw.trim()) { toast("Lengkapi kredensial", "Email dan kata sandi admin wajib diisi.", "warn"); return; }
    /* RBAC: sign-in Supabase Auth lalu WAJIB role super_admin di app_users (dicek DB, bukan klien). */
    const a = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw });
    if (a.error) { toast("Akses ditolak", "Kredensial tidak dikenal.", "warn"); return; }
    const { data: me } = await sb.from("app_users").select("role").eq("user_id", a.data.user.id).maybeSingle();
    if (me?.role !== "super_admin") {
      await sb.auth.signOut();
      toast("Akses ditolak", "Akun ini bukan super admin — insiden tercatat.", "warn");
      return;
    }
    sessionStorage.setItem(SESSION_KEY, pw.trim()); // lapis 2: route service-role tetap verifikasi ADMIN_PASSWORD
    const res = await admin.auth();
    if (!res.ok) { sessionStorage.removeItem(SESSION_KEY); toast("Akses ditolak", res.error.message, "warn"); return; }
    onOk();
  });
  const inp = { width: "100%", borderRadius: 10, padding: "11px 14px 11px 40px", outline: "none" } as const;
  const ico = { position: "absolute" as const, left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" };
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(155deg,#081020,#0B1526 60%,#0e1c33)" }}>
      <div className="panel" style={{ width: "min(380px,92vw)", textAlign: "center", padding: "34px 30px" }}>
        <img src="/logo-mrwp.svg" alt="MRWP" style={{ width: 52, height: 52, objectFit: "contain", margin: "0 auto 12px" }} />
        <h2 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 22, margin: 0 }}>Panel MRWP</h2>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".22em", color: "var(--gold-deep)", display: "block", margin: "6px 0 20px" }}>KHUSUS STAF · SUPER ADMIN</span>
        <div style={{ display: "grid", gap: 12, textAlign: "left" }}>
          <div style={{ position: "relative" }}>
            <input style={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email admin" />
            <Mail size={15} style={ico} />
          </div>
          <div style={{ position: "relative" }}>
            <input style={inp} type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void masuk(); }} placeholder="Kata sandi" />
            <Lock size={15} style={ico} />
          </div>
          <button className="btn btn-gold" style={{ justifyContent: "center", padding: 12 }} disabled={pending} aria-busy={pending} onClick={() => void masuk()}>
            {pending ? "Memverifikasi…" : "Masuk ke Panel"}
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 16 }}>Akses tercatat pada jejak audit. Bukan staf MRWP? Tutup halaman ini.</p>
      </div>
    </div>
  );
}

function AdminInner() {
  const { toast } = useStore();
  const [menu, setMenu] = useState<"beranda" | "kode" | "seat" | "approval" | "advokat" | "modul" | "pusat" | "metrik">("kode");
  type Metrics = { tenantAktif: number; tenantPending: number; aktif30h: number; karyawan: number; dokumen: number; perModul: Record<string, number>; vqMasuk: number; vqVerified: number };
  const [mx, setMx] = useState<Metrics | null>(null);
  const loadMetrik = async () => { const r = await admin.metrics(); if (r.ok) setMx(r.data.metrics); else toast("Gagal memuat metrik", r.error.message, "warn"); };
  const [pdTenant, setPdTenant] = useState<string | null>(null);
  const [pdDocs, setPdDocs] = useState<{ kel: string; nama: string; jenis: string; url: string }[]>([]);
  const [pdKaryawan, setPdKaryawan] = useState(0);
  const [pdLoading, setPdLoading] = useState(false);
  const loadPusat = async (id: string) => {
    setPdTenant(id); setPdLoading(true);
    const r = await admin.tenantDocs(id);
    setPdLoading(false);
    if (r.ok) { setPdDocs(r.data.docs); setPdKaryawan(r.data.karyawan); } else toast("Gagal memuat", r.error.message, "warn");
  };

  /* Data Modul — agregat NYATA lintas tenant dari Supabase (employees + module_records +
   * attendance + verification_queue), realtime via postgres_changes. Nol seed. */
  type ModStat = { tenant: string; emp: number; att: number; vq: number; mods: Record<string, number> };
  const [modStats, setModStats] = useState<ModStat[]>([]);
  const [modLoading, setModLoading] = useState(false);
  const muatModul = React.useCallback(async () => {
    setModLoading(true);
    const [e, m, a, v] = await Promise.all([
      sb.from("employees").select("tenant_id"),
      sb.from("module_records").select("tenant_id,module"),
      sb.from("attendance").select("tenant_id"),
      sb.from("verification_queue").select("tenant_id"),
    ]);
    const byTen: Record<string, ModStat> = {};
    const get = (t: string) => (byTen[t] ??= { tenant: t, emp: 0, att: 0, vq: 0, mods: {} });
    (e.data || []).forEach((r) => { get(r.tenant_id).emp++; });
    (a.data || []).forEach((r) => { get(r.tenant_id).att++; });
    (v.data || []).forEach((r) => { get(r.tenant_id).vq++; });
    (m.data || []).forEach((r) => { const s = get(r.tenant_id); s.mods[r.module] = (s.mods[r.module] || 0) + 1; });
    setModStats(Object.values(byTen).sort((x, y) => x.tenant.localeCompare(y.tenant)));
    setModLoading(false);
  }, []);
  useEffect(() => {
    if (menu !== "modul") return;
    void muatModul();
    const ch = sb.channel(`admin-modul:${Date.now()}`) // topik unik — hindari reuse channel ter-subscribe
      .on("postgres_changes", { event: "*", schema: "public", table: "module_records" }, () => void muatModul())
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, () => void muatModul())
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [menu, muatModul]);
  const [authOpen, setAuthOpen] = useState(true);
  const [audit, setAudit] = useState<string[]>(["Sesi admin dimulai — akses /adminmrwp tercatat."]);
  const log = (s: string) => setAudit((a) => [`${new Date().toLocaleTimeString("id-ID")} · ${s}`, ...a]);

  /* kode undangan — dimuat dari Supabase */
  const [inv, setInv] = useState<Invite[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  useEffect(() => {
    void admin.listInvites().then((res) => {
      if (res.ok) setInv(res.data.map(fromRow));
      else toast("Gagal memuat", res.error.message, "warn");
      setLoadingInv(false);
    });
  }, [toast]);
  const [f, setF] = useState("semua");
  const [q, setQ] = useState("");
  const [nOpen, setNOpen] = useState(false);
  const [nEmail, setNEmail] = useState("");
  const [nTier, setNTier] = useState("Demo");
  const [nExp, setNExp] = useState<number>(7 * DAY);

  /* tenant & seat — seed demo (t1/t2) + tenant aktif nyata dari DB */
  /* NOL DUMMY: daftar tenant murni DB (service-role) — seed dibuang. */
  const [tens, setTens] = useState<Tenant[]>([]);
  useEffect(() => {
    void admin.listTenants().then((r) => {
      if (!r.ok) return;
      setTens(r.data.map((t) => ({
        id: t.id, nama: t.name, tier: t.tier || "Demo",
        seats: (t.users || []).map((u) => ({ nama: u.nama || u.email.split("@")[0], email: u.email, peran: u.jabatan || "—", status: (u.active ? "aktif" : "nonaktif") as Seat["status"] })),
      })));
    });
  }, []);
  const [sel, setSel] = useState<string | null>(null);
  const [seatOpen, setSeatOpen] = useState(false);
  const [seatEmail, setSeatEmail] = useState("");
  const [seatNama, setSeatNama] = useState("");

  /* approval — antrean pending nyata dari DB (service-role) */
  const [pend, setPend] = useState<Pending[]>([]);
  const [docPrev, setDocPrev] = useState<{ url: string; nama: string } | null>(null); // viewer dokumen approval
  useEffect(() => {
    void admin.listPending().then((r) => {
      if (r.ok) setPend(r.data.map((t) => ({
        id: t.id, nama: t.name, pendaftar: t.nama, email: t.email,
        masuk: new Date(t.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
        docs: t.docs,
      })));
      else toast("Gagal memuat approval", r.error.message, "warn");
    });
  }, [toast]);

  /* permintaan demo — nyata dari DB (bug lama: form menulis, panel tak pernah membaca) */
  type DemoReq = { id: string; nama: string | null; perusahaan: string | null; email: string | null; kebutuhan: string | null; status: string | null; created_at: string };
  const [demoReq, setDemoReq] = useState<DemoReq[]>([]);
  useEffect(() => { void admin.listDemo().then((r) => { if (r.ok) setDemoReq(r.data); }); }, []);
  const tandaiDemo = async (id: string, status: string) => {
    const r = await admin.decideDemo(id, status);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setDemoReq((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    toast("Status diperbarui", "Permintaan demo ditandai " + status + ".", "ok");
  };

  /* konsol advokat — antrean verifikasi nyata dari DB */
  type VQ = { id: string; tenant_id: string; title: string; meta: string; chip: string; label: string; sla: string; status: string; note: string | null };
  const [vq, setVq] = useState<VQ[]>([]);
  const [vqLoading, setVqLoading] = useState(true);
  const muatVq = React.useCallback(() => {
    setVqLoading(true);
    void api.verifq.list().then((r) => {
      if (r.ok) setVq(r.data);
      else toast("Gagal memuat antrean", r.error.message, "warn");
      setVqLoading(false);
    });
  }, [toast]);
  useEffect(() => { muatVq(); }, [muatVq]);

  /* Drawer catatan — pengganti window.prompt (dilarang standar Enterprise).
   * {label, def, onOk} generik: dipakai Koreksi, Tolak antrean, dan Tolak approval. */
  const [noteForm, setNoteForm] = useState<{ title: string; label: string; val: string; onOk: (v: string) => void } | null>(null);

  const putuskanVq = async (item: VQ, status: "verified" | "rejected", modeKoreksi?: boolean) => {
    if (status === "rejected") {
      setNoteForm({ title: `Tolak — ${item.title}`, label: "Catatan profesional (wajib — dikirim ke klien)", val: "Perlu penyesuaian dasar hukum pada bagian III", onOk: (v) => void eksekusiVq(item, "rejected", "Catatan: " + v) });
      return;
    }
    if (modeKoreksi) {
      setNoteForm({ title: `Koreksi — ${item.title}`, label: "Ringkasan koreksi (tersimpan sebagai versi baru)", val: "Klausul denda disesuaikan ke standar library", onOk: (v) => void eksekusiVq(item, "verified", `Disetujui dengan koreksi: ${v} · versi baru dibuat · ttd digital.`) });
      return;
    }
    await eksekusiVq(item, "verified", "Disetujui tanpa koreksi · ttd digital atas hash versi final.");
  };
  const eksekusiVq = async (item: VQ, status: "verified" | "rejected", note: string) => {
    const r = await api.verifq.decide(item.id, status, note);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setVq((xs) => xs.map((x) => x.id === item.id ? { ...x, status, note } : x));
    log(`Advokat ${status === "verified" ? "SETUJUI" : "TOLAK"}: ${item.title} (${item.tenant_id})`);
    toast(status === "verified" ? "TERVERIFIKASI ADVOKAT ✓" : "Ditolak dengan catatan", status === "verified" ? "Ttd digital tercatat · status klien diperbarui." : "Catatan dikirim — klien dapat memperbaiki & mengajukan ulang.", status === "verified" ? "ok" : "warn");
  };

  const { run: buatKode, pending: making } = useAsyncAction(async () => {
    if (nEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nEmail)) { toast("Email tidak valid", "Kosongkan untuk kode generik, atau perbaiki formatnya.", "warn"); return; }
    const isLifetime = nTier === "Tier 3 Lifetime";
    const code = genCode();
    const res = await admin.act("create_invite", { code, email: nEmail, tier: nTier, expMs: isLifetime ? 0 : nExp });
    if (!res.ok) { toast("Gagal membuat kode", res.error.message, "warn"); return; }
    setInv((xs) => [{ code, email: nEmail, tier: nTier, expiresAt: isLifetime || !nExp ? null : now() + nExp, status: "active" }, ...xs]);
    setNOpen(false); setNEmail("");
    void navigator.clipboard?.writeText(`${location.origin}/?kode=${code}`).catch(() => {});
    log(`Kode ${code} dibuat (${nTier}${nEmail ? " → " + nEmail : ""})`);
    toast("Kode dibuat & link disalin", `${code} · ${nTier} · 2 kursi — bagikan ke calon klien.`, "ok");
  });

  const cabut = async (code: string) => {
    const res = await admin.act("revoke_invite", { code });
    if (!res.ok) return toast("Gagal", res.error.message, "warn");
    setInv((xs) => xs.map((x) => x.code === code ? { ...x, status: "revoked" as const } : x));
    log(`Kode ${code} dicabut`);
    toast("Kode dicabut", `${code} tidak bisa dipakai lagi.`, "warn");
  };

  const { run: undangSeat, pending: inviting } = useAsyncAction(async () => {
    const t = tens.find((x) => x.id === sel)!;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(seatEmail)) { toast("Email tidak valid", "Periksa format email.", "warn"); return; }
    const dupe = tens.some((x) => x.seats.some((s) => s.email === seatEmail.trim().toLowerCase()));
    if (dupe) { toast("Email sudah terdaftar", "Satu email hanya untuk satu akun — gunakan email berbeda.", "warn"); return; }
    const res = await admin.inviteSeat(t.id, seatEmail.trim().toLowerCase());
    if (!res.ok) { toast("Gagal", res.error.message, "warn"); return; }
    if (res.data.link) void navigator.clipboard?.writeText(res.data.link);
    setTens((xs) => xs.map((x) => x.id === t.id ? { ...x, seats: [...x.seats, { nama: seatNama.trim() || seatEmail.split("@")[0], email: seatEmail.trim().toLowerCase(), peran: "—", status: "undangan" as const }] } : x));
    setSeatOpen(false); setSeatEmail(""); setSeatNama("");
    log(`Kursi ke-2 ${t.nama} dibuat: ${seatEmail}`);
    toast("Kursi dibuat — tautan set-sandi disalin", `Tempel tautan (di clipboard) ke ${seatEmail} untuk mengatur kata sandi.`, "ok");
  });

  const putuskan = async (p: Pending, ok: boolean, alasan = "") => {
    if (!ok && !alasan) {
      setNoteForm({ title: `Tolak pendaftaran — ${p.nama}`, label: "Alasan penolakan (wajib, dikirim ke pendaftar)", val: "Dokumen NIB tidak terbaca — mohon unggah ulang.", onOk: (v) => void putuskan(p, false, v) });
      return;
    }
    const res = await admin.decideTenant(p.id, ok, alasan);
    if (!res.ok) return toast("Gagal", res.error.message, "warn");
    setPend((xs) => xs.filter((x) => x.id !== p.id));
    if (ok) setTens((xs) => [...xs, { id: p.id, nama: p.nama, tier: "Demo", seats: [{ nama: p.pendaftar, email: p.email, peran: "Pendaftar", status: "aktif" }] }]);
    log(`${p.nama} ${ok ? "DISETUJUI — tenant aktif" : "DITOLAK: " + alasan}`);
    toast(ok ? "Disetujui — tenant aktif" : "Ditolak", ok ? `${p.nama} kini bisa login. Email selamat datang terkirim.` : `Alasan dikirim ke ${p.email}.`, ok ? "ok" : "warn");
  };

  const selTen = tens.find((x) => x.id === sel);
  const invRows = inv.filter((x) => {
    const [, lbl] = chipOf(x);
    if (f !== "semua" && lbl !== f) return false;
    return (x.code + " " + x.email).toLowerCase().includes(q.toLowerCase());
  });

  const S = { side: { width: 232, background: "linear-gradient(180deg,#0A1832,#060E1D)", borderRight: "1px solid rgba(130,160,215,.1)", padding: "18px 12px", display: "flex", flexDirection: "column" as const, gap: 4 },
    item: (on: boolean) => ({ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: on ? "#fff" : "#A9BDE4", background: on ? "linear-gradient(90deg,rgba(58,96,166,.3),rgba(58,96,166,.05))" : "none", borderLeft: on ? "3px solid var(--gold-bright)" : "3px solid transparent" }) };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg, #091124)" }}>
      <style>{`
        .adm-drop{display:grid;grid-template-rows:0fr;transition:grid-template-rows .38s cubic-bezier(.4,0,.2,1)}
        .adm-drop.open{grid-template-rows:1fr}
        .adm-drop>div{overflow:hidden;display:grid;gap:2px;padding-left:14px;min-height:0}
        .adm-drop .it{opacity:0;transform:translateY(-7px);transition:opacity .3s ease,transform .3s cubic-bezier(.2,.8,.3,1.1)}
        .adm-drop.open .it{opacity:1;transform:none}
        .adm-drop.open .it:nth-child(1){transition-delay:.08s}
        .adm-drop.open .it:nth-child(2){transition-delay:.16s}
        .adm-drop.open .it:nth-child(3){transition-delay:.24s}
      `}</style>
      {/* sidebar */}
      <aside style={S.side}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 10px 16px" }}>
          <img src="/logo-mrwp.svg" alt="MRWP" style={{ width: 36, height: 36, objectFit: "contain" }} />
          <div>
            <b style={{ color: "#fff", fontFamily: "var(--serif)", fontSize: 15, display: "block", lineHeight: 1 }}>PANEL MRWP</b>
            <span style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: ".18em", color: "var(--gold-deep)" }}>SUPER ADMIN · RAHASIA</span>
          </div>
        </div>
        <div style={S.item(menu === "beranda")} onClick={() => setMenu("beranda")}><LayoutDashboard size={15} /> Beranda</div>
        {/* parent dropdown — teks saja, klik = buka/tutup */}
        <div style={{ ...S.item(false), color: authOpen ? "#fff" : "#A9BDE4" }} onClick={() => setAuthOpen((v) => !v)}>
          <ShieldCheck size={15} /> Autentikasi &amp; Akses
          <ChevronDown size={14} style={{ marginLeft: "auto", transition: ".2s", transform: authOpen ? "rotate(180deg)" : "none" }} />
        </div>
        <div className={`adm-drop${authOpen ? " open" : ""}`}>
          <div>
            <div className="it" style={{ ...S.item(menu === "kode"), fontSize: 12.5, padding: "8px 12px" }} onClick={() => setMenu("kode")}><Ticket size={14} /> Kode Undangan</div>
            <div className="it" style={{ ...S.item(menu === "seat"), fontSize: 12.5, padding: "8px 12px" }} onClick={() => setMenu("seat")}><Users size={14} /> Akun &amp; Seat</div>
            <div className="it" style={{ ...S.item(menu === "approval"), fontSize: 12.5, padding: "8px 12px" }} onClick={() => setMenu("approval")}>
              <BadgeCheck size={14} /> Approval
              {pend.length > 0 && <span style={{ marginLeft: "auto", background: "linear-gradient(145deg,var(--gold-bright),var(--gold))", color: "#060E1D", fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, minWidth: 17, height: 17, borderRadius: 100, display: "grid", placeItems: "center", padding: "0 5px" }}>{pend.length}</span>}
            </div>
          </div>
        </div>
        <div style={S.item(menu === "advokat")} onClick={() => setMenu("advokat")}>
          <Gavel size={15} /> Konsol Advokat
          {vq.filter((x) => x.status === "masuk").length > 0 && <span style={{ marginLeft: "auto", background: "linear-gradient(145deg,var(--gold-bright),var(--gold))", color: "#060E1D", fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, minWidth: 17, height: 17, borderRadius: 100, display: "grid", placeItems: "center", padding: "0 5px" }}>{vq.filter((x) => x.status === "masuk").length}</span>}
        </div>
        <div style={S.item(menu === "modul")} onClick={() => setMenu("modul")}><LayoutDashboard size={15} /> Data Modul</div>
        <div style={S.item(menu === "pusat")} onClick={() => setMenu("pusat")}><Lock size={15} /> Pusat Data</div>
        <div style={S.item(menu === "metrik")} onClick={() => { setMenu("metrik"); if (!mx) void loadMetrik(); }}><BadgeCheck size={15} /> Metrik</div>
        <div style={{ ...S.item(false), marginTop: "auto" }} onClick={() => { sessionStorage.removeItem(SESSION_KEY); void sb.auth.signOut().finally(() => location.reload()); }}><LogOut size={15} /> Keluar</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "#5E76A8", padding: 10, lineHeight: 1.8 }}>SERVICE-ROLE · SERVER-SIDE<br />SEMUA AKSI MASUK AUDIT</div>
      </aside>

      {/* konten */}
      <main style={{ flex: 1, padding: "26px 30px", overflow: "auto" }}>
        {menu === "beranda" ? (
          <div>
            <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 24, marginBottom: 18 }}>Beranda</h1>
            <div className="grid g4 mb16">
              <div className="kpi"><b>{inv.filter((x) => chipOf(x)[1] === "AKTIF").length}</b><span>Kode undangan aktif</span></div>
              <div className="kpi"><b>{pend.length}</b><span>Menunggu approval</span></div>
              <div className="kpi"><b>{tens.length}</b><span>Perusahaan aktif</span></div>
              <div className="kpi"><b>{tens.reduce((s, t) => s + t.seats.filter((x) => x.status !== "nonaktif").length, 0)}</b><span>Kursi terpakai</span></div>
            </div>
            <div className="panel"><h4>Audit — Aksi Terakhir</h4>
              <div className="rows">{audit.slice(0, 8).map((a, i) => <div key={i} className="row"><span style={{ fontSize: 12 }}>{a}</span></div>)}</div>
            </div>
          </div>
        ) : menu === "modul" ? (
          <div>
            <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 24, marginBottom: 4 }}>Data Modul</h1>
            <p style={{ color: "var(--txt2)", fontSize: 12.5, marginBottom: 16 }}>Rekap rekam nyata seluruh tenant — langsung dari tabel Supabase, ter-update realtime saat modul menulis data.</p>
            <div className="panel">
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button className="btn btn-line btn-sm" disabled={modLoading} onClick={() => void muatModul()}>{modLoading ? "Memuat…" : "Muat Ulang"}</button>
              </div>
              <div className="tblwrap">
                <table>
                  <thead><tr><th>Tenant</th><th>Karyawan</th><th>SP</th><th>Izin</th><th>Aset</th><th>HKI</th><th>Polis</th><th>Perjanjian</th><th>Pajak</th><th>Kalkulator</th><th>Vault</th><th>Absensi</th><th>Verifikasi</th></tr></thead>
                  <tbody>
                    {modStats.map((s) => (
                      <tr key={s.tenant}>
                        <td><b>{s.tenant}</b></td>
                        <td>{s.emp}</td><td>{s.mods.sp || 0}</td><td>{s.mods.lic || 0}</td><td>{s.mods.assets || 0}</td>
                        <td>{s.mods.hki || 0}</td><td>{s.mods.pol || 0}</td><td>{s.mods.agr || 0}</td><td>{s.mods.tax || 0}</td>
                        <td>{s.mods.kalk || 0}</td><td>{s.mods.vault || 0}</td><td>{s.att}</td><td>{s.vq}</td>
                      </tr>
                    ))}
                    {!modStats.length && !modLoading && <tr><td colSpan={13} style={{ color: "var(--muted)" }}>Belum ada rekam modul di database.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="note mt16">Angka = jumlah baris nyata di <b>employees</b>, <b>module_records</b> (per modul), <b>attendance</b>, dan <b>verification_queue</b>. Nol seed/dummy.</p>
            </div>
          </div>
        ) : menu === "metrik" ? (
          <div>
            <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 24, marginBottom: 4 }}>Metrik</h1>
            <p style={{ color: "var(--txt2)", fontSize: 12.5, marginBottom: 16 }}>Dihitung dari database operasional sendiri — bukan pelacak pihak ketiga (PDP-aman, zero-budget). <button className="btn btn-line btn-sm" style={{ marginLeft: 8 }} onClick={() => void loadMetrik()}>Muat Ulang</button></p>
            {!mx ? <p className="note">Memuat…</p> : (
              <>
                <div className="grid g4 mb16">
                  <div className="kpi"><b>{mx.tenantAktif}</b><span>Perusahaan aktif</span></div>
                  <div className="kpi"><b>{mx.aktif30h}</b><span>Aktif 30 hari (isi data)</span></div>
                  <div className="kpi"><b>{mx.karyawan}</b><span>Total karyawan</span></div>
                  <div className="kpi"><b>{mx.dokumen}</b><span>Dokumen tersimpan</span></div>
                </div>
                <div className="grid g2">
                  <div className="panel"><h4>Adopsi per Modul</h4>
                    <div className="rows">
                      {Object.entries(mx.perModul).sort((a, b) => b[1] - a[1]).map(([m, n]) => <Row key={m} b={m.toUpperCase()} right={<Chip c="c-mon">{n}</Chip>} />)}
                      {!Object.keys(mx.perModul).length && <span className="sub" style={{ fontSize: 12 }}>Belum ada rekam modul.</span>}
                    </div>
                  </div>
                  <div className="panel"><h4>Verifikasi &amp; Pipeline</h4>
                    <div className="rows">
                      <Row b="Antre verifikasi advokat" right={<Chip c="c-draft">{mx.vqMasuk}</Chip>} />
                      <Row b="Terverifikasi advokat" right={<Chip c="c-ver">{mx.vqVerified}</Chip>} />
                      <Row b="Pendaftaran menunggu approval" right={<Chip c="c-draft">{mx.tenantPending}</Chip>} />
                    </div>
                  </div>
                </div>
                <p className="note mt16">Bintang Utara = perusahaan aktif yang benar-benar mengisi rekam. Aktivitas menurun = sinyal awal churn (tindak lanjut MRWP).</p>
              </>
            )}
          </div>
        ) : menu === "pusat" ? (
          <div>
            <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 24, marginBottom: 4 }}>Pusat Data</h1>
            <p style={{ color: "var(--txt2)", fontSize: 12.5, marginBottom: 16 }}>Akses &amp; unduh seluruh dokumen klien — dasar perjanjian &amp; NDA (MRWP firma hukum klien). Setiap akses tercatat pada jejak audit.</p>
            <div className="grid" style={{ gridTemplateColumns: "240px 1fr", gap: 16, alignItems: "start" }}>
              <div className="panel">
                <h4>Perusahaan</h4>
                <div className="rows">
                  {tens.map((t) => <button key={t.id} className={`btn ${pdTenant === t.id ? "btn-gold" : "btn-line"} btn-sm`} style={{ justifyContent: "flex-start" }} onClick={() => void loadPusat(t.id)}>{t.nama}</button>)}
                  {!tens.length && <span className="sub" style={{ fontSize: 12 }}>Belum ada perusahaan aktif.</span>}
                </div>
              </div>
              <div className="panel">
                {!pdTenant ? <p className="note">Pilih perusahaan untuk membuka seluruh dokumennya.</p> : pdLoading ? <p className="note">Memuat…</p> : (
                  <>
                    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                      <div className="kpi"><b>{pdDocs.length}</b><span>Dokumen</span></div>
                      <div className="kpi"><b>{pdKaryawan}</b><span>Karyawan</span></div>
                    </div>
                    <div className="tblwrap">
                      <table>
                        <thead><tr><th>Kelompok</th><th>Dokumen</th><th>Jenis</th><th>Aksi</th></tr></thead>
                        <tbody>
                          {pdDocs.map((d, i) => (
                            <tr key={i}>
                              <td><span className="mono" style={{ fontSize: 10 }}>{d.kel}</span></td>
                              <td>{d.nama}</td><td>{d.jenis}</td>
                              <td><div style={{ display: "inline-flex", gap: 6 }}>
                                <button className="btn btn-line btn-sm" onClick={() => setDocPrev({ url: d.url, nama: d.nama })}>Preview</button>
                                <a className="btn btn-navy btn-sm" href={d.url} target="_blank" rel="noreferrer"><Download size={11} /> Unduh</a>
                              </div></td>
                            </tr>
                          ))}
                          {!pdDocs.length && <tr><td colSpan={4} style={{ color: "var(--muted)" }}>Tak ada dokumen tersimpan untuk perusahaan ini.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <p className="note mt16">Unduhan penuh sesuai perjanjian — tanpa watermark. Akses tercatat diam-diam (buku tamu) untuk pertanggungjawaban.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : menu === "advokat" ? (
          <div>
            <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 24, marginBottom: 4 }}>Konsol Advokat</h1>
            <p style={{ color: "var(--txt2)", fontSize: 12.5, marginBottom: 16 }}>Antrean verifikasi dari seluruh tenant — setiap keputusan bertanda tangan digital dan tercatat pada jejak audit.</p>
            <div className="panel">
              <div className="tblwrap">
                <table>
                  <thead><tr><th>Tenant</th><th>Pengajuan</th><th>Label</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {vq.filter((x) => x.status === "masuk").map((x) => (
                      <tr key={x.id}>
                        <td><span className="mono" style={{ fontSize: 11 }}>{x.tenant_id}</span></td>
                        <td><b>{x.title}</b><span className="sub">{x.meta}</span></td>
                        <td><Chip c={x.chip}>{x.label}</Chip></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button className="btn btn-ok btn-sm" onClick={() => void putuskanVq(x, "verified")}>Setujui</button>
                            <button className="btn btn-navy btn-sm" onClick={() => void putuskanVq(x, "verified", true)}>Koreksi</button>
                            <button className="btn btn-red btn-sm" onClick={() => void putuskanVq(x, "rejected")}>Tolak</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!vq.filter((x) => x.status === "masuk").length && <tr><td colSpan={4} style={{ color: "var(--muted)" }}>{vqLoading ? "Memuat dari Supabase…" : "Antrean kosong — seluruh pengajuan telah diputuskan."}</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="note mt16"><b>Prinsip tata kelola:</b> nasihat hukum final hanya lahir dari status TERVERIFIKASI ADVOKAT — tanda tangan digital atas hash versi final, dalam tanggung jawab profesional advokat MRWP.</p>
            </div>
            {vq.some((x) => x.status !== "masuk") && (
              <div className="panel" style={{ marginTop: 16 }}><h4>Keputusan Terakhir</h4>
                <div className="rows">
                  {vq.filter((x) => x.status !== "masuk").slice(0, 6).map((x) => (
                    <div key={x.id} className="row"><div><b>{x.title}</b><span className="d">{x.note}</span></div>
                      <div className="right"><Chip c={x.status === "verified" ? "c-ver" : "c-red"}>{x.status === "verified" ? "TERVERIFIKASI ✓" : "DITOLAK"}</Chip></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 24, marginBottom: 4 }}>
              {menu === "kode" ? "Kode Undangan" : menu === "seat" ? "Akun & Seat" : "Approval Onboarding"}
            </h1>
            <p style={{ color: "var(--txt2)", fontSize: 12.5, marginBottom: 16 }}>
              {menu === "kode" ? "Terbitkan & kelola kode undangan — masa berlaku ditegakkan server." : menu === "seat" ? "Kelola 2 kursi per perusahaan — email unik global." : "Setujui atau tolak pendaftaran perusahaan baru."}
            </p>

            {menu === "kode" && (
              <div className="panel">
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                  <input className="finput" placeholder="Cari kode / email…" value={q} onChange={(e) => setQ(e.target.value)} />
                  {["semua", "AKTIF", "TERPAKAI", "KEDALUWARSA", "DICABUT"].map((x) => (
                    <button key={x} className={`fchip${f === x ? " on" : ""}`} onClick={() => setF(x)}>{x === "semua" ? "Semua" : x[0] + x.slice(1).toLowerCase()}</button>
                  ))}
                  <button className="btn btn-gold" style={{ marginLeft: "auto" }} onClick={() => setNOpen(true)}><Plus size={14} /> Buat Kode</button>
                </div>
                <div className="tblwrap">
                  <table>
                    <thead><tr><th>Kode</th><th>Untuk</th><th>Tier</th><th>Masa berlaku</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                      {invRows.map((x) => {
                        const [cls, lbl] = chipOf(x);
                        return (
                          <tr key={x.code}>
                            <td><span className="mono" style={{ fontSize: 12, letterSpacing: ".08em" }}>{x.code}</span></td>
                            <td>{x.email || <span style={{ color: "var(--muted)" }}>generik</span>}</td>
                            <td>{x.tier}</td>
                            <td>{sisaLabel(x)}</td>
                            <td><Chip c={cls}>{lbl}</Chip></td>
                            <td>
                              <div className="flex items-center gap-2">
                                <button className="btn btn-line btn-sm" title="Salin link" onClick={() => { void navigator.clipboard?.writeText(`${location.origin}/?kode=${x.code}`); toast("Link disalin", x.code, "ok"); }}><Copy size={11} /></button>
                                {lbl === "AKTIF" && <button className="btn btn-red btn-sm" onClick={() => void cabut(x.code)}>Cabut</button>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!invRows.length && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>{loadingInv ? "Memuat dari Supabase…" : "Tidak ada kode cocok."}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* akun & seat */}
            {menu === "seat" && (
              <div className="grid g2">
                <div className="panel"><h4>Perusahaan</h4>
                  <div className="rows">
                    {tens.map((t) => (
                      <div key={t.id} className="row clickable" onClick={() => setSel(t.id)} style={sel === t.id ? { borderColor: "var(--gold)" } : undefined}>
                        <div><b>{t.nama}</b><span className="d">{t.tier}</span></div>
                        <div className="right"><Chip c={t.seats.length >= 2 ? "c-mon" : "c-ver"}>{`KURSI ${t.seats.length} / 2`}</Chip></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel"><h4>{selTen ? `Kursi — ${selTen.nama}` : "Pilih perusahaan"}</h4>
                  {selTen ? (
                    <div className="rows">
                      {selTen.seats.map((s) => (
                        <div key={s.email} className="row">
                          <div><b>{s.nama}</b><span className="d">{s.email} · {s.peran}</span></div>
                          <div className="right">
                            <Chip c={s.status === "aktif" ? "c-ver" : s.status === "undangan" ? "c-draft" : "c-red"}>{s.status.toUpperCase()}</Chip>
                            <button className="btn btn-line btn-sm" title="Reset sandi" onClick={async () => { const r = await admin.resetSeat(s.email); if (!r.ok) return toast("Gagal", r.error.message, "warn"); if (r.data.link) void navigator.clipboard?.writeText(r.data.link); log(`Reset sandi ${s.email}`); toast("Tautan reset disalin", `Kirim ke ${s.email}.`, "ok"); }}><KeyRound size={11} /></button>
                            <button className="btn btn-red btn-sm" title="Hapus kursi" onClick={async () => { if (!(await askConfirm(`Hapus kursi ${s.email}?`))) return; const r = await admin.removeSeat(s.email); if (!r.ok) return toast("Gagal", r.error.message, "warn"); setTens((xs) => xs.map((t) => ({ ...t, seats: t.seats.filter((z) => z.email !== s.email) }))); log(`Kursi dihapus ${s.email}`); toast("Kursi dihapus", s.email, "warn"); }}><Trash2 size={11} /></button>
                          </div>
                        </div>
                      ))}
                      {selTen.seats.length < 2 && (
                        <button className="btn btn-navy" onClick={() => setSeatOpen(true)}><UserPlus size={14} /> Undang kursi ke-2</button>
                      )}
                      <p className="note">Batas 2 kursi per paket — semua tier. Email unik global: satu email satu akun.</p>
                    </div>
                  ) : <p className="note">Klik perusahaan di kiri untuk kelola kursinya.</p>}
                </div>
              </div>
            )}

            {/* approval */}
            {menu === "approval" && (
              <div className="panel">
                <div className="tblwrap">
                  <table>
                    <thead><tr><th>Perusahaan</th><th>Pendaftar</th><th>Masuk</th><th>Dokumen</th><th>Aksi</th></tr></thead>
                    <tbody>
                      {pend.map((p) => (
                        <tr key={p.id}>
                          <td><b>{p.nama}</b></td>
                          <td>{p.pendaftar}<span className="sub">{p.email}</span></td>
                          <td>{p.masuk}</td>
                          <td>
                            {/* preview langsung 3 dokumen prasyarat — viewer standar Storage, tanpa unduh */}
                            <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                              <Chip c={p.docs.length === 3 ? "c-ver" : "c-draft"}>{`${p.docs.length} / 3`}</Chip>
                              {p.docs.map((d) => (
                                <button key={d.id} className="btn btn-line btn-sm" disabled={!d.dok_url}
                                  title={d.dok_url ? d.nama : `${d.nama} — berkas tidak terunggah (pendaftaran lama)`}
                                  onClick={() => setDocPrev({ url: d.dok_url!, nama: `${d.jenis.toUpperCase()} — ${d.nama}` })}>{d.jenis}</button>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <button className="btn btn-ok btn-sm" onClick={() => void putuskan(p, true)}>Setujui</button>
                              <button className="btn btn-red btn-sm" onClick={() => void putuskan(p, false)}>Tolak</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!pend.length && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>Antrean kosong — semua pendaftaran telah diproses.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <p className="note mt16">Setujui → tenant aktif + email selamat datang. Tolak → alasan wajib, pendaftar boleh submit ulang.</p>

                {/* Permintaan Demo (form "Minta Demo" halaman login) — bug lama: tersimpan di DB tapi tak pernah tampil */}
                <h4 style={{ fontFamily: "var(--serif)", fontSize: 14, margin: "22px 0 10px", color: "#fff" }}>Permintaan Demo</h4>
                <div className="tblwrap">
                  <table>
                    <thead><tr><th>Nama</th><th>Perusahaan</th><th>Email</th><th>Kebutuhan</th><th>Masuk</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                      {demoReq.map((d) => (
                        <tr key={d.id}>
                          <td>{d.nama || "—"}</td>
                          <td>{d.perusahaan || "—"}</td>
                          <td>{d.email || "—"}</td>
                          <td style={{ maxWidth: 220, whiteSpace: "normal" }}>{d.kebutuhan || "—"}</td>
                          <td>{new Date(d.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td><Chip c={d.status === "dihubungi" ? "c-ver" : "c-draft"}>{(d.status || "baru").toUpperCase()}</Chip></td>
                          <td><div className="flex items-center gap-2">
                            {d.status !== "dihubungi" && <button className="btn btn-ok btn-sm" onClick={() => void tandaiDemo(d.id, "dihubungi")}>Tandai Dihubungi</button>}
                            <button className="btn btn-line btn-sm" onClick={() => { void navigator.clipboard.writeText(d.email || ""); toast("Email disalin", d.email || "", "ok"); }}>Salin Email</button>
                          </div></td>
                        </tr>
                      ))}
                      {!demoReq.length && <tr><td colSpan={7} style={{ color: "var(--muted)" }}>Belum ada permintaan demo.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <p className="note mt16">Tindak lanjut: hubungi pemohon lalu kirim kode undangan dari menu Kode Undangan. Status tersimpan ke database.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* modal buat kode */}
      <Modal open={nOpen} title="Buat Kode Undangan" onClose={() => setNOpen(false)}
        footer={<>
          <button className="btn btn-line" onClick={() => setNOpen(false)}>Batal</button>
          <button className="btn btn-gold" disabled={making} aria-busy={making} onClick={() => void buatKode()}>{making ? "Membuat…" : "Buat & Salin Link"}</button>
        </>}>
        <Field label="Email tujuan (kosongkan untuk kode generik)"><input type="email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} placeholder="calon@klien.co.id" /></Field>
        <Field label="Tier">
          <select value={nTier} onChange={(e) => setNTier(e.target.value)}>{TIERS.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Masa berlaku">
          <select value={nExp} disabled={nTier === "Tier 3 Lifetime"} onChange={(e) => setNExp(+e.target.value)}>
            {EXP.map(([l, ms]) => <option key={l} value={ms}>{l}</option>)}
          </select>
        </Field>
        <div className="note">Kursi: <b>2</b> (terkunci — semua tier). {nTier === "Tier 3 Lifetime" ? "Lifetime: tanpa masa berlaku." : "Kode hangus otomatis saat lewat masa berlaku — ditegakkan server."}</div>
      </Modal>

      {/* modal undang kursi */}
      <Modal open={seatOpen} title={`Undang Kursi ke-2 — ${selTen?.nama || ""}`} onClose={() => setSeatOpen(false)}
        footer={<>
          <button className="btn btn-line" onClick={() => setSeatOpen(false)}>Batal</button>
          <button className="btn btn-navy" disabled={inviting} aria-busy={inviting} onClick={() => void undangSeat()}>{inviting ? "Mengirim…" : "Kirim Undangan"}</button>
        </>}>
        <Field label="Nama (opsional)"><input value={seatNama} onChange={(e) => setSeatNama(e.target.value)} placeholder="Nama pemegang kursi" /></Field>
        <Field label="Email (harus berbeda dari kursi 1)"><input type="email" value={seatEmail} onChange={(e) => setSeatEmail(e.target.value)} placeholder="pm@perusahaan.co.id" /></Field>
        <div className="note">Email unik global — jika sudah terdaftar di tenant mana pun, undangan ditolak.</div>
      </Modal>

      {/* drawer catatan profesional — pengganti window.prompt */}
      <Modal right open={!!noteForm} title={noteForm?.title || ""} onClose={() => setNoteForm(null)}
        footer={<>
          <button className="btn btn-line" onClick={() => setNoteForm(null)}>Batal</button>
          <button className="btn btn-gold" onClick={() => { const v = noteForm?.val.trim(); if (!v) return toast("Catatan wajib diisi", "Tulis catatan profesional sebelum mengirim.", "warn"); const ok = noteForm!.onOk; setNoteForm(null); ok(v!); }}>Kirim</button>
        </>}>
        {noteForm && (
          <Field label={noteForm.label}>
            <textarea rows={5} value={noteForm.val} autoFocus onChange={(e) => setNoteForm({ ...noteForm, val: e.target.value })} style={{ resize: "vertical" }} />
          </Field>
        )}
        <div className="note">Catatan tersimpan pada keputusan dan dikirim ke pihak terkait — tercatat pada jejak audit.</div>
      </Modal>

      {/* viewer dokumen prasyarat — standar sama modul klien (render langsung dari Storage) */}
      <Modal right open={!!docPrev} title="Dokumen Pendaftaran" onClose={() => setDocPrev(null)}>
        {docPrev && (
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", height: "calc(100vh - 160px)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--line)", background: "var(--sur-2)" }}>
              <span className="sub mono" style={{ fontSize: 10, letterSpacing: ".1em" }}>PREVIEW — {docPrev.nama}</span>
            </div>
            {/\.(jpe?g|png|webp)(\?|$)/i.test(docPrev.url)
              ? <div style={{ flex: 1, overflow: "auto", display: "grid", placeItems: "center", background: "#0A1830" }}><img src={docPrev.url} alt="Dokumen" style={{ maxWidth: "100%" }} /></div>
              : <iframe src={docPrev.url} style={{ flex: 1, border: "none", background: "#fff" }} title="Dokumen pendaftaran" />}
          </div>
        )}
      </Modal>
    </div>
  );
}

function AdminGate() {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => { setAuthed(!!sessionStorage.getItem(SESSION_KEY)); setChecked(true); }, []);
  if (!checked) return null; // hindari flash saat cek sesi
  return authed ? <AdminInner /> : <AdminLogin onOk={() => setAuthed(true)} />;
}

export default function AdminPage() {
  return <StoreProvider><AdminGate /><Toasts /><ConfirmHost /></StoreProvider>;
}
