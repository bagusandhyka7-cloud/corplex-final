import { createClient } from "@supabase/supabase-js";

/* Klien Supabase (anon/publishable key — aman untuk browser).
 * PROD: operasi admin pindah ke route handler dengan service-role key. */
export const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  // persistSession WAJIB: JWT Supabase Auth = kunci RLS per-tenant di seluruh query.
  { auth: { persistSession: true, autoRefreshToken: true } },
);
