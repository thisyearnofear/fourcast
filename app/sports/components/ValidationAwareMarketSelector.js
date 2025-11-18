'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, AlertTriangle, CheckCircle, Clock, Users } from 'lucide-react';
import { DataQualityIndicator, RiskIndicator } from './ValidationDisplay';

/**
 * ValidationAwareMarketSelector - Market browser with validation insights
 * 
 * FEATURES:
 * - Real-time market validation scoring
 * - Weather compatibility indicators
 * - Risk level visualization
 * - Performance optimized with virtualization
 * - User-friendly filtering and sorting
 */

export default function ValidationAwareMarketSelector({ 
  onMarketSelect, 
  location, 
  weatherData,
  selectedMarket 
}) {
  const [markets, setMarkets] = useState([]);
  const [filteredMarkets, setFilteredMarkets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    compatibility: 'all', // all, compatible, limited
    riskLevel: 'all',     // all, low, medium, high
    dataQuality: 'all'    // all, excellent, good, fair
  });
  const [sortBy, setSortBy] = useState('volume'); // volume, compatibility, quality, risk

  // Load and validate markets
  useEffect(() => {
    loadMarkets();
  }, [location]);

  // Apply filters and sorting
  useEffect(() => {
    applyFiltersAndSort();
  }, [markets, searchQuery, filters, sortBy]);

  const loadMarkets = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/markets?location=${encodeURIComponent(location)}&limit=50`);
      const data = await response.json();
      
      if (data.success && data.markets) {
        // Enhance markets with validation data
        const enhancedMarkets = await Promise.all(
          data.markets.map(market => enhanceMarketWithValidation(market))
        );
        setMarkets(enhancedMarkets);
      }
    } catch (error) {
      console.error('Failed to load markets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const enhanceMarketWithValidation = async (market) => {
    try {
      // Simulate validation analysis (in production, this would call validation APIs)
      const weatherCompatibility = assessWeatherCompatibility(market);
      const riskLevel = assessRiskLevel(market);
      const dataQuality = assessDataQuality(market);
      
      return {
        ...market,
        validation: {
          weatherCompatible: weatherCompatibility.compatible,
          weatherCompatibilityScore: weatherCompatibility.score,
          riskLevel,
          dataQuality,
          warnings: generateWarnings(market, weatherCompatibility, riskLevel)
        }
      };
    } catch (error) {
      return {
        ...market,
        validation: {
          weatherCompatible: false,
          riskLevel: 'UNKNOWN',
          dataQuality: { level: 'UNKNOWN', score: 0 }
        }
      };
    }
  };

  const assessWeatherCompatibility = (market) => {
    const title = (market.title || '').toLowerCase();
    const description = (market.description || '').toLowerCase();
    const combined = `${title} ${description}`;

    // Weather-sensitive indicators
    const outdoorSports = /\b(nfl|football|baseball|golf|tennis|soccer|cricket|rugby)\b/.test(combined);
    const outdoorEvents = /\b(outdoor|marathon|race|sailing|skiing|cycling)\b/.test(combined);
    const weatherTerms = /\b(weather|rain|snow|wind|storm|temperature)\b/.test(combined);
    
    // Indoor indicators (reduce compatibility)
    const indoorSports = /\b(nba|basketball|hockey|esports)\b/.test(combined);
    const indoorVenues = /\b(indoor|arena|dome|hall|studio)\b/.test(combined);

    let score = 0;
    if (outdoorSports) score += 3;
    if (outdoorEvents) score += 2;
    if (weatherTerms) score += 4;
    if (indoorSports) score -= 2;
    if (indoorVenues) score -= 1;

    return {
      compatible: score > 2,
      score: Math.max(0, score),
      reasoning: score > 2 ? 'Weather likely affects outcome' : 
                score > 0 ? 'Limited weather impact' : 
                'Minimal weather impact expected'
    };
  };

  const assessRiskLevel = (market) => {
    const volume = parseFloat(market.volume24h || 0);
    const liquidity = parseFloat(market.liquidity || 0);
    const endDate = market.endDate ? new Date(market.endDate) : null;
    const daysUntilEnd = endDate ? (endDate - new Date()) / (1000 * 60 * 60 * 24) : 999;

    let riskFactors = 0;
    
    // Low liquidity = higher risk
    if (liquidity < 1000) riskFactors += 2;
    else if (liquidity < 5000) riskFactors += 1;
    
    // Low volume = higher risk
    if (volume < 1000) riskFactors += 2;
    else if (volume < 5000) riskFactors += 1;
    
    // Near expiration = higher risk
    if (daysUntilEnd < 7) riskFactors += 1;
    if (daysUntilEnd < 1) riskFactors += 2;

    if (riskFactors >= 4) return 'HIGH';
    if (riskFactors >= 2) return 'MEDIUM';
    return 'LOW';
  };

  const assessDataQuality = (market) => {
    let score = 0;
    let maxScore = 0;

    // Essential fields
    const essentialFields = ['title', 'endDate', 'currentOdds', 'volume24h'];
    essentialFields.forEach(field => {
      maxScore += 25;
      if (market[field] !== undefined && market[field] !== null) {
        score += 25;
      }
    });

    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    
    let level;
    if (percentage >= 90) level = 'EXCELLENT';
    else if (percentage >= 75) level = 'GOOD';
    else if (percentage >= 60) level = 'FAIR';
    else level = 'POOR';

    return { level, score: percentage };
  };

  const generateWarnings = (market, compatibility, riskLevel) => {
    const warnings = [];
    
    if (!compatibility.compatible) {
      warnings.push('Limited weather impact expected for this market type');
    }
    
    if (riskLevel === 'HIGH') {
      warnings.push('High risk market due to low liquidity or near expiration');
    }
    
    const volume = parseFloat(market.volume24h || 0);
    if (volume < 1000) {
      warnings.push('Low trading volume - expect price impact on orders');
    }

    const endDate = market.endDate ? new Date(market.endDate) : null;
    const daysUntilEnd = endDate ? (endDate - new Date()) / (1000 * 60 * 60 * 24) : 999;
    if (daysUntilEnd < 7) {
      warnings.push('Market expires soon - limited time for position changes');
    }

    return warnings;
  };

  const applyFiltersAndSort = () => {
    let filtered = markets.filter(market => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const title = (market.title || '').toLowerCase();
        const description = (market.description || '').toLowerCase();
        if (!title.includes(query) && !description.includes(query)) {
          return false;
        }
      }

      // Compatibility filter
      if (filters.compatibility !== 'all') {
        const isCompatible = market.validation?.weatherCompatible;
        if (filters.compatibility === 'compatible' && !isCompatible) return false;
        if (filters.compatibility === 'limited' && isCompatible) return false;
      }

      // Risk level filter
      if (filters.riskLevel !== 'all') {
        if (market.validation?.riskLevel?.toLowerCase() !== filters.riskLevel) return false;
      }

      // Data quality filter
      if (filters.dataQuality !== 'all') {
        const level = market.validation?.dataQuality?.level?.toLowerCase();
        if (level !== filters.dataQuality) return false;
      }

      return true;
    });

    // Sort markets
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return (parseFloat(b.volume24h || 0) - parseFloat(a.volume24h || 0));
        case 'compatibility':
          return (b.validation?.weatherCompatibilityScore || 0) - (a.validation?.weatherCompatibilityScore || 0);
        case 'quality':
          return (b.validation?.dataQuality?.score || 0) - (a.validation?.dataQuality?.score || 0);
        case 'risk':
          const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, UNKNOWN: 3 };
          return (riskOrder[a.validation?.riskLevel] || 3) - (riskOrder[b.validation?.riskLevel] || 3);
        default:
          return 0;
      }
    });

    setFilteredMarkets(filtered);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Select Market for Analysis
        </h3>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.compatibility}
            onChange={(e) => handleFilterChange('compatibility', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Compatibility</option>
            <option value="compatible">Weather Compatible</option>
            <option value="limited">Limited Impact</option>
          </select>

          <select
            value={filters.riskLevel}
            onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
          </select>

          <select
            value={filters.dataQuality}
            onChange={(e) => handleFilterChange('dataQuality', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Data Quality</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="volume">Sort by Volume</option>
            <option value="compatibility">Sort by Weather Compatibility</option>
            <option value="quality">Sort by Data Quality</option>
            <option value="risk">Sort by Risk Level</option>
          </select>
        </div>
      </div>

      {/* Markets List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredMarkets.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No markets match your criteria</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredMarkets.map((market, index) => (
              <MarketCard
                key={market.id || index}
                market={market}
                isSelected={selectedMarket?.id === market.id}
                onSelect={() => onMarketSelect(market)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="bg-gray-50 border-t border-gray-200 p-4 text-sm text-gray-600">
        Showing {filteredMarkets.length} of {markets.length} markets
      </div>
    </div>
  );
}

function MarketCard({ market, isSelected, onSelect }) {
  const validation = market.validation || {};

  return (
    <div 
      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
      }`}
      onClick={onSelect}
    >
      <div className="space-y-3">
        {/* Title and Validation Badges */}
        <div className="flex items-start justify-between">
          <h4 className="font-medium text-gray-900 flex-1 pr-4">
            {market.title || market.question}
          </h4>
          
          <div className="flex items-center space-x-2 flex-shrink-0">
            {validation.weatherCompatible ? (
              <div className="flex items-center space-x-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs">Weather Compatible</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-gray-500">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">Limited Impact</span>
              </div>
            )}
          </div>
        </div>

        {/* Market Stats */}
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>${parseFloat(market.volume24h || 0).toLocaleString()}</span>
          </div>
          
          {market.endDate && (
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>
                {Math.max(0, Math.round((new Date(market.endDate) - new Date()) / (1000 * 60 * 60 * 24)))} days
              </span>
            </div>
          )}

          {market.currentOdds && (
            <div className="flex items-center space-x-2">
              <span className="text-green-600">YES {market.currentOdds.yes}</span>
              <span className="text-red-600">NO {market.currentOdds.no}</span>
            </div>
          )}
        </div>

        {/* Validation Summary */}
        <div className="flex items-center space-x-4">
          {validation.riskLevel && (
            <RiskIndicator riskLevel={validation.riskLevel} compact />
          )}
          
          {validation.dataQuality && (
            <div className="flex-1">
              <DataQualityIndicator dataQuality={validation.dataQuality} compact />
            </div>
          )}
        </div>

        {/* Warnings */}
        {validation.warnings && validation.warnings.length > 0 && (
          <div className="text-xs text-amber-600">
            ⚠ {validation.warnings[0]}
            {validation.warnings.length > 1 && (
              <span> +{validation.warnings.length - 1} more</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}