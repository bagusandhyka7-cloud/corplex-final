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
import { RowActions } from "@/components/RecordModal";
import { RecRow, SPECS, stripId } from "@/lib/records";
import { Toasts } from "@/components/shell";

/* ===== tipe & seed (in-memory; PROD: Supabase) ===== */
type Invite = { code: string; email: string; tier: string; expiresAt: number | null; createdAt: number; status: "active" | "used" | "expired" | "revoked" };
/* Durasi asli yang dipilih saat kode dibuat — diturunkan dari (expires_at − created_at), tanpa kolom baru */
const durLabel = (inv: Invite) => {
  if (!inv.expiresAt) return "Tanpa batas";
  const jam = Math.round((inv.expiresAt - inv.createdAt) / 3_600_000);
  return jam <= 24 ? "24 jam" : `${Math.round(jam / 24)} hari`;
};
type Seat = { nama: string; email: string; peran: string; status: "aktif" | "undangan" | "nonaktif" };
type Tenant = { id: string; nama: string; sector: string; entity: string; tier: string; sejak: string; exp: string | null; seats: Seat[] };
const expLabel = (exp: string | null) => {
  if (!exp) return { t: "Permanen", c: "c-ver" };
  const sisa = new Date(exp).getTime() - Date.now();
  if (sisa <= 0) return { t: "KEDALUWARSA", c: "c-red" };
  const jam = Math.ceil(sisa / 3600_000);
  return { t: jam >= 48 ? `${Math.ceil(jam / 24)} hari lagi` : `${jam} jam lagi`, c: jam <= 24 ? "c-draft" : "c-mon" };
};
type Pending = { id: string; nama: string; pendaftar: string; email: string; masuk: string; docs: { id: string; jenis: string; nama: string; dok_url: string | null }[] };

const DAY = 86_400_000;
const now = () => Date.now();
const fromRow = (r: InviteRow): Invite => ({
  code: r.code, email: r.email_target || "", tier: r.tier,
  expiresAt: r.expires_at ? new Date(r.expires_at).getTime() : null,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  status: r.status as Invite["status"],
});
const TIERS = ["Demo", "Tier 1", "Tier 2", "Tier 3 Lifetime"];
const EXP = [["24 jam", DAY], ["3 hari", 3 * DAY], ["7 hari", 7 * DAY], ["30 hari", 30 * DAY], ["Tanpa batas", 0]] as const;

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
  const ico = { position: "absolute" as const, left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(206,218,238,.5)" };
  return (
    /* Latar FIXED sepenuh layar — dulu hanya minHeight:100vh dengan gradasi sendiri, sehingga
     * batas antara pembungkus dan warna body tampak sebagai GARIS mendatar & dua warna berbeda.
     * Bahasa desainnya kini seragam dengan halaman auth klien. Kelas am-* khusus layar ini. */
    <div className="am-wrap">
      <style>{`
        .am-wrap{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;overflow:auto;
          padding:clamp(20px,4vmin,56px);background:#0A0E15}
        /* satu aksen cahaya bergerak — cukup untuk "hidup" tanpa membebani */
        .am-wrap::before{content:'';position:fixed;inset:-30%;pointer-events:none;filter:blur(90px);
          background:radial-gradient(closest-side,rgba(34,96,150,.42),transparent 68%);
          animation:amGlow 34s ease-in-out infinite alternate;will-change:transform}
        .am-wrap::after{content:'';position:fixed;inset:-25%;pointer-events:none;filter:blur(100px);
          background:radial-gradient(closest-side,rgba(176,138,62,.2),transparent 66%);
          animation:amGlow2 44s ease-in-out infinite alternate;will-change:transform}
        .am-card{position:relative;z-index:1;width:min(392px,100%);text-align:center;padding:36px 32px 30px;
          border-radius:22px;background:#0B0E14;border:1px solid rgba(255,255,255,.085);
          box-shadow:0 50px 110px -45px rgba(0,0,0,.85);
          animation:amIn .55s cubic-bezier(.2,.8,.25,1) both}
        .am-in{width:100%;border:1px solid rgba(255,255,255,.11);border-radius:11px;padding:11px 14px 11px 42px;
          background:rgba(255,255,255,.045);color:#EAF0FA;font-size:13px;font-family:inherit;font-weight:500;outline:none;
          transition:border-color .22s,background .22s,box-shadow .22s}
        .am-in::placeholder{color:rgba(206,218,238,.34);font-weight:400}
        .am-in:focus{border-color:rgba(217,188,128,.55);background:rgba(255,255,255,.075);box-shadow:0 0 0 3px rgba(176,138,62,.14)}
        .am-btn{width:100%;border:none;cursor:pointer;border-radius:11px;padding:12px;font-weight:700;font-size:13.5px;
          color:#0B1526;background:linear-gradient(135deg,#EAD09A 0%,#C9A45C 56%,#AC8535 100%);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.35);transition:transform .18s,filter .18s}
        .am-btn:hover:not(:disabled){filter:brightness(1.05);transform:translateY(-1px)}
        .am-btn:disabled{opacity:.45;cursor:not-allowed}
        @keyframes amIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes amGlow{0%{transform:translate3d(-10%,-6%,0) scale(1)}100%{transform:translate3d(10%,8%,0) scale(1.2)}}
        @keyframes amGlow2{0%{transform:translate3d(12%,8%,0) scale(1.15)}100%{transform:translate3d(-9%,-7%,0) scale(1)}}
        @media(prefers-reduced-motion:reduce){.am-wrap::before,.am-wrap::after,.am-card{animation:none!important}}
      `}</style>
      <div className="am-card">
        <img src="/logo-mrwp.svg" alt="MRWP" style={{ width: 52, height: 52, objectFit: "contain", margin: "0 auto 14px", display: "block" }} />
        <h2 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 23, margin: 0, letterSpacing: "-.01em" }}>Panel MRWP</h2>
        <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: ".28em", color: "#D9BC80", display: "block", margin: "8px 0 24px" }}>KHUSUS STAF · SUPER ADMIN</span>
        <div style={{ display: "grid", gap: 11, textAlign: "left" }}>
          <div style={{ position: "relative" }}>
            <input className="am-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email admin" />
            <Mail size={15} style={ico} />
          </div>
          <div style={{ position: "relative" }}>
            <input className="am-in" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void masuk(); }} placeholder="Kata sandi" />
            <Lock size={15} style={ico} />
          </div>
          <button className="am-btn" style={{ marginTop: 3 }} disabled={pending} aria-busy={pending} onClick={() => void masuk()}>
            {pending ? "Memverifikasi…" : "Masuk ke Panel"}
          </button>
        </div>
        <p style={{ fontSize: 10.5, lineHeight: 1.6, color: "rgba(206,218,238,.45)", marginTop: 18 }}>Akses tercatat pada jejak audit. Bukan staf MRWP? Tutup halaman ini.</p>
      </div>
    </div>
  );
}

