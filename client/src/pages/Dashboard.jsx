import PageHeader from '../components/PageHeader.jsx';
import RateGateCard from '../components/RateGateCard.jsx';
import { useRateGateStatus } from '../hooks/useRateGateStatus.js';
import { IconCheckCircle, IconQr, IconLogOut, IconLoader } from '../icons.jsx';

export default function Dashboard({ status, qr, error, onLogout }) {
  const rateGateStatus = useRateGateStatus();

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Connection status and QR pairing for your WhatsApp session."
      />

      <div className="card">
        {!status && (
          <div className="empty-state">
            <IconLoader className="spin" />
            <p>Checking connection...</p>
          </div>
        )}

        {error && <p className="inline-error">{error}</p>}

        {status?.state === 'connected' && (
          <div className="connected-panel">
            <div className="connected-info">
              <div className="connected-icon">
                <IconCheckCircle />
              </div>
              <div>
                <h3>You're connected</h3>
                <p className="muted">
                  {status.phoneNumber ? `Linked to ${status.phoneNumber}` : 'Session is active'} —
                  ready to send and receive messages.
                </p>
              </div>
            </div>
            <button className="btn btn-danger" onClick={onLogout}>
              <IconLogOut />
              Log out
            </button>
          </div>
        )}

        {status?.state === 'qr_pending' && (
          <div className="qr-panel">
            <div className="qr-frame">
              {qr ? (
                <img src={qr} alt="WhatsApp QR code" />
              ) : (
                <IconQr className="qr-placeholder" />
              )}
            </div>
            <div className="qr-info">
              <h3>Scan to connect</h3>
              <ol className="steps">
                <li>Open WhatsApp on your phone</li>
                <li>Go to Settings &rarr; Linked Devices</li>
                <li>Tap "Link a Device" and scan this code</li>
              </ol>
            </div>
          </div>
        )}

        {status?.state === 'disconnected' && !qr && (
          <div className="empty-state">
            <IconLoader className="spin" />
            <p>Waiting for a QR code to appear...</p>
          </div>
        )}
      </div>

      <RateGateCard status={rateGateStatus} />
    </>
  );
}
