/**
 * GET /api/canton/positions
 *
 * Returns position-related contracts from the Canton ledger.
 * All queries are server-side via the direct JSON Ledger API.
 *
 * Query params:
 *   ?type=open        — open PredictionPosition contracts (default)
 *   ?type=offers      — pending PositionOffer contracts (holder consent, not yet accepted)
 *   ?type=settled     — PositionSettled contracts
 *   ?type=expired     — PositionExpired contracts (refunded after deadline)
 *   ?type=allocations — escrowed CIP-56 allocations (locked tokens)
 *   ?type=resolutions — MarketResolution contracts
 *   ?type=obligations — REMOVED in v2: atomic settlement leaves nothing outstanding
 *   ?partyId=X        — optional party ID to query as (defaults to operator)
 *
 * POST /api/canton/positions
 *   v2 consent + escrow flow. Body: { action, ... }
 *   action=create-offer  { holder, marketCid, side, stake, oddsMultiplier? }
 *   action=accept        { offerContractId }
 *   action=reject        { offerContractId }
 *   action=allocate      { positionContractId, leg: 'stake'|'payout'|'both', senderPartyId }
 */
export const runtime = 'nodejs';

import {
  getOpenPositions,
  getPositionOffers,
  getSettledPositions,
  getExpiredPositions,
  getMarketResolutions,
  getAllocations,
  createPositionOffer,
  acceptOffer,
  rejectOffer,
  allocateLeg,
  isCantonConfigured,
  OPERATOR_PARTY_ID,
} from '@/services/cantonLedgerClient';

export async function GET(request) {
  try {
    if (!isCantonConfigured()) {
      return Response.json({
        success: false,
        error: 'Canton ledger not configured',
        positions: [],
      }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'open';
    const partyId = searchParams.get('partyId') || OPERATOR_PARTY_ID;

    switch (type) {
      case 'obligations':
        return Response.json({
          success: true,
          positions: [],
          note: 'SettlementObligation was removed in canton-2.0.0 — v2 settles atomically inside the Settle transaction. See ?type=allocations for escrowed funds.',
        });

      case 'settled':
      case 'offers':
      case 'expired':
      case 'allocations':
      case 'resolutions':
      case 'open': {
        const results = await (
          type === 'settled' ? getSettledPositions(partyId)
          : type === 'offers' ? getPositionOffers(partyId)
          : type === 'expired' ? getExpiredPositions(partyId)
          : type === 'allocations' ? getAllocations(partyId)
          : type === 'resolutions' ? getMarketResolutions(partyId)
          : getOpenPositions(partyId)
        );
        return Response.json({
          success: true,
          positions: results,
          type,
          partyId,
          count: results.length,
        });
      }

      default:
        return Response.json({
          success: false,
          error: `unknown type "${type}" — use open|offers|settled|expired|allocations|resolutions`,
          positions: [],
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Canton positions GET error:', error);
    return Response.json({
      success: false,
      error: error.message,
      positions: [],
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!isCantonConfigured()) {
      return Response.json({
        success: false,
        error: 'Canton ledger not configured',
      }, { status: 503 });
    }

    const body = await request.json();
    const action = body.action || 'create-offer';

    switch (action) {
      case 'create-offer': {
        const { holder, marketCid, side, stake } = body;
        if (!holder || !marketCid || !side || !stake) {
          return Response.json({
            success: false,
            error: 'create-offer requires holder, marketCid, side, stake',
          }, { status: 400 });
        }
        const result = await createPositionOffer({
          holder,
          marketCid,
          side,
          stake,
          oddsMultiplier: body.oddsMultiplier,
        });
        return Response.json({ success: true, action, ...result });
      }

      case 'accept': {
        if (!body.offerContractId) {
          return Response.json({ success: false, error: 'accept requires offerContractId' }, { status: 400 });
        }
        const result = await acceptOffer(body.offerContractId);
        return Response.json({ success: true, action, ...result });
      }

      case 'reject': {
        if (!body.offerContractId) {
          return Response.json({ success: false, error: 'reject requires offerContractId' }, { status: 400 });
        }
        const result = await rejectOffer(body.offerContractId);
        return Response.json({ success: true, action, ...result });
      }

      case 'allocate': {
        const { positionContractId, senderPartyId } = body;
        const leg = body.leg || 'both';
        if (!positionContractId || !senderPartyId) {
          return Response.json({ success: false, error: 'allocate requires positionContractId and senderPartyId' }, { status: 400 });
        }
        // fetch position payload to build the exact expected spec
        const positions = await getOpenPositions(OPERATOR_PARTY_ID);
        const pos = positions.find((p) => p.contractId === positionContractId)?.payload;
        if (!pos) return Response.json({ success: false, error: 'position not found' }, { status: 404 });

        const results = {};
        if (leg === 'stake' || leg === 'both') {
          results.stake = await allocateLeg(pos, 'stake', senderPartyId);
        }
        if (leg === 'payout' || leg === 'both') {
          results.payout = await allocateLeg(pos, 'payout', senderPartyId);
        }
        return Response.json({ success: true, action, positionContractId, ...results });
      }

      default:
        return Response.json({
          success: false,
          error: `unknown action "${action}" — use create-offer|accept|reject|allocate`,
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Canton positions POST error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
