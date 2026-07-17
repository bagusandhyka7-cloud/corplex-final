"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { QItem, Tenant, TENANTS } from "./data";
import { subscribeRealtime } from "./api";

export type ViewId = "ringkasan" | "assistant" | "drafter" | "employment" | "licensing" | "corpsec" | "asset" | "case" | "tools" | "agreement" | "asuransi" | "pajak" | "lawyer";

interface ToastItem { id: number; t: string; d: string; k?: string }

interface Store {
  ten: Tenant | null;
  view: ViewId;
  go: (v: ViewId) => void;
  login: (tid: string) => void;
  logout: () => void;
  toast: (t: string, d: string, k?: string) => void;
  toasts: ToastItem[];
  queue: QItem[];
  setQueue: React.Dispatch<React.SetStateAction<QItem[]>>;
  pushQueue: (t: string, m: string, chip: string, lbl: string) => void;
  quota: number; quotaMax: number; verified: number;
  setQuota: React.Dispatch<React.SetStateAction<number>>;
  setVerified: React.Dispatch<React.SetStateAction<number>>;
  queueCount: number;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const fmt = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ten, setTen] = useState<Tenant | null>(null);
  const [view, setView] = useState<ViewId>("ringkasan");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [queue, setQueue] = useState<QItem[]>([]);
  const [quota, setQuota] = useState(0);
  const [quotaMax, setQuotaMax] = useState(10);
  const [verified, setVerified] = useState(0);
  const tid = useRef(0);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const toast = useCallback((t: string, d: string, k?: string) => {
    const id = ++tid.current;
    setToasts((x) => [...x, { id, t, d, k }]);
    const h = setTimeout(() => { timers.current.delete(h); setToasts((x) => x.filter((i) => i.id !== id)); }, 4500);
    timers.current.add(h);
  }, []);

  // Clear pending toast timers on unmount — no setState after teardown.
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  // Tenant-scoped realtime subscription (Supabase Realtime placeholder) — bound to session lifetime.
  useEffect(() => {
    if (!ten) return;
    return subscribeRealtime(`tenant:${ten.id}`, () => {
      /* PROD: reconcile postgres_changes payloads into queue/quota/verified state */
    });
  }, [ten]);

  // Offline/online awareness — surface connectivity loss through the existing toast system.
  useEffect(() => {
    const off = () => toast("Koneksi terputus", "Perubahan tidak tersimpan saat offline — sambungkan kembali untuk melanjutkan.", "warn");
    const on = () => toast("Koneksi pulih", "Sinkronisasi dilanjutkan.", "ok");
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, [toast]);

  const go = useCallback((v: ViewId) => {
    setView(v);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const pushQueue = useCallback((t: string, m: string, chip: string, lbl: string) => {
    setQueue((q) => [{ t, m, chip, lbl, sla: "SLA 24 JAM", status: "masuk" as const }, ...q]);
    toast("Masuk antrean verifikasi", `“${t}” — prioritas dihitung dari SLA paket + risiko + eskalasi.`);
  }, [toast]);

  const login = useCallback((id: string) => {
    const T = TENANTS[id];
    setTen(T);
    setQueue(clone(T.queue));
    setQuota(T.quota.used); setQuotaMax(T.quota.max); setVerified(T.verified);
    setView("ringkasan");
    toast("Selamat datang, " + T.name, `Sesi aman dimulai · token terikat tenant_id=${id} · seluruh kueri terkurung pada tenant ini.`, "ok");
  }, [toast]);

  const logout = useCallback(() => {
    setTen(null); setQueue([]);
    toast("Sesi diakhiri", "Seluruh data tenant dibersihkan dari memori dan dari tampilan. Silakan pilih perusahaan untuk masuk kembali.");
  }, [toast]);

  const queueCount = queue.filter((q) => q.status === "masuk").length;

  const value = useMemo(() => ({ ten, view, go, login, logout, toast, toasts, queue, setQueue, pushQueue, quota, quotaMax, verified, setQuota, setVerified, queueCount }),
    [ten, view, go, login, logout, toast, toasts, queue, pushQueue, quota, quotaMax, verified, queueCount]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
