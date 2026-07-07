const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[error]', err);

  // Pelanggaran unique constraint PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({ message: 'Data sudah ada (duplikat).', detail: err.detail });
  }
  // Foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ message: 'Referensi data tidak valid.', detail: err.detail });
  }

  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Terjadi kesalahan pada server.',
    stack: env.nodeEnv === 'development' ? err.stack : undefined,
  });
}

module.exports = { errorHandler };
