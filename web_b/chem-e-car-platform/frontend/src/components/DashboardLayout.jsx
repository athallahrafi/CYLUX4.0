import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { alertsApi } from '../api/client';

const MAIN_MENU = [
  { to: '/', label: 'Overview', icon: '📊', end: true },
  { to: '/live', label: 'Live Monitoring', icon: '🏁' },
  { to: '/calibration', label: 'Kalibrasi Stopping', icon: '🧪' },
  { to: '/experiments', label: 'Experiments', icon: '📋' },
  { to: '/compare', label: 'Compare', icon: '📈' },
  { to: '/alerts', label: 'Alerts', icon: '🔔', badgeKey: 'alerts' },
];

const SETTINGS_MENU = [
  { to: '/devices', label: 'Devices', icon: '🔌', minRole: 'admin' },
  { to: '/users', label: 'Users', icon: '👥', minRole: 'admin' },
  { to: '/settings', label: 'Settings', icon: '⚙️', minRole: 'super_admin' },
];

const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', user: 'Researcher' };

export default function DashboardLayout() {
  const { user, logout, hasRole } = useAuth();
  const { socket } = useSocket();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    alertsApi.unreadCount().then((d) => setUnread(d.count)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const onAlert = () => setUnread((n) => n + 1);
    socket.on('alert:new', onAlert);
    return () => socket.off('alert:new', onAlert);
  }, [socket]);

  return (
    <div className="flex h-screen bg-surface text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-gray-100">
          <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center text-lg">🧪</div>
          <div>
            <div className="font-bold text-sm leading-tight">Chem-E-Car</div>
            <div className="text-xs text-gray-400 leading-tight">Research Platform</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="text-[11px] font-semibold text-gray-400 px-2 mb-2 tracking-wide">MAIN MENU</div>
          <ul className="space-y-1">
            {MAIN_MENU.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
                    }`
                  }
                >
                  <span className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    {item.label}
                  </span>
                  {item.badgeKey === 'alerts' && unread > 0 && (
                    <span className="text-[11px] bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-semibold">
                      {unread}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="text-[11px] font-semibold text-gray-400 px-2 mt-6 mb-2 tracking-wide">SETTINGS</div>
          <ul className="space-y-1">
            {SETTINGS_MENU.filter((item) => hasRole(item.minRole)).map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-gray-100 p-3">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
              {(user?.name || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.name}</div>
              <div className="text-xs text-gray-400">{ROLE_LABEL[user?.role] || user?.role}</div>
            </div>
            <span className="text-gray-400 text-xs">⏻</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
