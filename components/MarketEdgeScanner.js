'use client';

import React, { useState, useEffect } from 'react';

/**
 * Market Edge Scanner
 * Identifies and highlights markets with significant ML-derived edges
 */
export function MarketEdgeScanner({ 
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

  if (edgeMarkets.length === 0) return null;

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

  const textColor = isNight ? 'text-white' : 'text-slate-900';
  const subtleText = isNight ? 'text-white/60' : 'text-slate-600';

  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 border-2 ${
      isNight 
        ? 'glass-subtle border-purple-500/30' 
        : 'glass-subtle-light border-purple-400/30 shadow-lg shadow-purple-500/5'
    }`}>
      {/* Scanner Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-2 w-2 rounded-full bg-purple-500 animate-ping" />
        <h3 className={`text-xs font-bold uppercase tracking-[0.2em] ${isNight ? 'text-purple-400' : 'text-purple-600'}`}>
          Live Edge Scanner
        </h3>

        {edge !== null && Math.abs(edge) > 0.05 && (
          <span className="animate-bounce px-2 py-0.5 rounded bg-green-500 text-[10px] text-white font-bold tracking-tighter">
            SIGNIFICANT EDGE
          </span>
        )}
        
        {/* Progress indicators */}
        <div className="ml-auto flex gap-1">
          {edgeMarkets.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-500 ${
                i === currentIndex 
                  ? 'w-4 bg-purple-500' 
                  : 'w-1 bg-purple-500/20'
              }`} 
            />
          ))}
        </div>
      </div>

      {/* Market Content */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${
              isNight ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
            }`}>
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
            <div className="flex flex-col">
              <span className={`text-[10px] uppercase tracking-wider ${subtleText}`}>Market</span>
              <span className={`text-xl font-light ${textColor}`}>
                {currentMarket.ask ? `${(currentMarket.ask * 100).toFixed(0)}%` : '—'}
              </span>
            </div>
            
            <div className="flex flex-col items-center justify-center">
              <div className={`h-8 w-px ${isNight ? 'bg-white/10' : 'bg-black/10'}`} />
              {edge !== null ? (
                <div className={`text-[10px] font-bold py-1 ${edge > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {edge > 0 ? '▲' : '▼'} {Math.abs(edge * 100).toFixed(0)}%
                </div>
              ) : (
                <span className="text-xs py-1">vs</span>
              )}
              <div className={`h-8 w-px ${isNight ? 'bg-white/10' : 'bg-black/10'}`} />
            </div>

            <div className="flex flex-col">
              <span className={`text-[10px] uppercase tracking-wider ${isNight ? 'text-purple-400' : 'text-purple-600'} font-bold`}>ML Fair</span>
              <span className={`text-xl font-bold ${isNight ? 'text-purple-300' : 'text-purple-700'}`}>
                {mlFairOdds !== null ? (
                  `${(mlFairOdds * 100).toFixed(1)}%`
                ) : (
                  <span className="opacity-50 italic">Calc...</span>
                )}
              </span>
            </div>
          </div>

          <button
            onClick={() => onAnalyze(currentMarket, 'basic')}
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95 ${
              isNight
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
            }`}
          >
            {edge !== null ? 'View Analysis' : 'Reveal Edge'}
          </button>
        </div>
      </div>
      
      {/* Scanner Background Decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full -ml-12 -mb-12 blur-2xl pointer-events-none" />
    </div>
  );
}
