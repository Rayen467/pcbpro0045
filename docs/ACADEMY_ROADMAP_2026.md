# SirkuitLab Academy — Roadmap Rekayasa 2026 (Pemula → Robot & Smart Home)

> **Status:** kurikulum dan latihan yang dibuat untuk belajar, bukan kursus tersertifikasi ataupun bukti kompetensi profesi. Pekerjaan instalasi listrik tegangan jaringan hanya oleh tenaga kompeten. Pembaca pemula **tidak** membuat atau menghubungkan rangkaian AC PLN di breadboard.

## Tujuan akhir

Mampu menjelaskan dan membangun **satu** sistem low-voltage yang benar: (A) **smart desk voice** dengan ESP32 + sensor + output LED USB + Home Assistant Assist, atau (B) **robot dua roda** dengan ESP32 + sensor jarak + motor driver + supply berpelindung. Keluaran akhir harus memiliki *requirement, wiring schematic, firmware source, prototype, BOM, pengujian ulang, catatan kegagalan dan revisi*. Pindah ke custom PCB setelah rangkaian prototipe terbukti sesuai spesifikasi.

## Memahami istilah

| Istilah | Pertanyaan yang dijawab |
|---|---|
| Electrical | Dari mana energi berasal, mengalir lewat apa, dan diproteksi bagaimana? |
| Electronics | Komponen, sinyal, sensor, IC dan sifat listriknya apa? |
| Schematic / netlist | Pin mana tersambung ke pin/net mana? |
| PCB layout / routing | Jalur tembaga, footprint, via dan ground return dirancang bagaimana? |
| Firmware / Embedded | Aturan perilaku apa yang berjalan pada mikrokontroler? |
| IoT / Smart Home | Bagaimana perangkat mengirim status, menerima perintah dan gagal secara aman? |
| Robotics | Bagaimana mekanik, motor, sensor dan algoritma kontrol membentuk gerak? |

## Urutan belajar bertahap

Ritme contoh: **3 sesi per minggu**, masing-masing 45–60 menit (teori → praktik virtual → tes ulang/catatan). Lama per tahap fleksibel, bukan jaminan kemampuan. Academy memiliki **14 modul, 42 pelajaran, kuis tiap pelajaran, checklist praktik**, serta tiga Routing Lab.

| Pekan contoh | Modul Academy | Bukti minimal yang harus dimiliki |
|---|---|---|
| 1–2 | M00 Orientasi | Diagram input→proses→output dan daftar bahaya DC/AC |
| 3–5 | M01 Listrik | 3 perhitungan V, I, R, P dan cara mengukur DC |
| 6–8 | M02 Komponen | LED seri resistor, datasheet dasar, transistor vs motor driver |
| 9–11 | M03 Coding | Pseudocode if/else, loop, fungsi, dan dashboard mockup |
| 12–14 | M04 Schematic/wiring | Routing Lab LED + I²C, simbol/footprint/netlist/ERC |
| 15–18 | M05 PCB | PCB 2 layer latihan, ground, DRC, BOM, cek CAM |
| 19–21 | M06 ESP32 | Blink/logging, pinout 3,3 V, firmware build/test |
| 22–24 | M07 Sensor & bus | Read sensor, status offline, I²C vs SPI vs UART |
| 25–27 | M08 Motor | Motor driver, power tree, encoder/PID konsep |
| 28–30 | M09 Electrical system | SLD DC robot, konsep instalasi AC/PUIL hanya teoretis |
| 31–34 | M10 IoT | ESPHome / MQTT / HA, data vs command, akses aman |
| 35–37 | M11 Voice | Pipeline mic→STT→intent→policy→device, override |
| 38–42 | M12 Robotika | Diferensial drive, encoder, ROS 2 node/topic konsep |
| 43–48 | M13 Integrasi & capstone | Prototype teruji, report, BOM, firmware, revisi dan batas pakai |

Lakukan praktik *rute logis* di tiga latihan Academy terlebih dahulu, kemudian ulangi rangkaiannya dalam Schematic dan PCB. **Routing Trainer bukan PCB DRC, simulasi SPICE maupun gambar wiring jaringan listrik.**

## Materi pertama: LED 5 V dan perhitungan arus

1. **Tujuan:** memahami satu sumber DC, resistor, dioda LED dan jalur arus balik (ground bersama).
2. **Teori:** untuk perkiraan sederhana, arus LED ditentukan oleh tegangan suplai, tegangan maju LED dari datasheet, dan resistor pembatas.
3. **Contoh hitung:** `R=(Vs−Vf)/I`. Jika `Vs=5 V`, `Vf≈2 V`, target `I≈9 mA`: `R≈333 Ω`; nilai umum `330 Ω` menghasilkan `(5−2)/330≈9,1 mA`. **Angka ini hanya ilustrasi**; LED nyata dan sumber memerlukan verifikasi spesifikasi.
4. **Routing virtual:** hubungkan `SRC.VCC → R1.1`, `R1.2 → D1.A`, `D1.K → SRC.GND`. Trainer menandai salah/benar dan membandingkan koneksi dengan net yang diharapkan.
5. **Tes pemahaman:** apa akibat sambungan langsung VCC→GND? Apa fungsi R? Kenapa LED punya polaritas?
6. **Latihan fisik opsional:** baru pakai sumber **USB 5 V dibatasi arus**, breadboard, resistor, LED, tanpa catu AC rumah dan tanpa baterai lithium mentah.

