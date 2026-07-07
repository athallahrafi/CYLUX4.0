-- ============================================================================
-- Chem-E-Car Research Platform — PostgreSQL Schema
-- ============================================================================
-- Jalankan: psql -U <user> -d chem_e_car -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- untuk gen_random_uuid()

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'user');
CREATE TYPE device_type AS ENUM ('esp32_gateway', 'arduino_nano');
CREATE TYPE device_status AS ENUM ('online', 'offline', 'error');
CREATE TYPE experiment_mode AS ENUM ('calibration', 'race');
CREATE TYPE experiment_status AS ENUM (
  'pending',            -- dibuat, belum dijalankan
  'running',            -- sedang berjalan
  'completed',          -- mode kalibrasi selesai normal (durasi habis)
  'stopped_threshold',  -- race berhenti karena kekeruhan menyentuh batas
  'stopped_timeout',    -- race/kalibrasi berhenti karena 2 menit habis
  'stopped_manual',     -- dihentikan manual oleh operator
  'failed'              -- gagal / device disconnect saat berjalan
);
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'danger');

-- ---------------------------------------------------------------------------
-- USERS & AUTH
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'user',
  is_active     BOOLEAN NOT NULL DEFAULT FALSE, -- akun baru menunggu approval admin
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- DEVICES (ESP32 gateway & Arduino Nano)
-- ---------------------------------------------------------------------------
CREATE TABLE devices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(120) NOT NULL,
  device_type      device_type NOT NULL,
  mqtt_client_id   VARCHAR(120) NOT NULL UNIQUE, -- dipakai sebagai {device_id} di topic MQTT
  status           device_status NOT NULL DEFAULT 'offline',
  firmware_version VARCHAR(40),
  last_seen_at     TIMESTAMPTZ,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb, -- status subsistem: battery/motor/sensor OK dsb
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- EXPERIMENTS (satu baris = satu run, baik kalibrasi maupun race)
-- ---------------------------------------------------------------------------
CREATE TABLE experiments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(150) NOT NULL,
  mode                experiment_mode NOT NULL,
  status              experiment_status NOT NULL DEFAULT 'pending',
  operator_id         UUID NOT NULL REFERENCES users(id),
  device_id           UUID REFERENCES devices(id),

  -- Target & parameter kontrol race
  target_distance_m   NUMERIC(6,2),                 -- diisi wajib untuk mode 'race'
  turbidity_threshold NUMERIC(8,2),                 -- NTU, ambang batas stop kimia
  max_duration_sec    INTEGER NOT NULL DEFAULT 120, -- aturan kompetisi: maksimum 2 menit

  -- Snapshot parameter kendaraan (mengikuti panel "Parameters" di UI)
  battery_type        VARCHAR(60),
  nominal_voltage_v    NUMERIC(6,2),
  capacity_ah          NUMERIC(6,2),
  motor_type           VARCHAR(60),
  gear_ratio            VARCHAR(20),
  wheel_diameter_inch   NUMERIC(5,2),

  description         TEXT,

  -- Hasil akhir
  actual_distance_m   NUMERIC(6,2),
  stop_reason          TEXT,
  threshold_crossed_ms INTEGER, -- khusus kalibrasi: kapan turbidity menembus batas (ms sejak start)

  started_at          TIMESTAMPTZ,
  ended_at             TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_experiments_operator ON experiments(operator_id);
CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_mode ON experiments(mode);

-- ---------------------------------------------------------------------------
-- SENSOR READINGS (time-series telemetry per experiment)
-- ---------------------------------------------------------------------------
CREATE TABLE sensor_readings (
  id             BIGSERIAL PRIMARY KEY,
  experiment_id  UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  elapsed_ms     INTEGER NOT NULL,      -- waktu sejak start (ms) — dipakai untuk grafik "vs Time"
  distance_m     NUMERIC(6,3),
  voltage_v      NUMERIC(6,3),
  current_a      NUMERIC(6,3),
  power_w        NUMERIC(8,3),          -- = voltage_v * current_a
  energy_wh      NUMERIC(8,4),          -- kumulatif energi terpakai
  temperature_c  NUMERIC(5,2),
  turbidity_ntu  NUMERIC(8,2)
);

CREATE INDEX idx_readings_experiment_time ON sensor_readings(experiment_id, elapsed_ms);

-- ---------------------------------------------------------------------------
-- ALERTS
-- ---------------------------------------------------------------------------
CREATE TABLE alerts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id  UUID REFERENCES experiments(id) ON DELETE CASCADE,
  device_id      UUID REFERENCES devices(id),
  severity       alert_severity NOT NULL DEFAULT 'info',
  title          VARCHAR(150) NOT NULL,
  message        TEXT,
  value          NUMERIC(10,3),
  threshold      NUMERIC(10,3),
  is_read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_unread ON alerts(is_read, created_at DESC);

-- ---------------------------------------------------------------------------
-- REPORTS (hasil analisa yang dihitung setelah experiment selesai)
-- ---------------------------------------------------------------------------
CREATE TABLE reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id       UUID NOT NULL UNIQUE REFERENCES experiments(id) ON DELETE CASCADE,
  distance_error_m    NUMERIC(6,3), -- |target - actual|, metrik utama penjurian AIChE
  accuracy_percent    NUMERIC(5,2),
  efficiency_wh_per_m NUMERIC(8,4), -- energi / jarak
  avg_power_w         NUMERIC(8,3),
  peak_current_a      NUMERIC(6,3),
  peak_temperature_c  NUMERIC(5,2),
  peak_voltage_drop_v NUMERIC(6,3),
  total_energy_wh     NUMERIC(8,4),
  summary_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SYSTEM SETTINGS (satu baris konfigurasi global, editable oleh super_admin)
-- ---------------------------------------------------------------------------
CREATE TABLE system_settings (
  id                          SMALLINT PRIMARY KEY DEFAULT 1,
  default_max_duration_sec    INTEGER NOT NULL DEFAULT 120,
  default_turbidity_threshold NUMERIC(8,2) NOT NULL DEFAULT 50.0,
  voltage_low_threshold_v     NUMERIC(6,2) NOT NULL DEFAULT 10.5,
  temperature_high_threshold_c NUMERIC(5,2) NOT NULL DEFAULT 45.0,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO system_settings (id) VALUES (1);

-- ---------------------------------------------------------------------------
-- Trigger sederhana untuk updated_at pada users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
