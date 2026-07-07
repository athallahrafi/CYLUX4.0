const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool(env.db);

pool.on('error', (err) => {
  console.error('[db] Unexpected error pada idle client', err);
});

/**
 * Helper query terpusat supaya semua route memakai pola yang sama
 * dan mudah ditambahkan logging/tracing di satu tempat.
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (env.nodeEnv === 'development') {
    const duration = Date.now() - start;
    console.log('[db]', text.replace(/\s+/g, ' ').trim().slice(0, 120), { duration, rows: res.rowCount });
  }
  return res;
}

module.exports = { pool, query };
