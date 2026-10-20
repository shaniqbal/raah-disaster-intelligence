import { NextResponse } from 'next/server';
import { qwenConfig } from '@/lib/copilot/qwen';
import { ENGINE_VERSION } from '@/lib/scenario/engine';
import { RISK_MODEL_VERSION } from '@/lib/risk/engine';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    engine: ENGINE_VERSION,
    riskModel: RISK_MODEL_VERSION,
    aiProvider: qwenConfig() ? 'qwen-configured' : 'deterministic-only',
    time: new Date().toISOString(),
  });
}
