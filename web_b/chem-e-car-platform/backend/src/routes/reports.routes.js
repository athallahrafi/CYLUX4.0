const { Router } = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const reportService = require('../services/reportService');

const router = Router();
router.use(requireAuth);

/**
 * GET /api/reports/compare/list?ids=uuid1,uuid2,uuid3
 * Mengembalikan experiment + report + readings untuk beberapa experiment sekaligus,
 * plus statistik repeatability (mean & std dev jarak) — dipakai halaman "Compare".
 * Didefinisikan SEBELUM /:experimentId supaya 'compare' tidak dianggap sebagai id.
 */
router.get('/compare/list', asyncHandler(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').filter(Boolean);
  if (ids.length < 2) {
    return res.status(400).json({ message: 'Minimal 2 experiment id untuk dibandingkan (?ids=a,b).' });
  }

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const experimentsResult = await query(
    `SELECT e.*, u.name AS operator_name, r.distance_error_m, r.accuracy_percent,
            r.efficiency_wh_per_m, r.avg_power_w, r.peak_current_a, r.peak_temperature_c, r.total_energy_wh
     FROM experiments e
     JOIN users u ON u.id = e.operator_id
     LEFT JOIN reports r ON r.experiment_id = e.id
     WHERE e.id IN (${placeholders})`,
    ids
  );

  const readingsResult = await query(
    `SELECT experiment_id, elapsed_ms, distance_m, voltage_v, current_a, temperature_c, turbidity_ntu
     FROM sensor_readings WHERE experiment_id IN (${placeholders}) ORDER BY elapsed_ms ASC`,
    ids
  );

  const readingsByExperiment = {};
  for (const row of readingsResult.rows) {
    if (!readingsByExperiment[row.experiment_id]) readingsByExperiment[row.experiment_id] = [];
    readingsByExperiment[row.experiment_id].push(row);
  }

  const repeatability = reportService.computeRepeatability(experimentsResult.rows);

  res.json({
    experiments: experimentsResult.rows.map((e) => ({ ...e, readings: readingsByExperiment[e.id] || [] })),
    repeatability,
  });
}));

/**
 * GET /api/reports/:experimentId
 * Mengembalikan report yang tersimpan; jika belum ada (mis. experiment lama
 * sebelum fitur report aktif) maka dihitung ulang secara on-demand.
 */
router.get('/:experimentId', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM reports WHERE experiment_id = $1', [req.params.experimentId]);
  if (!result.rows[0]) {
    const generated = await reportService.generateReport(req.params.experimentId);
    if (!generated) return res.status(404).json({ message: 'Belum ada data sensor untuk experiment ini.' });
    return res.json(generated);
  }
  res.json(result.rows[0]);
}));

module.exports = router;
