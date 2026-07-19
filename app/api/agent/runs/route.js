import { getAgentRunLedger } from '@/services/db';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '8', 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 30))
      : 8;
    const result = await getAgentRunLedger(limit);

    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 500 });
    }

    return Response.json({ success: true, runs: result.runs, count: result.runs.length });
  } catch (error) {
    console.error('Agent run ledger API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch agent run ledger' }, { status: 500 });
  }
}
