# Kontrak Komunikasi Hardware

```
Arduino Nano  <--Serial-->  ESP32-C3 Gateway  <--MQTT-->  Backend Express
(motor + sensor)            (WiFi bridge)                 (state machine + DB)
```

## Topic MQTT

Format: `{base}/{device_id}/{channel}` — default `base` = `chemcar`, `device_id` = kolom
`mqtt_client_id` pada tabel `devices` (mis. `esp32-gw-01`).

| Topic | Arah | Kapan dikirim | Contoh payload |
|---|---|---|---|
| `chemcar/{id}/telemetry` | ESP32 → Backend | Setiap sample sensor (disarankan 5×/detik) | `{"elapsed_ms":1200,"distance_m":1.84,"voltage_v":11.9,"current_a":10.1,"temperature_c":34.2,"turbidity_ntu":12.5}` |
| `chemcar/{id}/status` | ESP32 → Backend | Saat konek/berkala/LWT saat putus | `{"status":"online","firmware_version":"1.0.0","metadata":{"battery":"OK","motor_controller":"OK"}}` |
| `chemcar/{id}/cmd` | Backend → ESP32 | Saat tombol Start/Stop ditekan di web | `{"action":"start","mode":"race","duration_ms":120000,"turbidity_threshold":50}` |
| `chemcar/{id}/ack` | ESP32 → Backend | Konfirmasi command diterima (opsional, untuk log) | `{"received":"{...}"}` |

## Aturan penting

- **`elapsed_ms` opsional** — jika firmware tidak mengirimnya, backend menghitung sendiri
  dari waktu command `start` diterima server, supaya grafik "vs Time" tetap konsisten
  walau ada sedikit delay jaringan.
- **Mode `calibration`**: motor TIDAK aktif, hanya mengumpulkan data sensor
  (terutama `turbidity_ntu`) selama durasi penuh (2 menit), tidak auto-stop di ambang batas.
- **Mode `race`**: motor aktif; auto-stop terjadi di backend begitu `turbidity_ntu` ≥
  `turbidity_threshold`, ATAU saat `duration_ms` (maks. 120000 = 2 menit) tercapai —
  mana yang lebih dulu. Firmware Arduino juga punya fail-safe durasi lokal sebagai lapis kedua.
- **Status LWT (Last Will Testament)**: gateway mendaftarkan pesan `{"status":"offline"}`
  sebagai LWT saat connect ke broker, supaya backend langsung tahu jika ESP32 kehilangan
  koneksi mendadak (mis. WiFi putus di tengah race) dan menghentikan experiment sebagai `failed`.

## Broker MQTT

Untuk pengembangan lokal, jalankan Mosquitto lewat `docker-compose.yml` di root project
(lihat README utama). Untuk kompetisi di lokasi tanpa internet stabil, jalankan Mosquitto
di laptop/mini-PC yang sama dengan backend, dan pastikan ESP32-C3 terhubung ke WiFi hotspot
yang sama (mis. hotspot dari laptop tersebut).
