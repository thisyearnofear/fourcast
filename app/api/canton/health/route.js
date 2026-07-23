/**
 * GET /api/canton/health
 *
 * Pre-flight health check for the Canton Devnet integration.
 * Verifies: env vars present, OIDC auth works, ledger queries succeed, DAR package loaded.
 * Used by the /canton page to show honest outage messaging if Devnet is unreachable.
 */
export const runtime = 'nodejs';

import { isCantonConfigured, PACKAGE_ID, OPERATOR_PARTY_ID } from '@/services/cantonLedgerClient';

export async function GET() {
  const configured = isCantonConfigured();
  const hasPackageId = Boolean(PACKAGE_ID);
  const hasOperator = Boolean(OPERATOR_PARTY_ID);

  let oidcOk = false;
  let ledgerOk = false;
  let error = null;

  if (configured) {
    try {
      const { getOpenMarkets } = await import('@/services/cantonLedgerClient');
      const markets = await getOpenMarkets();
      ledgerOk = true;
      oidcOk = true;
    } catch (err) {
      error = err.message;
      if (error.includes('token')) oidcOk = false;
      if (error.includes('Ledger API')) ledgerOk = false;
    }
  }

  const allHealthy = configured && hasPackageId && hasOperator && oidcOk && ledgerOk;

  return Response.json({
    status: allHealthy ? 'healthy' : (configured ? 'unhealthy' : 'error'),
    checks: {
      configured,
      packageId: hasPackageId,
      operator: hasOperator,
      oidc: oidcOk,
      ledger: ledgerOk,
    },
    error,
    timestamp: new Date().toISOString(),
  });
}
