import Link from "next/link";

/* 404 bermerek — bukan tampilan mentah Next (5u-B). */
export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(155deg,#081020,#0B1526 60%,#0e1c33)", textAlign: "center", padding: 24 }}>
      <div>
        <img src="/logo-mrwp.svg" alt="MRWP" style={{ width: 56, height: 56, margin: "0 auto 16px", objectFit: "contain" }} />
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".2em", color: "#A9884C" }}>404 · HALAMAN TAK DITEMUKAN</div>
        <h1 style={{ fontFamily: "var(--serif)", color: "#fff", fontSize: 26, margin: "10px 0 6px" }}>Rekam tidak ditemukan</h1>
        <p style={{ color: "#8DA2C8", fontSize: 13, marginBottom: 20 }}>Tautan salah, atau rekam telah dipindah.</p>
        <Link href="/" className="btn btn-gold">Kembali ke Beranda</Link>
      </div>
    </div>
  );
}
