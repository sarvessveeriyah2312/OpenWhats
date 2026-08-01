import { useEffect, useState } from 'react';
import { api } from '../api.js';

const POLL_MS = 5000;

export function useRateGateStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const s = await api.getRateGateStatus();
        if (!cancelled) setStatus(s);
      } catch {
        // non-critical stat panel; ignore transient failures
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return status;
}
