#!/usr/bin/env node
/**
 * Mandate-gate refusal demo — submits deliberately out-of-policy
 * request_signature calls so each gate's on-chain refusal is captured on
 * nearblocks. The falsifiable "contract-gated" moment for the demo video.
 *
 * Usage (needs the owner NEAR key — assert_owner-gated):
 *   node scripts/near-mandate-gates.mjs --view            # print mandate + last_trade_ns
 *   node scripts/near-mandate-gates.mjs --venue           # gate 1: unlisted venue
 *   node scripts/near-mandate-gates.mjs --cap             # gate 2: notional over cap
 *   node scripts/near-mandate-gates.mjs --liquidity       # gate 3: under floor
 *   node scripts/near-mandate-gates.mjs --slippage        # gate 4: over max bps
 *   node scripts/near-mandate-gates.mjs --cooldown        # gate 5: back-to-back requests
 *
 * Each failed call prints the tx hash and, when one is present, writes
 * public/proof/near-refusal.json. The mandate card links that file.
 * Expect ~0.05 NEAR deposit refunded on refusal (gate rejects before the MPC call).
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getMandate, requestTradeSignature, getMandateContractId } from '../services/near/nearMandateClient.js';
import { explorerTxUrl } from '../services/near/nearConfig.js';

function txHashFrom(err) {
  return err?.transaction?.hash
    || err?.transaction_outcome?.id
    || err?.transactionHash
    || err?.cause?.transaction?.hash
    || null;
}

function recordRefusal({ gate, message, txHash }) {
  if (!txHash) return null;
  const body = {
    gate,
    message: String(message || '').slice(0, 300),
    txHash,
    txUrl: explorerTxUrl(txHash),
    contract: getMandateContractId(),
    recordedAt: new Date().toISOString(),
  };
  const dir = path.join(process.cwd(), 'public', 'proof');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'near-refusal.json');
  fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
  return file;
}

const mandate = await getMandate();
const flag = process.argv.find((a) => a.startsWith('--'));

if (!flag || flag === '--view') {
  console.log(JSON.stringify({ contract: getMandateContractId(), ...mandate }, null, 2));
  process.exit(0);
}

const base = {
  venue: 'polymarket', market_id: 'gate-demo', outcome: 'YES',
  notional: '1', liquidity: String(mandate.min_liquidity),
  slippage_bps: 0, payload: Array.from(Buffer.alloc(32, 1)), code_hash: null,
};

const cases = {
  '--venue': { ...base, venue: 'rogue-exchange' },
  '--cap': { ...base, notional: String(BigInt(mandate.max_notional) + 1n) },
  '--liquidity': { ...base, liquidity: String(BigInt(mandate.min_liquidity) - 1n) },
  '--slippage': { ...base, slippage_bps: mandate.max_slippage_bps + 1 },
};

if (flag === '--cooldown') {
  console.log('two in-policy requests back-to-back — the second must fail on cooldown…');
  for (const i of [1, 2]) {
    try {
      await requestTradeSignature(base);
      console.log(`  call ${i}: SIGNED`);
    } catch (err) {
      console.log(`  call ${i}: refused — ${err.message}`);
    }
  }
  process.exit(0);
}

const req = cases[flag];
if (!req) {
  console.error(`unknown flag ${flag}`);
  process.exit(1);
}

console.log(`submitting ${flag} violation — expecting on-chain refusal…`);
try {
  await requestTradeSignature(req);
  console.log('UNEXPECTED: signed — gate did not fire. Check the envelope.');
} catch (err) {
  const txHash = txHashFrom(err);
  console.log(`refused on-chain: ${err.message}`);
  if (txHash) {
    console.log(`receipt: ${explorerTxUrl(txHash)}`);
    const file = recordRefusal({ gate: flag.slice(2), message: err.message, txHash });
    if (file) console.log(`wrote ${file}`);
  } else {
    console.log('no transaction hash on the error — nothing recorded');
  }
}
