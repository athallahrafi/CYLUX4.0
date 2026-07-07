const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

/**
 * GET /api/users
 * admin & super_admin bisa melihat daftar seluruh user (termasuk yang pending).
 */
router.get('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, email, role, is_active, created_at
     FROM users ORDER BY created_at DESC`
  );
  res.json(result.rows);
}));

/**
 * POST /api/users
 * admin/super_admin membuat akun langsung (aktif, dengan role tertentu).
 * admin hanya boleh membuat role 'user'; hanya super_admin boleh membuat 'admin'/'super_admin'.
 */
router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, email, password, role = 'user' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
  }
  if (role !== 'user' && req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Hanya super admin yang boleh membuat akun admin.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING id, name, email, role, is_active, created_at`,
    [name, email.toLowerCase().trim(), hash, role]
  );
  res.status(201).json(result.rows[0]);
}));

/**
 * PATCH /api/users/:id/activate
 * Menyetujui pendaftaran user baru.
 */
router.patch('/:id/activate', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE users SET is_active = TRUE WHERE id = $1
     RETURNING id, name, email, role, is_active`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
  res.json(result.rows[0]);
}));

/**
 * PATCH /api/users/:id/deactivate
 */
router.patch('/:id/deactivate', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE users SET is_active = FALSE WHERE id = $1
     RETURNING id, name, email, role, is_active`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
  res.json(result.rows[0]);
}));

/**
 * PATCH /api/users/:id/role
 * Hanya super_admin yang boleh mengubah role (mencegah admin menaikkan dirinya sendiri).
 */
router.patch('/:id/role', requireRole('super_admin'), asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin', 'super_admin'].includes(role)) {
    return res.status(400).json({ message: 'Role tidak valid.' });
  }
  const result = await query(
    `UPDATE users SET role = $1 WHERE id = $2
     RETURNING id, name, email, role, is_active`,
    [role, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
  res.json(result.rows[0]);
}));

/**
 * DELETE /api/users/:id
 * Hanya super_admin.
 */
router.delete('/:id', requireRole('super_admin'), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri.' });
  }
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;