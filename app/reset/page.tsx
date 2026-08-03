"use client";
/*
 * /reset — halaman setel ulang kata sandi, tujuan tautan pemulihan dari email.
 *
 * Supabase Auth menaruh sesi pemulihan di fragmen URL; klien `sb` (detectSessionInUrl bawaan)
 * menukarnya jadi sesi sementara. Halaman ini TIDAK memverifikasi token sendiri — ia hanya
 * memastikan sesi ada, lalu memanggil updateUser. Token kedaluwarsa/terpakai = tak ada sesi,
 * dan itulah pesan yang ditampilkan, bukan galat teknis.
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";

export default function ResetPage() {
  const router = useRouter();
  const [siap, setSiap] = useState<"tunggu" | "ada" | "tak-ada">("tunggu");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [galat, setGalat] = useState("");
  const [simpan, setSimpan] = useState(false);
  const [sukses, setSukses] = useState(false);

  useEffect(() => {
    /* HANYA konteks pemulihan yang diterima: event PASSWORD_RECOVERY atau fragmen token dari
     * tautan email. Dulu sesi login biasa pun lolos — pengguna yang sudah masuk bisa mengganti
     * sandi tanpa sandi lama hanya dengan membuka /reset. */
    const dariTautan = typeof window !== "undefined" && /access_token=|type=recovery/.test(window.location.hash);
    const { data: sub } = sb.auth.onAuthStateChange((e, sesi) => { if (sesi && (e === "PASSWORD_RECOVERY" || dariTautan)) setSiap("ada"); });
    void sb.auth.getSession().then(({ data }) => {
      if (data.session && dariTautan) setSiap("ada");
      else setTimeout(() => setSiap((s) => (s === "tunggu" ? "tak-ada" : s)), 2500);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const simpanSandi = async () => {
    setGalat("");
    if (pw.length < 8) return setGalat("Kata sandi minimal 8 karakter.");
    if (pw !== pw2) return setGalat("Kedua kata sandi belum sama.");
    setSimpan(true);
    const { error } = await sb.auth.updateUser({ password: pw });
    setSimpan(false);
    if (error) return setGalat(error.message || "Gagal menyimpan kata sandi baru.");
    /* Sesi pemulihan dicabut supaya tab lama tak tertinggal dalam keadaan setengah masuk. */
    await sb.auth.signOut().catch(() => {});
    setSukses(true);
    setTimeout(() => router.push("/login"), 2200);
  };

  return (
    <div className="rs-wrap">
      <style>{`
        .rs-wrap{position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#0A0E15;overflow:auto}
        .rs-card{width:min(400px,100%);background:#0B0E14;border:1px solid rgba(255,255,255,.085);border-radius:22px;
          padding:34px 30px;box-shadow:0 50px 110px -45px rgba(0,0,0,.85);text-align:center}
        .rs-in{width:100%;border:1px solid rgba(255,255,255,.11);border-radius:11px;padding:11px 14px;background:rgba(255,255,255,.045);
          color:#EAF0FA;font-size:13px;font-family:inherit;outline:none;transition:border-color .22s}
        .rs-in:focus{border-color:rgba(217,188,128,.55)}
        .rs-btn{width:100%;border:none;cursor:pointer;border-radius:11px;padding:12px;font-weight:700;font-size:13.5px;color:#0B1526;
          background:linear-gradient(135deg,#EAD09A 0%,#C9A45C 56%,#AC8535 100%)}
        .rs-btn:disabled{opacity:.45;cursor:not-allowed}
        .rs-lbl{display:block;text-align:left;font-size:11px;letter-spacing:.12em;color:#8FA0BC;margin:0 0 6px}
      `}</style>
      <div className="rs-card">
        <img src="/logo-final.png" alt="MRWP" style={{ width: 48, height: 48, objectFit: "contain", margin: "0 auto 14px", display: "block" }} />
        <h2 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 21, margin: 0 }}>Setel Ulang Kata Sandi</h2>

        {siap === "tunggu" && <p style={{ color: "#8FA0BC", fontSize: 13, marginTop: 18 }}>Memeriksa tautan…</p>}

        {siap === "tak-ada" && (
          <>
            <p style={{ color: "#8FA0BC", fontSize: 13, lineHeight: 1.7, marginTop: 16 }}>
              Tautan ini sudah dipakai atau kedaluwarsa. Mintalah tautan baru dari halaman masuk.
            </p>
            <button className="rs-btn" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>Kembali ke Halaman Masuk</button>
          </>
        )}

        {siap === "ada" && !sukses && (
          <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
            <div>
              <label className="rs-lbl">KATA SANDI BARU</label>
              <input className="rs-in" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Minimal 8 karakter" />
            </div>
            <div>
              <label className="rs-lbl">ULANGI KATA SANDI</label>
              <input className="rs-in" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void simpanSandi(); }} placeholder="Ketik ulang" />
            </div>
            {galat && <p style={{ color: "#E39B9B", fontSize: 12.5, margin: 0, textAlign: "left" }}>{galat}</p>}
            <button className="rs-btn" disabled={simpan} aria-busy={simpan} onClick={() => void simpanSandi()}>
              {simpan ? "Menyimpan…" : "Simpan Kata Sandi Baru"}
            </button>
          </div>
        )}

        {sukses && (
          <p style={{ color: "#9DC7A1", fontSize: 13.5, lineHeight: 1.7, marginTop: 18 }}>
            Kata sandi diperbarui. Mengalihkan ke halaman masuk…
          </p>
        )}
      </div>
    </div>
  );
}
