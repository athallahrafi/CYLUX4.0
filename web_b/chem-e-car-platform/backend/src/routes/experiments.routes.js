const { Router } = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const experimentEngine = require('../services/experimentEngine');

const router = Router();
router.use(requireAuth);

/**
 * GET /api/experiments
 * Query: ?status=running&mode=race&limit=50&offset=0
 * Seluruh role bisa melihat semua experiment (dashboard tim bersama),
 * sesuai gambar referensi UI (tabel "Recent Experiments" terlihat oleh semua orang).
 */
router.get('/', asyncHandler(async (req, res) => {
  const { status, mode, limit = 50, offset = 0 } = req.query;
  const conditions = [];
  const params = [];

  if (status) { params.push(status); conditions.push(`e.status = $${params.length}`); }
  if (mode) { params.push(mode); conditions.push(`e.mode = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const result = await query(
    `SELECT e.*, u.name AS operator_name, d.name AS device_name,
            r.distance_error_m, r.accuracy_percent
     FROM experiments e
     JOIN users u ON u.id = e.operator_id
     LEFT JOIN devices d ON d.id = e.device_id
     LEFT JOIN reports r ON r.experiment_id = e.id
     ${where}
     ORDER BY e.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json(result.rows);
}));

/** GET /api/experiments/:id */
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT e.*, u.name AS operator_name, d.name AS device_name
     FROM experiments e
     JOIN users u ON u.id = e.operator_id
     LEFT JOIN devices d ON d.id = e.device_id
     WHERE e.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ message: 'Experiment tidak ditemukan.' });

  const liveInfo = experimentEngine.getActiveSessionInfo(req.params.id);
  res.json({ ...result.rows[0], live: liveInfo });
}));

/** GET /api/experiments/:id/readings — data time-series untuk grafik */
router.get('/:id/readings', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT elapsed_ms, distance_m, voltage_v, current_a, power_w, energy_wh, temperature_c, turbidity_ntu
     FROM sensor_readings WHERE experiment_id = $1 ORDER BY elapsed_ms ASC`,
    [req.params.id]
  );
  res.json(result.rows);
}));

/**
 * POST /api/experiments
 * Membuat experiment baru berstatus 'pending' (belum berjalan).
 * mode = 'calibration' (fitur #1, data stopping 2 menit) atau 'race' (fitur #2, trial race).
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    name, mode, device_id,
    target_distance_m, turbidity_threshold, max_duration_sec,
    battery_type, nominal_voltage_v, capacity_ah, motor_type, gear_ratio, wheel_diameter_inch,
    description,
  } = req.body;

  if (!name || !mode || !device_id) {
    return res.status(400).json({ message: 'name, mode, dan device_id wajib diisi.' });
  }
  if (!['calibration', 'race'].includes(mode)) {
    return res.status(400).json({ message: "mode harus 'calibration' atau 'race'." });
  }
  if (mode === 'race' && !target_distance_m) {
    return res.status(400).json({ message: 'target_distance_m wajib diisi untuk mode race.' });
  }

  const settingsResult = await query('SELECT * FROM system_settings WHERE id = 1');
  const settings = settingsResult.rows[0];

  const result = await query(
    `INSERT INTO experiments (
        name, mode, operator_id, device_id, target_distance_m, turbidity_threshold, max_duration_sec,
        battery_type, nominal_voltage_v, capacity_ah, motor_type, gear_ratio, wheel_diameter_inch, description
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      name, mode, req.user.id, device_id,
      target_distance_m || null,
      turbidity_threshold ?? settings.default_turbidity_threshold,
      Math.min(max_duration_sec || settings.default_max_duration_sec, 120), // hard cap 2 menit sesuai aturan kompetisi
      battery_type || null, nominal_voltage_v || null, capacity_ah || null,
      motor_type || null, gear_ratio || null, wheel_diameter_inch || null,
      description || null,
    ]
  );
  res.status(201).json(result.rows[0]);
}));

/**
 * POST /api/experiments/:id/start
 * Pemilik experiment atau admin+ boleh memulai.
 */
router.post('/:id/start', asyncHandler(async (req, res) => {
  const check = await query('SELECT operator_id FROM experiments WHERE id = $1', [req.params.id]);
  if (!check.rows[0]) return res.status(404).json({ message: 'Experiment tidak ditemukan.' });
  if (check.rows[0].operator_id !== req.user.id && req.user.role === 'user') {
    return res.status(403).json({ message: 'Hanya operator experiment ini atau admin yang boleh memulai.' });
  }

  const experiment = await experimentEngine.startExperiment(req.params.id);
  res.json(experiment);
}));

/**
 * POST /api/experiments/:id/stop — stop manual dari tombol "End Experiment"
 */
router.post('/:id/stop', asyncHandler(async (req, res) => {
  const check = await query('SELECT operator_id FROM experiments WHERE id = $1', [req.params.id]);
  if (!check.rows[0]) return res.status(404).json({ message: 'Experiment tidak ditemukan.' });
  if (check.rows[0].operator_id !== req.user.id && req.user.role === 'user') {
    return res.status(403).json({ message: 'Hanya operator experiment ini atau admin yang boleh menghentikan.' });
  }

  const experiment = await experimentEngine.manualStop(req.params.id);
  res.json(experiment);
}));

/** DELETE /api/experiments/:id — admin+ */
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  await query('DELETE FROM experiments WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
