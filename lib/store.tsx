"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { emptyTenant, QItem, Tenant, TENANTS } from "./data";
import { api, empFromRow, subscribeRealtime } from "./api";
import { sb } from "./supabase";
import { RecRow, withId } from "./records";
import { useRouter } from "next/navigation";
import { ROUTE } from "./routes";

/* Topik channel wajib unik — sb.channel(nama) mengembalikan channel LAMA bila topik sama. */
let rekamSeq = 0;

export type ViewId = "ringkasan" | "assistant" | "drafter" | "employment" | "licensing" | "corpsec" | "asset" | "case" | "tools" | "agreement" | "asuransi" | "pajak" | "lawyer" | "hr-database" | "hr-sp" | "hr-kalkulator";

interface ToastItem { id: number; t: string; d: string; k?: string }
/* Sesi tenant nyata (dari login_user) — bukan fixtur seed. */
export type RealSession = { tenant: { id: string; name: string; tier: string; status: string }; user: { nama: string; email: string; jabatan: string | null } };

interface Store {
  isHydrated: boolean;
  ten: Tenant | null;
  go: (v: ViewId) => void;
  login: (tid: string, real?: RealSession) => void;
  logout: () => void;
  toast: (t: string, d: string, k?: string) => void;
  queue: QItem[];
  setQueue: React.Dispatch<React.SetStateAction<QItem[]>>;
  pushQueue: (t: string, m: string, chip: string, lbl: string, refs?: { mod: string; id: string; label: string }[], detail?: string) => void;
  quota: number; quotaMax: number; verified: number;
  setQuota: React.Dispatch<React.SetStateAction<number>>;
  setVerified: React.Dispatch<React.SetStateAction<number>>;
  queueCount: number;
  /* Mutasi sebagian tenant aktif (mis. emp setelah CRUD) — semua layar pemakai ten ikut ter-update. */
  patchTen: (p: Partial<Tenant>) => void;
  activeTab: number;
  setActiveTab: React.Dispatch<React.SetStateAction<number>>;
  lang: "id" | "en";
  setLang: (l: "id" | "en") => void;
  /* Naik tiap rekam berubah (realtime). Menu yang fetch sendiri memasukkannya ke deps useEffect. */
  rekamVer: number;
}

