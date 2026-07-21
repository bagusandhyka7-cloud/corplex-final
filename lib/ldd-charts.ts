/* Mesin visualisasi Laporan LDD — 78 jenis grafik SVG murni (nol dependency) + analisis hukum
 * per grafik. Primitif generik dipakai ulang lintas keluarga grafik (bar/line/pie/statistik/
 * jaringan/peta-ubin/finansial). Data peraga (dummy) eksplisit diminta owner untuk demo laporan.
 * Palet cetak: navy #14264A · emas #A9884C · merah #8C2F2F · hijau #2F6B4F · biru #2F5A8C. */

const NAVY = "#14264A", GOLD = "#A9884C", RED = "#8C2F2F", GREEN = "#2F6B4F", BLUE = "#2F5A8C", GREY = "#8B8B8B";
const PAL = [NAVY, GOLD, BLUE, GREEN, RED, "#6B5B8C", GREY];
const F = `font-family="Georgia" `;

/* deterministik pseudo-acak (laporan harus reproducible — tanpa Math.random) */
const rnd = (seed: number) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

const svgOpen = (w = 640, h = 300) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">`;
const txt = (x: number, y: number, s: string, size = 10, fill = "#333", anchor = "start", bold = false) =>
  `<text x="${x}" y="${y}" ${F}font-size="${size}" fill="${fill}" text-anchor="${anchor}"${bold ? ` font-weight="bold"` : ""}>${s}</text>`;
const axis = (w = 640, h = 300, padL = 60, padB = 30) =>
  `<line x1="${padL}" y1="10" x2="${padL}" y2="${h - padB}" stroke="#999"/><line x1="${padL}" y1="${h - padB}" x2="${w - 10}" y2="${h - padB}" stroke="#999"/>`;

/* ——— keluarga BATANG ——— */
type BarOpt = { stacked?: boolean; pct?: boolean; horiz?: boolean; labels: string[]; series: { name: string; data: number[] }[] };
function bars(o: BarOpt): string {
  const W = 640, H = 300, L = 70, B = 34, plotW = W - L - 20, plotH = H - B - 16;
  const n = o.labels.length, ns = o.series.length;
  let out = svgOpen() + axis(W, H, L, B);
  const totals = o.labels.map((_, i) => o.series.reduce((s, x) => s + x.data[i], 0));
  const max = o.stacked ? Math.max(...totals) : Math.max(...o.series.flatMap((s) => s.data));
  for (let i = 0; i < n; i++) {
    const gx = L + (plotW / n) * i + 8, gw = plotW / n - 16;
    if (o.stacked || o.pct) {
      let acc = 0; const tot = o.pct ? totals[i] : max;
      o.series.forEach((s, si) => {
        const v = o.pct ? s.data[i] / totals[i] * tot : s.data[i];
        const bh = (v / tot) * plotH;
        out += `<rect x="${gx}" y="${H - B - acc - bh}" width="${gw}" height="${bh}" fill="${PAL[si % PAL.length]}" opacity="0.88"/>`;
        acc += bh;
      });
    } else {
      const bw = gw / ns;
      o.series.forEach((s, si) => {
        const bh = (s.data[i] / max) * plotH;
        out += `<rect x="${gx + bw * si}" y="${H - B - bh}" width="${bw - 2}" height="${bh}" fill="${PAL[si % PAL.length]}" opacity="0.88"/>`;
      });
    }
    out += txt(gx + gw / 2, H - B + 14, o.labels[i], 9, "#333", "middle");
  }
  o.series.forEach((s, si) => { out += `<rect x="${L + si * 130}" y="2" width="9" height="9" fill="${PAL[si % PAL.length]}"/>` + txt(L + si * 130 + 13, 10, s.name, 9); });
  return out + "</svg>";
}
function barsH(labels: string[], data: number[], color = NAVY): string {
  const W = 640, H = labels.length * 30 + 20;
  const max = Math.max(...data);
  let out = svgOpen(W, H);
  labels.forEach((l, i) => {
    const y = i * 30 + 10, w = (data[i] / max) * 380;
    out += txt(0, y + 12, l, 10) + `<rect x="180" y="${y}" width="${w}" height="16" rx="2" fill="${color}" opacity="0.86"/>` + txt(w + 186, y + 12, String(data[i]), 9.5);
  });
  return out + "</svg>";
}

/* ——— keluarga GARIS ——— */
type LineOpt = { series: { name: string; data: number[] }[]; area?: boolean; stacked?: boolean; step?: boolean; smooth?: boolean; labels?: string[] };
function lines(o: LineOpt, W = 640, H = 300): string {
  const L = 60, B = 30, plotW = W - L - 20, plotH = H - B - 16;
  const n = o.series[0].data.length;
  const acc = new Array(n).fill(0);
  const max = o.stacked ? Math.max(...o.series[0].data.map((_, i) => o.series.reduce((s, x) => s + x.data[i], 0))) : Math.max(...o.series.flatMap((s) => s.data));
  let out = svgOpen(W, H) + axis(W, H, L, B);
  o.series.forEach((s, si) => {
    const pts = s.data.map((v, i) => {
      const base = o.stacked ? acc[i] : 0; if (o.stacked) acc[i] += v;
      return [L + (plotW / (n - 1)) * i, H - B - ((v + base) / max) * plotH] as [number, number];
    });
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      if (o.step) d += ` L ${pts[i][0]} ${pts[i - 1][1]} L ${pts[i][0]} ${pts[i][1]}`;
      else if (o.smooth) { const mx = (pts[i - 1][0] + pts[i][0]) / 2; d += ` C ${mx} ${pts[i - 1][1]}, ${mx} ${pts[i][1]}, ${pts[i][0]} ${pts[i][1]}`; }
      else d += ` L ${pts[i][0]} ${pts[i][1]}`;
    }
    if (o.area || o.stacked) out += `<path d="${d} L ${pts[n - 1][0]} ${H - B} L ${pts[0][0]} ${H - B} Z" fill="${PAL[si % PAL.length]}" opacity="0.3"/>`;
    out += `<path d="${d}" fill="none" stroke="${PAL[si % PAL.length]}" stroke-width="2"/>`;
    out += `<rect x="${L + si * 140}" y="2" width="9" height="9" fill="${PAL[si % PAL.length]}"/>` + txt(L + si * 140 + 13, 10, s.name, 9);
  });
  (o.labels || []).forEach((l, i) => { out += txt(L + (plotW / (n - 1)) * i, H - B + 14, l, 9, "#333", "middle"); });
  return out + "</svg>";
}

/* ——— keluarga PIE/RADIAL ——— */
function pie(vals: { l: string; v: number }[], donut = 0, polar = false): string {
  const W = 640, H = 280, cx = 170, cy = 140, R = 110;
  const tot = vals.reduce((s, x) => s + x.v, 0);
  let a0 = -Math.PI / 2, out = svgOpen(W, H);
  vals.forEach((x, i) => {
    const r = polar ? R * (0.4 + 0.6 * x.v / Math.max(...vals.map((y) => y.v))) : R;
    const a1 = a0 + (polar ? Math.PI * 2 / vals.length : (x.v / tot) * Math.PI * 2);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    out += `<path d="M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} L ${cx} ${cy} Z" fill="${PAL[i % PAL.length]}" opacity="0.88"/>`;
    a0 = a1;
  });
  if (donut) out += `<circle cx="${cx}" cy="${cy}" r="${donut}" fill="#fff"/>`;
  vals.forEach((x, i) => { out += `<rect x="330" y="${60 + i * 24}" width="11" height="11" fill="${PAL[i % PAL.length]}"/>` + txt(348, 70 + i * 24, `${x.l} — ${x.v}${polar ? "" : ` (${Math.round(x.v / tot * 100)}%)`}`, 10.5); });
  return out + "</svg>";
}
function gauge(pct: number, label: string, speedo = false): string {
  const W = 640, H = 220, cx = 200, cy = 180, R = 130;
  const a = Math.PI * (1 - pct / 100);
  let out = svgOpen(W, H);
  out += `<path d="M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}" fill="none" stroke="#E4DFD2" stroke-width="26"/>`;
  out += `<path d="M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(a) * -1 === 0 ? cx : cx + R * Math.cos(Math.PI - a * 0)} ${cy}" fill="none"/>`;
  const end = Math.PI - Math.PI * pct / 100;
  out += `<path d="M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(end) * (-1)} ${cy - R * Math.sin(end)}" fill="none" stroke="${pct >= 70 ? GREEN : pct >= 40 ? GOLD : RED}" stroke-width="26" stroke-linecap="round" transform="scale(-1,1) translate(${-2 * cx},0)"/>`;
  if (speedo) out += `<line x1="${cx}" y1="${cy}" x2="${cx + (R - 34) * Math.cos(Math.PI - Math.PI * pct / 100)}" y2="${cy - (R - 34) * Math.sin(Math.PI - Math.PI * pct / 100)}" stroke="${NAVY}" stroke-width="4"/><circle cx="${cx}" cy="${cy}" r="8" fill="${NAVY}"/>`;
  out += txt(cx, cy - 26, `${pct}%`, 30, NAVY, "middle", true) + txt(cx, cy - 4, label, 10.5, "#555", "middle");
  return out + "</svg>";
}

/* ——— keluarga STATISTIK ——— */
function boxes(groups: { l: string; q: [number, number, number, number, number] }[], violin = false): string {
  const W = 640, H = 280, B = 34, plotH = H - B - 20;
  const max = Math.max(...groups.flatMap((g) => g.q));
  let out = svgOpen(W, H) + axis(W, H, 50, B);
  groups.forEach((g, i) => {
    const x = 110 + i * 130, y = (v: number) => H - B - (v / max) * plotH;
    if (violin) {
      const r = rnd(7 + i); let d = `M ${x} ${y(g.q[0])}`;
      for (let t = 0; t <= 20; t++) { const v = g.q[0] + (g.q[4] - g.q[0]) * t / 20; const wdt = 8 + 34 * Math.exp(-Math.pow((v - g.q[2]) / ((g.q[4] - g.q[0]) / 3 + 1), 2)) + r() * 3; d += ` L ${x + wdt} ${y(v)}`; }
      for (let t = 20; t >= 0; t--) { const v = g.q[0] + (g.q[4] - g.q[0]) * t / 20; const wdt = 8 + 34 * Math.exp(-Math.pow((v - g.q[2]) / ((g.q[4] - g.q[0]) / 3 + 1), 2)) + r() * 3; d += ` L ${x - wdt} ${y(v)}`; }
      out += `<path d="${d} Z" fill="${PAL[i % PAL.length]}" opacity="0.55"/>`;
    } else {
      out += `<line x1="${x}" y1="${y(g.q[0])}" x2="${x}" y2="${y(g.q[4])}" stroke="#555"/>`;
      out += `<rect x="${x - 26}" y="${y(g.q[3])}" width="52" height="${y(g.q[1]) - y(g.q[3])}" fill="${PAL[i % PAL.length]}" opacity="0.6" stroke="#555"/>`;
      out += `<line x1="${x - 26}" y1="${y(g.q[2])}" x2="${x + 26}" y2="${y(g.q[2])}" stroke="#222" stroke-width="2"/>`;
    }
    out += txt(x, H - B + 14, g.l, 9.5, "#333", "middle");
  });
  return out + "</svg>";
}
function dots(nGroups: number, perGroup: number, mode: "strip" | "beeswarm"): string {
  const W = 640, H = 260, B = 30;
  let out = svgOpen(W, H) + axis(W, H, 50, B);
  for (let g = 0; g < nGroups; g++) {
    const r = rnd(11 + g), x0 = 130 + g * 150;
    const seen: number[] = [];
    for (let i = 0; i < perGroup; i++) {
      const v = 30 + r() * 170;
      let dx = 0;
      if (mode === "beeswarm") { const near = seen.filter((s) => Math.abs(s - v) < 9).length; dx = (near % 2 ? 1 : -1) * Math.ceil(near / 2) * 9; }
      else dx = (r() - 0.5) * 40;
      seen.push(v);
      out += `<circle cx="${x0 + dx}" cy="${H - B - v * 0.8}" r="3.4" fill="${PAL[g % PAL.length]}" opacity="0.75"/>`;
    }
    out += txt(x0, H - B + 14, ["Staf", "Penyelia", "Manajerial"][g] || `G${g}`, 9.5, "#333", "middle");
  }
  return out + "</svg>";
}
function densityCurves(n: number, ridge = false): string {
  const W = 640, H = ridge ? 40 + n * 52 : 280;
  let out = svgOpen(W, H);
  for (let k = 0; k < n; k++) {
    const base = ridge ? 50 + k * 52 : H - 30, mu = 180 + k * 90, sg = 55 + k * 12, amp = ridge ? 44 : 200 - k * 40;
    let d = `M 60 ${base}`;
    for (let x = 60; x <= 620; x += 8) d += ` L ${x} ${base - amp * Math.exp(-Math.pow((x - mu) / sg, 2))}`;
    out += `<path d="${d} L 620 ${base} Z" fill="${PAL[k % PAL.length]}" opacity="0.5"/><path d="${d}" fill="none" stroke="${PAL[k % PAL.length]}" stroke-width="1.6"/>`;
    if (ridge) out += txt(4, base - 6, ["PKWT", "PKWTT", "Alih daya", "Magang", "TKA"][k] || `S${k}`, 9.5);
  }
  return out + "</svg>";
}
function histo(bins: number[], pareto = false): string {
  const W = 640, H = 300, L = 60, B = 34, plotW = W - L - 20, plotH = H - B - 20;
  const max = Math.max(...bins), tot = bins.reduce((a, b) => a + b, 0);
  let out = svgOpen(W, H) + axis(W, H, L, B), acc = 0;
  const sorted = pareto ? [...bins].sort((a, b) => b - a) : bins;
  const pts: string[] = [];
  sorted.forEach((v, i) => {
    const bw = plotW / sorted.length, bh = (v / max) * plotH;
    out += `<rect x="${L + bw * i + 1}" y="${H - B - bh}" width="${bw - 3}" height="${bh}" fill="${NAVY}" opacity="0.85"/>`;
    if (pareto) { acc += v; pts.push(`${L + bw * i + bw / 2},${H - B - (acc / tot) * plotH}`); }
    out += txt(L + bw * i + bw / 2, H - B + 13, pareto ? ["Izin", "BPJS", "Kontrak", "Pajak", "Merek", "Lain"][i] || "" : String(i * 5), 8.5, "#333", "middle");
  });
  if (pareto) out += `<polyline points="${pts.join(" ")}" fill="none" stroke="${RED}" stroke-width="2"/>`;
  return out + "</svg>";
}

/* ——— keluarga SEBAR/MATRIKS ——— */
function scatter(nPts: number, opts: { bubble?: boolean; hex?: boolean; connected?: boolean } = {}): string {
  const W = 640, H = 300, L = 60, B = 34;
  const r = rnd(21);
  let out = svgOpen(W, H) + axis(W, H, L, B);
  const pts: [number, number][] = [];
  for (let i = 0; i < nPts; i++) {
    const x = L + 20 + i * ((W - L - 60) / nPts) + (r() - 0.5) * 40;
    const y = H - B - 20 - (i * 6 + r() * 90);
    pts.push([x, Math.max(20, y)]);
  }
  if (opts.hex) {
    const grid: Record<string, number> = {};
    pts.forEach(([x, y]) => { const k = `${Math.round(x / 46)}_${Math.round(y / 40)}`; grid[k] = (grid[k] || 0) + 1; });
    Object.entries(grid).forEach(([k, c]) => {
      const [gx, gy] = k.split("_").map(Number);
      const cx = gx * 46, cy = gy * 40, s = 20;
      const hex = Array.from({ length: 6 }, (_, i) => `${cx + s * Math.cos(Math.PI / 3 * i)},${cy + s * Math.sin(Math.PI / 3 * i)}`).join(" ");
      out += `<polygon points="${hex}" fill="${NAVY}" opacity="${Math.min(0.9, 0.25 + c * 0.2)}"/>`;
    });
  } else {
    if (opts.connected) out += `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#BBB" stroke-width="1.4"/>`;
    pts.forEach(([x, y], i) => { out += `<circle cx="${x}" cy="${y}" r="${opts.bubble ? 4 + r() * 12 : 4}" fill="${PAL[i % 3]}" opacity="0.66"/>`; });
  }
  return out + "</svg>";
}
function matrix(labels: string[], mode: "corr" | "conf" | "heat" = "corr"): string {
  const n = labels.length, cell = 52, L = 120, T = 30;
  const W = L + n * cell + 20, H = T + n * cell + 20;
  const r = rnd(31);
  let out = svgOpen(W, H);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = mode === "conf" ? (i === j ? 0.82 + r() * 0.15 : r() * 0.2) : i === j ? 1 : Math.abs(Math.sin(i * 2 + j * 3)) * 0.9;
    const col = mode === "conf" ? GREEN : v > 0.66 ? NAVY : v > 0.33 ? BLUE : GOLD;
    out += `<rect x="${L + j * cell}" y="${T + i * cell}" width="${cell - 3}" height="${cell - 3}" fill="${col}" opacity="${0.18 + v * 0.72}"/>`;
    out += txt(L + j * cell + cell / 2 - 1, T + i * cell + cell / 2 + 3, v.toFixed(2), 8.5, "#fff", "middle");
  }
  labels.forEach((l, i) => { out += txt(L - 6, T + i * cell + cell / 2 + 3, l, 9, "#333", "end") + txt(L + i * cell + cell / 2, T - 8, l, 9, "#333", "middle"); });
  return out + "</svg>";
}
function calendarHeat(): string {
  const W = 640, H = 150, cell = 15;
  const r = rnd(41);
  let out = svgOpen(W, H);
  for (let w = 0; w < 36; w++) for (let d = 0; d < 7; d++) {
    const v = r();
    out += `<rect x="${40 + w * (cell + 1)}" y="${20 + d * (cell + 1)}" width="${cell}" height="${cell}" rx="2" fill="${v > 0.8 ? RED : v > 0.5 ? GOLD : GREEN}" opacity="${0.25 + v * 0.6}"/>`;
  }
  ["Sen", "Rab", "Jum"].forEach((l, i) => { out += txt(6, 32 + i * 32, l, 8.5); });
  return out + "</svg>";
}

