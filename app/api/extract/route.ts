/*
 * Ekstraksi dokumen → field terstruktur via Gemini multimodal (free tier, 0 rupiah).
 * Kirim gambar/PDF + daftar field (dari SPECS/EMP_FIELDS pemanggil) → JSON.
 * Server-side: GEMINI_API_KEY tak pernah ke klien. Nol isi disimpan di sini — hanya diteruskan.
 * ponytail: 1 model (flash) — cukup untuk OCR field; naikkan ke pro bila akurasi kurang & kuota ada.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-flash-latest";

type Field = { k: string; l: string; opts?: string[] };

export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ ok: false, error: "AI belum dikonfigurasi (GEMINI_API_KEY kosong)." }, { status: 501 });
  const { mime, data, fields } = (await req.json()) as { mime?: string; data?: string; fields?: Field[] };
  if (!data || !fields?.length) return NextResponse.json({ ok: false, error: "Dokumen atau daftar field kosong." }, { status: 400 });

  const daftar = fields.map((f) => `- "${f.k}": ${f.l}${f.opts ? ` (nilai sah HANYA: ${f.opts.join(" | ")})` : ""}`).join("\n");
  const prompt = `Anda mengekstrak data dari satu dokumen ketenagakerjaan Indonesia (perjanjian kerja / KTP / dokumen serupa).\nKembalikan HANYA satu objek JSON dengan kunci-kunci berikut:\n${daftar}\n\nAturan: isi "" bila field tak ada di dokumen. JANGAN mengarang. Untuk field bernilai terbatas, pakai salah satu nilai sah persis.`;

  let r: Response;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime || "image/jpeg", data } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Tak bisa menghubungi AI." }, { status: 502 });
  }
  if (!r.ok) return NextResponse.json({ ok: false, error: `AI menolak (${r.status}) — kuota free tier atau dokumen terlalu besar.` }, { status: 502 });

  const j = await r.json();
  const txt: string = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "{}";
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(txt); } catch { return NextResponse.json({ ok: false, error: "AI membalas format tak terbaca." }, { status: 502 }); }
  // Model kadang balas angka/boolean (mis. lok:1) — paksa string agar cocok pembanding frontend (=== "0" dsb).
  const vals: Record<string, string> = {};
  for (const k in raw) vals[k] = raw[k] == null ? "" : String(raw[k]);
  return NextResponse.json({ ok: true, vals });
}
