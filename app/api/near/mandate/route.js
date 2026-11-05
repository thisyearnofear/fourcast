/**
 * GET /api/near/mandate — read-only view of the deployed agent-mandate
 * contract: policy limits + the chain-signature-derived agent account.
 * No secrets involved (RPC views are public).
 */
import { getMandate, derivedEvmAddress, getMandateContractId, getDerivationPath } from '@/services/near/nearMandateClient';
import { explorerTxUrl, getNearConfig } from '@/services/near/nearConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [mandate, evmAddress] = await Promise.all([getMandate(), derivedEvmAddress()]);
    const config = getNearConfig();
    return Response.json({
      success: true,
      contract: getMandateContractId(),
      mpc: mandate.mpc_contract,
      path: getDerivationPath(),
      evmAddress,
      owner: mandate.owner,
      allowedVenues: mandate.allowed_venues,
      maxNotional: mandate.max_notional,
      minLiquidity: mandate.min_liquidity,
      maxSlippageBps: mandate.max_slippage_bps,
      cooldownSecs: mandate.cooldown_secs,
      approvedCodeHash: mandate.approved_code_hash,
      contractUrl: `${config.explorerAccount}${getMandateContractId()}`,
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 502 });
  }
}