/* ——— keluarga HIERARKI & JARINGAN ——— */
function treemap(items: { l: string; v: number }[]): string {
  const W = 640, H = 300;
  const tot = items.reduce((s, x) => s + x.v, 0);
  let out = svgOpen(W, H), x = 0;
  items.forEach((it, i) => {
    const w = (it.v / tot) * W;
    out += `<rect x="${x + 1}" y="1" width="${w - 2}" height="${H - 2}" fill="${PAL[i % PAL.length]}" opacity="0.8" stroke="#fff"/>`;
    if (w > 46) out += txt(x + 8, 24, it.l, 10, "#fff", "start", true) + txt(x + 8, 40, String(it.v), 9.5, "#fff");
    x += w;
  });
  return out + "</svg>";
}
function icicle(): string {
  const W = 640, H = 240;
  let out = svgOpen(W, H);
  out += `<rect x="1" y="1" width="${W - 2}" height="56" fill="${NAVY}" opacity="0.9"/>` + txt(10, 32, "PT Contoh Sejahtera (Induk)", 11, "#fff", "start", true);
  const l2 = [["Divisi Produksi", 0.4], ["Divisi Distribusi", 0.35], ["Divisi Legal & GA", 0.25]] as const;
  let x = 0; l2.forEach(([l, f], i) => { out += `<rect x="${x + 1}" y="60" width="${W * f - 2}" height="56" fill="${PAL[i + 1]}" opacity="0.85"/>` + txt(x + 8, 92, l, 10, "#fff"); x += W * f; });
  const l3 = [["Pabrik A", .2], ["Pabrik B", .2], ["Gudang", .18], ["Armada", .17], ["Legal", .13], ["SDM", .12]] as const;
  x = 0; l3.forEach(([l, f], i) => { out += `<rect x="${x + 1}" y="120" width="${W * f - 2}" height="56" fill="${PAL[i % PAL.length]}" opacity="0.6"/>` + txt(x + 6, 152, l, 9, "#fff"); x += W * f; });
  return out + "</svg>";
}
function sunburst(): string {
  const W = 640, H = 300, cx = 200, cy = 150;
  let out = svgOpen(W, H);
  const ring = (r1: number, r2: number, parts: number[], off: number) => {
    let a0 = -Math.PI / 2;
    parts.forEach((p, i) => {
      const a1 = a0 + p * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0;
      out += `<path d="M ${cx + r1 * Math.cos(a0)} ${cy + r1 * Math.sin(a0)} A ${r1} ${r1} 0 ${large} 1 ${cx + r1 * Math.cos(a1)} ${cy + r1 * Math.sin(a1)} L ${cx + r2 * Math.cos(a1)} ${cy + r2 * Math.sin(a1)} A ${r2} ${r2} 0 ${large} 0 ${cx + r2 * Math.cos(a0)} ${cy + r2 * Math.sin(a0)} Z" fill="${PAL[(i + off) % PAL.length]}" opacity="0.85" stroke="#fff"/>`;
      a0 = a1;
    });
  };
  out += `<circle cx="${cx}" cy="${cy}" r="44" fill="${NAVY}"/>` + txt(cx, cy + 4, "PT", 13, "#fff", "middle", true);
  ring(46, 90, [0.4, 0.35, 0.25], 1);
  ring(92, 136, [0.18, 0.22, 0.15, 0.2, 0.13, 0.12], 2);
  out += txt(370, 90, "Cincin dalam: divisi utama", 10.5) + txt(370, 112, "Cincin luar: unit operasional", 10.5);
  return out + "</svg>";
}
function circles(packed = false): string {
  const W = 640, H = 300;
  let out = svgOpen(W, H);
  const items: [number, number, number, string, number][] = packed
    ? [[140, 150, 78, "Aset Tanah", 0], [280, 110, 52, "Kendaraan", 1], [285, 210, 44, "Mesin", 2], [380, 150, 40, "Merek", 3], [455, 120, 30, "Hak Cipta", 4], [460, 195, 26, "Paten", 5]]
    : [[200, 150, 120, "Grup Usaha", 0], [165, 130, 52, "Operasional", 1], [255, 175, 42, "Legal", 2], [205, 215, 30, "Keuangan", 3]];
  items.forEach(([x, y, r, l, i]) => { out += `<circle cx="${x}" cy="${y}" r="${r}" fill="${PAL[i % PAL.length]}" opacity="0.5" stroke="${PAL[i % PAL.length]}"/>` + txt(x, y + 3, l, 9.5, "#222", "middle"); });
  return out + "</svg>";
}
function treeDiagram(dendro = false): string {
  const W = 640, H = 280;
  let out = svgOpen(W, H);
  const nodes: [number, number, string][] = [[320, 34, dendro ? "Klaster Risiko" : "RUPS"], [160, 120, dendro ? "Risiko Tinggi" : "Dewan Komisaris"], [480, 120, dendro ? "Risiko Terkendali" : "Direksi"], [80, 210, dendro ? "Perizinan" : "Komite Audit"], [240, 210, dendro ? "Kontrak Kerja" : "Sekretaris"], [400, 210, dendro ? "Pajak" : "Dir. Operasional"], [560, 210, dendro ? "Aset" : "Dir. Keuangan"]];
  const links = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
  links.forEach(([a, b]) => {
    const [x1, y1] = nodes[a], [x2, y2] = nodes[b];
    out += dendro
      ? `<path d="M ${x1} ${y1 + 12} L ${x1} ${(y1 + y2) / 2} L ${x2} ${(y1 + y2) / 2} L ${x2} ${y2 - 12}" fill="none" stroke="#888"/>`
      : `<line x1="${x1}" y1="${y1 + 12}" x2="${x2}" y2="${y2 - 12}" stroke="#888"/>`;
  });
  nodes.forEach(([x, y, l], i) => { out += `<rect x="${x - 62}" y="${y - 13}" width="124" height="26" rx="12" fill="${i === 0 ? NAVY : "#EFEAE0"}" stroke="${GOLD}"/>` + txt(x, y + 4, l, 9.5, i === 0 ? "#fff" : "#333", "middle"); });
  return out + "</svg>";
}
function network(force = false): string {
  const W = 640, H = 300;
  const r = rnd(force ? 55 : 51);
  const nodes = ["PT Contoh", "PT Pemasok A", "CV Vendor B", "Bank X", "PT Distributor", "Yayasan Y", "PT Afiliasi", "Notaris Z"];
  const pos = nodes.map((_, i) => [110 + (i % 4) * 150 + (force ? r() * 46 - 23 : 0), 80 + Math.floor(i / 4) * 140 + (force ? r() * 40 - 20 : 0)]);
  let out = svgOpen(W, H);
  const links = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 6], [4, 5], [1, 7], [6, 3]];
  links.forEach(([a, b]) => { out += `<line x1="${pos[a][0]}" y1="${pos[a][1]}" x2="${pos[b][0]}" y2="${pos[b][1]}" stroke="#AAA" stroke-width="1.4"/>`; });
  nodes.forEach((n, i) => { out += `<circle cx="${pos[i][0]}" cy="${pos[i][1]}" r="${i === 0 ? 26 : 16}" fill="${i === 0 ? NAVY : PAL[i % PAL.length]}" opacity="0.9"/>` + txt(pos[i][0], pos[i][1] + (i === 0 ? 40 : 30), n, 9, "#333", "middle"); });
  return out + "</svg>";
}
function sankey(alluvial = false): string {
  const W = 640, H = 300;
  let out = svgOpen(W, H);
  const kiri = [["Pendapatan Kontrak", 120, GREEN], ["Pendanaan Bank", 70, BLUE], ["Modal Disetor", 50, GOLD]] as const;
  const kanan = [["Biaya Operasional", 110, NAVY], ["Kewajiban Pajak", 55, RED], ["Laba Ditahan", 75, GREEN]] as const;
  let y1 = 40; const src: number[] = [];
  kiri.forEach(([l, v, c]) => { out += `<rect x="20" y="${y1}" width="18" height="${v}" fill="${c}"/>` + txt(44, y1 + 12, `${l} (${v})`, 9.5); src.push(y1); y1 += v + 16; });
  let y2 = 40; const dst: number[] = [];
  kanan.forEach(([l, v, c]) => { out += `<rect x="${W - 40}" y="${y2}" width="18" height="${v}" fill="${c}"/>` + txt(W - 48, y2 + 12, `${l} (${v})`, 9.5, "#333", "end"); dst.push(y2); y2 += v + 16; });
  const flows: [number, number, number, string][] = [[0, 0, 70, GREEN], [0, 2, 50, GREEN], [1, 0, 40, BLUE], [1, 1, 30, BLUE], [2, 1, 25, GOLD], [2, 2, 25, GOLD]];
  const so = [0, 0, 0], eo = [0, 0, 0];
  flows.forEach(([a, b, v, c]) => {
    const sy = src[a] + so[a], ey = dst[b] + eo[b]; so[a] += v; eo[b] += v;
    out += `<path d="M 38 ${sy} C 300 ${sy}, 340 ${ey}, ${W - 40} ${ey} L ${W - 40} ${ey + v} C 340 ${ey + v}, 300 ${sy + v}, 38 ${sy + v} Z" fill="${c}" opacity="${alluvial ? 0.35 : 0.28}"/>`;
  });
  return out + "</svg>";
}
function chord(): string {
  const W = 640, H = 300, cx = 200, cy = 150, R = 120;
  const groups = ["Legal", "Keuangan", "Operasi", "SDM"];
  let out = svgOpen(W, H), a0 = 0;
  const mids: number[] = [];
  groups.forEach((g, i) => {
    const a1 = a0 + Math.PI / 2 - 0.12;
    const large = 0;
    out += `<path d="M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)} L ${cx + (R - 16) * Math.cos(a1)} ${cy + (R - 16) * Math.sin(a1)} A ${R - 16} ${R - 16} 0 ${large} 0 ${cx + (R - 16) * Math.cos(a0)} ${cy + (R - 16) * Math.sin(a0)} Z" fill="${PAL[i]}" opacity="0.85"/>`;
    const mid = (a0 + a1) / 2; mids.push(mid);
    out += txt(cx + (R + 16) * Math.cos(mid), cy + (R + 16) * Math.sin(mid) + 3, g, 9.5, "#333", "middle");
    a0 = a1 + 0.12;
  });
  [[0, 1], [0, 2], [1, 3], [2, 3], [0, 3]].forEach(([a, b], i) => {
    out += `<path d="M ${cx + (R - 16) * Math.cos(mids[a])} ${cy + (R - 16) * Math.sin(mids[a])} Q ${cx} ${cy} ${cx + (R - 16) * Math.cos(mids[b])} ${cy + (R - 16) * Math.sin(mids[b])}" fill="none" stroke="${PAL[i % PAL.length]}" stroke-width="${10 - i}" opacity="0.4"/>`;
  });
  return out + "</svg>";
}

