const { query } = require('../config/db');
const socketService = require('./socketService');
const reportService = require('./reportService');

// Lazy require untuk menghindari masalah circular dependency dengan mqttService
// (mqttService juga me-require experimentEngine untuk meneruskan pesan MQTT masuk).
function getMqttService() {
  // eslint-disable-next-line global-require
  return require('./mqttService');
}

// ---------------------------------------------------------------------------
// State in-memory (cukup untuk single-instance backend / skala tim riset).
// Jika nanti perlu multi-instance, pindahkan ke Redis.
// ---------------------------------------------------------------------------
const activeSessions = new Map();   // experimentId -> session
const deviceToExperiment = new Map(); // mqtt_client_id -> experimentId

let settingsCache = { data: null, fetchedAt: 0 };
async function getSettings() {
  if (Date.now() - settingsCache.fetchedAt > 5000) {
    const result = await query('SELECT * FROM system_settings WHERE id = 1');
    settingsCache = { data: result.rows[0], fetchedAt: Date.now() };
  }
  return settingsCache.data;
}

async function createAlert({ experimentId, deviceId, severity, title, message, value, threshold }) {
  const result = await query(
    `INSERT INTO alerts (experiment_id, device_id, severity, title, message, value, threshold)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [experimentId || null, deviceId || null, severity, title, message || null, value ?? null, threshold ?? null]
  );
  socketService.emitAlert(result.rows[0]);
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// START
// ---------------------------------------------------------------------------
async function startExperiment(experimentId) {
  const expResult = await query('SELECT * FROM experiments WHERE id = $1', [experimentId]);
  const experiment = expResult.rows[0];
  if (!experiment) throw new Error('Experiment tidak ditemukan.');
  if (experiment.status !== 'pending') {
    throw new Error(`Experiment berstatus '${experiment.status}', tidak bisa dimulai lagi.`);
  }

  const deviceResult = await query('SELECT * FROM devices WHERE id = $1', [experiment.device_id]);
  const device = deviceResult.rows[0];
  if (!device) throw new Error('Device untuk experiment ini belum ditentukan.');

  const updated = await query(
    `UPDATE experiments SET status = 'running', started_at = now() WHERE id = $1 RETURNING *`,
    [experimentId]
  );
  const runningExperiment = updated.rows[0];

  const session = {
    experiment: runningExperiment,
    deviceMqttId: device.mqtt_client_id,
    startedAtMs: Date.now(),
    lastDistance: 0,
    lastEnergyWh: 0,
    lastPowerW: 0,
    lastTsMs: Date.now(),
    thresholdCrossedMs: null,
    stopping: false,
  };

  activeSessions.set(experimentId, session);
  deviceToExperiment.set(device.mqtt_client_id, experimentId);

  // Kirim perintah start ke ESP32 gateway -> diteruskan ke Arduino Nano via serial
  getMqttService().publishCommand(device.mqtt_client_id, {
    action: 'start',
    mode: runningExperiment.mode,
    duration_ms: runningExperiment.max_duration_sec * 1000,
    turbidity_threshold: runningExperiment.turbidity_threshold,
  });

  // Aturan kompetisi AIChE: durasi maksimum berjalan (default 120 detik / 2 menit)
  session.timer = setTimeout(() => {
    const reason = runningExperiment.mode === 'calibration' ? 'completed' : 'stopped_timeout';
    stopExperiment(experimentId, reason).catch((err) => console.error('[engine] auto-stop error', err));
  }, runningExperiment.max_duration_sec * 1000);

  socketService.emitExperimentStatus(runningExperiment);
  return runningExperiment;
}

// ---------------------------------------------------------------------------
// STOP (dipanggil oleh: timeout, threshold kekeruhan, tombol manual, device error)
// ---------------------------------------------------------------------------
async function stopExperiment(experimentId, reason) {
  const session = activeSessions.get(experimentId);
  if (!session || session.stopping) return null;
  session.stopping = true;

  if (session.timer) clearTimeout(session.timer);

  try {
    getMqttService().publishCommand(session.deviceMqttId, { action: 'stop' });
  } catch (err) {
    console.error('[engine] gagal publish stop cmd', err);
  }

  const updated = await query(
    `UPDATE experiments
     SET status = $1, ended_at = now(),
         actual_distance_m = COALESCE(actual_distance_m, $2),
         stop_reason = $3,
         threshold_crossed_ms = COALESCE(threshold_crossed_ms, $4)
     WHERE id = $5
     RETURNING *`,
    [reason, session.lastDistance, describeStopReason(reason), session.thresholdCrossedMs, experimentId]
  );
  const finalExperiment = updated.rows[0];

  activeSessions.delete(experimentId);
  deviceToExperiment.delete(session.deviceMqttId);

  socketService.emitExperimentStatus(finalExperiment);

  try {
    await reportService.generateReport(experimentId);
  } catch (err) {
    console.error('[engine] gagal generate report', err);
  }

  return finalExperiment;
}

function describeStopReason(reason) {
  const map = {
    stopped_threshold: 'Berhenti otomatis: kekeruhan (turbidity) mencapai ambang batas.',
    stopped_timeout: 'Berhenti otomatis: durasi maksimum 2 menit tercapai.',
    stopped_manual: 'Dihentikan manual oleh operator.',
    completed: 'Pengambilan data kalibrasi selesai (durasi penuh).',
    failed: 'Dihentikan paksa: koneksi device terputus.',
  };
  return map[reason] || reason;
}

async function manualStop(experimentId) {
  return stopExperiment(experimentId, 'stopped_manual');
}

// ---------------------------------------------------------------------------
// TELEMETRY MASUK (dari ESP32 gateway, hasil forward data Arduino Nano)
// Payload contoh: { elapsed_ms, distance_m, voltage_v, current_a, temperature_c, turbidity_ntu }
// ---------------------------------------------------------------------------
async function handleTelemetry(deviceMqttId, payload) {
  const experimentId = deviceToExperiment.get(deviceMqttId);
  if (!experimentId) return; // tidak ada experiment aktif untuk device ini, abaikan

  const session = activeSessions.get(experimentId);
  if (!session || session.stopping) return;

  const now = Date.now();
  const elapsedMs = Number.isFinite(payload.elapsed_ms) ? payload.elapsed_ms : now - session.startedAtMs;

  const voltage = numOrNull(payload.voltage_v);
  const current = numOrNull(payload.current_a);
  const power = voltage != null && current != null ? voltage * current : null;

  // Integrasi energi trapezoidal sederhana
  const dtHours = (now - session.lastTsMs) / 3_600_000;
  const avgPower = power != null ? (power + session.lastPowerW) / 2 : session.lastPowerW;
  session.lastEnergyWh += avgPower * dtHours;
  session.lastPowerW = power ?? session.lastPowerW;
  session.lastTsMs = now;

  const distance = numOrNull(payload.distance_m);
  if (distance != null) session.lastDistance = distance;

  const reading = await query(
    `INSERT INTO sensor_readings
       (experiment_id, elapsed_ms, distance_m, voltage_v, current_a, power_w, energy_wh, temperature_c, turbidity_ntu)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      experimentId, elapsedMs, distance, voltage, current, power,
      session.lastEnergyWh, numOrNull(payload.temperature_c), numOrNull(payload.turbidity_ntu),
    ]
  );

  socketService.emitSensorUpdate(experimentId, reading.rows[0]);

  await checkAlertThresholds(session, reading.rows[0]);

  const turbidity = numOrNull(payload.turbidity_ntu);
  const threshold = numOrNull(session.experiment.turbidity_threshold);

  if (turbidity != null && threshold != null && turbidity >= threshold) {
    if (session.thresholdCrossedMs == null) {
      session.thresholdCrossedMs = elapsedMs;
    }
    // Mode race: begitu kekeruhan menyentuh batas, mobil harus berhenti otomatis.
    // Mode kalibrasi: TIDAK auto-stop — data tetap dikumpulkan penuh 2 menit
    // agar kurva kekeruhan-vs-waktu lengkap untuk analisa tim.
    if (session.experiment.mode === 'race') {
      await stopExperiment(experimentId, 'stopped_threshold');
    }
  }
}

