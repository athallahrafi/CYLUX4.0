import { useEffect, useState } from 'react';
import { devicesApi } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { PageHeader, Badge, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Devices() {
  const { hasRole } = useAuth();
  const { socket } = useSocket();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', device_type: 'esp32_gateway', mqtt_client_id: '' });
  const [error, setError] = useState('');

  const load = () => devicesApi.list().then(setItems).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const onStatus = (device) => setItems((prev) => prev.map((d) => (d.id === device.id ? device : d)));
    socket.on('device:status', onStatus);
    return () => socket.off('device:status', onStatus);
  }, [socket]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await devicesApi.create(form);
      setForm({ name: '', device_type: 'esp32_gateway', mqtt_client_id: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menambah device.');
    }
  };

  const remove = async (id) => {
    if (!confirm('Hapus device ini?')) return;
    await devicesApi.remove(id);
    load();
  };

  return (
    <div>
      <PageHeader title="Devices" subtitle="ESP32-C3 gateway & Arduino Nano yang terhubung ke sistem">
        {hasRole('admin') && (
          <button onClick={() => setShowForm((s) => !s)} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + Tambah Device
          </button>
        )}
      </PageHeader>

      <div className="p-6 space-y-6">
        {showForm && (
          <form onSubmit={submit} className="card p-5 max-w-xl space-y-3">
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            <div>
              <label className="text-xs font-medium text-gray-500">Nama Device</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Tipe</label>
              <select value={form.device_type} onChange={(e) => setForm((f) => ({ ...f, device_type: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="esp32_gateway">ESP32-C3 Gateway</option>
                <option value="arduino_nano">Arduino Nano</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">MQTT Client ID</label>
              <input value={form.mqtt_client_id} onChange={(e) => setForm((f) => ({ ...f, mqtt_client_id: e.target.value }))} required
                placeholder="mis. esp32-gw-01"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-gray-400 mt-1">Harus sama persis dengan {'{device_id}'} pada topic MQTT firmware.</p>
            </div>
            <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
          </form>
        )}

        {loading ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((d) => (
              <div key={d.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-gray-900">{d.name}</div>
                  <Badge status={d.status} />
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div>Tipe: {d.device_type === 'esp32_gateway' ? 'ESP32-C3 Gateway' : 'Arduino Nano'}</div>
                  <div>MQTT ID: <code className="bg-gray-50 px-1 rounded">{d.mqtt_client_id}</code></div>
                  <div>Firmware: {d.firmware_version || '—'}</div>
                  <div>Terakhir terlihat: {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString('id-ID') : 'Belum pernah'}</div>
                </div>
                {d.metadata && Object.keys(d.metadata).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-1 text-xs">
                    {Object.entries(d.metadata).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-gray-400 capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className={v === 'OK' || v === true ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                          {String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {hasRole('super_admin') && (
                  <button onClick={() => remove(d.id)} className="mt-3 text-xs text-red-500 hover:text-red-700">Hapus device</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
