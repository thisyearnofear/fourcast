'use client';

import React, { useState, useEffect } from "react";
import { useChainConnections } from "@/hooks/useChainConnections";
import { CHAINS } from "@/constants/appConstants";
import { getRecommendationExplanation } from "@/utils/chainUtils";
import BottomSheet from "@/components/BottomSheet";
import EvidenceBlock from "@/components/EvidenceBlock";
import InfoTip from "@/components/InfoTip";
import { useBrightDataStatus } from "@/hooks/useBrightDataStatus";

export function ChainRecommendationBadge({ recommendation, isNight }) {
 const config = {
 PUBLISH: {
 icon: "◆",
 text: "Make Your Call",
 color: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30"
 },
 TRADE: {
 icon: "▣",
 text: "Place Order",
 color: "bg-teal-500/20 text-teal-200 border-teal-500/30"
 },
 BOTH: {
 icon: "◇",
 text: "Call It & Trade",
 color: "bg-amber-500/20 text-amber-200 border-amber-500/30"
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

 const publishButtonText = shouldTrade ? "Also Make Your Call" : "Make Your Call";
 const tradeButtonText = shouldPublish ? "Also Trade" : "Place Order";

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
 <div className={`flex items-start gap-3 pb-3 border-b border-white/10 last:pb-0 last:border-0 ${isPrimary ? ("bg-gradient-to-r from-purple-500/5 to-transparent") : ""
 } px-3 py-2`}>
 <span className="text-xl flex-shrink-0">{chainDef.icon}</span>
 <div className="flex-1">
 <h5 className={`text-sm font-medium ${textColor} mb-1`}>
 {chainDef.display}
 {isPrimary && <span className={`ml-2 text-xs opacity-60 text-amber-300`}>← Recommended</span>}
 </h5>
 <p className={`text-xs ${textColor} opacity-60 mb-3 leading-relaxed`}>
 {contextMsg}
 </p>
 {needsNetworkSwitch && chainState.currentNetwork && (
 <p className={`text-xs mb-2 text-amber-300/70`}>
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
 className={`px-4 py-2 text-xs font-light transition-all ${!isDisabled
 ? `${chainDef.color === 'purple'
 ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30'
 : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'}`
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
 <div className={`mb-3 p-3 bg-white/5 border border-white/10`}>
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
 "Paper trade with proof — every call is timestamped on Arc, immutable, and publicly verifiable"
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
 <div className={`mt-4 p-3 bg-green-500/10 border border-green-500/20`}>
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
 ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/50"
 : "bg-blue-900/40 text-blue-300 border-blue-700/50"
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

 {/* Market Odds Summary - NEW: Shows odds on the card! */}
 {!isExpanded && (
 <div className="fc-market-row__prices flex items-center gap-2 py-3">
 <button 
 onClick={(e) => {
 e.stopPropagation();
 if (isKalshi) {
 setSelectedKalshiMarket(market);
 } else {
 setOrderSide("YES");
 setSelectedMarketForOrder(market);
 setShowOrderPanel(true);
 }
 }}
 className="fc-market-price fc-market-price--yes flex items-center gap-2 px-3 py-2"
 >
 <span className={`text-[10px] font-medium text-green-400/70`}>YES</span>
 <span className={`text-sm font-light ${textColor}`}>
 {market.ask ? `${(market.ask * 100).toFixed(0)}%` : "—"}
 </span>
 </button>
 <button 
 onClick={(e) => {
 e.stopPropagation();
 if (isKalshi) {
 setSelectedKalshiMarket(market);
 } else {
 setOrderSide("NO");
 setSelectedMarketForOrder(market);
 setShowOrderPanel(true);
 }
 }}
 className="fc-market-price fc-market-price--no flex items-center gap-2 px-3 py-2"
 >
 <span className={`text-[10px] font-medium text-red-400/70`}>NO</span>
 <span className={`text-sm font-light ${textColor}`}>
 {market.bid ? `${(market.bid * 100).toFixed(0)}%` : "—"}
 </span>
 </button>
 {/* ML Edge Preview (if analyzed) */}
 {isCurrentMarket && analysis?.synthData?.polymarketEdge && (
 <div className="fc-edge-readout ml-auto flex items-center gap-1.5 px-3 py-2">
 <span className={`text-[10px] font-mono font-bold text-emerald-200`}>
 {Math.abs(analysis.synthData.polymarketEdge.edge * 100).toFixed(1)}% EDGE
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
 className={`px-3 py-1 font-medium border cursor-help bg-purple-500/20 text-purple-200 border-purple-400/30`}
 >
 🤖 ML Ready
 </span>
 <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 bg-gray-900 text-white border border-white/20`}>
 Quantitative analysis available via SynthData
 <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-gray-900 border-r border-b border-white/20`}></div>
 </div>
 </div>
 )}

 {/* Synth ML Badge - Show when analysis uses SynthData */}
 {isCurrentMarket && analysis?.source && (analysis.source === 'synthdata+llm' || analysis.source === 'synthdata+path') && (
 <div className="relative group">
 <span
 className={`px-3 py-1 font-medium border cursor-help bg-purple-500/20 text-purple-200 border-purple-400/30`}
 >
 🤖 ML
 </span>
 <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 bg-gray-900 text-white border border-white/20`}>
 {analysis.source === 'synthdata+path' ? 'Path-dependent ML analysis' : 'SynthData 200+ ML models'}
 <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-gray-900 border-r border-b border-white/20`}></div>
 </div>
 </div>
 )}
 {market.volume24h !== undefined && (
 <div className="relative group">
 <span
 className={`px-3 py-1 font-light border cursor-help bg-orange-500/10 text-orange-200 border-orange-500/20`}
 >
 ⚡{" "}
 {isKalshi
 ? `${market.volume24h} Vol`
 : `$${(market.volume24h / 1000).toFixed(0)}K`}
 </span>
 {/* Tooltip */}
 <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 bg-gray-900 text-white border border-white/20`}>
 24-hour trading volume
 <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-gray-900 border-r border-b border-white/20`}></div>
 </div>
 </div>
 )}
 {market.confidence && (
 <div className="relative group">
 <span
 className={`px-3 py-1 font-light border cursor-help ${market.confidence === "HIGH"
 ? "bg-green-500/20 text-green-300 border-green-500/30"
 : market.confidence === "MEDIUM"
 ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
 : "bg-red-500/20 text-red-300 border-red-500/30"
 }`}
 >
 {market.confidence}
 </span>
 {/* Tooltip */}
 <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 bg-gray-900 text-white border border-white/20`}>
 {market.confidence === 'HIGH' ? 'High confidence prediction' : market.confidence === 'MEDIUM' ? 'Medium confidence prediction' : 'Low confidence prediction'}
 <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-gray-900 border-r border-b border-white/20`}></div>
 </div>
 </div>
 )}
 {/* Weather Impact Indicator - Show if event has location data */}
 {market.event_location && (
 <div className="relative group">
 <span
 className={`px-3 py-1 font-light border cursor-help bg-cyan-500/20 text-cyan-300 border-cyan-500/30`}
 >
 🌤️ Weather
 </span>
 <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 bg-gray-900 text-white border border-white/20`}>
 Event location: {market.event_location}
 <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-gray-900 border-r border-b border-white/20`}></div>
 </div>
 </div>
 )}
 {/* AI-Ready Badge - Indicates market can be analyzed */}
 {!isCurrentMarket && !analysis && (
 <span
 className={`px-3 py-1 font-light border bg-purple-500/10 text-purple-300/60 border-purple-500/20`}
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
 className={`px-3 py-1 font-medium border transition-all hover:scale-105 bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30`}
 >
 🎯 Make Your Call
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
 className={`px-4 sm:px-6 py-3 font-light text-sm transition-all border bg-white/10 hover:bg-white/20 text-white border-white/20`}
 >
 ← Back
 </button>
 ) : (
 <>
 <button
 onClick={() => {
 if (isKalshi) {
 setSelectedKalshiMarket(market);
 } else {
 setSelectedMarketForOrder(market);
 setShowOrderPanel(true);
 }
 }}
 aria-label={`${isKalshi ? 'Trade' : 'Place bet'} on ${market.title || market.question}`}
 className={`px-4 sm:px-5 py-3 font-light text-sm transition-all hover:scale-105 border ${
 isKalshi
 ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-400/30"
 : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border-blue-400/30"
 }`}
 >
 {isKalshi ? "Trade ↗" : "📈 Bet"}
 </button>
 <button
 onClick={() => onAnalyze(market, "basic")}
 disabled={isAnalyzing}
 aria-label={`Analyze market: ${market.title || market.question}`}
 aria-busy={isAnalyzing && isCurrentMarket}
 className={`px-4 sm:px-6 py-3 font-light text-sm transition-all disabled:opacity-40 hover:scale-105 border ${
 market.isMLReady
 ? "bg-gradient-to-r from-purple-600/40 to-pink-600/40 hover:from-purple-600/60 hover:to-pink-600/60 text-white border-purple-400/50 shadow-lg shadow-purple-500/20"
 : "bg-white/10 hover:bg-white/20 text-white border-white/20"
 }`}
 >
 {isAnalyzing && isCurrentMarket ? "Analyzing..." : market.isMLReady ? "🤖 ML Analyze" : "🔍 Analyze"}
 </button>
 </>
 )}
 </div>
 </div>

 {/* Dynamic Loading State in Expanded View */}
 {isExpanded && isAnalyzing && (
 <LoadingAnalysisState isNight={isNight} textColor={textColor} stage={analysisStage} />
 )}

 {/* Expanded Analysis View */}
 {isExpanded && analysis && (
 <div className="mt-8 pt-8 border-t border-white/10">
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
 <span className={`ml-auto px-2 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300`}>
 200+ MODELS
 </span>
 </div>
 
 <div className="space-y-4">
 {/* Current Price - Large Visual Hierarchy */}
 <div className="text-center pb-3 border-b border-white/10">
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
 <div className={`text-xl font-light text-red-400`}>
 ${analysis.synthData.percentiles.p5.toLocaleString()}
 </div>
 </div>
 <div className="text-right">
 <div className={`text-xs ${textColor} opacity-50 mb-1`}>P95 (Bull)</div>
 <div className={`text-xl font-light text-green-400`}>
 ${analysis.synthData.percentiles.p95.toLocaleString()}
 </div>
 </div>
 </div>
 
 {/* Percentile Visualization Bar */}
 <div className="relative h-2 overflow-hidden bg-gradient-to-r from-red-500/20 via-yellow-500/20 to-green-500/20">
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
 <div className={`mt-4 pt-4 border-t border-white/10`}>
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
 ? 'bg-green-500 text-white animate-pulse'
 : 'bg-white/10 text-white/70'
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

 <div className="flex items-center h-4 w-full bg-black/20 overflow-hidden">
 {/* Market Probability Bar (Left) */}
 <div 
 className="h-full bg-blue-500/40 transition-all duration-1000"
 style={{ width: `${analysis.synthData.polymarketEdge.polymarketProb * 100}%` }}
 />
 {/* ML Probability Bar (Right - overlay or different color) */}
 <div 
 className="h-full bg-purple-500 transition-all duration-1000"
 style={{ width: `${analysis.synthData.polymarketEdge.synthFairProb * 100}%` }}
 />
 </div>

 {/* Detailed Odds Comparison */}
 <div className="flex justify-between items-center mt-2">
 <div className="flex flex-col">
 <span className={`text-[10px] ${textColor} opacity-50`}>Live Price</span>
 <span className={`text-lg font-light text-blue-300`}>
 {(analysis.synthData.polymarketEdge.polymarketProb * 100).toFixed(1)}%
 </span>
 </div>

 {/* Edge Visual Indicator */}
 <div className="flex flex-col items-center">
 <div className={`text-[10px] font-bold ${
 analysis.synthData.polymarketEdge.edge > 0 
 ? 'text-green-400'
 : 'text-red-400'
 }`}>
 {analysis.synthData.polymarketEdge.edge > 0 ? '▲' : '▼'} {Math.abs(analysis.synthData.polymarketEdge.edge * 100).toFixed(1)}%
 </div>
 <div className={`text-[9px] uppercase opacity-40 ${textColor}`}>ML Edge</div>
 </div>

 <div className="flex flex-col text-right">
 <span className={`text-[10px] ${textColor} opacity-50`}>Fair Value</span>
 <span className={`text-lg font-light text-purple-300`}>
 {(analysis.synthData.polymarketEdge.synthFairProb * 100).toFixed(1)}%
 </span>
 </div>
 </div>
 </div>

 {/* Edge Detection Badge - Prominent when edge exists */}
 {Math.abs(analysis.synthData.polymarketEdge.edge) > 0.03 && (
 <div className={`flex items-center gap-3 px-3 py-3 bg-green-500/10 border border-green-500/20 shadow-lg shadow-green-500/5`}>
 <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 flex items-center justify-center text-green-500 animate-pulse">
 ⚡
 </div>
 <div>
 <p className={`text-sm font-medium text-green-400`}>
 Edge Detected: {Math.abs(analysis.synthData.polymarketEdge.edge * 100).toFixed(1)}%
 </p>
 <p className={`text-xs text-white/50`}>
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
 <div className="evidence-strip grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-2">
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
 className={`text-3xl font-light text-green-400`}
 >
 {market.ask ? `${(market.ask * 100).toFixed(0)}%` : "N/A"}
 </span>
 </div>
 <div className="flex flex-col text-right">
 <span className={`text-xs ${textColor} opacity-50 mb-1`}>
 NO
 </span>
 <span
 className={`text-3xl font-light text-red-400`}
 >
 {market.bid ? `${(market.bid * 100).toFixed(0)}%` : "N/A"}
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
 <div className="mt-4 pt-4 border-t border-white/5">
 <details className="group">
 <summary className="flex items-center gap-2 text-xs font-light text-purple-400 cursor-pointer hover:text-purple-300 transition-colors list-none">
 <span className="group-open:rotate-180 transition-transform">▼</span>
 <span>View Deep Reasoning Process</span>
 </summary>
 <div className="mt-3 p-4 bg-black/40 border border-purple-500/10 text-xs font-mono text-white/50 leading-relaxed whitespace-pre-wrap">
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
 className={`px-2 py-1 text-xs border bg-blue-500/10 border-blue-500/20 text-blue-300`}
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
 className="platform-open-section flex items-center gap-3 border-l-2 border-orange-400/30 pl-4"
 >
 <span className="text-2xl">🎯</span>
 <div className="flex-1">
 <p className={`text-sm ${textColor} font-medium mb-1`}>
 Connect wallet to start your track record
 </p>
 <p className={`text-xs ${textColor} opacity-70 font-light`}>
 Connect wallet — Arc (USDC) to publish
 and start building a verifiable prediction history
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
 <h4 className={`text-sm font-medium text-green-400`}>
 ML Edge Detected
 </h4>
 <p className={`text-xs ${textColor} opacity-60`}>
 Fair odds: {(analysis.synthData.polymarketEdge.synthFairProb * 100).toFixed(1)}% vs Market: {(analysis.synthData.polymarketEdge.polymarketProb * 100).toFixed(1)}%
 </p>
 </div>
 </div>
 <button
 onClick={onPublishSignal}
 className={`w-full px-6 py-4 font-medium text-sm transition-all ${
 canPublish
 ? "bg-green-500/30 hover:bg-green-500/40 text-green-200 border border-green-500/50"
 : "bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/30"
 }`}
 >
 {canPublish ? "🎯 Publish Signal Now" : "🔗 Connect Wallet to Publish"}
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
 ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-400/30"
 : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border-blue-400/30"
 }`}
 >
 {isKalshi ? "Trade on Kalshi ↗" : "📈 Trade Here"}
 </button>

 {/* Hide regular publish button if edge section is shown */}
 {!(analysis?.synthData?.polymarketEdge && Math.abs(analysis.synthData.polymarketEdge.edge) > 0.03) && (
 <button
 onClick={onPublishSignal}
 className={`flex-1 px-6 py-3 font-light text-sm transition-all border relative ${canPublish
 ? "bg-green-500/20 hover:bg-green-500/30 text-green-200 border-green-400/30"
 : "bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border-orange-400/30"
 }`}
 >
 {canPublish
 ? "🎯 Make Your Call"
 : "🔗 Connect & Make Your Call"}
 </button>
 )}

 {/* Share Button */}
 <button
 onClick={() => {
 const shareUrl = `${window.location.origin}/markets?share_id=${market.marketID || market.id}`;
 navigator.clipboard.writeText(shareUrl);
 }}
 className={`px-6 py-3 font-light text-sm transition-all border bg-white/5 hover:bg-white/10 text-white/70 border-white/10`}
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
 ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/50"
 : "bg-blue-900/40 text-blue-300 border-blue-700/50"
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
 <div className={`mc-panel border-2 border-purple-500/30 p-5`}>
 <div className="flex items-center gap-2 mb-4">
 <span className="text-xl">🤖</span>
 <h4 className={`text-sm font-medium ${textColor}`}>SynthData ML Forecast</h4>
 <span className={`ml-auto px-2 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300`}>
 200+ MODELS
 </span>
 </div>
 <div className="text-center pb-3 border-b border-white/10">
 <div className={`text-xs ${textColor} opacity-50 mb-1`}>{analysis.synthData.asset}</div>
 <div className={`text-4xl font-light ${textColor}`}>${analysis.synthData.currentPrice?.toLocaleString()}</div>
 </div>
 </div>
 )}

 {/* Market Odds */}
 <div className="grid grid-cols-2 gap-4">
 <div className={`glass-input p-4 text-center`}>
 <span className={`text-xs ${textColor} opacity-50`}>YES</span>
 <div className={`text-3xl font-light text-green-400`}>
 {market.ask ? `${(market.ask * 100).toFixed(0)}%` : "N/A"}
 </div>
 </div>
 <div className={`glass-input p-4 text-center`}>
 <span className={`text-xs ${textColor} opacity-50`}>NO</span>
 <div className={`text-3xl font-light text-red-400`}>
 {market.bid ? `${(market.bid * 100).toFixed(0)}%` : "N/A"}
 </div>
 </div>
 </div>

 {/* Data Provenance (Evidence) */}
 {analysis && (
 <div className="mt-6 pt-6 border-t border-white/10">
 <h4 className={`text-xs font-light ${textColor} opacity-40 uppercase tracking-widest mb-3`}>Data Provenance</h4>
 <div className="flex flex-wrap gap-2">
 {[
 { name: 'Polymarket/Kalshi', icon: '🏦' },
 analysis.synthData ? { name: 'SynthData ML', icon: '🤖' } : null,
 analysis.weather_conditions ? { name: 'OpenMeteo', icon: '🌤' } : null,
 { name: 'Venice AI Mesh', icon: '🌐' }
 ].filter(Boolean).map((source) => (
 <div key={source.name} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10">
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
 <div className="mt-4 pt-4 border-t border-white/5">
 <details className="group">
 <summary className="flex items-center gap-2 text-xs font-light text-purple-400 cursor-pointer hover:text-purple-300 transition-colors list-none">
 <span className="group-open:rotate-180 transition-transform">▼</span>
 <span>View Deep Reasoning Process</span>
 </summary>
 <div className="mt-3 p-4 bg-black/40 border border-purple-500/10 text-xs font-mono text-white/50 leading-relaxed whitespace-pre-wrap">
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
 ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-400/30"
 : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border-blue-400/30"
 }`}
 >
 {isKalshi ? "Trade on Kalshi ↗" : "📈 Trade Here"}
 </button>
 <button
 onClick={onPublishSignal}
 className={`flex-1 px-6 py-3 font-light text-sm transition-all border ${canPublish
 ? "bg-green-500/20 hover:bg-green-500/30 text-green-200 border-green-400/30"
 : "bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border-orange-400/30"
 }`}
 >
 {canPublish ? "🎯 Make Your Call" : "🔗 Connect & Make Your Call"}
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
 <p className="mt-2 text-base font-medium text-white">No recommendation until the record is assembled.</p>
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
