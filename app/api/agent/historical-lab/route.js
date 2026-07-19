import { getHistoricalLabStatus, saveHistoricalLabStatus } from '@/services/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const expectedSecret = process.env.FOURCAST_AGENT_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expectedSecret || !receivedSecret || receivedSecret !== expectedSecret) {
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
