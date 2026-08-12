/**
 * POST /api/arena/ingest — receives one arena cycle record from the Delphi
 * competition worker (VPS). Auth: `Authorization: Bearer ADMIN_SECRET`
 * (open when ADMIN_SECRET is unset, matching the existing schedule-route
 * convention). Payloads are size-capped in the store.
 */

import { saveArenaRun } from '@/lib/arenaStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

function isAuthorized(request) {
  if (!ADMIN_SECRET) return true;
  return request.headers.get('authorization') === `Bearer ${ADMIN_SECRET}`;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return Response.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ success: false, error: 'invalid json body' }, { status: 400 });
  }

  if (!payload?.runId || !payload?.summary || !payload?.timestamp) {
    return Response.json({ success: false, error: 'missing runId, summary, or timestamp' }, { status: 400 });
  }

  try {
    const run = await saveArenaRun({ ...payload, receivedAt: new Date().toISOString() });
    return Response.json({ success: true, runId: run.runId });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
