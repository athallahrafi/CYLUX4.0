import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { experimentsApi, reportsApi } from '../api/client';
import { PageHeader, Spinner, EmptyState } from '../components/ui';

const LINE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2'];

function fmt(n, digits = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(digits);
}

export default function Compare() {
  const [allExperiments, setAllExperiments] = useState([]);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    experimentsApi.list({ limit: 100 }).then(setAllExperiments);
  }, []);

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const runCompare = () => {
    if (selected.length < 2) return;
    setLoading(true);
    reportsApi.compare(selected).then(setResult).finally(() => setLoading(false));
  };

  // Gabungkan seluruh readings jadi satu dataset ber-index elapsed_ms untuk overlay chart
  const mergedChartData = useMemo(() => {
    if (!result) return [];
    const byElapsed = new Map();
    result.experiments.forEach((exp, idx) => {
      exp.readings.forEach((r) => {
        const key = Math.round(r.elapsed_ms / 1000); // bucket per detik
        if (!byElapsed.has(key)) byElapsed.set(key, { t: key });
        byElapsed.get(key)[`exp_${idx}`] = r.distance_m;
      });
    });
    return Array.from(byElapsed.values()).sort((a, b) => a.t - b.t);
  }, [result]);

  return (
    <div>
      <PageHeader title="Compare" subtitle="Bandingkan beberapa run untuk analisa konsistensi (repeatability)" />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="card p-4 h-fit">
          <h3 className="font-bold text-sm text-gray-900 mb-3">Pilih Experiment (min. 2)</h3>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {allExperiments.map((e) => (
              <label key={e.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm cursor-pointer">
                <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} />
                <span className="truncate">{e.name}</span>
              </label>
            ))}
          </div>
          <button
            onClick={runCompare} disabled={selected.length < 2 || loading}
            className="mt-3 w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2"
          >
            {loading ? 'Memuat...' : `Bandingkan (${selected.length})`}
          </button>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {!result ? (
            <div className="card"><EmptyState icon="📈" title="Pilih minimal 2 experiment" subtitle="Hasil perbandingan akan tampil di sini." /></div>
          ) : (
            <>
              {result.repeatability && (
                <div className="card p-4 grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-400">Rata-rata Jarak</div>
                    <div className="text-lg font-bold text-gray-900">{fmt(result.repeatability.mean_distance_m)} m</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Standar Deviasi</div>
                    <div className="text-lg font-bold text-gray-900">{fmt(result.repeatability.std_dev_m)} m</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Jumlah Sampel</div>
                    <div className="text-lg font-bold text-gray-900">{result.repeatability.sample_count}</div>
                  </div>
                </div>
              )}

              <div className="card p-5">
                <h3 className="font-bold text-sm text-gray-900 mb-4">Distance vs Time (overlay)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mergedChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="t" tick={{ fontSize: 11 }} label={{ value: 'detik', position: 'insideBottomRight', fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {result.experiments.map((exp, idx) => (
                      <Line key={exp.id} type="monotone" dataKey={`exp_${idx}`} name={exp.name} stroke={LINE_COLORS[idx % LINE_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                      <th className="px-4 py-3 font-medium">Nama</th>
                      <th className="px-4 py-3 font-medium">Target</th>
                      <th className="px-4 py-3 font-medium">Aktual</th>
                      <th className="px-4 py-3 font-medium">Selisih</th>
                      <th className="px-4 py-3 font-medium">Akurasi</th>
                      <th className="px-4 py-3 font-medium">Efisiensi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.experiments.map((exp) => (
                      <tr key={exp.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 font-medium text-gray-800">{exp.name}</td>
                        <td className="px-4 py-3 text-gray-500">{exp.target_distance_m ? `${fmt(exp.target_distance_m)} m` : '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{exp.actual_distance_m ? `${fmt(exp.actual_distance_m)} m` : '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{exp.distance_error_m != null ? `${fmt(exp.distance_error_m)} m` : '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{exp.accuracy_percent != null ? `${fmt(exp.accuracy_percent, 1)}%` : '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{exp.efficiency_wh_per_m != null ? `${fmt(exp.efficiency_wh_per_m, 3)} Wh/m` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