/* ——— keluarga PROSES/WAKTU ——— */
function gantt(): string {
  const rows = [["Persiapan data ruang", 0, 2, GOLD], ["Telaah korporasi", 1, 4, NAVY], ["Telaah ketenagakerjaan", 2, 4, BLUE], ["Telaah perizinan & aset", 3, 5, GREEN], ["Konfirmasi manajemen", 6, 2, GOLD], ["Laporan final & ttd", 7, 2, RED]] as const;
  const W = 640, H = rows.length * 34 + 40;
  let out = svgOpen(W, H);
  for (let w = 0; w <= 9; w++) out += `<line x1="${180 + w * 48}" y1="14" x2="${180 + w * 48}" y2="${H - 20}" stroke="#EEE"/>` + txt(180 + w * 48, 10, `M${w + 1}`, 8.5, "#777", "middle");
  rows.forEach(([l, s, d, c], i) => {
    out += txt(0, 30 + i * 34 + 12, l, 9.5) + `<rect x="${180 + (s as number) * 48}" y="${26 + i * 34}" width="${(d as number) * 48}" height="18" rx="4" fill="${c}" opacity="0.85"/>`;
  });
  return out + "</svg>";
}
function funnel(pyr = false, pop = false): string {
  const W = 640, H = 300;
  let out = svgOpen(W, H);
  if (pop) {
    const ages = ["18-25", "26-35", "36-45", "46-55", "56+"];
    const kiri = [22, 38, 30, 16, 6], kanan = [18, 34, 26, 12, 4];
    ages.forEach((a, i) => {
      const y = 30 + i * 46;
      out += `<rect x="${320 - kiri[i] * 6}" y="${y}" width="${kiri[i] * 6}" height="30" fill="${NAVY}" opacity="0.8"/><rect x="322" y="${y}" width="${kanan[i] * 6}" height="30" fill="${GOLD}" opacity="0.85"/>`;
      out += txt(320, y - 4, a, 9, "#555", "middle") + txt(90, y + 19, `L ${kiri[i]}`, 9) + txt(560, y + 19, `P ${kanan[i]}`, 9);
    });
    return out + "</svg>";
  }
  const steps = pyr ? [["Pemegang Saham", 100], ["Komisaris & Direksi", 70], ["Manajemen", 45], ["Staf", 25]] as const
    : [["Dokumen diminta", 100], ["Dokumen diterima", 78], ["Lolos verifikasi", 60], ["Bebas temuan", 41]] as const;
  steps.forEach(([l, v], i) => {
    const w = (v as number) * 4.4, y = 24 + i * 62;
    out += `<path d="M ${320 - w / 2} ${y} L ${320 + w / 2} ${y} L ${320 + w / 2 - 26} ${y + 50} L ${320 - w / 2 + 26} ${y + 50} Z" fill="${PAL[i]}" opacity="0.85"/>`;
    out += txt(320, y + 30, `${l} — ${v}${pyr ? "" : "%"}`, 10.5, "#fff", "middle", true);
  });
  return out + "</svg>";
}
function waterfall(): string {
  const W = 640, H = 300, B = 40;
  const steps = [["Skor awal", 62, GREY], ["+ Kontrak dilengkapi", 12, GREEN], ["+ BPJS didaftarkan", 8, GREEN], ["- Izin kedaluwarsa", -9, RED], ["+ Merek diperpanjang", 6, GREEN], ["Skor akhir", 79, NAVY]] as const;
  let out = svgOpen(W, H) + axis(W, H, 50, B), acc = 0;
  steps.forEach(([l, v, c], i) => {
    const x = 70 + i * 92;
    const isTotal = i === 0 || i === steps.length - 1;
    const y0 = isTotal ? 0 : acc, y1 = isTotal ? (v as number) : acc + (v as number);
    const top = Math.max(y0, y1), hgt = Math.abs((v as number));
    out += `<rect x="${x}" y="${H - B - top * 2.6}" width="60" height="${hgt * 2.6}" fill="${c}" opacity="0.85"/>`;
    out += txt(x + 30, H - B - top * 2.6 - 5, String(v), 9.5, "#333", "middle");
    out += txt(x + 30, H - B + 12, (l as string).slice(0, 14), 8, "#333", "middle");
    acc = isTotal ? (v as number) : y1;
  });
  return out + "</svg>";
}
function candles(mode: "candle" | "ohlc" | "kagi" | "renko" = "candle"): string {
  const W = 640, H = 280, B = 30;
  const r = rnd(61); let v = 120;
  let out = svgOpen(W, H) + axis(W, H, 50, B);
  if (mode === "kagi") {
    let d = `M 70 ${H - B - v}`, x = 70;
    for (let i = 0; i < 14; i++) { const nv = v + (r() - 0.45) * 40; x += 38; d += ` L ${x} ${H - B - v} L ${x} ${H - B - nv}`; v = nv; }
    out += `<path d="${d}" fill="none" stroke="${NAVY}" stroke-width="2.4"/>`;
  } else if (mode === "renko") {
    let x = 60, lvl = 100;
    for (let i = 0; i < 15; i++) { const up = r() > 0.42; lvl += up ? 14 : -14; out += `<rect x="${x}" y="${H - B - lvl}" width="30" height="14" fill="${up ? GREEN : RED}" opacity="0.85"/>`; x += 34; }
  } else {
    for (let i = 0; i < 16; i++) {
      const o = v, c = v + (r() - 0.46) * 30, hi = Math.max(o, c) + r() * 12, lo = Math.min(o, c) - r() * 12;
      const x = 70 + i * 34, col = c >= o ? GREEN : RED;
      out += `<line x1="${x}" y1="${H - B - hi}" x2="${x}" y2="${H - B - lo}" stroke="${col}"/>`;
      if (mode === "candle") out += `<rect x="${x - 8}" y="${H - B - Math.max(o, c)}" width="16" height="${Math.max(2, Math.abs(c - o))}" fill="${col}"/>`;
      else out += `<line x1="${x - 8}" y1="${H - B - o}" x2="${x}" y2="${H - B - o}" stroke="${col}" stroke-width="2"/><line x1="${x}" y1="${H - B - c}" x2="${x + 8}" y2="${H - B - c}" stroke="${col}" stroke-width="2"/>`;
      v = c;
    }
  }
  return out + "</svg>";
}
function radar(spider = false): string {
  const W = 640, H = 300, cx = 200, cy = 155, R = 115;
  const axes = ["Korporasi", "Perizinan", "Aset & HKI", "Kontrak", "Tenaga Kerja", "Litigasi"];
  const val1 = [0.85, 0.55, 0.75, 0.65, 0.45, 0.7], val2 = [0.6, 0.8, 0.55, 0.8, 0.7, 0.5];
  let out = svgOpen(W, H);
  for (let ring = 1; ring <= 4; ring++) {
    const pts = axes.map((_, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; return `${cx + R * ring / 4 * Math.cos(a)},${cy + R * ring / 4 * Math.sin(a)}`; }).join(" ");
    out += `<polygon points="${pts}" fill="none" stroke="#DDD"/>`;
  }
  axes.forEach((l, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; out += `<line x1="${cx}" y1="${cy}" x2="${cx + R * Math.cos(a)}" y2="${cy + R * Math.sin(a)}" stroke="#DDD"/>` + txt(cx + (R + 18) * Math.cos(a), cy + (R + 18) * Math.sin(a) + 3, l, 9, "#333", "middle"); });
  [[val1, NAVY], [val2, GOLD]].forEach(([vals, c], k) => {
    if (spider && k > 0) return;
    const pts = (vals as number[]).map((v, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; return `${cx + R * v * Math.cos(a)},${cy + R * v * Math.sin(a)}`; }).join(" ");
    out += `<polygon points="${pts}" fill="${c}" opacity="0.3" stroke="${c}" stroke-width="2"/>`;
  });
  out += txt(400, 80, spider ? "Profil kepatuhan aktual" : "Navy: aktual · Emas: target", 10);
  return out + "</svg>";
}
function tileMap(mode: "filled" | "bubble" | "symbol" | "choropleth" | "geoheat"): string {
  /* peta ubin bergaya (tile grid) provinsi utama — peta geografis presisi butuh data GIS */
  const prov: [string, number, number, number][] = [["Aceh", 0, 0, 2], ["Sumut", 1, 0, 5], ["Riau", 1, 1, 3], ["Sumbar", 0, 1, 2], ["Sumsel", 2, 1, 3], ["Lampung", 2, 2, 2], ["Banten", 3, 2, 4], ["DKI", 4, 2, 9], ["Jabar", 5, 2, 8], ["Jateng", 6, 2, 6], ["DIY", 6, 3, 3], ["Jatim", 7, 2, 7], ["Bali", 8, 3, 4], ["Kalbar", 4, 0, 2], ["Kaltim", 6, 0, 4], ["Sulsel", 8, 1, 3], ["Papua", 10, 1, 1]];
  const W = 660, H = 260, cell = 52;
  const max = 9;
  let out = svgOpen(W, H);
  prov.forEach(([l, gx, gy, v]) => {
    const x = 20 + gx * (cell + 4), y = 30 + gy * (cell + 4);
    const inten = v / max;
    if (mode === "bubble") { out += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="6" fill="#EFEAE0" stroke="#CCC"/><circle cx="${x + cell / 2}" cy="${y + cell / 2 - 4}" r="${5 + inten * 16}" fill="${NAVY}" opacity="0.75"/>`; }
    else if (mode === "symbol") { out += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="6" fill="#EFEAE0" stroke="#CCC"/>` + (v > 4 ? txt(x + cell / 2, y + cell / 2 + 2, "▲", 15, RED, "middle") : txt(x + cell / 2, y + cell / 2 + 2, "●", 11, GREEN, "middle")); }
    else { const col = mode === "geoheat" ? (inten > 0.6 ? RED : inten > 0.3 ? GOLD : GREEN) : NAVY; out += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="6" fill="${col}" opacity="${0.2 + inten * 0.7}" stroke="#fff"/>`; }
    out += txt(x + cell / 2, y + cell - 5, l, 7.8, mode === "bubble" || mode === "symbol" ? "#555" : "#fff", "middle");
  });
  out += txt(20, 16, "Peta ubin provinsi (bergaya) — intensitas = jumlah rekam/karyawan per wilayah", 9.5, "#666");
  return out + "</svg>";
}
function wordCloud(): string {
  const words: [string, number][] = [["wanprestasi", 30], ["perjanjian", 26], ["somasi", 22], ["PKWT", 20], ["izin", 19], ["merek", 17], ["pesangon", 15], ["BPJS", 14], ["akta", 13], ["RUPS", 12], ["sengketa", 11], ["klaim", 10], ["LKPM", 10], ["jaminan", 9], ["arbitrase", 9]];
  const pos: [number, number][] = [[320, 120], [180, 80], [470, 90], [150, 170], [420, 170], [280, 200], [520, 150], [100, 120], [360, 60], [230, 150], [500, 210], [90, 210], [380, 230], [560, 60], [250, 50]];
  let out = svgOpen(640, 260);
  words.forEach(([w, s], i) => { out += txt(pos[i][0], pos[i][1], w, s, PAL[i % PAL.length], "middle", s > 15); });
  return out + "</svg>";
}
function parallelCoords(andrews = false): string {
  const W = 640, H = 280, axes = ["Umur", "Masa Kerja", "Upah", "Kepatuhan", "Risiko"];
  const r = rnd(71);
  let out = svgOpen(W, H);
  if (andrews) {
    for (let k = 0; k < 8; k++) {
      let d = "";
      for (let x = 0; x <= 600; x += 10) {
        const t = (x / 600) * Math.PI * 2 - Math.PI;
        const y = 140 + 40 * Math.sin(t * (1 + k % 3)) * (0.5 + r() * 0.1) + 24 * Math.cos(t * 2 + k);
        d += (x === 0 ? "M" : "L") + ` ${x + 20} ${y}`;
      }
      out += `<path d="${d}" fill="none" stroke="${PAL[k % PAL.length]}" stroke-width="1.4" opacity="0.7"/>`;
    }
    return out + "</svg>";
  }
  axes.forEach((a, i) => { const x = 60 + i * 130; out += `<line x1="${x}" y1="30" x2="${x}" y2="${H - 30}" stroke="#999"/>` + txt(x, H - 12, a, 9.5, "#333", "middle"); });
  for (let k = 0; k < 9; k++) {
    const pts = axes.map((_, i) => `${60 + i * 130},${40 + r() * (H - 90)}`).join(" ");
    out += `<polyline points="${pts}" fill="none" stroke="${PAL[k % PAL.length]}" stroke-width="1.3" opacity="0.65"/>`;
  }
  return out + "</svg>";
}
function curveEval(mode: "roc" | "pr" | "lift" | "gain"): string {
  const W = 640, H = 300, L = 60, B = 36, pw = W - L - 30, ph = H - B - 20;
  let out = svgOpen(W, H) + axis(W, H, L, B);
  out += `<line x1="${L}" y1="${H - B}" x2="${L + pw}" y2="${mode === "roc" || mode === "gain" ? H - B - ph : H - B}" stroke="#CCC" stroke-dasharray="5 4"/>`;
  let d = `M ${L} ${H - B}`;
  for (let t = 0; t <= 40; t++) {
    const x = t / 40;
    const y = mode === "roc" ? Math.pow(x, 0.32) : mode === "gain" ? Math.min(1, x * 2.1 - x * x * 1.12) : mode === "lift" ? 2.4 - 1.4 * x : 0.95 - 0.5 * Math.pow(x, 2.4);
    const yn = mode === "lift" ? (y - 0.8) / 1.8 : y;
    d += ` L ${L + x * pw} ${H - B - yn * ph}`;
  }
  out += `<path d="${d}" fill="none" stroke="${NAVY}" stroke-width="2.4"/>`;
  const lbl = { roc: ["False Positive Rate", "True Positive Rate — AUC 0,91"], pr: ["Recall", "Precision"], lift: ["Persentil populasi", "Lift model vs acak"], gain: ["Persentil populasi", "Kumulatif temuan tertangkap"] }[mode];
  out += txt(W / 2, H - 8, lbl[0], 9.5, "#555", "middle") + txt(L + 8, 18, lbl[1], 9.5, "#555");
  return out + "</svg>";
}
function bulletKpi(mode: "bullet" | "kpi" | "progress"): string {
  if (mode === "progress") {
    const W = 640, H = 200; let out = svgOpen(W, H);
    [["Kelengkapan dokumen", 78], ["Verifikasi advokat", 45], ["Tindak lanjut temuan", 62]].forEach(([l, p], i) => {
      const cx = 120 + i * 200, cy = 100, R = 56, pct = p as number;
      const a = -Math.PI / 2 + (pct / 100) * Math.PI * 2, large = pct > 50 ? 1 : 0;
      out += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#E7E2D5" stroke-width="12"/>`;
      out += `<path d="M ${cx} ${cy - R} A ${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(a)} ${cy + R * Math.sin(a)}" fill="none" stroke="${PAL[i]}" stroke-width="12" stroke-linecap="round"/>`;
      out += txt(cx, cy + 5, `${pct}%`, 17, NAVY, "middle", true) + txt(cx, cy + R + 24, l as string, 9.5, "#555", "middle");
    });
    return out + "</svg>";
  }
  if (mode === "kpi") {
    const W = 640, H = 150; let out = svgOpen(W, H);
    [["SKOR KEPATUHAN", "79 / 100", GREEN], ["TEMUAN TINGGI", "3", RED], ["DOKUMEN DI VAULT", "128", NAVY], ["HARI KE TENGGAT TERDEKAT", "14", GOLD]].forEach(([l, v, c], i) => {
      const x = 8 + i * 158;
      out += `<rect x="${x}" y="16" width="148" height="112" rx="10" fill="#FBF9F4" stroke="#D8D2C4"/><rect x="${x}" y="16" width="148" height="6" rx="3" fill="${c}"/>`;
      out += txt(x + 74, 72, v as string, 24, c as string, "middle", true) + txt(x + 74, 104, l as string, 8, "#666", "middle");
    });
    return out + "</svg>";
  }
  const W = 640, H = 170; let out = svgOpen(W, H);
  [["Pelaporan LKPM", 80, 62], ["Kontrak tertulis", 100, 71], ["Kepesertaan BPJS", 100, 84]].forEach(([l, tgt, act], i) => {
    const y = 20 + i * 50;
    out += txt(0, y + 15, l as string, 10) + `<rect x="170" y="${y}" width="440" height="22" fill="#EEE9DC"/><rect x="170" y="${y}" width="${(act as number) * 4.4}" height="22" fill="${NAVY}" opacity="0.9"/><line x1="${170 + (tgt as number) * 4.4}" y1="${y - 4}" x2="${170 + (tgt as number) * 4.4}" y2="${y + 26}" stroke="${RED}" stroke-width="3"/>`;
  });
  return out + "</svg>";
}
function stemLeaf(): string {
  const rows = [["1", "2 4 5 7 8"], ["2", "0 1 1 3 6 8 9"], ["3", "0 2 4 5 5 7"], ["4", "1 2 6"], ["5", "0 3"]];
  let out = svgOpen(640, 190);
  out += txt(60, 24, "Batang (puluhan)", 9.5, "#666") + txt(160, 24, "Daun (satuan) — masa kerja karyawan dalam bulan ÷ 10", 9.5, "#666");
  rows.forEach(([s, l], i) => { out += txt(80, 50 + i * 26, s, 12, NAVY, "middle", true) + `<line x1="100" y1="${38 + i * 26}" x2="100" y2="${58 + i * 26}" stroke="#999"/>` + txt(114, 50 + i * 26, l, 12, "#333"); });
  return out + "</svg>";
}

/* ═══════════ DAFTAR 78 GRAFIK + ANALISIS HUKUM ═══════════ */
export type LddChart = { no: number; name: string; svg: string; an: string };
type Def = { name: string; svg: () => string; an: string };

const THN = ["2022", "2023", "2024", "2025", "2026"];
const ASPEK = ["Korporasi", "Perizinan", "Aset", "Kontrak", "Naker", "Perkara"];
const s1 = { name: "Rekam", data: [12, 19, 25, 33, 41] };
const s2 = { name: "Temuan", data: [6, 8, 7, 5, 4] };
const dua = [{ name: "Patuh", data: [8, 12, 18, 26, 35] }, { name: "Perlu tindak lanjut", data: [4, 7, 7, 7, 6] }];

