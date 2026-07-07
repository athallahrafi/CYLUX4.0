const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { signToken } = require('../utils/jwt');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = Router();

/**
 * POST /api/auth/register
 * Registrasi mandiri -> role default 'user', is_active = FALSE.
 * Akun baru menunggu persetujuan admin/super_admin sebelum bisa login.
 */
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password minimal 8 karakter.' });
  }

  const hash = await bcrypt.hash(password, 10);

  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'user', FALSE)
     RETURNING id, name, email, role, is_active, created_at`,
    [name, email.toLowerCase().trim(), hash]
  );

  res.status(201).json({
    message: 'Registrasi berhasil. Akun Anda menunggu persetujuan admin.',
    user: result.rows[0],
  });
}));

/**
 * POST /api/auth/login
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi.' });
  }

  const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ message: 'Email atau password salah.' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ message: 'Email atau password salah.' });
  }

  if (!user.is_active) {
    return res.status(403).json({ message: 'Akun Anda belum diaktifkan oleh admin.' });
  }

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}));

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
  }
  res.json(result.rows[0]);
}));

module.exports = router;
