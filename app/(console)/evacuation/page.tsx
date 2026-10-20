import type { Metadata } from 'next';
import { EvacuationClient } from './EvacuationClient';

export const metadata: Metadata = { title: 'Evacuation Planner', description: 'Road-network evacuation routing with alternatives and hazard closures (demonstration, not navigation).' };

export default function Page() {
  return <EvacuationClient />;
}
