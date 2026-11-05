#!/usr/bin/env node
/**
 * NEAR Intents 1-Click quote — the "move value across chains" leg.
 *
 * Usage:
 *   node scripts/near-intent-quote.mjs                       # default wrap.near → USDC dry quote
 *   node scripts/near-intent-quote.mjs --tokens              # list supported assets
 *   node scripts/near-intent-quote.mjs --amount 1000000000000000000000000
 *   node scripts/near-intent-quote.mjs --status <depositAddress>
 *
 * do X, see Y:
 *   1. Run with no args → prints solver quote (deposit address, in/out amounts).
 *   2. (Later, live leg) agent deposits to quote.depositAddress; poll --status.
 *
 * Environment: NEAR_ONECLICK_JWT (required by the API), NEAR_ACCOUNT_ID
 * (default recipient/refund), NEAR_ONECLICK_BASE_URL.
 */

import dotenv from 'dotenv';
import { listTokens, getQuote, getExecutionStatus } from '../services/near/nearIntents.js';
import { getNearConfig } from '../services/near/nearConfig.js';

dotenv.config({ path: process.env.FOURCAST_AGENT_ENV_FILE || '.env.agent' });
dotenv.config();
dotenv.config({ path: '.env.local' });

const args = process.argv.slice(2);
const val = (name) => {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
};
const has = (name) => args.includes(`--${name}`);
const line = (s = '') => console.log(s);

const config = getNearConfig();
// Intents has no testnet — recipients are mainnet NEAR accounts.
const account = config.accountId || 'fourcast-agent.near';
const ONE_NEAR_YOCTO = '1000000000000000000000000';
// wrap.near → USDC on NEAR, the smallest meaningful cross-asset leg
const ORIGIN = val('origin') || 'nep141:wrap.near';
const DESTINATION =
  val('dest') || 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';

async function main() {
  if (has('tokens')) {
    const tokens = await listTokens();
    for (const t of tokens || []) {
      line(`${t.assetId}  ${t.blockchain}  ${t.symbol}  decimals=${t.decimals}`);
    }
    return;
  }

  const statusAddr = val('status');
  if (statusAddr) {
    const s = await getExecutionStatus({ depositAddress: statusAddr });
    line(JSON.stringify(s, null, 2));
    return;
  }

  const res = await getQuote({
    originAsset: ORIGIN,
    destinationAsset: DESTINATION,
    amount: val('amount') || ONE_NEAR_YOCTO,
    recipient: account,
    refundTo: account,
    dry: !has('live'),
  });

  const q = res?.quote || res;
  line(`origin      ${q?.originAsset || ORIGIN}`);
  line(`destination ${q?.destinationAsset || DESTINATION}`);
  line(`amount in   ${q?.amountInFormatted || q?.amountIn}`);
  line(`amount out  ${q?.amountOutFormatted || q?.amountOut} (min ${q?.minAmountOut || '?'})`);
  line(`deposit to  ${q?.depositAddress || '(none — dry quote)'}`);
  line(`deadline    ${q?.deadline || res?.quoteRequest?.deadline}`);
  line(`time est.   ${q?.timeEstimate ? `${q.timeEstimate}s` : 'n/a'}`);
}

main().catch((err) => {
  console.error(`near-intent-quote: ${err.message}`);
  process.exit(1);
});
