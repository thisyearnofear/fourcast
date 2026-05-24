'use client';

import React, { useState, useEffect, useMemo } from 'react';

/**
 * AnalysisConfigModal
 * 
 * Pre-analysis configuration modal that allows users to select:
 * - Data sources to include
 * - API providers
 * - Analysis depth
 * - Shows cost estimate before running
 */

export default function AnalysisConfigModal({
  isOpen,
  onClose,
  onConfirm,
  market,
  isLoading = false,
  defaultOptions = {},
}) {
  const [selectedProviders, setSelectedProviders] = useState({
    aiProvider: 'openai',
    weatherProvider: 'openweather',
    marketDataProvider: 'polymarket',
  });
  
  const [analysisDepth, setAnalysisDepth] = useState('standard'); // quick, standard, deep
  
  // Data sources toggles
  const [dataSources, setDataSources] = useState({
    includeWeather: true,
    includeSynthData: true,
    includeFutures: false,
    includeWebSearch: true,
    includeOnChain: false,
    // Finance-specific
    includeFundamental: false,
    includeTechnical: false,
    includeSentiment: false,
  });

  // Initialize from default options
  useEffect(() => {
    if (defaultOptions) {
      setDataSources(prev => ({
        ...prev,
        includeWeather: defaultOptions.includeWeather ?? prev.includeWeather,
        includeSynthData: defaultOptions.includeSynthData ?? prev.includeSynthData,
        includeFutures: defaultOptions.includeFutures ?? prev.includeFutures,
        includeWebSearch: defaultOptions.webSearchEnabled ?? prev.includeWebSearch,
      }));
      
      if (defaultOptions.analysisTypes) {
        setDataSources(prev => ({
          ...prev,
          includeFundamental: defaultOptions.analysisTypes.includes('fundamental'),
          includeTechnical: defaultOptions.analysisTypes.includes('technical'),
          includeSentiment: defaultOptions.analysisTypes.includes('sentiment'),
        }));
      }
    }
  }, [defaultOptions]);

  // Detect market type for smart defaults
  const marketType = useMemo(() => {
    const title = (market?.title || market?.question || '').toLowerCase();
    const eventType = (market?.eventType || '').toLowerCase();
    
    const combined = `${title} ${eventType}`;
    
    if (combined.includes('crypto') || combined.includes('bitcoin') || combined.includes('btc') || combined.includes('eth')) {
      return 'crypto';
    }
    if (combined.includes('stock') || combined.includes('nvidia') || combined.includes('apple') || combined.includes('market')) {
      return 'finance';
    }
    if (combined.includes('nfl') || combined.includes('nba') || combined.includes('soccer') || combined.includes('game')) {
      return 'sports';
    }
    return 'general';
  }, [market]);

  // Auto-detect relevant data sources based on market type
  useEffect(() => {
    const autoDefaults = {
      crypto: {
        includeSynthData: true,
        includeOnChain: true,
        includeSentiment: true,
      },
      finance: {
        includeFundamental: true,
        includeTechnical: true,
        includeSentiment: true,
      },
      sports: {
        includeWeather: true,
      },
    };
    
    if (autoDefaults[marketType]) {
      setDataSources(prev => ({
        ...prev,
        ...autoDefaults[marketType],
      }));
    }
  }, [marketType]);

  const toggleDataSource = (key) => {
    setDataSources(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Estimate cost based on selections
  const costEstimate = useMemo(() => {
    const baseCosts = {
      quick: 0.01,
      standard: 0.05,
      deep: 0.15,
    };
    
    let multiplier = 1;
    
    // Add cost for additional data sources
    if (dataSources.includeWeather) multiplier += 0.2;
    if (dataSources.includeSynthData) multiplier += 0.3;
    if (dataSources.includeWebSearch) multiplier += 0.2;
    if (dataSources.includeOnChain) multiplier += 0.3;
    if (dataSources.includeFundamental) multiplier += 0.2;
    if (dataSources.includeTechnical) multiplier += 0.1;
    if (dataSources.includeSentiment) multiplier += 0.2;
    
    const depthMultipliers = { quick: 0.5, standard: 1, deep: 2 };
    
    return (baseCosts[analysisDepth] * multiplier * depthMultipliers[analysisDepth]).toFixed(2);
  }, [dataSources, analysisDepth]);

  const handleConfirm = () => {
    onConfirm({
      ...dataSources,
      providers: selectedProviders,
      depth: analysisDepth,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-white/20 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-white/10 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Configure Analysis</h2>
              <p className="text-sm text-white/50 mt-1">Select data sources and providers</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Market Summary */}
          <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
            <p className="text-sm text-white/80 line-clamp-2">
              {market?.title || market?.question || 'Selected Market'}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-white/50">
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                {marketType.toUpperCase()}
              </span>
              {market?.location && (
                <span>📍 {market.location}</span>
              )}
              {market?.currentOdds && (
                <span>📊 {market.currentOdds.yes * 100}% - {(market.currentOdds.no || 1 - market.currentOdds.yes) * 100}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Data Sources */}
          <section>
            <h3 className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2">
              <span>📂</span> Data Sources
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <ToggleChip
                label="🌤️ Weather"
                active={dataSources.includeWeather}
                onClick={() => toggleDataSource('includeWeather')}
                auto={marketType === 'sports'}
              />
              <ToggleChip
                label="📊 ML Models"
                active={dataSources.includeSynthData}
                onClick={() => toggleDataSource('includeSynthData')}
                auto={marketType === 'crypto'}
              />
              <ToggleChip
                label="🔍 Web Search"
                active={dataSources.includeWebSearch}
                onClick={() => toggleDataSource('includeWebSearch')}
              />
              <ToggleChip
                label="📅 Futures"
                active={dataSources.includeFutures}
                onClick={() => toggleDataSource('includeFutures')}
              />
              <ToggleChip
                label="⛓️ On-Chain"
                active={dataSources.includeOnChain}
                onClick={() => toggleDataSource('includeOnChain')}
                auto={marketType === 'crypto'}
              />
              <ToggleChip
                label="📈 Technical"
                active={dataSources.includeTechnical}
                onClick={() => toggleDataSource('includeTechnical')}
                auto={marketType === 'finance'}
              />
              <ToggleChip
                label="📊 Fundamental"
                active={dataSources.includeFundamental}
                onClick={() => toggleDataSource('includeFundamental')}
                auto={marketType === 'finance'}
              />
              <ToggleChip
                label="💬 Sentiment"
                active={dataSources.includeSentiment}
                onClick={() => toggleDataSource('includeSentiment')}
                auto={marketType === 'finance' || marketType === 'crypto'}
              />
            </div>
          </section>

          {/* Analysis Depth */}
          <section>
            <h3 className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2">
              <span>⚡</span> Analysis Depth
            </h3>
            <div className="flex gap-2">
              {[
                { id: 'quick', label: '⚡ Quick', time: '~5s', desc: 'Fast results' },
                { id: 'standard', label: '📊 Standard', time: '~15s', desc: 'Balanced' },
                { id: 'deep', label: '🎯 Deep', time: '~30s', desc: 'Comprehensive' },
              ].map((depth) => (
                <button
                  key={depth.id}
                  onClick={() => setAnalysisDepth(depth.id)}
                  className={`flex-1 p-3 rounded-lg border transition-all ${
                    analysisDepth === depth.id
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm font-medium">{depth.label}</div>
                  <div className="text-xs opacity-60">{depth.time} • {depth.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* API Providers */}
          <section>
            <h3 className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2">
              <span>🔌</span> API Providers
            </h3>
            <div className="space-y-3">
              <SelectField
                label="AI Provider"
                value={selectedProviders.aiProvider}
                onChange={(v) => setSelectedProviders(p => ({ ...p, aiProvider: v }))}
                options={[
                  { value: 'openai', label: 'OpenAI (GPT-4)' },
                  { value: 'anthropic', label: 'Anthropic (Claude)' },
                  { value: 'gemini', label: 'Google Gemini' },
                ]}
              />
              <SelectField
                label="Weather API"
                value={selectedProviders.weatherProvider}
                onChange={(v) => setSelectedProviders(p => ({ ...p, weatherProvider: v }))}
                options={[
                  { value: 'openweather', label: 'OpenWeatherMap' },
                  { value: 'weatherapi', label: 'WeatherAPI' },
                  { value: 'tomorrow', label: 'Tomorrow.io' },
                ]}
                disabled={!dataSources.includeWeather}
              />
              <SelectField
                label="Market Data"
                value={selectedProviders.marketDataProvider}
                onChange={(v) => setSelectedProviders(p => ({ ...p, marketDataProvider: v }))}
                options={[
                  { value: 'polymarket', label: 'Polymarket' },
                  { value: 'kalshi', label: 'Kalshi' },
                  { value: 'coingecko', label: 'CoinGecko (Crypto)' },
                ]}
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-white/10 p-5">
          {/* Cost Estimate */}
          <div className="flex items-center justify-between mb-4 p-3 bg-white/5 rounded-lg">
            <div>
              <div className="text-xs text-white/50">Estimated Cost</div>
              <div className="text-lg font-semibold text-emerald-400">
                ${costEstimate}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/50">Active Sources</div>
              <div className="text-sm text-white/70">
                {Object.values(dataSources).filter(Boolean).length} enabled
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/20 text-white/70 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <span>🚀</span> Run Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toggle chip component
function ToggleChip({ label, active, onClick, auto = false }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
          : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
      }`}
    >
      <span>{label}</span>
      {auto && active && <span className="ml-1 text-[10px]">✓</span>}
    </button>
  );
}

// Select field component
function SelectField({ label, value, onChange, options, disabled = false }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-white/70">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`px-3 py-2 rounded-lg text-sm bg-white/10 border border-white/10 text-white ${
          disabled ? 'opacity-40 cursor-not-allowed' : ''
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
