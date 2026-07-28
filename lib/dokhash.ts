/*
 * SHA-256 ISI DOKUMEN — SERVER-SIDE SAJA (dipakai app/api/hash & app/api/admin).
 *
 * Prinsipnya satu: hash dihitung dari BYTE YANG BENAR-BENAR TERSIMPAN di Storage, diunduh
 * ulang oleh server dengan service role. Klien tak pernah mengirim nilai hash — ia hanya
 * menyebut baris mana yang perlu dihitung. Nama berkas, ukuran, URL, dan metadata lain
 * TIDAK ikut dihash; kalau isinya sama, hashnya sama walau namanya berbeda.
 *
 * Kolom dok_hash juga dijaga trigger `jaga_dok_hash` di DB: tulisan dari selain service_role
 * diabaikan. Jadi dua lapis — jalur tulis dan wewenang tulis.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Bucket yang boleh dihash — sekaligus mencegah URL asing dipakai sebagai sumber. */
const BUCKET = ["module-docs", "employee-docs", "company-docs"] as const;

/** URL publik Supabase → {bucket, path}. null bila bukan URL Storage kita atau bucketnya asing.
 * `base` = origin proyek Supabase; host WAJIB cocok. Tanpa pemeriksaan ini, dok_url (kolom yang
 * memang ditulis klien) bisa diisi URL host lain dengan path tenant lain, dan server disuruh
 * mengunduh serta membocorkan hash berkas yang bukan miliknya. */
export function parseStorageUrl(url: string, base = process.env.NEXT_PUBLIC_SUPABASE_URL): { bucket: string; path: string } | null {
  if (!base) return null;
  let u: URL, b: URL;
  try { u = new URL(url); b = new URL(base); } catch { return null; }
  if (u.origin !== b.origin) return null;
  const m = /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(u.pathname);
  if (!m) return null;
  const bucket = m[1];
  if (!(BUCKET as readonly string[]).includes(bucket)) return null;
  try { return { bucket, path: decodeURIComponent(m[2]) }; } catch { return null; }
}

/** Unduh objek lalu hash isinya. null bila URL tak sah atau berkas tak terbaca. */
export async function hashOf(sb: SupabaseClient, url: string, base?: string, milik?: string): Promise<string | null> {
  const loc = parseStorageUrl(url, base);
  /* Berkas kami selalu tersimpan sebagai `<tenant_id>/<berkas>`. Menolak path di luar folder
   * tenant pemilik baris menutup jalur "tunjuk berkas tenant lain lalu minta hashnya". */
  if (loc && milik && !loc.path.startsWith(`${milik}/`)) return null;
  if (!loc) return null;
  const { data, error } = await sb.storage.from(loc.bucket).download(loc.path);
  if (error || !data) return null;
  return createHash("sha256").update(Buffer.from(await data.arrayBuffer())).digest("hex");
}

export type HashKind = "rec" | "emp" | "vq" | "vqmsg" | "doc";
const TABEL: Record<Exclude<HashKind, "vqmsg">, string> = {
  rec: "module_records", emp: "employees", vq: "verification_queue", doc: "company_documents",
};

/**
 * Hitung & simpan hash satu baris. Idempoten: berkas yang hashnya sudah ada dilewati,
 * jadi aman dipanggil berulang (mis. retry klien) tanpa mengunduh ulang.
 * Mengembalikan jumlah berkas yang baru dihash — 0 berarti tak ada yang perlu dikerjakan.
 */
export async function hashRow(
  sb: SupabaseClient, kind: HashKind, id: string,
  /* Pemilik yang diizinkan. undefined = pemanggil server tepercaya (mis. approval admin).
   * Diperiksa SEBELUM berkas diunduh — tenant lain jangan sampai bisa menyuruh server bekerja
   * atas baris orang, sekalipun hasilnya tak bocor ke dia. */
  izin?: { tenant: string | null; super: boolean },
): Promise<{ ok: true; n: number; tenant: string } | { ok: false; error: string }> {
  const boleh = (t: string) => !izin || izin.super || izin.tenant === t;
  if (kind === "vqmsg") {
    const { data: row } = await sb.from("verification_queue").select("tenant_id,msgs").eq("id", id).maybeSingle();
    if (!row) return { ok: false, error: "Baris tidak ditemukan." };
    if (!boleh(String(row.tenant_id))) return { ok: false, error: "Bukan dokumen perusahaan Anda." };
    const msgs = (row.msgs || []) as { dok_url?: string | null; dok_hash?: string | null }[];
    let n = 0;
    for (const m of msgs) {
      if (!m.dok_url || m.dok_hash) continue;
      const h = await hashOf(sb, m.dok_url, undefined, String(row.tenant_id));
      if (h) { m.dok_hash = h; n++; }
    }
    if (n) {
      const { error } = await sb.from("verification_queue").update({ msgs }).eq("id", id);
      if (error) return { ok: false, error: "Gagal menyimpan hash lampiran." };
    }
    return { ok: true, n, tenant: String(row.tenant_id) };
  }

  const tabel = TABEL[kind];
  const { data: row } = await sb.from(tabel).select("tenant_id,dok_url,dok_hash").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "Baris tidak ditemukan." };
  const tenant = String(row.tenant_id);
  if (!boleh(tenant)) return { ok: false, error: "Bukan dokumen perusahaan Anda." };
  /* Berkas dilepas dari rekam → hash ikut dikosongkan, jangan tinggalkan hash yatim yang
   * seolah masih menjamin sesuatu. Kolomnya hanya bisa ditulis service role (trigger). */
  if (!row.dok_url) {
    if (row.dok_hash) await sb.from(tabel).update({ dok_hash: null }).eq("id", id);
    return { ok: true, n: 0, tenant };
  }
  /* SELALU hitung ulang: pemanggilnya hanya jalur simpan/ganti berkas, jadi hash lama justru
   * milik berkas yang sudah diganti. Melewatkannya = hash yang berbohong. */
  /* company-docs diunggah SEBELUM tenant ada, jadi pathnya berawalan `daftar/`, bukan tenant id —
   * pemeriksaan folder dilewati khusus untuk itu. Aman: hash dokumen pendaftaran hanya dipicu
   * admin saat approval, memakai dok_url baris itu sendiri, bukan URL pilihan klien. */
  const h = await hashOf(sb, row.dok_url, undefined, kind === "doc" ? undefined : tenant);
  if (!h) return { ok: false, error: "Berkas tak terbaca dari Storage." };
  if (h === row.dok_hash) return { ok: true, n: 0, tenant };
  const { error } = await sb.from(tabel).update({ dok_hash: h }).eq("id", id);
  return error ? { ok: false, error: "Gagal menyimpan hash." } : { ok: true, n: 1, tenant };
}
