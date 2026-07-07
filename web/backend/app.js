const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const devicesRoutes = require('./routes/devices.routes');
const experimentsRoutes = require('./routes/experiments.routes');
const alertsRoutes = require('./routes/alerts.routes');
const reportsRoutes = require('./routes/reports.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const settingsRoutes = require('./routes/settings.routes');

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
if (env.nodeEnv === 'development') app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/experiments', experimentsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan.' }));
app.use(errorHandler);

module.exports = app;