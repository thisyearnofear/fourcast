/**
 * GET /api/stats?address=0x...
 * 
 * Returns user stats for:
 * - Personal Stats Dashboard
 * - Shareable content generation
 * - On-chain reputation system
 */

import { getUserStats, getUserRanking, getUserPredictionHistory } from '@/services/userStatsService.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const includeRanking = searchParams.get('includeRanking') === 'true';

    if (!address) {
      return Response.json({
        success: false,
        error: 'Missing address parameter'
      }, { status: 400 });
    }

    // Get user stats
    const stats = await getUserStats(address);

    if (!stats) {
      return Response.json({
        success: false,
        error: 'Failed to calculate stats'
      }, { status: 500 });
    }

    const response = { ...stats };

    // Optionally include prediction history
    if (includeHistory) {
      const history = await getUserPredictionHistory(address, 50);
      response.predictionHistory = history;
    }

    // Optionally include ranking
    if (includeRanking) {
      const ranking = await getUserRanking(address);
      response.ranking = ranking;
    }

    return Response.json({
      success: true,
      stats: response
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
