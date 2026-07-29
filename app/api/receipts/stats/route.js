import { getReceiptStatsRows } from '@/services/db';
import { deriveReceiptStats } from '@/services/domain/decision/receiptStats';
import { listReceiptFiles } from '@/services/txline/txlineService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Aggregate trust metrics for the landing page.
 *
 * Combines counts derived from stored agent-run summaries (SQLite) with the
 * committed on-chain fixture receipts on disk. Never fabricates: on any
 * failure it returns 503 and the landing strip renders nothing.
 */
export async function GET() {
  try {
    const rowsResult = await getReceiptStatsRows();
    if (!rowsResult.success) {
      throw new Error(rowsResult.error || 'receipt rows unavailable');
    }

    const stats = deriveReceiptStats(rowsResult.summaries);
    const onchainFixtureReceipts = listReceiptFiles().length;

    return Response.json(
      {
        success: true,
        stats: { ...stats, onchainFixtureReceipts },
        timestamp: new Date().toISOString(),
      },
      {
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=30' },
      },
    );
  } catch (error) {
    console.error('[/api/receipts/stats] error:', error.message);
    return Response.json(
      {
        success: false,
        error: error.message || 'receipt stats unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
