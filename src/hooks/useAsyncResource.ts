import { useCallback, useEffect, useRef, useState } from 'react';
import { logTechnicalError, toUserFacingError } from '../lib/utils/errors';

export function useAsyncResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++activeRequest.current;
    setLoading(true);
    setError(null);
    try {
      const nextData = await loader();
      if (activeRequest.current === requestId) {
        setData(nextData);
      }
    } catch (err) {
      // Navigating away, or starting a newer load, invalidates this request.
      // Its fetch may still reject, but it is no longer a user-visible error.
      if (activeRequest.current === requestId) {
        logTechnicalError('Async resource failed', err);
        setError(toUserFacingError(err));
      }
    } finally {
      if (activeRequest.current === requestId) {
        setLoading(false);
      }
    }
    // The hook's caller owns the reload boundary, analogous to useEffect deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload();
    return () => {
      activeRequest.current += 1;
    };
  }, [reload]);

  return { data, loading, error, reload };
}
