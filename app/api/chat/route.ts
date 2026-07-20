/*
 * POST /api/chat — proxy streaming ke Google Gemini (AI Studio).
 * Key dibaca dari env server (GEMINI_API_KEY) — tidak pernah menyentuh browser.
 * Respons: text/plain streaming (potongan teks mentah, langsung ditampilkan frontend).
 */
import { NextRequest } from "next/server";

// Alias -latest: Google mengarahkan ke versi stabil terbaru — kebal deprecation model bernomor.
const MODEL_MAP: Record<string, string> = {
  "Jago 1.5": "gemini-flash-latest",
  "Jago 2.0": "gemini-pro-latest",
};

const SYSTEM = `Anda adalah asisten hukum AI Corplex untuk perusahaan Indonesia (produk MRWP Law Firm).
Jawab dalam Bahasa Indonesia yang jelas dan terstruktur. Fokus hukum perusahaan Indonesia:
ketenagakerjaan, kontrak, perizinan, korporasi, pajak. Bila tidak yakin atau isu berisiko tinggi,
nyatakan eksplisit dan sarankan verifikasi advokat MRWP. Jangan mengarang pasal atau putusan.`;

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return Response.json({ error: "GEMINI_API_KEY belum diisi di .env.local — tempel key dari Google AI Studio lalu restart server." }, { status: 501 });
  }
  const { messages, model, company, mode } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    model: string;
    company?: { name: string; sector: string; entity?: string };
    mode?: "chat" | "draft";
  };
  if (!Array.isArray(messages) || !messages.length) {
    return Response.json({ error: "messages kosong." }, { status: 400 });
  }

  // setting khusus perusahaan (arahan owner): profil tenant masuk konteks — dokumen memakai
  // data nyata perusahaan, bukan placeholder generik
  let system = SYSTEM;
  if (company?.name) {
    system += `\n\nPROFIL PERUSAHAAN KLIEN (pakai dalam jawaban/dokumen, jangan placeholder):\nNama: ${company.name}${company.entity ? `\nBadan hukum: ${company.entity}` : ""}${company.sector ? `\nBidang usaha: ${company.sector}` : ""}`;
  }
  if (mode === "draft") {
    system += `\n\nMODE DRAFTING: balas dalam DUA bagian dipisah baris PERSIS "===DRAFT===" (tanpa markdown/code-fence di sekitarnya).
Bagian 1 (sebelum pemisah): ringkasan 2-3 kalimat bahasa natural tentang draf yang disusun/direvisi — sebut jenis dokumen & poin kunci.
Bagian 2 (setelah pemisah): dokumen hukum lengkap siap-edit (judul, komparisi, pasal bernomor, penutup tanda tangan). Bagian tak diketahui tandai [kurung siku]. Jika ini permintaan revisi atas dokumen yang sudah ada, kembalikan dokumen LENGKAP hasil revisi (bukan hanya bagian yang berubah).`;
  }

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: system }] },
    contents: messages.slice(-20).map((msg) => ({ role: msg.role === "assistant" ? "model" : "user", parts: [{ text: msg.content }] })),
    generationConfig: { maxOutputTokens: mode === "draft" ? 8192 : 2048 },
  });
  const call = (m: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse`, {
    method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body,
  });
  let upstream = await call(MODEL_MAP[model] || MODEL_MAP["Jago 2.0"]);
  // ponytail: free tier AI Studio nyaris tanpa kuota gemini-pro — 429 turun otomatis ke flash
  if (upstream.status === 429) upstream = await call(MODEL_MAP["Jago 1.5"]);

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return Response.json({ error: `Penyedia AI menolak (${upstream.status}). ${detail.slice(0, 200)}` }, { status: 502 });
  }

  // SSE Gemini -> potongan teks polos
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  const stream = upstream.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          const t = ev.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("");
          if (t) controller.enqueue(encoder.encode(t));
        } catch { /* baris non-JSON — abaikan */ }
      }
    },
  }));

  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
