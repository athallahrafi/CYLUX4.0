const { Router } = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

/**
 * GET /api/dashboard/summary
 * Data ringkas untuk halaman Overview: experiment aktif (jika ada),
 * total experiment, rata-rata akurasi, jumlah device online, alert terbaru.
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const activeExperiment = await query(
    `SELECT e.*, d.name AS device_name
     FROM experiments e LEFT JOIN devices d ON d.id = e.device_id
     WHERE e.status = 'running' ORDER BY e.started_at DESC LIMIT 1`
  );

  const totals = await query(
    `SELECT
        COUNT(*)::int AS total_experiments,
        COUNT(*) FILTER (
          WHERE status IN ('stopped_threshold', 'stopped_timeout', 'stopped_manual', 'completed')
        )::int AS finished_experiments,
        ROUND(AVG(r.accuracy_percent)::numeric, 1) AS avg_accuracy
     FROM experiments e LEFT JOIN reports r ON r.experiment_id = e.id`
  );

  const devices = await query(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'online')::int AS online FROM devices`
  );

  const recentExperiments = await query(
    `SELECT e.id, e.name, e.mode, e.status, e.target_distance_m, e.actual_distance_m,
            e.created_at, r.accuracy_percent
     FROM experiments e LEFT JOIN reports r ON r.experiment_id = e.id
     ORDER BY e.created_at DESC LIMIT 5`
  );

  const recentAlerts = await query(
    `SELECT * FROM alerts ORDER BY created_at DESC LIMIT 5`
  );

  res.json({
    activeExperiment: activeExperiment.rows[0] || null,
    totals: totals.rows[0],
    devices: devices.rows[0],
    recentExperiments: recentExperiments.rows,
    recentAlerts: recentAlerts.rows,
  });
}));

module.exports = router;
