'use client';

import React, { useState, useEffect } from "react";
import { useChainConnections } from "@/hooks/useChainConnections";
import { CHAINS } from "@/constants/appConstants";
import BottomSheet from "@/components/BottomSheet";
import GlassPanel from "@/components/ui/GlassPanel";
import EvidenceBlock from "@/components/EvidenceBlock";
import TweenNumber from "@/components/motion/TweenNumber";
import EduWait from "@/components/EduWait";
import useChangeFlash from "@/hooks/useChangeFlash";
import { AnalysisTrace } from "./AnalysisTrace";
import PercentileChart from "@/components/charts/PercentileChart";

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

 const publishButtonText = shouldTrade ? "Also publish" : "Publish";
 const tradeButtonText = shouldPublish ? "Also trade" : "Trade";

 const renderChainAction = (chainDef, chainState, isPrimary, buttonText, actionFn, needsNetworkSwitch = false, onSwitchNetwork = null) => {
 const isDisabled = !chainState.connected || needsNetworkSwitch;
 const buttonLabel = !chainState.connected
 ? `Connect ${chainDef.name}`
 : needsNetworkSwitch
 ? `Switch network`
 : buttonText;

 return (
 <div className={`flex items-center gap-3 border-b border-[var(--color-rule)] last:border-0 ${isPrimary ? "bg-[var(--color-wash-soft)]" : ""} px-3 py-2.5`}>
 <span className="text-lg flex-shrink-0" aria-hidden>{chainDef.icon}</span>
 <div className="flex-1 min-w-0">
 <h5 className={`text-sm font-medium ${textColor}`}>
 {chainDef.display}
 {isPrimary && <span className="ml-2 text-[10px] text-[var(--color-sealed)]">recommended</span>}
 </h5>
 </div>
 <button
 onClick={() => {
 if (needsNetworkSwitch && onSwitchNetwork) {
 onSwitchNetwork();
 } else if (chainState.connected) {
 actionFn();
 }
 }}
 disabled={isDisabled}
 className={`shrink-0 px-3 py-1.5 text-xs font-light transition-all border ${!isDisabled
 ? `${chainDef.color === 'purple'
 ? `${TINT.review} hover:bg-review/25`
 : `${TINT.evidence} hover:bg-evidence/25`}`
 : "opacity-50 cursor-not-allowed"
 }`}
 >
 {buttonLabel}
 </button>
 </div>
 );
 };

 return (
 <div className={`${cardBgColor} border p-4`}>
 <h4 className={`text-[10px] font-light ${textColor} opacity-70 mb-2 uppercase tracking-wider`}>
 Act
 </h4>
 <div className="space-y-0">
 {shouldPublish && renderChainAction(
 CHAINS.ARC,
 chains.arc,
 rec === "PUBLISH",
 publishButtonText,
 () => {
 if (chains.arc.connected) onPublishSignal(market, analysis);
 },
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
 !chains.evm.isCorrectNetwork,
 !chains.evm.isCorrectNetwork ? () => switchToEvmNetwork('polygon') : null
 )
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
 <GlassPanel className="p-4">
 <MarketCard {...marketCardProps} />
 </GlassPanel>
 </div>
 );
}

/**
 * DenseAnalysisPanel — venue-voice analysis body shared by desktop expand + sheet.
 * Act-first: odds + edge + Act widget; reasoning one tap away.
 */
