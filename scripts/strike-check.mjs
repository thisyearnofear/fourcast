#!/usr/bin/env node
/**
 * Strike adapter check — proves the read path and the signing path.
 *
 *   node scripts/strike-check.mjs              # public reads + signed account read if configured
 *   node scripts/strike-check.mjs --validate   # + a locally-validated bracket order (never sent)
 *
 * Environment (see services/strike/strikeClient.js):
 *   STRIKE_NETWORK (default testnet), STRIKE_API_WALLET_PRIVATE_KEY,
 *   STRIKE_API_WALLET_PUBLIC_KEY, STRIKE_BASE_URL, STRIKE_TIMEOUT_MS
 */

import dotenv from 'dotenv';

dotenv.config({ path: process.env.FOURCAST_AGENT_ENV_FILE || '.env.agent' });
dotenv.config();

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const line = (s = '') => console.log(s);

async function main() {
  const { strikeStatus, isConfigured, strikeSigned } = await import('../services/strike/strikeClient.js');
  const { getUniverse, getSymbolSnapshot } = await import('../services/strike/strikeDiscovery.js');
  const { validateOrder, buildStrategyOrder } = await import('../services/strike/strikeTrading.js');

  const status = strikeStatus();
  line('');
  line('⚡ Fourcast → Strike Perpetuals V2');
  line('='.repeat(48));
  line(`network      ${status.network} via ${status.baseUrl || 'unresolved'}`);
  line(`configured   ${status.configured}  pubkey ${status.publicKeyTail || 'unset'}`);
  if (status.reason) line(`note         ${status.reason}`);

  let ok = true;

  // Public market reads — no auth, always exercised.
  line('');
  line('— Public market data (unsigned) —');
  let symbols = [];
  try {
    const uni = await getUniverse();
    symbols = uni.symbols;
    line(`  exchangeInfo  ${symbols.length} trading symbols · serverTime ${uni.serverTime}`);
    for (const s of symbols) line(`    ${s.symbol}  ${s.contractType}  tick ${s.filters.tickSize ?? 'n/a'} step ${s.filters.stepSize ?? 'n/a'}`);
  } catch (err) {
    ok = false;
    line(`  ✗ exchangeInfo: ${err.message}`);
  }

  const probe = symbols.find((s) => s.symbol === 'SOL-USD') || symbols[0];
  if (probe) {
    try {
      const snap = await getSymbolSnapshot(probe.symbol);
      line(
        `  ${probe.symbol}  mark ${snap.markPrice} · last ${snap.lastPrice} · ` +
        `funding ${snap.fundingRate} · OI ${snap.openInterest} · ` +
        `qvol24h ${snap.quoteVolume24h} · vol ${snap.volatilityPct?.toFixed(3)}% (${snap.klines} klines)`
      );
    } catch (err) {
      ok = false;
      line(`  ✗ snapshot ${probe.symbol}: ${err.message}`);
    }
  }

  // Signed path — only what the key allows; API wallets cannot move funds.
  line('');
  line('— Signed reads (API wallet) —');
  if (!isConfigured()) {
    line(`  ✋ ${status.reason} — set it and re-run. Signed reads skipped.`);
  } else {
    try {
      const account = await strikeSigned('GET', '/v2/account');
      line(`  account       ${account ? `ok — ${JSON.stringify(account).slice(0, 160)}` : 'null (unconfigured)'}`);
    } catch (err) {
      ok = false;
      line(`  ✗ account: ${err.code || 'ERROR'} ${err.message}`);
    }
    try {
      const positions = await strikeSigned('GET', '/v2/positions');
      const n = Array.isArray(positions) ? positions.length : (positions?.positions?.length ?? '?');
      line(`  positions     ${n} open`);
    } catch (err) {
      ok = false;
      line(`  ✗ positions: ${err.code || 'ERROR'} ${err.message}`);
    }
  }

  // Order validation — local only unless explicitly sent (never sends).
  if (has('--validate') && probe) {
    line('');
    line('— Order validation (local, nothing sent) —');
    const body = buildStrategyOrder({
      strategyId: `strike-check-${Date.now()}`,
      entry: { symbol: probe.symbol, side: 'buy', type: 'market', size: '1', slippage: '0.01', clientOrderId: 'rcpt-demo' },
      tp: { type: 'take_profit', size: '1', stopPrice: '999999', clientOrderId: 'rcpt-demo-tp' },
      sl: { type: 'stop', size: '1', stopPrice: '1', clientOrderId: 'rcpt-demo-sl' },
    }, probe);
    const check = validateOrder({ ...body, price: undefined }, probe);
    line(`  bracket body  ${JSON.stringify(body).slice(0, 200)}…`);
    line(`  validation    ${check.ok ? 'ok' : `FAILED: ${check.errors.join('; ')}`}`);
    if (!check.ok) ok = false;
  }

  line('');
  if (!isConfigured()) {
    line('Next step: create a testnet API wallet (app.strikefinance.org/api-keys),');
    line('set STRIKE_API_WALLET_{PUBLIC,PRIVATE}_KEY, and re-run for signed reads.');
  }
  if (!ok) process.exitCode = 1;
  line('');
}

main().catch((err) => {
  console.error('Strike check failed:', err);
  process.exitCode = 1;
});
