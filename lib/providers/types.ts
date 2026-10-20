import type { DataMode } from '@/lib/domain/types';

export interface ProviderHealth {
  providerId: string;
  status: 'idle' | 'loading' | 'ok' | 'cached' | 'unavailable';
  checkedAt?: string;
  retrievedAt?: string;
  message?: string;
  latencyMs?: number;
}

export interface ProviderResult<T> {
  data: T | null;
  mode: Extract<DataMode, 'live' | 'unavailable'> | 'cached';
  health: ProviderHealth;
}

export interface DataProvider<T> {
  id: string;
  sourceId: string;
  fetch(signal?: AbortSignal): Promise<T>;
}

/** fetch with a hard timeout; rejects on non-2xx. */
export async function fetchJson<T>(url: string, timeoutMs = 8000, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
