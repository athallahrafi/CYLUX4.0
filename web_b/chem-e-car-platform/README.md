# Chem-E-Car Research Platform

Sistem monitoring & kontrol mobil Chem-E-Car berbasis web: React (frontend), Express.js
(backend + MQTT gateway), dan PostgreSQL (database), dengan komunikasi real-time via
Socket.IO dan MQTT ke hardware (Arduino Nano + ESP32-C3).

## Fitur

1. **Kalibrasi Stopping** — pengambilan data reaksi kekeruhan (turbidity) selama 2 menit penuh, tanpa auto-stop, untuk menentukan ambang batas & waktu stopping sebelum race sesungguhnya.
2. **Live Monitoring / Trial Race** — tombol Start menjalankan mobil dengan countdown maksimal 2 menit; berhenti otomatis saat kekeruhan menyentuh ambang batas ATAU saat waktu habis (mana lebih dulu).
3. **Reporting & Analisa** — tiap race menghasilkan laporan otomatis: selisih jarak `|target - aktual|` (metrik penjurian AIChE), akurasi, efisiensi energi, daya rata-rata, dan perbandingan repeatability antar-run (mean & standar deviasi).
4. **Integrasi Hardware** — Arduino Nano (motor driver + sensor turbidity) → ESP32-C3 (MQTT gateway) → backend, lihat `firmware/README.md` untuk kontrak topic MQTT.
5. **Role-based Access Control** — `super_admin` > `admin` > `user` (researcher), dengan alur approval akun baru.
6. **Dashboard riset yang bersih** — mengikuti gaya UI referensi: card statistik, grafik real-time, tabel riwayat, panel alert.

## Mengapa metrik "selisih jarak" (bukan cuma %)?

Berdasarkan aturan kompetisi Chem-E-Car AIChE: tiap tim menjalankan mobil maksimal
**2 menit** per ronde (2 ronde), lalu **dinilai dari seberapa dekat jarak aktual terhadap
jarak target** yang baru diumumkan pagi hari lomba (bukan dari kecepatan atau desain semata).
Karena itu laporan di sistem ini memprioritaskan `distance_error_m = |target - aktual|`
sebagai metrik utama, ditambah statistik repeatability (di halaman **Compare**) untuk
membantu tim memilih parameter reaksi yang paling konsisten.

---

## Struktur Folder

```
chem-e-car-platform/
├── database/           schema.sql, seed.sql
├── backend/             Express API + MQTT service + Socket.IO
├── frontend/             React (Vite) + Tailwind
├── firmware/              contoh kode ESP32-C3 & Arduino Nano + kontrak MQTT
├── docker-compose.yml      Postgres + Mosquitto untuk development lokal
└── mosquitto.conf
```

## Arsitektur Data Real-time

```
Arduino Nano --Serial--> ESP32-C3 --MQTT--> Backend --Socket.IO--> Browser (React)
                                       |
                                       └──> PostgreSQL (sensor_readings, experiments, reports)
```

- Backend menjalankan **state machine** (`experimentEngine.js`) yang mengatur countdown,
  auto-stop berdasarkan ambang batas kekeruhan, generate alert, dan generate laporan otomatis
  begitu experiment selesai.
- Semua data sensor disimpan ke PostgreSQL SEKALIGUS di-broadcast real-time ke frontend,
  jadi riwayat tetap lengkap walau browser di-refresh.

---

## Instalasi & Menjalankan (Development)

### 1. Siapkan Postgres & MQTT broker

Cara termudah — pakai Docker:
```bash
docker compose up -d
```
Ini menjalankan Postgres (auto-import `schema.sql` + `seed.sql`) dan Mosquitto di `localhost:1883`.

Tanpa Docker: install PostgreSQL & Mosquitto manual, lalu jalankan:
```bash
psql -U postgres -c "CREATE DATABASE chem_e_car"
psql -U postgres -d chem_e_car -f database/schema.sql
psql -U postgres -d chem_e_car -f database/seed.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env     # sesuaikan kredensial DB/MQTT bila perlu
npm install
npm run create-super-admin   # buat akun super_admin pertama (lihat kredensial di .env)
npm run dev                   # jalan di http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                   # jalan di http://localhost:5173
```

Login dengan email/password `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` dari `backend/.env`.

### 4. Hardware

Flash `firmware/esp32_gateway/esp32_gateway.ino` ke ESP32-C3 dan
`firmware/arduino_nano/arduino_nano.ino` ke Arduino Nano (sesuaikan pin & kalibrasi sensor
terlebih dahulu). Lalu daftarkan device di halaman **Devices** (role admin+) dengan
`mqtt_client_id` yang **sama persis** dengan `DEVICE_ID` di firmware ESP32.

---

## Role & Hak Akses

| Aksi | Researcher (`user`) | `admin` | `super_admin` |
|---|:---:|:---:|:---:|
| Lihat dashboard, experiment, laporan | ✅ | ✅ | ✅ |
| Buat & jalankan experiment sendiri | ✅ | ✅ | ✅ |
| Start/stop experiment milik orang lain | ❌ | ✅ | ✅ |
| Kelola device | ❌ | ✅ | ✅ |
| Approve akun baru / nonaktifkan user | ❌ | ✅ | ✅ |
| Ubah role pengguna | ❌ | ❌ | ✅ |
| Hapus experiment/device/user | ❌ | sebagian | ✅ |
| Ubah system settings (threshold default) | ❌ | ❌ | ✅ |

Registrasi akun baru (`/register`) otomatis berstatus **pending** (`is_active = false`)
sampai disetujui admin/super_admin di halaman **Users**.

---

## Catatan Pengembangan Lanjutan

Beberapa hal yang sengaja disederhanakan untuk MVP dan bisa dikembangkan lebih lanjut
sesuai kebutuhan tim (silakan sampaikan penyesuaian yang diinginkan):

- **State experiment disimpan in-memory** di satu proses backend — cukup untuk kebutuhan
  satu tim riset; jika nanti perlu multi-instance/scale, pindahkan ke Redis.
- **Belum ada email verification/reset password** — akun dibuat langsung oleh admin atau
  lewat approval manual.
- **Export laporan** (PDF/Excel per experiment) belum diimplementasikan — struktur data
  di tabel `reports` sudah siap untuk ditambahkan endpoint export kapan saja.
- **Kalibrasi sensor turbidity/arus/suhu** di firmware Arduino masih placeholder linear —
  wajib dikalibrasi ulang dengan sensor & rangkaian nyata tim sebelum dipakai di lomba.
