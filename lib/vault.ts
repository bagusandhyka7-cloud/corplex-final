/* Vault dokumen sesi — registri hash + unduh ulang (Salinan Rekam untuk data seed) */
const VAULT: Record<string, { url: string; hash: string }> = {};

export function fakeHash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return ("0000000" + h.toString(16)).slice(-8);
}

export function registerVault(file: File) {
  VAULT[file.name] = { url: URL.createObjectURL(file), hash: fakeHash(file.name + "|" + file.size) };
  if (typeof crypto !== "undefined" && crypto.subtle) {
    file.arrayBuffer().then((b) => crypto.subtle.digest("SHA-256", b)).then((d) => {
      VAULT[file.name].hash = [...new Uint8Array(d)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");
    }).catch(() => {});
  }
  return file.name;
}

export const vaultHash = (name: string) => VAULT[name]?.hash || fakeHash(name);
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
<p><b>Berkas</b>: ${name}<br><b>Perusahaan</b>: ${tenantName}<br><b>Hash rekam</b>: <code>${vaultHash(name)}</code><br><b>Diterbitkan</b>: ${new Date().toLocaleString("id-ID")}</p>
<p>Salinan ini diterbitkan dari vault Rekam Hukum Hidup Corplex. Pada implementasi penuh, berkas asli beserta tanda tangan digital diunduh langsung dari penyimpanan terenkripsi dan diverifikasi terhadap hash pada ledger append-only.</p>
<p style="font-size:11px;color:#666">RAHASIA · ${tenantName.toUpperCase()} · Akses unduh tercatat pada jejak audit.</p></body></html>`;
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = "Salinan_Rekam_" + name.replace(/\.[^.]+$/, "") + ".html";
  }
  document.body.appendChild(a); a.click(); a.remove();
}
