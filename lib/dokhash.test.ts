/* Uji hash dokumen TANPA menyentuh Supabase sungguhan — klien di-stub.
 * Jalankan: npx tsx lib/dokhash.test.ts   (pola sama: assert bawaan Node, nol framework) */
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashOf, parseStorageUrl } from "./dokhash";

const PUB = "https://tkfzwzemcqfautsvhtcl.supabase.co/storage/v1/object/public";

/* ── parseStorageUrl: gerbang pertama, mencegah URL asing dipakai sebagai sumber hash ── */
assert.deepEqual(parseStorageUrl(`${PUB}/module-docs/t1/1785-akta.pdf`, "https://tkfzwzemcqfautsvhtcl.supabase.co"), { bucket: "module-docs", path: "t1/1785-akta.pdf" });
assert.deepEqual(parseStorageUrl(`${PUB}/employee-docs/t1/pk.pdf`, "https://tkfzwzemcqfautsvhtcl.supabase.co"), { bucket: "employee-docs", path: "t1/pk.pdf" });
assert.deepEqual(parseStorageUrl(`${PUB}/company-docs/t1/nib.pdf`, "https://tkfzwzemcqfautsvhtcl.supabase.co"), { bucket: "company-docs", path: "t1/nib.pdf" });
/* Spasi & karakter ter-encode harus dikembalikan ke bentuk aslinya, kalau tidak berkasnya
 * tak ketemu di Storage dan hash gagal diam-diam. */
assert.deepEqual(parseStorageUrl(`${PUB}/module-docs/t1/akta%20lama.pdf`, "https://tkfzwzemcqfautsvhtcl.supabase.co"), { bucket: "module-docs", path: "t1/akta lama.pdf" });
/* Bucket di luar daftar & host asing ditolak — termasuk foto karyawan yang memang tak di-hash. */
assert.equal(parseStorageUrl(`${PUB}/employee-photos/t1/foto.jpg`, "https://tkfzwzemcqfautsvhtcl.supabase.co"), null, "bucket foto bukan dokumen hukum");
assert.equal(parseStorageUrl("https://situs-penyerang.example/storage/v1/object/public/module-docs/x.pdf", "https://tkfzwzemcqfautsvhtcl.supabase.co"), null, "URL non-Storage ditolak");
assert.equal(parseStorageUrl("https://cdn.example.com/akta.pdf", "https://tkfzwzemcqfautsvhtcl.supabase.co"), null);
assert.equal(parseStorageUrl("", "https://tkfzwzemcqfautsvhtcl.supabase.co"), null);

/* ── hashOf: nilai dihitung dari ISI berkas, bukan nama/URL ── */
const stub = (isi: string) => ({
  storage: { from: () => ({ download: async () => ({ data: new Blob([isi]), error: null }) }) },
}) as unknown as SupabaseClient;

async function main() {
const SHA_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"; // SHA-256("abc"), nilai baku
assert.equal(await hashOf(stub("abc"), `${PUB}/module-docs/t1/a.pdf`, "https://tkfzwzemcqfautsvhtcl.supabase.co"), SHA_ABC);

/* Nama berkas beda, isi sama → hash WAJIB sama. Ini inti janjinya: yang dijamin adalah isi. */
assert.equal(await hashOf(stub("abc"), `${PUB}/module-docs/t1/nama-lain.pdf`, "https://tkfzwzemcqfautsvhtcl.supabase.co"), SHA_ABC);
/* Isi beda satu karakter → hash berubah total. */
assert.notEqual(await hashOf(stub("abd"), `${PUB}/module-docs/t1/a.pdf`, "https://tkfzwzemcqfautsvhtcl.supabase.co"), SHA_ABC);
/* URL tak sah → null, bukan hash karangan atau string kosong yang bisa lolos ke DB. */
assert.equal(await hashOf(stub("abc"), "https://cdn.example.com/a.pdf", "https://tkfzwzemcqfautsvhtcl.supabase.co"), null);

const gagal = { storage: { from: () => ({ download: async () => ({ data: null, error: { message: "404" } }) }) } } as unknown as SupabaseClient;
assert.equal(await hashOf(gagal, `${PUB}/module-docs/t1/a.pdf`, "https://tkfzwzemcqfautsvhtcl.supabase.co"), null, "berkas hilang → null, jangan tulis apa pun");

/* Path di luar folder tenant pemilik → ditolak (jangan hash berkas tenant lain). */
assert.equal(await hashOf(stub("abc"), `${PUB}/module-docs/t9/rahasia.pdf`, "https://tkfzwzemcqfautsvhtcl.supabase.co", "t1"), null, "lintas-tenant ditolak");
assert.equal(await hashOf(stub("abc"), `${PUB}/module-docs/t1/a.pdf`, "https://tkfzwzemcqfautsvhtcl.supabase.co", "t1"), SHA_ABC, "folder sendiri tetap boleh");
}
void main().then(() => console.log("dokhash: 15 assert PASS"));
