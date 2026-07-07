const http = require('http');
const app = require('./app');
const env = require('./config/env');
const socketService = require('./services/socketService');
const mqttService = require('./services/mqttService');

const server = http.createServer(app);

socketService.init(server);
mqttService.connect();

server.listen(env.port, () => {
  console.log(`[server] Chem-E-Car backend berjalan di http://localhost:${env.port}`);
  console.log(`[server] Menerima koneksi realtime dari frontend: ${env.corsOrigin}`);
});

process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled rejection:', err);
});
