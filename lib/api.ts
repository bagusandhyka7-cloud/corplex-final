/*
 * API abstraction layer — single seam between the frontend and the future backend.
 * Every call is async, abortable, and returns a discriminated ApiResult.
 * Each endpoint carries a `PROD:` note with the real Supabase call it will become,
 * so swapping the implementation never touches component code.
 */

import { sb } from "./supabase";

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
  authSignOut: () => sb.auth.signOut().catch(() => {}),
  /* Terpusat: JWT habis/di-revoke (bukan signOut manual) → callback UI. */
  onAuthExpired: (cb: () => void) =>
    sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") cb(); }),
  auth: {
    /* PROD: supabase.auth.signInWithPassword({ email, password }) → session JWT carries tenant_id claim */
    async login(p: { tid: string; email: string; password: string }, signal?: AbortSignal): Promise<ApiResult<{ tid: string }>> {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return err("validation", "Format email tidak valid.");
      if (!p.password.trim()) return err("validation", "Kata sandi wajib diisi.");
      return net({ tid: p.tid }, { signal, ms: 650 });
    },
    /* PROD: supabase.auth.signOut() */
    async logout(): Promise<ApiResult<null>> { return net(null, { ms: 150 }); },

    /* NYATA: cek tabel public.invitations — status, expiry, kuota pakai.
     * PROD: pindah ke RPC server-side agar logika tak bisa dilewati klien. */
    /* Validasi kode via RPC security definer — tabel invitations kini terkunci RLS (super saja). */
    async verifyInvite(code: string): Promise<ApiResult<{ tier: string; expiresIn: string; seats: number }>> {
      const c = code.trim().toUpperCase();
      if (!c) return err("validation", "Kode undangan wajib diisi.");
      const { data, error } = await sb.rpc("check_invite", { p_code: c });
      if (error) return err("network", "Gagal menghubungi server — coba lagi.");
      if (!data?.ok) return err("auth", data?.error || "Kode ditolak.");
      return ok({ tier: data.tier, expiresIn: data.expires_in, seats: data.seats });
    },

    /* NYATA: RPC register_tenant — transaksi tunggal (validasi kode, tenant pending,
     * user ber-bcrypt, konsumsi kode, dokumen, audit). Email unik ditegakkan DB. */
    async register(payload: { kode: string; akun: { nama: string; jabatan: string; email: string; pw: string }; perusahaan: Record<string, string>; dokumen: { jenis: string; nama: string; ukuran: number; url?: string }[] }): Promise<ApiResult<{ status: "pending_review" }>> {
      const { data, error } = await sb.rpc("register_tenant", {
        p_kode: payload.kode, p_nama: payload.akun.nama, p_jabatan: payload.akun.jabatan,
        p_email: payload.akun.email, p_password: payload.akun.pw,
        p_pt: payload.perusahaan, p_docs: payload.dokumen,
      });
      if (error) return err("server", "Gagal mendaftar — coba lagi.");
      if (!data?.ok) return err("auth", data?.error || "Pendaftaran ditolak.");
      return ok({ status: "pending_review" as const });
    },

    /* KONSOLIDASI: Supabase Auth (signIn) + RPC whoami (profil app_users + status tenant).
     * Tabel users lama sudah dipensiunkan. */
    async loginDb(email: string, password: string): Promise<ApiResult<{ user: { nama: string; email: string; jabatan: string | null }; tenant: { id: string; name: string; tier: string; status: string } }>> {
      const a = await sb.auth.signInWithPassword({ email, password });
      if (a.error) return err("auth", "Email atau kata sandi salah.");
      const { data, error } = await sb.rpc("whoami");
      if (error || !data?.ok) { await sb.auth.signOut(); return err("network", data?.error || "Gagal memuat profil."); }
      const st = data.tenant?.status;
      if (st === "pending_review") { await sb.auth.signOut(); return err("auth", "Pendaftaran masih ditinjau tim MRWP — biasanya < 1×24 jam."); }
      if (st === "rejected") { await sb.auth.signOut(); return err("auth", "Pendaftaran ditolak — periksa email Anda untuk alasannya."); }
      return ok({ user: data.user, tenant: data.tenant });
    },
    /* Sign-in JWT untuk jalur demo t1 (akun auth demo sudah dibuat di migrasi). */
    async signIn(email: string, password: string): Promise<ApiResult<null>> {
      const a = await sb.auth.signInWithPassword({ email, password });
      return a.error ? err("auth", "Autentikasi gagal.") : ok(null);
    },
  },

  demo: {
    /* NYATA: insert ke public.demo_requests. Email ke admin masih simulasi. */
    async request(payload: { nama: string; perusahaan: string; email: string; kebutuhan: string }): Promise<ApiResult<{ ok: true }>> {
      if (!payload.nama.trim()) return err("validation", "Nama wajib diisi.");
      if (!payload.perusahaan.trim()) return err("validation", "Nama perusahaan wajib diisi.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return err("validation", "Format email tidak valid.");
      const { error } = await sb.from("demo_requests").insert(payload);
      if (error) return err("server", "Gagal menyimpan permintaan — coba lagi.");
      return ok({ ok: true as const });
    },
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

  /* Karyawan — tabel employees NYATA per tenant. Kolom `source` disiapkan utk Extract AI. */
  employees: {
    async list(tid: string): Promise<ApiResult<EmpRow[]>> {
      const { data, error } = await sb.from("employees").select("*").eq("tenant_id", tid).order("created_at", { ascending: false });
      if (error) return err("network", "Gagal memuat data karyawan.");
      return ok(data as EmpRow[]);
    },
    async create(tid: string, rec: Partial<EmpRow>): Promise<ApiResult<EmpRow>> {
      const { data, error } = await sb.from("employees").insert({ ...rec, tenant_id: tid }).select().single();
      if (error) return err("server", "Gagal menyimpan karyawan.");
      return ok(data as EmpRow);
    },
    async update(id: string, rec: Partial<EmpRow>): Promise<ApiResult<EmpRow>> {
      const { data, error } = await sb.from("employees").update({ ...rec, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) return err("server", "Gagal memperbarui karyawan.");
      return ok(data as EmpRow);
    },
    async remove(id: string): Promise<ApiResult<null>> {
      const { error } = await sb.from("employees").delete().eq("id", id);
      return error ? err("server", "Gagal menghapus.") : ok(null);
    },
    /* Foto → Storage bucket publik employee-photos/<tid>/<ts>-<nama file>. */
    async uploadPhoto(tid: string, file: File): Promise<ApiResult<{ url: string }>> {
      const path = `${tid}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await sb.storage.from("employee-photos").upload(path, file);
      if (error) return err("server", "Gagal mengunggah foto.");
      return ok({ url: sb.storage.from("employee-photos").getPublicUrl(path).data.publicUrl });
    },
    /* Dokumen kerja (PK/KTP/dll) → bucket employee-docs; url tersimpan di kolom dok_url. */
    async uploadDoc(tid: string, file: File): Promise<ApiResult<{ url: string; name: string }>> {
      const path = `${tid}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await sb.storage.from("employee-docs").upload(path, file);
      if (error) return err("server", "Gagal mengunggah dokumen.");
      return ok({ url: sb.storage.from("employee-docs").getPublicUrl(path).data.publicUrl, name: file.name });
    },
    /* PROD: SP records append to sp table with FK */
    async issueSp(rec: Record<string, unknown>, signal?: AbortSignal) { return net(rec, { signal }); },
  },

  queue: {
    /* PROD: supabase.rpc("push_verification_queue", {...}) — transaction-safe quota check server-side */
    async push(item: Record<string, unknown>, signal?: AbortSignal) { return net(item, { signal }); },
    /* PROD: supabase.rpc("verify_document", { id, mode, note }) — advisory-lock quota increment */
    async verify(p: { index: number; mode: string; note: string }, signal?: AbortSignal) { return net(p, { signal }); },
  },

  ai: {
    /* NYATA: streaming dari /api/chat (Anthropic via server route — key di env server). */
    async chatStream(p: { messages: { role: "user" | "assistant"; content: string }[]; model: string; signal?: AbortSignal; onDelta: (t: string) => void; company?: { name: string; sector: string; entity?: string }; mode?: "chat" | "draft" }): Promise<ApiResult<string>> {
      let r: Response;
      try {
        r = await fetch("/api/chat", {
          method: "POST", signal: p.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: p.messages, model: p.model, company: p.company, mode: p.mode }),
        });
      } catch (e) {
        return (e as Error).name === "AbortError" ? err("aborted", "Dibatalkan.") : err("network", "Gagal menghubungi server.");
      }
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        return err(r.status === 501 ? "server" : "network", j?.error || `Gagal (${r.status}).`);
      }
      const reader = r.body!.getReader();
      const dec = new TextDecoder();
      let full = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const t = dec.decode(value, { stream: true });
          full += t;
          p.onDelta(t);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return err("aborted", "Dibatalkan.");
        return err("network", "Stream terputus.");
      }
      return ok(full);
    },
  },

  /* Persistensi chat — tabel chat_sessions / chat_messages (nyata di Supabase).
   * Isolasi tenant: list & insert selalu difilter tenant_id sesi aktif. */
  chat: {
    /* domain memisahkan sesi Assistant vs Drafter (kolom sudah ada di tabel). */
    async listSessions(domain?: string): Promise<ApiResult<{ id: string; title: string; domain: string }[]>> {
      let q = sb.from("chat_sessions").select("id,title,domain")
        .eq("tenant_id", localStorage.getItem("corplex_tid") || "")
        .order("updated_at", { ascending: false });
      if (domain) q = q.eq("domain", domain);
      const { data, error } = await q;
      if (error) return err("network", "Gagal memuat percakapan.");
      return ok(data);
    },
    async createSession(domain?: string): Promise<ApiResult<{ id: string; title: string; domain: string }>> {
      const { data, error } = await sb.from("chat_sessions")
        .insert({ tenant_id: localStorage.getItem("corplex_tid") || "", ...(domain ? { domain } : {}) })
        .select("id,title,domain").single();
      if (error) return err("server", "Gagal membuat percakapan.");
      return ok(data);
    },
    async renameSession(id: string, title: string) {
      const { error } = await sb.from("chat_sessions").update({ title, updated_at: new Date().toISOString() }).eq("id", id);
      return error ? err("server", "Gagal mengganti nama.") : ok(null);
    },
    async deleteSession(id: string) {
      const { error } = await sb.from("chat_sessions").delete().eq("id", id);
      return error ? err("server", "Gagal menghapus.") : ok(null);
    },
    async listMessages(sessionId: string): Promise<ApiResult<{ role: "user" | "assistant"; content: string; citations: number }[]>> {
      const { data, error } = await sb.from("chat_messages").select("role,content,citations").eq("session_id", sessionId).order("created_at");
      if (error) return err("network", "Gagal memuat pesan.");
      return ok(data as { role: "user" | "assistant"; content: string; citations: number }[]);
    },
    async addMessage(sessionId: string, role: "user" | "assistant", content: string, model?: string) {
      const { error } = await sb.from("chat_messages").insert({ session_id: sessionId, role, content, model: model || null });
      void sb.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId).then(() => {});
      return error ? err("server", "Gagal menyimpan pesan.") : ok(null);
    },
  },

  /* Antrean verifikasi advokat — verification_queue (nyata di Supabase).
   * User push dari modul mana pun; advokat memutuskan di Konsol Advokat /adminmrwp. */
  verifq: {
    async list(tenantId?: string, status?: string): Promise<ApiResult<{ id: string; tenant_id: string; title: string; meta: string; chip: string; label: string; sla: string; status: string; note: string | null }[]>> {
      let q = sb.from("verification_queue").select("*").order("created_at", { ascending: false });
      if (tenantId) q = q.eq("tenant_id", tenantId);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return err("network", "Gagal memuat antrean.");
      return ok(data);
    },
    async push(tenantId: string, title: string, meta: string, chip: string, label: string) {
      const { data, error } = await sb.from("verification_queue").insert({ tenant_id: tenantId, title, meta, chip, label }).select("id").single();
      return error ? err("server", "Gagal mengirim ke antrean.") : ok(data);
    },
    async decide(id: string, status: "verified" | "rejected", note: string) {
      const { error } = await sb.from("verification_queue").update({ status, note, decided_by: "Adv. MRWP", decided_at: new Date().toISOString() }).eq("id", id);
      void sb.from("audit_logs").insert({ action: "advokat_" + status, detail: { id, note }, actor: "adminmrwp" }).then(() => {});
      return error ? err("server", "Gagal menyimpan keputusan.") : ok(null);
    },
  },

  /* Projek AI Drafting — draft_projects. Percakapan penyusunnya berbagi tabel chat_sessions/
   * chat_messages dgn AI Assistant (session_id) — draf yang tak pernah "Simpan ke Projek"
   * otomatis tetap jadi riwayat biasa di Assistant, bukan mengotori daftar Projek. */
  drafts: {
    async list(): Promise<ApiResult<{ id: string; session_id: string | null; title: string; body: string; tone: string; model: string; status: string }[]>> {
      const { data, error } = await sb.from("draft_projects").select("*")
        .eq("tenant_id", localStorage.getItem("corplex_tid") || "")
        .order("updated_at", { ascending: false });
      if (error) return err("network", "Gagal memuat projek.");
      return ok(data);
    },
    async create(sessionId: string | null, title: string, body: string, model: string, tone: string) {
      const { data, error } = await sb.from("draft_projects")
        .insert({ tenant_id: localStorage.getItem("corplex_tid") || "", session_id: sessionId, title, body, model, tone }).select().single();
      if (error) return err("server", "Gagal menyimpan ke projek.");
      return ok(data);
    },
    async rename(id: string, title: string) {
      const { error } = await sb.from("draft_projects").update({ title, updated_at: new Date().toISOString() }).eq("id", id);
      return error ? err("server", "Gagal mengganti nama.") : ok(null);
    },
    async remove(id: string) {
      const { error } = await sb.from("draft_projects").delete().eq("id", id);
      return error ? err("server", "Gagal menghapus.") : ok(null);
    },
    async updateBody(id: string, body: string) {
      const { error } = await sb.from("draft_projects").update({ body, updated_at: new Date().toISOString() }).eq("id", id);
      return error ? err("server", "Gagal menyimpan draf.") : ok(null);
    },
    async updateTone(id: string, tone: string) {
      const { error } = await sb.from("draft_projects").update({ tone }).eq("id", id);
      return error ? err("server", "Gagal mengubah tone.") : ok(null);
    },
  },

  /* Absensi rekap bulanan — sumber metrik "Karyawan Paling Rajin". */
  attendance: {
    async list(tid: string): Promise<ApiResult<AttRow[]>> {
      const { data, error } = await sb.from("attendance").select("*").eq("tenant_id", tid).order("periode", { ascending: false });
      if (error) return err("network", "Gagal memuat absensi.");
      return ok(data as AttRow[]);
    },
    async upsert(tid: string, employee_id: string, periode: string, v: { hadir: number; izin: number; sakit: number; alpha: number }): Promise<ApiResult<AttRow>> {
      const { data, error } = await sb.from("attendance").upsert({ tenant_id: tid, employee_id, periode, ...v }, { onConflict: "employee_id,periode" }).select().single();
      if (error) return err("server", "Gagal menyimpan absensi.");
      return ok(data as AttRow);
    },
    async remove(id: string): Promise<ApiResult<null>> {
      const { error } = await sb.from("attendance").delete().eq("id", id);
      return error ? err("server", "Gagal menghapus absensi.") : ok(null);
    },
  },

  /* Rekam modul generik — module_records (jsonb). Satu CRUD utk lic/assets/hki/pol/agr/…. */
  records: {
    async list(tid: string): Promise<ApiResult<{ id: string; module: string; data: unknown; dok_url?: string | null; dok_nama?: string | null }[]>> {
      const { data, error } = await sb.from("module_records").select("id,module,data,dok_url,dok_nama").eq("tenant_id", tid).order("created_at", { ascending: false });
      if (error) return err("network", "Gagal memuat rekam modul.");
      return ok(data);
    },
    async get(id: string): Promise<ApiResult<{ id: string; module: string; data: unknown; dok_url: string | null; dok_nama: string | null; created_at: string; source: string }>> {
      const { data, error } = await sb.from("module_records").select("id,module,data,dok_url,dok_nama,created_at,source").eq("id", id).single();
      if (error) return err("network", "Rekam tidak ditemukan.");
      return ok(data);
    },
    async create(tid: string, module: string, data: unknown, source = "manual", dok?: { url: string; nama: string }): Promise<ApiResult<{ id: string }>> {
      const { data: row, error } = await sb.from("module_records").insert({ tenant_id: tid, module, data, source, dok_url: dok?.url ?? null, dok_nama: dok?.nama ?? null }).select("id").single();
      if (error) return err("server", "Gagal menyimpan rekam.");
      return ok(row);
    },
    /* Dokumen rekam modul → bucket module-docs. */
    async uploadDoc(tid: string, file: File): Promise<ApiResult<{ url: string; nama: string }>> {
      const path = `${tid}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await sb.storage.from("module-docs").upload(path, file);
      if (error) return err("server", "Gagal mengunggah dokumen.");
      return ok({ url: sb.storage.from("module-docs").getPublicUrl(path).data.publicUrl, nama: file.name });
    },
    /* dok: {url,nama} = ganti berkas · null = hapus berkas · undefined = biarkan apa adanya */
    async update(id: string, data: unknown, dok?: { url: string; nama: string } | null): Promise<ApiResult<null>> {
      const patch: Record<string, unknown> = { data, updated_at: new Date().toISOString() };
      if (dok !== undefined) { patch.dok_url = dok?.url ?? null; patch.dok_nama = dok?.nama ?? null; }
      const { error } = await sb.from("module_records").update(patch).eq("id", id);
      return error ? err("server", "Gagal memperbarui rekam.") : ok(null);
    },
    async remove(id: string): Promise<ApiResult<null>> {
      const { error } = await sb.from("module_records").delete().eq("id", id);
      return error ? err("server", "Gagal menghapus rekam.") : ok(null);
    },
  },

  premium: {
    /* PROD: supabase.from("legal_reports").insert({...}) — conflict-of-interest check runs server-side first */
    async request(p: { bidang: string; skema: string }, signal?: AbortSignal) { return net(p, { signal, ms: 700 }); },
  },
};

export type InviteRow = { code: string; email_target: string | null; tier: string; seats: number; expires_at: string | null; status: string; used_count: number; max_uses: number };

export type AttRow = { id: string; tenant_id: string; employee_id: string; periode: string; hadir: number; izin: number; sakit: number; alpha: number };

/* Baris tabel employees ↔ bentuk UI `Emp` (lib/data.ts). */
export type EmpRow = {
  id: string; tenant_id: string; nama: string; jabatan: string; jk: "L" | "P"; wn: "TKI" | "TKA";
  lok: boolean; status: "PKWT" | "PKWTT"; masa: string; sisa: number | null; komp: string; pat: string;
  rem: boolean; dok: string; prov: string | null; kota: string | null; desa: string | null;
  foto_url: string | null; source: string;
  nik: string | null; kk: string | null; npwp: string | null; bpjs_kes: string | null; bpjs_tk: string | null;
  sim: string | null; pendidikan: string | null; tgl_lahir: string | null; departemen: string | null;
  kontak_darurat_nama: string | null; kontak_darurat_telp: string | null; pengalaman: string | null; dok_url: string | null;
  agama: string | null; status_nikah: string | null; gol_darah: string | null; bank_nama: string | null;
  bank_rekening: string | null; alamat_ktp: string | null; pendidikan_institusi: string | null;
  gaji_pokok: number | null; tunjangan_tetap: number | null; upah: number | null; mulai_kerja: string | null; akhir_kontrak: string | null;
};
export const empFromRow = (r: EmpRow) => ({
  id: r.id, foto: r.foto_url, n: r.nama, j: r.jabatan, jk: r.jk, wn: r.wn, lok: r.lok, s: r.status,
  m: r.masa, sisa: r.sisa, komp: r.komp, pat: r.pat, rem: r.rem, dok: r.dok,
  prov: r.prov || undefined, kota: r.kota || undefined, desa: r.desa || undefined,
  nik: r.nik || undefined, kk: r.kk || undefined, npwp: r.npwp || undefined,
  bpjsKes: r.bpjs_kes || undefined, bpjsTk: r.bpjs_tk || undefined, sim: r.sim || undefined,
  pend: r.pendidikan || undefined, lahir: r.tgl_lahir || undefined, dept: r.departemen || undefined,
  kdNama: r.kontak_darurat_nama || undefined, kdTelp: r.kontak_darurat_telp || undefined,
  pengalaman: r.pengalaman || undefined, dokUrl: r.dok_url || undefined,
  agama: r.agama || undefined, nikah: r.status_nikah || undefined, golDarah: r.gol_darah || undefined,
  bankNama: r.bank_nama || undefined, bankRek: r.bank_rekening || undefined,
  alamatKtp: r.alamat_ktp || undefined, pendInst: r.pendidikan_institusi || undefined,
  gajiPokok: r.gaji_pokok, tunjTetap: r.tunjangan_tetap, upah: r.upah, mulaiKerja: r.mulai_kerja || undefined, akhirKontrak: r.akhir_kontrak || undefined,
});
type EmpIn = { n: string; j: string; jk: "L" | "P"; wn: "TKI" | "TKA"; lok: boolean; s: "PKWT" | "PKWTT"; m: string; sisa?: number | null; komp?: string; pat?: string; rem?: boolean; dok?: string; prov?: string; kota?: string; desa?: string; foto?: string | null; nik?: string; kk?: string; npwp?: string; bpjsKes?: string; bpjsTk?: string; sim?: string; pend?: string; lahir?: string; dept?: string; kdNama?: string; kdTelp?: string; pengalaman?: string; dokUrl?: string | null; agama?: string; nikah?: string; golDarah?: string; bankNama?: string; bankRek?: string; alamatKtp?: string; pendInst?: string; gajiPokok?: number | null; tunjTetap?: number | null; mulaiKerja?: string; akhirKontrak?: string };
export const empToRow = (e: EmpIn, source = "manual"): Partial<EmpRow> => ({
  nama: e.n, jabatan: e.j || "—", jk: e.jk, wn: e.wn, lok: e.lok, status: e.s, masa: e.m,
  sisa: e.sisa ?? null, komp: e.komp || "—", pat: e.pat || "PATUH", rem: e.rem ?? false, dok: e.dok || "",
  prov: e.prov || null, kota: e.kota || null, desa: e.desa || null, foto_url: e.foto || null, source,
  nik: e.nik || null, kk: e.kk || null, npwp: e.npwp || null, bpjs_kes: e.bpjsKes || null, bpjs_tk: e.bpjsTk || null,
  sim: e.sim || null, pendidikan: e.pend || null, tgl_lahir: e.lahir || null, departemen: e.dept || null,
  kontak_darurat_nama: e.kdNama || null, kontak_darurat_telp: e.kdTelp || null, pengalaman: e.pengalaman || null, dok_url: e.dokUrl || null,
  agama: e.agama || null, status_nikah: e.nikah || null, gol_darah: e.golDarah || null, bank_nama: e.bankNama || null,
  bank_rekening: e.bankRek || null, alamat_ktp: e.alamatKtp || null, pendidikan_institusi: e.pendInst || null,
  // `upah` kolom generated di DB — JANGAN dikirim, Postgres yang menghitung
  gaji_pokok: e.gajiPokok ?? null, tunjangan_tetap: e.tunjTetap ?? null, mulai_kerja: e.mulaiKerja || null, akhir_kontrak: e.akhirKontrak || null,
});

/* Panggilan back-office lewat route service-role (server-side). Password admin dari
 * sessionStorage dilampirkan tiap permintaan — tabel tenants/users terkunci untuk anon. */
async function adminPost<T>(op: string, args?: Record<string, unknown>): Promise<ApiResult<T>> {
  const password = typeof window !== "undefined" ? sessionStorage.getItem("adminmrwp_pw") || "" : "";
  const token = (await sb.auth.getSession()).data.session?.access_token; // RBAC: JWT super_admin
  let r: Response;
  try {
    r = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, op, args, token }) });
  } catch { return err("network", "Gagal menghubungi server."); }
  const j = await r.json().catch(() => null);
  if (!r.ok) return err(r.status === 401 ? "auth" : "server", j?.error || `Gagal (${r.status}).`);
  return ok((j?.data ?? j) as T);
}

export type PendDoc = { id: string; jenis: string; nama: string; dok_url: string | null };
type PendRow = { id: string; name: string; created_at: string; users: { nama: string | null; email: string }[]; company_documents: PendDoc[] };
export type TenantRow = { id: string; name: string; tier: string; status: string; users: { nama: string | null; email: string; jabatan: string | null; active: boolean }[] };

export const admin = {
  /* Verifikasi password admin lewat route (bukan konstanta klien). */
  async auth(): Promise<ApiResult<{ ok: true }>> { return adminPost("auth"); },

  /* NYATA untuk invite ops (tabel invitations + audit_logs) — tetap anon (invitations permissive-demo). */
  async listInvites(): Promise<ApiResult<InviteRow[]>> {
    const { data, error } = await sb.from("invitations").select("*").order("created_at", { ascending: false });
    if (error) return err("network", "Gagal memuat kode undangan.");
    return ok(data as InviteRow[]);
  },
  /* Antrean approval onboarding — tenants pending_review nyata dari DB (via service-role). */
  async listPending(): Promise<ApiResult<{ id: string; name: string; created_at: string; email: string; nama: string; docs: PendDoc[] }[]>> {
    const res = await adminPost<PendRow[]>("listPending");
    if (!res.ok) return res;
    return ok((res.data || []).map((t) => ({
      id: t.id, name: t.name, created_at: t.created_at,
      email: t.users?.[0]?.email || "—", nama: t.users?.[0]?.nama || "—",
      docs: t.company_documents || [],
    })));
  },
  /* Tenant aktif + kursi (users) — untuk Akun & Seat. */
  /* Permintaan demo dari halaman login (bug lama: tersimpan tapi tak pernah ditampilkan). */
  async listDemo(): Promise<ApiResult<{ id: string; nama: string | null; perusahaan: string | null; email: string | null; kebutuhan: string | null; status: string | null; created_at: string }[]>> {
    return adminPost("listDemo");
  },
  async decideDemo(id: string, status: string) { return adminPost<{ ok: true }>("decideDemo", { id, status }); },

  async listTenants(): Promise<ApiResult<TenantRow[]>> { return adminPost<TenantRow[]>("listTenants"); },
  async decideTenant(id: string, approve: boolean, reason?: string) {
    return adminPost<{ ok: true }>("decideTenant", { id, approve, reason });
  },
  /* Seat NYATA — lewat server (Auth Admin API butuh service role). */
  async inviteSeat(tenant: string, email: string) { return adminPost<{ link: string | null }>("inviteSeat", { tenant, email }); },
  async resetSeat(email: string) { return adminPost<{ link: string | null }>("resetSeat", { email }); },
  async removeSeat(email: string) { return adminPost<{ ok: true }>("removeSeat", { email }); },
  async tenantDocs(tenant: string) { return adminPost<{ docs: { kel: string; nama: string; jenis: string; url: string }[]; karyawan: number }>("tenantDocs", { tenant }); },
  async metrics() { return adminPost<{ metrics: { tenantAktif: number; tenantPending: number; aktif30h: number; karyawan: number; dokumen: number; perModul: Record<string, number>; vqMasuk: number; vqVerified: number } }>("metrics", {}); },
  async act(action: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<ApiResult<Record<string, unknown>>> {
    if (action === "create_invite") {
      const expMs = Number(payload.expMs || 0);
      const { error } = await sb.from("invitations").insert({
        code: payload.code, email_target: payload.email || null, tier: payload.tier,
        expires_at: expMs ? new Date(Date.now() + expMs).toISOString() : null,
      });
      if (error) return err("server", "Gagal menyimpan kode (kode duplikat?).");
    } else if (action === "revoke_invite") {
      const { error } = await sb.from("invitations").update({ status: "revoked" }).eq("code", payload.code);
      if (error) return err("server", "Gagal mencabut kode.");
    } else {
      await net(null, { signal, ms: 400 }); // approve/reject/seat/reset — simulasi (tabel belum ada)
    }
    void sb.from("audit_logs").insert({ action, detail: payload as object, actor: "adminmrwp" }).then(() => {}); // .then wajib: builder supabase lazy
    return ok({ action, ...payload });
  },
};

/* Realtime NYATA: perubahan verification_queue tenant ini (keputusan advokat) langsung dikirim ke klien.
 * Topik diberi suffix unik — sb.channel(nama) mengembalikan channel LAMA bila topik sama, dan
 * menambah callback setelah subscribe() dilarang (crash saat remount/StrictMode). */
let vqSeq = 0;
export function subscribeRealtime(tenantId: string, cb: (row: { id: string; title: string; meta: string; chip: string; label: string; sla: string; status: string; note: string | null }) => void): () => void {
  const ch = sb.channel(`vq:${tenantId}:${++vqSeq}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "verification_queue", filter: `tenant_id=eq.${tenantId}` },
      (p) => { const r = p.new as Parameters<typeof cb>[0] | null; if (r && r.id) cb(r); })
    .subscribe();
  return () => { void sb.removeChannel(ch); };
}
