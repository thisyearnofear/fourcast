/**
 * Unit tests for EvidenceBlock helper functions
 * Tests the pure business logic: buildSources, buildCounterSignals,
 * getConfidenceMethod, and formatRelativeTime
 */
import { describe, it, expect } from 'vitest';

// Import the pure helper functions directly
// They are not exported, so we test the component's logic by importing the default
// and testing the observable behavior through derived signal data
/**
 * Helper functions replicated from EvidenceBlock.js for isolated unit testing.
 * The original functions are not exported from the component (which contains JSX
 * that vitest's node environment can't parse), so we test them directly here.
 *
 * These replicas must be kept in sync with the original implementation.
 */

// Replicate buildSources for isolated unit testing
function buildSources(signal) {
  const sources = [];

  if (signal.source === 'synthdata+llm' || signal.source === 'llm') {
    sources.push({
      icon: '🧠',
      label: 'Venice AI Multi-Agent Mesh',
      subtype: signal.source === 'synthdata+llm' ? 'Llama 3.3 70B + SynthData' : 'Llama 3.3 70B',
      timestamp: signal.timestamp || signal.created_at,
    });
  }

  if (signal.source === 'synthdata+llm' || signal.synth_ml_percentile != null) {
    sources.push({
      icon: '📈',
      label: 'SynthData ML Ensemble',
      subtype: signal.synth_ml_percentile != null
        ? `${signal.synth_ml_percentile}th percentile`
        : '200+ models',
      timestamp: signal.timestamp,
    });
  }

  if (signal.event_id || signal.market_title) {
    sources.push({
      icon: '📊',
      label: signal.event_id?.startsWith('kalshi') ? 'Kalshi Order Book' : 'Polymarket Order Book',
      subtype: signal.odds_efficiency === 'INEFFICIENT' ? 'Mispricing detected' : 'Market consensus',
      timestamp: signal.timestamp,
    });
  }

  if (signal.venue || signal.market_title?.toLowerCase().includes('weather')) {
    sources.push({
      icon: '🌤️',
      label: 'Open-Meteo Weather API',
      subtype: signal.venue || 'Local conditions',
      timestamp: signal.timestamp,
    });
  }

  if (signal.market_snapshot_hash) {
    sources.push({
      icon: '🔗',
      label: 'Market State Snapshot',
      subtype: typeof signal.market_snapshot_hash === 'string'
        ? signal.market_snapshot_hash.substring(0, 16) + '...'
        : 'Verified',
      timestamp: signal.timestamp,
    });
  }

  return sources;
}

function buildCounterSignals(signal) {
  const counters = [];

  if (signal.confidence === 'HIGH') {
    counters.push('Sudden shift in market sentiment or liquidity');
    counters.push('Unexpected macro event (Fed, regulatory, geopolitical)');
  } else if (signal.confidence === 'MEDIUM') {
    counters.push('Rapid change in baseline conditions (weather, news)');
    counters.push('Divergence from historical pattern in similar events');
  } else {
    counters.push('High uncertainty — any significant new information could flip this prediction');
  }

  if (signal.confidence === 'HIGH' || signal.confidence === 'MEDIUM') {
    const title = signal.market_title?.toLowerCase() || '';
    if (title.includes('btc') || title.includes('eth') || title.includes('crypto')) {
      counters.push('Flash crash or abnormal on-chain activity');
    }
    if (title.includes('sport') || title.includes('game') || title.includes('match')) {
      counters.push('Key player injury or lineup change');
    }
    if (title.includes('weather') || title.includes('temp') || title.includes('storm')) {
      counters.push('Sudden meteorological model divergence');
    }
  }

  return [...new Set(counters)].slice(0, 3);
}

