import { describe, it, expect } from 'vitest';
import {
  resolveDelphiConfig,
  AGGRO_MODE,
  AGGRO_LIVE_SOURCES,
  AGGRO_OVERRIDES,
} from '../services/delphiAgentLoop.js';

// These assertions target the env-INDEPENDENT guarantees of aggro mode: the
// aggressive caps, the hard source whitelist, and live-source blocking.
// DEFAULT_CONFIG is computed at module load, so we don't assert env-derived
// defaults here — only the forced behavior that must hold regardless of env.

describe('resolveDelphiConfig — default', () => {
  it('leaves mode unset and does not force the whitelist', () => {
    const cfg = resolveDelphiConfig({});
    expect(cfg.mode).toBeUndefined();
    // liveSources is whatever env says in the default path — never forced.
    expect(cfg).not.toBeUndefined();
  });

  it('merges caller overrides on the default path (legacy behavior)', () => {
    const cfg = resolveDelphiConfig({ maxMarkets: 3, minEdge: 0.02 });
    expect(cfg.maxMarkets).toBe(3);
    expect(cfg.minEdge).toBe(0.02);
  });
});

describe('resolveDelphiConfig — aggro via config.mode', () => {
  it('applies aggressive overrides and forces the hard whitelist', () => {
    const cfg = resolveDelphiConfig({ mode: AGGRO_MODE });
    expect(cfg.mode).toBe(AGGRO_MODE);
    for (const [k, v] of Object.entries(AGGRO_OVERRIDES)) {
      expect(cfg[k], k).toBe(v);
    }
    expect(cfg.liveSources).toEqual([...AGGRO_LIVE_SOURCES]);
  });

  it('HARD-BLOCKS blind-LLM sources even when env is broad', () => {
    process.env.DELPHI_AGENT_LIVE_SOURCES = 'datafeed,espn,vercel,openrouter,nvidia,bai,venice';
    const cfg = resolveDelphiConfig({ mode: AGGRO_MODE });
    expect(cfg.liveSources).toEqual(['datafeed', 'espn', 'vercel']);
    for (const banned of ['openrouter', 'nvidia', 'bai', 'venice']) {
      expect(cfg.liveSources.includes(banned)).toBe(false);
    }
    delete process.env.DELPHI_AGENT_LIVE_SOURCES;
  });

  it('respects an explicit dryRun=false flag', () => {
    const cfg = resolveDelphiConfig({ mode: AGGRO_MODE, dryRun: false });
    expect(cfg.dryRun).toBe(false);
    expect(cfg.mode).toBe(AGGRO_MODE);
  });
});

describe('resolveDelphiConfig — aggro via env', () => {
  it('reads DELPHI_AGENT_MODE from environment', () => {
    process.env.DELPHI_AGENT_MODE = 'aggro';
    const cfg = resolveDelphiConfig({});
    expect(cfg.mode).toBe(AGGRO_MODE);
    expect(cfg.liveSources).toEqual([...AGGRO_LIVE_SOURCES]);
    delete process.env.DELPHI_AGENT_MODE;
  });
});