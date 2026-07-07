import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { experimentsApi, reportsApi } from '../api/client';
import { PageHeader, Badge, Spinner } from '../components/ui';

function mmss(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
function fmt(n, digits = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(digits);
}

function MiniChart({ title, dataKey, data, color, unit }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-gray-800 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="t" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} unit={unit} />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ExperimentDetail() {
  const { id } = useParams();
  const [experiment, setExperiment] = useState(null);
  const [readings, setReadings] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      experimentsApi.get(id),
      experimentsApi.readings(id),
      reportsApi.get(id).catch(() => null),
    ]).then(([e, r, rep]) => {
      setExperiment(e);
      setReadings(r.map((row) => ({ ...row, t: mmss(row.elapsed_ms / 1000) })));
      setReport(rep);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (!experiment) return <div className="p-8 text-gray-500">Experiment tidak ditemukan.</div>;

  return (
    <div>
      <PageHeader title={experiment.name} subtitle={`${experiment.mode === 'race' ? 'Trial Race' : 'Kalibrasi Stopping'} · dibuat ${new Date(experiment.created_at).toLocaleString('id-ID')}`}>
        <Badge status={experiment.status} />
      </PageHeader>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {report && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ReportStat label="Selisih Jarak (|Y-X|)" value={report.distance_error_m != null ? `${fmt(report.distance_error_m)} m` : '—'} />
              <ReportStat label="Akurasi" value={report.accuracy_percent != null ? `${fmt(report.accuracy_percent, 1)}%` : '—'} />
              <ReportStat label="Efisiensi" value={report.efficiency_wh_per_m != null ? `${fmt(report.efficiency_wh_per_m, 3)} Wh/m` : '—'} />
              <ReportStat label="Total Energi" value={report.total_energy_wh != null ? `${fmt(report.total_energy_wh)} Wh` : '—'} />
              <ReportStat label="Daya Rata-rata" value={report.avg_power_w != null ? `${fmt(report.avg_power_w)} W` : '—'} />
              <ReportStat label="Arus Puncak" value={report.peak_current_a != null ? `${fmt(report.peak_current_a)} A` : '—'} />
              <ReportStat label="Suhu Puncak" value={report.peak_temperature_c != null ? `${fmt(report.peak_temperature_c, 1)} °C` : '—'} />
              <ReportStat label="Drop Tegangan" value={report.peak_voltage_drop_v != null ? `${fmt(report.peak_voltage_drop_v)} V` : '—'} />
            </div>
          )}

          {readings.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">Belum ada data sensor tercatat untuk experiment ini.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MiniChart title="Distance vs Time" dataKey="distance_m" data={readings} color="#2563eb" unit="m" />
              <MiniChart title="Voltage vs Time" dataKey="voltage_v" data={readings} color="#7c3aed" unit="V" />
              <MiniChart title="Current vs Time" dataKey="current_a" data={readings} color="#f59e0b" unit="A" />
              <MiniChart title="Temperature vs Time" dataKey="temperature_c" data={readings} color="#dc2626" unit="°C" />
              <MiniChart title="Turbidity vs Time" dataKey="turbidity_ntu" data={readings} color="#0891b2" unit="NTU" />
              <MiniChart title="Energy vs Time" dataKey="energy_wh" data={readings} color="#16a34a" unit="Wh" />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-3">Experiment Info</h3>
            <dl className="space-y-3 text-sm">
              <Info label="Operator" value={experiment.operator_name} />
              <Info label="Device" value={experiment.device_name || '—'} />
              <Info label="Mode" value={experiment.mode === 'race' ? 'Trial Race' : 'Kalibrasi Stopping'} />
              <Info label="Target Distance" value={experiment.target_distance_m ? `${experiment.target_distance_m} m` : '—'} />
              <Info label="Turbidity Threshold" value={experiment.turbidity_threshold ? `${experiment.turbidity_threshold} NTU` : '—'} />
              <Info label="Mulai" value={experiment.started_at ? new Date(experiment.started_at).toLocaleString('id-ID') : '—'} />
              <Info label="Selesai" value={experiment.ended_at ? new Date(experiment.ended_at).toLocaleString('id-ID') : '—'} />
              <Info label="Alasan Berhenti" value={experiment.stop_reason || '—'} />
              {experiment.description && <Info label="Deskripsi" value={experiment.description} />}
            </dl>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-3">Parameters</h3>
            <dl className="space-y-3 text-sm">
              <Info label="Battery Type" value={experiment.battery_type || '—'} />
              <Info label="Nominal Voltage" value={experiment.nominal_voltage_v ? `${experiment.nominal_voltage_v} V` : '—'} />
              <Info label="Capacity" value={experiment.capacity_ah ? `${experiment.capacity_ah} Ah` : '—'} />
              <Info label="Motor Type" value={experiment.motor_type || '—'} />
              <Info label="Gear Ratio" value={experiment.gear_ratio || '—'} />
              <Info label="Wheel Diameter" value={experiment.wheel_diameter_inch ? `${experiment.wheel_diameter_inch} inch` : '—'} />
            </dl>
          </div>

          <Link to="/experiments" className="block text-center text-sm text-brand-600 font-semibold">← Kembali ke daftar</Link>
        </div>
      </div>
    </div>
  );
}

function ReportStat({ label, value }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-bold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-gray-800 font-medium text-right">{value}</dd>
    </div>
  );
}
