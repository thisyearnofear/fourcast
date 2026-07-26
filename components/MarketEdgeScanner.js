'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const Magnify = dynamic(() => import('@/components/canvasui/Magnify'), {
  loading: () => (
    <div className="h-24 bg-[var(--color-paper-raised)] border border-[var(--color-rule)] animate-pulse" />
  ),
  ssr: false,
});

/**
 * Market Edge Scanner
 * Identifies and highlights markets with significant ML-derived edges
 */
export function MarketEdgeScanner(props) {
  return (
    <ErrorBoundary
      fallback={({ error, reset }) => (
        <div className="platform-open-section py-6 text-center">
          <div className="text-[var(--color-ink-muted)] text-sm mb-4">
            3D visualization unavailable
          </div>
          <button
            onClick={reset}
            className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-ink)] text-sm hover:bg-[var(--color-accent-hover)]"
          >
            Retry
          </button>
        </div>
      )}
    >
      <MarketEdgeScannerInner {...props} />
    </ErrorBoundary>
  );
}

function MarketEdgeScannerInner({ 
 markets = [], 
 onAnalyze, 
 isNight = false 
}) {
 const [edgeMarkets, setEdgeMarkets] = useState([]);
 const [currentIndex, setCurrentIndex] = useState(0);

 useEffect(() => {
 if (!markets || markets.length === 0) return;

 // Filter for markets with an ML edge (detectedAsset is present and potentially pre-calculated edges)
 // For now, we simulate the "scanner" by looking for ML-ready markets 
 // and highlighting them as high-interest opportunities.
 const ready = markets.filter(m => m.isMLReady).slice(0, 10);
 setEdgeMarkets(ready);
 }, [markets]);

 // Auto-rotate if multiple edges found
 useEffect(() => {
 if (edgeMarkets.length <= 1) return;

 const interval = setInterval(() => {
 setCurrentIndex((prev) => (prev + 1) % edgeMarkets.length);
 }, 8000); // Rotate every 8 seconds

 return () => clearInterval(interval);
 }, [edgeMarkets]);

 if (edgeMarkets.length === 0) {
 return (
 <div className="platform-open-section py-6 text-center text-[var(--color-ink-faint)]">
 <span className="text-sm font-light">No edge opportunities detected yet</span>
 </div>
 );
 }

 const currentMarket = edgeMarkets[currentIndex];
 const forecast = currentMarket.preCalculatedForecast;
 
 // Calculate edge if pre-calculated forecast exists
 let edge = null;
 let mlFairOdds = null;
 
 if (forecast && forecast.polymarketEdge) {
 // Handle both array and object responses for polymarketEdge
 const edgeData = Array.isArray(forecast.polymarketEdge) 
 ? forecast.polymarketEdge[0] 
 : forecast.polymarketEdge;
 
 if (edgeData) {
 edge = edgeData.edge;
 mlFairOdds = edgeData.synthFairProb;
 }
 }

 const textColor = 'text-[var(--color-ink)]';
 const subtleText = 'text-[var(--color-ink-muted)]';

 return (
 <div className="platform-workbench relative overflow-hidden p-5">
 {/* Scanner Header */}
 <div className="flex items-center gap-3 mb-4">
 <div className="flex h-2 w-2 bg-[var(--color-review)] animate-ping" />
 <h3 className={`text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-review)]`}>
 Live Edge Scanner
 </h3>

 {edge !== null && Math.abs(edge) > 0.05 && (
 <span className="animate-bounce px-2 py-0.5 bg-[var(--color-accent)] text-[10px] text-[var(--color-ink)] font-bold tracking-tighter">
 SIGNIFICANT EDGE
 </span>
 )}
 
 {/* Progress indicators */}
 <div className="ml-auto flex gap-1">
 {edgeMarkets.map((_, i) => (
 <div 
 key={i} 
 className={`h-1 transition-all duration-500 ${
 i === currentIndex 
 ? 'w-4 bg-[var(--color-review)]' 
 : 'w-1 bg-[var(--color-review)]/20'
 }`} 
 />
 ))}
 </div>
 </div>
 {/* Market Content */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter bg-[var(--color-review)]/20 text-[var(--color-review)]`}>
 {currentMarket.detectedAsset || 'Asset'} Coverage
 </span>
 <span className={`text-[10px] ${subtleText}`}>
 via SynthData Subnet 50
 </span>
 </div>
 
 <h4 className={`text-lg font-light leading-snug ${textColor} max-w-xl`}>
 {currentMarket.title}
 </h4>
 </div>

 <div className="flex items-center gap-8 pr-2">
 {/* Visual Odds Comparison */}
 <div className="flex gap-6 text-center">
 <Magnify
   size={70}
   zoom={1.6}
   color={[0.474, 0.965, 0.713]}
   hud={0.6}
   grid={false}
   readout={false}
   ripples={true}
   rippleGlow={0.8}
   style={{ display: 'inline-block', padding: '4px' }}
 >
 <div className="flex flex-col">
 <span className={`text-[10px] uppercase tracking-wider ${subtleText}`}>Market</span>
 <span className={`text-xl font-light ${textColor}`}>
 {currentMarket.ask ? `${(currentMarket.ask * 100).toFixed(0)}%` : '—'}
 </span>
 </div>
 
 <div className="flex flex-col items-center justify-center">
 <div className={`h-8 w-px bg-[var(--color-paper-soft)]`} />
 {edge !== null ? (
 <div className={`text-[10px] font-bold py-1 ${edge > 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-breach)]'}`}>
 {edge > 0 ? '▲' : '▼'} {Math.abs(edge * 100).toFixed(0)}%
 </div>
 ) : (
 <span className="text-xs py-1">vs</span>
 )}
 <div className={`h-8 w-px bg-[var(--color-paper-soft)]`} />
 </div>

 <div className="flex flex-col">
 <span className={`text-[10px] uppercase tracking-wider text-[var(--color-review)] font-bold`}>ML Fair</span>
 <span className={`text-xl font-bold text-[var(--color-review)]`}>
 {mlFairOdds !== null ? (
 `${(mlFairOdds * 100).toFixed(1)}%`
 ) : (
 <span className="opacity-50 italic">Calc...</span>
 )}
 </span>
 </div>
 </Magnify>
 </div>

 <button
 onClick={() => onAnalyze(currentMarket, 'basic')}
 className={`px-6 py-3 text-sm font-medium transition-all hover:scale-105 active:scale-95 bg-[var(--color-review)] text-[var(--color-ink)] shadow-lg shadow-[var(--color-review)]/20`}
 >
 {edge !== null ? 'View Analysis' : 'Reveal Edge'}
 </button>
 </div>
 </div>
 {/* Scanner Background Decoration */}
 <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-review)]/5 -mr-16 -mt-16 blur-3xl pointer-events-none" />
 <div className="absolute bottom-0 left-0 w-24 h-24 bg-[var(--color-evidence)]/5 -ml-12 -mb-12 blur-2xl pointer-events-none" />
 </div>
 );
}
