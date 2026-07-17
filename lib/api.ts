/*
 * API abstraction layer — single seam between the frontend and the future backend.
 * Every call is async, abortable, and returns a discriminated ApiResult.
 * Each endpoint carries a `PROD:` note with the real Supabase call it will become,
 * so swapping the implementation never touches component code.
 */

export type ApiError = { code: "network" | "validation" | "auth" | "quota" | "aborted" | "server"; message: string };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export const err = (code: ApiError["code"], message: string): ApiResult<never> => ({ ok: false, error: { code, message } });
export const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });

/* Simulated network transport: latency + abort support. Deterministic by default
 * (failRate opt-in) so the demo stays reliable while the retry path stays real. */
function net<T>(data: T, opts?: { ms?: number; signal?: AbortSignal; failRate?: number }): Promise<ApiResult<T>> {
  const ms = opts?.ms ?? 400 + Math.random() * 500;
  return new Promise((resolve) => {
    if (opts?.signal?.aborted) return resolve(err("aborted", "Permintaan dibatalkan."));
    const t = setTimeout(() => {
      if (opts?.failRate && Math.random() < opts.failRate) resolve(err("network", "Koneksi terputus — coba lagi."));
      else resolve(ok(data));
    }, ms);
    opts?.signal?.addEventListener("abort", () => { clearTimeout(t); resolve(err("aborted", "Permintaan dibatalkan.")); }, { once: true });
  });
}

/* Exponential-backoff retry for transient failures. Never retries validation/auth/abort. */
export async function withRetry<T>(fn: () => Promise<ApiResult<T>>, retries = 2, baseMs = 600): Promise<ApiResult<T>> {
  let last: ApiResult<T> = await fn();
  for (let i = 0; i < retries && !last.ok && (last.error.code === "network" || last.error.code === "server"); i++) {
    await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    last = await fn();
  }
  return last;
}

export const api = {
  auth: {
    /* PROD: supabase.auth.signInWithPassword({ email, password }) → session JWT carries tenant_id claim */
    async login(p: { tid: string; email: string; password: string }, signal?: AbortSignal): Promise<ApiResult<{ tid: string }>> {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return err("validation", "Format email tidak valid.");
      if (!p.password.trim()) return err("validation", "Kata sandi wajib diisi.");
      return net({ tid: p.tid }, { signal, ms: 650 });
    },
    /* PROD: supabase.auth.signOut() */
    async logout(): Promise<ApiResult<null>> { return net(null, { ms: 150 }); },
  },

  vault: {
    /* PROD: supabase.storage.from("vault").upload(`${tenantId}/${file.name}`, file) → storage event triggers Edge Function OCR/extraction */
    async upload(file: File, opts?: { signal?: AbortSignal; onProgress?: (pct: number) => void }): Promise<ApiResult<{ name: string }>> {
      const steps = 5;
      for (let i = 1; i <= steps; i++) {
        if (opts?.signal?.aborted) return err("aborted", "Unggahan dibatalkan.");
        await new Promise((r) => setTimeout(r, 140));
        opts?.onProgress?.(Math.round((i / steps) * 100));
      }
      return ok({ name: file.name });
    },
  },

  agreements: {
    /* PROD: supabase.from("contracts").insert({...}).select().single() — RLS scopes to tenant_id */
    async create(rec: Record<string, unknown>, signal?: AbortSignal) { return net(rec, { signal }); },
  },

  employees: {
    /* PROD: supabase.from("employees").insert({...}) */
    async create(rec: Record<string, unknown>, signal?: AbortSignal) { return net(rec, { signal }); },
    /* PROD: supabase.from("employees").update({...}).eq("id", id) — SP records append to sp table with FK */
    async issueSp(rec: Record<string, unknown>, signal?: AbortSignal) { return net(rec, { signal }); },
  },

  queue: {
    /* PROD: supabase.rpc("push_verification_queue", {...}) — transaction-safe quota check server-side */
    async push(item: Record<string, unknown>, signal?: AbortSignal) { return net(item, { signal }); },
    /* PROD: supabase.rpc("verify_document", { id, mode, note }) — advisory-lock quota increment */
    async verify(p: { index: number; mode: string; note: string }, signal?: AbortSignal) { return net(p, { signal }); },
  },

  ai: {
    /* PROD: fetch("/api/ai/ask") → Edge Function → RAG pipeline (retrieval-grounded, zero-hallucination gate) */
    async ask(q: string, signal?: AbortSignal): Promise<ApiResult<{ answer: string }>> {
      if (!q.trim()) return err("validation", "Pertanyaan kosong.");
      return net({ answer: q }, { signal, ms: 900 });
    },
  },

  premium: {
    /* PROD: supabase.from("legal_reports").insert({...}) — conflict-of-interest check runs server-side first */
    async request(p: { bidang: string; skema: string }, signal?: AbortSignal) { return net(p, { signal, ms: 700 }); },
  },
};

/* Realtime placeholder. PROD:
 *   const ch = supabase.channel(`tenant:${tid}`)
 *     .on("postgres_changes", { event: "*", schema: "public", filter: `tenant_id=eq.${tid}` }, cb)
 *     .subscribe();
 *   return () => supabase.removeChannel(ch);
 */
export function subscribeRealtime(_channel: string, _cb: (payload: unknown) => void): () => void {
  return () => {};
}
