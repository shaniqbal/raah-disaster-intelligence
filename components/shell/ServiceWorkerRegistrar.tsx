'use client';

import { useEffect } from 'react';

/** Registers the offline service worker in production builds only. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* offline support is progressive enhancement */
    });
  }, []);
  return null;
}
