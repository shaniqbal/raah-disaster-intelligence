'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useScenario } from '@/hooks/useScenario';
import { SCENARIOS } from '@/lib/scenario/definitions';
import { CopilotChat } from '@/components/copilot/CopilotPanel';
import { Card, ModeBadge, SectionTitle, Tabs } from '@/components/ui/primitives';

export function CopilotClient() {
  const { def, params, selectScenario, shareQuery, plan } = useScenario();
  const initial = useSearchParams().get('q')?.slice(0, 500) ?? undefined;
  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Explainable AI" title="AI Disaster Copilot">
        Ask why a region is high risk, why a plan was recommended or what changes under a different assumption. Answers separate verified facts, model estimates, scenario assumptions and general advice.
      </SectionTitle>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Conversation" bodyClassName="h-[68vh] min-h-[480px]">
          <CopilotChat key={def.id} scenarioQuery={shareQuery} initialQuestion={initial} />
        </Card>
        <div className="space-y-4">
          <Card title="Context sent with each question" mode="simulated">
            <Tabs label="Scenario context" value={def.id} onChange={selectScenario} tabs={SCENARIOS.map((s) => ({ value: s.id, label: s.shortTitle }))} />
            <dl className="mt-3 space-y-1.5 text-xs">
              {def.controls.slice(0, 6).map((c) => (
                <div key={c.key} className="flex justify-between gap-2">
                  <dt className="text-muted">{c.label}</dt>
                  <dd className="tabular font-mono text-ink">{params[c.key] as number}{c.unit}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-2"><dt className="text-muted">Coverage (computed)</dt><dd className="tabular font-mono text-ink">{plan.metrics.coveragePct}%</dd></div>
            </dl>
            <Link href={`/simulator?${shareQuery}`} className="mt-3 inline-block text-xs text-accent underline">Adjust in the simulator →</Link>
          </Card>
          <Card title="How the Copilot stays grounded">
            <ul className="space-y-2 text-xs leading-snug text-ink-2">
              <li><ModeBadge mode="estimated" /> The server recomputes the scenario from validated parameters — numbers from the browser are never trusted.</li>
              <li><ModeBadge mode="historical" /> Facts come only from RAAH’s source registry, risk engine and scenario plan.</li>
              <li><ModeBadge mode="assumption" /> If a Qwen key is configured, the model may only rephrase those facts; its text is shown separately and as plain text.</li>
              <li><ModeBadge mode="unavailable" /> Without a key, offline or on provider failure, the deterministic explainer answers — the demo never depends on an AI API.</li>
              <li>The Copilot cannot assign resources, send alerts or execute anything.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
