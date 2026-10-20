'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, LocateFixed, Phone, ShieldAlert, Trash2 } from 'lucide-react';
import { CONTACTS } from '@/lib/data/contacts';
import { advance, ASSISTANCE, createCase, purgeExpired, SOS_CATEGORIES, SOS_STATES, SosInput, type SosCase } from '@/lib/citizen/sos';
import { ASSIST_LABEL, C, CATEGORY_LABEL, GUIDANCE, KIT, STATE_LABEL } from '@/lib/i18n/citizen';
import { LANGS } from '@/lib/i18n/strings';
import { Button, Card, cx } from '@/components/ui/primitives';
import { readStore, removeStore, usePrefs, useToast, writeStore } from '@/components/shell/AppProviders';

const CASES_KEY = 'raah:sos-cases';
const KIT_KEY = 'raah:kit';

export function SosClient() {
  const { lang, setLang } = usePrefs();
  const toast = useToast();
  const rtl = lang === 'ur';
  const tx = (o: Record<string, string>) => o[lang];
  const [cases, setCases] = useState<SosCase[]>([]);
  const [kit, setKit] = useState<string[]>([]);
  const [guide, setGuide] = useState('flood');
  const [form, setForm] = useState({ category: 'flood', locationLabel: '', people: 1, assistance: ['evacuation'] as string[], contact: '', notes: '', precise: false, coord: undefined as [number, number] | undefined });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const stored = purgeExpired(readStore<SosCase[]>(CASES_KEY, []));
    setCases(stored);
    writeStore(CASES_KEY, stored);
    setKit(readStore<string[]>(KIT_KEY, []));
  }, []);

  const saveCases = (c: SosCase[]) => {
    setCases(c);
    writeStore(CASES_KEY, c);
  };

  const locate = () => {
    if (!('geolocation' in navigator)) return toast('Geolocation is not available in this browser.', 'warn');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const c: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setForm((f) => ({ ...f, coord: c, locationLabel: f.locationLabel || `${c[1].toFixed(2)}, ${c[0].toFixed(2)}` }));
      },
      () => {
        setLocating(false);
        toast('Location permission denied — type a location instead.', 'warn');
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const inBounds = form.coord && form.coord[0] >= 60 && form.coord[0] <= 78 && form.coord[1] >= 23 && form.coord[1] <= 38 ? form.coord : undefined;
    const parsed = SosInput.safeParse({ ...form, coord: inBounds });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    const c = createCase(parsed.data);
    saveCases([c, ...cases]);
    setForm((f) => ({ ...f, locationLabel: '', notes: '', contact: '', people: 1, coord: undefined }));
    toast(`${c.id} saved on this device (demo only — nothing was sent).`, 'ok');
  };

  return (
    <div className={cx('mx-auto max-w-5xl space-y-5', rtl && 'urdu')} dir={rtl ? 'rtl' : 'ltr'}>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">{tx(C.title)}</h1>
        <p className="text-sm text-muted">{tx(C.intro)}</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => setLang(l.id)} aria-pressed={lang === l.id} className={cx('min-h-11 rounded-lg border px-4 text-sm', lang === l.id ? 'border-accent bg-accent/15 text-ink' : 'border-line text-ink-2')}>
              {l.label}
            </button>
          ))}
        </div>
        {C.translationNote[lang] && <p className="text-xs text-caution">{tx(C.translationNote)}</p>}
      </header>

      <div role="alert" className="flex items-start gap-3 rounded-xl border-2 border-critical/50 bg-critical/10 p-4">
        <ShieldAlert className="mt-0.5 size-6 shrink-0 text-critical" aria-hidden />
        <div className="space-y-2">
          <p className="text-sm font-semibold leading-relaxed text-ink">{tx(C.demo)}</p>
          <a href="tel:1122" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-critical px-5 text-base font-bold text-white">
            <Phone className="size-5" aria-hidden /> 1122
          </a>
        </div>
      </div>

      <Card title={tx(C.numbers)} mode="historical">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CONTACTS.map((c) => (
            <li key={c.id}>
              <a href={`tel:${c.number}`} className="flex min-h-14 items-center gap-3 rounded-xl border border-line p-3 hover:border-accent">
                <span className="tabular grid h-11 min-w-14 place-items-center rounded-lg bg-accent/15 px-2 font-mono text-lg font-bold text-accent" dir="ltr">{c.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{c.name[lang]}</span>
                  <span className="block text-xs text-muted">{c.use[lang]}</span>
                </span>
                <span className="text-xs text-accent">{tx(C.call)}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted" dir="ltr">Sources: official service websites (rescue.gov.pk, punjabpolice.gov.pk, ndma.gov.pk, edhi.org, nhmp.gov.pk). Some services are not available in every district — if a number does not connect, try 1122 or 15.</p>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={tx(C.prepare)}>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {GUIDANCE.map((g) => (
              <button key={g.id} onClick={() => setGuide(g.id)} aria-pressed={guide === g.id} className={cx('min-h-10 rounded-lg border px-3 text-sm', guide === g.id ? 'border-accent bg-accent/15 text-ink' : 'border-line text-ink-2')}>
                {tx(g.title)}
              </button>
            ))}
          </div>
          <ol className="space-y-2">
            {GUIDANCE.find((g) => g.id === guide)!.steps[lang].map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 font-mono text-xs text-ink">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title={`${tx(C.kit)} · ${kit.length}/${KIT.length} ${tx(C.kitReady)}`}>
          <ul className="space-y-1">
            {KIT.map((k) => {
              const on = kit.includes(k.id);
              return (
                <li key={k.id}>
                  <button
                    onClick={() => {
                      const next = on ? kit.filter((x) => x !== k.id) : [...kit, k.id];
                      setKit(next);
                      writeStore(KIT_KEY, next);
                    }}
                    aria-pressed={on}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-start text-sm hover:bg-surface-2"
                  >
                    {on ? <CheckCircle2 className="size-5 shrink-0 text-ok" aria-hidden /> : <Circle className="size-5 shrink-0 text-muted" aria-hidden />}
                    <span className={on ? 'text-ink' : 'text-ink-2'}>{tx(k.label)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card title={tx(C.sos)} mode="simulated">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">{tx(C.category)}</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {SOS_CATEGORIES.map((c) => (
                  <label key={c} className={cx('flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm', form.category === c ? 'border-accent bg-accent/10 text-ink' : 'border-line text-ink-2')}>
                    <input type="radio" name="category" value={c} checked={form.category === c} onChange={() => setForm((f) => ({ ...f, category: c }))} className="accent-[var(--accent)]" />
                    {tx(CATEGORY_LABEL[c])}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1.5">
              <label htmlFor="sos-loc" className="text-sm font-medium text-ink">{tx(C.location)}</label>
              <div className="flex gap-2">
                <input id="sos-loc" value={form.locationLabel} onChange={(e) => setForm((f) => ({ ...f, locationLabel: e.target.value }))} maxLength={120} aria-invalid={!!errors.locationLabel} aria-describedby={errors.locationLabel ? 'sos-loc-err' : undefined} className="h-12 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-2 px-3 text-base text-ink" />
                <Button type="button" onClick={locate} loading={locating} aria-label={tx(C.useLocation)} className="h-12"><LocateFixed className="size-4" /></Button>
              </div>
              {errors.locationLabel && <p id="sos-loc-err" className="text-xs text-critical">{errors.locationLabel}</p>}
              {form.coord && (
                <label className="flex items-center gap-2 text-xs text-ink-2">
                  <input type="checkbox" checked={form.precise} onChange={(e) => setForm((f) => ({ ...f, precise: e.target.checked }))} className="size-4 accent-[var(--accent)]" /> {tx(C.precise)}
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="sos-people" className="text-sm font-medium text-ink">{tx(C.people)}</label>
              <input id="sos-people" type="number" inputMode="numeric" min={1} max={500} value={form.people} onChange={(e) => setForm((f) => ({ ...f, people: Number(e.target.value) }))} className="h-12 w-32 rounded-lg border border-line-strong bg-surface-2 px-3 text-base text-ink" />
              {errors.people && <p className="text-xs text-critical">{errors.people}</p>}
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">{tx(C.assistance)}</legend>
              <div className="flex flex-wrap gap-1.5">
                {ASSISTANCE.map((a) => {
                  const on = form.assistance.includes(a);
                  return (
                    <label key={a} className={cx('flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm', on ? 'border-accent bg-accent/10 text-ink' : 'border-line text-ink-2')}>
                      <input type="checkbox" checked={on} onChange={() => setForm((f) => ({ ...f, assistance: on ? f.assistance.filter((x) => x !== a) : [...f.assistance, a] }))} className="accent-[var(--accent)]" />
                      {tx(ASSIST_LABEL[a])}
                    </label>
                  );
                })}
              </div>
              {errors.assistance && <p className="mt-1 text-xs text-critical">{errors.assistance}</p>}
            </fieldset>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="sos-contact" className="text-sm font-medium text-ink">{tx(C.contact)}</label>
                <input id="sos-contact" type="tel" inputMode="tel" autoComplete="off" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} maxLength={20} dir="ltr" className="h-12 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-base text-ink" />
                {errors.contact && <p className="text-xs text-critical">{errors.contact}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="sos-notes" className="text-sm font-medium text-ink">{tx(C.notes)}</label>
                <input id="sos-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} maxLength={400} className="h-12 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-base text-ink" />
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted">{tx(C.privacy)}</p>
            <Button type="submit" variant="primary" size="lg" className="w-full">{tx(C.submit)}</Button>
          </form>
        </Card>

        <Card title={`${tx(C.myReports)} (${cases.length})`} mode="simulated" actions={cases.length > 0 ? <Button size="sm" variant="danger" onClick={() => { removeStore(CASES_KEY); setCases([]); toast('All demo reports deleted from this device.'); }}><Trash2 className="size-3.5" aria-hidden /> {tx(C.deleteAll)}</Button> : undefined}>
          {!cases.length ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="space-y-3">
              {cases.map((c) => {
                const idx = SOS_STATES.indexOf(c.state);
                return (
                  <li key={c.id} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-accent" dir="ltr">{c.id}</span>
                      <span className="rounded bg-sim/15 px-1.5 text-[10px] font-semibold text-sim" dir="ltr">DEMO</span>
                      <span className="ms-auto text-xs text-muted" dir="ltr">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink">{tx(CATEGORY_LABEL[c.category])} · {c.locationLabel} · {c.people}</p>
                    <ol className="mt-3 flex items-center gap-1" aria-label="Case progress">
                      {SOS_STATES.map((s, i) => (
                        <li key={s} className="flex flex-1 flex-col items-center gap-1">
                          <span className={cx('h-1.5 w-full rounded-full', i <= idx ? 'bg-accent' : 'bg-surface-3')} />
                          <span className={cx('text-[10px]', i === idx ? 'font-semibold text-ink' : 'text-muted')} aria-current={i === idx ? 'step' : undefined}>{tx(STATE_LABEL[s])}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-2 text-xs text-ink-2">{c.history.at(-1)?.note}</p>
                    {c.state !== 'resolved' && (
                      <Button size="sm" className="mt-2" onClick={() => saveCases(cases.map((x) => (x.id === c.id ? advance(x) : x)))}>
                        {tx(C.advance)}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
