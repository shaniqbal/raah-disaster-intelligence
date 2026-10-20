import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { answerQuestion } from '@/lib/copilot/deterministic';
import { qwenConfig, qwenNarrative } from '@/lib/copilot/qwen';
import { decodeScenario } from '@/lib/scenario/url';
import { rateLimit } from '@/lib/security/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  question: z.string().trim().min(2).max(500),
  /** scenario query string as produced by encodeScenario — re-validated server-side */
  scenario: z.string().max(600).default(''),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const rl = rateLimit(`copilot:${ip}`, 12, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited', retryAfterS: rl.retryAfterS }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterS) } });
  }
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  // The server recomputes the scenario itself; client-supplied numbers are never trusted.
  const { def, params } = decodeScenario(body.scenario);
  const answer = answerQuestion(body.question, def, params);

  const cfg = qwenConfig();
  if (!cfg) {
    return NextResponse.json({ ...answer, notice: 'Deterministic explainer (no AI key configured on this deployment).' });
  }
  try {
    const narrative = await qwenNarrative(cfg, body.question, answer);
    return NextResponse.json({ ...answer, source: 'qwen', model: cfg.model, narrative });
  } catch (err) {
    // Log without user content or secrets.
    console.warn('[copilot] Qwen unavailable, using deterministic answer:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ ...answer, notice: 'AI provider unavailable — showing the deterministic, data-grounded explanation.' });
  }
}
