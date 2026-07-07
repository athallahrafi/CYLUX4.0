export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-100">
      <div>
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

const STAT_COLORS = {
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
};

export function StatCard({ icon, label, value, unit, sub, color = 'blue' }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${STAT_COLORS[color]}`}>
          {icon}
        </div>
        <span className="text-sm text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {value} {unit && <span className="text-base font-medium text-gray-400">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

const BADGE_STYLES = {
  running: 'bg-blue-100 text-blue-700',
  pending: 'bg-gray-100 text-gray-600',
  completed: 'bg-green-100 text-green-700',
  stopped_threshold: 'bg-green-100 text-green-700',
  stopped_timeout: 'bg-amber-100 text-amber-700',
  stopped_manual: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-700',
  online: 'bg-green-100 text-green-700',
  offline: 'bg-gray-100 text-gray-500',
  error: 'bg-red-100 text-red-700',
  danger: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
};

const BADGE_LABEL = {
  running: 'Running',
  pending: 'Pending',
  completed: 'Completed',
  stopped_threshold: 'Stopped (Threshold)',
  stopped_timeout: 'Stopped (Timeout)',
  stopped_manual: 'Stopped (Manual)',
  failed: 'Failed',
  online: 'Online',
  offline: 'Offline',
  error: 'Error',
};

export function Badge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${BADGE_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
      {BADGE_LABEL[status] || status}
    </span>
  );
}

export function EmptyState({ icon = '📭', title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-semibold text-gray-500">{title}</div>
      {subtitle && <div className="text-sm mt-1">{subtitle}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
