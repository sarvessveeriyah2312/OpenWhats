import { IconLoader } from '../icons.jsx';

const LABELS = {
  connected: 'Connected',
  qr_pending: 'Awaiting scan',
  disconnected: 'Disconnected',
};

export default function StatusPill({ status, collapsed }) {
  if (!status) {
    return (
      <div className="status-pill status-pill--checking" title={collapsed ? 'Checking...' : undefined}>
        <IconLoader className="spin" width={14} height={14} />
        {!collapsed && <span>Checking...</span>}
      </div>
    );
  }

  const label = LABELS[status.state] || status.state;

  return (
    <div
      className={`status-pill status-pill--${status.state}`}
      title={collapsed ? [label, status.phoneNumber].filter(Boolean).join(' — ') : undefined}
    >
      <span className="status-dot" />
      {!collapsed && (
        <div className="status-pill-text">
          <span className="status-pill-label">{label}</span>
          {status.phoneNumber && <span className="status-pill-sub">{status.phoneNumber}</span>}
        </div>
      )}
    </div>
  );
}
