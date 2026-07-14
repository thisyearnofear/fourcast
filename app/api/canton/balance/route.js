/**
 * GET /api/canton/balance
 *
 * Returns Canton balance configuration and operator info.
 * Actual balance fetching is client-side via Console Wallet SDK
 * (the extension communicates with the Canton participant node).
 *
 * This endpoint provides:
 * - Operator party ID (for position creation)
 * - DAR package ID (for template IDs)
 * - Network info (devnet/localnet/mainnet)
 */
export const runtime = 'nodejs';

export async function GET() {
  const operatorPartyId = process.env.CANTON_OPERATOR_PARTY_ID || '';
  const darPackageId = process.env.NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID || '';
  const network = process.env.NEXT_PUBLIC_CANTON_NETWORK || 'localnet';
  const participantUrl = process.env.CANTON_PARTICIPANT_URL || '';
  const jsonApiUrl = process.env.CANTON_JSON_API_URL || '';

  return Response.json({
    success: true,
    canton: {
      operatorPartyId,
      darPackageId,
      network,
      participantUrl: participantUrl || undefined,
      jsonApiUrl: jsonApiUrl || undefined,
      // Assets supported for private settlement
      assets: [
        { symbol: 'cBTC', name: 'Canton Bitcoin', standard: 'CIP-0056' },
        { symbol: 'cETH', name: 'Canton Ethereum', standard: 'CIP-0056' },
      ],
      // Note: actual balances are fetched client-side via Console Wallet
      // extension — the server cannot access the user's private party state.
      balanceFetch: 'client-side',
      balanceMethod: 'consoleWallet.getCoinsBalance({ party, network })',
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
