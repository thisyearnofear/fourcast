import { getUserPositions, closePosition } from '@/services/db';

export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  // Canonicalize to lowercase — mirrors services/db.js on insert.
  const address = searchParams.get('address')?.toLowerCase();
  const range = searchParams.get('range') || 'all';
  const status = searchParams.get('status') || 'all';

  if (!address) {
    return Response.json({ success: false, error: 'Address required' }, { status: 400 });
  }

  // Get positions from DB with optional status filter
  const result = await getUserPositions(address, status);
  
  let positions = result.positions;

  // Apply range filter if not 'all'
  if (range !== 'all') {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 3650;
    const cutoff = Math.floor(Date.now() / 1000) - (days * 86400);
    positions = positions.filter(p => p.created_at >= cutoff);
  }

  // Compute summary stats
  const openPositions = positions.filter(p => p.status === 'OPEN');
  const closedPositions = positions.filter(p => p.status === 'CLOSED');
  const totalPnL = closedPositions.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
  const totalInvested = positions.reduce((sum, p) => sum + (p.entry_price * p.size || 0), 0);

  return Response.json({
    success: result.success,
    positions,
    summary: {
      total: positions.length,
      open: openPositions.length,
      closed: closedPositions.length,
      totalPnL: Math.round(totalPnL * 100) / 100,
      totalInvested: Math.round(totalInvested * 100) / 100,
    },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, positionId, exitPrice, realizedPnl } = body;

    if (!action || !positionId) {
      return Response.json(
        { success: false, error: 'action and positionId required' },
        { status: 400 }
      );
    }

    if (action === 'close') {
      if (exitPrice == null || realizedPnl == null) {
        return Response.json(
          { success: false, error: 'exitPrice and realizedPnl required for close action' },
          { status: 400 }
        );
      }

      const result = await closePosition(positionId, exitPrice, realizedPnl);
      return Response.json(result);
    }

    return Response.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Positions API error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