async function checkAlertThresholds(session, reading) {
  const settings = await getSettings();
  if (!settings) return;

  if (reading.voltage_v != null && Number(reading.voltage_v) < Number(settings.voltage_low_threshold_v)) {
    await createAlert({
      experimentId: session.experiment.id,
      severity: 'danger',
      title: 'Tegangan turun di bawah ambang batas',
      message: `Terdeteksi ${Number(reading.voltage_v).toFixed(2)} V`,
      value: reading.voltage_v,
      threshold: settings.voltage_low_threshold_v,
    });
  }
  if (reading.temperature_c != null && Number(reading.temperature_c) > Number(settings.temperature_high_threshold_c)) {
    await createAlert({
      experimentId: session.experiment.id,
      severity: 'warning',
      title: 'Suhu mulai tinggi',
      message: `Terdeteksi ${Number(reading.temperature_c).toFixed(1)} °C`,
      value: reading.temperature_c,
      threshold: settings.temperature_high_threshold_c,
    });
  }
}

// ---------------------------------------------------------------------------
// STATUS DEVICE (online/offline, kesehatan subsistem)
// ---------------------------------------------------------------------------
async function handleDeviceStatus(deviceMqttId, payload) {
  const status = payload.status === 'online' ? 'online' : (payload.status === 'error' ? 'error' : 'offline');

  const result = await query(
    `UPDATE devices
     SET status = $1, last_seen_at = now(), metadata = COALESCE($2, metadata),
         firmware_version = COALESCE($3, firmware_version)
     WHERE mqtt_client_id = $4
     RETURNING *`,
    [status, payload.metadata ? JSON.stringify(payload.metadata) : null, payload.firmware_version || null, deviceMqttId]
  );
  const device = result.rows[0];
  if (!device) return;

  socketService.emitDeviceStatus(device);

  // Jika device yang sedang dipakai experiment aktif tiba-tiba offline -> stop paksa
  if (status !== 'online') {
    const experimentId = deviceToExperiment.get(deviceMqttId);
    if (experimentId) {
      await createAlert({
        experimentId,
        deviceId: device.id,
        severity: 'danger',
        title: 'Device terputus saat experiment berjalan',
        message: `Device ${device.name} kehilangan koneksi.`,
      });
      await stopExperiment(experimentId, 'failed');
    }
  }
}

function numOrNull(v) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getActiveSessionInfo(experimentId) {
  const session = activeSessions.get(experimentId);
  if (!session) return null;
  return {
    elapsedMs: Date.now() - session.startedAtMs,
    remainingMs: Math.max(0, session.experiment.max_duration_sec * 1000 - (Date.now() - session.startedAtMs)),
    lastDistance: session.lastDistance,
    thresholdCrossedMs: session.thresholdCrossedMs,
  };
}

module.exports = {
  startExperiment,
  stopExperiment,
  manualStop,
  handleTelemetry,
  handleDeviceStatus,
  getActiveSessionInfo,
  createAlert,
};
