/**
 * Bright Data status endpoint
 * Returns which Bright Data products are configured and available.
 * Used by the AutopilotDashboard to show connection status before running the agent.
 */

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { brightDataService } = await import('@/services/brightDataService.js');

    const status = brightDataService.getStatus();
    const anyAvailable = brightDataService.isAvailable();

    return Response.json({
      success: true,
      available: anyAvailable,
      products: status,
      config: {
        hasApiKey: !!process.env.BRIGHT_DATA_API_KEY,
        hasSerpZone: !!process.env.BRIGHT_DATA_SERP_ZONE,
        hasUnlockerZone: !!process.env.BRIGHT_DATA_UNLOCKER_ZONE,
        hasSbrEndpoint: !!(process.env.BRIGHT_DATA_SBR_WS_ENDPOINT || process.env.BRIGHT_DATA_SBR_AUTH),
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    return Response.json({
      success: false,
      available: false,
      error: err.message,
    }, { status: 500 });
  }
}
