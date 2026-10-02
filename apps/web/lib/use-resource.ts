'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './client';
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(!!path);
  const generation = useRef({ value: 0 }).current;
  const reload = useCallback(async () => {
    if (!path) return;
    const current = ++generation.value;
    setLoading(true);
    setError('');
    try {
      const next = await api<T>(path);
      if (current === generation.value) setData(next);
    } catch (error) {
      if (current === generation.value)
        setError(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (current === generation.value) setLoading(false);
    }
  }, [path, generation]);
  const publish = useCallback(
    (next: T) => {
      generation.value++;
      setData(next);
      setLoading(false);
      setError('');
    },
    [generation],
  );
  useEffect(() => {
    setData(null);
    void reload();
    return () => {
      generation.value++;
    };
  }, [reload, generation]);
  return { data, setData: publish, error, loading, reload };
}
