import { getAgentTrackRecord } from '@/services/db';

export async function GET() {
  try {
    const result = await getAgentTrackRecord();
    
    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      stats: result.stats,
      recentForecasts: result.recentForecasts,
    });
  } catch (error) {
    console.error('Track record API error:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch track record' },
      { status: 500 }
    );
  }
}
