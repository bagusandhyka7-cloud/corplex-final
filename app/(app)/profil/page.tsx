"use client";
/* Profil sesi — simpel: Nama, Email, Jabatan, Perusahaan. Sumber: sesi login nyata
 * (localStorage corplex_ten) atau string user seed demo. Nol karangan: kosong = "—". */
import React from "react";
import { CircleUser } from "lucide-react";
import { useStore } from "@/lib/store";
import { Panel, ViewHead } from "@/components/ui";

export default function Profil() {
  const { ten } = useStore();
  let nama = "—", email = "—", jabatan = "—";
  try {
    const r = JSON.parse(localStorage.getItem("corplex_ten") || "null");
    if (r?.user) { nama = r.user.nama || "—"; email = r.user.email || "—"; jabatan = r.user.jabatan || "—"; }
    else if (ten?.user && ten.user !== "—") { const [n, j] = ten.user.split(" · "); nama = n || "—"; jabatan = j || "—"; }
  } catch { /* sesi seed tanpa data user */ }

  return (
    <div>
      <ViewHead h1="Profil" sub="Informasi sesi yang sedang masuk." />
      <Panel title="Akun">
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
          <CircleUser size={44} style={{ color: "var(--txt2)" }} />
          <div><b style={{ fontSize: 15, color: "var(--ink)" }}>{nama}</b><span className="sub" style={{ display: "block" }}>{jabatan}</span></div>
        </div>
        {([["Nama", nama], ["Email", email], ["Jabatan", jabatan], ["Perusahaan", ten?.name || "—"]] as const).map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px dashed var(--line)", fontSize: 13 }}>
            <span style={{ color: "var(--muted)" }}>{l}</span>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
