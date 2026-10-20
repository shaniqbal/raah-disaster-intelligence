import type { Metadata } from 'next';
import { HistoryClient } from './HistoryClient';

export const metadata: Metadata = { title: 'Historical Events', description: 'Curated, sourced reference events: earthquakes, floods, heatwaves and landslides in Pakistan.' };

export default function Page() {
  return <HistoryClient />;
}
