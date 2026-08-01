/*
 * Uji mesin peristiwa korporasi — assert murni, nol framework.
 *   npx tsx lib/peristiwa.test.ts
 * Fokus: dua tenggat 30 hari, batas off-by-one, riwayat lama tak boleh berteriak telat,
 * jalur internal tanpa kewajiban, dan keadaan organ yang diturunkan (bukan diketik).
 */
import assert from "node:assert";
import { statusPeristiwa, keadaanTerkini, periksaKorporasi, jalurJenis, tambahHari, type Peristiwa } from "./peristiwa";

const HARI_INI = "2026-07-30";
const buat = (x: Partial<Peristiwa>): Peristiwa => ({
  jenis: "Perubahan Susunan Direksi", jalur: "pemberitahuan",
  dasar: { bentuk: "RUPS Tahunan", tanggal: "2026-07-01" }, ...x,
});

/* 1 · rantai lengkap = berlaku, tanpa tenggat tersisa */
{
  const p = buat({ akta: { nomor: "14/2026", tanggal: "2026-07-10" }, sah: { bentuk: "Surat Penerimaan Pemberitahuan", nomor: "AHU-1", tanggal: "2026-07-20" } });
  const s = statusPeristiwa(p, HARI_INI);
  assert.equal(s.status, "berlaku");
  assert.equal(s.tenggat, null);
  assert.equal(s.perluTindakan, false);
}

/* 2 · belum ada akta, masih dalam 30 hari = proses + sisa hari benar */
{
  const s = statusPeristiwa(buat({ dasar: { bentuk: "RUPS Tahunan", tanggal: "2026-07-20" } }), HARI_INI);
  assert.equal(s.status, "proses");
  assert.equal(s.tenggat?.tanggal, "2026-08-19");
  assert.equal(s.tenggat?.sisaHari, 20);
  assert.equal(s.perluTindakan, false);
}

/* 3 · BATAS PERSIS hari ke-30 masih sah (off-by-one paling mahal di modul ini) */
{
  const s = statusPeristiwa(buat({ dasar: { bentuk: "RUPS Luar Biasa", tanggal: "2026-06-30" } }), HARI_INI);
  assert.equal(s.tenggat?.tanggal, "2026-07-30");
  assert.equal(s.tenggat?.sisaHari, 0);
  assert.equal(s.status, "proses", "hari ke-30 belum boleh dihitung terlambat");
}

/* 4 · lewat sehari = telat-akta + perlu tindakan */
{
  const s = statusPeristiwa(buat({ dasar: { bentuk: "RUPS Luar Biasa", tanggal: "2026-06-29" } }), HARI_INI);
  assert.equal(s.status, "telat-akta");
  assert.equal(s.tenggat?.sisaHari, -1);
  assert.equal(s.perluTindakan, true);
}

/* 5 · akta ada tapi pengesahan lewat 30 hari = telat-lapor, label sesuai jalur */
{
  const persetujuan = statusPeristiwa(buat({
    jenis: "Peningkatan Modal Dasar", jalur: "persetujuan",
    dasar: { bentuk: "RUPS Luar Biasa", tanggal: "2026-05-01" }, akta: { nomor: "9/2026", tanggal: "2026-05-10" },
  }), HARI_INI);
  assert.equal(persetujuan.status, "telat-lapor");
  assert.match(persetujuan.tenggat!.label, /persetujuan Menkumham/);

  const pemberitahuan = statusPeristiwa(buat({ akta: { nomor: "10/2026", tanggal: "2026-05-10" } }), HARI_INI);
  assert.match(pemberitahuan.tenggat!.label, /pemberitahuan ke Menkumham/);
}

/* 6 · RIWAYAT LAMA tak boleh melahirkan alarm palsu (akta 2019 dicatat hari ini) */
{
  const s = statusPeristiwa(buat({ historis: true, dasar: { bentuk: "Akta Pendirian", tanggal: "2019-03-12" } }), HARI_INI);
  assert.equal(s.status, "proses");
  assert.equal(s.tenggat, null);
  assert.equal(s.perluTindakan, false, "riwayat lama tidak pernah dihitung terlambat");
}

