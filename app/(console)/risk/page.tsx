import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RiskClient } from './RiskClient';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

export const metadata: Metadata = { title: 'Risk Intelligence', description: 'Explainable multi-hazard risk screening for 18 Pakistani regions.' };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RiskClient />
    </Suspense>
  );
}
