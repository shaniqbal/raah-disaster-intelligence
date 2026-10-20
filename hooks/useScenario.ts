'use client';

import { useCallback, useDeferredValue, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { decodeScenario, encodeScenario, clampParams } from '@/lib/scenario/url';
import { computePlan, stateAt, type HourState, type ScenarioPlan } from '@/lib/scenario/engine';
import { scenarioById } from '@/lib/scenario/definitions';
import type { ScenarioDefinition, ScenarioParams } from '@/lib/scenario/types';

/**
 * Scenario state lives in the URL so every view is shareable and survives refresh.
 * Updates use history.replaceState (synced by Next.js) — no server round-trip.
 * The response plan is computed at the forecast peak and ignores the clock, so
 * scrubbing the timeline only recomputes the cheap hour state.
 */
export function useScenario(manual?: Record<string, string | null>) {
  const search = useSearchParams();
  const pathname = usePathname();
  const { def, params } = useMemo(() => decodeScenario(search.toString()), [search]);

  const write = useCallback(
    (d: ScenarioDefinition, p: ScenarioParams) => {
      window.history.replaceState(null, '', `${pathname}?${encodeScenario(d, p)}`);
    },
    [pathname],
  );

  const setParams = useCallback(
    (patch: Partial<ScenarioParams>, nextDef?: ScenarioDefinition) => {
      const d = nextDef ?? def;
      write(d, clampParams(d, nextDef ? { ...d.defaults, ...patch } : { ...params, ...patch }));
    },
    [def, params, write],
  );

  const selectScenario = useCallback(
    (id: string) => {
      const d = scenarioById(id);
      if (d) setParams({}, d);
    },
    [setParams],
  );

  const reset = useCallback(() => write(def, def.defaults), [def, write]);

  const deferred = useDeferredValue(params);
  const planKey = JSON.stringify({ ...deferred, hour: 0 });
  const plan: ScenarioPlan = useMemo(
    () => computePlan(def, { ...deferred, hour: 0 }, manual),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def, planKey, manual],
  );
  const current: HourState = useMemo(() => stateAt(def, params, params.hour), [def, params]);
  const shareQuery = encodeScenario(def, params);

  return { def, params, setParams, selectScenario, reset, plan, current, shareQuery, stale: deferred !== params };
}
