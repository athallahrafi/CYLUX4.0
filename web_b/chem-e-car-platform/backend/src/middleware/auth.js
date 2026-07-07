const { verifyToken } = require('../utils/jwt');

/**
 * Memverifikasi header Authorization: Bearer <token>.
 * Menyisipkan req.user = { id, email, role, name }.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Token otentikasi tidak ditemukan.' });
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid atau kadaluarsa.' });
  }
}

/**
 * Hirarki role: super_admin > admin > user.
 * requireRole('admin') berarti admin DAN super_admin diizinkan.
 * Untuk aksi yang benar-benar eksklusif super_admin, gunakan requireRole('super_admin').
 */
const ROLE_RANK = { user: 1, admin: 2, super_admin: 3 };

function requireRole(minRole) {
  return function roleCheck(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: 'Belum terautentikasi.' });
    }
    const userRank = ROLE_RANK[req.user.role] || 0;
    const minRank = ROLE_RANK[minRole] || 0;
    if (userRank < minRank) {
      return res.status(403).json({ message: 'Anda tidak memiliki izin untuk aksi ini.' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
