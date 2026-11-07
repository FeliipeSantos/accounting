import { type DependencyList, useCallback, useEffect, useState } from 'react';

import { errorMessage, SessionExpiredError } from '@/core/api/client';

export interface LoadState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (update: (current: T | undefined) => T | undefined) => void;
}

/**
 * Loads data when the component appears and whenever the dependencies change.
 * Answers that arrive after a newer request (or after leaving the screen) are ignored.
 */
export function useLoad<T>(load: () => Promise<T>, deps: DependencyList): LoadState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    load()
      .then((result) => active && setData(result))
      .catch((err) => active && !(err instanceof SessionExpiredError) && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as dependências vêm de quem chama
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, error, loading, reload, setData };
}
