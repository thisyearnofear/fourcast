import txlineService from '@/services/txline/txlineService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    success: true,
    status: txlineService.getTxlineStatus(),
    timestamp: new Date().toISOString(),
  });
}
