const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // Tidak melempar error saat import supaya dev experience tetap enak,
    // tapi peringatkan di console.
    console.warn(`[env] Peringatan: variabel ${name} belum di-set.`);
  }
  return value;
}

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  jwtSecret: required('JWT_SECRET', 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  db: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'chem_e_car',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  },

  mqtt: {
    url: process.env.MQTT_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    baseTopic: process.env.MQTT_BASE_TOPIC || 'chemcar',
  },

  superAdmin: {
    name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@chemcar.local',
    password: process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!',
  },
};
