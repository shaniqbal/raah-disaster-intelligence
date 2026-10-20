'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, CheckCircle2, FlaskConical, Lightbulb, Scale, Send, Sparkles, User } from 'lucide-react';
import { answerQuestion, type CopilotAnswer, type FactKind } from '@/lib/copilot/deterministic';
import { decodeScenario } from '@/lib/scenario/url';
import { Button, cx } from '@/components/ui/primitives';

export async function askCopilot(question: string, scenarioQuery: string): Promise<CopilotAnswer> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch('/api/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, scenario: scenarioQuery }), signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as CopilotAnswer;
  } catch {
    // Offline or server unavailable: the same deterministic explainer runs in the browser.
    const { def, params } = decodeScenario(scenarioQuery);
    return { ...answerQuestion(question, def, params), notice: 'Answered locally in your browser (server unreachable). Same deterministic, data-grounded logic.' };
  } finally {
    clearTimeout(timer);
  }
}

const KIND: Record<FactKind, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  verified: { label: 'Verified source fact', icon: CheckCircle2, cls: 'text-info' },
  estimate: { label: 'Model-derived estimate', icon: Scale, cls: 'text-accent-2' },
  assumption: { label: 'Scenario assumption', icon: FlaskConical, cls: 'text-caution' },
  advice: { label: 'General guidance', icon: Lightbulb, cls: 'text-ok' },
};

export function AnswerView({ answer }: { answer: CopilotAnswer }) {
  const groups = (Object.keys(KIND) as FactKind[]).map((k) => ({ k, facts: answer.facts.filter((f) => f.kind === k) })).filter((g) => g.facts.length);
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">{answer.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{answer.summary}</p>
      </div>
      {answer.narrative && (
        <div className="rounded-lg border border-sim/40 bg-sim/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sim">
            <Sparkles className="size-3.5" aria-hidden /> AI narrative · {answer.model} · grounded in the facts below
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{answer.narrative}</p>
        </div>
      )}
      {groups.map(({ k, facts }) => {
        const K = KIND[k];
        return (
          <div key={k}>
            <p className={cx('mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider', K.cls)}>
              <K.icon className="size-3.5" aria-hidden /> {K.label}
            </p>
            <ul className="space-y-1 border-l border-line pl-3 text-xs leading-snug text-ink-2">
              {facts.map((f) => (
                <li key={f.id}>{f.text}</li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="rounded-lg bg-surface-3/60 px-3 py-2 text-[11px] leading-snug text-muted">
        <strong className="text-ink-2">Uncertainty:</strong> {answer.uncertainty}
      </p>
      <p className="text-[10.5px] text-muted">
        Source: {answer.source === 'qwen' ? `Qwen (${answer.model}) narrative over RAAH’s deterministic facts` : 'RAAH deterministic explainer (no language model)'}
        {answer.notice ? ` · ${answer.notice}` : ''}
      </p>
    </div>
  );
}

interface Msg {
  role: 'user' | 'assistant';
  text?: string;
  answer?: CopilotAnswer;
}

export const SUGGESTED = [
  'Why was this response plan recommended?',
  'What changes if rescue boats are reduced?',
  'Which shelter has available capacity in this simulation?',
  'What are the major assumptions in this model?',
  'Why is Rajanpur marked high risk for floods?',
  'Which data is real and which is simulated?',
];

export function CopilotChat({ scenarioQuery, initialQuestion, compact }: { scenarioQuery: string; initialQuestion?: string; compact?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setQ('');
    setBusy(true);
    const answer = await askCopilot(question, scenarioQuery);
    setMsgs((m) => [...m, { role: 'assistant', answer }]);
    setBusy(false);
  };

  useEffect(() => {
    if (initialQuestion && !asked.current) {
      asked.current = true;
      void ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), [msgs, busy]);

  const last = msgs.filter((m) => m.answer).at(-1)?.answer;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cx('scrollbar-thin flex-1 space-y-4 overflow-y-auto pr-1', compact ? 'max-h-[55vh]' : 'min-h-[300px]')} aria-live="polite">
        {!msgs.length && (
          <div className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">
            <p className="flex items-center gap-2 font-medium text-ink"><Bot className="size-4 text-accent" aria-hidden /> Ask about risk, scenarios, routes or data provenance.</p>
            <p className="mt-1 text-xs">Answers come from RAAH’s structured data. The Copilot cannot change assignments, send alerts or invent events.</p>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end gap-2">
              <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-accent/15 px-3.5 py-2 text-sm text-ink">{m.text}</p>
              <User className="mt-1 size-4 shrink-0 text-muted" aria-hidden />
            </div>
          ) : (
            <div key={i} className="flex gap-2">
              <Bot className="mt-1 size-4 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-line bg-surface-2/70 p-3.5 fade-up">
                <AnswerView answer={m.answer!} />
              </div>
            </div>
          ),
        )}
        {busy && <p className="flex items-center gap-2 text-xs text-muted"><Bot className="size-4 animate-pulse text-accent" aria-hidden /> Assembling an evidence-based answer…</p>}
        <div ref={endRef} />
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {(last?.followUps ?? SUGGESTED.slice(0, compact ? 3 : 6)).map((s) => (
            <button key={s} onClick={() => ask(s)} disabled={busy} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-2 hover:border-accent hover:text-ink disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(q);
          }}
          className="flex gap-2"
        >
          <label htmlFor="copilot-q" className="sr-only">Ask the copilot</label>
          <input id="copilot-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="Ask in English, Urdu or Roman Urdu…" className="h-11 flex-1 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm text-ink placeholder:text-muted" />
          <Button type="submit" variant="primary" disabled={busy || q.trim().length < 2} aria-label="Send question"><Send className="size-4" /></Button>
        </form>
      </div>
    </div>
  );
}
