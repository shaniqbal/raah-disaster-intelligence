'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Lang } from '@/lib/i18n/strings';
import { usgsProvider, type Quake } from '@/lib/providers/usgs';
import { openMeteoProvider, type RegionForecast } from '@/lib/providers/openMeteo';
import type { DataProvider, ProviderHealth } from '@/lib/providers/types';
import type { LiveInputs } from '@/lib/risk/engine';

// ------------------------------------------------------------------ storage helpers
export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — app keeps working in memory */
  }
}
export function removeStore(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ preferences
interface Prefs {
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  online: boolean;
  /** focus region id ('' = all Pakistan) shared by Mission Control, Risk and Maps */
  region: string;
  setRegion: (id: string) => void;
}
const PrefsCtx = createContext<Prefs | null>(null);
export const usePrefs = () => useContext(PrefsCtx)!;

// ------------------------------------------------------------------ live data
export interface LiveSlot<T> {
  data: T | null;
  mode: 'live' | 'cached' | 'unavailable' | 'loading';
  health: ProviderHealth;
}
interface LiveData {
  quakes: LiveSlot<Quake[]>;
  forecast: LiveSlot<RegionForecast[]>;
  refresh: () => void;
  liveInputs: Record<string, LiveInputs>;
}
const LiveCtx = createContext<LiveData | null>(null);
export const useLiveData = () => useContext(LiveCtx)!;

const initialSlot = <T,>(id: string): LiveSlot<T> => ({ data: null, mode: 'loading', health: { providerId: id, status: 'loading' } });

function useProvider<T>(provider: DataProvider<T>, nonce: number): LiveSlot<T> {
  const [slot, setSlot] = useState<LiveSlot<T>>(() => initialSlot<T>(provider.id));
  useEffect(() => {
    const ctrl = new AbortController();
    const started = performance.now();
    const cacheKey = `raah:live:${provider.id}`;
    setSlot((s) => ({ ...s, mode: s.data ? s.mode : 'loading', health: { ...s.health, status: 'loading' } }));
    provider
      .fetch(ctrl.signal)
      .then((data) => {
        const retrievedAt = new Date().toISOString();
        writeStore(cacheKey, { data, retrievedAt });
        setSlot({ data, mode: 'live', health: { providerId: provider.id, status: 'ok', retrievedAt, checkedAt: retrievedAt, latencyMs: Math.round(performance.now() - started) } });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        const checkedAt = new Date().toISOString();
        const message = err instanceof Error ? err.message : 'Request failed';
        const cached = readStore<{ data: T; retrievedAt: string } | null>(cacheKey, null);
        // A previous REAL retrieval may be shown, clearly labelled as cached. Nothing synthetic is substituted.
        if (cached) setSlot({ data: cached.data, mode: 'cached', health: { providerId: provider.id, status: 'cached', retrievedAt: cached.retrievedAt, checkedAt, message } });
        else setSlot({ data: null, mode: 'unavailable', health: { providerId: provider.id, status: 'unavailable', checkedAt, message } });
      });
    return () => ctrl.abort();
  }, [provider, nonce]);
  return slot;
}

// ------------------------------------------------------------------ toasts
interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'ok' | 'warn';
}
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function AppProviders({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const [lang, setLangState] = useState<Lang>('en');
  const [online, setOnline] = useState(true);
  const [region, setRegionState] = useState('');
  const [nonce, setNonce] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    setThemeState(readStore<'dark' | 'light'>('raah:theme', 'dark'));
    setLangState(readStore<Lang>('raah:lang', 'en'));
    setRegionState(readStore<string>('raah:region', ''));
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang === 'ur' ? 'ur' : 'en';
  }, [lang]);

  const setTheme = useCallback((t: 'dark' | 'light') => {
    setThemeState(t);
    writeStore('raah:theme', t);
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeStore('raah:lang', l);
  }, []);

  const setRegion = useCallback((id: string) => {
    setRegionState(id);
    writeStore('raah:region', id);
  }, []);

  const quakes = useProvider(usgsProvider, nonce);
  const forecast = useProvider(openMeteoProvider, nonce);
  const liveInputs = useMemo(() => {
    const out: Record<string, LiveInputs> = {};
    if (forecast.data && forecast.mode === 'live') {
      for (const f of forecast.data) out[f.regionId] = { rain3dMm: f.rain3dMm, tmax3dC: f.tmax3dC, retrievedAt: forecast.health.retrievedAt?.slice(0, 16).replace('T', ' ') + ' UTC' };
    }
    return out;
  }, [forecast]);

  const pushToast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const prefs = useMemo(() => ({ theme, setTheme, lang, setLang, online, region, setRegion }), [theme, setTheme, lang, setLang, online, region, setRegion]);
  const live = useMemo(() => ({ quakes, forecast, refresh: () => setNonce((n) => n + 1), liveInputs }), [quakes, forecast, liveInputs]);

  return (
    <PrefsCtx.Provider value={prefs}>
      <LiveCtx.Provider value={live}>
        <ToastCtx.Provider value={pushToast}>
          {children}
          <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
            {toasts.map((t) => (
              <div key={t.id} className={`fade-up pointer-events-auto rounded-lg border px-3.5 py-2.5 text-sm shadow-lg backdrop-blur ${t.tone === 'ok' ? 'border-ok/40 bg-surface/95 text-ok' : t.tone === 'warn' ? 'border-caution/40 bg-surface/95 text-caution' : 'border-line-strong bg-surface/95 text-ink'}`}>
                {t.text}
              </div>
            ))}
          </div>
        </ToastCtx.Provider>
      </LiveCtx.Provider>
    </PrefsCtx.Provider>
  );
}
