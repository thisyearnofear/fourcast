/**
 * The Sui read used to verify a payment.
 *
 * Dev B owns the shared client (`services/tatum/tatumSuiClient.js`) with the
 * frozen signature `tatumSuiRpc(method, params, opts?)`. WP5 needs exactly one
 * method — `sui_getTransactionBlock` — and it must go through Tatum, because
 * "Tatum Sui RPC integration" is a graded deliverable.
 *
 * This module is a thin adapter, not a second client: it adds the payment
 * specifics (which transaction fields we need, and the network alignment check
 * that stops us from verifying a testnet payment against a mainnet read).
 *
 * Dependency: this file imports Dev B's client directly, so WP5 must be merged
 * after WP4. The signature is frozen in docs/EXECUTION_PLAN.md; if it changes,
 * this adapter is the only thing that has to follow.
 */

import { disabledReason, isConfigured, suiNetwork, tatumSuiRpc } from '../../tatum/tatumSuiClient.js';
import { settlementNetwork } from './types.js';

/** The transaction fields a payment check needs. */
const TX_BLOCK_OPTIONS = Object.freeze({
  showInput: true,
  showEffects: true,
  showBalanceChanges: true,
  showObjectChanges: true,
  showEvents: false,
});

/**
 * Which network the read path is pointed at.
 *
 * B's client reads `SUI_NETWORK` (default 'mainnet'); our settlement network
 * comes from `SETTLEMENT_NETWORK` (default 'testnet'). If the two disagree we
 * would verify a payment against the wrong chain, so we refuse instead.
 *
 * @returns {{ok: boolean, settlement: string, rpcNetwork: string, reason: string|null}}
 */
export function networkAlignment(env = process.env) {
  const settlement = settlementNetwork(env);
  const rpcNetwork = String(env.SUI_NETWORK || 'mainnet').trim().toLowerCase() || 'mainnet';
  if (rpcNetwork !== settlement.name) {
    return {
      ok: false,
      settlement: settlement.network,
      rpcNetwork,
      reason:
        `Refusing to verify a ${settlement.network} payment against a ${rpcNetwork} read: ` +
        `SUI_NETWORK=${rpcNetwork} but SETTLEMENT_NETWORK=${settlement.name}.`,
    };
  }
  return { ok: true, settlement: settlement.network, rpcNetwork, reason: null };
}

/** Are we able to ask the chain anything at all? */
export function readStatus(env = process.env) {
  const configured = isConfigured();
  const alignment = networkAlignment(env);
  return {
    configured,
    reason: configured ? alignment.reason : disabledReason(),
    network: suiNetwork(),
    alignment,
  };
}

/**
 * Read a transaction block.
 *
 * Resolves `null` when the read path is not configured (no TATUM_API_KEY) —
 * the same fail-closed contract as the shared client. The caller must treat
 * `null` as "could not verify", never as "verified".
 *
 * @param {string} digest  base58 transaction digest
 * @returns {Promise<object|null>}
 */
export async function getTransactionBlock(digest, opts = {}) {
  const alignment = networkAlignment(opts.env || process.env);
  if (!alignment.ok) {
    const err = new Error(alignment.reason);
    err.code = 'TATUM_NETWORK_MISMATCH';
    throw err;
  }
  return tatumSuiRpc('sui_getTransactionBlock', [digest, { ...TX_BLOCK_OPTIONS }], {
    timeoutMs: opts.timeoutMs,
    retries: opts.retries ?? 1,
  });
}

/**
 * Which client served the read. Always the shared Tatum client — the whole
 * point of the graded integration.
 */
export function rpcSource() {
  return 'tatum-shared-client';
}
