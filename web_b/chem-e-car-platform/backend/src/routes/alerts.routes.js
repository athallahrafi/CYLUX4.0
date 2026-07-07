const { Router } = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

/** GET /api/alerts?unread=true&limit=50 */
router.get('/', asyncHandler(async (req, res) => {
  const { unread, limit = 50 } = req.query;
  const conditions = [];
  const params = [];
  if (unread === 'true') conditions.push('is_read = FALSE');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const result = await query(
    `SELECT a.*, e.name AS experiment_name
     FROM alerts a
     LEFT JOIN experiments e ON e.id = a.experiment_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  res.json(result.rows);
}));

/** GET /api/alerts/unread-count — untuk badge lonceng di sidebar */
router.get('/unread-count', asyncHandler(async (req, res) => {
  const result = await query('SELECT COUNT(*)::int AS count FROM alerts WHERE is_read = FALSE');
  res.json(result.rows[0]);
}));

/** PATCH /api/alerts/:id/read */
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const result = await query('UPDATE alerts SET is_read = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ message: 'Alert tidak ditemukan.' });
  res.json(result.rows[0]);
}));

/** PATCH /api/alerts/read-all */
router.patch('/read-all', asyncHandler(async (req, res) => {
  await query('UPDATE alerts SET is_read = TRUE WHERE is_read = FALSE');
  res.json({ message: 'Semua alert ditandai sudah dibaca.' });
}));

module.exports = router;
