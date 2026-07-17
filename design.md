# Corplex Enterprise Platform — Design Blueprint (`design.md`)
**Version 3.0 · Binding Source of Truth · Deviation = Defect**

Semua kode UI berikutnya WAJIB tunduk pada dokumen ini. Tidak ada warna, font, radius, shadow, atau animasi di luar yang terdaftar di sini.

---

## 1. Color Palette

### 1.1 Sidebar (Dark Navy — zona otoritas)
| Token | Hex | Tailwind arbitrary | Pemakaian |
|---|---|---|---|
| `sidebar-bg` | `#0B1526` | `bg-[#0B1526]` | Background sidebar penuh |
| `sidebar-bg-deep` | `#081020` | `bg-[#081020]` | Header logo & footer user-chip sidebar |
| `sidebar-item-hover` | `#111E36` | `hover:bg-[#111E36]` | Hover item menu |
| `sidebar-item-active` | `#15264A` | `bg-[#15264A]` | Item menu aktif |
| `sidebar-text` | `#8DA2C8` | `text-[#8DA2C8]` | Label menu default |
| `sidebar-text-active` | `#EDF2FC` | `text-[#EDF2FC]` | Label menu aktif/hover |
| `sidebar-section` | `#5F7396` | `text-[#5F7396]` | Judul grup ("LAYER 2 — LEGAL OPERATIONS"), uppercase 10px |
| `sidebar-divider` | `rgba(141,162,200,0.12)` | `border-[#8DA2C8]/[0.12]` | Garis pemisah grup |

### 1.2 Main Canvas & Topbar (Clean off-white — zona kerja)
| Token | Hex | Tailwind | Pemakaian |
|---|---|---|---|
| `canvas` | `#F6F7F9` | `bg-[#F6F7F9]` | Background konten utama |
| `topbar` | `#FFFFFF` | `bg-white` | Topbar, sticky, border-b |
| `surface` | `#FFFFFF` | `bg-white` | Card / panel / tabel |
| `surface-sunken` | `#F1F3F6` | `bg-[#F1F3F6]` | Input, cell header tabel, area sekunder dalam card |
| `line` | `#E4E7EC` | `border-[#E4E7EC]` | SEMUA border 1px — satu-satunya cara memberi depth |
| `line-strong` | `#D5DAE2` | `border-[#D5DAE2]` | Border elemen interaktif (input focus ring pengganti) |

### 1.3 Text Hierarchy (di canvas terang)
| Peran | Hex | Tailwind |
|---|---|---|
| Primary (judul, angka KPI) | `#141B2B` | `text-[#141B2B]` |
| Secondary (body, label form) | `#3D4A63` | `text-[#3D4A63]` |
| Muted (deskripsi, meta, timestamp) | `#7A8699` | `text-[#7A8699]` |
| Disabled | `#B4BCC9` | `text-[#B4BCC9]` |

### 1.4 Accents
| Peran | Hex | Tailwind | Aturan |
|---|---|---|---|
| **Gold — aksi utama & highlight** | `#B08A3E` (base) / `#96742F` (hover) | `bg-[#B08A3E] hover:bg-[#96742F]` | Tombol primer, angka penting, indikator menu aktif |
| Gold tint (badge bg) | `#B08A3E` @ 10% | `bg-[#B08A3E]/10 text-[#8A6C2E]` | Badge status "gold" |
| **Emerald — sukses/terverifikasi** | `#1E7F5C` | `text-[#1E7F5C]`, badge `bg-[#1E7F5C]/10` | VERIFIED, LUNAS, AKTIF |
| **Crimson — kritis/tenggat** | `#B3403E` | `text-[#B3403E]`, badge `bg-[#B3403E]/10` | Tenggat <14 hari, TANPA POLIS |
| **Slate-blue — netral/proses** | `#3A60A6` | badge `bg-[#3A60A6]/10 text-[#2F4E86]` | PROSES, DIPANTAU, DRAF AI |
| Amber — peringatan sedang | `#A9741F` | badge `bg-[#A9741F]/10` | 14–60 hari |

**DILARANG:** semua warna default Tailwind (`blue-500`, `indigo-600`, `slate-800`, dst). Hanya arbitrary hex di atas.

