-- ============================================================================
-- Seed data opsional — device contoh sesuai perangkat yang disebutkan user.
-- Akun super admin TIDAK dibuat di sini (password harus di-hash dengan bcrypt).
-- Gunakan: node backend/src/scripts/createSuperAdmin.js
-- ============================================================================

INSERT INTO devices (name, device_type, mqtt_client_id, status, firmware_version)
VALUES
  ('ESP32-C3 Gateway #1', 'esp32_gateway', 'esp32-gw-01', 'offline', '1.0.0'),
  ('Arduino Nano Controller #1', 'arduino_nano', 'nano-ctrl-01', 'offline', '1.0.0')
ON CONFLICT (mqtt_client_id) DO NOTHING;
