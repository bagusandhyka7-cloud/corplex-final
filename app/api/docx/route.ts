import { NextRequest } from "next/server";
import { limited, tooMany } from "@/lib/ratelimit";
// @ts-expect-error — html-to-docx tak menyertakan tipe
import HTMLtoDOCX from "html-to-docx";

/* HTML editor (tiptap) → .docx profesional. A4, margin surat formal Indonesia
 * (kiri 3cm ruang jilid, atas 3cm, kanan/bawah 2,5cm), serif 12pt, spasi 1,5.
 * ponytail: DOCX dulu (advokat sunting di Word); PDF menunggu engine cetak (Chromium/Gotenberg = infra). */
const CM = 567; // 1cm ≈ 567 twip

export async function POST(req: NextRequest) {
  if (limited(req, "docx", 10)) return tooMany();
  const { html, title } = await req.json().catch(() => ({})) as { html?: string; title?: string };
  if (!html) return Response.json({ error: "Konten kosong." }, { status: 400 });
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;text-align:justify}
    h1,h2,h3,h4,h5{font-family:'Times New Roman',serif}
  </style></head><body>${html}</body></html>`;
  const buf: Buffer = await HTMLtoDOCX(doc, null, {
    orientation: "portrait", pageSize: { width: 11906, height: 16838 }, // A4 twip
    margins: { top: 3 * CM, right: 2.5 * CM, bottom: 2.5 * CM, left: 3 * CM },
    font: "Times New Roman", fontSize: 24, // half-point → 12pt
    lineNumber: false,
  });
  const nama = (title || "dokumen").replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(buf) as unknown as BodyInit, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${nama}.docx"`,
    },
  });
}
