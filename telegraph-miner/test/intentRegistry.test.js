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
    assert.deepEqual(registeredIntentNames(), [
      'SPORTS_SCORE_GENERAL',
      'GAME_RESULT_GENERAL',
      'EVENT_OUTCOME_RESOLUTION_GENERAL',
    ]);
  });

  it('query.js SUPPORTED_INTENTS is the registry list, not a copy', () => {
    assert.deepEqual(SUPPORTED_INTENTS, registeredIntentNames());
  });

  it('/status miner.intents advertises registered intents only', async () => {
    const status = await getMinerStatus();
    assert.deepEqual(status.miner.intents, registeredIntentNames());
    assert.ok(status.miner.intents.includes('EVENT_OUTCOME_RESOLUTION_GENERAL'));
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
    assert.ok(enumList.includes('EVENT_OUTCOME_RESOLUTION_GENERAL'));
  });

  it('llms.txt advertises every registered intent', () => {
    const text = llmsTxt();
    for (const name of registeredIntentNames()) assert.ok(text.includes(name));
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

  it('registered intents are dispatched with the flag unset', () => {
    assert.deepEqual(Object.keys(handlers({})), registeredIntentNames());
    assert.deepEqual(
      enabledIntents({}).map((i) => i.name),
      registeredIntentNames(),
    );
  });

  it('a Season I intent name canonicalizes onto the scored id', () => {
    const parsed = normalizeQueryRequest({
      intent: 'EVENT_OUTCOME_RESOLUTION',
      params: { question: 'did the fed cut rates' },
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.intent, 'EVENT_OUTCOME_RESOLUTION_GENERAL');
  });

  it('the handler refuses only when the kill switch is false', async () => {
    const saved = process.env[INTENT_FLAG];
    process.env[INTENT_FLAG] = 'false';
    try {
      const out = await handleEventOutcomeResolution({ team: 'Inter Miami' });
      assert.equal(out.answer, null);
      assert.equal(out.metadata.error, 'intent_disabled');
    } finally {
      if (saved === undefined) delete process.env[INTENT_FLAG];
      else process.env[INTENT_FLAG] = saved;
    }
  });
});