function getConfidenceMethod(signal) {
  if (!signal || !signal.confidence) {
    return 'Confidence derived from ensemble signal strength across multiple model outputs.';
  }

  switch (signal.confidence) {
    case 'HIGH':
      return 'Strong cross-model agreement between Venice LLM reasoning and SynthData ML ensemble. ' +
        'Edge exceeds minimum threshold with high odds-efficiency. ' +
        (signal.source === 'synthdata+llm'
          ? 'SynthData ML percentiles reinforce the directional conviction.'
          : '');
    case 'MEDIUM':
      return 'Moderate alignment between AI reasoning and market data. ' +
        'Venice LLM identifies a directional bias but SynthData ML shows mixed signals. ' +
        'Odds efficiency suggests partial mispricing.';
    case 'LOW':
      return 'Weak or conflicting signals across data sources. ' +
        'Either market is highly efficient (no clear edge) or AI models lack sufficient ' +
        'training data for this specific scenario. Low-conviction signals are candid about uncertainty.';
    default:
      return 'Confidence derived from ensemble signal strength across multiple model outputs.';
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - (typeof timestamp === 'number' ? timestamp : parseInt(timestamp));
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ──────────────────────────────────────────────
// buildSources tests
// ──────────────────────────────────────────────

describe('EvidenceBlock.buildSources', () => {
  it('adds Venice AI source for llm signals', () => {
    const sources = buildSources({ source: 'llm', timestamp: 1000000 });
    expect(sources.some(s => s.label === 'Venice AI Multi-Agent Mesh')).toBe(true);
    expect(sources.some(s => s.subtype === 'Llama 3.3 70B')).toBe(true);
  });

  it('adds SynthData ML source for synthdata+llm signals', () => {
    const sources = buildSources({ source: 'synthdata+llm', timestamp: 1000000 });
    expect(sources.some(s => s.label === 'SynthData ML Ensemble')).toBe(true);
    expect(sources.some(s => s.subtype === '200+ models')).toBe(true);
  });

  it('shows percentile in SynthData subtype when synth_ml_percentile is set', () => {
    const sources = buildSources({ synth_ml_percentile: 85, timestamp: 1000000 });
    expect(sources.some(s => s.subtype === '85th percentile')).toBe(true);
  });

  it('adds market data source when event_id is present', () => {
    const sources = buildSources({ event_id: 'polymarket-123', timestamp: 1000000 });
    expect(sources.some(s => s.label === 'Polymarket Order Book')).toBe(true);
  });

  it('labels Kalshi Order Book for kalshi-prefixed event_ids', () => {
    const sources = buildSources({ event_id: 'kalshi-abc-123', timestamp: 1000000 });
    expect(sources.some(s => s.label === 'Kalshi Order Book')).toBe(true);
  });

  it('marks INEFFICIENT subtype when odds_efficiency indicates mispricing', () => {
    const sources = buildSources({
      event_id: 'pm-1',
      odds_efficiency: 'INEFFICIENT',
      timestamp: 1000000,
    });
    expect(sources.some(s => s.subtype === 'Mispricing detected')).toBe(true);
  });

  it('adds weather source when venue is set', () => {
    const sources = buildSources({ venue: 'Kansas City, MO', timestamp: 1000000 });
    expect(sources.some(s => s.icon === '🌤️')).toBe(true);
    expect(sources.some(s => s.subtype === 'Kansas City, MO')).toBe(true);
  });

  it('adds weather source when title mentions weather', () => {
    const sources = buildSources({
      market_title: 'Will the weather be good in Miami?',
      timestamp: 1000000,
    });
    expect(sources.some(s => s.icon === '🌤️')).toBe(true);
  });

  it('adds market state snapshot when hash is present', () => {
    const sources = buildSources({
      market_snapshot_hash: 'abc123def456ghi789',
      timestamp: 1000000,
    });
    expect(sources.some(s => s.label === 'Market State Snapshot')).toBe(true);
    expect(sources.some(s => s.subtype.startsWith('abc123def456ghi7'))).toBe(true);
  });

  it('returns empty array for signal with no relevant data', () => {
    const sources = buildSources({});
    expect(sources).toEqual([]);
  });

  it('does not add duplicate sources for the same signal', () => {
    // Passing the same field multiple ways shouldn't double-count the same source type
    const sources = buildSources({
      source: 'synthdata+llm',
      synth_ml_percentile: 72,
      event_id: 'pm-1',
      venue: 'Chicago, IL',
      market_snapshot_hash: 'abc',
      timestamp: 1000000,
    });
    // Each source type should appear exactly once
    const labels = sources.map(s => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

// ──────────────────────────────────────────────
// buildCounterSignals tests
// ──────────────────────────────────────────────

describe('EvidenceBlock.buildCounterSignals', () => {
  it('returns market sentiment + macro counters for HIGH confidence', () => {
    const counters = buildCounterSignals({ confidence: 'HIGH' });
    expect(counters).toContain('Sudden shift in market sentiment or liquidity');
    expect(counters).toContain('Unexpected macro event (Fed, regulatory, geopolitical)');
  });

  it('returns weather + historical counters for MEDIUM confidence', () => {
    const counters = buildCounterSignals({ confidence: 'MEDIUM' });
    expect(counters).toContain('Rapid change in baseline conditions (weather, news)');
    expect(counters).toContain('Divergence from historical pattern in similar events');
  });

  it('returns uncertainty warning for LOW confidence', () => {
    const counters = buildCounterSignals({ confidence: 'LOW' });
    expect(counters).toContain('High uncertainty — any significant new information could flip this prediction');
  });

  it('adds crypto-specific counter for BTC markets at HIGH/MEDIUM confidence', () => {
    const counters = buildCounterSignals({
      confidence: 'HIGH',
      market_title: 'Will BTC hit $100k?',
    });
    expect(counters).toContain('Flash crash or abnormal on-chain activity');
  });

  it('adds sports-specific counter for sports markets at HIGH/MEDIUM confidence', () => {
    const counters = buildCounterSignals({
      confidence: 'MEDIUM',
      market_title: 'Will the Chiefs win the big game?',
    });
    expect(counters).toContain('Key player injury or lineup change');
  });

  it('adds weather-specific counter for weather markets at HIGH/MEDIUM confidence', () => {
    const counters = buildCounterSignals({
      confidence: 'HIGH',
      market_title: 'Temperature in Phoenix to exceed 110°F',
    });
    expect(counters).toContain('Sudden meteorological model divergence');
  });

  it('does not add asset-specific counters for LOW confidence', () => {
    const counters = buildCounterSignals({
      confidence: 'LOW',
      market_title: 'Will BTC hit $100k?',
    });
    expect(counters).not.toContain('Flash crash or abnormal on-chain activity');
  });

  it('limits counters to 3 items', () => {
    const signal = {
      confidence: 'HIGH',
      market_title: 'BTC ETH crypto market game match weather temp storm',
    };
    const counters = buildCounterSignals(signal);
    expect(counters.length).toBeLessThanOrEqual(3);
  });

  it('handles null/undefined confidence gracefully', () => {
    const counters = buildCounterSignals({});
    expect(counters.length).toBeGreaterThanOrEqual(1);
    expect(counters[0]).toContain('High uncertainty');
  });
});

// ──────────────────────────────────────────────
// getConfidenceMethod tests
// ──────────────────────────────────────────────

describe('EvidenceBlock.getConfidenceMethod', () => {
  it('returns strong cross-model agreement for HIGH', () => {
    const method = getConfidenceMethod({ confidence: 'HIGH' });
    expect(method).toContain('Strong cross-model agreement');
    expect(method).toContain('high odds-efficiency');
  });

  it('mentions SynthData ML percentiles when source is synthdata+llm at HIGH', () => {
    const method = getConfidenceMethod({ confidence: 'HIGH', source: 'synthdata+llm' });
    expect(method).toContain('SynthData ML percentiles reinforce');
  });

  it('does not add the SynthData ML percentiles boost line for plain llm at HIGH', () => {
    const method = getConfidenceMethod({ confidence: 'HIGH', source: 'llm' });
    // The base HIGH template always references "SynthData ML ensemble" in its first sentence,
    // but the extra "SynthData ML percentiles reinforce" line should only appear for synthdata+llm
    expect(method).not.toContain('percentiles reinforce');
  });

  it('returns moderate alignment for MEDIUM', () => {
    const method = getConfidenceMethod({ confidence: 'MEDIUM' });
    expect(method).toContain('Moderate alignment');
    expect(method).toContain('partial mispricing');
  });

  it('returns weak signals for LOW', () => {
    const method = getConfidenceMethod({ confidence: 'LOW' });
    expect(method).toContain('Weak or conflicting signals');
    expect(method).toContain('candid about uncertainty');
  });

  it('returns generic method for null signal', () => {
    const method = getConfidenceMethod(null);
    expect(method).toContain('ensemble signal strength');
  });

  it('returns generic method for signal without confidence', () => {
    const method = getConfidenceMethod({ source: 'llm' });
    expect(method).toContain('ensemble signal strength');
  });
});

// ──────────────────────────────────────────────
// formatRelativeTime tests
// ──────────────────────────────────────────────

describe('EvidenceBlock.formatRelativeTime', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatRelativeTime(null)).toBe('');
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('returns "just now" for timestamps less than 60s ago', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatRelativeTime(now - 5)).toBe('just now');
    expect(formatRelativeTime(now - 59)).toBe('just now');
  });

  it('returns minutes for timestamps < 1 hour ago', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatRelativeTime(now - 120)).toBe('2m ago');
    expect(formatRelativeTime(now - 3540)).toBe('59m ago');
  });

  it('returns hours for timestamps < 24 hours ago', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatRelativeTime(now - 3600)).toBe('1h ago');
    expect(formatRelativeTime(now - 82800)).toBe('23h ago');
  });

  it('returns days for timestamps >= 24 hours ago', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatRelativeTime(now - 86400)).toBe('1d ago');
    expect(formatRelativeTime(now - 259200)).toBe('3d ago');
  });

  it('handles string timestamps by parsing them', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatRelativeTime(String(now - 120))).toBe('2m ago');
  });
});
