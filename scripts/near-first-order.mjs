#!/usr/bin/env node
/**
 * First live order through the mandate contract — the money shot
 * (docs/NEAR_HACKATHON_ODDS.md, Step 1). One command, deterministic,
 * prints every link a judge needs.
 *
 *   node scripts/near-first-order.mjs --dry   # pick market, build envelope,
 *                                             # local gate pre-check. No keys.
 *   node scripts/near-first-order.mjs         # the real order. Needs:
 *     NEAR_ACCOUNT_ID + NEAR_PRIVATE_KEY (contract owner) in env,
 *     POLY_L2_* creds (scripts/near-derive-polycreds.mjs), funded EOA
 *     with CLOB approvals (scripts/polygon-agent-setup.mjs --approve).
 *
 * Overrides: --token <clobTokenId> --price <0-1> --shares <n> — skips the
 * auto-pick; --liquidity <usd> declares the market liquidity manually.
 *
 * The EIP-712 order signature is the ONLY signature this flow needs when
 * POLY_L2_* are cached — it goes through request_signature, so the gates
 * run on-chain for this exact trade, and the NEAR tx is the proof.
 */
import 'dotenv/config';
import { getMandate, derivedEvmAddress, getMandateContractId } from '../services/near/nearMandateClient.js';
import { explorerTxUrl } from '../services/near/nearConfig.js';
import { cache } from '../services/polymarketCache.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const DRY = flag('--dry');
const SHARES = parseFloat(opt('--shares') || '5');
let tickSize = opt('--tick') || '0.01';

