import { useCallback, useEffect, useState } from 'react';
import { logTechnicalError, toUserFacingError } from '../lib/utils/errors';

export function useAsyncResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (err) {
      logTechnicalError('Async resource failed', err);
      setError(toUserFacingError(err));
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
