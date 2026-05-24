'use client';

import React, { useState, useEffect, useCallback } from 'react';

/**
 * AnalysisOptions Component
 * 
 * Toggleable settings for analysis factors with smart defaults.
 * Persists preferences to localStorage.
 * 
 * Features:
 * - Weather analysis toggle (auto-on for sports/outdoor)
 * - SynthData ML toggle (auto-on for crypto/prices)
 * - Futures inclusion toggle
 * - localStorage persistence
 * - Responsive design with glass styling
 */
export default function AnalysisOptions({
  marketType = 'unknown',
  onOptionsChange,
  className = '',
  compact = false,
}) {
  // Determine smart defaults based on market type
  const getSmartDefaults = useCallback((type) => {
    const typeLower = String(type || '').toLowerCase();
    
    // Weather-sensitive categories
    const weatherCategories = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'golf', 'tennis', 'cricket', 'rugby', 'f1', 'formula', 'marathon', 'racing', 'outdoor', 'weather', 'sports'];
    const isWeatherMarket = weatherCategories.some(cat => typeLower.includes(cat));
    
    // SynthData-relevant categories
    const synthCategories = ['crypto', 'bitcoin', 'btc', 'eth', 'ethereum', 'price', 'stock', 'market', 'finance', 'trading'];
    const isSynthMarket = synthCategories.some(cat => typeLower.includes(cat));
    
    // Finance/Stock categories
    const financeCategories = ['stock', 'finance', 'crypto', 'bitcoin', 'btc', 'eth', 'trading', 'economy', 'earnings', 'market', 'price'];
    const isFinanceMarket = financeCategories.some(cat => typeLower.includes(cat));
    
    return {
      includeWeather: isWeatherMarket,
      includeSynthData: isSynthMarket,
      includeFutures: false,
      webSearchEnabled: true,
      // Finance-specific analysis types
      analysisTypes: isFinanceMarket ? ['fundamental', 'sentiment'] : [],
    };
  }, []);
  
  // Load saved preferences or use smart defaults
  const [options, setOptions] = useState(() => {
    // SSR guard
    if (typeof window === 'undefined') {
      return getSmartDefaults(marketType);
    }
    
    // Try to load saved preferences
    try {
      const saved = localStorage.getItem('fourcast_analysis_options');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with smart defaults (saved takes precedence)
        return { ...getSmartDefaults(marketType), ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load analysis options:', e);
    }
    
    return getSmartDefaults(marketType);
  });
  
  // Update smart defaults when market type changes
  useEffect(() => {
    const defaults = getSmartDefaults(marketType);
    setOptions(prev => ({
      ...defaults,
      // Preserve user overrides if they exist
      ...prev,
    }));
  }, [marketType, getSmartDefaults]);
  
  // Persist to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('fourcast_analysis_options', JSON.stringify(options));
    } catch (e) {
      console.warn('Failed to save analysis options:', e);
    }
  }, [options]);
  
  // Notify parent of changes
  useEffect(() => {
    if (onOptionsChange) {
      onOptionsChange(options);
    }
  }, [options, onOptionsChange]);
  
  const toggleOption = (key) => {
    setOptions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };
  
  // Toggle analysis types for finance markets
  const toggleAnalysisType = (type) => {
    setOptions(prev => {
      const currentTypes = prev.analysisTypes || [];
      const newTypes = currentTypes.includes(type)
        ? currentTypes.filter(t => t !== type)
        : [...currentTypes, type];
      return { ...prev, analysisTypes: newTypes };
    });
  };
  
  // Determine if weather toggle should show "auto-detected" indicator
  const weatherCategories = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'golf', 'tennis', 'cricket', 'rugby', 'f1', 'formula', 'marathon', 'racing', 'outdoor', 'weather', 'sports'];
  const typeLower = String(marketType || '').toLowerCase();
  const isWeatherMarket = weatherCategories.some(cat => typeLower.includes(cat));
  
  const synthCategories = ['crypto', 'bitcoin', 'btc', 'eth', 'ethereum', 'price', 'stock', 'market', 'finance', 'trading'];
  const isSynthMarket = synthCategories.some(cat => typeLower.includes(cat));
  
  // Finance/Stock categories
  const financeCategories = ['stock', 'finance', 'crypto', 'bitcoin', 'btc', 'eth', 'trading', 'economy', 'earnings', 'market', 'price'];
  const isFinanceMarket = financeCategories.some(cat => typeLower.includes(cat));

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {/* Weather toggle - show for sports markets */}
        {isWeatherMarket && (
          <ToggleButton
            label="🌤️ Weather"
            isActive={options.includeWeather}
            onClick={() => toggleOption('includeWeather')}
            autoDetected={isWeatherMarket}
            compact
          />
        )}
        
        {/* Finance analysis toggles - show for finance markets */}
        {isFinanceMarket && (
          <>
            <ToggleButton
              label="📊 Fund."
              isActive={options.analysisTypes?.includes('fundamental')}
              onClick={() => toggleAnalysisType('fundamental')}
              autoDetected={true}
              compact
            />
            <ToggleButton
              label="📈 Tech."
              isActive={options.analysisTypes?.includes('technical')}
              onClick={() => toggleAnalysisType('technical')}
              compact
            />
            <ToggleButton
              label="💬 Sent."
              isActive={options.analysisTypes?.includes('sentiment')}
              onClick={() => toggleAnalysisType('sentiment')}
              compact
            />
          </>
        )}
        
        {/* ML toggle - show for non-finance markets */}
        {!isFinanceMarket && (
          <ToggleButton
            label="🤖 ML Models"
            isActive={options.includeSynthData}
            onClick={() => toggleOption('includeSynthData')}
            autoDetected={isSynthMarket}
            compact
          />
        )}
        
        <ToggleButton
          label="📅 Futures"
          isActive={options.includeFutures}
          onClick={() => toggleOption('includeFutures')}
          compact
        />
      </div>
    );
  }

  return (
    <div className={`glass-panel p-4 rounded-xl ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/90">Analysis Factors</h3>
        <button
          onClick={() => setOptions(getSmartDefaults(marketType))}
          className="text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
      
      <div className="space-y-2">
        <ToggleRow
          label="Weather data"
          description={isWeatherMarket ? "Auto-detected (sports market)" : "Include weather analysis"}
          isActive={options.includeWeather}
          onClick={() => toggleOption('includeWeather')}
          autoDetected={isWeatherMarket}
        />
        
        <ToggleRow
          label="ML price models"
          description={isSynthMarket ? "Auto-detected (crypto/finance)" : "SynthData ensemble forecasts"}
          isActive={options.includeSynthData}
          onClick={() => toggleOption('includeSynthData')}
          autoDetected={isSynthMarket}
        />
        
        {/* Finance-specific analysis types - only show for finance markets */}
        {isFinanceMarket && (
          <>
            <div className="pt-2 pb-1">
              <p className="text-xs text-white/40 uppercase tracking-wider">Finance Analysis</p>
            </div>
            <ToggleRow
              label="📊 Fundamental"
              description="Earnings, macro factors, financials"
              isActive={options.analysisTypes?.includes('fundamental')}
              onClick={() => toggleAnalysisType('fundamental')}
            />
            <ToggleRow
              label="📈 Technical"
              description="Price patterns, trends, support/resistance"
              isActive={options.analysisTypes?.includes('technical')}
              onClick={() => toggleAnalysisType('technical')}
            />
            <ToggleRow
              label="💬 Sentiment"
              description="Social media, news, community mood"
              isActive={options.analysisTypes?.includes('sentiment')}
              onClick={() => toggleAnalysisType('sentiment')}
            />
          </>
        )}
        
        <ToggleRow
          label="Include futures"
          description="Season-long championship bets"
          isActive={options.includeFutures}
          onClick={() => toggleOption('includeFutures')}
        />
        
        <details className="group">
          <summary className="cursor-pointer text-xs text-white/50 hover:text-white/70 mt-3 list-none flex items-center gap-1">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Advanced options
          </summary>
          
          <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
            <ToggleRow
              label="Web search grounding"
              description="Verify facts with live search"
              isActive={options.webSearchEnabled}
              onClick={() => toggleOption('webSearchEnabled')}
            />
          </div>
        </details>
      </div>
    </div>
  );
}

// Toggle row for full mode
function ToggleRow({ label, description, isActive, onClick, autoDetected = false }) {
  return (
    <div
      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/90">{label}</span>
          {autoDetected && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              auto
            </span>
          )}
        </div>
        <p className="text-xs text-white/50">{description}</p>
      </div>
      
      <button
        className={`relative w-10 h-6 rounded-full transition-colors ${
          isActive ? 'bg-emerald-500' : 'bg-white/20'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
            isActive ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

// Compact toggle button for inline use
function ToggleButton({ label, isActive, onClick, autoDetected = false, compact = false }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-full text-xs font-medium transition-all
        ${isActive 
          ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50' 
          : 'bg-white/10 text-white/50 border border-white/10'
        }
        ${autoDetected && isActive ? 'ring-1 ring-emerald-500/30' : ''}
        hover:scale-105 active:scale-95
      `}
    >
      {label}
      {autoDetected && isActive && (
        <span className="ml-1 text-[10px]">✓</span>
      )}
    </button>
  );
}

// Hook for using analysis options in other components
export function useAnalysisOptions(marketType = 'unknown') {
  const [options, setOptions] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        includeWeather: false,
        includeSynthData: false,
        includeFutures: false,
        webSearchEnabled: true,
      };
    }
    
    try {
      const saved = localStorage.getItem('fourcast_analysis_options');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load analysis options:', e);
    }
    
    return {
      includeWeather: false,
      includeSynthData: false,
      includeFutures: false,
      webSearchEnabled: true,
    };
  });
  
  return options;
}
