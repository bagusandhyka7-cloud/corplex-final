/*
 * Ekstraksi dokumen → field terstruktur via /api/extract (Gemini multimodal, 0 rupiah).
 * Dipakai semua modul ber-dropzone. Hanya gambar/PDF; Word/doc dikembalikan null (model tak baca .docx).
 * Nilai selalu string (endpoint sudah memaksa) — cocok langsung ke form modul.
 */
export type ExtractField = { k: string; l: string; opts?: string[] };

const b64 = (f: File) => new Promise<string>((res) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1] || "");
  r.readAsDataURL(f);
});

/* null = tipe file tak didukung AI (pakai jalur manual). {} = AI gagal/kosong (form tetap dibuka kosong). */
export async function aiExtract(file: File, fields: ExtractField[]): Promise<Record<string, string> | null> {
  const isImg = /\.(jpe?g|png|webp)$/i.test(file.name), isPdf = /\.pdf$/i.test(file.name);
  if (!isImg && !isPdf) return null;
  try {
    const r = await fetch("/api/extract", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mime: file.type || (isPdf ? "application/pdf" : "image/jpeg"), data: await b64(file), fields }),
    });
    const j = await r.json();
    return j.ok ? (j.vals || {}) : {};
  } catch { return {}; }
}