## Rekomendasi perlengkapan belajar, tanpa harga atau klaim produk yang belum dicek

**Tahap awal:** browser SirkuitLab, kertas, kalkulator, breadboard, kabel jumper, resistor seri (330 Ω dan 1 kΩ), LED, multimeter untuk DC rendah, serta catu USB 5 V yang memiliki proteksi arus. Untuk pelajar pemula jangan gunakan wiring rumah 230 V atau percobaan langsung di panel listrik.

**Tahap 2:** development board ESP32 yang jelas dokumentasi pinout dan level logikanya; pilih varian berdasarkan antarmuka dan firmware. Tambahkan sensor digital/I²C 3,3 V dengan datasheet dan modul pull-up yang jelas. Lakukan dokumentasi setiap koneksi.

**Tahap 3:** driver motor yang rating tegangan/arusnya sesuai **arus stall** motor, motor gear kecil, roda dan housing, serta sumber DC berpengaman. Jangan memilih driver hanya dari arus nominal motor. Hindari percobaan paket sel lithium tanpa BMS/proteksi dan pengawasan kompeten.

**Tahap 4:** software Home Assistant dan ESPHome untuk smart home, serta ROS 2 Lyrical Luth untuk dasar robot modular. Untuk komputer spesifikasi sederhana, dahulukan IDE/editor ringan, serial monitor, dan ROS 2 turtlesim ketimbang simulasi 3D GPU berat.

## Acuan praktik dan standar yang dapat dilacak (status dicek Oktober 2026)

- **KiCad 10.0**, rilis 20 Maret 2026: [panduan resmi tutorial skematik, ERC, PCB, routing, DRC, output](https://docs.kicad.org/10.0/en/getting_started_in_kicad/getting_started_in_kicad.html). KiCad dijadikan **referensi workflow EDA**, bukan klaim bahwa seluruh fungsinya sudah ada di SirkuitLab.
- **IPC:** [Design for Manufacturing berdasarkan IPC](https://www.ipc.org/design-manufacturing-confirmed-ipc-standards) merujuk ke IPC-2221, IPC-2222, IPC-6012, IPC-7351 dan J-STD-001. Standar penuh berlisensi dan harus diperoleh secara sah bila dibutuhkan.
- **Indonesia:** [SNI 0225-2:2020 / PUIL desain instalasi](https://pesta.bsn.go.id/produk/detail/12857-sni0225-22020); bukan sertifikat bagi pengguna aplikasi.
- **ESP-IDF**: [dokumentasi pengembangan firmware resmi](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/linux-macos-setup.html), pengujian MCU dan peripheral; validasi harus mengikuti **model board** yang dipakai.
- **Home Assistant Assist:** [kontrol suara resmi](https://www.home-assistant.io/voice_control/) yang dapat berjalan lokal jika perangkat dan layanan kompatibel.
- **Matter 1.5**: [pengumuman Connectivity Standards Alliance (20 November 2025)](https://csa-iot.org/newsroom/matter-1-5-introduces-cameras-closures-and-enhanced-energy-management-capabilities/); dukungan perangkat harus dicek per vendor/controller, bukan diasumsikan otomatis.
- **ROS 2:** [daftar rilis dan dukungan](https://github.com/ros2/ros2_documentation/blob/rolling/source/Releases.rst), termasuk **Lyrical Luth** (Mei 2026, LTS hingga Mei 2031).

### Apa yang belum teruji di SirkuitLab

Academy adalah **kurikulum dan trainer interaktif**, bukan lab hardware tertutup atau lisensi profesional. Eksperimen routing membandingkan koneksi yang benar pada tiga contoh pembelajaran. Ia tidak menguji arus fisik, pemanasan, hambatan kontak, isolasi jaringan AC, EMI, ground bounce, EMC, nilai sensor sebenarnya, ketahanan PCB, atau kelayakan instalasi lapangan. Gunakan KiCad untuk verifikasi silang desain EDA dan fasilitas lab nyata sebelum fabrikasi.

## Cara belajar yang masuk akal

Setelah setiap pelajaran, jawablah kuis dan centang praktik **hanya jika benar-benar dicoba**; keduanya diperlukan agar progres terhitung selesai. Bila tidak paham, ulangi, cari datasheet, atau buat eksperimen virtual terkontrol. Simpan file `BACKUP` lokal. Progres Academy bersifat kumulatif dan dapat ikut dalam proyek cloud terenkripsi / arsip portable baru jika mekanisme sinkronisasi tersedia. File backup lokal JSON **tidak terenkripsi**: simpan privat.
