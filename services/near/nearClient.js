/**
 * NEAR client helpers — read provider and signer account on near-api-js v7.
 *
 * The signer is deliberately scoped: production hardening is a function-call
 * key on a sub-account (see docs/NEAR_HACKATHON.md); until then the module
 * only signs when NEAR_ACCOUNT_ID + NEAR_PRIVATE_KEY are both set.
 */

import { Account, JsonRpcProvider } from 'near-api-js';
import { getNearConfig, isNearConfigured } from './nearConfig.js';

let providerCache = null;
let providerCacheKey = null;

export function getProvider() {
  const config = getNearConfig();
  if (!providerCache || providerCacheKey !== config.rpcUrl) {
    providerCache = new JsonRpcProvider({ url: config.rpcUrl });
    providerCacheKey = config.rpcUrl;
  }
  return providerCache;
}

/**
 * Returns an Account bound to the agent treasury key.
 * Throws when NEAR_ACCOUNT_ID/NEAR_PRIVATE_KEY are unset — read paths should
 * use getProvider() directly so unconfigured builds still work.
 */
export function getSignerAccount() {
  const config = getNearConfig();
  if (!isNearConfigured()) {
    throw new Error(
      'NEAR signer not configured: set NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY ' +
        `(ed25519:…) for the agent treasury account on ${config.network}`
    );
  }
  return new Account(config.accountId, getProvider(), config.privateKey);
}

/** Fetch account state — handy as a connectivity/config smoke check. */
export async function getAccountState(accountId) {
  const config = getNearConfig();
  return getProvider().viewAccount({ accountId: accountId || config.accountId });
}