const Ctx = createContext<Store | null>(null);
/* Toasts dipisah: auto-hilang tiap 4,5s → tak lagi render ulang 26 konsumen store lain (perf). */
const ToastCtx = createContext<ToastItem[]>([]);
export const useToasts = () => useContext(ToastCtx);
export const useStore = () => useContext(Ctx)!;
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
/* Bangun ulang tenant nyata dari localStorage (refresh) — null bila tak ada/rusak. */
function realFromStorage(): Tenant | null {
  try {
    const raw = localStorage.getItem("corplex_ten");
    if (!raw) return null;
    const r = JSON.parse(raw) as RealSession;
    return r?.tenant?.id ? emptyTenant(r.tenant, r.user) : null;
  } catch { return null; }
}
export const fmt = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ten, setTen] = useState<Tenant | null>(null);
  useEffect(() => { tenUserRef.current = ten?.user || ""; }, [ten]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [queue, setQueue] = useState<QItem[]>([]);
  const [quota, setQuota] = useState(0);
  const [quotaMax, setQuotaMax] = useState(10);
  const [verified, setVerified] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [lang, setLangState] = useState<"id" | "en">("id");
  const [isHydrated, setIsHydrated] = useState(false);
  const [rekamVer, setRekamVer] = useState(0); // naik tiap rekam berubah (realtime) → pemicu segar lintas menu
  useEffect(() => { const l = localStorage.getItem("corplex_lang"); if (l === "en" || l === "id") setLangState(l); }, []);
  const setLang = useCallback((l: "id" | "en") => { setLangState(l); localStorage.setItem("corplex_lang", l); }, []);
  const router = useRouter();
  const tid = useRef(0);
  const tenUserRef = useRef(""); // pengaju utk antrean advokat (hindari stale closure pushQueue)
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const toast = useCallback((t: string, d: string, k?: string) => {
    const id = ++tid.current;
    setToasts((x) => [...x, { id, t, d, k }]);
    const h = setTimeout(() => { timers.current.delete(h); setToasts((x) => x.filter((i) => i.id !== id)); }, 4500);
    timers.current.add(h);
  }, []);

  // Clear pending toast timers on unmount — no setState after teardown.
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  // Realtime: keputusan advokat pada verification_queue langsung memperbarui antrean klien tanpa muat-ulang.
  useEffect(() => {
    if (!ten) return;
    const tid = localStorage.getItem("corplex_tid");
    if (!tid) return;
    return subscribeRealtime(tid, (row) => {
      const item: QItem = { id: row.id, t: row.title, m: row.meta, chip: row.chip, lbl: row.label, sla: row.sla, status: row.status as QItem["status"], note: row.note || undefined };
      setQueue((q) => q.some((x) => x.id === row.id) ? q.map((x) => x.id === row.id ? item : x) : [item, ...q]);
      if (row.status === "verified") toast("TERVERIFIKASI ADVOKAT ✓", `“${row.title}” — ttd digital tercatat.`, "ok");
      if (row.status === "rejected") toast("Perlu revisi", `“${row.title}” — catatan advokat tersedia.`, "warn");
    });
  }, [ten, toast]);

  // Hydrate session from localStorage — seed (t1/t2/t3) atau tenant nyata (corplex_ten).
  useEffect(() => {
    const storedTid = localStorage.getItem("corplex_tid");
    const T = storedTid ? (TENANTS[storedTid] ?? realFromStorage()) : null;
    if (storedTid && T) {
      setTen({ ...T, emp: [] }); // karyawan menyusul murni dari DB (nol dummy)
      /* NOL DUMMY Pengacara MRWP: antrean murni verification_queue DB — seed dibuang.
       * Kuota terpakai = jumlah pengajuan nyata; terverifikasi = jumlah status verified. */
      setQueue([]);
      setQuota(0); setQuotaMax(T.quota.max); setVerified(0);
      void api.verifq.list(storedTid).then((r) => {
        if (!r.ok) return;
        const rows: QItem[] = r.data.map((x) => ({ id: x.id, t: x.title, m: x.meta, chip: x.chip, lbl: x.label, sla: x.sla, status: x.status as QItem["status"], note: x.note || undefined }));
        setQueue(rows);
        setQuota(rows.length);
        setVerified(rows.filter((x) => x.status === "verified").length);
      });
      /* PINTU KEDUA (sesi berjalan): tiap rehidrasi cek whoami — demo kedaluwarsa langsung ditendang.
       * RLS (jwt_tenant → NULL) sudah membutakan data detik itu juga; ini merapikan UX-nya. */
      if (!TENANTS[storedTid] && !localStorage.getItem("corplex_impersonate")) {
        void sb.rpc("whoami").then(({ data }) => {
          if (data?.ok && data.tenant?.status === "expired") {
            setTen(null); setQueue([]);
            localStorage.removeItem("corplex_tid"); localStorage.removeItem("corplex_ten");
            void sb.auth.signOut();
            toast("Masa demo berakhir", "Akses demo Anda telah usai — hubungi tim MRWP untuk perpanjangan.", "warn");
            router.replace("/login");
          }
        });
      }
    }
    setIsHydrated(true);
  }, []);

  // Sesi JWT habis/di-revoke → jangan blank screen: beri toast elegan + antar ke /login.
  useEffect(() => {
    const { data: sub } = api.onAuthExpired(() => {
      if (!localStorage.getItem("corplex_tid")) return; // memang sedang logout normal
      setTen(null); setQueue([]);
      localStorage.removeItem("corplex_tid"); localStorage.removeItem("corplex_ten");
      toast("Sesi berakhir", "Demi keamanan, silakan masuk kembali.", "warn");
      router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Offline/online awareness — surface connectivity loss through the existing toast system.
  useEffect(() => {
    const off = () => toast("Koneksi terputus", "Perubahan tidak tersimpan saat offline — sambungkan kembali untuk melanjutkan.", "warn");
    const on = () => toast("Koneksi pulih", "Sinkronisasi dilanjutkan.", "ok");
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, [toast]);

  /* go(viewId) = navigasi URL — satu shim, semua pemanggil lama tetap jalan.
   * activeTab direset agar tab menu sebelumnya tidak bocor ke menu tujuan (bug #3). */
  const go = useCallback((v: ViewId) => {
    setActiveTab(0);
    router.push(ROUTE[v]);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [router]);

  const pushQueue = useCallback((t: string, m: string, chip: string, lbl: string, refs?: { mod: string; id: string; label: string }[], detail?: string) => {
    setQueue((q) => [{ t, m, chip, lbl, sla: "SLA 24 JAM", status: "masuk" as const }, ...q]);
    setQuota((n) => n + 1); // kuota terpakai = jumlah pengajuan nyata
    toast("Masuk antrean verifikasi", `“${t}” — prioritas dihitung dari SLA paket + risiko + eskalasi.`);
    // tulis juga ke antrean nyata (DB) — dibaca Konsol Advokat di /adminmrwp
    const tid = localStorage.getItem("corplex_tid");
    /* pelapor utk detail Konsol Advokat — sesi nyata (corplex_ten) atau string user tenant (demo) */
    let by = "";
    try { const r = JSON.parse(localStorage.getItem("corplex_ten") || "null"); by = r?.user?.email || r?.user?.nama || ""; } catch { /* seed */ }
    if (!by) by = tenUserRef.current;
    if (tid) void api.verifq.push(tid, t, m, chip, lbl, { by: by || undefined, refs, detail });
  }, [toast, router]);

  const login = useCallback((id: string, real?: RealSession) => {
    const T = real ? emptyTenant(real.tenant, real.user) : TENANTS[id];
    setTen({ ...T, emp: [] }); // karyawan menyusul murni dari DB (nol dummy)
    setQueue(clone(T.queue));
    setQuota(T.quota.used); setQuotaMax(T.quota.max); setVerified(T.verified);
    localStorage.setItem("corplex_tid", real ? real.tenant.id : id);
    if (real) localStorage.setItem("corplex_ten", JSON.stringify(real));
    else localStorage.removeItem("corplex_ten");
    toast("Selamat datang, " + T.name, `Sesi aman dimulai · token terikat tenant_id=${T.id} · seluruh kueri terkurung pada tenant ini.`, "ok");
  }, [toast]);

  const logout = useCallback(() => {
    setTen(null); setQueue([]);
    localStorage.removeItem("corplex_tid");
    localStorage.removeItem("corplex_ten");
    localStorage.removeItem("corplex_impersonate"); // mode pengawasan MRWP ikut ditutup
    void api.authSignOut(); // cabut JWT Supabase Auth — sesi RLS mati total
    toast("Sesi diakhiri", "Seluruh data tenant dibersihkan dari memori dan dari tampilan. Silakan pilih perusahaan untuk masuk kembali.");
  }, [toast]);

  // Auto-logout idle 30 mnt — aplikasi hukum sering dibuka di komputer bersama (5u-B).
  useEffect(() => {
    if (!ten) return;
    let h: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(h); h = setTimeout(logout, 30 * 60 * 1000); };
    const evs = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(h); evs.forEach((e) => window.removeEventListener(e, reset)); };
  }, [ten, logout]);

  const queueCount = queue.filter((q) => q.status === "masuk" || q.status === "meninjau").length; // belum diputus advokat

  const patchTen = useCallback((p: Partial<Tenant>) => setTen((t) => (t ? { ...t, ...p } : t)), []);

  /* REALTIME REKAM — satu langganan untuk seluruh aplikasi.
   * `module_records` & `employees` sudah aktif di publication supabase_realtime, tetapi sebelumnya
   * tak pernah didengarkan klien: tulis di satu menu tidak sampai ke menu lain (atau ke kursi ke-2)
   * sampai halaman dimuat ulang. Setiap perubahan menaikkan `rekamVer` → hidrasi `ten` diulang dan
   * menu yang punya fetch sendiri ikut menyegarkan (rekamVer masuk deps-nya).
   * Debounce 400ms: impor Excel 100 baris = 100 event, cukup satu penyegaran. */
  useEffect(() => {
    if (!ten?.id) return;
    const tid = localStorage.getItem("corplex_tid");
    if (!tid) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const tandai = () => { if (t) clearTimeout(t); t = setTimeout(() => setRekamVer((v) => v + 1), 400); };
    const ch = sb.channel(`rekam:${tid}:${++rekamSeq}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "module_records", filter: `tenant_id=eq.${tid}` }, tandai)
      .on("postgres_changes", { event: "*", schema: "public", table: "employees", filter: `tenant_id=eq.${tid}` }, tandai)
      .subscribe();
    return () => { if (t) clearTimeout(t); void sb.removeChannel(ch); };
  }, [ten?.id]);

  // Karyawan dari DB digabung di depan seed — dashboard/profil/database membaca satu sumber (ten.emp).
  useEffect(() => {
    if (!ten?.id) return;
    const tid = localStorage.getItem("corplex_tid");
    if (!tid) return;
    // NOL DUMMY (arahan owner): karyawan = murni baris DB, seed tidak digabung.
    void api.employees.list(tid).then((r) => {
      if (!r.ok) return;
      setTen((t) => t ? { ...t, emp: r.data.map(empFromRow) } : t);
    });
    // Rekam modul generik (module_records) — id diselipkan withId; baris seed (tanpa id) tetap di belakang.
    void api.records.list(tid).then((r) => {
      if (!r.ok || !r.data.length) return;
      const by = (m: string) => r.data.filter((x) => x.module === m).map((x) => withId(m, x.data as RecRow, x.id));
      /* NOL DUMMY (arahan owner): baris seed dibuang — tabel modul murni rekam DB,
       * sehingga setiap baris punya id dan aksi Edit/Hapus selalu hidup. */
      /* Perkara & Sekretaris Perusahaan kini DB murni: mod 'case' (per perkara, jsonb timeline)
       * + mod 'corp' (singleton profil tata kelola per tenant). */
      const caseRows = r.data.filter((x) => x.module === "case")
        .map((x) => ({ ...(x.data as import("./data").Case), id: x.id, dokUrl: x.dok_url, dokNama: x.dok_nama }));
      const corpRow = r.data.find((x) => x.module === "corp");
      setTen((t) => t ? {
        ...t,
        lic: by("lic") as typeof t.lic,
        assets: by("assets") as typeof t.assets,
        hki: by("hki") as typeof t.hki,
        agr: by("agr") as unknown as typeof t.agr,
        asr: { ...t.asr, pol: by("pol") as typeof t.asr.pol },
        cases: caseRows,
        corp: corpRow ? { ...(corpRow.data as typeof t.corp), id: corpRow.id } : t.corp,
      } : t);
    });
  }, [ten?.id, rekamVer]); // rekamVer: realtime memicu hidrasi ulang

  const value = useMemo(() => ({ isHydrated, ten, go, login, logout, toast, queue, setQueue, pushQueue, quota, quotaMax, verified, setQuota, setVerified, queueCount, patchTen, activeTab, setActiveTab, lang, setLang, rekamVer }),
    [isHydrated, ten, go, router, login, logout, toast, queue, pushQueue, quota, quotaMax, verified, queueCount, patchTen, activeTab, setActiveTab, lang, setLang, rekamVer]);

  return <Ctx.Provider value={value}><ToastCtx.Provider value={toasts}>{children}</ToastCtx.Provider></Ctx.Provider>;
}