const parseJsonish = (v, fallback = []) => {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

const mandate = await getMandate();
const evm = await derivedEvmAddress();
const capUsd = Number(mandate.max_notional) / 1e6;
const floorUsd = Number(mandate.min_liquidity) / 1e6;
const maxSlip = Number(mandate.max_slippage_bps);

console.log(`mandate   ${getMandateContractId()}  owner ${mandate.owner}`);
console.log(`derived   ${evm}  (no private key exists)`);
console.log(`policy    cap $${capUsd} · liquidity floor $${floorUsd} · slippage ≤${maxSlip}bps · cooldown ${mandate.cooldown_secs}s`);

// Cooldown — every signature request bumps last_trade_ns, including the
// approve pass, so a fresh request may still be inside the window.
const lastMs = Number(mandate.last_trade_ns) / 1e6;
const cdWait = lastMs + Number(mandate.cooldown_secs) * 1000 - Date.now();
if (cdWait > 0 && !DRY) {
  console.log(`cooldown  active — waiting ${(cdWait / 1000).toFixed(0)}s…`);
  await new Promise((r) => setTimeout(r, cdWait + 2000));
}

// Code-hash gate — if the contract has an approved hash, the env must carry
// the same value or every request is refused.
if (mandate.approved_code_hash) {
  const env = process.env.NEAR_WORKER_CODE_HASH || null;
  if (env !== mandate.approved_code_hash) {
    console.error(`\ncode-hash gate is ON (${mandate.approved_code_hash}) but NEAR_WORKER_CODE_HASH=${env}.`);
    console.error('Set the env on this machine (scripts/near-set-code-hash.mjs computes it) or unset the contract hash first.');
    process.exit(1);
  }
  console.log(`code-hash ${mandate.approved_code_hash} — env matches`);
}

// ── market pick ─────────────────────────────────────────────────────────────

let tokenID = opt('--token');
let price = opt('--price') ? parseFloat(opt('--price')) : null;
let liquidityUsd = opt('--liquidity') ? parseFloat(opt('--liquidity')) : null;
let title = 'manual selection';

async function bookOf(token) {
  const res = await fetch(`${cache.clobBaseURL}/book?token_id=${token}`).catch(() => null);
  if (!res?.ok) return null;
  const b = await res.json();
  const asks = (b.asks || []).map((a) => parseFloat(a.price)).filter(Number.isFinite);
  const bids = (b.bids || []).map((x) => parseFloat(x.price)).filter(Number.isFinite);
  return {
    ask: asks.length ? Math.min(...asks) : null,
    bid: bids.length ? Math.max(...bids) : null,
  };
}

if (!tokenID) {
  console.log('\nauto-pick: highest-24h-volume market inside the mandate…');
  let markets = [];
  try {
    const res = await fetch(
      `${cache.baseURL}/markets?limit=100&active=true&closed=false&order=volume24hr&ascending=false`
    );
    markets = (await res.json()) || [];
  } catch (err) {
    console.error(`gamma-api unreachable (${err.message}) — pass --token/--price/--liquidity manually.`);
    process.exit(1);
  }
  for (const m of markets) {
    if (m.negRisk === true || m.accepting_orders === false) continue;
    const tokens = parseJsonish(m.clobTokenIds);
    const liq = parseFloat(m.liquidity || m.liquidityNum || 0);
    if (tokens.length < 1 || liq < floorUsd * 1.2) continue;
    if (m.endDate && new Date(m.endDate) < new Date(Date.now() + 3 * 86400e3)) continue;

    const book = await bookOf(tokens[0]);
    if (!book?.ask || book.ask >= 0.95) continue; // want a real, fillable ask

    tokenID = tokens[0];
    price = book.ask;
    liquidityUsd = liq;
    tickSize = String(m.minimum_tick_size || tickSize);
    title = m.question || m.title || 'untitled';
    console.log(`  picked  "${title}"  ask ${book.ask} bid ${book.bid ?? '—'} liq $${liq.toFixed(0)} tick ${tickSize}`);
    break;
  }
} else {
  const book = await bookOf(tokenID);
  if (price == null && book?.ask) price = book.ask;
  if (liquidityUsd == null && book) liquidityUsd = floorUsd; // declared floor unless overridden
  title = `token ${tokenID.slice(0, 12)}…`;
}

if (!tokenID || price == null) {
  console.error('no suitable market found — pass --token/--price/--liquidity manually.');
  process.exit(1);
}

// ── envelope + local gate pre-check ─────────────────────────────────────────

const notionalUsd = price * SHARES;
const envelope = {
  venue: 'polymarket',
  notional: String(Math.round(notionalUsd * 1e6)),
  liquidity: String(Math.round(liquidityUsd * 1e6)),
  slippageBps: Number(process.env.NEAR_ORDER_SLIPPAGE_BPS || 100),
  marketId: tokenID,
  outcome: 'YES',
};

const checks = [
  ['venue allowed', mandate.allowed_venues.includes(envelope.venue)],
  [`notional $${notionalUsd.toFixed(2)} ≤ cap $${capUsd}`, notionalUsd <= capUsd],
  [`liquidity $${liquidityUsd.toFixed(0)} ≥ floor $${floorUsd}`, liquidityUsd >= floorUsd],
  [`slippage ${envelope.slippageBps}bps ≤ max ${maxSlip}bps`, envelope.slippageBps <= maxSlip],
];

console.log(`\norder     BUY ${SHARES} YES @ ${price}  ($${notionalUsd.toFixed(2)} notional)`);
let allPass = true;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  allPass &&= ok;
}
if (!allPass) {
  console.error('\nenvelope fails the mandate locally — the contract would refuse. Fix and retry.');
  process.exit(1);
}
if (DRY) {
  console.log('\n--dry: envelope is in-policy. Rerun without --dry once creds are in env.');
  process.exit(0);
}

// ── the order — its only signature is the on-chain-gated one ────────────────

console.log('\nrequesting signature through the mandate contract…');
const { createChainSignatureSigner } = await import('../services/near/chainSigSigner.js');
const { executeServerOrder } = await import('../services/polymarketTrading.js');

const signer = await createChainSignatureSigner(envelope);
const result = await executeServerOrder(
  { tokenID, price: String(price), side: 'BUY', size: String(SHARES), tickSize },
  signer
);

if (signer.lastRequestTxHash) {
  console.log(`\nrequest_signature tx: ${explorerTxUrl(signer.lastRequestTxHash)}`);
  console.log('  ↑ the nearblocks record of the contract gates passing on this trade.');
}

if (result.success) {
  console.log(`order accepted — id ${result.orderID}`);
  console.log(`fills: https://polygonscan.com/address/${evm} · position on polymarket.com/profile/${evm}`);
} else {
  console.error(`order failed: ${result.error}`);
  process.exit(1);
}
