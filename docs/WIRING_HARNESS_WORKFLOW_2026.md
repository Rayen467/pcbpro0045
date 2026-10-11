# SirkuitLab v1.31 — Wiring & Harness Planner

## Tujuan

Membantu pemula mengubah **System Blueprint** robot/smart home/hidroponik/GNSS menjadi **jadwal koneksi terminal secara manual**, bukan menebak jalur pengawatan. Project Builder tetap menyimpan modul, kebutuhan daya awal dan power tree; Harness Planner menyimpan terminal dan net koneksi terpisah. PCB Schematic/PCB editor masih bertugas membangun dan memverifikasi netlist, footprints, copper tracks, dan DRC.

**Aturan eksperimen pemula:** gunakan USB DC tegangan rendah dengan sumber dibatasi arus. Tidak ada pengajaran pemasangan jaringan PLN/230 V, panel listrik, sistem energi tinggi, atau wiring kendaraan nyata.

## Alur 12 langkah: smart desk I²C

1. Buka **Builder**, pilih template **Smart desk / smart home**. Template adalah requirement; semua data tegangan/arus dari datasheet perlu diisi manual.
2. Pilih varian MCU dan tipe sensor dari perangkat yang benar-benar akan dipakai. Belum ada library part-number otomatis.
3. Scroll ke **05 / Wiring & Harness Planner**.
4. Tambahkan terminal untuk modul MCU: nama misalnya `3V3` dengan role `power_out`; `GND` dengan role `ground`; `GPIO21` dengan role `bidirectional`; `GPIO22` role `bidirectional`.
5. Tambahkan terminal untuk sensor, misalnya `VCC` (role `power_in`), `GND`, `SDA` dan `SCL` (role `bidirectional`). Cek lagi pinout pada datasheet board, bukan berdasarkan angka kebiasaan.
6. Masukkan tegangan nominal **hanya** jika sesuai dokumen komponen. Nilai `3.3 V` adalah contoh pembelajaran; level logika aktual berbeda menurut board/peripheral.
7. Rencanakan kabel `MCU.3V3 ↔ SENSOR.VCC` sebagai mode `power` dengan net `3V3`. Tambahkan `GND ↔ GND` sebagai mode `ground` dan net `GND`.
8. Tambahkan koneksi `MCU.GPIO21 ↔ SENSOR.SDA` dan `MCU.GPIO22 ↔ SENSOR.SCL` sebagai mode `data`; beri net `SDA` dan `SCL` masing-masing.
9. Isi jenis/ukuran konduktor, panjang, warna dari **perencanaan** nyata. Planner tidak menilai ampacity atau isolasi; pilihan konduktor fisik harus diverifikasi terpisah.
10. Perhatikan hasil **preflight**: menyambungkan power_out langsung ke GND, dua sumber power_out atau dua signal_out, dan terminal yang ditempelkan ke dua nama net berbeda ditandai blocker. Nilai V nominal yang berbeda juga diperingatkan sebagai blocker untuk jalur data/daya.
11. Jika diuji secara fisik memakai alat ukur, pilih status tes `PASS` atau `FAIL` dan isi hasil observasi yang cukup spesifik; tanpa alat ukur, pertahankan `untested`. Semua hasil tes di aplikasi adalah **laporan pengguna**, bukan pembacaan multimeter otomatis. Edit terminasi/kabel akan mengubah status jadi `needs_retest` dan mengosongkan catatan lulus lama.
12. Ekspor **Wire Schedule CSV** dan **Review JSON** untuk arsip. Lanjutkan ke **Schematic / PCB** untuk mencocokkan koneksi dengan netlist sebenarnya serta DRC. Catat prototipe, hasil pengukuran, BOM, revisi, dan risiko dalam rilis.

## Semantik dan batas validasi

| Data | Dicek otomatis | Tidak dicek |
|---|---|---|
| Terminal modul | Referensi module ID ada, nama terminal unik per modul | Pinout spesifik datasheet, toleransi GPIO |
| Wire / net | Endpoint ada, duplikat, satu terminal memakai dua net berbeda, koneksi intra-modul | Kontinuitas listrik aktual, konektor, routing fisik |
| Power / voltage | power_out↔ground, 2 power_out, beda V nominal yang sudah diinput | Fuse, arus hubung-singkat, drop kabel, isolasi, derating |
| Signal | 2 signal_out, penggunaan signal vs power tidak konsisten | I²C pull-up, level shifter lengkap, clock rise time, SPI timing |
| Kualitas | Manual `PASS / FAIL / NEEDS_RETEST` dengan keterangan | Pengukuran independen otomatis; sertifikasi; inspeksi terminasi |
| Penyimpanan | Lokal, bagian dari encrypted cloud project dan portable backup | Bukti fisik otomatis, lampiran foto/kalibrasi alat ukur |

CSV mengutip nilai dan menambahkan prefiks pelindung pada field yang terlihat seperti formula spreadsheet. Jangan masukkan secret atau informasi pribadi sensitif pada catatan.

## Referensi berlaku hingga Oktober 2026

- **IPC/WHMA-A-620F (20 Mei 2026)**: [situs IPC tentang persyaratan dan penerimaan cable and harness assemblies](https://www.ipc.org.cn/standards/ipc-whma-a-620). Proses crimp, solder, mechanical fastening, inspeksi, dan workmanship mengikuti dokumen resmi berlisensi; SirkuitLab tidak mengimplementasikan inspeksi tersebut. Situs IPC mencantumkan revisi F sebagai yang terbaru per Mei 2026.
- **Espressif**: [ESP32 schematic checklist](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/schematic-checklist.html) untuk pin GPIO yang bergantung varian chip, boot strapping, power domain dan pull-up.
- **KiCad 10:** [alur dari schematic ke PCB layout, ERC/DRC dan output](https://docs.kicad.org/10.0/en/getting_started_in_kicad/getting_started_in_kicad.html).
- **NXP UM10204:** I²C user manual merupakan rujukan batas alamat 7-bit, reserved addresses dan kebutuhan elektrikal bus.

**Penting:** standar bukan bukti bahwa aplikasi lulus sertifikasi. Semua perhitungan dan status dalam tool hanyalah reviewer desain tahap awal. Kelayakan produk menuntut inspeksi dan pengukuran hardware yang dapat diulang oleh tenaga kompeten.
