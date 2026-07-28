/* Vault dokumen SESI — hanya untuk pratinjau/unduh ulang berkas yang baru diunggah pada tab ini.
 * Kolom hash DIBUANG: dulu diisi fakeHash(nama+ukuran), yaitu hash NAMA BERKAS, lalu ditampilkan
 * sebagai "Hash rekam" pada Salinan Rekam — klaim integritas yang tak berdasar (kelas bug yang
 * sama dengan yang dicabut 27 Jul). Hash isi dokumen yang sungguhan kini dihitung SERVER dari
 * byte di Storage dan disimpan pada kolom dok_hash. */
const VAULT: Record<string, { url: string }> = {};

export function registerVault(file: File) {
  VAULT[file.name] = { url: URL.createObjectURL(file) };
  return file.name;
}

export const vaultUrl = (name?: string) => (name && VAULT[name]?.url) || null;

export function downloadDoc(name: string, tenantName: string) {
  if (!name) return;
  const v = VAULT[name];
  const a = document.createElement("a");
  if (v?.url) { a.href = v.url; a.download = name; }
  else {
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Salinan Rekam — ${name}</title></head>
<body style="font-family:Georgia,'Times New Roman',serif;max-width:660px;margin:48px auto;color:#14264A;line-height:1.7">
<div style="border-bottom:3px solid #A9884C;padding-bottom:10px;margin-bottom:18px"><b style="font-size:19px">CORPLEX by MRWP LAW FIRM</b><br><span style="font-size:12px;letter-spacing:.14em;color:#A9884C">SALINAN REKAM — REKAM HUKUM HIDUP</span></div>
<p><b>Berkas</b>: ${name}<br><b>Perusahaan</b>: ${tenantName}<br><b>Diterbitkan</b>: ${new Date().toLocaleString("id-ID")}</p>
<p>Ini <b>keterangan rekam</b>, bukan dokumen aslinya: berkas asli untuk rekam ini belum tersimpan di vault, sehingga tak ada yang dapat diunduh maupun diperiksa keutuhannya. Unggah dokumen aslinya lewat halaman rekam agar tersimpan dan dihitung sidik digitalnya.</p>
<p style="font-size:11px;color:#666">RAHASIA · ${tenantName.toUpperCase()} · Akses unduh tercatat pada jejak audit.</p></body></html>`;
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = "Salinan_Rekam_" + name.replace(/\.[^.]+$/, "") + ".html";
  }
  document.body.appendChild(a); a.click(); a.remove();
}

/* Nama dokumen di kolom tabel: maksimal `maks` karakter (ekstensi TIDAK dihitung),
 * selebihnya dipotong dengan "…". Contoh: "dokumen-dengan-pt mitra.pdf" → "dokumen-de….pdf".
 * Nama utuh tetap tersedia lewat atribut title saat di-hover. */
export function dokRingkas(nama?: string | null, maks = 10): string {
  if (!nama) return "";
  const t = nama.lastIndexOf(".");
  const ext = t > 0 ? nama.slice(t) : "";
  const dasar = t > 0 ? nama.slice(0, t) : nama;
  return dasar.length <= maks ? nama : dasar.slice(0, maks) + "…" + ext;
}
