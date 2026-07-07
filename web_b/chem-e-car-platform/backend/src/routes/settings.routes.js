const { Router } = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

/** GET /api/settings — semua role boleh baca (dipakai sebagai default form) */
router.get('/', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM system_settings WHERE id = 1');
  res.json(result.rows[0]);
}));

/** PATCH /api/settings — hanya super_admin */
router.patch('/', requireRole('super_admin'), asyncHandler(async (req, res) => {
  const {
    default_max_duration_sec, default_turbidity_threshold,
    voltage_low_threshold_v, temperature_high_threshold_c,
  } = req.body;

  const result = await query(
    `UPDATE system_settings SET
        default_max_duration_sec = COALESCE($1, default_max_duration_sec),
        default_turbidity_threshold = COALESCE($2, default_turbidity_threshold),
        voltage_low_threshold_v = COALESCE($3, voltage_low_threshold_v),
        temperature_high_threshold_c = COALESCE($4, temperature_high_threshold_c),
        updated_at = now()
     WHERE id = 1
     RETURNING *`,
    [default_max_duration_sec, default_turbidity_threshold, voltage_low_threshold_v, temperature_high_threshold_c]
  );
  res.json(result.rows[0]);
}));

module.exports = router;
