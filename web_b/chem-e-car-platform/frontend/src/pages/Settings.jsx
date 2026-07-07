import { useEffect, useState } from 'react';
import { settingsApi } from '../api/client';
import { PageHeader, Spinner } from '../components/ui';

export default function Settings() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { settingsApi.get().then(setForm); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      const updated = await settingsApi.update(form);
      setForm(updated);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan pengaturan.');
    }
  };

  if (!form) return <Spinner />;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Konfigurasi default sistem (hanya Super Admin)" />
      <div className="p-6">
        <form onSubmit={submit} className="card p-5 max-w-xl space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          {saved && <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">Pengaturan berhasil disimpan.</div>}

          <div>
            <label className="text-xs font-medium text-gray-500">Durasi Maksimum Default (detik)</label>
            <input
              type="number" max={120} value={form.default_max_duration_sec}
              onChange={(e) => setForm((f) => ({ ...f, default_max_duration_sec: Number(e.target.value) }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Dibatasi maksimum 120 detik (2 menit) sesuai aturan kompetisi AIChE.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Ambang Batas Kekeruhan Default (NTU)</label>
            <input
              type="number" step="0.1" value={form.default_turbidity_threshold}
              onChange={(e) => setForm((f) => ({ ...f, default_turbidity_threshold: Number(e.target.value) }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Ambang Batas Tegangan Rendah (V)</label>
            <input
              type="number" step="0.1" value={form.voltage_low_threshold_v}
              onChange={(e) => setForm((f) => ({ ...f, voltage_low_threshold_v: Number(e.target.value) }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Ambang Batas Suhu Tinggi (°C)</label>
            <input
              type="number" step="0.1" value={form.temperature_high_threshold_c}
              onChange={(e) => setForm((f) => ({ ...f, temperature_high_threshold_c: Number(e.target.value) }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
            Simpan Pengaturan
          </button>
        </form>
      </div>
    </div>
  );
}
