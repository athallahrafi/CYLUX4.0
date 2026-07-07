require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const createMqttClient = require('./config/mqtt');
const racesRouter = require('./routes/races');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Chem-E-Car Monitoring API aktif' });
});
app.use('/api/races', racesRouter);

// Socket.IO: koneksi dari frontend
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client terhubung: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client terputus: ${socket.id}`);
  });
});

// MQTT: jembatan data dari ESP32-C3 gateway ke frontend via Socket.IO
createMqttClient(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server backend berjalan di http://localhost:${PORT}`);
});
