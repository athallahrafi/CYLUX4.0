import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/client';
import { PageHeader, StatCard, Badge, Spinner, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';

function fmt(n, digits = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(digits);
}

export default function Overview() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => dashboardApi.summary().then(setData).finally(() => setLoading(false));

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000); // refresh berkala untuk data non-realtime
    return () => clearInterval(interval);
  }, []);

  if (loading) return <Spinner />;

  const { activeExperiment, totals, devices, recentExperiments, recentAlerts } = data;

  return (
    <div>
      <PageHeader title="Overview" subtitle="Ringkasan eksperimen dan status kendaraan">
        <div className="text-right">
          <div className="text-xs text-gray-400">Device Online</div>
          <div className="text-sm font-semibold flex items-center gap-1.5 justify-end">
            <span className={`w-2 h-2 rounded-full ${devices.online > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
            {devices.online} / {devices.total}
          </div>
        </div>
        <Link to="/live" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          + Trial Race Baru
        </Link>
      </PageHeader>

      <div className="p-6 space-y-6">
        {activeExperiment && (
          <Link
            to="/live"
            className="card p-4 flex items-center justify-between border-l-4 border-brand-600 hover:shadow-md transition block"
          >
            <div>
              <div className="text-xs font-semibold text-brand-600 uppercase tracking-wide mb-1">Sedang Berjalan</div>
              <div className="font-bold text-gray-900">{activeExperiment.name} · {activeExperiment.mode === 'race' ? 'Trial Race' : 'Kalibrasi Stopping'}</div>
              <div className="text-sm text-gray-400 mt-0.5">Device: {activeExperiment.device_name || '—'}</div>
            </div>
            <span className="text-brand-600 text-sm font-semibold">Lihat live monitoring →</span>
          </Link>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon="📋" label="Total Experiments" value={totals.total_experiments} color="blue" />
          <StatCard icon="✅" label="Selesai" value={totals.finished_experiments} color="green" />
          <StatCard icon="🎯" label="Rata-rata Akurasi" value={totals.avg_accuracy ?? '—'} unit={totals.avg_accuracy ? '%' : ''} color="purple" />
          <StatCard icon="🔌" label="Device Online" value={`${devices.online}/${devices.total}`} color="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-sm">Recent Experiments</h2>
              <Link to="/experiments" className="text-xs text-brand-600 font-semibold">Lihat semua →</Link>
            </div>
            {recentExperiments.length === 0 ? (
              <EmptyState title="Belum ada experiment" subtitle="Mulai trial race atau kalibrasi pertama Anda." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                    <th className="px-5 py-2 font-medium">Nama</th>
                    <th className="px-5 py-2 font-medium">Mode</th>
                    <th className="px-5 py-2 font-medium">Target</th>
                    <th className="px-5 py-2 font-medium">Hasil</th>
                    <th className="px-5 py-2 font-medium">Akurasi</th>
                    <th className="px-5 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExperiments.map((e) => (
                    <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link to={`/experiments/${e.id}`} className="font-medium text-gray-800 hover:text-brand-600">{e.name}</Link>
                      </td>
                      <td className="px-5 py-3 text-gray-500 capitalize">{e.mode === 'race' ? 'Trial Race' : 'Kalibrasi'}</td>
                      <td className="px-5 py-3 text-gray-500">{e.target_distance_m ? `${fmt(e.target_distance_m)} m` : '—'}</td>
                      <td className="px-5 py-3 text-gray-500">{e.actual_distance_m ? `${fmt(e.actual_distance_m)} m` : '—'}</td>
                      <td className="px-5 py-3 text-gray-500">{e.accuracy_percent ? `${fmt(e.accuracy_percent, 1)}%` : '—'}</td>
                      <td className="px-5 py-3"><Badge status={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-sm">Alerts</h2>
              <Link to="/alerts" className="text-xs text-brand-600 font-semibold">Lihat semua →</Link>
            </div>
            {recentAlerts.length === 0 ? (
              <EmptyState icon="🔔" title="Tidak ada alert" />
            ) : (
              <ul className="divide-y divide-gray-50">
                {recentAlerts.map((a) => (
                  <li key={a.id} className="px-5 py-3 flex gap-3">
                    <span className="mt-0.5">{a.severity === 'danger' ? '🔴' : a.severity === 'warning' ? '🟡' : '🔵'}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{a.title}</div>
                      {a.message && <div className="text-xs text-gray-400">{a.message}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {user?.role === 'user' && (
          <p className="text-xs text-gray-400">
            Masuk sebagai Researcher — Anda bisa membuat & menjalankan experiment milik sendiri. Hubungi admin untuk akses device/user management.
          </p>
        )}
      </div>
    </div>
  );
}
