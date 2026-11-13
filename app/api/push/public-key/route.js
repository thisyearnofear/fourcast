import { vapidConfigured } from '@/services/sendPush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!vapidConfigured()) {
    return Response.json({ success: false, error: 'Push is not configured on this host' }, { status: 503 });
  }
  return Response.json({ success: true, publicKey: process.env.VAPID_PUBLIC_KEY });
}
