/**
 * Builder API - Consolidated endpoint for all builder program operations
 * GET: Fetch builder stats, volume, leaderboard position
 * POST: Submit builder-related data
 */

import { builderService } from '@/services/builderService';

/**
 * GET /api/builder
 * Fetch all builder stats (volume, leaderboard, configuration)
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'stats';

  try {
    switch (action) {
      case 'stats':
        return handleGetStats();
      case 'volume':
        return handleGetVolume(searchParams);
      case 'leaderboard':
        return handleGetLeaderboard(searchParams);
      case 'config':
        return handleGetConfig();
      case 'performance':
        return handleGetPerformance();
      default:
        return Response.json({
          error: 'Unknown action',
          available: ['stats', 'volume', 'leaderboard', 'config', 'performance']
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Builder API error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleGetStats() {
  const stats = await builderService.getBuilderStats();
  return Response.json({
    success: true,
    ...stats
  });
}

async function handleGetVolume(searchParams) {
  const dateParam = searchParams.get('date');
  const date = dateParam ? new Date(dateParam) : new Date();

  const volume = await builderService.getDailyVolume(date);
  return Response.json({
    success: true,
    date: date.toISOString().split('T')[0],
    ...volume
  });
}

async function handleGetLeaderboard(searchParams) {
  const timeframe = searchParams.get('timeframe') || '7d';
  const position = await builderService.getLeaderboardPosition(timeframe);

  if (!position) {
    return Response.json({
      success: false,
      error: 'Unable to fetch leaderboard position'
    }, { status: 404 });
  }

  return Response.json({
    success: true,
    timeframe,
    ...position
  });
}

async function handleGetConfig() {
  const isConfigured = builderService.isConfigured();
  const relayerConfig = builderService.getRelayerConfig();

  return Response.json({
    configured: isConfigured,
    relayer: relayerConfig,
    timestamp: new Date().toISOString()
  });
}

async function handleGetPerformance() {
  const metrics = await builderService.getPerformanceMetrics();
  return Response.json({
    success: metrics !== null,
    metrics
  });
}

/**
 * OPTIONS - CORS support
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
