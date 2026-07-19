import { getHistoricalLabStatus, saveHistoricalLabStatus } from '@/services/db';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// SHA-256 commitment to the private bearer token stored only on the VPS.
// The endpoint never needs the bearer value itself (or a Vercel runtime secret)
// to authenticate a heartbeat.
const WORKER_TOKEN_HASH = 'ad9a9e881fb70bb56555b68a26f944876cdd3f0aa71492aff9fc6dd1807777b5';

export async function GET() {
  try {
    const result = await getHistoricalLabStatus();
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[historical-lab] read failed:', error);
    return Response.json({ success: false, error: 'Unable to load historical lab status' }, { status: 500 });
  }
}

export async function POST(request) {
  const receivedSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const receivedHash = receivedSecret
    ? crypto.createHash('sha256').update(receivedSecret).digest('hex')
    : null;
  if (!receivedHash || !crypto.timingSafeEqual(Buffer.from(receivedHash), Buffer.from(WORKER_TOKEN_HASH))) {
    return Response.json({ success: false, error: 'Unauthorized worker heartbeat' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    if (payload?.dataMode !== 'historical-lab' || !Array.isArray(payload?.receipts)) {
      return Response.json({ success: false, error: 'Invalid historical lab status payload' }, { status: 400 });
    }
    const result = await saveHistoricalLabStatus(payload);
    return Response.json(result);
  } catch (error) {
    console.error('[historical-lab] write failed:', error);
    return Response.json({ success: false, error: 'Unable to save historical lab status' }, { status: 500 });
  }
}
