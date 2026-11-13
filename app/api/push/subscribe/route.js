import { pushSubscriptionExists, replacePushWatches, upsertPushSubscription } from '@/services/db';
import { cleanSubscription, cleanWatches } from '@/utils/receiptPush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const recent = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 12;
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
  if (body.website) return Response.json({ success: true });

  const watches = cleanWatches(body.watches);
  if (body.syncOnly) {
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
    if (!endpoint.startsWith('https://') || !(await pushSubscriptionExists(endpoint))) {
      return Response.json({ success: false, error: 'Unknown subscription' }, { status: 404 });
    }
    const result = await replacePushWatches(endpoint, watches);
    return Response.json(result, { status: result.success ? 200 : 400 });
  }

  const sub = cleanSubscription(body);
  if (!sub) return Response.json({ success: false, error: 'Subscription required' }, { status: 400 });
  const saved = await upsertPushSubscription(sub);
  if (!saved.success) return Response.json(saved, { status: 400 });
  const listed = await replacePushWatches(sub.endpoint, watches);
  return Response.json(listed, { status: listed.success ? 200 : 400 });
}
