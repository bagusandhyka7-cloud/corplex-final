import type { ViewId } from "./store";

/* Satu sumber kebenaran URL tiap menu. go(viewId) di store me-resolve lewat map ini. */
export const ROUTE: Record<ViewId, string> = {
  "ringkasan": "/beranda",
  "lawyer": "/pengacara",
  "assistant": "/asisten",
  "drafter": "/drafting",
  "hr-database": "/hr/database",
  "hr-sp": "/hr/sp",
  "hr-kalkulator": "/hr/kalkulator",
  "asset": "/aset",
  "asuransi": "/asuransi",
  "pajak": "/pajak",
  "licensing": "/perizinan",
  "corpsec": "/sekretaris",
  "case": "/perkara",
  "tools": "/alat",
  "agreement": "/perjanjian",
  "employment": "/hr/database", // legacy id — arahkan ke database karyawan
};
