import { createClient } from "@supabase/supabase-js";

/* Klien Supabase (anon/publishable key — aman untuk browser).
 * PROD: operasi admin pindah ke route handler dengan service-role key. */
/* Fallback placeholder agar prerender build TIDAK crash saat env belum ter-inject
 * (mis. build pertama di Railway). NEXT_PUBLIC_* di-inline saat BUILD — deploy
 * produksi tetap WAJIB mengisi kedua variabel ini di dashboard sebelum build. */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) console.error("NEXT_PUBLIC_SUPABASE_URL belum diisi — aplikasi tidak akan tersambung ke database.");

export const sb = createClient(
  URL, KEY,
  // persistSession WAJIB: JWT Supabase Auth = kunci RLS per-tenant di seluruh query.
  { auth: { persistSession: true, autoRefreshToken: true } },
);
