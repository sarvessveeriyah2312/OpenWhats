import { useEffect, useState } from 'react';
import { api } from '../api.js';

const POLL_MS = 3000;

export function useStatus() {
  const [status, setStatus] = useState(null);
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const s = await api.getStatus();
        if (cancelled) return;
        setStatus(s);
        setError(null);

        if (s.state === 'qr_pending') {
          const { qr } = await api.getQr();
          if (!cancelled) setQr(qr);
        } else {
          setQr(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { status, qr, error };
}