### 1.5 ZERO Neon/Glow — aturan depth
- **DILARANG:** `box-shadow` ber-blur besar (>8px), shadow berwarna (biru/emas/apapun selain hitam), `drop-shadow` glow, `ring` berwarna terang, gradien mencolok.
- **Depth HANYA dari:** (a) border 1px `#E4E7EC`; (b) perbedaan flat color antar layer (`#F6F7F9` canvas vs `#FFFFFF` surface vs `#F1F3F6` sunken); (c) satu shadow resmi untuk elemen mengambang saja (dropdown/modal/toast): `shadow-[0_4px_16px_rgba(20,27,43,0.10)]`.
- Card di canvas: **tanpa shadow sama sekali** — cukup `bg-white border border-[#E4E7EC]`.

---

## 2. Typography System

| Peran | Font | Weight | Size | Tracking | Leading |
|---|---|---|---|---|---|
| H1 halaman | **Source Serif 4** | 600 | 26px | `-0.01em` | 1.25 |
| H2 / judul panel | Source Serif 4 | 600 | 17px | `0` | 1.3 |
| Angka KPI | Source Serif 4 | 700 | 30px | `0` | 1.15 |
| Body / UI | **Plus Jakarta Sans** | 400–500 | 13.5px | `0` | 1.65 |
| Label form & kolom tabel | Plus Jakarta Sans | 600 | 11px uppercase | `0.06em` | 1.4 |
| Judul grup sidebar | Plus Jakarta Sans | 700 | 10px uppercase | `0.1em` | 1.4 |
| Tag / ID dok / hash / nomor polis | **IBM Plex Mono** | 500 | 11px | `0.02em` | 1.5 |
| Badge status | IBM Plex Mono | 600 | 10.5px uppercase | `0.05em` | 1 |

Load: Google Fonts, `display=swap`, hanya weight yang tercantum.
Serif = otoritas hukum (judul & angka). Sans = seluruh UI. Mono = data mesin. Tidak ada font keempat.

---

## 3. Layout & Geometry

### 3.1 Frame
- **Sidebar:** lebar tetap `264px`, full-height, `position:fixed`; ≤1024px → off-canvas (translate-x, toggle topbar).
- **Topbar:** tinggi `60px`, `sticky top-0 z-40`, `bg-white border-b border-[#E4E7EC]`; isi: judul modul aktif (serif), search global, bell, tenant/user chip.
- **Konten:** `margin-left:264px`, `max-width:1320px`, padding `28px 32px 48px`.

### 3.2 Grid dasbor "Ringkasan"
- Baris KPI: `grid grid-cols-4 gap-5` (≤1280px → 2 kolom; ≤640px → 1).
- Baris konten: `grid grid-cols-[1.6fr_1fr] gap-5` (Pengingat Kepatuhan kiri lebar, Alur Verifikasi kanan).
- Semua card dalam satu baris **sama tinggi** (`items-stretch`, konten `flex flex-col`, footer `mt-auto`) — zero dead space, zero card timpang.

### 3.3 Spacing scale (satu-satunya yang boleh dipakai)
`4 / 8 / 12 / 16 / 20 / 24 / 32 px` (`gap-1/2/3/4/5/6/8`).
- Padding card: `20px` (`p-5`). Card padat data (KPI): `16px 20px`.
- Gap antar card: `20px` (`gap-5`). Gap antar section vertikal: `24px`.
- Row list (pengingat, kalender): `padding 12px 16px`, dipisah `divide-y divide-[#E4E7EC]` — bukan margin.
- Tabel: cell `10px 16px`, header sunken `bg-[#F1F3F6]`.

---

## 4. Component Architecture

### 4.1 Button vs Badge — pemisahan mutlak
**Button** (hanya untuk aksi yang menjalankan sesuatu):
- Primer: `bg-[#B08A3E] text-white rounded-lg px-4 h-9 text-[13px] font-semibold hover:bg-[#96742F] active:scale-[0.98]` — flat, tanpa shadow/glow.
- Sekunder: `bg-white border border-[#D5DAE2] text-[#3D4A63] hover:border-[#B08A3E] hover:text-[#141B2B]`.
- Ghost/small: `h-8 px-3 rounded-md text-[12.5px]`.
- Wajib punya `cursor-pointer` + state hover + handler JS nyata. **Tidak ada tombol pajangan.**

**Badge/Tag** (informasi status — BUKAN tombol, tidak diklik):
- Bentuk: slim pill `rounded-full px-2.5 py-0.5`, IBM Plex Mono 10.5px, `border border-{accent}/25 bg-{accent}/10 text-{accent-dark}` — flat, tipis, tanpa interaksi, tanpa font tebal berlebih.
- **DILARANG** membungkus label informasi ("REKAM AKTIF", "CATAT → JAGA → JAMIN") dengan styling tombol.

