/*
 * GERBANG TUNGGAL DOKUMEN — mengubah URL tersimpan menjadi tautan bertanda tangan berumur pendek.
 *
 * Latar: keempat bucket dulu PUBLIK, sehingga setiap akta, KTP karyawan, dan perjanjian klien
 * dapat diunduh siapa pun yang memegang URL-nya — tanpa login sama sekali. Untuk produk yang
 * menyimpan dokumen hukum dan data pribadi (UU PDP), itu kebocoran, bukan kemudahan.
 *
 * Bucket kini privat. Baris DB TETAP menyimpan URL lama apa adanya (nol migrasi data): URL itu
 * kini hanya berfungsi sebagai ALAMAT, dan fungsi di bawah menukarnya dengan tautan bertanda
 * tangan yang hanya berlaku beberapa menit. RLS storage tetap penjaga sebenarnya — penandatanganan
 * hanya berhasil bila sesi pemanggil memang berhak membaca objek itu.
 */
import { sb } from "./supabase";

const POLA = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/;
const UMUR = 300; // detik — cukup untuk membuka/mengunduh, terlalu pendek untuk disebar ulang

/** Pecah URL tersimpan menjadi {bucket, path}; null bila bukan URL storage. */
export function bagianDok(url?: string | null): { bucket: string; path: string } | null {
  if (!url) return null;
  const m = POLA.exec(url);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

/**
 * Tautan siap buka. Mengembalikan null bila tak berhak / berkas hilang — pemanggil WAJIB
 * menampilkan pesan jujur, jangan menyodorkan tautan yang pasti gagal.
 */
export async function urlDok(url?: string | null): Promise<string | null> {
  const b = bagianDok(url);
  if (!b) return url || null; // bukan objek storage (mis. tautan luar) — biarkan apa adanya
  const { data, error } = await sb.storage.from(b.bucket).createSignedUrl(b.path, UMUR);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Buka dokumen di tab baru. Dipakai tombol "Buka" agar tak ada URL mentah di DOM. */
export async function bukaDok(url?: string | null, gagal?: (pesan: string) => void) {
  const s = await urlDok(url);
  if (!s) return gagal?.("Dokumen tak dapat dibuka — berkas tidak ditemukan atau Anda tak berhak mengaksesnya.");
  window.open(s, "_blank", "noopener");
}

/** Unduh dengan nama asli. Nama berkas ikut disematkan lewat parameter unduhan Supabase. */
export async function unduhDok(url?: string | null, nama?: string | null, gagal?: (pesan: string) => void) {
  const s = await urlDok(url);
  if (!s) return gagal?.("Dokumen tak dapat diunduh — berkas tidak ditemukan atau Anda tak berhak mengaksesnya.");
  const a = document.createElement("a");
  a.href = `${s}&download=${encodeURIComponent(nama || "dokumen")}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
