import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResourcesClient } from './ResourcesClient';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

export const metadata: Metadata = { title: 'Rescue Coordination', description: 'Dispatcher view: needs, units, assignments, audit log and strategy comparison (simulation).' };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResourcesClient />
    </Suspense>
  );
}
