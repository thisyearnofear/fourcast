import { checkReceiptWatches } from '@/services/receiptWatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/receipt-watch
 *
 * Rechecks every stored watch and pushes when the receipt status changed.
 * Hobby cron runs once a day per expression, so this path is scheduled
 * four times. An open tab can also call POST /api/push/check.
 */
export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await checkReceiptWatches();
    return Response.json(result);
  } catch (error) {
    console.error('[GET /api/cron/receipt-watch]', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
