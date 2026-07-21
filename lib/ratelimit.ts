import type { NextRequest } from "next/server";

/* Rate limit sliding-window per IP.
 * ponytail: in-memory per-instance — cukup 1 instance Railway; ganti Upstash/Redis bila multi-instance. */
const hits = new Map<string, number[]>();

/** true = lewat batas (balas 429). n permintaan per ms. */
export function limited(req: NextRequest, key: string, n: number, ms = 60_000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const k = `${key}:${ip}`, now = Date.now();
  const xs = (hits.get(k) || []).filter((t) => now - t < ms);
  if (xs.length >= n) { hits.set(k, xs); return true; }
  xs.push(now); hits.set(k, xs);
  if (hits.size > 5000) for (const [kk, v] of hits) if (now - (v[v.length - 1] || 0) > ms) hits.delete(kk);
  return false;
}

export const tooMany = () =>
  new Response(JSON.stringify({ error: "Terlalu banyak permintaan. Coba lagi sebentar lagi." }), {
    status: 429, headers: { "Content-Type": "application/json" },
  });
