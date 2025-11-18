'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Enhanced validation-aware components
import ValidationStatusBar from './ValidationStatusBar';
import ValidationAwareMarketSelector from './ValidationAwareMarketSelector';
import EnhancedAnalysisDisplay from './EnhancedAnalysisDisplay';
import EnhancedOrderForm from './EnhancedOrderForm';
import { ValidationAlert } from './ValidationDisplay';

// Performance optimized validation hooks
import { 
  useLocationValidation, 
  useWeatherValidation,
  usePerformantValidation 
} from './usePerformantValidation';

// Existing components
import LocationSelector from '@/components/LocationSelector';
import WeatherVisualization from '@/components/WeatherVisualization';
import PageNav from '@/app/components/PageNav';

// Dynamic imports for performance
const Scene3D = dynamic(() => import('@/components/Scene3D'), { 
  ssr: false,
  loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
});

/**
 * EnhancedAIPage - Main AI analysis page with comprehensive validation
 * 
 * FEATURES:
 * - Real-time validation feedback across all components
 * - Performance optimized with smart caching and debouncing
 * - Progressive disclosure of validation details
 * - User-friendly error handling and guidance
 * - Responsive design with mobile optimization
 */

export default function EnhancedAIPage() {
  const router = useRouter();
  
  // Core application state
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // UI state
  const [isNight, setIsNight] = useState(false);
  const [activeSection, setActiveSection] = useState('location'); // location, market, analysis, trade
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  // Wallet state (would typically come from wallet provider)
  const [walletState, setWalletState] = useState({
    address: null,
    isConnected: false,
    chainId: null,
    balance: null
  });

  // Performance-optimized validations
  const locationValidation = useLocationValidation(
    selectedMarket?.eventType || selectedMarket?.title,
    selectedLocation,
    { dependencies: [selectedMarket?.id] }
  );

  const weatherValidation = useWeatherValidation(weatherData, {
    dependencies: [selectedLocation?.name]
  });

  // Market compatibility validation
  const marketValidators = useMemo(() => ({
    compatibility: async (data) => {
      if (!data.market || !data.location || !data.weatherData) {
        return { valid: true, errors: [], warnings: [] };
      }

      // Call market compatibility API
      const response = await fetch('/api/validate/market-compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      return await response.json();
    }
  }), []);

  const marketValidation = usePerformantValidation(
    { market: selectedMarket, location: selectedLocation, weatherData },
    marketValidators,
    { dependencies: [selectedMarket?.id, selectedLocation?.name] }
  );

  // Trading readiness validation
  const tradingValidators = useMemo(() => ({
    readiness: async (data) => {
      if (!data.wallet.isConnected || !data.market) {
        return { 
          valid: false, 
          errors: ['Wallet must be connected and market selected'],
          warnings: []
        };
      }

      return {
        valid: true,
        errors: [],
        warnings: data.wallet.balance < 10 ? ['Low wallet balance'] : []
      };
    }
  }), []);

  const tradingValidation = usePerformantValidation(
    { wallet: walletState, market: selectedMarket },
    tradingValidators,
    { dependencies: [walletState.address, walletState.balance, selectedMarket?.id] }
  );

  // Initialize night mode
  useEffect(() => {
    const hour = new Date().getHours();
    setIsNight(hour < 6 || hour > 18);
  }, []);

  // Load weather data when location changes
  useEffect(() => {
    if (selectedLocation) {
      loadWeatherData();
    }
  }, [selectedLocation]);

  // Auto-progress through sections when validations pass
  useEffect(() => {
    if (activeSection === 'location' && locationValidation.aggregateValidation.valid && selectedLocation) {
      setTimeout(() => setActiveSection('market'), 1000);
    } else if (activeSection === 'market' && selectedMarket && marketValidation.aggregateValidation.valid) {
      setTimeout(() => setActiveSection('analysis'), 1000);
    }
  }, [activeSection, locationValidation, marketValidation, selectedLocation, selectedMarket]);

  const loadWeatherData = async () => {
    try {
      const location = selectedLocation?.name || selectedLocation;
      const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
      const data = await response.json();
      
      if (data.success) {
        setWeatherData(data.weatherData);
      } else {
        console.error('Failed to load weather data:', data.error);
      }
    } catch (error) {
      console.error('Weather API error:', error);
    }
  };

  const runAnalysis = async () => {
    if (!selectedMarket || !selectedLocation || !weatherData) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: selectedMarket.id || selectedMarket.tokenID,
          title: selectedMarket.title || selectedMarket.question,
          location: selectedLocation,
          weatherData,
          eventType: selectedMarket.eventType || 'General',
          mode: 'detailed'
        })
      });

      const data = await response.json();
      if (data.success) {
        setAnalysis(data);
        setActiveSection('trade');
      } else {
        console.error('Analysis failed:', data.error);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    setSelectedMarket(null); // Reset market when location changes
    setAnalysis(null);
    setActiveSection('location');
  };

  const handleMarketSelect = (market) => {
    setSelectedMarket(market);
    setAnalysis(null);
    setActiveSection('market');
  };

  const handleOrderSuccess = (orderResult) => {
    console.log('Order submitted successfully:', orderResult);
    // Handle successful order (show confirmation, update UI, etc.)
  };

  // Overall system validation status
  const systemValidation = {
    location: locationValidation.aggregateValidation,
    weather: weatherValidation.aggregateValidation,
    market: marketValidation.aggregateValidation,
    trading: tradingValidation.aggregateValidation
  };

  const canAnalyze = selectedLocation && 
                    selectedMarket && 
                    weatherData &&
                    locationValidation.aggregateValidation.valid &&
                    weatherValidation.aggregateValidation.valid;

  return (
    <div className={`min-h-screen transition-colors duration-1000 ${
      isNight ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900' : 
                'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
    }`}>
      {/* Navigation */}
      <PageNav />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Global Validation Status */}
        <div className="mb-6">
          <ValidationStatusBar 
            locationValidation={locationValidation.aggregateValidation}
            weatherValidation={weatherValidation.aggregateValidation}
            marketValidation={marketValidation.aggregateValidation}
            tradingValidation={tradingValidation.aggregateValidation}
            isValidating={
              locationValidation.isValidating || 
              weatherValidation.isValidating || 
              marketValidation.isValidating ||
              tradingValidation.isValidating
            }
          />
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[
              { key: 'location', label: 'Location', complete: !!selectedLocation },
              { key: 'market', label: 'Market', complete: !!selectedMarket },
              { key: 'analysis', label: 'Analysis', complete: !!analysis },
              { key: 'trade', label: 'Trade', complete: false }
            ].map((step, index) => (
              <div key={step.key} className="flex items-center">
                <button
                  onClick={() => setActiveSection(step.key)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-colors ${
                    activeSection === step.key
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : step.complete
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300 bg-white text-gray-500'
                  }`}
                >
                  {step.complete ? '✓' : index + 1}
                </button>
                <span className={`ml-2 text-sm font-medium ${
                  activeSection === step.key ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.label}
                </span>
                {index < 3 && <div className="w-8 h-0.5 bg-gray-300 mx-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Location & Market Selection */}
          <div className="lg:col-span-1 space-y-6">
            {/* Location Selector */}
            <div className={`transition-opacity ${activeSection === 'location' ? 'opacity-100' : 'opacity-75'}`}>
              <LocationSelector
                onLocationSelect={handleLocationSelect}
                selectedLocation={selectedLocation}
                isNight={isNight}
              />
              
              {/* Location Validation Feedback */}
              {locationValidation.aggregateValidation.hasData && (
                <div className="mt-3">
                  <ValidationAlert 
                    validation={locationValidation.aggregateValidation}
                    compact
                  />
                </div>
              )}
            </div>

            {/* Market Selector */}
            {selectedLocation && (
              <div className={`transition-opacity ${activeSection === 'market' ? 'opacity-100' : 'opacity-75'}`}>
                <ValidationAwareMarketSelector
                  onMarketSelect={handleMarketSelect}
                  location={selectedLocation.name || selectedLocation}
                  weatherData={weatherData}
                  selectedMarket={selectedMarket}
                />
                
                {/* Market Validation Feedback */}
                {marketValidation.aggregateValidation.hasData && (
                  <div className="mt-3">
                    <ValidationAlert 
                      validation={marketValidation.aggregateValidation}
                      compact
                    />
                  </div>
                )}
              </div>
            )}

            {/* Weather Visualization */}
            {weatherData && (
              <div>
                <WeatherVisualization 
                  weatherData={weatherData}
                  location={selectedLocation}
                  compact
                />
                
                {/* Weather Validation Feedback */}
                {weatherValidation.aggregateValidation.hasData && (
                  <div className="mt-3">
                    <ValidationAlert 
                      validation={weatherValidation.aggregateValidation}
                      compact
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center Panel - 3D Visualization & Analysis */}
          <div className="lg:col-span-1 space-y-6">
            {/* 3D Scene */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <Scene3D 
                weatherData={weatherData}
                location={selectedLocation}
                isNight={isNight}
              />
            </div>

            {/* Analysis Section */}
            {(activeSection === 'analysis' || analysis) && (
              <div>
                {/* Analysis Controls */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4">Weather Analysis</h3>
                  
                  <button
                    onClick={runAnalysis}
                    disabled={!canAnalyze || isAnalyzing}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      canAnalyze && !isAnalyzing
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isAnalyzing ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Analyzing...</span>
                      </div>
                    ) : (
                      'Run Weather Analysis'
                    )}
                  </button>

                  {!canAnalyze && (
                    <p className="text-sm text-gray-500 mt-2">
                      Select location, market, and ensure validations pass to analyze
                    </p>
                  )}
                </div>

                {/* Analysis Results */}
                <EnhancedAnalysisDisplay
                  analysis={analysis}
                  isLoading={isAnalyzing}
                  location={selectedLocation?.name || selectedLocation}
                  weatherData={weatherData}
                  market={selectedMarket}
                />
              </div>
            )}
          </div>

          {/* Right Panel - Trading Interface */}
          <div className="lg:col-span-1 space-y-6">
            {selectedMarket && (activeSection === 'trade' || analysis) && (
              <div>
                <EnhancedOrderForm
                  market={selectedMarket}
                  walletAddress={walletState.address}
                  isConnected={walletState.isConnected}
                  onSuccess={handleOrderSuccess}
                  isNight={isNight}
                  chainId={walletState.chainId}
                />

                {/* Trading Validation Feedback */}
                {tradingValidation.aggregateValidation.hasData && (
                  <div className="mt-3">
                    <ValidationAlert 
                      validation={tradingValidation.aggregateValidation}
                      compact
                    />
                  </div>
                )}
              </div>
            )}

            {/* Help & Tips */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-3">💡 Tips</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Choose locations that match your market type for better analysis</p>
                <p>• Weather data quality affects analysis reliability</p>
                <p>• Check validation warnings before placing orders</p>
                <p>• Consider price impact for large orders</p>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Panel (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg">
            <button
              onClick={() => setShowValidationDetails(!showValidationDetails)}
              className="text-sm font-medium text-gray-700 mb-2"
            >
              🔧 Debug Validation State {showValidationDetails ? '(Hide)' : '(Show)'}
            </button>
            
            {showValidationDetails && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <strong>Location:</strong>
                  <pre className="mt-1 bg-white p-2 rounded overflow-auto">
                    {JSON.stringify(locationValidation.aggregateValidation, null, 2)}
                  </pre>
                </div>
                <div>
                  <strong>Weather:</strong>
                  <pre className="mt-1 bg-white p-2 rounded overflow-auto">
                    {JSON.stringify(weatherValidation.aggregateValidation, null, 2)}
                  </pre>
                </div>
                <div>
                  <strong>Market:</strong>
                  <pre className="mt-1 bg-white p-2 rounded overflow-auto">
                    {JSON.stringify(marketValidation.aggregateValidation, null, 2)}
                  </pre>
                </div>
                <div>
                  <strong>Trading:</strong>
                  <pre className="mt-1 bg-white p-2 rounded overflow-auto">
                    {JSON.stringify(tradingValidation.aggregateValidation, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}