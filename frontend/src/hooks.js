import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

// Fetch helper with loading/error state and optional polling (used for "real-time" simulated updates)
export function useFetch(path, { pollMs = 0, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const first = useRef(true);

  const load = useCallback(async () => {
    if (!enabled || !path) return;
    if (first.current) setLoading(true);
    try {
      setData(await api(path));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      first.current = false;
      setLoading(false);
    }
  }, [path, enabled]);

  useEffect(() => { first.current = true; load(); }, [load]);
  useEffect(() => {
    if (!pollMs) return undefined;
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  return { data, error, loading, reload: load, setData };
}
