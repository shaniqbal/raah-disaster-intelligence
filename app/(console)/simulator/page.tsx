import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SimulatorClient } from './SimulatorClient';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

export const metadata: Metadata = { title: 'Disaster Simulator', description: 'What-if digital twin for flood, urban flooding and landslide response scenarios in Pakistan.' };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SimulatorClient />
    </Suspense>
  );
}
