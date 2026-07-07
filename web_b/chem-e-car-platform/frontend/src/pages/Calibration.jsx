import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { experimentsApi, devicesApi, settingsApi } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { PageHeader, StatCard, Badge } from '../components/ui';

function mmss(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function Calibration() {
  const { socket } = useSocket();
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({ name: '', device_id: '', turbidity_threshold: '' });
  const [experiment, setExperiment] = useState(null);
  const [readings, setReadings] = useState([]);
  const [remainingMs, setRemainingMs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    devicesApi.list().then((d) => setDevices(d.filter((x) => x.device_type === 'esp32_gateway')));
    settingsApi.get().then((s) => setForm((f) => ({ ...f, turbidity_threshold: s.default_turbidity_threshold })));
  }, []);

  useEffect(() => {
    if (!socket || !experiment) return undefined;
    socket.emit('experiment:subscribe', experiment.id);
    const onSensor = (payload) => {
      if (payload.experimentId !== experiment.id) return;
      setReadings((prev) => [...prev, payload.reading].slice(-600));
    };
    const onStatus = (payload) => {
      if (payload.id !== experiment.id) return;
      setExperiment(payload);
    };
    socket.on('sensor:update', onSensor);
    socket.on('experiment:status', onStatus);
    return () => {
      socket.emit('experiment:unsubscribe', experiment.id);
      socket.off('sensor:update', onSensor);
      socket.off('experiment:status', onStatus);
    };
  }, [socket, experiment?.id]);

  useEffect(() => {
    if (!experiment || experiment.status !== 'running' || !experiment.started_at) {
      setRemainingMs(null);
      return undefined;
    }
    const startedAtMs = new Date(experiment.started_at).getTime();
    const durationMs = experiment.max_duration_sec * 1000;
    const tick = () => setRemainingMs(Math.max(0, durationMs - (Date.now() - startedAtMs)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [experiment?.status, experiment?.started_at]);

  const isRunning = experiment?.status === 'running';
  const isFinished = experiment && !isRunning && experiment.status !== 'pending';
  const latest = readings[readings.length - 1];

  const chartData = useMemo(() => readings.map((r) => ({ ...r, t: mmss(r.elapsed_ms / 1000) })), [readings]);
  const crossedAtLabel = experiment?.threshold_crossed_ms != null ? mmss(experiment.threshold_crossed_ms / 1000) : null;

  const start = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.device_id) { setError('Pilih device.'); return; }
    setBusy(true);
    try {
      const created = await experimentsApi.create({
        name: form.name || `Kalibrasi ${new Date().toLocaleString('id-ID')}`,
        mode: 'calibration',
        device_id: form.device_id,
        turbidity_threshold: Number(form.turbidity_threshold),
      });
      const started = await experimentsApi.start(created.id);
      setExperiment(started);
      setReadings([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memulai kalibrasi.');
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      const stopped = await experimentsApi.stop(experiment.id);
      setExperiment(stopped);
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setExperiment(null);
    setReadings([]);
  };

  return (
    <div>
      <PageHeader title="Kalibrasi Stopping" subtitle="Pengambilan data reaksi kimia stopping (kekeruhan) selama 2 menit, tanpa target jarak">
        {experiment && <Badge status={experiment.status} />}
      </PageHeader>

      <div className="p-6 space-y-6">
        <div className="text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
          Mode ini digunakan untuk menguji reaksi/indikator stopping secara terpisah dari mobil berjalan.
          Data kekeruhan direkam penuh selama 2 menit — <strong>tidak berhenti otomatis</strong> saat menyentuh ambang batas —
          agar kurva kekeruhan-vs-waktu lengkap untuk menentukan waktu &amp; ambang batas yang tepat sebelum trial race sesungguhnya.
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

        {!experiment && (
          <form onSubmit={start} className="card p-5 max-w-2xl space-y-4">
            <h2 className="font-bold text-gray-900">Konfigurasi Kalibrasi</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500">Nama Percobaan (opsional)</label>
                <input
                  value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="mis. Kalibrasi Indikator #3"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Device (ESP32 Gateway)</label>
                <select
                  value={form.device_id} onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Pilih device...</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Perkiraan Ambang Batas (NTU)</label>
                <input
                  type="number" step="0.1" value={form.turbidity_threshold}
                  onChange={(e) => setForm((f) => ({ ...f, turbidity_threshold: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-gray-400 mt-1">Hanya ditandai di grafik, tidak menghentikan pengambilan data.</p>
              </div>
            </div>
            <button
              type="submit" disabled={busy}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold text-sm rounded-lg px-5 py-2.5"
            >
              {busy ? 'Memulai...' : '▶ Mulai Pengambilan Data (2 menit)'}
            </button>
          </form>
        )}

        {experiment && (
          <>
            <div className="card p-5 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">{experiment.name}</div>
                <div className="text-4xl font-bold tabular-nums text-gray-900 mt-1">
                  {isRunning ? mmss((remainingMs ?? 0) / 1000) : mmss(experiment.max_duration_sec)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {isRunning ? 'Sisa waktu (tetap 2 menit penuh)' : experiment.stop_reason || 'Menunggu mulai'}
                </div>
              </div>
              <div className="flex gap-2">
                {isRunning && (
                  <button onClick={stop} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg px-5 py-2.5">
                    ⏹ Hentikan Manual
                  </button>
                )}
                {isFinished && (
                  <>
                    <Link to={`/experiments/${experiment.id}`} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-lg px-5 py-2.5">
                      Lihat Detail
                    </Link>
                    <button onClick={resetForm} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg px-5 py-2.5">
                      Kalibrasi Baru
                    </button>
                  </>
                )}
              </div>
            </div>

            {crossedAtLabel && (
              <div className="card p-4 flex items-center gap-3 border-l-4 border-amber-500">
                <span>⏱️</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">Kekeruhan menyentuh ambang batas pada {crossedAtLabel}</div>
                  <div className="text-xs text-gray-400">Gunakan waktu ini sebagai referensi ambang batas stop untuk trial race.</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon="💧" label="Turbidity" value={latest?.turbidity_ntu != null ? Number(latest.turbidity_ntu).toFixed(1) : '—'} unit="NTU" color="blue" />
              <StatCard icon="🌡️" label="Temperature" value={latest?.temperature_c != null ? Number(latest.temperature_c).toFixed(1) : '—'} unit="°C" color="red" />
              <StatCard icon="🔋" label="Voltage" value={latest?.voltage_v != null ? Number(latest.voltage_v).toFixed(2) : '—'} unit="V" color="purple" />
              <StatCard icon="⚡" label="Current" value={latest?.current_a != null ? Number(latest.current_a).toFixed(2) : '—'} unit="A" color="amber" />
            </div>

            <div className="card p-5">
              <h2 className="font-bold text-gray-900 text-sm mb-4">Turbidity vs Time</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="t" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  {form.turbidity_threshold && (
                    <ReferenceLine y={Number(form.turbidity_threshold)} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Threshold', fontSize: 11, fill: '#f59e0b' }} />
                  )}
                  <Line type="monotone" dataKey="turbidity_ntu" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
