import { agentBacktestingService } from '@/services/analysis/agentBacktestingService';

export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30', 10);

  try {
    const metrics = await agentBacktestingService.getPerformanceSummary(days);
    return Response.json({ success: true, metrics });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
