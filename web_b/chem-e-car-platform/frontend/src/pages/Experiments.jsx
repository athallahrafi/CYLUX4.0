import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { experimentsApi } from '../api/client';
import { PageHeader, Badge, Spinner, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';

function fmt(n, digits = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(digits);
}

export default function Experiments() {
  const { hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ mode: '', status: '' });

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.mode) params.mode = filters.mode;
    if (filters.status) params.status = filters.status;
    experimentsApi.list(params).then(setItems).finally(() => setLoading(false));
  };

  useEffect(load, [filters.mode, filters.status]);

  const remove = async (id) => {
    if (!confirm('Hapus experiment ini beserta seluruh data sensornya? Aksi ini tidak bisa dibatalkan.')) return;
    await experimentsApi.remove(id);
    load();
  };

  return (
    <div>
      <PageHeader title="Experiments" subtitle="Riwayat seluruh trial race dan kalibrasi stopping">
        <select
          value={filters.mode} onChange={(e) => setFilters((f) => ({ ...f, mode: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Semua Mode</option>
          <option value="race">Trial Race</option>
          <option value="calibration">Kalibrasi</option>
        </select>
        <select
          value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="stopped_threshold">Stopped (Threshold)</option>
          <option value="stopped_timeout">Stopped (Timeout)</option>
          <option value="stopped_manual">Stopped (Manual)</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </PageHeader>

      <div className="p-6">
        <div className="card overflow-hidden">
          {loading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <EmptyState title="Belum ada experiment" subtitle="Sesuaikan filter atau mulai trial race baru." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">Nama</th>
                  <th className="px-5 py-3 font-medium">Mode</th>
                  <th className="px-5 py-3 font-medium">Operator</th>
                  <th className="px-5 py-3 font-medium">Target</th>
                  <th className="px-5 py-3 font-medium">Hasil</th>
                  <th className="px-5 py-3 font-medium">Akurasi</th>
                  <th className="px-5 py-3 font-medium">Tanggal</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link to={`/experiments/${e.id}`} className="font-medium text-gray-800 hover:text-brand-600">{e.name}</Link>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{e.mode === 'race' ? 'Trial Race' : 'Kalibrasi'}</td>
                    <td className="px-5 py-3 text-gray-500">{e.operator_name}</td>
                    <td className="px-5 py-3 text-gray-500">{e.target_distance_m ? `${fmt(e.target_distance_m)} m` : '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{e.actual_distance_m ? `${fmt(e.actual_distance_m)} m` : '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{e.accuracy_percent ? `${fmt(e.accuracy_percent, 1)}%` : '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{new Date(e.created_at).toLocaleDateString('id-ID')}</td>
                    <td className="px-5 py-3"><Badge status={e.status} /></td>
                    <td className="px-5 py-3 text-right">
                      {hasRole('admin') && (
                        <button onClick={() => remove(e.id)} className="text-xs text-red-500 hover:text-red-700">Hapus</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
