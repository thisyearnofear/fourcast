import { getReceiptJudgments, recordReceiptJudgment } from '@/services/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const recent = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 20;
}

function clientId(request) {
  return request.headers.get('x-fourcast-client') || '';
}

export async function GET(request) {
  const fixtureId = new URL(request.url).searchParams.get('fixtureId');
  const result = await getReceiptJudgments(fixtureId, clientId(request));
  return Response.json(result, { status: result.success ? 200 : 400 });
}

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return Response.json({ success: false, error: 'Slow down' }, { status: 429 });
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'JSON required' }, { status: 400 });
  }
  if (body.website) {
    return Response.json({ success: true, holds: 0, breaks: 0, mine: null });
  }
  const result = await recordReceiptJudgment({
    fixtureId: body.fixtureId,
    clientId: clientId(request),
    holds: body.holds,
  });
  return Response.json(result, { status: result.success ? 200 : 400 });
}
