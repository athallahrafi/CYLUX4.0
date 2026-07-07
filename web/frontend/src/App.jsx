import { useEffect, useState } from 'react';
import axios from 'axios';
import { socket, API_BASE_URL } from './config/socket';
import './App.css';

function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [telemetry, setTelemetry] = useState(null);
  const [status, setStatus] = useState(null);
  const [races, setRaces] = useState([]);

  useEffect(() => {
    // Status koneksi Socket.IO
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onTelemetry(data) {
      setTelemetry(data);
    }
    function onStatus(data) {
      setStatus(data);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('telemetry', onTelemetry);
    socket.on('status', onStatus);

    // Ambil daftar race/trial dari backend
    axios
      .get(`${API_BASE_URL}/races`)
      .then((res) => setRaces(res.data))
      .catch((err) => console.error('Gagal mengambil data races:', err.message));

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('telemetry', onTelemetry);
      socket.off('status', onStatus);
    };
  }, []);

  return (
    <div className="app-container">
      <h1>Chem-E-Car Monitoring Dashboard</h1>

      <div className="status-badge">
        Status koneksi backend: {connected ? '🟢 Terhubung' : '🔴 Terputus'}
      </div>

      <section>
        <h2>Telemetry Real-time</h2>
        <pre>{telemetry ? JSON.stringify(telemetry, null, 2) : 'Menunggu data dari ESP32-C3...'}</pre>
      </section>

      <section>
        <h2>Status Perangkat</h2>
        <pre>{status ? JSON.stringify(status, null, 2) : 'Belum ada update status'}</pre>
      </section>

      <section>
        <h2>Daftar Race / Trial</h2>
        {races.length === 0 ? (
          <p>Belum ada data race (pastikan backend & database sudah jalan).</p>
        ) : (
          <ul>
            {races.map((race) => (
              <li key={race.id}>{race.name}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;
