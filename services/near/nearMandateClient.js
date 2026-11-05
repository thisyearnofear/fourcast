/**
 * Client for the deployed agent-mandate contract (Phase 1+2 of the NEAR
 * enrichment). The contract is the trust boundary: workers check gates
 * locally for UX, but only `request_signature` produces a signature —
 * and only for in-policy trades. No venue private key exists anywhere;
 * the agent's external-chain account is derived via Chain Signatures.
 *
 * Deployed (testnet): inexpensive-mother.testnet
 * Derived EVM (path "arena/v1"): 0x6940B97505567816A75B1A952f234630af81c61F
 */

import { base58 } from '@scure/base';
import { publicKeyToAddress } from 'viem/accounts';
import { getProvider, getSignerAccount } from './nearClient.js';
import { getNearConfig, isNearConfigured } from './nearConfig.js';

const DEFAULT_MPC = {
  testnet: 'v1.signer-prod.testnet',
  mainnet: 'v1.signer',
};

export function getMandateContractId() {
  return (
    process.env.NEAR_MANDATE_CONTRACT ||
    'inexpensive-mother.testnet'
  );
}

export function getDerivationPath() {
  return process.env.NEAR_DERIVATION_PATH || 'arena/v1';
}

/** Read the on-chain mandate (venues, caps, cooldown, code-hash gate). */
export async function getMandate() {
  const provider = getProvider();
  return provider.callFunction({
    contractId: getMandateContractId(),
    method: 'get_mandate',
    args: {},
  });
}

/** secp256k1 pubkey ("secp256k1:…") for the agent's derived external account. */
export async function derivedPublicKey({ path, predecessor } = {}) {
  const mandate = await getMandate();
  const provider = getProvider();
  return provider.callFunction({
    contractId: mandate.mpc_contract || DEFAULT_MPC[getNearConfig().network],
    method: 'derived_public_key',
    args: {
      path: path || getDerivationPath(),
      predecessor: predecessor || getMandateContractId(),
    },
  });
}

/** EVM address of the agent's chain-signature account. No key exists. */
export async function derivedEvmAddress(opts = {}) {
  const raw = await derivedPublicKey(opts);
  const hex = Buffer.from(base58.decode(raw.replace('secp256k1:', ''))).toString('hex');
  // MPC returns the uncompressed point (64B x‖y) — viem wants 0x04-prefixed.
  return publicKeyToAddress(`0x04${hex}`);
}

/**
 * Ask the contract to sign `tradeRequest.payload` via the MPC signer after
 * it validates venue/cap/liquidity/slippage/cooldown/code-hash. Rejects on
 * the NEAR side → no signature exists. Returns the MPC SignResponse
 * ({ big_r, s, recovery_id }) as returned by the cross-contract call.
 *
 * Caller identity: the NEAR_ACCOUNT_ID env account must be the contract
 * owner (assert_owner) — the owner key is still a NEAR key on the worker,
 * but it can ONLY request in-policy signatures; venue keys don't exist.
 */
export async function requestTradeSignature(tradeRequest) {
  if (!isNearConfigured()) {
    throw new Error('NEAR signer not configured (NEAR_ACCOUNT_ID/NEAR_PRIVATE_KEY)');
  }
  const account = getSignerAccount();
  const outcome = await account.callFunction({
    contractId: getMandateContractId(),
    methodName: 'request_signature',
    args: { request: tradeRequest },
    gas: BigInt(300_000_000_000_000), // 300 Tgas — covers contract + MPC sign
    deposit: BigInt('50000000000000000000000'), // 0.05 NEAR → forwarded to MPC
  });

  // The cross-contract sign() result lands in the final receipt's
  // SuccessValue (base64 JSON of { big_r, s, recovery_id }).
  const sv = outcome?.status?.SuccessValue || outcome?.SuccessValue;
  if (!sv) throw new Error('request_signature: empty MPC result (gate rejected?)');
  return JSON.parse(Buffer.from(sv, 'base64').toString('utf8'));
}
