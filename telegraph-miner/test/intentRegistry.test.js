/**
 * Drift guard for the intent registry.
 *
 * Intents used to be duplicated in four places; they now derive from
 * INTENT_REGISTRY. This file fails when any copy drifts — and pins the rule
 * that an unregistered handler is never advertised and never reachable
 * through /query.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  INTENT_REGISTRY,
  registeredIntentNames,
  enabledIntents,
  handlers,
} from '../src/intents/index.js';
import { SUPPORTED_INTENTS, normalizeQueryRequest } from '../src/query.js';
import { getMinerStatus } from '../src/status.js';
import { isEnabled } from '../src/flags.js';
import { renderManifest } from '../scripts/render-manifest.mjs';
import { handleEventOutcomeResolution, INTENT_FLAG } from '../src/intents/eventOutcomeResolution.js';
import { openApiDocument, llmsTxt } from '../src/openapi.js';

const YAML_PATH = fileURLToPath(new URL('../telegraph.yaml', import.meta.url));

describe('single source of truth', () => {
  it('registered intents are exactly the on-chain set', () => {
    assert.deepEqual(registeredIntentNames(), ['SPORTS_SCORE', 'GAME_RESULT']);
    assert.equal(INTENT_REGISTRY.find((i) => i.name === 'EVENT_OUTCOME_RESOLUTION').registered, false);
  });

  it('query.js SUPPORTED_INTENTS is the registry list, not a copy', () => {
    assert.deepEqual(SUPPORTED_INTENTS, registeredIntentNames());
  });

  it('/status miner.intents advertises registered intents only', async () => {
    const status = await getMinerStatus();
    assert.deepEqual(status.miner.intents, registeredIntentNames());
    assert.ok(!status.miner.intents.includes('EVENT_OUTCOME_RESOLUTION'));
  });

  it('telegraph.yaml is byte-identical to a fresh render', () => {
    const onDisk = readFileSync(YAML_PATH, 'utf8');
    assert.equal(
      onDisk,
      renderManifest(),
      'telegraph.yaml drifted — re-run node scripts/render-manifest.mjs',
    );
  });

  it('openapi.json documents registered intents and nothing else', () => {
    const doc = openApiDocument();
    const enumList = doc.paths['/query'].post.requestBody.content['application/json'].schema.properties.intent.enum;
    assert.deepEqual(enumList, registeredIntentNames());
    assert.deepEqual(doc.info['x-intents-registered'], registeredIntentNames());
    assert.ok(!enumList.includes('EVENT_OUTCOME_RESOLUTION'));
  });

  it('llms.txt advertises registered intents and never names an unregistered one', () => {
    const text = llmsTxt();
    for (const name of registeredIntentNames()) assert.ok(text.includes(name));
    assert.ok(!text.includes('EVENT_OUTCOME_RESOLUTION'));
    assert.ok(text.includes('verified:true'));
  });
});

describe('flags and dispatch', () => {
  it('isEnabled is exactly-true, everything else is off', () => {
    assert.equal(isEnabled('F', { F: 'true' }), true);
    for (const v of [undefined, '', '1', 'yes', 'TRUE', 'false']) {
      assert.equal(isEnabled('F', { F: v }), false, JSON.stringify(v));
    }
  });

  it('unregistered handlers join the dispatch map only when flagged', () => {
    assert.deepEqual(Object.keys(handlers({})), ['SPORTS_SCORE', 'GAME_RESULT']);
    assert.deepEqual(
      Object.keys(handlers({ [INTENT_FLAG]: 'true' })),
      ['SPORTS_SCORE', 'GAME_RESULT', 'EVENT_OUTCOME_RESOLUTION'],
    );
    assert.deepEqual(
      enabledIntents({ [INTENT_FLAG]: 'true' }).map((i) => i.name),
      ['SPORTS_SCORE', 'GAME_RESULT', 'EVENT_OUTCOME_RESOLUTION'],
    );
  });

  it('/query cannot reach an unregistered intent even when asked for it', () => {
    // A declared EVENT_OUTCOME_RESOLUTION falls through the same
    // inference path as any other unregistered name — it can only ever
    // resolve to a registered intent or unsupported_intent.
    const parsed = normalizeQueryRequest({
      intent: 'EVENT_OUTCOME_RESOLUTION',
      query: 'who won Inter Miami last night',
    });
    if (parsed.ok) {
      assert.ok(registeredIntentNames().includes(parsed.intent));
      assert.notEqual(parsed.intent, 'EVENT_OUTCOME_RESOLUTION');
    } else {
      assert.equal(parsed.error, 'unsupported_intent');
    }
  });

  it('the handler itself refuses when the flag is off', async () => {
    delete process.env[INTENT_FLAG];
    const out = await handleEventOutcomeResolution({ team: 'Inter Miami' });
    assert.equal(out.answer, null);
    assert.equal(out.metadata.error, 'intent_disabled');
  });
});
