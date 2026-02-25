import { NextResponse } from 'next/server';
import { synthService } from '@/services/synthService';

/**
 * POST /api/synth/warm-cache
 * Warm Synth cache for popular assets
 * Can be called on app startup or via cron
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const assets = body.assets || ['BTC', 'ETH', 'SOL'];

    const results = await synthService.warmCache(assets);

    return NextResponse.json({
      success: true,
      ...results,
      cacheStats: synthService.getCacheStats(),
    });
  } catch (error) {
    console.error('[Synth Warm Cache] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/synth/warm-cache
 * Get cache statistics
 */
export async function GET() {
  try {
    const stats = synthService.getCacheStats();
    
    return NextResponse.json({
      success: true,
      stats,
      supported: synthService.SUPPORTED_ASSETS,
      relevantCategories: synthService.SYNTH_RELEVANT_CATEGORIES,
    });
  } catch (error) {
    console.error('[Synth Cache Stats] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
