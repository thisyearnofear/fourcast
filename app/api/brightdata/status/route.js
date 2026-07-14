/**
 * Bright Data status endpoint
 * Returns whether optional scrape enrichment is usable (not just configured).
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
      configured: brightDataService.isConfigured(),
      products: status,
      config: {
        hasApiKey: !!process.env.BRIGHT_DATA_API_KEY,
        hasSerpZone: !!process.env.BRIGHT_DATA_SERP_ZONE,
        hasUnlockerZone: !!process.env.BRIGHT_DATA_UNLOCKER_ZONE,
        hasSbrEndpoint: !!(process.env.BRIGHT_DATA_SBR_WS_ENDPOINT || process.env.BRIGHT_DATA_SBR_AUTH),
        enabledFlag: process.env.BRIGHT_DATA_ENABLED ?? 'unset',
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    return Response.json({
      success: false,
      available: false,
      configured: false,
      error: err.message,
    }, { status: 500 });
  }
}