export const SECTIONS: { title: string; intro: string; charts: Def[] }[] = [
  {
    title: "Struktur Korporasi, Kepemilikan, dan Relasi Pihak",
    intro: "Bagian ini memvisualisasikan anatomi badan hukum yang diperiksa: susunan organ perseroan, struktur kepemilikan saham, relasi dengan pihak terafiliasi, serta aliran dana antar entitas. Visualisasi pada bagian ini menjadi dasar pengujian ketentuan Undang-Undang Nomor 40 Tahun 2007 tentang Perseroan Terbatas, khususnya mengenai organ perseroan, benturan kepentingan, dan transaksi dengan pihak berelasi.",
    charts: [
      { name: "Column Chart — Pertumbuhan Rekam Hukum per Tahun", svg: () => bars({ labels: THN, series: [s1] }), an: "Grafik kolom di atas memperlihatkan pertumbuhan jumlah rekam hukum perseroan dari dua belas rekam pada tahun 2022 menjadi empat puluh satu rekam pada tahun 2026. Secara hukum, kurva pertumbuhan ini merefleksikan meningkatnya kesadaran dokumentasi korporasi yang menjadi prasyarat pembuktian dalam sengketa maupun transaksi. Kegagalan memelihara dokumentasi yang memadai dapat melemahkan posisi perseroan dalam pembuktian perdata sebagaimana asas beban pembuktian dalam Kitab Undang-Undang Hukum Perdata. Bagi calon investor, tren naik ini merupakan indikator positif kematangan tata kelola, meskipun tetap harus diuji terhadap kelengkapan substansi tiap rekam sebagaimana diurai pada bab pemeriksaan aspek." },
      { name: "Bar Chart — Sebaran Rekam per Aspek Hukum", svg: () => barsH(ASPEK, [9, 12, 8, 14, 21, 3]), an: "Grafik batang horizontal ini membandingkan volume rekam pada enam aspek hukum utama. Aspek ketenagakerjaan mendominasi dengan dua puluh satu rekam, konsisten dengan karakter perusahaan padat karya yang tunduk pada Undang-Undang Nomor 13 Tahun 2003 juncto Undang-Undang Nomor 6 Tahun 2023. Dominasi ini menuntut perhatian khusus karena kewajiban ketenagakerjaan bersifat berkelanjutan dan sanksinya dapat bersifat pidana pada pelanggaran tertentu, misalnya pelanggaran upah minimum. Sebaliknya, aspek perkara yang hanya memuat tiga rekam menunjukkan eksposur litigasi yang relatif rendah, sebuah faktor yang lazim menaikkan nilai tawar perseroan dalam negosiasi akuisisi." },
      { name: "Clustered Column — Rekam vs Temuan per Tahun", svg: () => bars({ labels: THN, series: [s1, s2] }), an: "Perbandingan berdampingan antara jumlah rekam dan jumlah temuan per tahun menunjukkan pola yang menggembirakan: sementara rekam bertambah lebih dari tiga kali lipat, temuan justru menurun dari delapan menjadi empat. Rasio temuan terhadap rekam yang menurun menandakan perbaikan sistemik, bukan sekadar penambahan volume dokumen. Dalam kerangka uji tuntas, penurunan rasio ini mengurangi kebutuhan klausul jaminan dan ganti rugi khusus (special indemnity) dalam perjanjian jual beli saham, karena risiko tersembunyi yang teridentifikasi cenderung mengecil dari waktu ke waktu." },
      { name: "Clustered Bar — Perbandingan Status Dokumen per Divisi", svg: () => barsH(["Produksi", "Distribusi", "Keuangan", "Legal & GA"], [18, 13, 9, 22], GOLD), an: "Grafik batang berkelompok ini memetakan kepemilikan dokumen menurut divisi internal. Divisi Legal dan General Affairs memegang dua puluh dua dokumen, wajar mengingat fungsinya sebagai kustodian dokumen korporasi. Namun konsentrasi dokumen pada satu divisi menimbulkan risiko titik kegagalan tunggal: apabila personel kunci berhenti, akses dan pemahaman atas dokumen dapat terputus. Praktik tata kelola yang baik sebagaimana dianjurkan pedoman umum governansi korporasi Indonesia menuntut sistem penyimpanan terpusat dengan hak akses berlapis, yang justru telah difasilitasi vault Corplex ini." },
      { name: "Stacked Column — Komposisi Kepatuhan per Tahun", svg: () => bars({ labels: THN, series: dua, stacked: true }), an: "Kolom bertumpuk ini memperlihatkan total rekam sekaligus komposisinya antara yang berstatus patuh dan yang memerlukan tindak lanjut. Lapisan tindak lanjut yang relatif stabil sekitar enam sampai tujuh rekam di tengah total yang terus bertambah berarti persentase ketidakpatuhan terus menurun. Dari sudut pandang hukum administratif, rekam berstatus tindak lanjut adalah pekerjaan rumah yang tiap butirnya berpasangan dengan sanksi potensial, mulai dari teguran tertulis hingga pembekuan kegiatan usaha menurut Peraturan Pemerintah Nomor 5 Tahun 2021. Penuntasan lapisan ini sebelum penutupan transaksi sangat dianjurkan." },
      { name: "Stacked Bar — Komposisi Dokumen per Aspek", svg: () => bars({ labels: ASPEK.slice(0, 4), series: [{ name: "Asli di vault", data: [7, 9, 6, 10] }, { name: "Salinan", data: [2, 3, 2, 4] }], stacked: true }), an: "Batang bertumpuk horizontal ini membedakan dokumen asli yang tersimpan di vault dari salinan. Dalam hukum acara perdata Indonesia, kekuatan pembuktian akta autentik dan dokumen asli jauh melampaui salinan, sehingga proporsi dokumen asli yang tinggi memperkuat posisi pembuktian perseroan. Terhadap salinan yang tersisa, direkomendasikan penelusuran keberadaan aslinya atau, bila musnah, pembuatan pernyataan kehilangan yang sah untuk memitigasi risiko penyangkalan keaslian oleh pihak lawan di kemudian hari." },
      { name: "100% Stacked Column — Proporsi Sumber Input Data", svg: () => bars({ labels: ASPEK.slice(0, 5), series: [{ name: "Manual", data: [60, 45, 50, 40, 55] }, { name: "Ekstraksi AI", data: [25, 35, 30, 40, 30] }, { name: "Impor Excel", data: [15, 20, 20, 20, 15] }], stacked: true, pct: true }), an: "Kolom bertumpuk seratus persen ini menormalkan setiap aspek ke proporsi sumber inputnya: manual, ekstraksi kecerdasan buatan, dan impor massal. Proporsi input berbantuan mesin yang mencapai sekitar separuh menunjukkan efisiensi, tetapi juga menuntut kehati-hatian: hasil ekstraksi otomatis wajib diverifikasi manusia sebelum dijadikan dasar tindakan hukum, sejalan dengan prinsip kehati-hatian profesional advokat. Sistem Corplex menandai sumber tiap rekam justru untuk memungkinkan audit berjenjang semacam ini." },
      { name: "100% Stacked Bar — Proporsi Risiko per Divisi", svg: () => bars({ labels: ["Produksi", "Distribusi", "Keuangan"], series: [{ name: "Rendah", data: [55, 62, 70] }, { name: "Sedang", data: [30, 28, 22] }, { name: "Tinggi", data: [15, 10, 8] }], stacked: true, pct: true }), an: "Distribusi proporsional tingkat risiko per divisi memperlihatkan bahwa divisi produksi memikul porsi risiko tinggi terbesar, lima belas persen. Hal ini koheren dengan profil regulasinya: divisi produksi bersinggungan dengan persetujuan lingkungan, keselamatan kerja, dan perizinan operasional yang sanksinya paling berat. Alokasi sumber daya kepatuhan sepatutnya mengikuti peta ini, bukan dibagi rata, agar mitigasi menyasar titik dengan eksposur hukum tertinggi." },
      { name: "Treemap — Nilai Aset per Kategori", svg: () => treemap([{ l: "Tanah & Bangunan", v: 58 }, { l: "Mesin", v: 22 }, { l: "Kendaraan", v: 12 }, { l: "HKI", v: 8 }]), an: "Peta pohon ini memvisualkan komposisi nilai aset: tanah dan bangunan mendominasi lima puluh delapan persen nilai tercatat. Konsentrasi nilai pada aset tidak bergerak menuntut pemeriksaan sertipikat yang ekstra ketat, meliputi kesesuaian nama pemegang hak, masa berlaku Hak Guna Bangunan, serta ada tidaknya pembebanan hak tanggungan menurut Undang-Undang Nomor 4 Tahun 1996 tentang Hak Tanggungan. Nilai HKI yang baru delapan persen berpotensi undervalued; merek yang dikelola baik kerap menjadi komponen goodwill terbesar dalam akuisisi." },
      { name: "Sunburst Chart — Hierarki Grup Usaha Dua Tingkat", svg: () => sunburst(), an: "Diagram sunburst dua cincin ini menggambarkan hierarki grup usaha dari entitas induk ke divisi lalu unit operasional. Pemetaan hierarkis semacam ini esensial untuk menguji doktrin keterpisahan badan hukum: kreditor atau penggugat dapat berupaya menembus tirai korporasi (piercing the corporate veil) bila tercampurnya urusan antar lapisan dapat dibuktikan. Batas antar cincin yang tegas, ditopang pembukuan terpisah dan perjanjian antar perusahaan yang wajar, adalah pertahanan hukum utama terhadap upaya tersebut." },
      { name: "Icicle Chart — Struktur Organisasi Vertikal", svg: () => icicle(), an: "Bagan es vertikal ini menyusun struktur organisasi dari induk hingga unit terkecil dengan lebar blok sebanding bobot organisasi. Dari kacamata ketenagakerjaan, struktur ini menjadi rujukan pengujian keabsahan rantai pemberian perintah kerja dan penetapan pemberi kerja yang sebenarnya, isu yang kerap muncul dalam sengketa alih daya berdasarkan Peraturan Pemerintah Nomor 35 Tahun 2021. Struktur yang terdokumentasi rapi mempersempit ruang klaim hubungan kerja tersembunyi." },
      { name: "Tree Diagram — Struktur Organ Perseroan", svg: () => treeDiagram(), an: "Diagram pohon organ perseroan menempatkan RUPS pada puncak, diikuti Dewan Komisaris dan Direksi beserta perangkat di bawahnya, sesuai trias organ dalam Undang-Undang Nomor 40 Tahun 2007. Pemeriksaan menemukan struktur formal telah sesuai; yang wajib diuji lebih lanjut adalah keabsahan pengangkatan tiap pejabat, yaitu akta risalah RUPS pengangkatan dan pemberitahuannya kepada Menteri. Cacat prosedural pengangkatan dapat berujung pada tidak sahnya perbuatan hukum yang ditandatangani pejabat bersangkutan, risiko yang material bagi keabsahan kontrak-kontrak perseroan." },
      { name: "Dendrogram — Klasterisasi Temuan Pemeriksaan", svg: () => treeDiagram(true), an: "Dendrogram ini mengelompokkan temuan pemeriksaan berdasarkan kemiripan akar penyebabnya. Terlihat dua klaster besar: temuan berakar administrasi perizinan dan temuan berakar dokumentasi kontrak kerja. Pengelompokan semacam ini mengubah strategi remediasi dari tambal sulam per temuan menjadi perbaikan sistemik per akar masalah, misalnya satu prosedur pemantauan tenggat izin akan menutup sekaligus seluruh temuan pada klaster pertama. Efisiensi remediasi ini lazim menjadi bahan negosiasi jadwal pemenuhan kondisi dalam perjanjian transaksi." },
      { name: "Circle Packing — Kelompok Fungsi Perusahaan", svg: () => circles(false), an: "Visualisasi lingkaran bersarang ini menampilkan fungsi-fungsi perusahaan sebagai lingkaran di dalam lingkup grup usaha. Ukuran relatif tiap lingkaran menggambarkan bobot organisasi, sementara posisi bersarang menegaskan batas kewenangan. Bagi pemeriksa, peta ini membantu memastikan tidak ada fungsi kritis, khususnya kepatuhan dan keuangan, yang berada di luar struktur formal, sebab fungsi yang mengambang tanpa induk struktur cenderung luput dari pengawasan Direksi padahal tanggung jawab pengurusan tetap melekat pada Direksi menurut undang-undang." },
      { name: "Packed Bubble Chart — Portofolio Aset Berdasarkan Ukuran", svg: () => circles(true), an: "Gelembung berkelompok ini menyajikan portofolio aset dengan luas gelembung sebanding nilai. Selain menegaskan dominasi aset tanah, visual ini menyingkap aset bernilai kecil namun berisiko besar bila terabaikan, seperti paten yang jangka pelindungannya terbatas dua puluh tahun dan tidak dapat diperpanjang menurut Undang-Undang Paten. Manajemen portofolio yang baik menuntut kalender kewajiban per gelembung, persis fungsi pengingat otomatis yang dijalankan modul JAGA pada sistem ini." },
      { name: "Network Graph — Relasi Pihak Ketiga", svg: () => network(false), an: "Graf jaringan ini memetakan relasi kontraktual perseroan dengan para pihak ketiga: pemasok, vendor, bank, distributor, dan afiliasi. Sentralitas simpul perseroan yang terhubung ke hampir semua pihak adalah hal wajar; yang menuntut telaah adalah tautan tidak langsung, misalnya vendor yang ternyata terafiliasi dengan pemegang saham. Transaksi demikian wajib memenuhi ketentuan benturan kepentingan, dan pada perseroan terbuka tunduk pada peraturan transaksi afiliasi Otoritas Jasa Keuangan. Pemeriksa merekomendasikan konfirmasi kepemilikan manfaat (beneficial ownership) tiap simpul sesuai Peraturan Presiden Nomor 13 Tahun 2018." },
      { name: "Force-Directed Graph — Jaringan Afiliasi Dinamis", svg: () => network(true), an: "Varian graf berpegas ini membiarkan posisi simpul ditarik oleh kekuatan relasinya sehingga entitas yang paling sering bertransaksi tampil saling berdekatan. Kedekatan visual antara perseroan dan afiliasinya pada graf ini mengindikasikan intensitas transaksi intra-grup yang tinggi. Konsekuensi hukumnya berlapis: kewajiban dokumentasi harga transfer menurut peraturan perpajakan atas transaksi hubungan istimewa, serta keharusan memastikan setiap transaksi afiliasi dibuat dengan syarat yang wajar (arm's length) agar tidak digolongkan perbuatan yang merugikan perseroan." },
      { name: "Sankey Diagram — Aliran Dana Utama", svg: () => sankey(false), an: "Diagram Sankey ini melacak aliran dana dari tiga sumber utama menuju tiga penggunaan besar. Lebar pita sebanding nominal sehingga pembaca awam sekalipun dapat menangkap ke mana uang mengalir. Secara hukum, transparansi aliran dana adalah pertahanan pertama terhadap tuduhan pencucian uang dan penggelapan pajak; aliran dari pendanaan bank menuju kewajiban pajak dan biaya operasional yang terdokumentasi rapi mempermudah pembuktian itikad baik. Auditor hukum merekomendasikan rekonsiliasi pita-pita ini dengan rekening koran pada periode uji." },
      { name: "Alluvial Diagram — Perubahan Kategori Kontrak Antar Periode", svg: () => sankey(true), an: "Diagram aluvial memperlihatkan migrasi kategori kontrak antar periode, misalnya kontrak berstatus draf yang mengalir menjadi aktif atau berakhir. Pola aliran yang sehat memperlihatkan mayoritas draf bermuara pada penandatanganan; aliran besar dari draf langsung ke kedaluwarsa justru menandakan kegagalan proses negosiasi yang patut dievaluasi. Dari sisi kepatuhan, setiap aliran menuju status berakhir wajib dipastikan disertai penyelesaian kewajiban pasca-kontrak seperti pengembalian jaminan dan kewajiban kerahasiaan yang bertahan setelah berakhirnya perjanjian." },
      { name: "Chord Diagram — Interaksi Antar Fungsi Internal", svg: () => chord(), an: "Diagram tali busur ini merangkum intensitas interaksi dokumen antar fungsi internal: legal, keuangan, operasi, dan sumber daya manusia. Tali tebal antara legal dan keuangan mencerminkan kolaborasi pada kontrak bernilai besar, pola yang sehat. Sebaliknya, tipisnya tali antara operasi dan legal patut dicermati: keputusan operasional yang tidak melewati telaah hukum adalah sumber klasik sengketa, mulai dari pengadaan tanpa kontrak tertulis hingga pemutusan hubungan kerja tanpa prosedur. Rekomendasi: wajibkan telaah hukum untuk komitmen operasional di atas ambang nilai tertentu." },
    ],
  },
  {
    title: "Ketenagakerjaan dan Demografi Sumber Daya Manusia",
    intro: "Bagian ini membedah profil tenaga kerja dari berbagai dimensi statistik: distribusi usia dan masa kerja, komposisi status hubungan kerja, sebaran upah, hingga dinamika kepatuhan administrasi kepegawaian. Kerangka hukum utamanya adalah Undang-Undang Nomor 13 Tahun 2003 sebagaimana diubah Undang-Undang Nomor 6 Tahun 2023, Peraturan Pemerintah Nomor 35 dan 36 Tahun 2021, serta Undang-Undang Nomor 24 Tahun 2011 tentang BPJS.",
    charts: [
      { name: "Histogram — Distribusi Usia Karyawan", svg: () => histo([3, 8, 14, 19, 16, 11, 6, 3]), an: "Histogram usia memperlihatkan distribusi menyerupai lonceng dengan puncak pada kelompok tiga puluhan. Konsentrasi usia produktif meminimalkan eksposur jangka pendek terhadap gelombang pensiun massal beserta kewajiban uang penghargaan masa kerja yang menyertainya menurut Peraturan Pemerintah Nomor 35 Tahun 2021. Ekor kanan yang menipis tetap perlu dipantau: karyawan mendekati usia pensiun membawa kewajiban pesangon dengan pengali maksimal, sehingga pencadangannya harus tercermin dalam laporan keuangan yang diperiksa bersamaan dengan uji tuntas finansial." },
      { name: "Box Plot — Sebaran Upah per Jenjang", svg: () => boxes([{ l: "Staf", q: [40, 55, 66, 80, 95] }, { l: "Penyelia", q: [70, 88, 100, 118, 140] }, { l: "Manajerial", q: [120, 150, 172, 200, 240] }]), an: "Diagram kotak garis membandingkan sebaran upah tiga jenjang jabatan dalam satuan ratus ribu rupiah. Nilai minimum jenjang staf berada di atas upah minimum provinsi acuan, sebuah temuan positif karena pelanggaran upah minimum diancam sanksi pidana menurut ketentuan ketenagakerjaan yang berlaku. Rentang antar kuartil yang melebar pada jenjang manajerial mengindikasikan diskresi penetapan upah yang besar; tanpa struktur dan skala upah tertulis sebagaimana diwajibkan Peraturan Pemerintah Nomor 36 Tahun 2021, diskresi demikian rawan digugat sebagai praktik diskriminatif." },
      { name: "Violin Plot — Kepadatan Sebaran Upah", svg: () => boxes([{ l: "Staf", q: [40, 55, 66, 80, 95] }, { l: "Penyelia", q: [70, 88, 100, 118, 140] }, { l: "Manajerial", q: [120, 150, 172, 200, 240] }], true), an: "Plot biola menambahkan dimensi kepadatan pada sebaran upah: bagian gemuk kurva menunjukkan di mana mayoritas karyawan berada. Terlihat penumpukan pada batas bawah jenjang staf, pola yang lazim namun berisiko: kenaikan upah minimum tahunan akan langsung mendorong seluruh penumpukan tersebut, menciptakan lonjakan biaya yang patut dimodelkan pembeli dalam valuasi. Kompresi upah antara staf senior dan penyelia baru yang tampak dari tumpang tindih kurva juga berpotensi memicu keresahan industrial." },
      { name: "Strip Plot — Titik Data Upah Individual", svg: () => dots(3, 26, "strip"), an: "Plot strip menampilkan tiap karyawan sebagai satu titik sehingga pencilan langsung terlihat tanpa agregasi yang menyembunyikannya. Beberapa titik terisolasi di atas kelompoknya menandakan individu dengan upah jauh di atas rekan sejenjang; auditor hukum wajib memastikan dasar pembedanya terdokumentasi, misalnya keahlian tersertifikasi, karena pembedaan tanpa dasar objektif bertentangan dengan asas non-diskriminasi pengupahan. Titik di bawah kelompok justru lebih kritis untuk diuji terhadap upah minimum." },
      { name: "Beeswarm Plot — Sebaran Tanpa Tumpang Tindih", svg: () => dots(3, 26, "beeswarm"), an: "Plot kawanan lebah menyusun titik-titik agar tidak saling menimpa, sehingga kepadatan pada tiap tingkat upah terbaca jujur. Keunggulannya bagi pemeriksa non-teknis: jumlah karyawan pada tiap rentang dapat dihitung langsung secara visual. Pola berjenjang yang terlihat mengonfirmasi keberadaan golongan upah de facto; langkah hukum berikutnya adalah memformalkannya ke dalam struktur dan skala upah yang ditetapkan keputusan direksi, dokumen yang menurut peraturan pengupahan wajib dilampirkan dalam berbagai urusan administratif ketenagakerjaan." },
      { name: "Density Plot — Kurva Kepadatan Masa Kerja", svg: () => densityCurves(1), an: "Kurva kepadatan masa kerja memuncak pada kisaran dua sampai tiga tahun. Titik ini krusial secara hukum: masa kerja adalah pengali langsung dalam formula pesangon, uang penghargaan masa kerja, dan kompensasi PKWT. Puncak pada masa kerja pendek berarti kewajiban pesangon agregat saat ini relatif rendah, tetapi akan menanjak serentak seiring kohort besar ini menua bersama. Pemodelan kewajiban imbalan kerja jangka panjang sebaiknya memakai kurva ini sebagai masukan aktuaria." },
      { name: "Ridgeline Plot — Distribusi Masa Kerja per Status", svg: () => densityCurves(5, true), an: "Plot punggung bukit menumpuk kurva kepadatan masa kerja untuk lima status hubungan kerja secara berjajar. Kurva PKWT yang terkonsentrasi pada masa pendek konsisten dengan batas maksimal lima tahun perjanjian kerja waktu tertentu menurut Peraturan Pemerintah Nomor 35 Tahun 2021; ekor kurva PKWT yang melewati batas itu, bila ada, adalah alarm keras karena demi hukum berubah menjadi PKWTT dengan segala konsekuensi pesangonnya. Kurva alih daya dan magang juga wajib diuji terhadap regulasi khususnya masing-masing." },
      { name: "Population Pyramid — Piramida Usia dan Jenis Kelamin", svg: () => funnel(false, true), an: "Piramida penduduk perusahaan membelah komposisi karyawan menurut kelompok usia dan jenis kelamin. Bentuk piramida yang menggembung di tengah menandakan dominasi usia produktif. Ketimpangan gender yang tampak pada beberapa kelompok usia patut ditelaah kebijakan penyebabnya, mengingat prinsip kesempatan kerja yang setara dijamin konstitusi dan undang-undang ketenagakerjaan. Data ini juga menjadi dasar perencanaan fasilitas yang diwajibkan hukum, seperti ruang laktasi bagi pekerja perempuan." },
      { name: "Waffle Chart — Persentase Kepesertaan BPJS", svg: () => { const cell = 30; let out2 = svgOpen(640, 220); for (let i = 0; i < 100; i++) { const x = 30 + (i % 20) * cell, y = 20 + Math.floor(i / 20) * (cell + 4); out2 += `<rect x="${x}" y="${y}" width="${cell - 5}" height="${cell - 5}" rx="4" fill="${i < 84 ? GREEN : RED}" opacity="0.85"/>`; } return out2 + txt(30, 210, "Hijau: terdaftar BPJS (84%) · Merah: belum (16%)", 10.5); }, an: "Grafik wafel menerjemahkan tingkat kepesertaan BPJS menjadi seratus kotak yang mudah dicerna: delapan puluh empat kotak hijau, enam belas merah. Enam belas kotak merah itu bukan sekadar angka; masing-masing mewakili karyawan yang belum didaftarkan pada program jaminan sosial yang bersifat wajib menurut Undang-Undang Nomor 24 Tahun 2011. Sanksinya berjenjang hingga penghentian pelayanan publik tertentu bagi pemberi kerja, dan dalam skenario kecelakaan kerja, seluruh beban santunan jatuh ke pundak perusahaan. Pendaftaran segera adalah remediasi termurah dalam seluruh laporan ini." },
      { name: "Pie Chart — Komposisi Status Hubungan Kerja", svg: () => pie([{ l: "PKWTT", v: 46 }, { l: "PKWT", v: 38 }, { l: "Alih Daya", v: 11 }, { l: "Magang", v: 5 }]), an: "Diagram lingkaran status hubungan kerja menunjukkan hampir empat puluh persen karyawan berstatus PKWT. Proporsi kontrak sebesar ini menuntut disiplin administrasi tinggi: setiap PKWT wajib tertulis, mencantumkan jangka waktu yang sah, dan diikuti pembayaran kompensasi pada akhir jangka waktu sesuai Peraturan Pemerintah Nomor 35 Tahun 2021. Porsi alih daya sebelas persen menambah lapisan kewajiban pengecekan: legalitas perusahaan alih daya dan pemenuhan hak pekerjanya ikut menjadi risiko perseroan penerima jasa dalam batas yang ditetapkan peraturan." },
      { name: "Doughnut Chart — Komposisi Pendidikan", svg: () => pie([{ l: "SMA/SMK", v: 42 }, { l: "D3", v: 18 }, { l: "S1", v: 32 }, { l: "S2+", v: 8 }], 46), an: "Diagram donat komposisi pendidikan memperlihatkan basis vokasional yang kuat dengan empat puluh dua persen lulusan sekolah menengah kejuruan. Relevansi hukumnya terletak pada pemetaan jabatan: jabatan tertentu yang dipersyaratkan sertifikasi kompetensi oleh regulasi sektoral, misalnya operator alat berat atau petugas keselamatan kebakaran, wajib diisi personel bersertifikat. Ketidaksesuaian kualifikasi dengan persyaratan jabatan bersertifikat dapat menggugurkan pembelaan perusahaan dalam perkara kecelakaan kerja." },
      { name: "Mosaic Chart — Status Kerja vs Departemen", svg: () => bars({ labels: ["Produksi", "Distribusi", "Kantor"], series: [{ name: "PKWTT", data: [20, 12, 14] }, { name: "PKWT", data: [18, 12, 8] }, { name: "Alih daya", data: [8, 3, 0] }], stacked: true }), an: "Bagan mosaik menyilangkan status hubungan kerja dengan departemen. Terbaca bahwa pekerja alih daya terkonsentrasi di produksi dan distribusi, tidak ada di kantor. Pola ini harus diuji terhadap prinsip bahwa alih daya kini dibatasi berdasarkan perjanjian tertulisnya, dan tanggung jawab perlindungan pekerja alih daya berada pada perusahaan alih daya dengan keterlibatan perusahaan pemberi pekerjaan dalam batas tertentu. Konsentrasi pada fungsi inti produksi patut ditelaah lebih dalam karena berpotensi memunculkan klaim hubungan kerja langsung." },
      { name: "Marimekko Chart — Komposisi Biaya SDM per Unit", svg: () => bars({ labels: ["Produksi", "Distribusi", "Kantor"], series: [{ name: "Upah pokok", data: [55, 50, 60] }, { name: "Tunjangan", data: [25, 30, 25] }, { name: "Lembur", data: [20, 20, 15] }], stacked: true, pct: true }), an: "Bagan Marimekko menampilkan struktur biaya sumber daya manusia per unit kerja dalam proporsi. Komponen lembur yang mencapai seperlima biaya di unit produksi adalah bendera kuning: lembur yang membesar secara struktural sering menandakan kekurangan formasi, dan setiap jam lemburnya wajib dibayar sesuai formula peraturan pengupahan dengan batas maksimal jam lembur yang ditetapkan peraturan. Pelanggaran batas lembur tergolong pelanggaran yang dapat berujung sanksi, sekaligus indikator risiko keselamatan kerja." },
      { name: "Lollipop Chart — Skor Kepatuhan per Departemen", svg: () => { const labels = ["Produksi", "Distribusi", "Keuangan", "Legal", "SDM"]; const data = [72, 78, 88, 93, 81]; let out2 = svgOpen(640, 240) + axis(640, 240, 60, 30); labels.forEach((l, i) => { const x = 110 + i * 110, y = 210 - data[i] * 1.9; out2 += `<line x1="${x}" y1="210" x2="${x}" y2="${y}" stroke="${NAVY}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="9" fill="${GOLD}"/>` + txt(x, y - 14, String(data[i]), 10, NAVY, "middle", true) + txt(x, 226, l, 9, "#333", "middle"); }); return out2 + "</svg>"; }, an: "Grafik permen tangkai meringkas skor kepatuhan administrasi kepegawaian per departemen. Departemen legal memimpin dengan sembilan puluh tiga, sementara produksi tertinggal pada tujuh puluh dua. Kesenjangan dua puluh satu poin ini menunjuk lokasi risiko ketenagakerjaan paling mungkin meledak: berkas kontrak yang tidak lengkap di lini produksi adalah bahan baku klasik gugatan pengadilan hubungan industrial. Program percepatan kelengkapan berkas di produksi selayaknya menjadi kondisi pendahuluan penutupan transaksi." },
      { name: "Dot Plot — Rata-rata Masa Kerja per Departemen", svg: () => { const labels = ["Produksi", "Distribusi", "Keuangan", "Legal", "SDM"]; const data = [3.2, 4.1, 5.6, 6.2, 4.8]; let out2 = svgOpen(640, 210); labels.forEach((l, i) => { const y = 30 + i * 36; out2 += txt(0, y + 4, l, 10) + `<line x1="140" y1="${y}" x2="600" y2="${y}" stroke="#EEE"/><circle cx="${140 + data[i] * 65}" cy="${y}" r="7" fill="${NAVY}"/>` + txt(140 + data[i] * 65 + 14, y + 4, `${data[i]} thn`, 9.5); }); return out2 + "</svg>"; }, an: "Plot titik rata-rata masa kerja menunjukkan retensi terkuat pada fungsi legal dan keuangan serta perputaran tercepat di produksi. Perputaran tinggi memperbesar frekuensi peristiwa hukum akhir hubungan kerja: pembayaran kompensasi PKWT, pengembalian barang inventaris, dan potensi perselisihan hak. Setiap peristiwa tersebut meninggalkan jejak administratif yang diuji dalam pemeriksaan ini; departemen dengan perputaran tertinggi sepatutnya mendapat prosedur pengakhiran hubungan kerja yang paling terstandar." },
      { name: "Dumbbell Chart — Upah Minimum vs Rata-rata Aktual", svg: () => { const rows = [["Produksi", 47, 62], ["Distribusi", 47, 66], ["Kantor", 47, 78]] as const; let out2 = svgOpen(640, 190); rows.forEach(([l, a, b], i) => { const y = 40 + i * 46, x1 = 140 + (a as number) * 5, x2 = 140 + (b as number) * 5; out2 += txt(0, y + 4, l as string, 10) + `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#BBB" stroke-width="3"/><circle cx="${x1}" cy="${y}" r="7" fill="${RED}"/><circle cx="${x2}" cy="${y}" r="7" fill="${GREEN}"/>` + txt(x2 + 14, y + 4, `UMP ${a} → aktual ${b}`, 9); }); return out2 + "</svg>"; }, an: "Grafik halter membandingkan titik upah minimum dengan rata-rata upah aktual per kelompok. Jarak halter yang positif di seluruh kelompok mengonfirmasi kepatuhan terhadap larangan membayar di bawah upah minimum, salah satu larangan paling keras dalam hukum pengupahan Indonesia. Namun jarak tertipis pada unit produksi menyisakan bantalan yang sempit terhadap kenaikan upah minimum tahun berikutnya; simulasi kenaikan perlu dimasukkan ke proyeksi biaya pasca-transaksi." },
      { name: "Slope Chart — Perubahan Skor Kepatuhan Dua Periode", svg: () => { const rows = [["Produksi", 61, 72], ["Distribusi", 70, 78], ["Keuangan", 85, 88], ["Legal", 90, 93]] as const; let out2 = svgOpen(640, 250); out2 += txt(180, 24, "Semester I", 10.5, "#666", "middle") + txt(460, 24, "Semester II", 10.5, "#666", "middle"); rows.forEach(([l, a, b], i) => { const y1 = 230 - (a as number) * 2, y2 = 230 - (b as number) * 2; out2 += `<line x1="180" y1="${y1}" x2="460" y2="${y2}" stroke="${PAL[i]}" stroke-width="2.4"/><circle cx="180" cy="${y1}" r="5" fill="${PAL[i]}"/><circle cx="460" cy="${y2}" r="5" fill="${PAL[i]}"/>` + txt(470, y2 + 4, `${l} (${a}→${b})`, 9.5); }); return out2 + "</svg>"; }, an: "Grafik lereng menghubungkan skor kepatuhan dua semester dengan satu garis per departemen. Seluruh garis menanjak, memperlihatkan perbaikan menyeluruh, dengan kemiringan tertajam di produksi. Tren perbaikan yang terdokumentasi seperti ini bernilai hukum: dalam perkara administratif, riwayat perbaikan sukarela lazim menjadi faktor peringan, dan bagi calon investor menjadi bukti budaya kepatuhan yang berjalan, bukan sekadar kepatuhan di atas kertas." },
      { name: "Bump Chart — Peringkat Departemen dari Waktu ke Waktu", svg: () => { const series = [["Legal", [1, 1, 1, 1]], ["Keuangan", [2, 2, 3, 2]], ["SDM", [4, 3, 2, 3]], ["Distribusi", [3, 4, 4, 4]], ["Produksi", [5, 5, 5, 5]]] as const; let out2 = svgOpen(640, 250); series.forEach(([l, ranks], i) => { const pts = (ranks as readonly number[]).map((rk, k) => `${140 + k * 130},${30 + (rk - 1) * 44}`).join(" "); out2 += `<polyline points="${pts}" fill="none" stroke="${PAL[i]}" stroke-width="2.6" opacity="0.85"/>` + txt(60, 34 + (ranks[0] - 1) * 44, l as string, 9.5); (ranks as readonly number[]).forEach((rk, k) => { out2 += `<circle cx="${140 + k * 130}" cy="${30 + (rk - 1) * 44}" r="6" fill="${PAL[i]}"/>`; }); }); ["Q1", "Q2", "Q3", "Q4"].forEach((q, k) => { out2 += txt(140 + k * 130, 246, q, 9.5, "#666", "middle"); }); return out2 + "</svg>"; }, an: "Grafik benturan melacak perubahan peringkat kepatuhan antar departemen sepanjang empat triwulan. Kestabilan legal di puncak dan produksi di dasar selama empat periode berturut menunjukkan bahwa kesenjangan bukan fluktuasi musiman melainkan struktural. Temuan struktural menuntut jawaban struktural: penempatan personel kepatuhan khusus di lini produksi, bukan sekadar surat edaran. Pembeli yang cermat akan menjadikan realisasi langkah ini sebagai kovenapasca-penutupan." },
      { name: "Ribbon Chart — Dinamika Komposisi Peringkat", svg: () => lines({ series: [{ name: "Legal", data: [30, 32, 33, 35] }, { name: "Keuangan", data: [26, 27, 25, 28] }, { name: "SDM", data: [20, 22, 24, 23] }], stacked: true, labels: ["Q1", "Q2", "Q3", "Q4"] }), an: "Bagan pita menumpuk kontribusi skor tiap fungsi dari waktu ke waktu sehingga perubahan komposisi dan totalnya terbaca serentak. Total pita yang melebar menandakan kapasitas kepatuhan organisasi tumbuh; pita SDM yang menebal paling cepat mencerminkan efek program pembenahan administrasi kepegawaian semester berjalan. Visual ini berguna bagi Direksi untuk mempertanggungjawabkan pelaksanaan tugas pengurusan dan pengawasan kepatuhan yang melekat padanya menurut doktrin fiduciary duty dalam undang-undang perseroan." },
      { name: "Word Cloud — Frekuensi Istilah pada Rekam Hukum", svg: () => wordCloud(), an: "Awan kata merangkum istilah yang paling sering muncul pada seluruh rekam hukum perseroan. Dominasi kata wanprestasi, perjanjian, dan somasi memetakan pusat gravitasi persoalan hukum ke ranah kontraktual, bukan pidana atau administratif, profil risiko yang relatif sehat bagi perusahaan niaga. Meski demikian, kemunculan istilah pesangon dan PKWT pada ukuran menengah mengingatkan bahwa isu ketenagakerjaan tetap hidup di bawah permukaan dan menuntut pemantauan berkala melalui dasbor kepatuhan." },
    ],
  },
  {
    title: "Perizinan, Kepatuhan, dan Pemantauan Kewajiban",
    intro: "Bagian ini memvisualkan denyut kepatuhan perseroan: lini masa perizinan, kalender kewajiban, kinerja pemenuhan tenggat, serta indikator pengendalian proses. Kerangka utamanya Peraturan Pemerintah Nomor 5 Tahun 2021 tentang Perizinan Berusaha Berbasis Risiko beserta peraturan sektoral, dengan prinsip bahwa setiap tenggat yang terlewat adalah peristiwa hukum yang melahirkan risiko sanksi.",
    charts: [
      { name: "Timeline Chart — Lini Masa Perizinan Kunci", svg: () => { const ev = [["2019", "Pendirian PT"], ["2020", "NIB terbit"], ["2021", "Sertifikat Standar"], ["2023", "Izin lingkungan"], ["2025", "Perpanjangan halal"], ["2026", "Audit LDD"]] as const; let out2 = svgOpen(640, 150); out2 += `<line x1="40" y1="75" x2="600" y2="75" stroke="${GOLD}" stroke-width="3"/>`; ev.forEach(([y, l], i) => { const x = 60 + i * 105; out2 += `<circle cx="${x}" cy="75" r="8" fill="${NAVY}"/>` + txt(x, i % 2 ? 108 : 52, l as string, 9, "#333", "middle") + txt(x, i % 2 ? 122 : 38, y as string, 8.5, GOLD, "middle", true); }); return out2 + "</svg>"; }, an: "Lini masa perizinan menyusun peristiwa perizinan kunci sejak pendirian hingga audit ini. Kesinambungan titik-titik tanpa celah panjang menandakan tidak adanya periode operasi tanpa izin, hal yang wajib dipastikan karena operasi pada masa kekosongan izin dapat dikualifikasi sebagai kegiatan tanpa perizinan berusaha dengan segala sanksinya. Pemeriksa mengonfirmasi tiap titik dengan dokumen sumber di vault; titik yang hanya didukung pernyataan lisan diturunkan bobot pembuktiannya dalam penilaian." },
      { name: "Gantt Chart — Jadwal Proyek Remediasi Temuan", svg: () => gantt(), an: "Bagan Gantt ini menjadwalkan proyek remediasi temuan dalam sembilan minggu, dari persiapan ruang data hingga penandatanganan laporan final. Ketergantungan antar batang tersusun agar telaah tiap aspek rampung sebelum konfirmasi manajemen, mencegah temuan susulan pasca-konfirmasi yang dapat menggugurkan pernyataan kelengkapan pengungkapan (full disclosure representation). Jadwal ini selayaknya dilampirkan pada perjanjian transaksi sebagai peta jalan pemenuhan kondisi pendahuluan." },
      { name: "Calendar Heatmap — Intensitas Tenggat Kewajiban Harian", svg: () => calendarHeat(), an: "Peta panas kalender mewarnai tiap hari menurut jumlah tenggat kewajiban yang jatuh pada hari itu. Blok merah yang berkerumun di akhir bulan mencerminkan penumpukan kewajiban pelaporan bulanan: pajak masa, iuran BPJS, dan laporan berkala lain. Penumpukan adalah risiko operasional dengan akibat hukum: satu hari keterlambatan pada beberapa kewajiban sekaligus melipatgandakan denda administratif. Rekomendasi: distribusi ulang beban kerja tim kepatuhan menjelang tanggal padat dan otomasi pengingat H-7 serta H-1 melalui fungsi JAGA." },
      { name: "Heatmap — Matriks Kepatuhan Aspek vs Kuartal", svg: () => matrix(["Korporasi", "Izin", "Naker", "Pajak"], "heat"), an: "Matriks panas menyilangkan aspek kepatuhan dengan kuartal dan mewarnainya menurut skor. Sel bernilai rendah yang mengelompok pada kolom kuartal tertentu mengarah pada penyebab musiman, misalnya keterlambatan pelaporan pasca-libur panjang, sedangkan baris yang konsisten pucat menunjuk kelemahan menetap pada satu aspek. Diferensiasi diagnosis semacam ini menentukan resep hukumnya: perbaikan prosedur kalender untuk masalah musiman, restrukturisasi penanggung jawab untuk kelemahan menetap." },
      { name: "Gauge Chart — Skor Kepatuhan Keseluruhan", svg: () => gauge(79, "Skor kepatuhan gabungan"), an: "Pengukur setengah lingkaran menampilkan skor kepatuhan gabungan tujuh puluh sembilan persen, berada pada zona kuning menuju hijau. Skor ini adalah agregat tertimbang enam aspek pemeriksaan dengan rumus yang diuraikan pada bab metodologi, bukan angka subjektif. Penting dicatat batas penggunaannya: skor agregat berguna sebagai indikator arah, namun keputusan hukum atas transaksi harus kembali pada temuan individual, sebab satu temuan berisiko tinggi tidak dapat dikompensasi oleh rata-rata yang baik." },
      { name: "Speedometer Chart — Kecepatan Penutupan Temuan", svg: () => gauge(64, "Temuan ditutup tepat waktu", true), an: "Spidometer menunjukkan enam puluh empat persen temuan ditutup dalam tenggat yang dijanjikan manajemen. Jarum yang belum menyentuh zona hijau menandakan kapasitas remediasi masih di bawah komitmen, informasi yang material bagi penjadwalan kondisi pendahuluan transaksi: janji penutupan temuan sebaiknya diberi tenggat realistis berdasar kecepatan historis ini, bukan target aspirasional, agar tidak melahirkan cidera janji kondisi yang membuka hak pembatalan bagi pihak lawan." },
      { name: "Progress Ring — Kemajuan Tiga Program Kepatuhan", svg: () => bulletKpi("progress"), an: "Tiga cincin kemajuan merangkum program kelengkapan dokumen, verifikasi advokat, dan tindak lanjut temuan. Verifikasi advokat yang baru empat puluh lima persen adalah leher botol yang disengaja: sistem mensyaratkan telaah advokat sebelum dokumen berstatus terverifikasi guna menjaga standar profesi. Percepatan dapat ditempuh dengan menambah alokasi jam advokat, bukan dengan melonggarkan standar verifikasi, sebab dokumen terverifikasi inilah yang kelak menopang pernyataan dan jaminan dalam perjanjian transaksi." },
      { name: "KPI Card — Empat Metrik Utama Kepatuhan", svg: () => bulletKpi("kpi"), an: "Empat kartu indikator menyajikan metrik paling material dalam satu pandangan: skor kepatuhan, jumlah temuan berisiko tinggi, volume dokumen di vault, dan hari menuju tenggat terdekat. Kartu tenggat terdekat empat belas hari menuntut tindakan paling segera; dalam hukum administratif tidak dikenal toleransi keterlambatan substantif, dan denda berjalan otomatis sejak hari pertama. Kartu-kartu ini diperbarui langsung dari basis data sehingga Direksi dapat memantau posisi hukum perseroan secara harian." },
      { name: "Bullet Chart — Target vs Aktual Tiga Kewajiban", svg: () => bulletKpi("bullet"), an: "Bagan peluru membandingkan capaian aktual terhadap garis target pada tiga kewajiban kunci. Kepesertaan BPJS melampaui delapan puluh persen namun belum menyentuh target seratus persen yang memang menjadi satu-satunya angka yang sah menurut undang-undang, sebab kepesertaan jaminan sosial tidak mengenal pemenuhan sebagian. Visual ini menegaskan bahwa untuk kewajiban yang bersifat mutlak, satu-satunya target yang dapat diterima adalah pemenuhan penuh." },
      { name: "Control Chart — Kendali Waktu Proses Perizinan", svg: () => { let out2 = svgOpen(640, 260) + axis(640, 260, 60, 30); const r = rnd(81); const mean = 140; out2 += `<line x1="60" y1="${230 - mean * 0.8}" x2="620" y2="${230 - mean * 0.8}" stroke="${GREEN}" stroke-dasharray="6 4"/><line x1="60" y1="${230 - (mean + 55) * 0.8}" x2="620" y2="${230 - (mean + 55) * 0.8}" stroke="${RED}" stroke-dasharray="6 4"/><line x1="60" y1="${230 - (mean - 55) * 0.8}" x2="620" y2="${230 - (mean - 55) * 0.8}" stroke="${RED}" stroke-dasharray="6 4"/>`; const pts: string[] = []; for (let i = 0; i < 14; i++) { const v = mean + (r() - 0.5) * 90 + (i === 9 ? 60 : 0); pts.push(`${80 + i * 39},${230 - v * 0.8}`); } out2 += `<polyline points="${pts.join(" ")}" fill="none" stroke="${NAVY}" stroke-width="2"/>`; pts.forEach((p, i) => { const [x, y] = p.split(",").map(Number); out2 += `<circle cx="${x}" cy="${y}" r="4.5" fill="${i === 9 ? RED : NAVY}"/>`; }); return out2 + txt(70, 20, "Garis hijau: rerata · merah: batas kendali atas/bawah (hari proses)", 9.5, "#666"); }, an: "Peta kendali memantau lama proses pengurusan izin terhadap batas kendali statistik. Satu titik merah menembus batas atas: pengurusan yang memakan waktu jauh melampaui kelaziman. Titik pencilan seperti ini wajib diinvestigasi akar penyebabnya, sebab keterlambatan pengurusan yang tidak wajar kadang menyembunyikan persoalan substantif pada berkas atau, lebih buruk, praktik tidak patut yang berisiko pidana korupsi bagi semua pihak yang terlibat. Dokumentasi korespondensi resmi selama periode pencilan telah diminta kepada manajemen." },
      { name: "Run Chart — Tren Jumlah Kewajiban Terbuka", svg: () => lines({ series: [{ name: "Kewajiban terbuka", data: [14, 12, 13, 9, 8, 6, 7, 4] }], labels: ["Q1", "Q2", "Q3", "Q4", "Q1", "Q2", "Q3", "Q4"] }), an: "Grafik larian melacak jumlah kewajiban terbuka dari triwulan ke triwulan dan memperlihatkan tren menurun dari empat belas menjadi empat. Penurunan yang nyaris monoton menandakan proses kepatuhan yang membaik secara sistemis, bukan kebetulan. Kenaikan kecil pada dua titik antara patut dijelaskan; keterangan manajemen menyebut penambahan kewajiban baru akibat perubahan regulasi, alasan yang sah dan justru menunjukkan sistem berhasil menangkap kewajiban baru alih-alih melewatkannya." },
      { name: "Pareto Chart — Konsentrasi Jenis Temuan", svg: () => histo([34, 22, 15, 9, 6, 4], true), an: "Analisis Pareto menyusun jenis temuan dari yang terbanyak dengan kurva kumulatifnya. Dua kategori teratas, perizinan dan kepesertaan BPJS, menyumbang lebih dari separuh seluruh temuan, membenarkan prinsip delapan puluh dua puluh: menuntaskan dua kategori itu menghapus mayoritas persoalan. Strategi remediasi yang berbasis Pareto ini lebih dipertanggungjawabkan secara biaya dibanding menyapu semua kategori sekaligus, dan lazim diterima pembeli sebagai pendekatan yang wajar dalam negosiasi jadwal pemenuhan." },
      { name: "Error Bar Chart — Estimasi Kewajiban dengan Rentang Ketidakpastian", svg: () => { const rows = [["Pesangon", 180, 40], ["Kompensasi PKWT", 90, 25], ["Denda pajak", 45, 30], ["Perkara", 70, 55]] as const; let out2 = svgOpen(640, 260) + axis(640, 260, 60, 34); rows.forEach(([l, v, e], i) => { const x = 130 + i * 130, y = 226 - (v as number) * 0.8; out2 += `<rect x="${x - 30}" y="${y}" width="60" height="${(v as number) * 0.8}" fill="${NAVY}" opacity="0.8"/><line x1="${x}" y1="${y - (e as number) * 0.8}" x2="${x}" y2="${y + (e as number) * 0.8}" stroke="${RED}" stroke-width="2"/><line x1="${x - 10}" y1="${y - (e as number) * 0.8}" x2="${x + 10}" y2="${y - (e as number) * 0.8}" stroke="${RED}" stroke-width="2"/><line x1="${x - 10}" y1="${y + (e as number) * 0.8}" x2="${x + 10}" y2="${y + (e as number) * 0.8}" stroke="${RED}" stroke-width="2"/>` + txt(x, 244, l as string, 9, "#333", "middle"); }); return out2 + txt(70, 18, "Estimasi juta rupiah · garis merah = rentang ketidakpastian", 9.5, "#666"); }, an: "Grafik batang galat menyajikan estimasi nilai tiap kelompok kewajiban kontinjensi beserta rentang ketidakpastiannya. Rentang terlebar melekat pada pos perkara, mencerminkan hakikat litigasi yang hasilnya tidak dapat dipastikan; standar akuntansi mengizinkan pengungkapan tanpa pencadangan bila arus keluar belum probable, namun uji tuntas yang jujur tetap menampilkan rentang penuh agar pembeli dapat menetapkan sendiri selera risikonya, misalnya melalui mekanisme penahanan sebagian harga (holdback) sebesar batas atas rentang." },
      { name: "Variance Chart — Selisih Anggaran vs Realisasi Biaya Kepatuhan", svg: () => bars({ labels: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Anggaran", data: [50, 50, 55, 60] }, { name: "Realisasi", data: [46, 58, 52, 71] }] }), an: "Bagan varians membandingkan anggaran dan realisasi biaya kepatuhan per triwulan. Lonjakan realisasi pada triwulan keempat melampaui anggaran sekitar delapan belas persen, dipicu percepatan remediasi menjelang uji tuntas ini. Dari sisi tata kelola, pelampauan anggaran untuk kepatuhan adalah pengeluaran yang paling mudah dipertanggungjawabkan Direksi, namun tetap memerlukan persetujuan sesuai anggaran dasar bila melampaui ambang kewenangan; risalah persetujuannya telah diminta untuk melengkapi ruang data." },
      { name: "Waterfall Chart — Jembatan Perubahan Skor Kepatuhan", svg: () => waterfall(), an: "Bagan air terjun menguraikan perjalanan skor kepatuhan dari enam puluh dua menjadi tujuh puluh sembilan melalui kontribusi tiap inisiatif: pelengkapan kontrak, pendaftaran BPJS, dan perpanjangan merek menambah poin, sementara satu izin kedaluwarsa menggerus sembilan poin. Dekomposisi ini membuat setiap poin skor dapat diaudit ke peristiwa hukumnya, menjadikan skor bukan kotak hitam melainkan ringkasan aritmetika dari fakta yang dapat diverifikasi, prinsip transparansi yang menjadi pembeda metodologi laporan ini." },
      { name: "Funnel Chart — Corong Pemenuhan Permintaan Dokumen", svg: () => funnel(), an: "Corong pemenuhan dokumen memperlihatkan atrisi dari seratus persen dokumen diminta menjadi empat puluh satu persen bebas temuan. Penyempitan terbesar terjadi antara diterima dan lolos verifikasi, menandakan persoalan bukan pada ketersediaan dokumen melainkan kualitasnya: tanda tangan tidak lengkap, meterai kurang, atau masa berlaku habis. Peta atrisi ini mengarahkan program perbaikan pada titik yang tepat, yaitu standar kualitas dokumen saat dibuat, bukan sekadar kelengkapan arsip." },
      { name: "Pyramid Chart — Piramida Tata Kelola", svg: () => funnel(true), an: "Piramida tata kelola menyusun lapisan pengambil keputusan dari pemegang saham hingga staf pelaksana. Bentuk piramida yang sehat melebar ke bawah; setiap keputusan strategis mengalir turun melalui delegasi yang terdokumentasi. Pemeriksaan menaruh perhatian pada surat kuasa dan matriks kewenangan antar lapisan: perbuatan hukum oleh lapisan bawah tanpa delegasi sah dapat dibatalkan atau menjadi tanggung jawab pribadi penandatangannya, doktrin ultra vires yang tetap hidup dalam praktik peradilan Indonesia." },
      { name: "Radar Chart — Profil Kepatuhan vs Target Enam Aspek", svg: () => radar(false), an: "Bagan radar menampilkan profil kepatuhan aktual terhadap target pada enam sumbu aspek hukum. Bentuk poligon aktual yang menciut pada sumbu ketenagakerjaan dan perizinan menunjukkan dua front prioritas, konsisten dengan analisis Pareto sebelumnya. Kekuatan visual radar terletak pada kemampuannya memperlihatkan ketimpangan profil: perseroan yang unggul di lima sumbu tetap dapat gagal transaksi karena satu sumbu yang cekung, sebagaimana satu syarat pendahuluan yang tak terpenuhi menahan seluruh penutupan." },
      { name: "Spider Chart — Profil Kompetensi Tim Kepatuhan", svg: () => radar(true), an: "Bagan laba-laba memetakan kompetensi tim kepatuhan internal pada enam dimensi keahlian. Profil menunjukkan kekuatan pada administrasi korporasi dan kontrak, dengan cekungan pada litigasi, wajar untuk tim in-house yang memang merujuk perkara ke advokat eksternal. Ketergantungan pada penasihat eksternal ini sepatutnya diformalkan dalam perjanjian jasa hukum dengan cakupan dan waktu respons yang terukur, sehingga hak perseroan atas pendampingan tidak bergantung pada hubungan informal." },
      { name: "Polar Area Chart — Beban Kewajiban per Bulan", svg: () => pie([{ l: "Jan-Mar", v: 8 }, { l: "Apr-Jun", v: 12 }, { l: "Jul-Sep", v: 6 }, { l: "Okt-Des", v: 15 }], 0, true), an: "Bagan area polar membagi beban kewajiban menurut triwulan dengan jari-jari sebanding volume. Kuartal akhir tahun tampil paling gemuk, ditumpuk kewajiban pelaporan tahunan: laporan keuangan, pajak tahunan, dan pembaruan data korporasi. Antisipasi hukumnya sederhana namun sering diabaikan: penunjukan auditor dan penyiapan RUPS tahunan dimulai sejak kuartal ketiga, karena keterlambatan RUPS tahunan melewati batas enam bulan sejak tutup buku merupakan pelanggaran langsung atas undang-undang perseroan." },
    ],
  },
  {
    title: "Keuangan, Nilai Aset, dan Dinamika Eksposur",
    intro: "Bagian ini menyajikan dimensi kuantitatif dari posisi hukum: pergerakan nilai aset terdaftar, dinamika eksposur kewajiban, dan sensitivitas terhadap skenario risiko. Visual finansial di sini dibaca dalam kacamata hukum, yakni sebagai ukuran dampak dari peristiwa hukum, bukan sebagai analisis investasi.",
    charts: [
      { name: "Line Chart — Tren Nilai Aset Terdaftar", svg: () => lines({ series: [{ name: "Nilai aset (miliar Rp)", data: [14, 16, 19, 23, 25] }], labels: THN }), an: "Garis tunggal ini melacak nilai aset terdaftar yang tumbuh dari empat belas menjadi dua puluh lima miliar rupiah dalam lima tahun. Bagi pemeriksa hukum, setiap kenaikan kurva harus berpasangan dengan peristiwa hukum perolehan yang sah: akta jual beli, berita acara serah terima, atau bukti kapitalisasi. Kenaikan nilai tanpa dokumen perolehan adalah bendera merah klasik yang dapat mengindikasikan pencatatan aset pihak lain atau perolehan yang belum sempurna secara hukum, misalnya tanah yang belum balik nama." },
      { name: "Multiple Line Chart — Aset vs Kewajiban Kontinjensi", svg: () => lines({ series: [{ name: "Aset", data: [14, 16, 19, 23, 25] }, { name: "Kewajiban kontinjensi", data: [3, 4, 3.4, 2.8, 2.2] }], labels: THN }), an: "Dua garis yang bergerak berlawanan arah, aset menanjak sementara kewajiban kontinjensi menurun, membentuk gunting yang melebar: posisi solvabilitas hukum yang menguat. Rasio kewajiban kontinjensi terhadap aset yang turun di bawah sepuluh persen menempatkan perseroan pada posisi tawar yang baik dalam negosiasi jaminan; pembeli lazimnya menuntut eskro atau penahanan harga sebesar kelipatan tertentu dari kewajiban kontinjensi, sehingga setiap penurunannya langsung mengefisienkan struktur transaksi." },
      { name: "Area Chart — Volume Dokumen Tervalidasi", svg: () => lines({ series: [{ name: "Dokumen tervalidasi", data: [20, 34, 51, 78, 128] }], labels: THN, area: true }), an: "Grafik area menegaskan volume kumulatif dokumen tervalidasi yang melonjak menjadi seratus dua puluh delapan pada tahun berjalan. Luas area di bawah kurva dapat dibaca sebagai akumulasi modal pembuktian perseroan: setiap dokumen tervalidasi adalah amunisi siap pakai untuk pembuktian di pengadilan, dukungan restrukturisasi kredit, maupun kelengkapan ruang data transaksi. Lonjakan tahun terakhir berkorelasi langsung dengan implementasi sistem Corplex, menunjukkan nilai institusionalisasi dokumentasi." },
      { name: "Stacked Area Chart — Komposisi Nilai Aset dari Waktu ke Waktu", svg: () => lines({ series: [{ name: "Tanah & bangunan", data: [9, 10, 12, 14, 15] }, { name: "Mesin & kendaraan", data: [4, 4.5, 5, 6.5, 7] }, { name: "HKI & lainnya", data: [1, 1.5, 2, 2.5, 3] }], labels: THN, stacked: true }), an: "Area bertumpuk memperlihatkan komposisi nilai aset yang stabil didominasi tanah dan bangunan, dengan lapisan kekayaan intelektual yang menebal perlahan. Pergeseran gradual menuju aset tak berwujud menuntut evolusi praktik hukum yang menyertainya: dari pengurusan sertipikat dan hak tanggungan menuju pendaftaran merek, perjanjian lisensi, dan perlindungan rahasia dagang. Tim hukum yang hanya fasih pada aset berwujud akan tertinggal dari komposisi kekayaan kliennya sendiri." },
      { name: "Step Line Chart — Perubahan Kuota Verifikasi", svg: () => lines({ series: [{ name: "Kuota verifikasi advokat", data: [5, 5, 8, 8, 12] }], labels: THN, step: true }), an: "Garis tangga mencatat perubahan kuota verifikasi advokat yang naik dalam dua lompatan diskrit, mengikuti amendemen perjanjian layanan hukum. Bentuk tangga menegaskan sifat hukum perubahan ini: hak kontraktual tidak berubah gradual melainkan pada titik amendemen ditandatangani. Pemeriksa memastikan setiap anak tangga berpasangan dengan addendum tertulis yang sah, sebab praktik menaikkan layanan tanpa amendemen tertulis melahirkan sengketa penagihan yang tidak perlu." },
      { name: "Spline Chart — Tren Skor Kesehatan Hukum (Halus)", svg: () => lines({ series: [{ name: "Skor kesehatan hukum", data: [58, 61, 66, 72, 79] }], labels: THN, smooth: true }), an: "Kurva halus skor kesehatan hukum menanjak konsisten tanpa satu pun periode penurunan. Konsistensi arah lebih bermakna daripada besaran: perbaikan yang berkelanjutan menandakan sistem manajemen kepatuhan yang bekerja, bukan proyek kosmetik menjelang transaksi. Pembeli yang skeptis lazim menguji hal ini dengan meminta data historis mentah; arsitektur Corplex yang menyimpan riwayat perubahan per rekam memungkinkan pembuktian tersebut tanpa rekonstruksi manual." },
      { name: "Sparkline — Tren Mini Enam Indikator", svg: () => { const rows = [["Skor kepatuhan", [58, 61, 66, 72, 79]], ["Temuan terbuka", [14, 12, 9, 7, 4]], ["Dokumen vault", [20, 34, 51, 78, 128]], ["Perkara aktif", [2, 3, 2, 1, 1]], ["Izin aktif", [4, 5, 6, 6, 7]], ["Karyawan", [61, 74, 82, 90, 96]]] as const; let out2 = svgOpen(640, 230); rows.forEach(([l, data], i) => { const y0 = 20 + i * 36; const max = Math.max(...(data as readonly number[])); const pts = (data as readonly number[]).map((v, k) => `${330 + k * 60},${y0 + 22 - (v / max) * 20}`).join(" "); out2 += txt(0, y0 + 16, l as string, 10.5) + `<polyline points="${pts}" fill="none" stroke="${NAVY}" stroke-width="2"/>` + txt(340 + 4 * 60 + 14, y0 + 16, String((data as readonly number[])[4]), 10.5, GOLD, "start", true); }); return out2 + "</svg>"; }, an: "Deret sparkline memadatkan lima tahun pergerakan enam indikator ke dalam satu panel ringkas. Formatnya meniru praktik dasbor Direksi modern: cukup arah dan angka akhir untuk pengambilan keputusan cepat, dengan rincian tersedia satu klik di bawahnya. Dari enam garis mini, hanya perkara aktif yang mendatar; lima lainnya bergerak ke arah yang dikehendaki, ringkasan sehat yang membingkai keseluruhan bab visual laporan ini." },
      { name: "Stream Graph — Aliran Komposisi Kegiatan Hukum", svg: () => lines({ series: [{ name: "Kontrak", data: [8, 11, 9, 13, 15] }, { name: "Perizinan", data: [5, 6, 8, 7, 9] }, { name: "Litigasi", data: [3, 2, 4, 2, 2] }], labels: THN, stacked: true, smooth: true }), an: "Grafik arus memperlihatkan denyut komposisi kegiatan hukum perseroan yang mengalir antar tahun: pekerjaan kontraktual melebar, litigasi menyempit. Sungai litigasi yang menipis mengonfirmasi strategi penyelesaian sengketa di hulu melalui klausul mediasi dan arbitrase yang kini dibakukan pada kontrak-kontrak baru. Aliran ini juga menjadi dasar penganggaran jasa hukum: alokasi bergeser dari biaya berperkara yang reaktif menuju biaya penyusunan kontrak yang preventif, pergeseran yang sehat secara tata kelola." },
      { name: "Candlestick Chart — Fluktuasi Estimasi Nilai Sengketa", svg: () => candles("candle"), an: "Grafik lilin, yang lazim dipakai untuk harga saham, di sini diadaptasi untuk memvisualkan fluktuasi estimasi nilai total sengketa per periode telaah: badan lilin menunjukkan estimasi awal dan akhir periode, sumbunya rentang tertinggi terendah. Lilin merah panjang pada pertengahan grafik menandai periode ketika gugatan baru masuk sebelum akhirnya dinilai lemah dan estimasi diturunkan. Kejujuran menampilkan fluktuasi ini penting: estimasi sengketa memang bergerak, dan pembeli berhak melihat volatilitasnya, bukan hanya angka akhir yang tenang." },
      { name: "OHLC Chart — Rentang Estimasi Kewajiban per Kuartal", svg: () => candles("ohlc"), an: "Varian OHLC menyajikan data yang sama dengan penekanan pada titik buka dan tutup tiap periode melalui takik kiri kanan. Format ini disukai analis karena rapi pada deret panjang. Pembacaan hukumnya identik dengan grafik lilin: rentang yang menyempit dari kiri ke kanan menandakan ketidakpastian kewajiban yang kian terkendali seiring perkara-perkara lama mencapai putusan berkekuatan hukum tetap dan digantikan oleh sedikit perkara baru bernilai kecil." },
      { name: "Kagi Chart — Arah Besar Eksposur Litigasi", svg: () => candles("kagi"), an: "Grafik Kagi menyaring kebisingan fluktuasi kecil dan hanya berbelok ketika perubahan melampaui ambang, sehingga yang tersisa adalah arah besar eksposur litigasi. Garis yang didominasi segmen menurun sejak pertengahan menegaskan deeskalasi eksposur secara struktural. Bagi komite audit, format ini berguna sebagai alarm arah: belokan naik pertama setelah deret turun panjang adalah sinyal dini yang menuntut rapat khusus, jauh sebelum nilai nominalnya menjadi material." },
      { name: "Renko Chart — Bata Perubahan Skor Risiko", svg: () => candles("renko"), an: "Grafik Renko menyusun bata yang hanya terbentuk saat skor risiko bergeser melewati ambang tetap, hijau untuk perbaikan dan merah untuk pemburukan. Barisan bata hijau yang dominan dengan sisipan merah sporadis menggambarkan proses perbaikan yang sesekali terganggu peristiwa baru, pola yang realistis bagi organisasi hidup. Ambang bata dapat ditera ulang sesuai selera risiko Direksi; yang penting secara tata kelola adalah konsistensi ambang antar periode agar grafik tidak dapat dikosmetikkan." },
      { name: "Combo Chart — Volume Rekam dan Skor dalam Satu Panel", svg: () => { const W2 = 640, H2 = 300, B2 = 34; let out2 = svgOpen() + axis(W2, H2, 60, B2); const bars2 = [12, 19, 25, 33, 41], line2 = [58, 61, 66, 72, 79]; bars2.forEach((v, i) => { out2 += `<rect x="${86 + i * 108}" y="${H2 - B2 - v * 5.2}" width="52" height="${v * 5.2}" fill="${NAVY}" opacity="0.75"/>` + txt(112 + i * 108, H2 - B2 + 14, THN[i], 9, "#333", "middle"); }); const pts = line2.map((v, i) => `${112 + i * 108},${H2 - B2 - v * 2.6}`).join(" "); out2 += `<polyline points="${pts}" fill="none" stroke="${GOLD}" stroke-width="3"/>`; line2.forEach((v, i) => { out2 += `<circle cx="${112 + i * 108}" cy="${H2 - B2 - v * 2.6}" r="5" fill="${GOLD}"/>`; }); return out2 + txt(70, 16, "Batang: jumlah rekam · Garis emas: skor kepatuhan", 9.5, "#666"); }, an: "Bagan kombinasi menumpangkan garis skor kepatuhan di atas batang volume rekam, membantah hipotesis bahwa skor membaik sekadar karena pembagi membesar: skor naik justru ketika volume rekam, dan dengan demikian permukaan risiko yang diperiksa, bertambah tiga kali lipat. Perbaikan pada basis pemeriksaan yang meluas adalah perbaikan yang paling sulit dipalsukan, argumen kuat yang dapat dikutip manajemen dalam sesi tanya jawab uji tuntas dengan calon investor." },
      { name: "Dual Axis Chart — Jumlah Karyawan vs Biaya Kepatuhan", svg: () => { const W2 = 640, H2 = 300, B2 = 34; let out2 = svgOpen() + axis(W2, H2, 60, B2) + `<line x1="${W2 - 30}" y1="10" x2="${W2 - 30}" y2="${H2 - B2}" stroke="#999"/>`; const emp = [61, 74, 82, 90, 96], cost = [30, 38, 42, 55, 71]; const p1 = emp.map((v, i) => `${100 + i * 116},${H2 - B2 - v * 2.2}`).join(" "); const p2 = cost.map((v, i) => `${100 + i * 116},${H2 - B2 - v * 3.1}`).join(" "); out2 += `<polyline points="${p1}" fill="none" stroke="${NAVY}" stroke-width="2.6"/><polyline points="${p2}" fill="none" stroke="${RED}" stroke-width="2.6" stroke-dasharray="7 4"/>`; THN.forEach((t, i) => { out2 += txt(100 + i * 116, H2 - B2 + 14, t, 9, "#333", "middle"); }); return out2 + txt(70, 16, "Navy: karyawan (sumbu kiri) · Merah putus: biaya kepatuhan juta Rp (sumbu kanan)", 9.5, "#666"); }, an: "Bagan dua sumbu menjajarkan pertumbuhan jumlah karyawan dengan biaya kepatuhan pada skala masing-masing. Biaya kepatuhan tumbuh lebih curam daripada kepala karyawan, mencerminkan kedalaman kepatuhan per karyawan yang meningkat: dari sekadar kontrak menjadi kontrak, BPJS, struktur upah, dan pelaporan. Rasio biaya kepatuhan per karyawan yang menanjak bukan inefisiensi melainkan pendewasaan; pembandingnya yang sahih adalah biaya sengketa yang berhasil dihindarkan, yang pada grafik lain terbukti menurun." },
      { name: "Range Chart — Rentang Nilai Aset Minimum-Maksimum per Kategori", svg: () => { const rows = [["Tanah", 120, 190], ["Bangunan", 60, 95], ["Mesin", 30, 52], ["Kendaraan", 12, 22], ["Merek", 8, 40]] as const; let out2 = svgOpen(640, 250) + axis(640, 250, 60, 34); rows.forEach(([l, lo, hi], i) => { const x = 120 + i * 110; out2 += `<rect x="${x - 16}" y="${216 - (hi as number)}" width="32" height="${(hi as number) - (lo as number)}" rx="8" fill="${BLUE}" opacity="0.7"/>` + txt(x, 216 - (hi as number) - 6, String(hi), 9) + txt(x, 232, l as string, 9, "#333", "middle"); }); return out2 + txt(70, 16, "Rentang taksiran nilai (ratus juta Rp) — penilai independen vs NJOP", 9.5, "#666"); }, an: "Grafik rentang membentangkan selisih taksiran nilai terendah dan tertinggi tiap kategori aset, umumnya antara nilai jual objek pajak dan taksiran penilai independen. Rentang terlebar secara proporsional justru pada merek, mencerminkan kesulitan inheren menilai aset tak berwujud. Implikasi transaksionalnya: para pihak sebaiknya menyepakati sejak awal penilai independen mana yang mengikat, karena selisih taksiran selebar ini adalah sumber sengketa penyesuaian harga yang paling sering terjadi pasca-penutupan." },
      { name: "Horizon Chart — Tren Padat Enam Indikator dalam Satu Pita", svg: () => { let out2 = svgOpen(640, 230); const r = rnd(91); ["Kepatuhan", "Perizinan", "Naker", "Pajak", "Aset", "Litigasi"].forEach((l, k) => { const y0 = 20 + k * 34; out2 += txt(0, y0 + 16, l, 9.5); for (let i = 0; i < 40; i++) { const v = r(); out2 += `<rect x="${110 + i * 13}" y="${y0}" width="12" height="24" fill="${v > 0.66 ? GREEN : v > 0.33 ? GOLD : RED}" opacity="${0.35 + v * 0.5}"/>`; } }); return out2 + "</svg>"; }, an: "Grafik cakrawala memampatkan empat puluh periode pengamatan untuk enam indikator ke dalam pita-pita berwarna intensitas. Kekuatannya adalah kepadatan: satu layar menyimpan dua ratus empat puluh titik data tanpa kehilangan pola. Pita litigasi yang menghijau pada sepertiga terakhir dan pita perizinan yang masih berbintik merah merangkum keseluruhan cerita laporan ini dalam satu gambar, cocok sebagai penutup eksekutif bagi pembaca yang hanya punya waktu satu menit." },
      { name: "Tornado Chart — Sensitivitas Nilai Transaksi terhadap Risiko", svg: () => { const rows = [["Izin kedaluwarsa", -18, 4], ["Sengketa naker", -12, 3], ["Perkara berjalan", -10, 8], ["Perpanjangan merek", -3, 9], ["Kepatuhan pajak", -8, 6]] as const; let out2 = svgOpen(640, 250); out2 += `<line x1="330" y1="16" x2="330" y2="230" stroke="#999"/>`; rows.forEach(([l, neg, pos], i) => { const y = 30 + i * 42; out2 += `<rect x="${330 + (neg as number) * 8}" y="${y}" width="${-(neg as number) * 8}" height="24" fill="${RED}" opacity="0.8"/><rect x="330" y="${y}" width="${(pos as number) * 8}" height="24" fill="${GREEN}" opacity="0.8"/>` + txt(324, y + 16, l as string, 9, "#333", "end") + txt(336 + (pos as number) * 8, y + 16, `+${pos}%`, 8.5, GREEN) + txt(324 + (neg as number) * 8, y + 16, `${neg}%`, 8.5, RED, "end"); }); return out2 + txt(330, 14, "Dampak terhadap nilai transaksi", 9.5, "#666", "middle"); }, an: "Diagram tornado mengurutkan faktor risiko menurut daya ungkitnya terhadap nilai transaksi, batang terpanjang di puncak. Skenario izin kedaluwarsa berpotensi menggerus nilai hingga delapan belas persen, menjadikannya risiko tunggal terbesar, jauh melampaui perkara berjalan. Analisis sensitivitas semacam ini mengubah temuan kualitatif menjadi urutan prioritas kuantitatif dan menjadi dasar objektif perancangan struktur jaminan: pos dengan batang merah terpanjang layak mendapat jaminan khusus, bukan sekadar jaminan umum." },
    ],
  },
  {
    title: "Sebaran Geografis Operasi dan Ketenagakerjaan",
    intro: "Bagian ini memetakan jejak geografis perseroan: lokasi karyawan, aset, dan izin per wilayah, disajikan sebagai peta ubin bergaya. Dimensi kewilayahan penting secara hukum karena upah minimum, pajak daerah, dan sebagian perizinan bersifat teritorial: kewajiban perseroan berbeda menurut provinsi dan kabupaten tempat kegiatannya berjalan.",
    charts: [
      { name: "Filled Map — Kehadiran Operasional per Provinsi", svg: () => tileMap("filled"), an: "Peta isian memperlihatkan intensitas kehadiran operasional per provinsi, terpekat di koridor Jawa. Setiap provinsi berwarna adalah satu yurisdiksi upah minimum tersendiri dan berpotensi satu kantor pajak daerah tersendiri; kehadiran di banyak provinsi melipatgandakan kewajiban registrasi dan pelaporan lokal. Pemeriksa memverifikasi bahwa setiap ubin berwarna berpasangan dengan pendaftaran kantor cabang atau lokasi usaha pada sistem perizinan, karena kegiatan di wilayah tanpa registrasi adalah pelanggaran yang mudah dideteksi pemeriksa daerah." },
      { name: "Bubble Map — Jumlah Karyawan per Wilayah", svg: () => tileMap("bubble"), an: "Peta gelembung menskalakan lingkaran menurut jumlah karyawan di tiap wilayah. Konsentrasi di Jakarta dan Jawa Barat menempatkan mayoritas hubungan kerja di bawah dua rezim upah minimum tertinggi nasional, fakta struktural yang membentuk dasar biaya tenaga kerja. Gelembung kecil di provinsi jauh justru menyimpan risiko administratif tersendiri: karyawan tunggal di wilayah terpencil kerap luput dari pelaporan wajib ketenagakerjaan daerah, kelalaian kecil yang tetap tercatat sebagai pelanggaran." },
      { name: "Symbol Map — Status Kepatuhan Lokasi", svg: () => tileMap("symbol"), an: "Peta simbol menandai tiap lokasi dengan status kepatuhannya: lingkaran hijau untuk patuh penuh, segitiga merah untuk lokasi dengan kewajiban tertunggak. Dua segitiga pada peta ini menunjuk lokasi yang izin operasional daerahnya sedang dalam perpanjangan. Format simbol dipilih karena kejelasannya bagi pembaca non-teknis: rapat Direksi cukup memburu segitiga merah tanpa membaca tabel. Tindak lanjut per simbol terdokumentasi pada modul perizinan dengan tenggat yang dipantau otomatis." },
      { name: "Choropleth Map — Intensitas Rekam Hukum per Provinsi", svg: () => tileMap("choropleth"), an: "Peta koroplet menggradasikan warna menurut kepadatan rekam hukum per provinsi. Gradasi pekat di ubin DKI mencerminkan domisili hukum perseroan tempat mayoritas perikatan ditandatangani. Relevansi litigasinya nyata: klausul pilihan forum pada kontrak-kontrak tersebut umumnya menunjuk pengadilan di domisili itu, sehingga peta ini sekaligus peta yurisdiksi tempat perseroan paling mungkin berperkara, informasi yang menentukan pemilihan kantor advokat rekanan." },
      { name: "Geographic Heatmap — Kepadatan Titik Risiko Kewilayahan", svg: () => tileMap("geoheat"), an: "Peta panas geografis menggabungkan seluruh kategori risiko ke dalam satu gradasi suhu per wilayah. Ubin bersuhu tertinggi adalah persilangan banyak karyawan, banyak aset, dan izin yang mendekati tenggat sekaligus. Kegunaan praktisnya adalah penjadwalan kunjungan audit lapangan: sumber daya pemeriksaan lapangan yang terbatas diarahkan ke ubin terpanas lebih dulu, praktik audit berbasis risiko yang selaras dengan standar profesi dan menghemat biaya kepatuhan perseroan." },
    ],
  },
  {
    title: "Analitik Lanjutan dan Pemodelan Risiko Berbantuan Mesin",
    intro: "Bagian penutup visual ini menampilkan lapisan analitik statistik dan pemodelan kecerdasan buatan yang menopang fungsi deteksi dini sistem. Perlu ditegaskan sejak awal: keluaran model adalah alat bantu penajaman perhatian pemeriksa, bukan pendapat hukum. Setiap sinyal model diverifikasi manusia sebelum menjadi temuan, sesuai prinsip tanggung jawab profesional yang tidak dapat didelegasikan kepada mesin.",
    charts: [
      { name: "Scatter Plot — Korelasi Masa Kerja dan Skor Kepatuhan Berkas", svg: () => scatter(36), an: "Diagram sebar memplot tiap karyawan menurut masa kerja dan skor kelengkapan berkasnya. Awan titik yang miring ke kanan atas menunjukkan korelasi positif: berkas karyawan lama lebih lengkap, wajar karena melewati lebih banyak siklus pembaruan. Konsekuensi praktisnya terbalik dari intuisi: risiko kelengkapan justru menumpuk pada karyawan baru, sehingga titik kendali mutu berkas paling efektif dipasang pada proses orientasi masuk kerja, saat seluruh dokumen masih mudah diminta." },
      { name: "Bubble Chart — Risiko vs Nilai vs Volume Kontrak", svg: () => scatter(20, { bubble: true }), an: "Diagram gelembung menambah dimensi ketiga pada analisis kontrak: sumbu datar tingkat risiko, sumbu tegak nilai kontrak, dan luas gelembung volume transaksi. Gelembung besar di kuadran kanan atas, kontrak bernilai besar sekaligus berisiko tinggi, adalah daftar pendek prioritas renegosiasi. Kerangka hukumnya jelas: kontrak pada kuadran tersebut menuntut klausul pembatasan tanggung jawab, jaminan pelaksanaan, dan mekanisme penyelesaian sengketa yang paling ketat dibanding populasi kontrak lainnya." },
      { name: "Hexbin Chart — Kepadatan Sebaran Dua Variabel", svg: () => scatter(60, { hex: true }), an: "Ketika titik terlalu banyak untuk dibaca satu per satu, bagan heksagonal mengelompokkannya ke sarang lebah dengan kepekatan warna sebanding jumlah titik. Sarang terpekat mengungkap kombinasi nilai yang paling sering terjadi, profil transaksi tipikal perseroan. Profil tipikal inilah yang selayaknya dibakukan menjadi kontrak standar yang ditelaah sekali secara mendalam lalu dipakai berulang, strategi efisiensi hukum yang menurunkan biaya telaah per transaksi tanpa menurunkan mutu perlindungan." },
      { name: "Correlogram — Korelasi Antar Indikator Kepatuhan", svg: () => matrix(["Izin", "Naker", "Pajak", "Aset"], "corr"), an: "Korelogram merangkum koefisien korelasi antar indikator kepatuhan dalam matriks berwarna. Korelasi kuat antara kepatuhan perizinan dan pajak menyiratkan akar organisasi yang sama, yakni fungsi administrasi yang menangani keduanya. Pelajaran strukturalnya: memperkuat satu fungsi kunci memperbaiki dua indikator sekaligus, dan sebaliknya kegagalan satu personel dapat menjalar ke beberapa domain kepatuhan, argumen kuantitatif untuk kebijakan rangkap jabatan yang lebih hati-hati." },
      { name: "Pair Plot — Hubungan Silang Empat Variabel", svg: () => matrix(["Umur", "Masa", "Upah", "Skor"], "corr"), an: "Plot pasangan menyilangkan empat variabel ketenagakerjaan sekaligus sehingga seluruh kombinasi hubungan terbaca dalam satu panel. Hubungan upah dengan masa kerja yang kuat dan positif adalah bukti kuantitatif berjalannya penghargaan senioritas, bahan pembelaan yang berguna bila muncul dalil diskriminasi pengupahan. Sebaliknya hubungan umur dengan skor kepatuhan yang lemah menepis dugaan bahwa persoalan berkas terkonsentrasi pada kelompok usia tertentu." },
      { name: "Correlation Matrix — Matriks Korelasi Seluruh Indikator", svg: () => matrix(["Kor", "Izin", "Nkr", "Pjk", "Ast"], "corr"), an: "Matriks korelasi penuh memperluas analisis ke lima indikator dengan nilai koefisien tertera pada tiap sel. Nilai pada diagonal selalu satu, sedangkan sel di luar diagonal memperlihatkan kekuatan hubungan antar domain kepatuhan. Pembacaan yang jujur mengharuskan peringatan baku: korelasi bukan sebab akibat, dan angka pada matriks ini adalah alat penajaman hipotesis pemeriksaan, bukan kesimpulan hukum. Hipotesis yang ditajamkan lalu diuji dengan dokumen pada bab pemeriksaan aspek." },
      { name: "Confusion Matrix — Akurasi Model Klasifikasi Risiko Dokumen", svg: () => matrix(["Aman", "Risiko"], "conf"), an: "Matriks kebingungan mengukur kinerja model kecerdasan buatan yang mengklasifikasi dokumen berisiko: diagonal pekat menandakan prediksi yang cocok dengan penilaian advokat. Angka keliru positif, dokumen aman yang ditandai berisiko, hanya menimbulkan biaya telaah ekstra; sebaliknya keliru negatif adalah risiko nyata karena dokumen bermasalah lolos tanpa telaah. Karena asimetri akibat itulah ambang model sistem ini sengaja dimiringkan agar lebih banyak keliru positif, kebijakan kehati-hatian yang sejalan dengan etika profesi hukum." },
      { name: "ROC Curve — Daya Pisah Model Deteksi Risiko", svg: () => curveEval("roc"), an: "Kurva ROC menggambarkan daya pisah model deteksi risiko pada seluruh kemungkinan ambang, dengan luas di bawah kurva nol koma sembilan satu, jauh di atas garis acak. Angka ini menyatakan bahwa bila diambil sepasang dokumen berisiko dan aman secara acak, model menempatkan yang berisiko lebih tinggi sembilan dari sepuluh kali. Sekali lagi ditegaskan dalam bingkai tanggung jawab profesional: kurva sebagus apa pun tidak menggantikan telaah advokat, ia hanya menentukan urutan antrean telaah." },
      { name: "Precision-Recall Curve — Kinerja pada Kelas Tak Seimbang", svg: () => curveEval("pr"), an: "Karena dokumen bermasalah jauh lebih sedikit daripada yang aman, kurva presisi-recall lebih jujur daripada ROC untuk menilai kinerja model pada kelas langka. Kurva yang bertahan di presisi tinggi hingga recall menengah berarti model dapat menangkap sebagian besar dokumen bermasalah tanpa membanjiri advokat dengan alarm palsu. Titik operasi dipilih pada recall delapan puluh persen, keputusan yang terdokumentasi dan dapat ditinjau ulang komite, sebagaimana layaknya parameter yang berdampak pada cakupan telaah hukum." },
      { name: "Lift Chart — Efektivitas Prioritisasi Model", svg: () => curveEval("lift"), an: "Kurva angkat membandingkan strategi telaah berbasis model dengan telaah acak: pada sepuluh persen dokumen berperingkat teratas, model menangkap temuan lebih dari dua kali lipat strategi acak. Dalam bahasa anggaran, jam advokat yang sama menghasilkan cakupan risiko dua kali lebih luas. Nilai angkat yang menurun ke satu pada ekor kurva juga informatif: setelah antrean prioritas habis, sisa populasi memang setara acak dan cukup ditelaah sampling, dasar kuantitatif bagi kebijakan sampling yang dapat dipertanggungjawabkan." },
      { name: "Gain Chart — Kumulatif Temuan Tertangkap", svg: () => curveEval("gain"), an: "Kurva perolehan menampilkan akumulasi temuan yang tertangkap seiring bertambahnya porsi dokumen yang ditelaah menurut peringkat model. Tikungan tajam di awal kurva menunjukkan empat puluh persen telaah pertama menangkap hampir delapan puluh persen temuan. Bagi perencanaan uji tuntas lanjutan oleh pihak pembeli, kurva ini adalah peta efisiensi: ruang data dapat dibuka bertahap mulai dari dokumen berperingkat teratas tanpa mengorbankan cakupan temuan material secara signifikan." },
      { name: "PCA Plot — Peta Reduksi Dimensi Profil Dokumen", svg: () => scatter(30, { bubble: false }), an: "Plot analisis komponen utama memampatkan belasan atribut tiap dokumen menjadi dua dimensi terpenting sehingga dokumen dengan profil serupa mengelompok secara visual. Gerombolan kecil yang terpisah jauh dari populasi utama adalah dokumen berprofil ganjil, kandidat pemeriksaan manual pertama. Pada pemeriksaan ini, gerombolan terpencil berisi kontrak-kontrak warisan periode awal perseroan berformat tidak baku, yang kemudian memang menyumbang temuan kelengkapan tanda tangan." },
      { name: "Parallel Coordinates Plot — Profil Multivariat Karyawan", svg: () => parallelCoords(false), an: "Plot koordinat paralel mengalirkan tiap karyawan sebagai satu garis melintasi lima sumbu atribut, dari umur hingga skor risiko. Berkas garis yang rapat membentuk profil normal, sementara garis yang menyilang ekstrem antar sumbu, misalnya masa kerja pendek dengan upah tinggi, menonjol seketika. Setiap garis ekstrem telah diminta penjelasannya kepada manajemen; sebagian terjawab wajar sebagai tenaga ahli yang direkrut khusus, sisanya dicatat sebagai butir konfirmasi pada lampiran pemeriksaan." },
      { name: "Andrews Curve — Sidik Jari Multivariat", svg: () => parallelCoords(true), an: "Kurva Andrews mengubah profil multivariat tiap entitas menjadi kurva sinusoidal unik, sidik jari matematis yang memudahkan mata menangkap keanggotaan kelompok. Kurva yang berimpit membentuk keluarga profil serupa; kurva sebatang kara adalah pencilan. Sebagai alat penyaring visual, teknik ini melengkapi metode lain tanpa klaim inferensi hukum apa pun, dan dicantumkan dalam laporan untuk mendemonstrasikan kedalaman perangkat analitik yang menopang fungsi deteksi dini sistem Corplex." },
      { name: "Connected Scatter Plot — Lintasan Risiko-Kepatuhan Antar Waktu", svg: () => scatter(10, { connected: true }), an: "Diagram sebar tersambung melacak lintasan posisi perseroan pada bidang risiko-kepatuhan dari periode ke periode, tiap titik satu triwulan yang dirangkai garis. Lintasan yang bergerak konsisten menuju kuadran kepatuhan tinggi risiko rendah adalah narasi visual perjalanan pembenahan tiga tahun terakhir. Bentuk lintasan yang tidak pernah mundur dua periode berturut menjadi indikator ketahanan proses; satu kemunduran sesaat pada pertengahan lintasan bertepatan dengan akuisisi lini usaha baru, lonjakan beban kepatuhan yang berhasil dicerna dalam dua triwulan." },
      { name: "Stem-and-Leaf Plot — Distribusi Masa Kerja Ringkas", svg: () => stemLeaf(), an: "Plot batang daun menyajikan distribusi masa kerja dengan cara paling hemat: angka puluhan sebagai batang, satuan sebagai daun, sehingga data mentah tetap terbaca utuh di dalam bentuk distribusinya. Transparansi ganda ini berguna pada lampiran laporan hukum: pembaca dapat memverifikasi statistik ringkasan langsung dari plot tanpa meminta data mentah terpisah. Konsentrasi daun pada batang dua puluhan bulan mengonfirmasi temuan kurva kepadatan sebelumnya mengenai dominasi kohort karyawan muda masa kerja." },
    ],
  },
];

export function buildCharts(): LddChart[] {
  let no = 0;
  return SECTIONS.flatMap((s) => s.charts.map((c) => ({ no: ++no, name: c.name, svg: c.svg(), an: c.an })));
}
