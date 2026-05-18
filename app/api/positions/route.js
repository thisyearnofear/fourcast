import { getUserPositions } from '@/services/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const range = searchParams.get('range') || '30d';

  if (!address) {
    return Response.json({ success: false, error: 'Address required' }, { status: 400 });
  }

  // Calculate days for SQL cutoff
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 3650;
  const cutoff = Math.floor(Date.now() / 1000) - (days * 86400);

  // Get positions from DB with range filter
  // Reuse existing getUserPositions or add range filter to query
  const result = await getUserPositions(address);
  
  // Filter by date manually as DB helper doesn't support range currently
  const filtered = result.positions.filter(p => p.created_at >= cutoff);

  return Response.json({ ...result, positions: filtered });
}
