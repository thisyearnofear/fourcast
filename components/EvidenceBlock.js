'use client';

import { useState } from 'react';

/**
 * EvidenceBlock
 *
 * Reusable provenance display for every AI prediction.
 * Shows: data sources used (with timestamps), confidence methodology,
 * counter-signals / "what would change my mind", and a link to
 * the agent's public track record.
 *
 * Usage:
 * <EvidenceBlock
 *   signal={signal}
 *   isNight={isNight}
 *   textColor={textColor}
 *   calibrationScore={72}
 *   agentBrierScore={0.12}
 * />
 *
 * Can be embedded in SignalCard, MySignalsTab, analysis results, etc.
 */
export default function EvidenceBlock({
  signal,
  isNight = true,
  textColor = 'text-white',
  calibrationScore,
  agentBrierScore,
  sources,
  counterSignals,
  className = '',
}) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [trackRecordOpen, setTrackRecordOpen] = useState(false);

  const bg = 'bg-white/[0.03]';
  const border = 'border-white/[0.06]';
  const muted = 'opacity-50';
  const labelColor = 'text-white/60';

  // --- Derive sources from signal metadata ---
  const derivedSources = sources || buildSources(signal);

  // --- Derive counter-signals ---
  const derivedCounterSignals = counterSignals || buildCounterSignals(signal);

  // --- Confidence methodology ---
  const confidenceMethod = getConfidenceMethod(signal);

  return (
    <div className={`fc-proof-rail ${bg} border ${border} overflow-hidden transition-all ${className}`}>
      {/* Reputation Spine — always visible */}
      {(calibrationScore != null || agentBrierScore != null) && (
        <div className={`px-4 pt-3 pb-2 bg-white/[0.02]`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Calibration gauge */}
            {calibrationScore != null && (
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] font-medium uppercase tracking-wider ${labelColor}`}>
                  Calibration
                </span>
                {/* Gauge bar */}
                <div className="relative w-16 h-1.5 rounded-full overflow-hidden bg-white/10">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                      calibrationScore >= 70 ? 'bg-green-400' : calibrationScore >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, calibrationScore))}%` }}
                  />
                </div>
                <span className={`text-xs font-semibold ${
                  calibrationScore >= 70 ? 'text-green-400' : calibrationScore >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {Math.round(calibrationScore)}%
                </span>
              </div>
            )}
            {/* Brier score */}
            {agentBrierScore != null && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-[10px] font-medium uppercase tracking-wider ${labelColor}`}>
                  Brier
                </span>
                <span className={`text-xs font-semibold ${
                  agentBrierScore < 0.15 ? 'text-green-400' : agentBrierScore < 0.25 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {agentBrierScore.toFixed(3)}
                </span>
                {/* Quality icon */}
                <span className={`text-[10px] ${muted}`}>
                  {agentBrierScore < 0.1 ? '★' : agentBrierScore < 0.2 ? '●' : '○'}
                </span>
              </div>
            )}
            {/* Track Record CTA */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTrackRecordOpen(!trackRecordOpen);
              }}
              className={`ml-auto text-[10px] font-medium tracking-wider px-2.5 py-1 rounded-lg transition-all whitespace-nowrap bg-blue-500/10 hover:bg-blue-500/20 text-blue-300`}
            >
              How has Fourcast done? →
            </button>
          </div>
          {/* Track record dropdown inline */}
          {trackRecordOpen && (
            <div className={`mt-2 text-xs bg-white/[0.04] rounded-lg p-3 space-y-2`}>
              <p className={`${textColor} ${muted}`}>
                Fourcast&apos;s agent uses ensemble AI (Venice LLM + SynthData ML) to generate predictions.
                Performance is tracked retroactively via Brier scores and calibration metrics on resolved markets.
              </p>
              <a
                href="/signals?tab=leaderboard"
                onClick={(e) => e.stopPropagation()}
                className={`inline-flex items-center gap-1 font-medium text-blue-300 hover:text-blue-200 transition-colors`}
              >
                View full track record →
              </a>
            </div>
          )}
        </div>
      )}
      {/* Evidence Header (collapsible) */}
      <button
        onClick={() => setSourcesExpanded(!sourcesExpanded)}
        className={`w-full flex items-center justify-between px-4 py-3 text-xs font-medium ${labelColor} uppercase tracking-wider hover:opacity-80 transition-opacity ${
          sourcesExpanded ? '' : 'border-t border-white/[0.04]'
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="font-mono text-emerald-300">01</span>
          <span>Evidence &amp; Provenance</span>
        </span>
        <span className={`transform transition-transform duration-200 ${sourcesExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {sourcesExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Data Sources */}
          {derivedSources.length > 0 && (
            <div>
              <p className={`text-[10px] ${labelColor} uppercase tracking-wider mb-2 font-medium`}>
                Data Sources
              </p>
              <div className="space-y-1.5">
                {derivedSources.map((source, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-white/[0.04]`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{source.icon}</span>
                      <span className={`${textColor}`}>{source.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {source.subtype && (
                        <span className={`text-[10px] text-white/30`}>
                          {source.subtype}
                        </span>
                      )}
                      {source.timestamp && (
                        <span className={`text-[10px] text-white/30`}>
                          {formatRelativeTime(source.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence Methodology */}
          <div>
            <p className={`text-[10px] ${labelColor} uppercase tracking-wider mb-2 font-medium`}>
              Confidence Methodology
            </p>
            <div className={`text-xs ${textColor} opacity-80 leading-relaxed px-3 py-2 rounded-lg bg-white/[0.04]`}>
              {confidenceMethod}
            </div>
          </div>

          {/* Counter-signals: What Would Change My Mind */}
          {derivedCounterSignals.length > 0 && (
            <div>
              <p className={`text-[10px] ${labelColor} uppercase tracking-wider mb-2 font-medium`}>
                What Would Change This Prediction
              </p>
              <div className="space-y-1">
                {derivedCounterSignals.map((counter, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <span className={`text-amber-400/70 mt-0.5`}>⚡</span>
                    <span className={`${textColor} opacity-70`}>{counter}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bright Data Sources: actual search results used in forecasting */}
          {signal.brightData?.sources?.length > 0 && (
            <div>
              <p className={`text-[10px] ${labelColor} uppercase tracking-wider mb-2 font-medium`}>
                Live web sources referenced
              </p>
              <div className="space-y-1.5">
                {signal.brightData.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url || src.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block text-xs px-3 py-2 rounded-lg transition-opacity hover:opacity-100 bg-white/[0.04] opacity-80`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`flex-shrink-0 px-1 rounded text-[8px] font-mono bg-cyan-500/10 text-cyan-400/60`}>
                        {src.rank || idx + 1}
                      </span>
                      <span className={`${textColor} font-medium truncate`}>{src.title}</span>
                      {src.source && (
                        <span className={`text-[9px] flex-shrink-0 text-white/30`}>
                          {src.source}
                        </span>
                      )}
                    </div>
                    {src.snippet && (
                      <p className={`text-[10px] mt-1 pl-5 text-white/40 line-clamp-2`}>
                        {src.snippet}
                      </p>
                    )}
                  </a>
                ))}
              </div>
              {signal.brightData.deepResearch && (
                <div className={`mt-2 px-3 py-2 rounded-lg text-[10px] bg-cyan-500/5 border border-cyan-500/10 text-cyan-300/70`}>
                  <span className="font-medium">Deep Research:</span>
                  {' '}Scraped {signal.brightData.deepResearch.charCount?.toLocaleString()} chars
                  {signal.brightData.deepResearch.sentenceCount
                    ? ` (${signal.brightData.deepResearch.sentenceCount} evidence sentences)`
                    : ''} via {signal.brightData.deepResearch.product || 'web scrape'} from{' '}
                  <a
                    href={signal.brightData.deepResearch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {signal.brightData.deepResearch.title || 'source'}
                  </a>
                </div>
              )}
            </div>
          )}


        </div>
      )}
    </div>
  );
}

// ---- Helper factories ----

function buildSources(signal) {
  const sources = [];

  // AI reasoning (always present for AI-generated predictions)
  if (signal.source === 'synthdata+llm' || signal.source === 'llm' || signal.source?.startsWith('brightdata')) {
    let icon = '🧠';
    let label = 'Venice AI Multi-Agent Mesh';
    let subtype = 'Llama 3.3 70B';

    if (signal.source === 'brightdata+llm') {
      icon = '🔍';
      label = 'Web intelligence';
      subtype = 'SERP Search-Enhanced';
    } else if (signal.source === 'brightdata+research') {
      const product = signal.brightData?.deepResearch?.product;
      icon = '🔬';
      label = 'Deep web research';
      subtype = product === 'Web Unlocker'
        ? 'Web Unlocker-Verified'
        : 'Scraping Browser-Verified';
    } else if (signal.source === 'synthdata+llm') {
      subtype = 'Llama 3.3 70B + SynthData';
    }

    sources.push({
      icon,
      label,
      subtype,
      timestamp: signal.timestamp || signal.created_at,
    });
  }

  // SynthData ML (if applicable)
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

  // Market data
  if (signal.event_id || signal.market_title) {
    sources.push({
      icon: '📊',
      label: signal.event_id?.startsWith('kalshi') ? 'Kalshi Order Book' : 'Polymarket Order Book',
      subtype: signal.odds_efficiency === 'INEFFICIENT' ? 'Mispricing detected' : 'Market consensus',
      timestamp: signal.timestamp,
    });
  }

  // Weather data
  if (signal.venue || signal.market_title?.toLowerCase().includes('weather')) {
    sources.push({
      icon: '🌤️',
      label: 'Open-Meteo Weather API',
      subtype: signal.venue || 'Local conditions',
      timestamp: signal.timestamp,
    });
  }

  // Market state snapshot (technical transparency)
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

  // Asset-specific counter-signals (only when confidence >= MEDIUM)
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

  // De-duplicate and limit
  return [...new Set(counters)].slice(0, 3);
}

function getConfidenceMethod(signal) {
  if (!signal || !signal.confidence) {
    return 'Confidence derived from ensemble signal strength across multiple model outputs.';
  }

  const isBrightData = signal.source?.startsWith('brightdata');
  const bdProduct = signal.brightData?.deepResearch?.product || 'Scraping Browser';

  switch (signal.confidence) {
    case 'HIGH':
      return isBrightData
        ? `High conviction derived from real-time market intelligence from live web sources. ` +
          `Cross-referenced ${signal.brightData?.sources?.length || 'multiple'} live web sources via SERP API` +
          (signal.source === 'brightdata+research'
            ? `. Deep research via ${bdProduct} extracted ${signal.brightData?.deepResearch?.sentenceCount || 'detailed'} evidence sentences from the primary source, confirming directional bias.`
            : '. Search snippets indicate strong directional alignment.')
        : 'Strong cross-model agreement between Venice LLM reasoning and SynthData ML ensemble. ' +
          'Edge exceeds minimum threshold with high odds-efficiency. ' +
          (signal.source === 'synthdata+llm'
            ? 'SynthData ML percentiles reinforce the directional conviction.'
            : '');
    case 'MEDIUM':
      return isBrightData
        ? `Moderate evidence found from live web intelligence. ` +
          `SERP API returned ${signal.brightData?.sources?.length || 'several'} relevant sources suggesting a directional bias, but some counter-signals remain.` +
          (signal.source === 'brightdata+research'
            ? ` Deep research via ${bdProduct} provided additional context but mixed signals persist.`
            : '')
        : 'Moderate alignment between AI reasoning and market data. ' +
          'Venice LLM identifies a directional bias but SynthData ML shows mixed signals. ' +
          'Odds efficiency suggests partial mispricing.';
    case 'LOW':
      return isBrightData
        ? `Scant evidence found from live web search. Market appears efficient or information is too fragmented for high-conviction forecasting.` +
          (signal.brightData?.sources?.length
            ? ` Only ${signal.brightData.sources.length} source(s) returned relevant results.`
            : '')
        : 'Weak or conflicting signals across data sources. ' +
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
