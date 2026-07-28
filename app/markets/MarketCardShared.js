'use client';

import React, { useState, useEffect } from "react";
import { useChainConnections } from "@/hooks/useChainConnections";
import { CHAINS } from "@/constants/appConstants";
import { getRecommendationExplanation } from "@/utils/chainUtils";
import BottomSheet from "@/components/BottomSheet";
import EvidenceBlock from "@/components/EvidenceBlock";
import InfoTip from "@/components/InfoTip";
import { useBrightDataStatus } from "@/hooks/useBrightDataStatus";
import TweenNumber from "@/components/motion/TweenNumber";
import useChangeFlash from "@/hooks/useChangeFlash";

// Token-vocabulary tints (tokens.css) — replaces ad-hoc blue/purple/green
// Tailwind palette: evidence blue, review violet, sealed amber, breach red,
// verification emerald for positive states.
const TINT = {
 evidence: "bg-evidence/15 text-evidence border-evidence/35",
 evidenceSoft: "bg-evidence/10 border-evidence/25 text-evidence",
 review: "bg-review/15 text-review border-review/35",
 sealed: "bg-sealed/15 text-sealed border-sealed/35",
 accent: "bg-accent/15 text-accent border-accent/35",
 breach: "bg-breach/15 text-breach border-breach/35",
};

export function ChainRecommendationBadge({ recommendation, isNight }) {
 const config = {
 PUBLISH: {
 icon: "◆",
 text: "Publish Receipt",
 color: TINT.accent
 },
 TRADE: {
 icon: "▣",
 text: "Trade This Market",
 color: TINT.evidence
 },
 BOTH: {
 icon: "◇",
 text: "Publish & Trade",
 color: TINT.sealed
 }
 };

 const rec = config[recommendation];
 if (!rec) return null;

 return (
 <span className={`px-3 py-1 font-light border ${rec.color}`}>
 {rec.icon} {rec.text}
 </span>
 );
}

// Chain Action Widget - Guide user on next steps with wallet validation
export function ChainActionWidget({
 analysis,
 market,
 isNight,
 textColor,
 cardBgColor,
 onPublishSignal,
 chains,
 setShowOrderPanel,
 setSelectedMarketForOrder,
}) {
 const { switchToEvmNetwork } = useChainConnections();

 if (!analysis?.chain_recommendation) return null;

 const rec = analysis.chain_recommendation;
 const shouldPublish = rec === "PUBLISH" || rec === "BOTH";
 const shouldTrade = rec === "TRADE" || rec === "BOTH";

 const publishButtonText = shouldTrade ? "Also Publish Receipt" : "Publish My Receipt";
 const tradeButtonText = shouldPublish ? "Also Trade" : "Trade This Market";

 // Get explanation for why this action is recommended
 const explanation = getRecommendationExplanation(
 rec,
 analysis.assessment?.confidence,
 analysis.assessment?.odds_efficiency
 );

 // Helper to render chain action with smart wallet validation and network switching
 const renderChainAction = (chainDef, chainState, isPrimary, buttonText, actionFn, contextMsg, needsNetworkSwitch = false, onSwitchNetwork = null) => {
 const isDisabled = !chainState.connected || needsNetworkSwitch;
 const buttonLabel = !chainState.connected
 ? `Connect ${chainDef.name}`
 : needsNetworkSwitch
 ? `Switch to ${chainState.currentNetwork?.display || 'correct network'}`
 : buttonText;

 return (
 <div className={`flex items-start gap-3 pb-3 border-b border-[var(--color-rule)] last:pb-0 last:border-0 ${isPrimary ? "bg-[var(--color-wash-soft)]" : ""
 } px-3 py-2`}>
 <span className="text-xl flex-shrink-0">{chainDef.icon}</span>
 <div className="flex-1">
 <h5 className={`text-sm font-medium ${textColor} mb-1`}>
 {chainDef.display}
 {isPrimary && <span className={`ml-2 text-xs opacity-60 text-[var(--color-sealed)]`}>← Recommended</span>}
 </h5>
 <p className={`text-xs ${textColor} opacity-60 mb-3 leading-relaxed`}>
 {contextMsg}
 </p>
 {needsNetworkSwitch && chainState.currentNetwork && (
 <p className={`text-xs mb-2 text-[var(--color-sealed)]/70`}>
 Currently on: {chainState.currentNetwork.display}
 </p>
 )}
 <button
 onClick={() => {
 if (needsNetworkSwitch && onSwitchNetwork) {
 onSwitchNetwork();
 } else if (chainState.connected) {
 actionFn();
 }
 }}
 disabled={isDisabled}
 className={`px-4 py-2 text-xs font-light transition-all border ${!isDisabled
 ? `${chainDef.color === 'purple'
 ? `${TINT.review} hover:bg-review/25`
 : `${TINT.evidence} hover:bg-evidence/25`}`
 : "opacity-50 cursor-not-allowed"
 }`}
 >
 {buttonLabel}
 </button>
 </div>
 </div>
 );
 };

 return (
 <div className={`${cardBgColor} border p-5`}>
 <h4 className={`text-xs font-light ${textColor} opacity-70 mb-4 uppercase tracking-wider`}>
 Recommended Actions
 </h4>
 <div className="space-y-1">
 {/* Explanation Header */}
 <div className={`mb-3 p-3 bg-[var(--color-paper-raised)] border border-[var(--color-rule)]`}>
 <p className={`text-xs ${textColor} font-medium mb-1`}>
 {explanation.title}
 </p>
 <p className={`text-xs ${textColor} opacity-60`}>
 {explanation.reason}
 </p>
 </div>

 {shouldPublish && renderChainAction(
 CHAINS.ARC,
 chains.arc,
 rec === "PUBLISH",
 publishButtonText,
 () => {
 if (chains.arc.connected) onPublishSignal(market, analysis);
 },
 "Seal your call as a public, timestamped receipt on Arc — the first entry of your auditable track record"
 )}

 {shouldTrade && (
 renderChainAction(
 CHAINS.EVM,
 chains.evm,
 rec === "TRADE",
 tradeButtonText,
 () => {
 if (chains.evm.connected) {
 setSelectedMarketForOrder(market);
 setShowOrderPanel(true);
 }
 },
 analysis.assessment?.odds_efficiency === "UNDERPRICED"
 ? "Market odds are underpriced. Place a position to capture value."
 : "Participate in the market based on your analysis and risk tolerance.",
 !chains.evm.isCorrectNetwork, // needsNetworkSwitch
 !chains.evm.isCorrectNetwork ? () => switchToEvmNetwork('polygon') : null // onSwitchNetwork
 )
 )}

 {rec === "BOTH" && (
 <div className={`mt-4 p-3 bg-accent/10 border border-accent/20`}>
 <p className={`text-xs ${textColor} leading-relaxed`}>
 <span className="font-medium">💡 Pro Tip:</span> {explanation.benefit}
 </p>
 </div>
 )}
 </div>
 </div>
 );
}

