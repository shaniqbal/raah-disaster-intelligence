'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { HazardType } from '@/lib/domain/types';
import { assessAll, HAZARD_LABELS } from '@/lib/risk/engine';
import { regionById } from '@/lib/data/regions';
import { PakMap, Marker, MapLabels, MapLegend } from '@/components/map/PakMap';
import { RiskExplain } from '@/components/risk/RiskExplain';
import { BAND_COLOR, Card, DemoNotice, Meter, ModeBadge, RiskBadge, SectionTitle, Tabs, cx } from '@/components/ui/primitives';
import { useLiveData, usePrefs } from '@/components/shell/AppProviders';

const HAZARDS: HazardType[] = ['flood', 'urban_flood', 'earthquake', 'heatwave', 'landslide'];

export function RiskClient() {
  const search = useSearchParams();
  const pathname = usePathname();
  const { region: focus, setRegion } = usePrefs();
  const { liveInputs, forecast } = useLiveData();
  const hazard = (HAZARDS.includes(search.get('hazard') as HazardType) ? search.get('hazard') : 'flood') as HazardType;
  const regionParam = search.get('region');
  const selectedId = regionById(regionParam ?? '') ? regionParam! : focus || null;

  useEffect(() => {
    if (regionParam && regionById(regionParam) && regionParam !== focus) setRegion(regionParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionParam]);

  const set = (patch: { hazard?: HazardType; region?: string }) => {
    const q = new URLSearchParams(search.toString());
    if (patch.hazard) q.set('hazard', patch.hazard);
    if (patch.region) {
      q.set('region', patch.region);
      setRegion(patch.region);
    }
    window.history.replaceState(null, '', `${pathname}?${q}`);
  };

  const list = useMemo(() => assessAll(hazard, liveInputs), [hazard, liveInputs]);
  const selected = list.find((a) => a.regionId === selectedId) ?? list[0];
  const liveUsed = Object.keys(liveInputs).length > 0;

  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Explainable screening" title="Risk Intelligence">
        A transparent, relative risk index for 18 focus regions. Every score decomposes into hazard, exposure and access factors with their source, mode and formula. It is a screening tool for preparedness discussions — <strong className="text-ink-2">not a forecast</strong>.
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-3">
        <Tabs label="Hazard" value={hazard} onChange={(h) => set({ hazard: h })} tabs={HAZARDS.map((h) => ({ value: h, label: HAZARD_LABELS[h] }))} />
        <span className="flex items-center gap-2 text-xs text-muted">
          Live forecast factor: <ModeBadge mode={liveUsed ? 'live' : forecast.mode === 'loading' ? 'unavailable' : 'unavailable'} />
          {!liveUsed && <span>excluded — weights re-normalised</span>}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <div className="relative h-[48vh] min-h-[340px]">
            <PakMap
              view={selected ? { center: regionById(selected.regionId)!.coord, zoom: 5.6 } : undefined}
              ariaLabel={`${HAZARD_LABELS[hazard]} risk by region`}
              screenOverlay={
                <g>
                  {list.map((a) => {
                    const r = regionById(a.regionId)!;
                    return <Marker key={a.regionId} at={r.coord} r={5 + a.riskScore / 12} color={BAND_COLOR[a.riskBand]} label={`${r.name}: ${a.riskBand} (${a.riskScore})`} onSelect={() => set({ region: a.regionId })} selected={a.regionId === selected?.regionId} />;
                  })}
                  <MapLabels items={list.map((a) => ({ id: a.regionId, at: regionById(a.regionId)!.coord, text: regionById(a.regionId)!.name.split(' (')[0], r: 5 + a.riskScore / 13, priority: a.riskScore + (a.regionId === selected?.regionId ? 1000 : 0) }))} />
                </g>
              }
            />
            <MapLegend className="absolute bottom-6 left-2" title="Risk band" items={(['critical', 'high', 'moderate', 'low'] as const).map((b) => ({ label: b[0].toUpperCase() + b.slice(1), color: BAND_COLOR[b] }))} />
          </div>
          <Card title={`Regional ranking — ${HAZARD_LABELS[hazard]}`} mode="estimated" bodyClassName="p-0">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line"><th className="px-4 py-2 font-medium">Region</th><th className="px-2 py-2 font-medium">Score</th><th className="w-40 px-2 py-2 font-medium">H · E · A</th><th className="px-4 py-2 font-medium">Band</th></tr>
                </thead>
                <tbody>
                  {list.map((a) => {
                    const r = regionById(a.regionId)!;
                    return (
                      <tr key={a.regionId} className={cx('cursor-pointer border-b border-line/60 hover:bg-surface-2', a.regionId === selected?.regionId && 'bg-accent/5')} onClick={() => set({ region: a.regionId })}>
                        <td className="px-4 py-2">
                          <button className="text-left text-ink hover:text-accent" onClick={(e) => { e.stopPropagation(); set({ region: a.regionId }); }}>{r.name}</button>
                          <span className="block text-[11px] text-muted">{r.province}</span>
                        </td>
                        <td className="tabular px-2 py-2 font-mono text-ink">{a.riskScore}</td>
                        <td className="px-2 py-2">
                          <Meter value={a.riskScore} color={BAND_COLOR[a.riskBand]} label={`${r.name} risk score`} />
                          <span className="tabular font-mono text-[10.5px] text-muted">{a.hazardScore} · {a.exposureScore} · {a.accessScore}</span>
                        </td>
                        <td className="px-4 py-2"><RiskBadge band={a.riskBand} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <Card title="Why this score?" mode="estimated" className="xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto">
          {selected && <RiskExplain a={selected} />}
        </Card>
      </div>
      <DemoNotice compact />
    </div>
  );
}
