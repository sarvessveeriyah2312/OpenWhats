import { IconAlertTriangle, IconGauge } from '../icons.jsx';

function severityFor(count, cap) {
  if (cap <= 0) return 'accent';
  const ratio = count / cap;
  if (ratio >= 1) return 'danger';
  if (ratio >= 0.8) return 'warning';
  return 'accent';
}

function Meter({ label, count, cap }) {
  const pct = cap > 0 ? Math.min(100, Math.round((count / cap) * 100)) : 0;
  const severity = severityFor(count, cap);

  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <span className="mono">
          {count} / {cap}
        </span>
      </div>
      <div className="meter-track">
        <div className={`meter-fill meter-fill--${severity}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatCountdown(ts) {
  const diffMs = ts - Date.now();
  if (diffMs <= 0) return 'shortly';
  const minutes = Math.ceil(diffMs / 60000);
  if (minutes < 1) return 'in under a minute';
  if (minutes === 1) return 'in ~1 minute';
  if (minutes < 60) return `in ~${minutes} minutes`;
  return `in ~${Math.round(minutes / 60)}h`;
}

export default function RateGateCard({ status }) {
  if (!status) return null;

  const { hourly, daily, newContacts, accountAgeDays, warmupEnabled, queueLength, backoffUntil } =
    status;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="rate-gate-header">
        <IconGauge width={16} height={16} className="muted" />
        <h3>Rate gate</h3>
      </div>
      <p className="rate-gate-subtitle muted">
        {warmupEnabled
          ? `Warm-up: day ${accountAgeDays + 1} since first connection`
          : 'Warm-up curve disabled — using flat daily cap'}
      </p>

      {backoffUntil && (
        <p className="inline-error">
          <IconAlertTriangle width={14} height={14} />
          Paused after repeated send errors — resuming {formatCountdown(backoffUntil)}
        </p>
      )}

      <Meter label="Hourly" count={hourly.count} cap={hourly.cap} />
      <Meter label="Daily" count={daily.count} cap={daily.cap} />
      <Meter label="New contacts today" count={newContacts.count} cap={newContacts.cap} />

      {queueLength > 0 && (
        <p className="rate-gate-note muted">
          {queueLength} message{queueLength === 1 ? '' : 's'} queued, waiting for capacity to free
          up.
        </p>
      )}
    </div>
  );
}