/* 7 · jalur internal (RUPS tahunan) selesai di tahap keputusan */
{
  const s = statusPeristiwa(buat({ jenis: "RUPS Tahunan (penerimaan laporan keuangan)", jalur: "internal", dasar: { bentuk: "RUPS Tahunan", tanggal: "2020-01-01" } }), HARI_INI);
  assert.equal(s.status, "berlaku");
  assert.equal(s.tenggat, null);
}

/* 8 · jalur ditentukan jenis (Pasal 21) — pengguna tak perlu hafal */
{
  assert.equal(jalurJenis("Peningkatan Modal Dasar"), "persetujuan");
  assert.equal(jalurJenis("Perubahan Susunan Direksi"), "pemberitahuan");
  assert.equal(jalurJenis("RUPS Tahunan (penerimaan laporan keuangan)"), "internal");
  assert.equal(jalurJenis("Jenis yang tak dikenal"), "pemberitahuan", "cadangan aman: jalur ringan, bukan mengaku sudah sah");
}

/* 9 · keadaan organ DITURUNKAN dari peristiwa berlaku, yang terbaru menang */
{
  const list: Peristiwa[] = [
    buat({ dasar: { bentuk: "RUPS Tahunan", tanggal: "2021-01-28" }, akta: { nomor: "9/2021", tanggal: "2021-02-04" },
      sah: { bentuk: "Surat Penerimaan Pemberitahuan", nomor: "AHU-A", tanggal: "2021-02-19" },
      ubah: [{ hal: "Direktur Utama", dari: "Hendra", jadi: "Budi" }] }),
    buat({ dasar: { bentuk: "RUPS Luar Biasa", tanggal: "2023-09-10" }, akta: { nomor: "41/2023", tanggal: "2023-09-17" },
      sah: { bentuk: "Keputusan Menteri", nomor: "AHU-B", tanggal: "2023-10-02" },
      ubah: [{ hal: "Direktur Utama", dari: "Budi", jadi: "Rina" }, { hal: "Modal dasar", dari: "Rp 5 M", jadi: "Rp 20 M" }] }),
    /* belum berlaku → TIDAK boleh ikut menentukan keadaan terkini */
    buat({ dasar: { bentuk: "RUPS Tahunan", tanggal: "2026-07-20" }, ubah: [{ hal: "Direktur Utama", dari: "Rina", jadi: "Sinta" }] }),
  ];
  const k = keadaanTerkini(list, HARI_INI);
  assert.equal(k.find((x) => x.hal === "Direktur Utama")?.nilai, "Rina");
  assert.equal(k.find((x) => x.hal === "Direktur Utama")?.perTanggal, "2023-10-02");
  assert.equal(k.find((x) => x.hal === "Modal dasar")?.nilai, "Rp 20 M");
}

/* 10 · pemeriksaan aspek korporasi menangkap keterlambatan (pengganti hitung berkas) */
{
  const list: Peristiwa[] = [
    buat({ jenis: "Pendirian Perseroan", jalur: "persetujuan", historis: true,
      dasar: { bentuk: "Akta Pendirian", tanggal: "2019-03-12" }, akta: { nomor: "27/2019", tanggal: "2019-03-12" },
      sah: { bentuk: "Keputusan Menteri", nomor: "AHU-0012345", tanggal: "2019-03-28" },
      ubah: [{ hal: "Status badan hukum", dari: "—", jadi: "Sah" }] }),
    buat({ dasar: { bentuk: "RUPS Luar Biasa", tanggal: "2026-06-01" } }), // telat akta
  ];
  const p = periksaKorporasi(list, HARI_INI);
  assert.equal(p[0].ok, true, "pendirian lengkap");
  assert.equal(p[1].ok, false, "keterlambatan akta harus jadi temuan");
  assert.match(p[1].ket, /lewat batas 30 hari/);
  assert.equal(p[4].ok, false, "RUPS tahunan belum tercatat = temuan");

  /* tenant kosong: nol peristiwa TIDAK boleh tampil aman */
  const kosong = periksaKorporasi([], HARI_INI);
  assert.equal(kosong.every((x) => !x.ok), true, "nol data bukan berarti aman");
}

/* 11 · util tanggal */
assert.equal(tambahHari("2026-01-31", 30), "2026-03-02");
assert.equal(tambahHari("2024-02-01", 30), "2024-03-02", "tahun kabisat");

console.log("peristiwa.test.ts — semua assert lolos");
