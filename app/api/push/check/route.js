import { checkReceiptWatches } from '@/services/receiptWatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const recent = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 6;
}

/** An open tab can fan a real status change out to browsers that are closed. */
export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return Response.json({ success: false, error: 'Slow down' }, { status: 429 });
  }
  try {
    const result = await checkReceiptWatches();
    return Response.json(result);
  } catch (error) {
    console.error('[POST /api/push/check]', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
