import { useEffect, useState } from 'react';
import { alertsApi } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { PageHeader, EmptyState, Spinner } from '../components/ui';

const SEVERITY_ICON = { danger: '🔴', warning: '🟡', info: '🔵' };

export default function Alerts() {
  const { socket } = useSocket();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlyUnread, setOnlyUnread] = useState(false);

  const load = () => {
    setLoading(true);
    alertsApi.list(onlyUnread ? { unread: true } : {}).then(setItems).finally(() => setLoading(false));
  };

  useEffect(load, [onlyUnread]);

  useEffect(() => {
    if (!socket) return undefined;
    const onAlert = (alert) => setItems((prev) => [alert, ...prev]);
    socket.on('alert:new', onAlert);
    return () => socket.off('alert:new', onAlert);
  }, [socket]);

  const markRead = async (id) => {
    await alertsApi.markRead(id);
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
  };

  const markAllRead = async () => {
    await alertsApi.markAllRead();
    setItems((prev) => prev.map((a) => ({ ...a, is_read: true })));
  };

  return (
    <div>
      <PageHeader title="Alerts" subtitle="Notifikasi tegangan, suhu, koneksi device, dan status experiment">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
          Hanya belum dibaca
        </label>
        <button onClick={markAllRead} className="text-sm text-brand-600 font-semibold">Tandai semua dibaca</button>
      </PageHeader>

      <div className="p-6">
        <div className="card overflow-hidden">
          {loading ? <Spinner /> : items.length === 0 ? (
            <EmptyState icon="🔔" title="Tidak ada alert" />
          ) : (
            <ul className="divide-y divide-gray-50">
              {items.map((a) => (
                <li key={a.id} className={`px-5 py-4 flex items-start gap-3 ${!a.is_read ? 'bg-blue-50/40' : ''}`}>
                  <span className="mt-0.5">{SEVERITY_ICON[a.severity] || '⚪'}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800">{a.title}</div>
                    {a.message && <div className="text-sm text-gray-500">{a.message}</div>}
                    <div className="text-xs text-gray-400 mt-1">
                      {a.experiment_name ? `${a.experiment_name} · ` : ''}{new Date(a.created_at).toLocaleString('id-ID')}
                    </div>
                  </div>
                  {!a.is_read && (
                    <button onClick={() => markRead(a.id)} className="text-xs text-brand-600 font-semibold whitespace-nowrap">
                      Tandai dibaca
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