function AdminInner() {
  const { toast } = useStore();
  const [menu, setMenu] = useState<"beranda" | "kode" | "seat" | "approval" | "advokat" | "pusat">("beranda");
  type Metrics = { tenantAktif: number; tenantPending: number; aktif30h: number; karyawan: number; dokumen: number; perModul: Record<string, number>; vqMasuk: number; vqVerified: number };
  const [mx, setMx] = useState<Metrics | null>(null);
  const loadMetrik = async () => { const r = await admin.metrics(); if (r.ok) setMx(r.data.metrics); else toast("Gagal memuat metrik", r.error.message, "warn"); };
  useEffect(() => { void loadMetrik(); }, [menu]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Detail Pusat Data DIHAPUS total (keputusan owner): akses data klien = Mode Pengawasan
   * (Masuk Dashboard) — lihat & unduh dari dashboard Corplex klien langsung. */

  /* Mode pengawasan: masuk dashboard Corplex klien (JWT super admin lolos RLS tenant tsb).
   * Tercatat audit; banner mencolok tampil di sisi klien. Tutup mode = kembali ke panel. */
  const masukDashboard = (t: { id: string; nama: string; tier?: string }) => {
    void admin.logView(t.id);
    localStorage.setItem("corplex_tid", t.id);
    localStorage.setItem("corplex_ten", JSON.stringify({ tenant: { id: t.id, name: t.nama, tier: t.tier || "Demo", status: "active" }, user: { nama: "Pengawasan MRWP", email: "adminmrwp", jabatan: "Super Admin" } }));
    localStorage.setItem("corplex_impersonate", t.nama);
    window.open("/beranda", "_blank");
    toast("Mode pengawasan dibuka", `${t.nama} — tab baru; akses tercatat pada jejak audit.`, "ok");
  };

  /* Edit/Hapus perusahaan (Pusat Data) */
  const [tEdit, setTEdit] = useState<Tenant | null>(null);
  const [teNama, setTeNama] = useState(""); const [teSector, setTeSector] = useState(""); const [teTier, setTeTier] = useState("Demo");
  const bukaEditTenant = (t: Tenant) => { setTEdit(t); setTeNama(t.nama); setTeSector(t.sector === "—" ? "" : t.sector); setTeTier(t.tier); };
  const simpanTenant = async () => {
    if (!tEdit || !teNama.trim()) return toast("Nama wajib diisi", "Nama perusahaan tidak boleh kosong.", "warn");
    const r = await admin.editTenant(tEdit.id, teNama.trim(), teSector.trim(), teTier);
    if (!r.ok) return toast("Gagal menyimpan", r.error.message, "warn");
    setTens((xs) => xs.map((x) => (x.id === tEdit.id ? { ...x, nama: teNama.trim(), sector: teSector.trim() || "—", tier: teTier } : x)));
    setTEdit(null); log("edit_tenant"); toast("Profil perusahaan diperbarui", teNama.trim(), "ok");
  };
  const hapusTenant = async (t: Tenant) => {
    if (!(await askConfirm(`Hapus perusahaan "${t.nama}"? Akses login seluruh kursinya ikut dicabut. Data modul & dokumen TIDAK dihapus (arsip).`))) return;
    const r = await admin.removeTenant(t.id);
    if (!r.ok) return toast("Gagal menghapus", r.error.message, "warn");
    setTens((xs) => xs.filter((x) => x.id !== t.id));
    log("remove_tenant"); toast("Perusahaan dihapus", `${t.nama} — akses dicabut, data diarsipkan.`, "warn");
  };

  /* Data Modul — agregat NYATA lintas tenant dari Supabase (employees + module_records +
   * attendance + verification_queue), realtime via postgres_changes. Nol seed. */
  type ModStat = { tenant: string; emp: number; att: number; vq: number; chat: number; draf: number; mods: Record<string, number> };
  const [modStats, setModStats] = useState<ModStat[]>([]);
  const [modLoading, setModLoading] = useState(false);
  const muatModul = React.useCallback(async () => {
    setModLoading(true);
    /* PDP: chat/draf hanya COUNT tenant_id (sinyal engagement) — nol isi konten ditarik. */
    const [e, m, a, v, c, d] = await Promise.all([
      sb.from("employees").select("tenant_id"),
      sb.from("module_records").select("tenant_id,module"),
      sb.from("attendance").select("tenant_id"),
      sb.from("verification_queue").select("tenant_id"),
      sb.from("chat_sessions").select("tenant_id,domain"),
      sb.from("draft_projects").select("tenant_id"),
    ]);
    const byTen: Record<string, ModStat> = {};
    const get = (t: string) => (byTen[t] ??= { tenant: t, emp: 0, att: 0, vq: 0, chat: 0, draf: 0, mods: {} });
    (e.data || []).forEach((r) => { get(r.tenant_id).emp++; });
    (a.data || []).forEach((r) => { get(r.tenant_id).att++; });
    (v.data || []).forEach((r) => { get(r.tenant_id).vq++; });
    (c.data || []).forEach((r) => { if (r.domain !== "draft") get(r.tenant_id).chat++; });
    (d.data || []).forEach((r) => { get(r.tenant_id).draf++; });
    (m.data || []).forEach((r) => { const s = get(r.tenant_id); s.mods[r.module] = (s.mods[r.module] || 0) + 1; });
    setModStats(Object.values(byTen).sort((x, y) => x.tenant.localeCompare(y.tenant)));
    setModLoading(false);
  }, []);
  useEffect(() => {
    if (menu !== "pusat") return;
    void muatModul();
    const ch = sb.channel(`admin-modul:${Date.now()}`) // topik unik — hindari reuse channel ter-subscribe
      .on("postgres_changes", { event: "*", schema: "public", table: "module_records" }, () => void muatModul())
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, () => void muatModul())
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [menu, muatModul]);
  const [authOpen, setAuthOpen] = useState(true);
  /* Jejak audit NYATA dari tabel audit_logs (dulu string sesi in-memory — buatan). */
  type AuditRow = { action: string; detail: unknown; actor: string | null; created_at: string };
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const muatAudit = React.useCallback(() => { void admin.listAudit().then((r) => { if (r.ok) setAudit(r.data); }); }, []);
  useEffect(() => { muatAudit(); }, [muatAudit]);
  /* log(): aksi besar sudah diaudit server-side — cukup segarkan daftar */
  const log = (_s: string) => { setTimeout(muatAudit, 600); };

  /* kode undangan — dimuat dari Supabase */
  const [inv, setInv] = useState<Invite[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  useEffect(() => {
    void admin.listInvites().then((res) => {
      if (res.ok) setInv(res.data.map(fromRow));
      else toast("Gagal memuat", res.error.message, "warn");
      setLoadingInv(false);
    });
  }, [toast, menu]); // + menu: daftar disegarkan tiap pindah menu (dulu hanya sekali seumur sesi)
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
        id: t.id, nama: t.name, sector: t.sector || "—", entity: t.entity || "—", tier: t.tier || "Demo", exp: t.expires_at,
        sejak: t.created_at ? new Date(t.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—",
        seats: (t.users || []).map((u) => ({ nama: u.nama || u.email.split("@")[0], email: u.email, peran: u.jabatan || "—", status: (u.active ? "aktif" : "nonaktif") as Seat["status"] })),
      })));
    });
  }, [menu]); // + menu: daftar disegarkan tiap pindah menu (dulu hanya sekali seumur sesi)
  /* id tenant → nama PT (utk Konsol Advokat & Data Modul — jangan tampilkan uuid mentah).
   * t1 = tenant demo tanpa baris tenants (seed) — beri nama baku. */
  const tenNama = (id: string) => id === "t1" ? "PT Contoh Sejahtera (Demo)" : tens.find((t) => t.id === id)?.nama || id;

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
  }, [toast, menu]); // + menu: daftar disegarkan tiap pindah menu (dulu hanya sekali seumur sesi)

  /* permintaan demo — nyata dari DB (bug lama: form menulis, panel tak pernah membaca) */
  type DemoReq = { id: string; nama: string | null; perusahaan: string | null; email: string | null; kebutuhan: string | null; status: string | null; created_at: string };
  const [demoReq, setDemoReq] = useState<DemoReq[]>([]);
  useEffect(() => { void admin.listDemo().then((r) => { if (r.ok) setDemoReq(r.data); }); }, [menu]); // + menu: daftar disegarkan tiap pindah menu (dulu hanya sekali seumur sesi)
  const tandaiDemo = async (id: string, status: string) => {
    const r = await admin.decideDemo(id, status);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setDemoReq((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    toast("Status diperbarui", "Permintaan demo ditandai " + status + ".", "ok");
  };

  /* konsol advokat — antrean verifikasi nyata dari DB */
  type VQRef = { mod: string; id: string; label: string };
  type VQ = { id: string; tenant_id: string; title: string; meta: string; chip: string; label: string; sla: string; status: string; note: string | null; created_at?: string; created_by?: string | null; ref_mod?: string | null; ref_id?: string | null; refs?: VQRef[]; detail?: string | null };
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
  /* REALTIME Konsol Advokat — pengajuan klien wajib muncul tanpa reload (SLA 24 jam).
   * verification_queue sudah ada di publication supabase_realtime; super admin lolos RLS (is_super). */
  useEffect(() => {
    const ch = sb.channel(`admin-vq:${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "verification_queue" }, () => muatVq())
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [muatVq]);

  /* Detail pengajuan (halaman penuh) — aksi HANYA di sini; membuka otomatis menandai MENINJAU
   * (tersinkron ke timeline klien via realtime verification_queue). */
  const [vqSel, setVqSel] = useState<VQ | null>(null);
  /* Smart attachment: daftar lampiran (refs jsonb; fallback kolom lama) — chip aktif menentukan
   * rekam yang tampil; klik chip = ganti data + dokumen di viewer TANPA reload. */
  type SrcRec = { data: unknown; dok_url: string | null; dok_nama: string | null; created_at: string };
  const [srcRec, setSrcRec] = useState<SrcRec | null>(null);
  const [refAktif, setRefAktif] = useState<VQRef | null>(null);
  const lampiran = (x: VQ | null): VQRef[] => !x ? [] :
    (x.refs?.length ? x.refs : (x.ref_id && x.ref_mod && x.ref_mod !== "emp" ? [{ mod: x.ref_mod, id: x.ref_id, label: SPECS[x.ref_mod]?.title || x.ref_mod }] : []));
  useEffect(() => { setRefAktif(lampiran(vqSel)[0] || null); }, [vqSel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSrcRec(null);
    if (!refAktif) return;
    void api.records.get(refAktif.id).then((r) => { if (r.ok) setSrcRec(r.data); });
  }, [refAktif]);
  const mintaInfo = (item: VQ) => {
    setNoteForm({ title: `Minta Info — ${item.title}`, label: "Pertanyaan untuk klien (tampil di portal klien, status tetap ditinjau)", val: "", onOk: (v) => {
      void api.verifq.askInfo(item.id, v).then((r) => {
        if (!r.ok) return toast("Gagal", r.error.message, "warn");
        const note = "PERTANYAAN ADVOKAT: " + v;
        setVq((xs) => xs.map((x) => (x.id === item.id ? { ...x, status: "meninjau", note } : x)));
        setVqSel((s) => (s && s.id === item.id ? { ...s, status: "meninjau", note } : s));
        toast("Pertanyaan terkirim", "Klien melihatnya pada kartu pengajuan di portal Corplex.", "ok");
      });
    } });
  };
  const bukaVq = (x: VQ) => {
    setVqSel(x);
    if (x.status === "masuk") {
      void api.verifq.review(x.id).then((r) => {
        if (!r.ok) return;
        setVq((xs) => xs.map((y) => (y.id === x.id ? { ...y, status: "meninjau" } : y)));
        setVqSel((s) => (s && s.id === x.id ? { ...s, status: "meninjau" } : s));
        log(`Advokat MENINJAU: ${x.title} (${tenNama(x.tenant_id)})`);
      });
    }
  };

  /* Drawer catatan — pengganti window.prompt (dilarang standar Enterprise).
   * {label, def, onOk} generik: dipakai Koreksi, Tolak antrean, dan Tolak approval. */
  const [noteForm, setNoteForm] = useState<{ title: string; label: string; val: string; onOk: (v: string) => void } | null>(null);

  const putuskanVq = async (item: VQ, status: "verified" | "rejected", modeKoreksi?: boolean) => {
    if (status === "rejected") {
      setNoteForm({ title: `Tolak — ${item.title}`, label: "Catatan profesional (wajib — dikirim ke klien)", val: "", onOk: (v) => void eksekusiVq(item, "rejected", "Catatan: " + v) });
      return;
    }
    if (modeKoreksi) {
      setNoteForm({ title: `Koreksi — ${item.title}`, label: "Ringkasan koreksi (tersimpan sebagai versi baru)", val: "", onOk: (v) => void eksekusiVq(item, "verified", `Disetujui dengan koreksi: ${v} · versi baru dibuat · ttd digital.`) });
      return;
    }
    await eksekusiVq(item, "verified", "Disetujui tanpa koreksi · ttd digital atas hash versi final.");
  };
  const eksekusiVq = async (item: VQ, status: "verified" | "rejected", note: string) => {
    const r = await api.verifq.decide(item.id, status, note);
    if (!r.ok) return toast("Gagal", r.error.message, "warn");
    setVq((xs) => xs.map((x) => x.id === item.id ? { ...x, status, note } : x));
    setVqSel((s) => (s && s.id === item.id ? { ...s, status, note } : s));
    log(`Advokat ${status === "verified" ? "SETUJUI" : "TOLAK"}: ${item.title} (${item.tenant_id})`);
    toast(status === "verified" ? "TERVERIFIKASI ADVOKAT ✓" : "Ditolak dengan catatan", status === "verified" ? "Ttd digital tercatat · status klien diperbarui." : "Catatan dikirim — klien dapat memperbaiki & mengajukan ulang.", status === "verified" ? "ok" : "warn");
  };

  const { run: buatKode, pending: making } = useAsyncAction(async () => {
    if (nEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nEmail)) { toast("Email tidak valid", "Kosongkan untuk kode generik, atau perbaiki formatnya.", "warn"); return; }
    const isLifetime = nTier === "Tier 3 Lifetime";
    const code = genCode();
    const res = await admin.act("create_invite", { code, email: nEmail, tier: nTier, expMs: isLifetime ? 0 : nExp });
    if (!res.ok) { toast("Gagal membuat kode", res.error.message, "warn"); return; }
    setInv((xs) => [{ code, email: nEmail, tier: nTier, expiresAt: isLifetime || !nExp ? null : now() + nExp, createdAt: now(), status: "active" }, ...xs]);
    setNOpen(false); setNEmail("");
    void navigator.clipboard?.writeText(code).catch(() => {});
    log(`Kode ${code} dibuat (${nTier}${nEmail ? " → " + nEmail : ""})`);
    toast("Kode dibuat & disalin", `${code} · ${nTier} · 2 kursi — bagikan ke calon klien.`, "ok");
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
      setNoteForm({ title: `Tolak pendaftaran — ${p.nama}`, label: "Alasan penolakan (wajib, dikirim ke pendaftar)", val: "", onOk: (v) => void putuskan(p, false, v) });
      return;
    }
    const res = await admin.decideTenant(p.id, ok, alasan);
    if (!res.ok) return toast("Gagal", res.error.message, "warn");
    setPend((xs) => xs.filter((x) => x.id !== p.id));
    if (ok) setTens((xs) => [...xs, { id: p.id, nama: p.nama, sector: "—", entity: "—", tier: "Demo", sejak: p.masuk, exp: new Date(Date.now() + 24 * 3600_000).toISOString(), seats: [{ nama: p.pendaftar, email: p.email, peran: "Pendaftar", status: "aktif" }] }]);
    log(`${p.nama} ${ok ? "DISETUJUI — tenant aktif" : "DITOLAK: " + alasan}`);
    toast(ok ? "Disetujui — tenant aktif" : "Ditolak", ok ? `${p.nama} kini bisa login. Email selamat datang terkirim.` : `Alasan dikirim ke ${p.email}.`, ok ? "ok" : "warn");
  };

  const selTen = tens.find((x) => x.id === sel);
  const invRows = inv.filter((x) => {
    const [, lbl] = chipOf(x);
    if (f !== "semua" && lbl !== f) return false;
    return (x.code + " " + x.email).toLowerCase().includes(q.toLowerCase());
  });

  const S = { side: { width: 232, flexShrink: 0, position: "sticky" as const, top: 0, height: "100vh", overflowY: "auto" as const, background: "linear-gradient(180deg,#0A1832,#060E1D)", borderRight: "1px solid rgba(130,160,215,.1)", padding: "18px 12px", display: "flex", flexDirection: "column" as const, gap: 4 },
    item: (on: boolean) => ({ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: on ? "#fff" : "#A9BDE4", background: on ? "linear-gradient(90deg,rgba(58,96,166,.3),rgba(58,96,166,.05))" : "none", borderLeft: on ? "3px solid var(--gold-bright)" : "3px solid transparent" }) };

  return (
    // overflowX clip (bukan hidden) — hidden merusak position:sticky sidebar (pelajaran kasus sidebar Corplex)
    <div style={{ display: "flex", minHeight: "100vh", maxWidth: "100vw", overflowX: "clip", background: "var(--bg, #091124)" }}>
      <style>{`
        .adm-drop{display:grid;grid-template-rows:0fr;transition:grid-template-rows .38s cubic-bezier(.4,0,.2,1)}
        .adm-drop.open{grid-template-rows:1fr}
        .adm-drop>div{overflow:hidden;display:grid;gap:2px;padding-left:14px;min-height:0}
        .adm-drop .it{opacity:0;transform:translateY(-7px);transition:opacity .3s ease,transform .3s cubic-bezier(.2,.8,.3,1.1)}
        .adm-drop.open .it{opacity:1;transform:none}
        .adm-drop.open .it:nth-child(1){transition-delay:.08s}
        .adm-drop.open .it:nth-child(2){transition-delay:.16s}
        .adm-drop.open .it:nth-child(3){transition-delay:.24s}
        .dash-tbl th:last-child,.dash-tbl td:last-child{text-align:left}
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
        <div style={S.item(menu === "beranda")} onClick={() => { setMenu("beranda"); if (!mx) void loadMetrik(); }}><LayoutDashboard size={15} /> Beranda</div>
        {/* Konsol Advokat bukan bagian dropdown — langsung di bawah Beranda (arahan owner) */}
        <div style={S.item(menu === "advokat")} onClick={() => setMenu("advokat")}>
          <Gavel size={15} /> Konsol Advokat
          {vq.filter((x) => x.status === "masuk" || x.status === "meninjau").length > 0 && <span style={{ marginLeft: "auto", background: "linear-gradient(145deg,var(--gold-bright),var(--gold))", color: "#060E1D", fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, minWidth: 17, height: 17, borderRadius: 100, display: "grid", placeItems: "center", padding: "0 5px" }}>{vq.filter((x) => x.status === "masuk" || x.status === "meninjau").length}</span>}
        </div>
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
        <div style={S.item(menu === "pusat")} onClick={() => setMenu("pusat")}><Lock size={15} /> Pusat Data</div>
        <div style={{ ...S.item(false), marginTop: "auto" }} onClick={() => { sessionStorage.removeItem(SESSION_KEY); void sb.auth.signOut().finally(() => location.reload()); }}><LogOut size={15} /> Keluar</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "#5E76A8", padding: 10, lineHeight: 1.8 }}>SERVICE-ROLE · SERVER-SIDE<br />SEMUA AKSI MASUK AUDIT</div>
      </aside>

      {/* konten */}
      <main className="adm-main" style={{ flex: 1, minWidth: 0, padding: "26px 30px", overflowX: "hidden" }}>
        {menu === "beranda" ? (
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
              <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 24, margin: 0 }}>Beranda</h1>
              <button className="btn btn-line btn-sm" onClick={() => void loadMetrik()}>Muat Ulang</button>
            </div>
            <p style={{ color: "var(--txt2)", fontSize: 12.5, marginBottom: 16 }}>Dasbor perusahaan — dihitung dari database operasional sendiri, bukan pelacak pihak ketiga (PDP-aman, zero-budget).</p>

            {/* KPI utama — adopsi & aktivitas nyata (dari /api/admin metrics) */}
            <div className="grid g4 mb16">
              <div className="kpi"><b>{mx ? mx.tenantAktif : tens.length}</b><span>Perusahaan aktif</span></div>
              <div className="kpi"><b>{mx ? mx.aktif30h : "—"}</b><span>Aktif 30 hari (isi data)</span></div>
              <div className="kpi"><b>{mx ? mx.karyawan : "—"}</b><span>Total karyawan</span></div>
              <div className="kpi"><b>{mx ? mx.dokumen : "—"}</b><span>Dokumen tersimpan</span></div>
            </div>
            {/* KPI operasional — onboarding, kursi, antrean advokat */}
            <div className="grid g4 mb16">
              <div className="kpi"><b>{inv.filter((x) => chipOf(x)[1] === "AKTIF").length}</b><span>Kode undangan aktif</span></div>
              <div className="kpi"><b>{pend.length}</b><span>Menunggu approval</span></div>
              <div className="kpi"><b>{tens.reduce((s, t) => s + t.seats.filter((x) => x.status !== "nonaktif").length, 0)}</b><span>Kursi terpakai</span></div>
              <div className="kpi"><b>{mx ? mx.vqMasuk : vq.filter((x) => x.status === "masuk" || x.status === "meninjau").length}</b><span>Antre verifikasi advokat</span></div>
            </div>

            <div className="grid g2 mb16" style={{ alignItems: "start" }}>
              <div className="panel" style={{ minWidth: 0 }}><h4>Adopsi per Modul</h4>
                {/* tinggi statis = kapasitas 10 baris (41px) + header; scroll-Y bila >10, X mati (info 2 kolom) */}
                <div className="tblwrap" style={{ height: 452, overflowX: "hidden", overflowY: "auto" }}>
                  <table className="dash-tbl" style={{ minWidth: 0 }}>
                    <thead><tr><th>Modul</th><th>Jumlah Rekam</th></tr></thead>
                    <tbody>
                      {mx && Object.entries(mx.perModul).sort((a, b) => b[1] - a[1]).map(([m, n]) => <tr key={m}><td>{m.toUpperCase()}</td><td>{n}</td></tr>)}
                      {mx && !Object.keys(mx.perModul).length && <tr><td colSpan={2} style={{ color: "var(--muted)" }}>Belum ada rekam modul.</td></tr>}
                      {!mx && <tr><td colSpan={2} style={{ color: "var(--muted)" }}>Memuat…</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="panel" style={{ minWidth: 0 }}><h4>Verifikasi &amp; Pipeline</h4>
                <div className="tblwrap" style={{ height: 452, overflowX: "hidden", overflowY: "auto" }}>
                  <table className="dash-tbl" style={{ minWidth: 0 }}>
                    <thead><tr><th>Tahap</th><th>Jumlah</th></tr></thead>
                    <tbody>
                      <tr><td>Antre verifikasi advokat</td><td>{mx ? mx.vqMasuk : "—"}</td></tr>
                      <tr><td>Terverifikasi advokat</td><td>{mx ? mx.vqVerified : "—"}</td></tr>
                      <tr><td>Pendaftaran menunggu approval</td><td>{mx ? mx.tenantPending : pend.length}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <p className="note mb16"><b>Adopsi per Modul</b> = jumlah rekam nyata tiap modul lintas seluruh tenant (modul terbanyak dipakai di atas) — ukuran seberapa dalam klien memakai Corplex. <b>Verifikasi &amp; Pipeline</b> = alur kerja advokat: berapa antre ditinjau, berapa sudah terverifikasi, dan berapa pendaftaran perusahaan menunggu approval. Aktivitas menurun = sinyal awal churn.</p>

            <div className="panel"><h4>Audit — Aksi Terakhir (tabel audit_logs)</h4>
              <div className="tblwrap" style={{ maxHeight: 360 }}>
                <table>
                  <thead><tr><th>Aksi</th><th>Detail</th><th>Waktu</th></tr></thead>
                  <tbody>
                    {audit.map((a, i) => (
                      <tr key={i}>
                        <td>{a.action}</td>
                        <td style={{ maxWidth: 380, whiteSpace: "normal", overflowWrap: "anywhere" }}>{typeof a.detail === "string" ? a.detail : JSON.stringify(a.detail)?.slice(0, 120)}</td>
                        <td><span className="sub mono" style={{ fontSize: 9.5 }}>{new Date(a.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></td>
                      </tr>
                    ))}
                    {!audit.length && <tr><td colSpan={3} style={{ color: "var(--muted)" }}>Belum ada aksi tercatat.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : menu === "pusat" ? (
          /* Pusat Data = daftar perusahaan + Mode Pengawasan (Detail dihapus — keputusan owner:
           * lihat & unduh data langsung dari dashboard Corplex klien via Masuk Dashboard). */
          <div>
            <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 24, marginBottom: 4 }}>Pusat Data</h1>
            <p style={{ color: "var(--txt2)", fontSize: 12.5, marginBottom: 16 }}>Seluruh perusahaan klien — gunakan <b>Masuk Dashboard</b> untuk melihat &amp; mengunduh datanya dari dashboard Corplex mereka. Setiap akses tercatat pada jejak audit.</p>
            <div className="panel">
              <div className="tblwrap">
                <table>
                  <thead><tr><th>Perusahaan</th><th>Bidang Usaha</th><th>Badan</th><th>Paket</th><th>Kursi</th><th>Terdaftar</th><th>Berlaku Sampai</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {/* t1 = tenant demo (tanpa baris tenants) — datanya nyata, Edit/Hapus tak berlaku */}
                    {[{ id: "t1", nama: "PT Contoh Sejahtera (Demo)", sector: "FMCG / Distribusi", entity: "PT", tier: "Demo", sejak: "—", exp: null as string | null, seats: [] as Seat[] }, ...tens].map((t) => (
                      <tr key={t.id}>
                        <td>{t.nama}</td>
                        <td>{t.sector}</td>
                        <td>{t.entity}</td>
                        <td><Chip c="c-mon">{t.tier.toUpperCase()}</Chip></td>
                        <td>{t.id === "t1" ? "—" : t.seats.filter((s) => s.status !== "nonaktif").length}</td>
                        <td>{t.sejak}</td>
                        <td>
                          <Chip c={expLabel(t.exp).c}>{expLabel(t.exp).t}</Chip>
                          {t.exp && <span className="sub" style={{ display: "block", fontSize: 9.5 }}>{new Date(t.exp).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                        </td>
                        <td><div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          {t.id !== "t1" && t.exp && (
                            <button className="btn btn-line btn-sm" title="Perpanjang 24 jam dari tenggat" onClick={async () => {
                              const r = await admin.extendTenant(t.id, 24);
                              if (!r.ok) return toast("Gagal memperpanjang", r.error.message, "warn");
                              setTens((xs) => xs.map((x) => (x.id === t.id ? { ...x, exp: r.data.expires_at } : x)));
                              log("extend_tenant");
                              toast("Diperpanjang +24 jam", `${t.nama} kini berlaku s.d. ${r.data.expires_at ? new Date(r.data.expires_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}.`, "ok");
                            }}>+24 jam</button>
                          )}
                          <button className="btn btn-gold btn-sm" onClick={() => masukDashboard(t)}><Lock size={11} style={{ display: "inline", marginRight: 4 }} />Masuk Dashboard</button>
                          {/* titik-3: Edit/Hapus — t1 (demo bawaan) dijawab jujur, tak bisa diubah */}
                          <RowActions
                            onEdit={() => t.id === "t1" ? toast("Tenant demo bawaan", "PT Contoh Sejahtera tidak memiliki baris database untuk diedit.", "warn") : bukaEditTenant(t)}
                            onDelete={() => t.id === "t1" ? toast("Tenant demo bawaan", "Tenant demo tidak dapat dihapus.", "warn") : void hapusTenant(t)} />
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="note mt16">Hapus mencabut akses login perusahaan; data modul &amp; dokumen tetap tersimpan sebagai arsip (tidak ikut terhapus).</p>
            </div>

            {/* Modul Per Tenant (dulu menu Data Modul) — di bawah tabel perusahaan; realtime */}
            <div style={{ marginTop: 28 }}>
              <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 24, marginBottom: 4 }}>Modul Per Tenant</h1>
              <p style={{ color: "var(--txt2)", fontSize: 12.5, marginBottom: 16 }}>Rekap rekam nyata seluruh tenant — langsung dari tabel Supabase, ter-update realtime saat modul menulis data.</p>
              <div className="panel">
              {/* tinggi statis = kapasitas 10 baris; scroll-Y bila >10. X tetap auto (13 kolom, lebar) */}
              <div className="tblwrap" style={{ height: 452 }}>
                <table>
                  <thead><tr><th>Tenant</th><th>Karyawan</th><th>SP</th><th>Izin</th><th>Aset</th><th>HKI</th><th>Polis</th><th>Perjanjian</th><th>Pajak</th><th>Kalkulator</th><th>Vault</th><th>Absensi</th><th>Verifikasi</th><th>Chat AI</th><th>Draf AI</th></tr></thead>
                  <tbody>
                    {modStats.map((s) => (
                      <tr key={s.tenant}>
                        <td><b>{tenNama(s.tenant)}</b></td>
                        <td>{s.emp}</td><td>{s.mods.sp || 0}</td><td>{s.mods.lic || 0}</td><td>{s.mods.assets || 0}</td>
                        <td>{s.mods.hki || 0}</td><td>{s.mods.pol || 0}</td><td>{s.mods.agr || 0}</td><td>{s.mods.tax || 0}</td>
                        <td>{s.mods.kalk || 0}</td><td>{s.mods.vault || 0}</td><td>{s.att}</td><td>{s.vq}</td><td>{s.chat}</td><td>{s.draf}</td>
                      </tr>
                    ))}
                    {!modStats.length && !modLoading && <tr><td colSpan={15} style={{ color: "var(--muted)" }}>Belum ada rekam modul di database.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="note mt16">Angka = jumlah baris nyata di <b>employees</b>, <b>module_records</b> (per modul), <b>attendance</b>, dan <b>verification_queue</b>. <b>Chat AI</b> &amp; <b>Draf AI</b> hanya hitungan sesi (sinyal aktivitas) — isi percakapan &amp; draf klien TIDAK diakses (kerahasiaan PDP). Nol seed/dummy.</p>
              </div>
            </div>
          </div>
        ) : menu === "advokat" ? (
          vqSel ? (
            /* ——— DETAIL PENGAJUAN (halaman penuh) — aksi hanya di sini ——— */
            <div>
              <button className="btn btn-line btn-sm" style={{ marginBottom: 14 }} onClick={() => setVqSel(null)}>← Kembali ke antrean</button>
              {/* Urutan baca legal officer: 1 judul+status · 2 MASALAHNYA APA · 3 siapa & metadata · 4 catatan · 5 bukti · 6 putusan */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 22, margin: 0, flex: 1, minWidth: 260 }}>{vqSel.title}</h1>
                <Chip c={vqSel.status === "verified" ? "c-ver" : vqSel.status === "rejected" ? "c-red" : vqSel.status === "meninjau" ? "c-gold" : "c-draft"}>{vqSel.status === "verified" ? "TERVERIFIKASI ✓" : vqSel.status === "rejected" ? "DITOLAK" : vqSel.status === "meninjau" ? "SEDANG DITINJAU" : "MASUK"}</Chip>
              </div>
              <p style={{ color: "var(--txt2)", fontSize: 12.5, margin: "4px 0 16px" }}>{vqSel.meta}</p>

              {/* 2 · URAIAN MASALAH — hal pertama yang dibaca advokat, lebar penuh */}
              <div className="panel boxed" style={{ borderLeft: "3px solid var(--gold)" }}>
                <h4>Uraian Masalah dari Klien</h4>
                {vqSel.detail
                  ? <p style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0, maxWidth: 860 }}>{vqSel.detail}</p>
                  : <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>— tidak ada uraian tersimpan (pengajuan dibuat sebelum pembaruan). Gunakan <b>Minta Info</b> untuk meminta konteks dari klien.</p>}
              </div>

              {/* 3 · dua kolom SEJAJAR: baris label-nilai identik (tinggi & gaya sama) */}
              <div className="grid g2" style={{ gap: 16, alignItems: "stretch", marginTop: 16 }}>
                {(() => {
                  const t = tens.find((x) => x.id === vqSel.tenant_id);
                  const baris = (rows: readonly (readonly [string, React.ReactNode])[]) => rows.map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,.06)", fontSize: 12.5, minHeight: 41 }}>
                      <span style={{ color: "var(--muted)", flexShrink: 0 }}>{l}</span>
                      <span style={{ color: "var(--ink)", textAlign: "right", overflowWrap: "anywhere" }}>{v}</span>
                    </div>
                  ));
                  return (<>
                    <div className="panel boxed" style={{ height: "100%" }}>
                      <h4>Informasi Pengajuan</h4>
                      {baris([
                        ["Label", <Chip key="l" c={vqSel.chip}>{vqSel.label}</Chip>],
                        ["Masuk antrean", vqSel.created_at ? new Date(vqSel.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"],
                        ["SLA", vqSel.sla || "SLA 24 JAM"],
                        ["Rekam sumber", vqSel.ref_mod ? `${SPECS[vqSel.ref_mod]?.title || vqSel.ref_mod} (tersaji di bawah)` : "— tidak tertaut (pengajuan lama)"],
                      ] as const)}
                    </div>
                    <div className="panel boxed" style={{ height: "100%" }}>
                      <h4>Profil Pelapor</h4>
                      {baris([
                        ["Perusahaan", tenNama(vqSel.tenant_id)],
                        ["Paket", t?.tier || "Demo"],
                        ["Pengaju", vqSel.created_by || "— tak tercatat (pengajuan lama)"],
                        ["Kursi aktif", t ? t.seats.filter((s) => s.status !== "nonaktif").map((s) => s.email).join(", ") || "—" : "—"],
                      ] as const)}
                    </div>
                  </>);
                })()}
              </div>

              {/* 4 · catatan/pertanyaan advokat — kotak sendiri lebar penuh (tak lagi nyempil di kolom) */}
              {vqSel.note && (
                <div className="panel boxed" style={{ marginTop: 16, borderLeft: "3px solid var(--gold-bright)" }}>
                  <h4>Catatan / Pertanyaan Advokat</h4>
                  <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{vqSel.note}</p>
                </div>
              )}

              {/* SMART ATTACHMENT — chip lampiran; klik = data + dokumen berganti instan (nol reload).
                  Viewer kanan sticky: narasi kiri discroll, bukti terkunci di pandangan. */}
              {lampiran(vqSel).length > 0 && (
                <div className="panel boxed" style={{ marginTop: 16 }}>
                  <h4>Lampiran &amp; Bukti — {lampiran(vqSel).length} rekam tertaut</h4>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 14px" }}>
                    {lampiran(vqSel).map((rf) => (
                      <button key={rf.id} className={`fchip${refAktif?.id === rf.id ? " on" : ""}`} onClick={() => setRefAktif(rf)}>
                        📎 {rf.label}
                      </button>
                    ))}
                  </div>
                  {!srcRec ? <p style={{ fontSize: 12.5, color: "var(--muted)" }}>Memuat rekam…</p> : (
                    <div className="grid g2" style={{ gap: 16, alignItems: "start" }}>
                      <div>
                        {(() => {
                          const spec = refAktif ? SPECS[refAktif.mod] : undefined;
                          if (spec && refAktif) {
                            const vals = spec.fromData(stripId(refAktif.mod, srcRec.data as RecRow));
                            return spec.fields.map((f2) => (
                              <div key={f2.k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: "1px solid rgba(255,255,255,.06)", fontSize: 12.5 }}>
                                <span style={{ color: "var(--muted)" }}>{f2.l.replace(" *", "")}</span>
                                <span style={{ color: "var(--ink)", textAlign: "right" }}>{vals?.[f2.k] || "—"}</span>
                              </div>
                            ));
                          }
                          /* mod objek (sp/case/corp/tax): tampilkan pasangan kunci-nilai primitif */
                          if (srcRec.data && typeof srcRec.data === "object" && !Array.isArray(srcRec.data)) {
                            return Object.entries(srcRec.data as Record<string, unknown>).filter(([, v]) => typeof v !== "object").slice(0, 10).map(([k, v]) => (
                              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: "1px solid rgba(255,255,255,.06)", fontSize: 12.5 }}>
                                <span style={{ color: "var(--muted)" }}>{k}</span>
                                <span style={{ color: "var(--ink)", textAlign: "right", overflowWrap: "anywhere" }}>{String(v ?? "—")}</span>
                              </div>
                            ));
                          }
                          return <pre style={{ fontSize: 11.5, color: "var(--ink)", whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(srcRec.data, null, 1).slice(0, 1200)}</pre>;
                        })()}
                      </div>
                      <div style={{ position: "sticky", top: 16, background: "var(--sur-3)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", height: 420, display: "flex", flexDirection: "column" }}>
                        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)", fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: ".1em", color: "var(--muted)" }}>DOKUMEN ASLI — {srcRec.dok_nama || "TIDAK ADA"}</div>
                        {srcRec.dok_url
                          ? (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(srcRec.dok_url)
                            ? <div style={{ flex: 1, overflow: "auto", display: "grid", placeItems: "center", background: "#0A1830" }}><img src={srcRec.dok_url} alt="Dokumen" style={{ maxWidth: "100%" }} /></div>
                            : <iframe src={srcRec.dok_url} style={{ flex: 1, border: "none", background: "#fff" }} title="Dokumen sumber" />)
                          : <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12 }}>Belum ada dokumen terunggah pada rekam ini.</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(vqSel.status === "masuk" || vqSel.status === "meninjau") && (
                <div className="panel boxed" style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, color: "var(--txt2)", flex: 1, minWidth: 220 }}>Keputusan bertanda tangan digital & tercatat pada jejak audit:</span>
                  <button className="btn btn-line" onClick={() => mintaInfo(vqSel)}>Minta Info</button>
                  <button className="btn btn-ok" onClick={() => void putuskanVq(vqSel, "verified")}>Setujui</button>
                  <button className="btn btn-navy" onClick={() => void putuskanVq(vqSel, "verified", true)}>Koreksi</button>
                  <button className="btn btn-red" onClick={() => void putuskanVq(vqSel, "rejected")}>Tolak</button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 24, marginBottom: 4 }}>Konsol Advokat</h1>
              <p style={{ color: "var(--txt2)", fontSize: 12.5, marginBottom: 16 }}>Antrean verifikasi dari seluruh tenant — buka pengajuan untuk melihat detail pelapor dan mengambil keputusan.</p>
              <div className="panel">
                <div className="tblwrap">
                  <table>
                    <thead><tr><th>Tenant</th><th>Pengajuan</th><th>Label</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                      {vq.filter((x) => x.status === "masuk" || x.status === "meninjau").map((x) => (
                        <tr key={x.id}>
                          <td><b style={{ fontSize: 12 }}>{tenNama(x.tenant_id)}</b></td>
                          <td><b>{x.title}</b><span className="sub">{x.meta}</span></td>
                          <td><Chip c={x.chip}>{x.label}</Chip></td>
                          <td><Chip c={x.status === "meninjau" ? "c-gold" : "c-draft"}>{x.status === "meninjau" ? "DITINJAU" : "MASUK"}</Chip></td>
                          <td><button className="btn-act" onClick={() => bukaVq(x)}><Lock size={10} style={{ display: "inline", marginRight: 4 }} />Buka</button></td>
                        </tr>
                      ))}
                      {!vq.filter((x) => x.status === "masuk" || x.status === "meninjau").length && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>{vqLoading ? "Memuat dari Supabase…" : "Antrean kosong — seluruh pengajuan telah diputuskan."}</td></tr>}
                    </tbody>
                  </table>
                </div>
                <p className="note mt16"><b>Prinsip tata kelola:</b> nasihat hukum final hanya lahir dari status TERVERIFIKASI ADVOKAT — tanda tangan digital atas hash versi final, dalam tanggung jawab profesional advokat MRWP. Membuka pengajuan otomatis menandai <b>SEDANG DITINJAU</b> pada portal klien.</p>
              </div>
              {vq.some((x) => x.status === "verified" || x.status === "rejected") && (
                <div className="panel" style={{ marginTop: 16 }}><h4>Keputusan Terakhir</h4>
                  <div className="rows">
                    {vq.filter((x) => x.status === "verified" || x.status === "rejected").slice(0, 6).map((x) => (
                      <div key={x.id} className="row"><div><b>{x.title}</b><span className="d">{x.note}</span></div>
                        <div className="right"><Chip c={x.status === "verified" ? "c-ver" : "c-red"}>{x.status === "verified" ? "TERVERIFIKASI ✓" : "DITOLAK"}</Chip><button className="btn btn-line btn-sm" onClick={() => bukaVq(x)}>Buka</button></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 24, marginBottom: 4 }}>
                  {menu === "kode" ? "Kode Undangan" : menu === "seat" ? "Akun & Seat" : "Approval Onboarding"}
                </h1>
                <p style={{ color: "var(--txt2)", fontSize: 12.5, marginBottom: 16 }}>
                  {menu === "kode" ? "Terbitkan & kelola kode undangan — masa berlaku ditegakkan server." : menu === "seat" ? "Kelola 2 kursi per perusahaan — email unik global." : "Setujui atau tolak pendaftaran perusahaan baru."}
                </p>
              </div>
              {menu === "kode" && <button className="btn btn-gold" onClick={() => setNOpen(true)}><Plus size={14} /> Buat Kode</button>}
            </div>

            {menu === "kode" && (
              <div className="panel">
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                  <input className="finput" style={{ flex: 1, minWidth: 200 }} placeholder="Cari kode / email…" value={q} onChange={(e) => setQ(e.target.value)} />
                  {["semua", "AKTIF", "TERPAKAI", "KEDALUWARSA", "DICABUT"].map((x) => (
                    <button key={x} className={`fchip${f === x ? " on" : ""}`} onClick={() => setF(x)}>{x === "semua" ? "Semua" : x[0] + x.slice(1).toLowerCase()}</button>
                  ))}
                </div>
                <div className="tblwrap">
                  <table>
                    <thead><tr><th>Kode</th><th>Untuk</th><th>Tier</th><th>Masa berlaku</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                      {invRows.map((x) => {
                        const [, lbl] = chipOf(x);
                        return (
                          <tr key={x.code}>
                            <td><span className="mono" style={{ fontSize: 12, letterSpacing: ".08em" }}>{x.code}</span></td>
                            <td>{x.email || <span style={{ color: "var(--muted)" }}>generik</span>}</td>
                            <td>{x.tier}</td>
                            <td>{durLabel(x)}</td>
                            {/* Label tetap biner (arahan owner). Warna + baris kecil menandai kode yang
                                sudah MATI — dulu dicabut/kedaluwarsa tampil hijau, terlihat masih bisa dipakai. */}
                            <td>
                              <Chip c={lbl === "TERPAKAI" ? "c-mon" : lbl === "AKTIF" ? "c-ver" : "c-red"}>
                                {lbl === "TERPAKAI" ? "Terpakai" : "Belum Terpakai"}
                              </Chip>
                              {lbl !== "TERPAKAI" && lbl !== "AKTIF" && (
                                <span className="sub" style={{ display: "block", fontSize: 9.5 }}>
                                  {lbl === "DICABUT" ? "dicabut — tak bisa dipakai" : "kedaluwarsa — tak bisa dipakai"}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <button className="btn btn-line btn-sm" title="Salin link" onClick={() => { void navigator.clipboard?.writeText(`${location.origin}/login?kode=${x.code}`); toast("Link disalin", x.code, "ok"); }}><Copy size={11} /></button>
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
              /* satu TABEL datar (bukan panel dalam grid): satu baris per kursi + baris undang bila kursi <2 */
              <div className="panel">
                <div className="tblwrap">
                  <table>
                    <thead><tr><th>Perusahaan</th><th>Paket</th><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                      {tens.flatMap((t) => [
                        ...t.seats.map((s) => (
                          <tr key={t.id + s.email}>
                            <td>{t.nama}</td>
                            <td><Chip c="c-mon">{t.tier.toUpperCase()}</Chip></td>
                            <td>{s.nama}</td><td>{s.email}</td><td>{s.peran}</td>
                            <td><Chip c={s.status === "aktif" ? "c-ver" : s.status === "undangan" ? "c-draft" : "c-red"}>{s.status.toUpperCase()}</Chip></td>
                            <td><div style={{ display: "inline-flex", gap: 6 }}>
                              <button className="btn btn-line btn-sm" title="Reset sandi" onClick={async () => { const r = await admin.resetSeat(s.email); if (!r.ok) return toast("Gagal", r.error.message, "warn"); if (r.data.link) void navigator.clipboard?.writeText(r.data.link); log(`Reset sandi ${s.email}`); toast("Tautan reset disalin", `Kirim ke ${s.email}.`, "ok"); }}><KeyRound size={11} /></button>
                              <button className="btn btn-red btn-sm" title="Hapus kursi" onClick={async () => { if (!(await askConfirm(`Hapus kursi ${s.email}?`))) return; const r = await admin.removeSeat(s.email); if (!r.ok) return toast("Gagal", r.error.message, "warn"); setTens((xs) => xs.map((z) => ({ ...z, seats: z.seats.filter((y) => y.email !== s.email) }))); log(`Kursi dihapus ${s.email}`); toast("Kursi dihapus", s.email, "warn"); }}><Trash2 size={11} /></button>
                            </div></td>
                          </tr>
                        )),
                        ...(t.seats.length < 2 ? [(
                          <tr key={t.id + "-undang"}>
                            <td>{t.nama}</td>
                            <td><Chip c="c-mon">{t.tier.toUpperCase()}</Chip></td>
                            <td colSpan={4} style={{ color: "var(--muted)" }}>Kursi ke-2 masih kosong</td>
                            <td><button className="btn btn-navy btn-sm" onClick={() => { setSel(t.id); setSeatOpen(true); }}><UserPlus size={12} /> Undang kursi ke-2</button></td>
                          </tr>
                        )] : []),
                      ])}
                      {!tens.length && <tr><td colSpan={7} style={{ color: "var(--muted)" }}>Belum ada perusahaan aktif.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <p className="note mt16">Batas 2 kursi per paket — semua tier. Email unik global: satu email satu akun.</p>
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

      {/* drawer edit perusahaan (Pusat Data) */}
      <Modal open={!!tEdit} right title={`Edit Perusahaan — ${tEdit?.nama || ""}`} onClose={() => setTEdit(null)}
        footer={<>
          <button className="btn btn-line" onClick={() => setTEdit(null)}>Batal</button>
          <button className="btn btn-gold" onClick={() => void simpanTenant()}>Simpan</button>
        </>}>
        <Field label="Nama perusahaan *"><input value={teNama} onChange={(e) => setTeNama(e.target.value)} /></Field>
        <Field label="Bidang usaha / industri"><input value={teSector} placeholder="mis. Manufaktur Makanan" onChange={(e) => setTeSector(e.target.value)} /></Field>
        <Field label="Paket"><select value={teTier} onChange={(e) => setTeTier(e.target.value)}>{TIERS.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <div className="note">Perubahan tersimpan ke tabel tenants dan tercatat pada jejak audit.</div>
      </Modal>

      {/* modal buat kode */}
      <Modal right open={nOpen} title="Buat Kode Undangan" onClose={() => setNOpen(false)}
        footer={<>
          <button className="btn btn-line" onClick={() => setNOpen(false)}>Batal</button>
          <button className="btn btn-gold" disabled={making} aria-busy={making} onClick={() => void buatKode()}>{making ? "Membuat…" : "Buat & Salin Kode"}</button>
        </>}>
        <Field label="Email tujuan (kosongkan untuk kode generik)"><input type="email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} placeholder="calon@klien.co.id" /></Field>
        <Field label="Tier">
          {/* Demo tak boleh permanen — bila pindah ke Demo saat "Tanpa batas" terpilih, reset ke 7 hari */}
          <select value={nTier} onChange={(e) => { const v = e.target.value; setNTier(v); if (v === "Demo" && nExp === 0) setNExp(7 * DAY); }}>{TIERS.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Masa berlaku">
          <select value={nExp} disabled={nTier === "Tier 3 Lifetime"} onChange={(e) => setNExp(+e.target.value)}>
            {EXP.filter(([, ms]) => !(nTier === "Demo" && ms === 0)).map(([l, ms]) => <option key={l} value={ms}>{l}</option>)}
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
