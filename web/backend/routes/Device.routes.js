const { Router } = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

/** GET /api/devices — semua role boleh melihat (untuk pilih device saat start race) */
router.get('/', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM devices ORDER BY created_at DESC');
  res.json(result.rows);
}));

/** GET /api/devices/:id */
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM devices WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ message: 'Device tidak ditemukan.' });
  res.json(result.rows[0]);
}));

/** POST /api/devices — admin+ */
router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, device_type, mqtt_client_id, firmware_version } = req.body;
  if (!name || !device_type || !mqtt_client_id) {
    return res.status(400).json({ message: 'name, device_type, dan mqtt_client_id wajib diisi.' });
  }
  const result = await query(
    `INSERT INTO devices (name, device_type, mqtt_client_id, firmware_version)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, device_type, mqtt_client_id, firmware_version || null]
  );
  res.status(201).json(result.rows[0]);
}));

/** PATCH /api/devices/:id — admin+ */
router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, firmware_version } = req.body;
  const result = await query(
    `UPDATE devices SET name = COALESCE($1, name), firmware_version = COALESCE($2, firmware_version)
     WHERE id = $3 RETURNING *`,
    [name, firmware_version, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ message: 'Device tidak ditemukan.' });
  res.json(result.rows[0]);
}));

/** DELETE /api/devices/:id — super_admin */
router.delete('/:id', requireRole('super_admin'), asyncHandler(async (req, res) => {
  await query('DELETE FROM devices WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;