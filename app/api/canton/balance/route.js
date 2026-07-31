/**
 * GET /api/canton/balance
 *
 * Ledger status, operator info, and — when the reference CIP-56 registry is
 * configured (CANTON_REFERENCE_RULES_CID) — the operator's escrow balances:
 * unlocked holdings vs allocations currently locked as position stake/payout.
 *
 * Query params: ?partyId=X — report balances for a different party (default operator)
 */
export const runtime = 'nodejs';

import {
  isCantonConfigured,
  isReferenceRegistryConfigured,
  getBalances,
  OPERATOR_PARTY_ID,
  PACKAGE_ID,
} from '@/services/cantonLedgerClient';

export async function GET(request) {
  const configured = isCantonConfigured();
  const network = process.env.NEXT_PUBLIC_CANTON_NETWORK || 'devnet';

  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get('partyId') || OPERATOR_PARTY_ID;

  let balances = null;
  if (configured && isReferenceRegistryConfigured()) {
    try {
      balances = await getBalances(partyId);
      balances = {
        partyId: balances.partyId,
        unlocked: balances.unlocked,
        lockedInEscrow: balances.locked,
        holdingsCount: balances.holdings.length,
        allocationsCount: balances.allocations.length,
      };
    } catch (e) {
      balances = { error: e.message };
    }
  }

  return Response.json({
    success: true,
    canton: {
      configured,
      operatorPartyId: OPERATOR_PARTY_ID,
      darPackageId: PACKAGE_ID,
      network,
      settlement: 'atomic (canton-2.0.0: stakes escrowed as CIP-56 allocations, settled in-transaction)',
      referenceRegistryConfigured: isReferenceRegistryConfigured(),
      balances,
      assets: [
        { symbol: 'cBTC', name: 'Canton Bitcoin', standard: 'CIP-0056' },
        { symbol: 'cETH', name: 'Canton Ethereum', standard: 'CIP-0056' },
        { symbol: 'CC', name: 'Canton Coin', standard: 'native' },
      ],
      funding: {
        CC: 'NODERS wallet UI',
        'cBTC (real)': 'https://cbtc-faucet.bitsafe.finance/',
        'reference cBTC (demo)': 'scripts/canton-v2-preflight.mjs',
      },
    },
    timestamp: new Date().toISOString(),
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
