/*
 * Analisis dokumen hukum via Gemini multimodal — Ringkas, Ekstraksi Klausul, Perbandingan.
 * Pola sama dengan /api/extract (kunci server-side, nol SDK baru), bedanya keluarannya PROSA
 * terstruktur (markdown ringan) alih-alih peta field.
 * ponytail: satu endpoint melayani 3 alat karena hanya prompt-nya yang berbeda; pecah kalau
 * salah satu alat kelak butuh alur/parameter sendiri.
 */
import { NextRequest, NextResponse } from "next/server";
import { limited, tooMany } from "@/lib/ratelimit";

export const runtime = "nodejs";
const KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-flash-latest";
const MAKS_MB = 8; // batas aman inline-data Gemini (permintaan maks ~20MB termasuk overhead base64)

type Berkas = { mime: string; data: string; nama?: string };

/* Prompt per alat. Semua menuntut: jangan mengarang, tandai yang tak ditemukan. */
const PROMPT: Record<string, (n: number) => string> = {
  summarize: () => `Anda advokat Indonesia. Ringkas dokumen hukum berikut untuk klien awam.

Format jawaban (markdown, bahasa Indonesia baku):
**Jenis dokumen** — sebutkan jenisnya
**Para pihak** — siapa saja
**Pokok isi** — 3-6 poin ringkas
**Kewajiban utama tiap pihak**
**Tanggal penting** — mulai, berakhir, tenggat
**Hal yang perlu diperhatikan** — klausul berisiko, denda, pengakhiran sepihak

Aturan: HANYA berdasarkan isi dokumen. Bila suatu bagian tidak ada, tulis "tidak diatur dalam dokumen". JANGAN mengarang pasal, angka, atau tanggal.`,

  clause: () => `Anda advokat Indonesia. Ekstrak klausul kunci dari dokumen hukum berikut.

Format jawaban (markdown, bahasa Indonesia baku) — satu blok per klausul yang DITEMUKAN:
**[Nama klausul]**
- Isi ringkas: …
- Letak: pasal/bagian berapa (bila tertulis)
- Catatan risiko: bila ada yang memberatkan salah satu pihak

Klausul yang dicari: jangka waktu · nilai/pembayaran · pengakhiran · denda & sanksi · ganti rugi · force majeure · kerahasiaan · penyelesaian sengketa & pilihan hukum · pengalihan hak · jaminan.

Aturan: tulis HANYA klausul yang benar-benar ada di dokumen. Di akhir, buat bagian **Tidak ditemukan** yang mendaftar klausul dari daftar di atas yang tidak ada — ini penting karena klausul yang hilang adalah temuan.`,

  compare: (n) => `Anda advokat Indonesia. Bandingkan ${n} dokumen berikut (Dokumen 1 dan Dokumen 2, sesuai urutan lampiran).

Format jawaban (markdown, bahasa Indonesia baku):
**Ringkasan perbedaan** — 2-3 kalimat
**Perbedaan substantif** — daftar; tiap butir sebutkan: bagian apa · isi Dokumen 1 · isi Dokumen 2 · dampak hukumnya bagi klien
**Hanya ada di Dokumen 1**
**Hanya ada di Dokumen 2**
**Perubahan yang merugikan** — sorot yang memperberat kewajiban atau memperlemah perlindungan

Aturan: bandingkan HANYA isi kedua dokumen. Abaikan perbedaan tata letak/penomoran halaman. JANGAN mengarang klausul yang tidak ada.`,
};

export async function POST(req: NextRequest) {
  if (limited(req, "analyze", 8)) return tooMany();
  if (!KEY) return NextResponse.json({ ok: false, error: "AI belum dikonfigurasi (GEMINI_API_KEY kosong)." }, { status: 501 });

  const { tool, files } = (await req.json()) as { tool?: string; files?: Berkas[] };
  const buat = tool && PROMPT[tool];
  if (!buat) return NextResponse.json({ ok: false, error: "Alat tidak dikenal." }, { status: 400 });
  if (!files?.length) return NextResponse.json({ ok: false, error: "Berkas wajib dilampirkan." }, { status: 400 });
  if (tool === "compare" && files.length < 2) return NextResponse.json({ ok: false, error: "Perbandingan butuh 2 berkas." }, { status: 400 });

  const totalMb = files.reduce((s, f) => s + (f.data?.length || 0), 0) * 0.75 / 1024 / 1024;
  if (totalMb > MAKS_MB) return NextResponse.json({ ok: false, error: `Total berkas ${totalMb.toFixed(1)}MB — maksimal ${MAKS_MB}MB.` }, { status: 413 });

  const parts: Record<string, unknown>[] = [{ text: buat(files.length) }];
  files.forEach((f, i) => {
    if (files.length > 1) parts.push({ text: `\n— Dokumen ${i + 1}${f.nama ? ` (${f.nama})` : ""} —` });
    parts.push({ inline_data: { mime_type: f.mime || "application/pdf", data: f.data } });
  });

  let r: Response;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096 } }),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Tak bisa menghubungi AI." }, { status: 502 });
  }
  if (!r.ok) {
    const pesan = r.status === 429
      ? "Kuota AI habis untuk saat ini — coba beberapa menit lagi."
      : `AI menolak permintaan (${r.status}). Dokumen mungkin terlalu besar atau formatnya tak terbaca.`;
    return NextResponse.json({ ok: false, error: pesan }, { status: 502 });
  }

  const j = await r.json();
  const hasil: string = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  if (!hasil.trim()) return NextResponse.json({ ok: false, error: "AI tidak menghasilkan jawaban — dokumen mungkin kosong atau tak terbaca." }, { status: 502 });
  return NextResponse.json({ ok: true, hasil });
}
