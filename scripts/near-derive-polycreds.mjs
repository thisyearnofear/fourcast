#!/usr/bin/env node
/**
 * One-time bootstrap: derive Polymarket L2 API credentials for the agent's
 * chain-signature account and print them as env lines.
 *
 * Why this exists: every request_signature bumps the mandate contract's
 * last_trade_ns. If the worker derived L1 creds inside executeServerOrder,
 * the order signature would land inside the cooldown window and be refused.
 * Run this ONCE, cache the printed POLY_L2_* envs, and each order then costs
 * exactly one gate-checked MPC signature.
 *
 * Envelope honesty: the ClobAuth signature is an identity ceremony, not a
 * trade. The envelope declares venue scope, notional 0, slippage 0, and the
 * mandate's own liquidity floor so the deployed gates accept it.
 *
 * Usage:
 *   NEAR_ACCOUNT_ID=inexpensive-mother.testnet \
 *   NEAR_PRIVATE_KEY=ed25519:... \
 *   node scripts/near-derive-polycreds.mjs
 *
 * Requires the owner key — the contract's assert_owner only accepts it.
 */
import 'dotenv/config';
import { createChainSignatureSigner } from '../services/near/chainSigSigner.js';
import { getMandate, getMandateContractId } from '../services/near/nearMandateClient.js';

const CLOB_HOST = process.env.POLY_CLOB_HOST || 'https://clob.polymarket.com';
const CHAIN_ID = 137; // Polygon mainnet

const mandate = await getMandate();

const signer = await createChainSignatureSigner({
  venue: 'polymarket',
  marketId: 'l1-auth',
  outcome: 'credential-bootstrap',
  notional: '0',
  liquidity: String(mandate.min_liquidity), // auth ceremony declares the floor, not a market
  slippageBps: 0,
});

console.error(
  `[bootstrap] signing ClobAuth for ${signer.address} via ${getMandateContractId()} — one MPC signature, expect ~30s…`
);

const { ClobClient } = await import('@polymarket/clob-client');
const client = new ClobClient(CLOB_HOST, CHAIN_ID, signer);
const creds = await client.createOrDeriveApiKey();

// stdout carries only the env lines so the output can be piped into an env file.
console.log(`POLY_L2_API_KEY=${creds.key}`);
console.log(`POLY_L2_SECRET=${creds.secret}`);
console.log(`POLY_L2_PASSPHRASE=${creds.passphrase}`);
console.error('[bootstrap] done — paste the lines above into the worker env. Do NOT rerun per order.');
