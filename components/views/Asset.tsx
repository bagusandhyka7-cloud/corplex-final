"use client";
import React, { useState } from "react";
import { Lock, Plus, RadioTower, Scale } from "lucide-react";
import { useStore } from "@/lib/store";
import { Chip, Panel, Row, Tabs, ViewHead } from "@/components/ui";

export default function Asset() {
  const { ten, toast, pushQueue } = useStore();
  const t = ten!;
  const [tab, setTab] = useState(0);
  const [ddName, setDdName] = useState<string | null>(null);
  const [vaultLog, setVaultLog] = useState([
    { b: "SHGB No. 812 dibuka — Chandra W. (OWNER)", d: "Alasan: persiapan refinancing · 12 Jul 14:20 · IP tercatat", chip: "c-mon", lbl: "AUDIT" },
    { b: "Akta Penyertaan dibuka — Adv. Ratna (MRWP)", d: "Alasan: due diligence berkala · 10 Jul 09:41 · privileged", chip: "c-gold", lbl: "PRIVILEGED" },
  ]);

  const vaultOpen = (doc: string) => {
    const alasan = prompt("Alasan akses (wajib — tercatat pada jejak audit):", "Persiapan refinancing");
    if (alasan === null) return;
    setVaultLog((l) => [{ b: `${doc} dibuka — ${t.user}`, d: `Alasan: ${alasan} · baru saja · IP tercatat`, chip: "c-mon", lbl: "AUDIT" }, ...l]);
    toast("Dokumen vault dibuka", `Grant per dokumen ✓ · alasan akses tercatat: “${alasan}”`, "ok");
  };

  return (
    <div>
      <ViewHead en="Modul 4.6 · Enterprise Legal Asset Protection System · Layer 2" h1="Asset & IP Management"
        sub="Vault berlapis dengan grant per dokumen dan log alasan akses, kewajiban aset otomatis per kategori, watcher pelanggaran merek dengan bukti berstempel waktu."
        acts={<button className="btn btn-navy" onClick={() => toast("Registrasi aset", "Kategori menentukan kewajiban turunannya: tanah → PBB + perpanjangan hak; kendaraan → pajak; dibebani → pantau fidusia.")}><Plus size={14} /> Daftarkan Aset</button>} />

      <Tabs items={["A. Asset Management", "B. Intellectual Property", "Digital Vault — Log Akses"]} cur={tab} onSel={setTab} />

      {tab === 0 && (
        <div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Aset</th><th>Bukti Kepemilikan</th><th>Pembebanan</th><th>Kewajiban Terpantau</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {t.assets.map((a, i) => {
                  const beban = a[3] as string[] | null;
                  return (
                    <tr key={i}>
                      <td><b>{a[0] as string}</b><span className="sub">{a[1] as string}</span></td>
                      <td>{a[2] as string} <button className="btn btn-line btn-sm" onClick={() => vaultOpen(a[2] as string)}><Lock size={11} /> Buka</button></td>
                      <td>{beban ? <><Chip c={beban[0]}>{beban[1]}</Chip><span className="sub">{beban[2]}</span></> : "—"}</td>
                      <td>{a[4] as string}</td>
                      <td><Chip c={a[5] as string}>{a[6] as string}</Chip></td>
                      <td><button className="btn btn-line btn-sm" onClick={() => { setDdName(a[0] as string); toast("Due diligence dijalankan", "Checklist kelengkapan + AI DD Scanner atas berkas aset — laporan DRAF AI.", "ok"); }}>Due Diligence</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {ddName ? (
            <Panel className="mt16" title={<>Hasil Due Diligence — {ddName} <Chip c="c-draft">DRAF AI</Chip></>}>
              <div className="rows">
                <Row b="Kelengkapan dokumen kepemilikan" d="Seluruh dokumen inti ditemukan di vault, hash cocok" right={<Chip c="c-ver">LENGKAP</Chip>} />
                <Row b="Konsistensi data pembebanan" d="Nilai pembebanan sesuai dokumen kreditur" right={<Chip c="c-ver">KONSISTEN</Chip>} />
                <Row b="Kesenjangan ditemukan" d="Polis asuransi aset belum tertaut ke rekam — risiko dokumentasi"
                  right={<><Chip c="c-draft">1 TEMUAN</Chip><button className="btn btn-gold btn-sm" onClick={() => pushQueue("Laporan DD Aset", "Temuan kesenjangan dokumentasi", "c-draft", "DRAF AI")}>Eskalasi</button></>} />
              </div>
            </Panel>
          ) : null}
        </div>
      )}

      {tab === 1 && (
        <div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Kekayaan Intelektual</th><th>Nomor / Kelas</th><th>Masa Perlindungan</th><th>Monitoring</th><th>Status</th></tr></thead>
              <tbody>
                {t.hki.map((h, i) => {
                  const mon = h[6] as string[] | null, st = h[7] as string[];
                  return (
                    <tr key={i}>
                      <td><b>{h[0] as string}</b><span className="sub">{h[1] as string}</span></td>
                      <td>{h[2] as string}</td>
                      <td>{h[3] ? <div className="bar"><i className={h[3] as string} style={{ width: `${h[4]}%` }} /></div> : null}<span className="sub">{h[5] as string}</span></td>
                      <td>{mon ? <Chip c={mon[0]}>{mon[1]}</Chip> : "—"}</td>
                      <td><Chip c={st[0]}>{st[1]}</Chip></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid g2 mt16">
            <Panel title="Watcher Pelanggaran — Desain Kemasan Seri B">
              <div className="flag">
                <b>Produk serupa terdeteksi di marketplace</b>
                <span>Skor kemiripan 0,87 (nama + visual) · bukti otomatis diarsip: tangkapan layar + URL + stempel waktu + hash SHA-256.</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-line btn-sm" onClick={() => toast("Bukti dibuka", "Arsip bukti berstempel waktu — siap dipakai bundel perkara (4.7).")}>Lihat Bukti</button>
                <button className="btn btn-gold btn-sm" onClick={() => pushQueue("Enforcement — Desain Kemasan B", "Bundel bukti watcher terlampir", "c-gold", "ESKALASI")}><Scale size={12} /> Enforcement Strategy</button>
                <button className="btn btn-line btn-sm" onClick={() => toast("Ditandai bukan pelanggaran", "Status watcher diperbarui — model kemiripan belajar dari koreksi.", "ok")}>Bukan Pelanggaran</button>
              </div>
            </Panel>
            <Panel title="Pengingat Portofolio">
              <div className="rows">
                <Row b="Perpanjangan Merek “CONTOH”" d="Jendela dihitung mundur dari perlindungan_sampai"
                  right={<><Chip c="c-mon">120 HARI</Chip><button className="btn btn-navy btn-sm" onClick={() => toast("Pengurusan dimulai", "Permohonan perpanjangan disiapkan — tracking DJKI aktif.", "ok")}>Mulai</button></>} />
                <Row b="NDA karyawan kunci — 1 berakhir Des 2026" d="Rahasia dagang Formula A" right={<Chip c="c-draft">PANTAU</Chip>} />
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab === 2 && (
        <Panel title={<>Log Akses Vault — Grant per Dokumen + Alasan Akses <RadioTower size={13} style={{ color: "var(--gold-text)" }} /></>}>
          <div className="rows">
            {vaultLog.map((v, i) => <Row key={i} b={v.b} d={v.d} right={<Chip c={v.chip}>{v.lbl}</Chip>} />)}
          </div>
          <p className="note mt16"><b>Envelope encryption per tenant</b> + grant per dokumen: setiap pembukaan dokumen kepemilikan wajib menyertakan alasan akses dan tercatat pada jejak audit.</p>
        </Panel>
      )}
    </div>
  );
}
