import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerQuestion, detectIntent } from '@/lib/copilot/deterministic';
import { qwenConfig, buildMessages } from '@/lib/copilot/qwen';
import { DEFAULT_SCENARIO } from '@/lib/scenario/definitions';
import { POST } from '@/app/api/copilot/route';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const req = (body: unknown, ip = '10.0.0.1') =>
  new Request('http://localhost/api/copilot', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) }) as unknown as import('next/server').NextRequest;

describe('deterministic copilot', () => {
  it('detects intents', () => {
    expect(detectIntent('Why was this response plan recommended?').intent).toBe('why-plan');
    expect(detectIntent('What changes if rescue boats are reduced?').intent).toBe('what-if-boats');
    expect(detectIntent('Which shelter has available capacity?').intent).toBe('shelter');
    expect(detectIntent('What are the major assumptions in this model?').intent).toBe('assumptions');
    expect(detectIntent('Why is Rajanpur marked high risk?')).toMatchObject({ intent: 'risk-region', regionId: 'rajanpur' });
    expect(detectIntent('hello').intent).toBe('help');
  });
  it('answers with typed facts and an uncertainty statement', () => {
    const a = answerQuestion('Why was this response plan recommended?', DEFAULT_SCENARIO, DEFAULT_SCENARIO.defaults);
    expect(a.facts.length).toBeGreaterThan(3);
    expect(new Set(a.facts.map((f) => f.kind))).toContain('assumption');
    expect(a.uncertainty).toMatch(/simulation/i);
  });
  it('what-if questions are answered by a real counterfactual re-run', () => {
    const a = answerQuestion('What changes if rescue boats are reduced?', DEFAULT_SCENARIO, DEFAULT_SCENARIO.defaults);
    expect(a.title).toContain(`boats ${DEFAULT_SCENARIO.defaults.boats} → ${Math.floor(DEFAULT_SCENARIO.defaults.boats / 2)}`);
  });
});

describe('/api/copilot', () => {
  it('returns the deterministic answer when no AI key is configured', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    vi.stubEnv('QWEN_API_KEY', '');
    const res = await POST(req({ question: 'Which shelter has capacity?', scenario: 's=south-punjab-flood' }, '10.0.0.2'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('deterministic');
    expect(json.notice).toMatch(/no AI key/);
  });
  it('rejects invalid bodies', async () => {
    const res = await POST(req({ question: 'x' }, '10.0.0.3'));
    expect(res.status).toBe(400);
  });
  it('rate-limits bursts', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '');
    let last = 200;
    for (let i = 0; i < 14; i++) last = (await POST(req({ question: 'assumptions?', scenario: '' }, '10.9.9.9'))).status;
    expect(last).toBe(429);
  });
  it('uses Qwen for the narrative when configured and keeps facts deterministic', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', 'sk-test-1234567890');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Grounded narrative.' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await POST(req({ question: 'Why was this plan recommended?', scenario: 's=south-punjab-flood' }, '10.0.0.4'));
    const json = await res.json();
    expect(json.source).toBe('qwen');
    expect(json.narrative).toBe('Grounded narrative.');
    expect(json.facts.length).toBeGreaterThan(0);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.headers && (init.headers as Record<string, string>).Authorization)).toContain('Bearer sk-test');
  });
  it('falls back to deterministic when the AI provider fails', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', 'sk-test-1234567890');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const json = await (await POST(req({ question: 'assumptions?', scenario: '' }, '10.0.0.5'))).json();
    expect(json.source).toBe('deterministic');
    expect(json.notice).toMatch(/unavailable/);
  });
  it('the system prompt forbids invented facts and the key never reaches messages', () => {
    const cfg = qwenConfig({ DASHSCOPE_API_KEY: 'sk-secret-abcdefghij' })!;
    const msgs = buildMessages('q', answerQuestion('assumptions', DEFAULT_SCENARIO, DEFAULT_SCENARIO.defaults));
    expect(msgs[0].content).toMatch(/ONLY the facts/);
    expect(JSON.stringify(msgs)).not.toContain(cfg.apiKey);
    expect(qwenConfig({})).toBeNull();
  });
});
