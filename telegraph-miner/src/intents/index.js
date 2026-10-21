/**
 * The intent registry — the single source of truth for what this miner can
 * answer. Four places used to keep their own copy of the list (query.js
 * SUPPORTED_INTENTS, server.js INTENT_HANDLERS, status.js's hardcoded list,
 * telegraph.yaml's enum + supported_intents); all of them now derive here,
 * and test/intentRegistry.test.js fails when any copy drifts.
 *
 * `registered` means *on the on-chain intent set*. That set is closed:
 * changing it takes updateMiner(148, …) via cast send on Base Sepolia —
 * never registerMiner. Only registered intents may be advertised (in
 * /status, telegraph.yaml, /.well-known) or reached through /query. An
 * unregistered handler exists for direct-call demos only, behind its flag.
 */

import { handleSportsScore } from './sportsScore.js';
import { handleGameResult } from './gameResult.js';
import { handleEventOutcomeResolution, INTENT_FLAG } from './eventOutcomeResolution.js';
import { isEnabled } from '../flags.js';

export const INTENT_REGISTRY = [
  {
    name: 'SPORTS_SCORE',
    handler: handleSportsScore,
    description: 'a live or most-recent score',
    registered: true,
  },
  {
    name: 'GAME_RESULT',
    handler: handleGameResult,
    description: "a completed fixture's winner",
    registered: true,
  },
  {
    name: 'EVENT_OUTCOME_RESOLUTION',
    handler: handleEventOutcomeResolution,
    description: 'whether a fixture resolved, how that resolution is evidenced, and whether the outcome matched bookmaker consensus',
    registered: false,
    flag: INTENT_FLAG,
  },
];

/** Names on the on-chain set — the only intents this miner advertises. */
export function registeredIntentNames() {
  return INTENT_REGISTRY.filter((i) => i.registered).map((i) => i.name);
}

/**
 * Registered intents plus any unregistered handler whose flag is on.
 * `env` is injectable so tests never mutate process.env.
 */
export function enabledIntents(env = process.env) {
  return INTENT_REGISTRY.filter((i) => i.registered || (i.flag && isEnabled(i.flag, env)));
}

/** name → handler for every enabled intent. */
export function handlers(env = process.env) {
  return Object.fromEntries(enabledIntents(env).map((i) => [i.name, i.handler]));
}
