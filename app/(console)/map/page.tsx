import type { Metadata } from 'next';
import { MapClient } from './MapClient';

export const metadata: Metadata = { title: 'Maps & Layers', description: 'Layered geospatial view: boundaries, rivers, road graph, risk, live and historical events, scenario footprints.' };

export default function Page() {
  return <MapClient />;
}
