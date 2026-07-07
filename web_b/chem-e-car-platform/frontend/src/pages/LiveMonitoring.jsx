import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { experimentsApi, devicesApi, settingsApi } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { PageHeader, StatCard, Badge } from '../components/ui';

function mmss(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function LiveMonitoring() {
  const { socket } = useSocket();
  const [devices, setDevices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ name: '', device_id: '', target_distance_m: '', turbidity_threshold: '' });
  const [experiment, setExperiment] = useState(null);
  const [readings, setReadings] = useState([]);
  const [remainingMs, setRemainingMs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    devicesApi.list().then((d) => setDevices(d.filter((x) => x.device_type === 'esp32_gateway')));
    settingsApi.get().then((s) => {
      setSettings(s);
      setForm((f) => ({ ...f, turbidity_threshold: s.default_turbidity_threshold }));
    });
  }, []);

  // Subscribe realtime ke room experiment begitu experiment dibuat
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

  // Countdown lokal, disinkronkan ke started_at server
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

  const latest = readings[readings.length - 1];
  const isRunning = experiment?.status === 'running';
  const isFinished = experiment && !isRunning && experiment.status !== 'pending';

  const chartData = useMemo(
    () => readings.map((r) => ({ ...r, t: mmss(r.elapsed_ms / 1000) })),
    [readings]
  );

  const startTrial = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.device_id || !form.target_distance_m) {
      setError('Pilih device dan isi target distance.');
      return;
    }
    setBusy(true);
    try {
      const created = await experimentsApi.create({
        name: form.name || `Trial Race ${new Date().toLocaleString('id-ID')}`,
        mode: 'race',
        device_id: form.device_id,
        target_distance_m: Number(form.target_distance_m),
        turbidity_threshold: Number(form.turbidity_threshold),
      });
      const started = await experimentsApi.start(created.id);
      setExperiment(started);
      setReadings([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memulai trial race.');
    } finally {
      setBusy(false);
    }
  };

  const stopTrial = async () => {
    if (!experiment) return;
    setBusy(true);
    try {
      const stopped = await experimentsApi.stop(experiment.id);
      setExperiment(stopped);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghentikan experiment.');
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setExperiment(null);
    setReadings([]);
    setForm((f) => ({ ...f, name: '', target_distance_m: '' }));
  };

  return (
    <div>
      <PageHeader title="Live Monitoring — Trial Race" subtitle="Jalankan mobil, mobil berhenti otomatis maksimal 2 menit atau saat kekeruhan menyentuh batas">
        {experiment && (
          <div className="text-right">
            <div className="text-xs text-gray-400">Status</div>
            <Badge status={experiment.status} />
          </div>
        )}
      </PageHeader>

      <div className="p-6 space-y-6">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

        {!experiment && (
          <form onSubmit={startTrial} className="card p-5 max-w-2xl space-y-4">
            <h2 className="font-bold text-gray-900">Konfigurasi Trial Race</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500">Nama Run (opsional)</label>
                <input
                  value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="mis. Test #26"
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
                <label className="text-xs font-medium text-gray-500">Target Distance (m)</label>
                <input
                  type="number" step="0.01" value={form.target_distance_m}
                  onChange={(e) => setForm((f) => ({ ...f, target_distance_m: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500">Ambang Batas Kekeruhan / Turbidity Threshold (NTU)</label>
                <input
                  type="number" step="0.1" value={form.turbidity_threshold}
                  onChange={(e) => setForm((f) => ({ ...f, turbidity_threshold: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Mobil akan berhenti otomatis begitu nilai ini tercapai, atau saat durasi 2 menit habis — mana yang lebih dulu.
                </p>
              </div>
            </div>
            <button
              type="submit" disabled={busy}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold text-sm rounded-lg px-5 py-2.5"
            >
              {busy ? 'Memulai...' : '▶ Start Trial Race'}
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
                  {isRunning ? 'Sisa waktu (maks. 2 menit)' : experiment.stop_reason || 'Menunggu mulai'}
                </div>
              </div>
              <div className="flex gap-2">
                {isRunning && (
                  <button
                    onClick={stopTrial} disabled={busy}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold text-sm rounded-lg px-5 py-2.5"
                  >
                    ⏹ End Experiment
                  </button>
                )}
                {isFinished && (
                  <>
                    <Link to={`/experiments/${experiment.id}`} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-lg px-5 py-2.5">
                      Lihat Laporan
                    </Link>
                    <button
                      onClick={resetForm}
                      className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg px-5 py-2.5"
                    >
                      Trial Baru
                    </button>
                  </>
                )}
              </div>
            </div>

            {isFinished && (
              <div className="card p-4 flex items-center gap-8 flex-wrap">
                <ResultStat label="Target" value={`${experiment.target_distance_m} m`} />
                <ResultStat label="Jarak Aktual" value={experiment.actual_distance_m != null ? `${Number(experiment.actual_distance_m).toFixed(2)} m` : '—'} />
                <ResultStat
                  label="Selisih (|Y-X|)"
                  value={experiment.actual_distance_m != null ? `${Math.abs(experiment.target_distance_m - experiment.actual_distance_m).toFixed(2)} m` : '—'}
                />
                <div className="flex-1">
                  <div className="text-xs text-gray-400">Alasan Berhenti</div>
                  <div className="text-sm font-medium text-gray-700">{experiment.stop_reason}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <StatCard icon="📏" label="Distance" value={latest?.distance_m != null ? Number(latest.distance_m).toFixed(2) : '0.00'} unit="m" color="blue" />
              <StatCard icon="🔋" label="Voltage" value={latest?.voltage_v != null ? Number(latest.voltage_v).toFixed(2) : '—'} unit="V" color="purple" />
              <StatCard icon="⚡" label="Current" value={latest?.current_a != null ? Number(latest.current_a).toFixed(2) : '—'} unit="A" color="amber" />
              <StatCard icon="🌡️" label="Temperature" value={latest?.temperature_c != null ? Number(latest.temperature_c).toFixed(1) : '—'} unit="°C" color="red" />
              <StatCard icon="💧" label="Turbidity" value={latest?.turbidity_ntu != null ? Number(latest.turbidity_ntu).toFixed(1) : '—'} unit="NTU" color="blue" />
              <StatCard icon="🔌" label="Energy" value={latest?.energy_wh != null ? Number(latest.energy_wh).toFixed(2) : '0.00'} unit="Wh" color="green" />
            </div>

            <div className="card p-5">
              <h2 className="font-bold text-gray-900 text-sm mb-4">Distance vs Time</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="t" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="distance_m" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResultStat({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
    </div>
  );
}
