/**
 * POST /api/canton/markets/resolve
 *
 * Resolves a prediction market on Canton (operator action).
 *
 * v2 flow: the operator can only resolve with a ResolutionAttestation issued
 * by the market's designated attester (env CANTON_ATTESTER_PARTY_ID; devnet
 * default is the operator itself = self-attested). This endpoint issues the
 * attestation and resolves with it, computing `viewers` from the market's
 * current position holders so they can fetch their own proof.
 *
 * Body: { marketContractId, outcome, evidenceHash?, evidenceUri?, reason?, viewers? }
 *   outcome: 'ResolvedYes' | 'ResolvedNo' | 'Voided'
 */
export const runtime = 'nodejs';

import {
  resolveMarket,
  voidMarket,
  createAttestation,
  getOpenMarkets,
  getOpenPositions,
  isCantonConfigured,
} from '@/services/cantonLedgerClient';

export async function POST(request) {
  try {
    if (!isCantonConfigured()) {
      return Response.json({
        success: false,
        error: 'Canton ledger not configured',
      }, { status: 503 });
    }

    const body = await request.json();
    const { marketContractId, outcome } = body;

    if (!marketContractId) {
      return Response.json({
        success: false,
        error: 'marketContractId is required',
      }, { status: 400 });
    }
    if (!outcome) {
      return Response.json({
        success: false,
        error: 'outcome is required (ResolvedYes, ResolvedNo, or Voided)',
      }, { status: 400 });
    }

    // Look up the market — we need its marketId for the attestation.
    const markets = await getOpenMarkets();
    const market = markets.find((m) => m.contractId === marketContractId);
    if (!market) {
      return Response.json({
        success: false,
        error: `market ${marketContractId} not found (already resolved or not visible)`,
      }, { status: 404 });
    }
    const marketId = market.payload?.marketId;

    // viewers = everyone holding a position on this market (holders must be
    // able to fetch the resolution to settle their own positions)
    const positions = await getOpenPositions();
    const holders = [...new Set(
      positions
        .filter((p) => p.payload?.marketId === marketId)
        .map((p) => p.payload?.holder),
    )].filter(Boolean);
    const viewers = [...new Set([...(Array.isArray(body.viewers) ? body.viewers : []), ...holders])];

    if (outcome === 'Voided') {
      const result = await voidMarket(marketContractId, {
        reason: body.reason || 'voided by operator',
        viewers,
      });
      return Response.json({
        success: true,
        resolution: { marketContractId, marketId, outcome, viewers, ...result },
      });
    }

    // v2: attestation first — the operator can't resolve without it
    const { attestationContractId } = await createAttestation({
      marketId,
      outcome,
      evidenceHash: body.evidenceHash || `sha256:attestation:${marketId}`,
      evidenceUri: body.evidenceUri || `https://fourcast.app/txline/receipts/${marketId}`,
    });

    const result = await resolveMarket(marketContractId, {
      attestationCid: attestationContractId,
      viewers,
    });

    return Response.json({
      success: true,
      resolution: {
        marketContractId,
        marketId,
        outcome,
        attestationContractId,
        viewers,
        ...result,
      },
    });
  } catch (error) {
    console.error('Canton resolve error:', error);
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
