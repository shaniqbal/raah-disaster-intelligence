import type { Metadata } from 'next';
import { MissionControlClient } from './MissionControlClient';

export const metadata: Metadata = { title: 'Mission Control', description: 'National overview of explainable risk, live signals and simulated response readiness.' };

export default function Page() {
  return <MissionControlClient />;
}
