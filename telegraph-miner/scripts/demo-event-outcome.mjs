#!/usr/bin/env node
/**
 * Direct-call demo of the EVENT_OUTCOME_RESOLUTION handler.
 *
 * The intent is not on the miner's on-chain intent set (that set is closed;
 * changing it takes updateMiner(148, …) on Base Sepolia), so it can never be
 * reached through /query and is never advertised. This script is how the
 * handler is exercised: a direct call, flag on, answer printed verbatim.
 *
 *   TELEGRAPH_INTENT_EVENT_OUTCOME=true \
 *     node scripts/demo-event-outcome.mjs --team "Inter Miami"
 *   TELEGRAPH_INTENT_EVENT_OUTCOME=true \
 *     node scripts/demo-event-outcome.mjs --fixture 18175981
 *
 * Non-sports asks go through the market-settlement leg:
 *   --question "did the Fed cut rates in October"   (Polymarket search)
 *   --market 520210                                  (Gamma market id)
 *   --slug fed-decisions-october-2026                (Gamma event slug)
 *   --ticker KXFEDDECISION-26OCT                     (Kalshi market ticker)
 *   --platform kalshi --question "…"                 (Kalshi has no text
 *                                                      search — the handler
 *                                                      says so, not guesses)
 *
 * TELEGRAPH_INTENT_EVENT_OUTCOME=false is the kill switch. Unset, it answers.
 */

import { handleEventOutcomeResolution, INTENT_FLAG } from '../src/intents/eventOutcomeResolution.js';

const args = process.argv.slice(2);
const val = (name) => {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
};

const params = {
  team: val('team') || undefined,
  opponent: val('opponent') || undefined,
  fixture_id: val('fixture') || undefined,
  competition: val('competition') || undefined,
  date: val('date') || undefined,
  question: val('question') || undefined,
  market_id: val('market') || undefined,
  condition_id: val('condition') || undefined,
  slug: val('slug') || undefined,
  market_url: val('market-url') || undefined,
  ticker: val('ticker') || undefined,
  event_ticker: val('event-ticker') || undefined,
  series_ticker: val('series-ticker') || undefined,
  platform: val('platform') || undefined,
};

const result = await handleEventOutcomeResolution(params);

console.log('');
console.log(`EVENT_OUTCOME_RESOLUTION — flag ${process.env[INTENT_FLAG] === 'true' ? 'ON' : 'OFF'}`);
console.log('='.repeat(60));
if (!result.answer) {
  console.log(`no result: ${result.metadata?.error} — ${result.metadata?.message}`);
  process.exitCode = 1;
} else {
  const { answer, metadata } = result;
  console.log(answer.summary);
  console.log('');
  console.log(`source      ${answer.source} · verification ${metadata.verification}`);
  console.log(`verified    ${answer.verified} (true only with a real Merkle root)`);
  console.log(`resolution  ${JSON.stringify(answer.resolution, null, 2)}`);
}
console.log('');
