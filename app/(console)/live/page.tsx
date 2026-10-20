import type { Metadata } from 'next';
import { LiveClient } from './LiveClient';

export const metadata: Metadata = { title: 'Live Data', description: 'Provider health, USGS earthquakes and Open-Meteo forecasts with provenance.' };

export default function Page() {
  return <LiveClient />;
}
