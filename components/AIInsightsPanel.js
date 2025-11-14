import React, { useState, useEffect } from 'react';

const AIInsightsPanel = ({
  weatherData,
  isVisible,
  onClose,
  isNight,
  position = 'bottom-right'
}) => {
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [marketData, setMarketData] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);

  useEffect(() => {
    if (isVisible && weatherData && !marketData) {
      fetchMarketData();
    }
  }, [isVisible, weatherData]);

  useEffect(() => {
    if (selectedMarket && weatherData && !analysis) {
      performAnalysis();
    }
  }, [selectedMarket, weatherData]);

  const fetchMarketData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/markets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: weatherData?.location?.name,
          weatherData
        })
      });

      const data = await response.json();

      if (data.success && data.opportunities) {
        setMarketData(data.opportunities);
        // Auto-select first market
        if (data.opportunities.length > 0) {
          setSelectedMarket(data.opportunities[0]);
        }
      } else {
        setError(data.error || 'No markets available');
      }
    } catch (err) {
      console.error('Market fetch failed:', err);
      setError('Failed to fetch market data');
    } finally {
      setIsLoading(false);
    }
  };

  const performAnalysis = async () => {
    if (!selectedMarket) return;

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const eventData = {
        eventType: selectedMarket.title || 'Prediction Market',
        location: weatherData?.location?.name || 'Unknown Location',
        currentOdds: `Yes: ${(selectedMarket.currentOdds?.yes * 100 || 0).toFixed(1)}% / No: ${(selectedMarket.currentOdds?.no * 100 || 0).toFixed(1)}%`,
        participants: selectedMarket.description || 'Market participants'
      };

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...eventData,
          weatherData,
          marketID: selectedMarket.marketID
        })
      });

      const data = await response.json();

      if (data.success) {
        setAnalysis(data.analysis);
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (err) {
      console.error('Analysis request failed:', err);
      setError('Failed to connect to analysis service');
    } finally {
      setIsLoading(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'HIGH': return 'text-green-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'LOW': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getImpactIcon = (impact) => {
    switch (impact) {
      case 'HIGH': return '⚠️';
      case 'MEDIUM': return '⚡';
      case 'LOW': return '✅';
      default: return '❓';
    }
  };

  const getEfficiencyColor = (efficiency) => {
    switch (efficiency) {
      case 'EFFICIENT': return 'text-green-400';
      case 'INEFFICIENT': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  if (!isVisible) return null;

  const panelClasses = `
    absolute z-30 backdrop-blur-md border transition-all duration-300
    ${isNight ? 'bg-black/20 border-white/20' : 'bg-white/10 border-black/20'}
    ${position === 'bottom-right' ? 'bottom-6 right-6' : 'bottom-6 left-6'}
    ${isExpanded ? 'w-80 h-96' : 'w-64 h-16'}
    rounded-2xl
  `;

  const textColor = isNight ? 'text-white' : 'text-black';

  return (
    <div className={panelClasses}>
      {/* Header - Always visible */}
      <div
        className={`p-4 cursor-pointer ${textColor} flex items-center justify-between`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-blue-400 animate-pulse' : 'bg-green-400'}`}></div>
          <span className="text-sm font-light">AI Edge Analysis</span>
          {analysis?.cached && (
            <span className="text-xs opacity-60 bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
              cached
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {isExpanded ? (
            <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span className={`ml-3 text-sm ${textColor} opacity-70`}>
                {marketData ? 'Analyzing weather impact...' : 'Fetching markets...'}
              </span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
              <p className={`text-sm ${textColor} opacity-90`}>{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  if (!marketData) fetchMarketData();
                  else performAnalysis();
                }}
                className="mt-2 text-xs bg-red-500/30 hover:bg-red-500/50 px-2 py-1 rounded transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Market Selector */}
          {!isLoading && !error && marketData && marketData.length > 0 && !analysis && (
            <div className="space-y-2">
              <h4 className={`text-sm font-light ${textColor} opacity-90`}>
                Weather-Sensitive Markets ({marketData.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {marketData.map((market, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setSelectedMarket(market);
                      setAnalysis(null);
                    }}
                    className={`p-2 rounded-lg cursor-pointer transition-all text-xs ${
                      selectedMarket?.marketID === market.marketID
                        ? isNight ? 'bg-blue-500/40 border border-blue-400/50' : 'bg-blue-400/30 border border-blue-500/50'
                        : isNight ? 'bg-white/5 border border-white/10 hover:bg-white/10' : 'bg-black/5 border border-black/10 hover:bg-black/10'
                    }`}
                  >
                    <div className={`${textColor} font-light line-clamp-2`}>
                      {market.title}
                    </div>
                    <div className={`${textColor} opacity-60 text-xs mt-1`}>
                      Vol: ${(market.volume24h / 1000 || 0).toFixed(0)}K • Yes: {(market.currentOdds?.yes * 100 || 0).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis && !isLoading && (
            <div className="space-y-3">
              {/* Assessment Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <div className="text-lg">{getImpactIcon(analysis.assessment?.weather_impact)}</div>
                  <div className={`text-xs font-light ${textColor} opacity-70`}>Impact</div>
                  <div className={`text-xs ${getConfidenceColor(analysis.assessment?.confidence)}`}>
                    {analysis.assessment?.weather_impact}
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-lg ${getEfficiencyColor(analysis.assessment?.odds_efficiency)}`}>
                    {analysis.assessment?.odds_efficiency === 'EFFICIENT' ? '✅' : '⚠️'}
                  </div>
                  <div className={`text-xs font-light ${textColor} opacity-70`}>Odds</div>
                  <div className={`text-xs ${getEfficiencyColor(analysis.assessment?.odds_efficiency)}`}>
                    {analysis.assessment?.odds_efficiency}
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-lg ${getConfidenceColor(analysis.assessment?.confidence)}`}>
                    {analysis.assessment?.confidence === 'HIGH' ? '🎯' :
                     analysis.assessment?.confidence === 'MEDIUM' ? '⚖️' : '❓'}
                  </div>
                  <div className={`text-xs font-light ${textColor} opacity-70`}>Confidence</div>
                  <div className={`text-xs ${getConfidenceColor(analysis.assessment?.confidence)}`}>
                    {analysis.assessment?.confidence}
                  </div>
                </div>
              </div>

              {/* Analysis Text */}
              <div>
                <h4 className={`text-sm font-light ${textColor} opacity-90 mb-2`}>Analysis</h4>
                <p className={`text-xs ${textColor} opacity-80 leading-relaxed`}>
                  {analysis.analysis}
                </p>
              </div>

              {/* Key Factors */}
              {analysis.key_factors && analysis.key_factors.length > 0 && (
                <div>
                  <h4 className={`text-sm font-light ${textColor} opacity-90 mb-2`}>Key Factors</h4>
                  <ul className="space-y-1">
                    {analysis.key_factors.map((factor, index) => (
                      <li key={index} className={`text-xs ${textColor} opacity-70 flex items-start`}>
                        <span className="mr-2 mt-1.5 w-1 h-1 bg-current rounded-full flex-shrink-0"></span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendation */}
              {analysis.recommended_action && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <h4 className={`text-sm font-light ${textColor} opacity-90 mb-1`}>Recommendation</h4>
                  <p className={`text-xs ${textColor} opacity-80`}>
                    {analysis.recommended_action}
                  </p>
                </div>
              )}

              {/* Disclaimer */}
              <div className={`text-xs ${textColor} opacity-50 text-center pt-2 border-t border-white/10`}>
                AI analysis for informational purposes only
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIInsightsPanel;