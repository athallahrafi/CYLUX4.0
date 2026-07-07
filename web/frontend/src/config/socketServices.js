const { Server } = require('socket.io');
const env = require('../config/env');
const { verifyToken } = require('../utils/jwt');

let io = null;

function init(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  // Autentikasi socket pakai JWT yang sama dengan REST API
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Token tidak ditemukan.'));
      const payload = verifyToken(token);
      socket.user = { id: payload.sub, role: payload.role, name: payload.name };
      return next();
    } catch (err) {
      return next(new Error('Token tidak valid.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] ${socket.user.name} terhubung (${socket.id})`);

    // Client join room per-experiment supaya broadcast lebih terarah,
    // dan room global untuk alert/status device.
    socket.on('experiment:subscribe', (experimentId) => {
      socket.join(`experiment:${experimentId}`);
    });
    socket.on('experiment:unsubscribe', (experimentId) => {
      socket.leave(`experiment:${experimentId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] ${socket.user.name} terputus (${socket.id})`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO belum diinisialisasi. Panggil init(server) dulu di server.js');
  return io;
}

// ---- Helper emit terpusat, dipakai oleh experimentEngine & mqttService ----

function emitSensorUpdate(experimentId, reading) {
  getIO().to(`experiment:${experimentId}`).emit('sensor:update', { experimentId, reading });
}

function emitExperimentStatus(experiment) {
  getIO().to(`experiment:${experiment.id}`).emit('experiment:status', experiment);
  getIO().emit('experiment:list-changed', { id: experiment.id, status: experiment.status });
}

function emitAlert(alert) {
  getIO().emit('alert:new', alert);
}

function emitDeviceStatus(device) {
  getIO().emit('device:status', device);
}

module.exports = {
  init,
  getIO,
  emitSensorUpdate,
  emitExperimentStatus,
  emitAlert,
  emitDeviceStatus,
};