### 4.2 Cards / Panels
`bg-white border border-[#E4E7EC] rounded-xl` (radius 12px; KPI 12px; modal 16px). Tanpa shadow. Hover pada card interaktif: hanya `border-color → #C9D0DA` transisi 200ms.

### 4.3 Inputs
`h-9 bg-[#F1F3F6] border border-[#E4E7EC] rounded-lg px-3 text-[13px]`; focus: `border-[#B08A3E] bg-white` — tanpa ring glow.

### 4.4 Iconography — LARANGAN EMOJI
- **Unicode emoji dilarang absolut** di seluruh UI (menu, tombol, KPI, toast, badge).
- **Eksklusif Lucide Icons** (SVG inline atau `lucide` CDN): `16px` dalam teks/menu, `18px` tombol, `20px` KPI; `stroke-width: 1.75`; warna mengikuti teks di sekitarnya (`currentColor`).
- Contoh pemetaan: Ringkasan→`layout-dashboard`, Employment→`users`, Licensing→`file-badge`, CorpSec→`landmark`, Asset & IP→`gem`, Case→`scale`, Legal Tools→`wrench`, Agreement→`file-signature`, Asuransi→`shield-check`, Pajak→`receipt-text`, Lawyer→`gavel`, bell→`bell`, search→`search`.

### 4.5 Tabel
Header: sunken `bg-[#F1F3F6]`, label 11px uppercase mono-sans, `text-[#7A8699]`. Row hover: `bg-[#F6F7F9]` 150ms. Zebra dilarang (border-b cukup).

---

## 5. Animations & Micro-interactions
**Prinsip: hanya `transform`, `opacity`, `background-color`, `border-color`. Durasi 150–300ms. Tanpa animasi JS berat, tanpa parallax, tanpa glow pulse.**

| Elemen | Animasi | Spec |
|---|---|---|
| Item menu sidebar (hover) | bg shift + teks terang | `transition-colors duration-200 ease-in-out` |
| Item menu aktif | indikator kiri emas 3px meluncur antar item | `transform: translateY()` `duration-300 cubic-bezier(.3,.85,.3,1)` — satu elemen indikator, bukan border per item |
| Pergantian view | konten fade-rise staggered | `opacity 0→1, translateY(8px)→0`, `duration-400`, delay `+60ms` per child, max 6 child |
| Card interaktif (hover) | border-color saja | `#E4E7EC → #C9D0DA`, `duration-200` |
| Button primer (active) | `scale(0.98)` | `duration-150` |
| Status dot "FUNGSI JAGA AKTIF" | pulse opacity dot emerald 8px | `@keyframes` `opacity .45→1→.45`, `2.4s ease-in-out infinite` — HANYA opacity, tanpa box-shadow ring |
| Tab switch | underline emas geser + panel fade | underline `transform duration-300`; panel `opacity duration-200` |
| Toast | masuk dari bawah-kanan | `translateY(12px)+opacity`, `duration-300`, auto-dismiss 4.5s |
| Skeleton load (ganti tenant) | sweep gradien abu halus | `translateX(-100%→100%)`, `1.1s`, sekali jalan |
| Angka KPI saat load | count-up 900ms | rAF, sekali per login |
| Dropdown/modal | `opacity + scale(0.98→1)` origin atas | `duration-200 ease-out` |

`@media (prefers-reduced-motion: reduce)` → semua animasi & transisi mati.

---

## 6. Struktur Menu (mengikat)
- **Layer 1:** Legal AI Assistant · Legal Drafter
- **Layer 2 (urutan persis):** Employment · Licensing · Corporate Secretary · Asset & IP · Case Management · Legal Tools · Agreement Management · Manajemen Asuransi · Kepatuhan Pajak
- **Layer 3:** Corporate Lawyer MRWP

## 7. Dashboard "Ringkasan" — Command Center (mengikat)
1. Header identitas perusahaan + skor kesehatan hukum (angka serif + ring flat).
2. KPI 4 kolom: Nilai Aset · Izin Mendekati Tenggat · Skor Kepatuhan Pajak · Status Polis Asuransi — semua data silang antar modul, semua bisa diklik menuju modulnya.
3. Pengingat Kepatuhan terpadu (semua modul, badge tenggat berwarna, klik → modul sumber).
4. Alur Verifikasi (dokumen DRAF AI menunggu review advokat, klik → Layer 3).
