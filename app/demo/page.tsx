import type { Metadata } from 'next';
import { DemoClient } from './DemoClient';

export const metadata: Metadata = { title: 'Judge Demo', description: 'Guided 4-minute story: a simulated flood emergency in Southern Punjab, from rising risk to coordinated response.' };

export default function Page() {
  return <DemoClient />;
}
