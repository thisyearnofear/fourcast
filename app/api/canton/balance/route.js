/**
 * GET /api/canton/balance
 *
 * Returns Canton ledger status and operator info.
 * The operator's balance (CC, cBTC) is managed via the NODERS wallet UI
 * at wallet.validator.hackcanton-01.devnet.naas.noders.services.
 *
 * This endpoint reports ledger connectivity and operator party info.
 */
export const runtime = 'nodejs';

import { isCantonConfigured, OPERATOR_PARTY_ID, PACKAGE_ID } from '@/services/cantonLedgerClient';

export async function GET() {
  const configured = isCantonConfigured();
  const network = process.env.NEXT_PUBLIC_CANTON_NETWORK || 'devnet';

  return Response.json({
    success: true,
    canton: {
      configured,
      operatorPartyId: OPERATOR_PARTY_ID,
      darPackageId: PACKAGE_ID,
      network,
      assets: [
        { symbol: 'cBTC', name: 'Canton Bitcoin', standard: 'CIP-0056' },
        { symbol: 'cETH', name: 'Canton Ethereum', standard: 'CIP-0056' },
        { symbol: 'CC', name: 'Canton Coin', standard: 'native' },
      ],
      // Operator funds the wallet via NODERS wallet UI:
      // CC: tap in wallet.validator.hackcanton-01.devnet.naas.noders.services
      // cBTC: https://cbtc-faucet.bitsafe.finance/
      funding: 'manual',
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
