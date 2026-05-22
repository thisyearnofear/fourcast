import { getAutopilotExecutions } from '@/services/db';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const result = await getAutopilotExecutions(limit);

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      executions: result.executions,
      count: result.executions.length,
    });
  } catch (error) {
    console.error('Autopilot executions API error:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch autopilot executions' },
      { status: 500 }
    );
  }
}
