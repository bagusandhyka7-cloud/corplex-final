"use client";
import React, { useEffect, useRef, useState } from "react";
import { Plus, Scale, Send } from "lucide-react";
import { Conv } from "@/lib/data";
import { clone, useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useMountedRef } from "@/lib/hooks";
import { Chip, Field, Panel, Row, Tabs, ViewHead } from "@/components/ui";

export default function Assistant() {
  const { ten, go, toast, pushQueue } = useStore();
  const t = ten!;
  const [tab, setTab] = useState(0);
  const [convs, setConvs] = useState<Conv[]>(() => clone(t.conv));
  const [cur, setCur] = useState(0);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [risetOut, setRisetOut] = useState(false);
  const [raOut, setRaOut] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const mounted = useMountedRef();
  const askCtrl = useRef<AbortController | null>(null);
  const conv = convs[cur];

  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }); }, [convs, cur, typing]);
  useEffect(() => () => askCtrl.current?.abort(), []); // abort in-flight AI request on unmount

  const newConsult = () => {
    setConvs((c) => [{ title: "Konsultasi baru", domain: "MENUNGGU ROUTING", time: "Baru", msgs: [] }, ...c]);
    setCur(0);
    toast("Sesi baru dibuka", "Ketik pertanyaan — domain akan dirutekan otomatis sebelum analisis.");
  };

  const sending = useRef(false); // sync in-flight guard — closes the same-tick double-click window state can't
  const sendChat = async () => {
    if (!input.trim() || sending.current) return;
    sending.current = true;
    const text = input;
    const target = cur; // pin conversation index — reply lands in the conv it was asked in
    setInput("");
    setConvs((cs) => {
      const n = clone(cs);
      const c = n[target];
      c.msgs.push({ r: "q", t: text });
      if (c.domain === "MENUNGGU ROUTING") { c.domain = "KONTRAK"; c.title = text.slice(0, 38) + (text.length > 38 ? "…" : ""); }
      return n;
    });
    setTyping(true);
    askCtrl.current?.abort();
    const ctrl = new AbortController();
    askCtrl.current = ctrl;
    const res = await api.ai.ask(text, ctrl.signal);
    sending.current = false;
    if (!mounted.current) return; // view unmounted — no state updates
    setTyping(false);
    if (!res.ok) {
      if (res.error.code !== "aborted") toast("Analisis gagal", res.error.message, "warn");
      setInput(text); // restore draft so the question isn't lost
      return;
    }
    setConvs((cs) => {
      const n = clone(cs);
      n[target].msgs.push({ r: "a", t: "Analisis awal disusun melalui pipeline penuh: isolasi domain → konteks rekam Anda → wiki regulasi → analisis → validasi rujukan. Ketidakpastian hukum — bila ada — dinyatakan eksplisit dan dieskalasikan, karena sistem menolak jawaban spekulatif.", src: "DOMAIN DIRUTEKAN OTOMATIS · JEJAK AUDIT TERCATAT · KUOTA AI +1", chip: "DRAF AI — BUKAN NASIHAT HUKUM FINAL" });
      return n;
    });
  };

  const escalate = () => {
    pushQueue("Analisis PHK efisiensi 12 karyawan", "Eskalasi dari AI Assistant · transkrip + konteks terlampir", "c-gold", "ESKALASI");
    setConvs((cs) => {
      const n = clone(cs);
      n[cur].msgs.push({ r: "a", t: "✅ Eskalasi terkirim ke advokat MRWP Law Firm — masuk antrean verifikasi (SLA prioritas < 24 jam). Percakapan dan analisis AI dilampirkan; jawaban advokat akan kembali ke percakapan ini dan tercatat ke rekam hukum.", src: "AI → LAWYER → CLIENT" });
      return n;
    });
  };

  return (
    <div>
      <ViewHead en="Modul 4.1 · AI Virtual Legal Officer · Layer 1" h1="Legal AI Assistant"
        sub="Konsultasi 24/7, riset hukum terstruktur, dan risk assessment — pipeline: isolasi domain → konteks rekam → wiki regulasi → analisis → validasi rujukan → gerbang kepastian."
        acts={<button className="btn btn-navy" onClick={newConsult}><Plus size={14} /> Konsultasi Baru</button>} />

      <Tabs items={["Konsultasi", "Riset Hukum", "Risk Assessment", "Monitor Regulasi"]} cur={tab} onSel={setTab} />

      {tab === 0 && (
        <div className="chatwrap">
          <div className="chat-hist">
            <h4 style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--gold-deep)", marginBottom: 6 }}>RIWAYAT KONSULTASI</h4>
            {convs.map((c, i) => (
              <div key={i} className={`hist-item${i === cur ? " on" : ""}`} onClick={() => setCur(i)}>
                <b>{c.title}</b><span>{c.time} · {c.domain.toLowerCase()}</span>
              </div>
            ))}
            <div className="note" style={{ marginTop: "auto" }}><b>Isolasi domain:</b> setiap pertanyaan dirutekan ke domain hukum yang tepat sebelum dianalisis.</div>
          </div>
          <div className="chatbox">
            <div className="chat-head"><b>{conv?.title || "—"}</b><Chip c="c-mon">DOMAIN: {conv?.domain || "—"}</Chip></div>
            <div className="chat-body" ref={bodyRef}>
              {conv?.msgs.map((m, i) =>
                m.r === "q" ? (
                  <div key={i} className="bub q" dangerouslySetInnerHTML={{ __html: m.t }} />
                ) : (
                  <div key={i} className={`bub a${m.esc ? " esc" : ""}`}>
                    <span dangerouslySetInnerHTML={{ __html: m.t }} />
                    {m.src ? <span className="src">{m.src}</span> : null}
                    {m.chip ? <div style={{ marginTop: 9 }}><Chip c="c-draft">{m.chip}</Chip></div> : null}
                    {m.esc ? (
                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="btn btn-gold btn-sm" onClick={escalate}>Eskalasikan ke Advokat</button>
                        <button className="btn btn-line btn-sm" onClick={() => go("employment")}>Buka Kalkulator PHK</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              {typing ? <div className="bub a typing"><i /><i /><i /></div> : null}
            </div>
            <div className="chat-input">
              <input value={input} placeholder="Tulis pertanyaan hukum… (sistem menolak jawaban spekulatif)" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} />
              <button className="btn btn-navy" onClick={sendChat}><Send size={14} /> Kirim</button>
            </div>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className="grid g2">
          <Panel title="Permintaan Riset Terstruktur">
            <Field label="Isu hukum"><input defaultValue="Keabsahan klausul non-kompetisi pasca berakhirnya hubungan kerja" /></Field>
            <Field label="Domain (dirutekan otomatis — dapat dikoreksi)">
              <select><option>Ketenagakerjaan</option><option>Kontrak</option><option>Korporasi</option></select>
            </Field>
            <button className="btn btn-navy" onClick={() => { setRisetOut(true); toast("Riset selesai", "Memo DRAF AI — seluruh dasar hukum lolos Citation Resolver; area abu-abu ditandai.", "ok"); }}>Jalankan Riset</button>
          </Panel>
          {risetOut ? (
            <Panel title={<>Memo Riset <Chip c="c-draft">DRAF AI</Chip></>}>
              <div className="mono-out"><b>ISU:</b> Keabsahan klausul non-kompetisi pasca-PHK.{"\n\n"}<b>DASAR HUKUM (lolos Citation Resolver):</b>{"\n"}· Asas kebebasan berkontrak &amp; batasannya — KUH Perdata ✓ tertaut sumber resmi{"\n"}· Hak atas pekerjaan — kerangka konstitusional &amp; UU Ketenagakerjaan ✓{"\n"}· Yurisprudensi relevan: 2 putusan terindeks pada wiki internal ✓{"\n\n"}<b>ANALISIS AWAL:</b> Terdapat area abu-abu antara kebebasan berkontrak dan hak atas pekerjaan; keberlakuan klausul sangat bergantung pada ruang lingkup, durasi, dan kompensasi.{"\n\n"}<b>PERNYATAAN KETIDAKPASTIAN:</b> Isu ini termasuk area abu-abu — confidence di bawah ambang. Eskalasi advokat disematkan otomatis.</div>
              <button className="btn btn-gold btn-sm mt16" onClick={() => pushQueue("Memo Riset — Klausul Non-Kompetisi", "Eskalasi dari Riset AI · area abu-abu", "c-gold", "ESKALASI")}><Scale size={13} /> Eskalasikan ke Advokat</button>
            </Panel>
          ) : null}
        </div>
      )}

      {tab === 2 && (
        <div className="grid g2">
          <Panel title="Rencana Bisnis yang Dinilai">
            <Field label="Deskripsi rencana"><textarea rows={3} defaultValue="Membuka lini produk minuman baru dengan mitra co-manufacturing di Jawa Tengah, target rilis Q4 2026." /></Field>
            <button className="btn btn-navy" onClick={() => { setRaOut(true); toast("Matriks risiko disusun", "3 risiko dipetakan kemungkinan × dampak — mitigasi menaut ke modul terkait.", "ok"); }}>Susun Matriks Risiko</button>
          </Panel>
          {raOut ? (
            <Panel title={<>Matriks Risiko <Chip c="c-draft">DRAF AI</Chip></>}>
              <div className="tblwrap"><table style={{ minWidth: 0 }}>
                <thead><tr><th>Risiko</th><th>Kemungkinan</th><th>Dampak</th><th>Mitigasi</th></tr></thead>
                <tbody>
                  <tr><td><b>Izin edar produk baru</b><span className="sub">BPOM MD wajib sebelum rilis</span></td><td><Chip c="c-red">TINGGI</Chip></td><td><Chip c="c-red">TINGGI</Chip></td><td>Mulai pengurusan sekarang (lead time ±3 bulan) — modul Licensing</td></tr>
                  <tr><td><b>Kontrak co-manufacturing</b><span className="sub">Kepemilikan resep &amp; QC</span></td><td><Chip c="c-draft">SEDANG</Chip></td><td><Chip c="c-red">TINGGI</Chip></td><td>Klausul rahasia dagang + audit mutu — Legal Drafter</td></tr>
                  <tr><td><b>Merek lini baru belum terdaftar</b><span className="sub">Kelas 32</span></td><td><Chip c="c-draft">SEDANG</Chip></td><td><Chip c="c-draft">SEDANG</Chip></td><td>Permohonan merek segera — Asset &amp; IP</td></tr>
                </tbody>
              </table></div>
            </Panel>
          ) : null}
        </div>
      )}

      {tab === 3 && (
        <div>
          <div className="rows">
            <Row b="Perubahan aturan pelaksana perizinan sektor pangan olahan" d="Cocok dengan profil KBLI 10750 · ringkasan dampak DRAF AI tersedia · rujukan ✓ sumber resmi"
              right={<><Chip c="c-mon">BARU</Chip><button className="btn btn-line btn-sm" onClick={() => toast("Ringkasan dampak dibuka", "Analisis DRAF AI — rujukan tertaut peraturan.go.id", "ok")}>Baca</button></>} />
            <Row b="Penyesuaian formula UMK 2027 (rancangan)" d="Berdampak pada perhitungan pesangon & compliance upah · status: pemantauan" right={<Chip c="c-gray">PANTAU</Chip>} />
            <Row b="Pembaruan tata cara pelaporan LKPM" d="Kewajiban pasca-perizinan · kalender kewajiban diperbarui otomatis" right={<Chip c="c-ver">DITERAPKAN</Chip>} />
          </div>
          <p className="note mt16"><b>Regulatory Watcher:</b> pemantauan penerbitan peraturan pada sumber resmi dicocokkan dengan profil perusahaan (KBLI, jenis badan, provinsi) — setiap kecocokan membuat pengingat JAGA + ringkasan dampak berstatus DRAF AI.</p>
        </div>
      )}
    </div>
  );
}
