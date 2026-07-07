/**
 * Membuat akun super_admin pertama, langsung aktif.
 * Jalankan: npm run create-super-admin
 * (Pastikan .env sudah berisi SUPER_ADMIN_NAME/EMAIL/PASSWORD, atau edit di sini.)
 */
const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');
const env = require('../config/env');

async function main() {
  const { name, email, password } = env.superAdmin;

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows[0]) {
    console.log(`[seed] User dengan email ${email} sudah ada. Tidak membuat duplikat.`);
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'super_admin', TRUE)
     RETURNING id, name, email, role`,
    [name, email.toLowerCase(), hash]
  );

  console.log('[seed] Super admin berhasil dibuat:');
  console.log(result.rows[0]);
  console.log(`[seed] Login dengan email: ${email} dan password sesuai SUPER_ADMIN_PASSWORD di .env`);

  await pool.end();
}

main().catch((err) => {
  console.error('[seed] Gagal membuat super admin:', err);
  process.exit(1);
});
