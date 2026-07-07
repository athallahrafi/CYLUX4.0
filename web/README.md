# Chem-E-Car Monitoring System

Struktur proyek:
```
chemecar-project/
├── backend/     → Express API + Socket.IO + MQTT bridge + PostgreSQL
└── frontend/    → React (Vite) dashboard
```

## 1. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env sesuai koneksi PostgreSQL & broker MQTT kamu
npm run dev
```

Backend jalan di `http://localhost:4000`.

Buat tabel `races` di PostgreSQL (contoh minimal):
```sql
CREATE TABLE races (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 2. Setup Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend jalan di `http://localhost:5173` (default Vite).

## 3. Alur Data

```
ESP32-C3 (MQTT publish) → Backend (subscribe MQTT) → Socket.IO emit → Frontend (real-time update)
```

Topic MQTT default (bisa diubah di `.env` backend):
- `chemecar/telemetry` → data sensor real-time
- `chemecar/status` → status perangkat
- `chemecar/control` → perintah kontrol ke Arduino/ESP32

## 4. Struktur Backend

```
backend/
├── index.js           → entry point (Express + Socket.IO server)
├── config/
│   ├── db.js           → koneksi PostgreSQL (pg Pool)
│   └── mqtt.js          → koneksi MQTT + bridge ke Socket.IO
└── routes/
    └── races.js         → contoh REST API untuk data race/trial
```

## 5. Next Steps yang Disarankan

- Tambah tabel `telemetry_logs` untuk menyimpan histori data sensor per race
- Tambah endpoint kalibrasi sensor
- Tambah autentikasi kalau dashboard dipakai banyak orang
- Sesuaikan payload MQTT dengan format JSON yang dikirim ESP32-C3