// Discovery Tab Component - Date-First Design
// Shared Market Card Component

/**
 * StaggeredMarketCard — wraps MarketCard with a staggered reveal animation.
 *
 * Used by SportsTabContent and DiscoveryTabContent. The parent page tracks a
 * `visibleCount` via the useStaggeredAnimation hook and passes it down along
 * with each card's `index`. Cards remain hidden (opacity-0, translated down)
 * until the stagger timer reveals them, then fade/slide into place.
 *
 * If `visibleCount` is omitted the card renders immediately (graceful fallback).
 */
export function StaggeredMarketCard({
 index = 0,
 visibleCount = Infinity,
 ...marketCardProps
}) {
 const isVisible = index < visibleCount;

 return (
 <div
 className={`transition-all duration-500 ease-out ${
 isVisible
 ? "opacity-100 translate-y-0"
 : "opacity-0 translate-y-4 pointer-events-none"
 }`}
 aria-hidden={!isVisible}
 >
 <MarketCard {...marketCardProps} />
 </div>
 );
}

export function MarketCard({
 market,
 onAnalyze,
 isNight,
 textColor,
 cardBgColor,
 isExpanded,
 expandedMarketId,
 setExpandedMarketId,
 analysis,
 isAnalyzing,
 analysisStage = 0,
 selectedMarket,
 onPublishSignal,
 chains,
 canPublish,
 setShowOrderPanel,
 setSelectedMarketForOrder,
 setSelectedKalshiMarket,
 setOrderSide,
 setSelectedArbitrage,
 agentBrierScore,
 calibrationScore,
}) {
 const isHidden = expandedMarketId && !isExpanded;
 const isCurrentMarket =
 (selectedMarket?.marketID || selectedMarket?.id) ===
 (market.marketID || market.id);

 const platform = market.platform || "polymarket";
 const isKalshi = platform === "kalshi";

 // Live odds change — the price cell washes once so the update is legible.
 const askFlashing = useChangeFlash(market.ask);
 const bidFlashing = useChangeFlash(market.bid);

 return (
 <>
 {/* Inline Card (always visible when not hidden) */}
 <div
 className={`fc-market-row transition-all duration-500 p-5 sm:p-6
 ${isHidden
 ? "opacity-0 pointer-events-none translate-y-2"
 : "opacity-100"
 }`}
 >
 <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
 <div className="flex-1 space-y-3">
 <div className="flex items-start justify-between">
 <h3
 className={`fc-market-row__question text-lg font-medium ${textColor} leading-snug mr-4`}
 >
 {market.title || market.question}
 </h3>
 {/* Platform & Date Badge */}
 <div className="flex flex-col items-end gap-1">
 <span
 className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border ${isKalshi
 ? TINT.accent
 : TINT.evidence
 }`}
 >
 {isKalshi ? "Kalshi" : "Polymarket"}
 </span>
 {market.resolutionDate && (
 <span className={`text-[10px] ${textColor} opacity-40 font-light`}>
 Ends {new Date(market.resolutionDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
 </span>
 )}
 </div>
 </div>

 {/* Market Odds Summary — read-only stat surface. Trading actions live
 in the expanded view so the browse state stays decision-first. */}
 {!isExpanded && (
 <div className="fc-market-row__prices flex items-center gap-2 py-3">
 <div
 className={`fc-market-price fc-market-price--yes flex items-center gap-2 px-3 py-2 ${askFlashing ? "fc-tick" : ""}`}
 aria-label={`Market YES price: ${market.ask ? `${(market.ask * 100).toFixed(0)} percent` : 'unavailable'}`}
 >
 <span className={`text-[10px] font-medium text-accent/70`}>YES</span>
 <span className={`text-sm font-light ${textColor}`}>
 {market.ask ? <TweenNumber value={market.ask * 100} format={(v) => `${v.toFixed(0)}%`} /> : "—"}
 </span>
 </div>
 <div
 className={`fc-market-price fc-market-price--no flex items-center gap-2 px-3 py-2 ${bidFlashing ? "fc-tick" : ""}`}
 aria-label={`Market NO price: ${market.bid ? `${(market.bid * 100).toFixed(0)} percent` : 'unavailable'}`}
 >
 <span className={`text-[10px] font-medium text-breach/70`}>NO</span>
 <span className={`text-sm font-light ${textColor}`}>
 {market.bid ? <TweenNumber value={market.bid * 100} format={(v) => `${v.toFixed(0)}%`} /> : "—"}
 </span>
 </div>
 {/* ML Edge Preview (if analyzed) */}
 {isCurrentMarket && analysis?.synthData?.polymarketEdge && (
 <div className="fc-edge-readout ml-auto flex items-center gap-1.5 px-3 py-2">
 <span className={`text-[10px] font-mono font-bold text-accent`}>
 <TweenNumber
 value={Math.abs(analysis.synthData.polymarketEdge.edge * 100)}
 format={(v) => `${v.toFixed(1)}% EDGE`}
 />
 </span>
 </div>
 )}
 </div>
 )}

 <div className="flex flex-wrap items-center gap-2 text-xs">
 {/* ML Ready Badge - NEW: Highlight differentiator early! */}
 {!isCurrentMarket && market.isMLReady && (
 <div className="relative group">
 <span
 className={`px-3 py-1 font-medium border cursor-help ${TINT.review}`}
 >
 🤖 ML Ready
 </span>
 <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 bg-[var(--color-paper-deep)] text-[var(--color-ink)] border border-[var(--color-rule-strong)]`}>
 Quantitative analysis available via SynthData
 <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[var(--color-paper-deep)] border-r border-b border-[var(--color-rule-strong)]`}></div>
 </div>
 </div>
 )}

 {/* Synth ML Badge - Show when analysis uses SynthData */}
 {isCurrentMarket && analysis?.source && (analysis.source === 'synthdata+llm' || analysis.source === 'synthdata+path') && (
 <div className="relative group">
 <span
 className={`px-3 py-1 font-medium border cursor-help ${TINT.review}`}
 >
 🤖 ML
 </span>
 <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 bg-[var(--color-paper-deep)] text-[var(--color-ink)] border border-[var(--color-rule-strong)]`}>
 {analysis.source === 'synthdata+path' ? 'Path-dependent ML analysis' : 'SynthData 200+ ML models'}
 <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[var(--color-paper-deep)] border-r border-b border-[var(--color-rule-strong)]`}></div>
 </div>
 </div>
 )}
 {market.volume24h !== undefined && (
 <div className="relative group">
 <span
 className={`px-3 py-1 font-light border cursor-help ${TINT.sealed}`}
 >
 ⚡{" "}
 {isKalshi
 ? `${market.volume24h} Vol`
 : `$${(market.volume24h / 1000).toFixed(0)}K`}
 </span>
 {/* Tooltip */}
 <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 bg-[var(--color-paper-deep)] text-[var(--color-ink)] border border-[var(--color-rule-strong)]`}>
 24-hour trading volume
 <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[var(--color-paper-deep)] border-r border-b border-[var(--color-rule-strong)]`}></div>
 </div>
 </div>
 )}
 {market.confidence && (
 <div className="relative group">
 <span
 className={`px-3 py-1 font-light border cursor-help ${market.confidence === "HIGH"
 ? TINT.accent
 : market.confidence === "MEDIUM"
 ? TINT.sealed
 : TINT.breach
 }`}
 >
 {market.confidence}
 </span>
 {/* Tooltip */}
 <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 bg-[var(--color-paper-deep)] text-[var(--color-ink)] border border-[var(--color-rule-strong)]`}>
 {market.confidence === 'HIGH' ? 'High confidence prediction' : market.confidence === 'MEDIUM' ? 'Medium confidence prediction' : 'Low confidence prediction'}
 <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[var(--color-paper-deep)] border-r border-b border-[var(--color-rule-strong)]`}></div>
 </div>
 </div>
 )}
 {/* Weather Impact Indicator - Show if event has location data */}
 {market.event_location && (
 <div className="relative group">
 <span
 className={`px-3 py-1 font-light border cursor-help ${TINT.evidence}`}
 >
 🌤️ Weather
 </span>
 <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 bg-[var(--color-paper-deep)] text-[var(--color-ink)] border border-[var(--color-rule-strong)]`}>
 Event location: {market.event_location}
 <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[var(--color-paper-deep)] border-r border-b border-[var(--color-rule-strong)]`}></div>
 </div>
 </div>
 )}
 {/* AI-Ready Badge - Indicates market can be analyzed */}
 {!isCurrentMarket && !analysis && (
 <span
 className={`px-3 py-1 font-light border bg-review/10 text-review/60 border-review/25`}
 >
 🔍 Analyze
 </span>
 )}
 {/* Quick Publish CTA - Show when ML edge detected (even in collapsed state) */}
 {isCurrentMarket && analysis?.synthData?.polymarketEdge && Math.abs(analysis.synthData.polymarketEdge.edge) > 0.03 && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 onPublishSignal();
 }}
 className={`px-3 py-1 font-medium border transition-all bg-accent/15 text-accent border-accent/40 hover:bg-accent/25`}
 title="Seal this call as a public, timestamped receipt"
 >
 🎯 Publish My Receipt
 </button>
 )}
 {/* Chain Recommendation Badge - Early visibility */}
 {isCurrentMarket && analysis?.chain_recommendation && (
 <ChainRecommendationBadge
 recommendation={analysis.chain_recommendation}
 isNight={isNight}
 />
 )}
 </div>
 </div>

 <div className="flex-shrink-0 flex flex-wrap sm:flex-nowrap gap-2">
 {isExpanded ? (
 <button
 onClick={() => setExpandedMarketId(null)}
 aria-label="Close expanded market view"
 className={`px-4 sm:px-6 py-3 font-light text-sm transition-all border bg-[var(--color-paper-soft)] hover:bg-white/20 text-[var(--color-ink)] border-[var(--color-rule-strong)]`}
 >
 ← Back
 </button>
 ) : (
 // Collapsed state: one primary action. Analyze is the evidence-first
 // entry point; trading actions live in the expanded view (and on the
 // order panel reachable after analysis) so cold visitors are never
 // pushed straight into an order ticket from a browse row.
 <button
 onClick={() => onAnalyze(market, "basic")}
 disabled={isAnalyzing}
 aria-label={`Analyze market: ${market.title || market.question}`}
 aria-busy={isAnalyzing && isCurrentMarket}
 className={`px-4 sm:px-6 py-3 font-medium text-sm transition-all disabled:opacity-40 border ${
 market.isMLReady
 ? "bg-accent/20 hover:bg-accent/30 text-accent border-accent/50"
 : "bg-accent/15 hover:bg-accent/25 text-accent border-accent/40"
 }`}
 >
 {isAnalyzing && isCurrentMarket ? "Analyzing..." : market.isMLReady ? "🤖 Analyze with ML" : "🔍 Analyze"}
 </button>
 )}
 </div>
 </div>

 {/* Dynamic Loading State in Expanded View */}
 {isExpanded && isAnalyzing && (
 <LoadingAnalysisState isNight={isNight} textColor={textColor} stage={analysisStage} />
 )}

 {/* Expanded Analysis View */}
 {isExpanded && analysis && (
 <div className="mt-8 pt-8 border-t border-[var(--color-rule)]">
 <h2 className={`text-2xl font-light ${textColor} mb-6`}>Analysis</h2>

 <div className="space-y-0">
 {/* SynthData ML Forecast — open section */}
 {analysis?.synthData && (
 <div className="platform-open-section">
 <div className="flex items-center gap-2 mb-4">
 <span className="text-xl">🤖</span>
 <h4 className={`text-sm font-medium ${textColor}`}>
 SynthData ML Forecast
 </h4>
 <span className={`ml-auto px-2 py-0.5 text-[10px] font-medium bg-review/15 text-review`}>
 200+ MODELS
 </span>
 </div>
 
 <div className="space-y-4">
 {/* Current Price - Large Visual Hierarchy */}
 <div className="text-center pb-3 border-b border-[var(--color-rule)]">
 <div className={`text-xs ${textColor} opacity-50 mb-1`}>{analysis.synthData.asset}</div>
 <div className={`text-4xl font-light ${textColor}`}>
 ${analysis.synthData.currentPrice?.toLocaleString()}
 </div>
 <div className={`text-xs ${textColor} opacity-40 mt-1`}>Current Price</div>
 </div>

 {/* Percentile Range with Mini Chart */}
 {analysis.synthData.percentiles?.p5 && analysis.synthData.percentiles?.p95 && (
 <div>
 <div className="flex justify-between items-end mb-2">
 <div>
 <div className={`text-xs ${textColor} opacity-50 mb-1`}>P5 (Bear)</div>
 <div className={`text-xl font-light text-breach`}>
 ${analysis.synthData.percentiles.p5.toLocaleString()}
 </div>
 </div>
 <div className="text-right">
 <div className={`text-xs ${textColor} opacity-50 mb-1`}>P95 (Bull)</div>
 <div className={`text-xl font-light text-accent`}>
 ${analysis.synthData.percentiles.p95.toLocaleString()}
 </div>
 </div>
 </div>
 
 {/* Percentile Visualization Bar */}
 <div className="relative h-2 overflow-hidden bg-gradient-to-r from-[var(--color-breach)]/20 via-[var(--color-sealed)]/20 to-[var(--color-accent)]/20">
 <div 
 className={`absolute top-0 h-full w-1 bg-white opacity-60`}
 style={{
 left: `${((analysis.synthData.currentPrice - analysis.synthData.percentiles.p5) / (analysis.synthData.percentiles.p95 - analysis.synthData.percentiles.p5)) * 100}%`
 }}
 title="Current price position"
 />
 </div>
 <div className={`text-xs ${textColor} opacity-40 text-center mt-1`}>
 Price Distribution (P5 → P95)
 </div>
 </div>
 )}
 </div>

 {analysis.synthData.polymarketEdge && (
 <div className={`mt-4 pt-4 border-t border-[var(--color-rule)]`}>
 {/* Edge Detection Summary */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <span className="text-xl">⚖️</span>
 <h5 className={`text-sm font-medium ${textColor}`}>
 Edge Analysis
 </h5>
 <InfoTip term="edge" isNight={isNight} />
 </div>
 <div className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ${
 Math.abs(analysis.synthData.polymarketEdge.edge) > 0.05
 ? 'bg-accent text-accent-ink animate-pulse'
 : 'bg-[var(--color-paper-soft)] text-[var(--color-ink-muted)]'
 }`}>
 {Math.abs(analysis.synthData.polymarketEdge.edge * 100).toFixed(1)}% {analysis.synthData.polymarketEdge.edge > 0 ? 'Undervalued' : 'Overvalued'}
 </div>
 </div>

 {/* Tug-of-War Visualizer */}
 <div className="relative h-10 mb-6 px-1">
 {/* Central Axis */}
 <div className={`absolute left-1/2 top-0 bottom-0 w-px bg-white/20 z-10`} />
 
 {/* Labels */}
 <div className="flex justify-between text-[10px] uppercase tracking-widest opacity-40 mb-1">
 <span>Market</span>
 <span>ML Fair Odds</span>
 </div>

 <div className="flex items-center h-4 w-full bg-[var(--color-paper-deep)] overflow-hidden">
 {/* Market Probability Bar (Left) */}
 <div 
 className="h-full bg-evidence/40 transition-all duration-1000"
 style={{ width: `${analysis.synthData.polymarketEdge.polymarketProb * 100}%` }}
 />
 {/* ML Probability Bar (Right - overlay or different color) */}
 <div 
 className="h-full bg-review transition-all duration-1000"
 style={{ width: `${analysis.synthData.polymarketEdge.synthFairProb * 100}%` }}
 />
 </div>

 {/* Detailed Odds Comparison */}
 <div className="flex justify-between items-center mt-2">
 <div className="flex flex-col">
 <span className={`text-[10px] ${textColor} opacity-50`}>Live Price</span>
 <span className={`text-lg font-light text-evidence`}>
 <TweenNumber value={analysis.synthData.polymarketEdge.polymarketProb * 100} format={(v) => `${v.toFixed(1)}%`} />
 </span>
 </div>

 {/* Edge Visual Indicator */}
 <div className="flex flex-col items-center">
 <div className={`text-[10px] font-bold ${
 analysis.synthData.polymarketEdge.edge > 0 
 ? 'text-accent'
 : 'text-breach'
 }`}>
 {analysis.synthData.polymarketEdge.edge > 0 ? '▲' : '▼'} {Math.abs(analysis.synthData.polymarketEdge.edge * 100).toFixed(1)}%
 </div>
 <div className={`text-[9px] uppercase opacity-40 ${textColor}`}>ML Edge</div>
 </div>

 <div className="flex flex-col text-right">
 <span className={`text-[10px] ${textColor} opacity-50`}>Fair Value</span>
 <span className={`text-lg font-light text-review`}>
 <TweenNumber value={analysis.synthData.polymarketEdge.synthFairProb * 100} format={(v) => `${v.toFixed(1)}%`} />
 </span>
 </div>
 </div>
 </div>

 {/* Edge Detection Badge - Prominent when edge exists */}
 {Math.abs(analysis.synthData.polymarketEdge.edge) > 0.03 && (
 <div className={`flex items-center gap-3 px-3 py-3 bg-accent/10 border border-accent/25`}>
 <div className="flex-shrink-0 w-8 h-8 bg-accent/15 flex items-center justify-center text-accent animate-pulse">
 ⚡
 </div>
 <div>
 <p className={`text-sm font-medium text-accent`}>
 Edge Detected: {Math.abs(analysis.synthData.polymarketEdge.edge * 100).toFixed(1)}%
 </p>
 <p className={`text-xs text-[var(--color-ink-faint)]`}>
 ML ensemble identifies {analysis.synthData.polymarketEdge.edge > 0 ? 'undervalued' : 'overvalued'} contract
 </p>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 )}

 {/* Market Context & Odds — evidence strip, not card grid */}
 <div className="evidence-strip grid grid-cols-1 gap-px bg-[var(--color-paper-soft)] sm:grid-cols-2">
 <div className="bg-[var(--color-paper)] p-4">
 <h4
 className={`text-xs font-light ${textColor} opacity-70 mb-3 uppercase tracking-wider`}
 >
 Market Odds
 </h4>
 <div className="flex justify-between items-center">
 <div className="flex flex-col">
 <span className={`text-xs ${textColor} opacity-50 mb-1`}>
 YES
 </span>
 <span
 className={`text-3xl font-light text-accent`}
 >
 {market.ask ? <TweenNumber value={market.ask * 100} format={(v) => `${v.toFixed(0)}%`} /> : "N/A"}
 </span>
 </div>
 <div className="flex flex-col text-right">
 <span className={`text-xs ${textColor} opacity-50 mb-1`}>
 NO
 </span>
 <span
 className={`text-3xl font-light text-breach`}
 >
 {market.bid ? <TweenNumber value={market.bid * 100} format={(v) => `${v.toFixed(0)}%`} /> : "N/A"}
 </span>
 </div>
 </div>
 </div>

 <div className="bg-[var(--color-paper)] p-4">
 <h4
 className={`text-xs font-light ${textColor} opacity-70 mb-3 uppercase tracking-wider`}
 >
 Weather @ {analysis.weather_conditions?.location || "Venue"}
 </h4>
 <div className="grid grid-cols-2 gap-2 text-sm">
 <div className="flex items-center gap-2">
 <span className="opacity-60">🌡️</span>
 <span className={textColor}>
 {analysis.weather_conditions?.temperature || "N/A"}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <span className="opacity-60">☁️</span>
 <span className={textColor}>
 {analysis.weather_conditions?.condition || "N/A"}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <span className="opacity-60">💨</span>
 <span className={textColor}>
 {analysis.weather_conditions?.wind || "N/A"}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <span className="opacity-60">💧</span>
 <span className={textColor}>
 {analysis.weather_conditions?.precipitation || "0%"}
 </span>
 </div>
 </div>
 </div>
 </div>

 {/* Chain Action Widget - Elevated for prominence */}
 <ChainActionWidget
 analysis={analysis}
 market={market}
 isNight={isNight}
 textColor={textColor}
 cardBgColor={cardBgColor}
 onPublishSignal={onPublishSignal}
 chains={chains}
 setShowOrderPanel={setShowOrderPanel}
 setSelectedMarketForOrder={setSelectedMarketForOrder}
 />

 {/* Analysis Text — open section */}
 <div className="platform-open-section">
 <h4
 className={`text-xs font-light ${textColor} opacity-70 mb-2 uppercase tracking-wider`}
 >
 AI Reasoning
 </h4>
 <p
 className={`text-base ${textColor} opacity-90 leading-relaxed font-light`}
 >
 {analysis.reasoning ||
 analysis.analysis ||
 "No analysis available"}
 </p>

 {/* Deep Reasoning (Thinking) Toggle */}
 {analysis.thinking && (
 <div className="mt-4 pt-4 border-t border-[var(--color-rule)]">
 <details className="group">
 <summary className="flex items-center gap-2 text-xs font-light text-review cursor-pointer hover:text-review/80 transition-colors list-none">
 <span className="group-open:rotate-180 transition-transform">▼</span>
 <span>View Deep Reasoning Process</span>
 </summary>
 <div className="mt-3 p-4 bg-[var(--color-paper-deep)] border border-review/20 text-xs font-mono text-[var(--color-ink-faint)] leading-relaxed whitespace-pre-wrap">
 {analysis.thinking}
 </div>
 </details>
 </div>
 )}
 
 {/* Analysis Factor Badges - show which analysis types were used */}
 {analysis.analysisTypes && analysis.analysisTypes.length > 0 && (
 <div className="mt-3 flex flex-wrap gap-2">
 {analysis.analysisTypes.map((type, idx) => {
 const labels = {
 fundamental: { emoji: '📊', label: 'Fundamental' },
 technical: { emoji: '📈', label: 'Technical' },
 sentiment: { emoji: '💬', label: 'Sentiment' },
 weather: { emoji: '🌤️', label: 'Weather' },
 futures: { emoji: '📅', label: 'Futures' },
 news: { emoji: '📰', label: 'News' },
 };
 const info = labels[type] || { emoji: '🔍', label: type };
 return (
 <span
 key={idx}
 className={`px-2 py-1 text-xs border ${TINT.evidenceSoft}`}
 >
 {info.emoji} {info.label}
 </span>
 );
 })}
 </div>
 )}
 </div>

 {/* Evidence & Provenance — shows data sources, confidence methodology, counter-signals */}
 <EvidenceBlock
 signal={{
 source: analysis.source || 'llm',
 confidence: analysis.assessment?.confidence || 'LOW',
 market_title: market.title || market.question,
 odds_efficiency: analysis.assessment?.odds_efficiency,
 venue: market.event_location || market.location || '',
 timestamp: Math.floor(Date.now() / 1000),
 synth_ml_percentile: analysis.synthData?.percentiles?.p50 != null
 ? Math.round(analysis.synthData.percentiles.p50)
 : null,
 event_id: market.platform === 'kalshi'
 ? `kalshi:${market.marketID || market.id}`
 : `polymarket:${market.marketID || market.id}`,
 }}
 isNight={isNight}
 textColor={textColor}
 agentBrierScore={agentBrierScore}
 calibrationScore={calibrationScore}
 className="mb-4"
 />

 {/* Recommendation — open section */}
 {analysis.recommended_action && (
 <div className="platform-open-section">
 <h4
 className={`text-xs font-light ${textColor} opacity-70 mb-2 uppercase tracking-wider`}
 >
 Recommendation
 </h4>
 <p className={`text-base font-medium ${textColor}`}>
 {analysis.recommended_action}
 </p>
 </div>
 )}

 {/* Disclaimer — open section, quiet */}
 <div className="platform-open-section">
 <div className="flex items-start gap-3">
 <div
 className={`mt-0.5 w-1 h-1 bg-white/40`}
 ></div>
 <div>
 <p
 className={`text-xs ${textColor} opacity-60 font-light leading-relaxed`}
 >
 <span className="opacity-80">
 Informational purposes only.
 </span>{" "}
 This analysis is not financial advice. Weather-based
 predictions are probabilistic and should be combined with
 your own research. Trade responsibly.
 </p>
 </div>
 </div>
 </div>

 {/* Prove Your Edge — open section */}
 <div className="platform-open-section">
 <div className="flex items-center gap-2 mb-3">
 <span className="text-xl">🎯</span>
 <h4 className={`text-sm font-medium ${textColor}`}>
 Prove Your Edge
 </h4>
 </div>
 <p
 className={`text-sm ${textColor} opacity-80 font-light leading-relaxed mb-3`}
 >
 Not ready to trade yet? Make your call anyway. Every prediction
 is recorded on-chain — timestamped, immutable, and publicly
 verifiable. Build a provable track record before risking capital.
 </p>
 <div className="grid grid-cols-1 gap-2">
 <div className="flex items-start gap-2">
 <span className={`text-xs ${textColor} opacity-60`}>✓</span>
 <p className={`text-xs ${textColor} opacity-70 font-light`}>
 <strong className="font-medium">
 Paper trade with proof
 </strong>{" "}
 - No capital needed, full accountability
 </p>
 </div>
 <div className="flex items-start gap-2">
 <span className={`text-xs ${textColor} opacity-60`}>✓</span>
 <p className={`text-xs ${textColor} opacity-70 font-light`}>
 <strong className="font-medium">
 Can’t fake your record
 </strong>{" "}
 - No backdating, no deleting bad calls
 </p>
 </div>
 <div className="flex items-start gap-2">
 <span className={`text-xs ${textColor} opacity-60`}>✓</span>
 <p className={`text-xs ${textColor} opacity-70 font-light`}>
 <strong className="font-medium">Earn as you grow</strong> -
 Top analysts earn tips from the community
 </p>
 </div>
 </div>
 </div>

 {/* Wallet Connection Prompt — open section */}
 {!canPublish && (
 <div
 className="platform-open-section flex items-center gap-3 border-l-2 border-sealed/30 pl-4"
 >
 <span className="text-2xl">🎯</span>
 <div className="flex-1">
 <p className={`text-sm ${textColor} font-medium mb-1`}>
 Connect a wallet to publish your first receipt
 </p>
 <p className={`text-xs ${textColor} opacity-70 font-light`}>
 One wallet, one signature (~2 seconds, ~$0.01). Your call is sealed
 on Arc and starts a public, verifiable track record.
 </p>
 </div>
 </div>
 )}

 {/* ML Edge Detected — workbench CTA */}
 {analysis?.synthData?.polymarketEdge && Math.abs(analysis.synthData.polymarketEdge.edge) > 0.03 && (
 <div className="platform-workbench p-5">
 <div className="flex items-center gap-3 mb-4">
 <span className="text-2xl">⚡</span>
 <div>
 <h4 className={`text-sm font-medium text-accent`}>
 ML Edge Detected
 <InfoTip term="fairProbability" isNight={isNight} className="ml-1.5" />
 </h4>
 <p className={`text-xs ${textColor} opacity-60`}>
 Fair odds: {(analysis.synthData.polymarketEdge.synthFairProb * 100).toFixed(1)}% vs Market: {(analysis.synthData.polymarketEdge.polymarketProb * 100).toFixed(1)}%
 </p>
 </div>
 </div>
 <button
 onClick={onPublishSignal}
 className={`w-full px-6 py-4 font-medium text-sm transition-all border ${
 canPublish
 ? "bg-accent/20 hover:bg-accent/30 text-accent border-accent/50"
 : "bg-sealed/15 hover:bg-sealed/25 text-sealed border-sealed/30"
 }`}
 >
 {canPublish ? "🎯 Publish My Receipt" : "🔗 Connect Wallet to Publish My Receipt"}
 </button>
 </div>
 )}

 {/* Action Buttons: Trade + Publish */}
 <div className="flex gap-3 pt-2">
 <button
 onClick={() => {
 if (isKalshi) {
 setSelectedKalshiMarket(market);
 } else {
 setSelectedMarketForOrder(market);
 setShowOrderPanel(true);
 }
 }}
 className={`flex-1 px-6 py-3 font-light text-sm transition-all border text-center ${isKalshi
 ? "bg-accent/15 hover:bg-accent/25 text-accent border-accent/35"
 : "bg-evidence/15 hover:bg-evidence/25 text-evidence border-evidence/35"
 }`}
 >
 {isKalshi ? "Trade on Kalshi ↗" : "📈 Trade Here"}
 </button>

 {/* Hide regular publish button if edge section is shown */}
 {!(analysis?.synthData?.polymarketEdge && Math.abs(analysis.synthData.polymarketEdge.edge) > 0.03) && (
 <button
 onClick={onPublishSignal}
 className={`flex-1 px-6 py-3 font-light text-sm transition-all border relative ${canPublish
 ? "bg-accent/15 hover:bg-accent/25 text-accent border-accent/35"
 : "bg-sealed/15 hover:bg-sealed/25 text-sealed border-sealed/35"
 }`}
 >
 {canPublish
 ? "🎯 Publish My Receipt"
 : "🔗 Connect & Publish My Receipt"}
 </button>
 )}

 {/* Share Button */}
 <button
 onClick={() => {
 const shareUrl = `${window.location.origin}/markets?share_id=${market.marketID || market.id}`;
 navigator.clipboard.writeText(shareUrl);
 }}
 className={`px-6 py-3 font-light text-sm transition-all border bg-[var(--color-paper-raised)] hover:bg-[var(--color-paper-soft)] text-[var(--color-ink-muted)] border-[var(--color-rule)]`}
 title="Copy shareable link"
 >
 🔗
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 {/* BottomSheet for Expanded Market Analysis */}
 <BottomSheet
 isOpen={isExpanded}
 onClose={() => setExpandedMarketId(null)}
 title={market.title || market.question}
 isNight={isNight}
 fullHeight={false}
 >
 <div className="p-6 space-y-6">
 {/* Platform Badge */}
 <span
 className={`inline-flex px-3 py-1 text-xs font-medium uppercase tracking-wider border ${isKalshi
 ? TINT.accent
 : TINT.evidence
 }`}
 >
 {isKalshi ? "Kalshi" : "Polymarket"}
 </span>

 {/* Dynamic Loading State */}
 {isAnalyzing && <LoadingAnalysisState isNight={isNight} textColor={textColor} stage={analysisStage} />}

 {/* Analysis Content */}
 {analysis && (
 <div className="space-y-4">
 {/* SynthData ML Forecast */}
 {analysis?.synthData && (
 <div className={`mc-panel border-2 border-review/30 p-5`}>
 <div className="flex items-center gap-2 mb-4">
 <span className="text-xl">🤖</span>
 <h4 className={`text-sm font-medium ${textColor}`}>SynthData ML Forecast</h4>
 <span className={`ml-auto px-2 py-0.5 text-[10px] font-medium bg-review/15 text-review`}>
 200+ MODELS
 </span>
 </div>
 <div className="text-center pb-3 border-b border-[var(--color-rule)]">
 <div className={`text-xs ${textColor} opacity-50 mb-1`}>{analysis.synthData.asset}</div>
 <div className={`text-4xl font-light ${textColor}`}>${analysis.synthData.currentPrice?.toLocaleString()}</div>
 </div>
 </div>
 )}

 {/* Market Odds */}
 <div className="grid grid-cols-2 gap-4">
 <div className={`glass-input p-4 text-center`}>
 <span className={`text-xs ${textColor} opacity-50`}>YES</span>
 <div className={`text-3xl font-light text-accent`}>
 {market.ask ? <TweenNumber value={market.ask * 100} format={(v) => `${v.toFixed(0)}%`} /> : "N/A"}
 </div>
 </div>
 <div className={`glass-input p-4 text-center`}>
 <span className={`text-xs ${textColor} opacity-50`}>NO</span>
 <div className={`text-3xl font-light text-breach`}>
 {market.bid ? <TweenNumber value={market.bid * 100} format={(v) => `${v.toFixed(0)}%`} /> : "N/A"}
 </div>
 </div>
 </div>

 {/* Data Provenance (Evidence) */}
 {analysis && (
 <div className="mt-6 pt-6 border-t border-[var(--color-rule)]">
 <h4 className={`text-xs font-light ${textColor} opacity-40 uppercase tracking-widest mb-3`}>Data Provenance</h4>
 <div className="flex flex-wrap gap-2">
 {[
 { name: 'Polymarket/Kalshi', icon: '🏦' },
 analysis.synthData ? { name: 'SynthData ML', icon: '🤖' } : null,
 analysis.weather_conditions ? { name: 'OpenMeteo', icon: '🌤' } : null,
 { name: 'Venice AI Mesh', icon: '🌐' }
 ].filter(Boolean).map((source) => (
 <div key={source.name} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-paper-raised)] border border-[var(--color-rule)]">
 <span className="text-sm">{source.icon}</span>
 <span className={`text-[10px] ${textColor} opacity-60 font-medium`}>{source.name}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 
 {/* AI Reasoning */}
 <div className={`mc-panel p-5`}>
 <h4 className={`text-xs font-light ${textColor} opacity-70 mb-2 uppercase tracking-wider`}>AI Reasoning</h4>
 <p className={`text-base ${textColor} opacity-90 leading-relaxed font-light`}>
 {analysis.reasoning || analysis.analysis || "No analysis available"}
 </p>

 {/* Deep Reasoning (Thinking) Toggle */}
 {analysis.thinking && (
 <div className="mt-4 pt-4 border-t border-[var(--color-rule)]">
 <details className="group">
 <summary className="flex items-center gap-2 text-xs font-light text-review cursor-pointer hover:text-review/80 transition-colors list-none">
 <span className="group-open:rotate-180 transition-transform">▼</span>
 <span>View Deep Reasoning Process</span>
 </summary>
 <div className="mt-3 p-4 bg-[var(--color-paper-deep)] border border-review/20 text-xs font-mono text-[var(--color-ink-faint)] leading-relaxed whitespace-pre-wrap">
 {analysis.thinking}
 </div>
 </details>
 </div>
 )}
 </div>

 {/* Action Buttons */}
 <div className="flex gap-3 pt-2">
 <button
 onClick={() => {
 if (isKalshi) {
 setSelectedKalshiMarket(market);
 } else {
 setSelectedMarketForOrder(market);
 setShowOrderPanel(true);
 }
 }}
 className={`flex-1 px-6 py-3 font-light text-sm transition-all border text-center ${isKalshi
 ? "bg-accent/15 hover:bg-accent/25 text-accent border-accent/35"
 : "bg-evidence/15 hover:bg-evidence/25 text-evidence border-evidence/35"
 }`}
 >
 {isKalshi ? "Trade on Kalshi ↗" : "📈 Trade Here"}
 </button>
 <button
 onClick={onPublishSignal}
 className={`flex-1 px-6 py-3 font-light text-sm transition-all border ${canPublish
 ? "bg-accent/15 hover:bg-accent/25 text-accent border-accent/35"
 : "bg-sealed/15 hover:bg-sealed/25 text-sealed border-sealed/35"
 }`}
 >
 {canPublish ? "🎯 Publish My Receipt" : "🔗 Connect & Publish My Receipt"}
 </button>
 </div>
 </div>
 )}
 </div>
 </BottomSheet>
 </>
 );
}

// Dynamic Loading State Component
// Dynamic Loading State Component
export function LoadingAnalysisState({ isNight, textColor, webIntelAvailable = false, stage = 0 }) {
 const webIntel = useBrightDataStatus();
 const useWeb = webIntelAvailable || webIntel.available;

 const steps = useWeb
 ? [
 {
 icon: "◆",
 text: "Searching live web sources",
 sub: "Optional deep scrape enrichment",
 },
 {
 icon: "◎",
 text: "Reading top sources",
 sub: "Pulling evidence for this market",
 },
 {
 icon: "◇",
 text: "AI synthesizing evidence",
 sub: "Estimating a fair probability",
 },
 {
 icon: "▣",
 text: "Detecting market edge",
 sub: "Comparing fair value to live odds",
 },
 ]
 : [
 {
 icon: "◇",
 text: "Reading market context",
 sub: "Odds, volume, and related history",
 },
 {
 icon: "◎",
 text: "AI estimating fair odds",
 sub: "Reasoning over available intelligence",
 },
 {
 icon: "▣",
 text: "Detecting market edge",
 sub: "Fair value vs current market price",
 },
 {
 icon: "→",
 text: "Sizing the call",
 sub: "Direction, confidence, and risk cues",
 },
 ];

 const step = Math.min(Math.max(stage, 0), steps.length - 1);

 return (
 <div 
 className="fc-analysis-rail mt-8 pt-8"
 role="status"
 aria-live="polite"
 aria-label="Analyzing market"
 >
 <div className="fc-analysis-rail__head">
 <div>
 <p className="fc-kicker">Evidence pipeline</p>
 <p className="mt-2 text-base font-medium text-[var(--color-ink)]">No recommendation until the record is assembled.</p>
 </div>
 <span className="fc-status fc-status--positive px-2 py-1">in progress</span>
 </div>
 <ol className="fc-analysis-rail__steps">
 {steps.map((item, index) => {
 const complete = index < step;
 const current = index === step;
 return (
 <li key={item.text} className={`${complete ? 'is-complete' : ''} ${current ? 'is-current' : ''}`}>
 <span className="fc-analysis-rail__index">{complete ? '✓' : String(index + 1).padStart(2, '0')}</span>
 <div>
 <p>{item.text}</p>
 <span>{item.sub}</span>
 </div>
 {current && <span className="fc-analysis-rail__active" aria-label="Current analysis stage" />}
 </li>
 );
 })}
 </ol>
 <p className="fc-analysis-rail__note">Fair probability, edge, and sizing appear only after this pipeline completes.</p>
 </div>
 );
}