function DenseAnalysisPanel({
 market,
 analysis,
 isNight,
 textColor,
 cardBgColor,
 onPublishSignal,
 chains,
 canPublish,
 setShowOrderPanel,
 setSelectedMarketForOrder,
 setSelectedKalshiMarket,
 agentBrierScore,
 calibrationScore,
 compact = false,
}) {
 const isKalshi = (market.platform || "polymarket") === "kalshi";
 const edge = analysis?.synthData?.polymarketEdge;
 const edgePct = edge != null ? Math.abs(edge.edge * 100) : null;
 const hasEdge = edgePct != null && edgePct > 3;
 const reasoning = analysis.reasoning || analysis.analysis || null;

 return (
 <div className={compact ? "space-y-4" : "mt-6 space-y-4 border-t border-[var(--color-rule)] pt-6"}>
 <div className="evidence-strip grid grid-cols-2 gap-px bg-[var(--color-paper-soft)] sm:grid-cols-4">
 <div className="bg-[var(--color-paper)] p-3">
 <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)] mb-1">YES</div>
 <div className="font-mono text-2xl text-[var(--color-accent)] tabular-nums">
 {market.ask != null ? <TweenNumber value={market.ask * 100} format={(v) => `${v.toFixed(0)}%`} /> : "—"}
 </div>
 </div>
 <div className="bg-[var(--color-paper)] p-3">
 <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)] mb-1">NO</div>
 <div className="font-mono text-2xl text-[var(--color-breach)] tabular-nums">
 {market.bid != null ? <TweenNumber value={market.bid * 100} format={(v) => `${v.toFixed(0)}%`} /> : "—"}
 </div>
 </div>
 <div className="bg-[var(--color-paper)] p-3">
 <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)] mb-1">Fair</div>
 <div className="font-mono text-2xl text-[var(--color-review)] tabular-nums">
 {edge ? <TweenNumber value={edge.synthFairProb * 100} format={(v) => `${v.toFixed(0)}%`} /> : "—"}
 </div>
 </div>
 <div className={`bg-[var(--color-paper)] p-3 ${hasEdge ? "fc-live-rail" : ""}`}>
 <div className={`text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)] mb-1 ${hasEdge ? "pl-2" : ""}`}>Edge</div>
 <div className={`font-mono text-2xl tabular-nums ${hasEdge ? "pl-2 text-[var(--color-accent)]" : "text-[var(--color-ink-faint)]"}`}>
 {edgePct != null ? `${edge?.edge > 0 ? "+" : "−"}${edgePct.toFixed(1)}%` : "—"}
 </div>
 </div>
 </div>

 {analysis.recommended_action && (
 <p className="text-sm font-medium text-[var(--color-ink)]">
 {analysis.recommended_action}
 </p>
 )}

 {/* Insight card — ML forecast distribution (recharts; replaces the
 deferred liveline carousel). Renders only when SynthData percentiles
 are present. */}
 {analysis.synthData?.percentiles?.raw && (
 <PercentileChart synthData={analysis.synthData} />
 )}

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

 {reasoning && (
   <AnalysisTrace
     analysis={analysis}
     market={market}
   />
 )}

 <EvidenceBlock
 signal={{
 source: analysis.source || "llm",
 confidence: analysis.assessment?.confidence || "LOW",
 market_title: market.title || market.question,
 odds_efficiency: analysis.assessment?.odds_efficiency,
 venue: market.event_location || market.location || "",
 timestamp: Math.floor(Date.now() / 1000),
 synth_ml_percentile: analysis.synthData?.percentiles?.p50 != null
 ? Math.round(analysis.synthData.percentiles.p50)
 : null,
 event_id: isKalshi
 ? `kalshi:${market.marketID || market.id}`
 : `polymarket:${market.marketID || market.id}`,
 }}
 isNight={isNight}
 textColor={textColor}
 agentBrierScore={agentBrierScore}
 calibrationScore={calibrationScore}
 />

 {!canPublish && (
 <p className="border-l-2 border-[var(--color-sealed)]/40 pl-3 text-xs text-[var(--color-ink-muted)]">
 Connect wallet to publish a receipt.
 </p>
 )}

 <div className="flex flex-wrap gap-2 pt-1">
 <button
 type="button"
 onClick={() => {
 if (isKalshi) {
 setSelectedKalshiMarket(market);
 } else {
 setSelectedMarketForOrder(market);
 setShowOrderPanel(true);
 }
 }}
 className="fc-action flex-1 px-4 py-2.5 text-sm"
 >
 {isKalshi ? "Trade on Kalshi" : "Trade"}
 </button>
 <button
 type="button"
 onClick={onPublishSignal}
 className={`flex-1 border px-4 py-2.5 text-sm transition-colors ${
 canPublish
 ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
 : "border-[var(--color-sealed)]/35 bg-[var(--color-sealed)]/10 text-[var(--color-sealed)]"
 }`}
 >
 {canPublish ? "Publish" : "Connect & publish"}
 </button>
 <button
 type="button"
 onClick={() => {
 const shareUrl = `${window.location.origin}/markets?share_id=${market.marketID || market.id}`;
 navigator.clipboard.writeText(shareUrl);
 }}
 className="border border-[var(--color-rule)] px-3 py-2.5 text-xs text-[var(--color-ink-muted)] hover:border-[var(--color-rule-strong)] hover:text-[var(--color-ink)]"
 title="Copy link"
 >
 Share
 </button>
 </div>
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

 // Sheet only below sm — desktop expands inline so the modal never doubles up.
 const [sheetMode, setSheetMode] = useState(false);
 useEffect(() => {
 if (typeof window === "undefined") return undefined;
 const mq = window.matchMedia("(max-width: 639px)");
 const sync = () => setSheetMode(mq.matches);
 sync();
 mq.addEventListener("change", sync);
 return () => mq.removeEventListener("change", sync);
 }, []);

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
 ML Ready
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
 ML
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
 Weather
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
 Analyze
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
 Publish My Receipt
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
 {isAnalyzing && isCurrentMarket ? "Fair odds…" : market.isMLReady ? "Analyze" : "Analyze"}
 </button>
 )}
 </div>
 </div>

 {/* Desktop expand — hidden on small screens (sheet handles those). */}
 <div className="hidden sm:block">
 {isExpanded && isAnalyzing && (
 <LoadingAnalysisState isNight={isNight} textColor={textColor} stage={analysisStage} />
 )}
 {isExpanded && analysis && (
 <DenseAnalysisPanel
 market={market}
 analysis={analysis}
 isNight={isNight}
 textColor={textColor}
 cardBgColor={cardBgColor}
 onPublishSignal={onPublishSignal}
 chains={chains}
 canPublish={canPublish}
 setShowOrderPanel={setShowOrderPanel}
 setSelectedMarketForOrder={setSelectedMarketForOrder}
 setSelectedKalshiMarket={setSelectedKalshiMarket}
 agentBrierScore={agentBrierScore}
 calibrationScore={calibrationScore}
 />
 )}
 </div>
 </div>
 {/* Mobile sheet — same dense panel; desktop uses inline expand above. */}
 <BottomSheet
 isOpen={isExpanded && sheetMode}
 onClose={() => setExpandedMarketId(null)}
 title={market.title || market.question}
 isNight={isNight}
 fullHeight={false}
 >
 <div className="space-y-4 p-4">
 <span
 className={`inline-flex px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border ${isKalshi
 ? TINT.accent
 : TINT.evidence
 }`}
 >
 {isKalshi ? "Kalshi" : "Polymarket"}
 </span>
 {isAnalyzing && <LoadingAnalysisState isNight={isNight} textColor={textColor} stage={analysisStage} />}
 {analysis && (
 <DenseAnalysisPanel
 market={market}
 analysis={analysis}
 isNight={isNight}
 textColor={textColor}
 cardBgColor={cardBgColor}
 onPublishSignal={onPublishSignal}
 chains={chains}
 canPublish={canPublish}
 setShowOrderPanel={setShowOrderPanel}
 setSelectedMarketForOrder={setSelectedMarketForOrder}
 setSelectedKalshiMarket={setSelectedKalshiMarket}
 agentBrierScore={agentBrierScore}
 calibrationScore={calibrationScore}
 compact
 />
 )}
 </div>
 </BottomSheet>
 </>
 );
}

/** One-line educational wait while analysis streams — stage advances the line. */
const ANALYSIS_EDU_LINES = [
 "Reading market context",
 "Estimating fair odds",
 "Fair odds vs market",
 "Sizing the call",
];

export function LoadingAnalysisState({ stage = 0 }) {
 const step = Math.min(Math.max(stage, 0), ANALYSIS_EDU_LINES.length - 1);
 const line = ANALYSIS_EDU_LINES[step];

 return (
 <div className="mt-6" role="status" aria-live="polite" aria-label="Analyzing market">
 <EduWait active delayMs={200} line={line} className="fc-edu-wait--block" />
 </div>
 );
}
