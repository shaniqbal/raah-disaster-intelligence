import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CopilotClient } from './CopilotClient';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

export const metadata: Metadata = { title: 'AI Copilot', description: 'Grounded explanations of risk, scenarios, routes and data provenance.' };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CopilotClient />
    </Suspense>
  );
}
