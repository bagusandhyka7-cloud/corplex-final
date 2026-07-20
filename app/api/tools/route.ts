import { NextRequest } from "next/server";

/*
 * STUB — Alat Legal (Konversi · PDF · Signature · Summarizer · Clause · Comparison).
 * Frontend memanggil endpoint ini, menampilkan simulasi proses, lalu pesan
 * "Layanan dalam tahap integrasi engine". Blueprint engine GRATIS per alat:
 *
 * 1. KONVERSI & EKSTRAKSI PDF (tool: "convert")
 *    - Docx↔PDF tingkat lanjut: Gotenberg (microservice Docker gratis, REST — kirim
 *      multipart file, terima hasil) ATAU LibreOffice Headless (`soffice --headless
 *      --convert-to pdf`) di worker terpisah. OCR pindaian: tesseract.js (WASM, gratis).
 *    - Hasil ditulis balik ke Storage `module-docs` + rekam turunan `module_records`
 *      menunjuk berkas asal (jejak vault utuh).
 *
 * 2. MANIPULASI PDF DASAR (tool: "pdf")
 *    - merge/split/watermark: library Node.js `pdf-lib` (murni JS, tanpa binary) —
 *      PDFDocument.load → copyPages/removePage → drawText watermark → save.
 *      Jalan langsung di route handler ini, tak butuh microservice.
 *
 * 3. SIGNATURE / TANDA TANGAN DIGITAL (tool: "sign")
 *    - `pdf-lib` membubuhkan stempel visual (kotak ttd + nama advokat + QR) +
 *      modul `crypto` bawaan Node.js: SHA-256 hash dokumen → sign RSA/ECDSA
 *      (X.509/PKI dasar, keypair on-premise via crypto.generateKeyPairSync) →
 *      simpan signature di metadata PDF + tabel `module_records` (verifikasi
 *      publik GET /verify/[hash] mencocokkan ulang tanpa membuka isi).
 *      Nol layanan berbayar pihak ketiga.
 *
 * 4. SUMMARIZER (tool: "summarize") — Gemini via pola /api/chat yang SUDAH terbukti
 *    (Translator): prompt "ringkas per pasal + eksekutif", streaming SSE ke panel.
 *
 * 5. CLAUSE EXTRACTION (tool: "clause") — Gemini dgn responseSchema JSON
 *    (pihak/nilai/jangka waktu/pengakhiran/sanksi/sengketa) → otomatis mengisi
 *    metadata rekam kontraktual di `module_records`.
 *
 * 6. COMPARISON (tool: "compare") — dua lapis:
 *    a. diff teks murni kata-per-kata: library `diff-match-patch` (murni JS, gratis).
 *    b. perbandingan substansi (klausul memburuk/membaik): Gemini membandingkan
 *       pasangan klausul hasil ekstraksi (5), klasifikasi MENGUNTUNGKAN/NETRAL/MERUGIKAN.
 */
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";

/* ENGINE NYATA #2 (pdf-lib): multipart POST { op: merge|split|watermark, file(s), rentang?, teks? }
 * → balasan bytes application/pdf. Alat lain tetap stub JSON. */
export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    const { tool } = await req.json().catch(() => ({ tool: "?" })) as { tool?: string };
    return Response.json({ status: "stub", tool: tool || "?", message: "Layanan dalam tahap integrasi engine" });
  }

  const form = await req.formData();
  const op = String(form.get("op") || "");
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "Berkas PDF wajib diunggah." }, { status: 400 });

  const buka = async (f: File) => PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
  const kirim = async (doc: PDFDocument, nama: string) =>
    new Response(new Uint8Array(await doc.save()) as unknown as BodyInit, {
      headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${nama}"` },
    });

  try {
    if (op === "merge") {
      if (files.length < 2) return Response.json({ error: "Merge butuh minimal 2 PDF." }, { status: 400 });
      const out = await PDFDocument.create();
      for (const f of files) {
        const src = await buka(f);
        (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
      }
      return kirim(out, "gabungan.pdf");
    }
    if (op === "split") {
      const src = await buka(files[0]);
      const n = src.getPageCount();
      const m = String(form.get("rentang") || "").match(/^(\d+)\s*-\s*(\d+)$/);
      const [a, b] = m ? [+m[1], +m[2]] : [1, n];
      if (a < 1 || b > n || a > b) return Response.json({ error: `Rentang tidak valid — dokumen ${n} halaman.` }, { status: 400 });
      const out = await PDFDocument.create();
      (await out.copyPages(src, Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i))).forEach((p) => out.addPage(p));
      return kirim(out, `halaman-${a}-${b}.pdf`);
    }
    if (op === "watermark") {
      const teks = String(form.get("teks") || "RAHASIA").slice(0, 60);
      const doc = await buka(files[0]);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      for (const p of doc.getPages()) {
        const { width, height } = p.getSize();
        const size = Math.min(width, height) / (teks.length > 12 ? 12 : 8);
        p.drawText(teks, {
          x: width / 2 - font.widthOfTextAtSize(teks, size) / 2.4, y: height / 2.6,
          size, font, color: rgb(0.66, 0.54, 0.25), opacity: 0.28, rotate: degrees(35),
        });
      }
      return kirim(doc, "watermark.pdf");
    }
    return Response.json({ error: "Operasi tidak dikenal (merge|split|watermark)." }, { status: 400 });
  } catch {
    return Response.json({ error: "PDF tidak dapat diproses — pastikan berkas PDF valid dan tidak terenkripsi." }, { status: 422 });
  }
}
