/**
 * ChainSignatureSigner — an ethers-compatible signer with NO private key.
 * ECDSA signatures are produced by the deployed agent-mandate contract:
 * it validates the trade envelope (venue, notional, liquidity, slippage,
 * cooldown, code-hash) and only then asks the MPC network to sign the
 * digest. Out-of-policy → the contract refuses → no signature exists.
 *
 * Usage mirrors a Wallet: pass this object anywhere a signer is accepted
 * (ClobClient, ethers Contract, viem-compatible shims).
 */

import { requestTradeSignature, derivedEvmAddress } from './nearMandateClient.js';

/**
 * @param {object} p
 * @param {string} p.venue        gate: must be in the contract's allowed_venues
 * @param {string|bigint} p.notional   gate: ≤ contract max_notional (yocto units)
 * @param {string|bigint} p.liquidity  gate: ≥ contract min_liquidity
 * @param {number} p.slippageBps       gate: ≤ contract max_slippage_bps
 * @param {string} [p.marketId]        informational (contract logs)
 * @param {string} [p.outcome]         informational
 */
export async function createChainSignatureSigner({ venue, notional, liquidity, slippageBps, marketId, outcome }) {
  const address = await derivedEvmAddress();

  /**
   * Sign a 32-byte digest through the mandate contract → MPC.
   * Returns the assembled 65-byte secp256k1 signature (r ‖ s ‖ v).
   */
  async function signDigest(digestBytes) {
    const res = await requestTradeSignature({
      venue,
      market_id: marketId || '',
      outcome: outcome || '',
      notional: String(notional ?? '0'),
      liquidity: String(liquidity ?? '0'),
      slippage_bps: slippageBps ?? 0,
      payload: Array.from(digestBytes), // bytes for borsh Vec<u8>
      code_hash: process.env.NEAR_WORKER_CODE_HASH || null,
    });
    // MPC response: { big_r: "…" (33B compressed point / affine hex), s: "…" (32B scalar), recovery_id }
    const bigR = typeof res.big_r === 'string' ? res.big_r : res.big_r?.affine_point;
    const sScalar = typeof res.s === 'string' ? res.s : res.s?.scalar;
    if (!bigR || !sScalar) throw new Error('request_signature: malformed MPC response');
    const rHex = bigR.replace(/^0x/, '').replace(/^02|^03/, '').padStart(64, '0');
    const sHex = sScalar.replace(/^0x/, '').padStart(64, '0');
    const v = 27 + (res.recovery_id ?? 0);
    return `0x${rHex}${sHex}${v.toString(16).padStart(2, '0')}`;
  }

  const bytesFrom = (hex) => Uint8Array.from(Buffer.from(hex.replace(/^0x/, ''), 'hex'));

  return {
    // ethers Signer surface — the subset order-signing paths use
    address,
    getAddress: async () => address,
    signMessage: async (message) => {
      const { hashMessage } = await import('ethers');
      return signDigest(bytesFrom(hashMessage(message)));
    },
    signTypedData: async (domain, types, value) => {
      const { TypedDataEncoder } = await import('ethers');
      return signDigest(bytesFrom(TypedDataEncoder.hash(domain, types, value)));
    },
    signTransaction: async (tx) => {
      const { Transaction, keccak256, serializeTransaction } = await import('ethers');
      const unsigned = Transaction.from(tx);
      unsigned.signature = null;
      const digest = keccak256(serializeTransaction(unsigned));
      const sig = await signDigest(bytesFrom(digest));
      unsigned.signature = sig;
      return unsigned.serialized;
    },
    // viem-style alias some newer clients use
    sign: signDigest,
    isChainSignature: true,
    provider: null,
  };
}
