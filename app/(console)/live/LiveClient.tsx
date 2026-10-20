'use client';

import { RefreshCw } from 'lucide-react';
import { useLiveData, type LiveSlot } from '@/components/shell/AppProviders';
import { sourceById } from '@/lib/data/sources';
import { regionById } from '@/lib/data/regions';
import { usgsUrl } from '@/lib/providers/usgs';
import { openMeteoUrl } from '@/lib/providers/openMeteo';
import { PakMap, Marker } from '@/components/map/PakMap';
import { Button, Card, EmptyState, ModeBadge, SectionTitle, Skeleton } from '@/components/ui/primitives';

function HealthCard({ name, sourceId, slot, endpoint }: { name: string; sourceId: string; slot: LiveSlot<unknown>; endpoint: string }) {
  const src = sourceById(sourceId)!;
  const h = slot.health;
  return (
    <Card title={name} mode={slot.mode === 'loading' ? undefined : slot.mode}>
      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted">Status</dt><dd className="text-ink">{slot.mode === 'loading' ? 'Checking…' : h.status}</dd>
        <dt className="text-muted">Retrieved</dt><dd className="tabular font-mono text-ink">{h.retrievedAt ? new Date(h.retrievedAt).toLocaleString() : '—'}</dd>
        <dt className="text-muted">Last check</dt><dd className="tabular font-mono text-ink">{h.checkedAt ? new Date(h.checkedAt).toLocaleString() : '—'}</dd>
        <dt className="text-muted">Latency</dt><dd className="tabular font-mono text-ink">{h.latencyMs ? `${h.latencyMs} ms` : '—'}</dd>
        {h.message && (<><dt className="text-muted">Error</dt><dd className="text-critical">{h.message}</dd></>)}
        <dt className="text-muted">Provider</dt><dd className="text-ink-2">{src.provider}</dd>
        <dt className="text-muted">License</dt><dd className="text-ink-2">{src.license}</dd>
        <dt className="text-muted">Coverage</dt><dd className="text-ink-2">{src.coverage}</dd>
        <dt className="text-muted">Updates</dt><dd className="text-ink-2">{src.updateFrequency}</dd>
        <dt className="text-muted">Cache policy</dt><dd className="text-ink-2">Last successful response stored on this device and shown as CACHED LIVE with its timestamp. Never replaced by synthetic data.</dd>
        <dt className="text-muted">Limitations</dt><dd className="text-ink-2">{src.limitations}</dd>
        <dt className="text-muted">Endpoint</dt><dd className="break-all font-mono text-[10.5px] text-muted">{endpoint}</dd>
      </dl>
    </Card>
  );
}

export function LiveClient() {
  const { quakes, forecast, refresh } = useLiveData();
  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Provider health & provenance" title="Live Data">
        RAAH connects only to public, keyless APIs that allow browser access. When a provider fails, its data is marked UNAVAILABLE (or CACHED LIVE with the original timestamp) — never filled with simulated values.
      </SectionTitle>
      <div className="flex justify-end">
        <Button size="sm" onClick={refresh}><RefreshCw className="size-3.5" aria-hidden /> Retry all providers</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HealthCard name="USGS earthquakes" sourceId="usgs-fdsn" slot={quakes as LiveSlot<unknown>} endpoint={usgsUrl()} />
        <HealthCard name="Open-Meteo forecast" sourceId="open-meteo" slot={forecast as LiveSlot<unknown>} endpoint={openMeteoUrl().slice(0, 140) + '…'} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Earthquakes M4+ · last 30 days" mode={quakes.mode === 'loading' ? undefined : quakes.mode}>
          {quakes.mode === 'loading' ? (
            <Skeleton className="h-64" />
          ) : !quakes.data ? (
            <EmptyState title="USGS is unavailable">The request failed or timed out ({quakes.health.message ?? 'no response'}). No earthquake data is shown rather than inventing any.</EmptyState>
          ) : (
            <div className="space-y-3">
              <div className="h-64"><PakMap minHeight={256} ariaLabel="Recent earthquakes" screenOverlay={<g>{quakes.data.map((q) => <Marker key={q.id} at={q.coord} r={2 + q.magnitude} color="var(--sim)" label={`M${q.magnitude.toFixed(1)} ${q.place}`} />)}</g>} /></div>
              <div className="scrollbar-thin max-h-64 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface text-muted"><tr><th className="py-1.5 pr-2">Time (local)</th><th className="pr-2">M</th><th className="pr-2">Depth</th><th>Place</th></tr></thead>
                  <tbody>
                    {quakes.data.map((q) => (
                      <tr key={q.id} className="border-t border-line/60">
                        <td className="tabular py-1.5 pr-2 font-mono">{new Date(q.time).toLocaleString()}</td>
                        <td className="tabular pr-2 font-mono text-ink">{q.magnitude.toFixed(1)}</td>
                        <td className="tabular pr-2 font-mono">{q.depthKm.toFixed(0)} km</td>
                        <td><a className="text-ink-2 underline underline-offset-2 hover:text-accent" href={q.url} target="_blank" rel="noopener noreferrer">{q.place}</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!quakes.data.length && <p className="py-4 text-center text-xs text-muted">No M4+ events in the box for 30 days.</p>}
              </div>
            </div>
          )}
        </Card>
        <Card title="3-day forecast by focus region" mode={forecast.mode === 'loading' ? undefined : forecast.mode} subtitle="Numerical model output (Open-Meteo), not an official PMD forecast or warning.">
          {forecast.mode === 'loading' ? (
            <Skeleton className="h-64" />
          ) : !forecast.data ? (
            <EmptyState title="Open-Meteo is unavailable">Risk scores exclude the live rainfall/temperature factor and re-normalise the remaining weights.</EmptyState>
          ) : (
            <div className="scrollbar-thin max-h-[30rem] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-surface text-muted"><tr><th className="py-1.5 pr-2">Region</th>{forecast.data[0]?.daily.map((d) => <th key={d.date} className="pr-2">{d.date.slice(5)}</th>)}<th className="pr-2">3-day rain</th><th>Max °C</th></tr></thead>
                <tbody>
                  {forecast.data.map((f) => (
                    <tr key={f.regionId} className="border-t border-line/60">
                      <td className="py-1.5 pr-2 text-ink">{regionById(f.regionId)?.name}</td>
                      {f.daily.map((d) => <td key={d.date} className="tabular pr-2 font-mono">{d.rainMm.toFixed(1)} mm</td>)}
                      <td className="tabular pr-2 font-mono text-ink">{f.rain3dMm.toFixed(1)}</td>
                      <td className="tabular font-mono text-ink">{f.tmax3dC.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <Card title="Evaluated but not integrated">
        <ul className="space-y-1.5 text-xs text-ink-2">
          <li><ModeBadge mode="unavailable" /> <strong>Pakistan Meteorological Department (PMD)</strong> — publishes forecasts and advisories on its website; no documented public JSON API was verified, so none is used.</li>
          <li><ModeBadge mode="unavailable" /> <strong>NDMA / PDMAs</strong> — situation reports and advisories are published as documents; integration requires an official data-sharing arrangement.</li>
          <li><ModeBadge mode="unavailable" /> <strong>Hospitals and shelter registries</strong> — no verified, licensed national dataset was available to this project; shelters in scenarios are illustrative.</li>
        </ul>
      </Card>
    </div>
  );
}
