'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Scene3D from '@/components/Scene3D';
import LocationSelector from '@/components/LocationSelector';
import WalletConnect from '@/app/components/WalletConnect';
import { weatherService } from '@/services/weatherService';
import { WinCelebration } from '@/components/WinCelebration';

export default function WeatherPage() {
  const [weatherData, setWeatherData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentLocationName, setCurrentLocationName] = useState('');
  const [isPortalMode, setIsPortalMode] = useState(false);
  const [exitPortalFunction, setExitPortalFunction] = useState(null);
  const [portalWeatherData, setPortalWeatherData] = useState(null);
  const [errorSearchQuery, setErrorSearchQuery] = useState('');
  
  const [showCelebration, setShowCelebration] = useState(false);
  const [winningSignal, setWinningSignal] = useState(null);

  useEffect(() => {
    console.log('Page loaded, calling loadCurrentLocationWeather');
    loadCurrentLocationWeather();
  }, []);

  // ... (existing loadCurrentLocationWeather) ...
  const loadCurrentLocationWeather = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const location = await weatherService.getCurrentLocation();
      const data = await weatherService.getCurrentWeather(location);
      setWeatherData(data);
      setCurrentLocationName(`${data.location.name}, ${data.location.region}`);
    } catch (error) {
      console.error('Error loading weather:', error);
      // Fallback to default location if geolocation fails
      try {
        const data = await weatherService.getCurrentWeather('Nairobi');
        setWeatherData(data);
        setCurrentLocationName(`${data.location.name}, ${data.location.region}`);
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
        setError('Unable to load weather data. Please try entering a city manually.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationChange = async (location) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await weatherService.getCurrentWeather(location);
      console.log('Setting weather data:', data);
      setWeatherData(data);
      setCurrentLocationName(`${data.location.name}, ${data.location.region}`);
    } catch (error) {
      console.error('Error loading weather for location:', error);
      setError('Unable to load weather data for this location. Please try a different city.');
    } finally {
      setIsLoading(false);
    }
  };

  const isNightTime = () => {
    if (!weatherData?.location?.localtime) return false;
    const localTime = weatherData.location.localtime;
    const currentHour = new Date(localTime).getHours();
    return currentHour >= 19 || currentHour <= 6;
  };

  const handlePortalWeatherDataChange = (data) => {
    setPortalWeatherData(data);
  };

  const handleErrorSearch = async (e) => {
    e.preventDefault();
    if (errorSearchQuery.trim()) {
      await handleLocationChange(errorSearchQuery.trim());
      setErrorSearchQuery('');
    }
  };

  // Callback to trigger celebration from child components (e.g. OrderSigningPanel)
  // To be passed down via Context or Props if we were rendering OrderSigningPanel here.
  // For now, we simulate it for the demo or when a trade confirms.
  const handleTradeSuccess = (orderData) => {
    setWinningSignal({
      marketTitle: orderData.marketTitle || "Your Prediction Market",
      side: orderData.side || "YES",
      confidence: "high"
    });
    setShowCelebration(true);
  };

  // Use portal weather data when in portal mode, otherwise use main weather data
  const displayWeatherData = useMemo(() =>
    (isPortalMode && portalWeatherData ? portalWeatherData : weatherData),
    [isPortalMode, portalWeatherData, weatherData]
  );

  // Memoized calculated values
  const isNight = useMemo(() => isNightTime(), [weatherData?.location?.localtime]);
  const textColor = useMemo(() =>
    (isPortalMode || !isNight) ? 'text-black' : 'text-white',
    [isPortalMode, isNight]
  );

  // Show hero/onboarding on first visit
  const [showHero, setShowHero] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem('fourcast_visited');
  });

  const dismissHero = () => {
    localStorage.setItem('fourcast_visited', 'true');
    setShowHero(false);
  };

  return (
    <div className="w-screen h-screen min-h-dvh relative flex flex-col">
      {/* 3D Scene fills entire viewport - base layer */}
      <div className="absolute inset-0 z-0">
        <Scene3D
          weatherData={weatherData}
          isLoading={isLoading}
          onPortalModeChange={setIsPortalMode}
          onSetExitPortalFunction={setExitPortalFunction}
          onPortalWeatherDataChange={handlePortalWeatherDataChange}
        />
      </div>

      {/* Hero Overlay - First Visit */}
      {showHero && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-lg w-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">🔮</div>
              <h1 className="text-2xl font-bold text-white">Fourcast</h1>
            </div>
            
            <p className="text-lg text-white/90 mb-1 font-light">
              Predict Smarter with AI Intelligence
            </p>
            <p className="text-sm text-white/60 mb-6 leading-relaxed">
              We analyze 200+ ML models, live weather data, and market dynamics to find prediction edges.
            </p>

            {/* Interactive Demo Card - Shows what the product does */}
            <div className="mb-6 backdrop-blur-sm bg-white/5 border border-white/15 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Polymarket
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  🤖 ML
                </span>
              </div>
              
              <p className="text-white font-medium mb-3 text-sm">
                Will Bitcoin exceed $100k by April 2026?
              </p>

              {/* AI Confidence Visualization */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-white/60">AI Confidence</span>
                  <span className="text-xs font-medium text-green-400">73%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500/80 to-green-500/80 rounded-full" style={{width: '73%'}}></div>
                </div>
              </div>

              {/* Weather Impact */}
              <div className="flex items-center gap-4 mb-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span>☀️</span>
                  <span className="text-white/70">Weather: Favorable</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-green-400">⚡</span>
                  <span className="text-white/70">Edge: +8%</span>
                </div>
              </div>

              {/* Market Odds */}
              <div className="flex justify-between items-center pt-3 border-t border-white/10">
                <div>
                  <span className="text-xs text-white/50 block">Market YES</span>
                  <span className="text-lg font-light text-green-400">65%</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-white/50 block">ML Fair</span>
                  <span className="text-lg font-light text-purple-400">73%</span>
                </div>
              </div>
            </div>

            {/* Feature Pills - Quick value props */}
            <div className="flex flex-wrap gap-2 mb-6">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                <span>🤖</span>
                <span>200+ ML Models</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                <span>🌤️</span>
                <span>Live Weather</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                <span>📡</span>
                <span>On-Chain Proofs</span>
              </div>
            </div>

            <button
              onClick={dismissHero}
              className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium rounded-xl transition-all transform hover:scale-[1.02]"
            >
              Explore Markets →
            </button>
            
            <button
              onClick={dismissHero}
              className="w-full py-2 mt-2 text-white/50 hover:text-white/70 text-sm transition-colors"
            >
              Skip tour
            </button>
          </div>
        </div>
      )}

      {/* Celebration Overlay */}
      <WinCelebration 
        isOpen={showCelebration}
        signal={winningSignal}
        onClose={() => setShowCelebration(false)}
      />

      {/* UI Container */}
      <div className="relative z-10 flex flex-col flex-grow p-4 sm:p-6 pointer-events-none">
        
        {/* Header */}
        {weatherData && !isLoading && (
          <header className="flex justify-between items-start pointer-events-auto">
            {isPortalMode ? (
              <>
                {/* Portal Mode Header */}
                <div className={`flex-1 ${textColor}`}>
                  <button
                    onClick={() => exitPortalFunction?.()}
                    className={`flex items-center space-x-2 px-2 sm:px-4 py-2 ${textColor} opacity-80 hover:opacity-100 transition-opacity`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    <span className="text-xs sm:text-sm font-light">Back</span>
                  </button>
                </div>
                {/* ... existing portal mode title ... */}
                <div className={`text-right ${textColor}`}>
                  <div className="text-base sm:text-lg font-light tracking-wide opacity-95">
                    {displayWeatherData.location.name}
                    {displayWeatherData.rateLimited && (
                      <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                        DEMO
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm opacity-60 tracking-wide">
                    {displayWeatherData.location.region}
                  </div>
                </div>
              </>
            ) : (
              /* Normal Mode Header */
              <>
                <div className={`flex-1 ${textColor} flex items-center gap-4`}>
                  <div>
                    <div className="text-base sm:text-lg font-light tracking-wide opacity-95">
                      {displayWeatherData.location.name}
                      {displayWeatherData.rateLimited && (
                        <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                          DEMO
                        </span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm opacity-60 tracking-wide">
                      {displayWeatherData.location.region}
                    </div>
                  </div>

                </div>

                <div className="flex items-center space-x-2 sm:space-x-4">
                  <LocationSelector
                    onLocationChange={handleLocationChange}
                    currentLocation={currentLocationName}
                    isLoading={isLoading}
                    isNight={isNight}
                  />
                  <WalletConnect isNight={isNight} />
                </div>
              </>
            )}
          </header>
        )}

        {/* Portal Coach Mark — anchored near the portals at the bottom */}
        {!isPortalMode && !isLoading && weatherData && (
          <div className="absolute bottom-28 sm:bottom-32 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none portal-coach-mark">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${isNight ? 'glass-subtle' : 'glass-subtle-light'} ${isNight ? 'text-white/60' : 'text-black/40'}`}>
              <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <span className="text-xs font-medium tracking-wide">Tap a forecast card to explore 3D weather</span>
            </div>
            <style jsx>{`
              .portal-coach-mark {
                animation: coach-fade 8s ease-in-out infinite;
              }
              @keyframes coach-fade {
                0%, 100% { opacity: 0; }
                10%, 90% { opacity: 1; }
              }
            `}</style>
          </div>
        )}

        {/* Spacer to push content to the bottom */}
        <div className="flex-grow" />

        {/* Centered Floating Navigation - Icons on mobile, full labels on desktop */}
        {weatherData && !isLoading && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 pointer-events-auto">
            <div className={`backdrop-blur-md border rounded-full px-2 sm:px-6 py-2 sm:py-3 transition-all duration-300 ${isNight
                ? 'bg-white/10 border-white/20 hover:bg-white/15'
                : 'bg-white/20 border-white/30 hover:bg-white/25'
              }`}>
              <div className="flex items-center space-x-1 sm:space-x-6">
                <button
                  onClick={() => window.location.href = '/markets'}
                  className={`group flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-full transition-all hover:scale-105 ${isNight
                      ? 'text-white hover:bg-white/15'
                      : 'text-black hover:bg-black/10'
                    }`}
                  title="Markets - Browse & trade predictions"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium leading-tight">Markets</span>
                    <span className={`text-[10px] leading-tight ${isNight ? 'text-white/50' : 'text-black/40'}`}>Browse & trade predictions</span>
                  </div>
                </button>

                <div className={`w-px h-6 sm:h-8 ${isNight ? 'bg-white/15' : 'bg-black/15'}`}></div>

                <button
                  onClick={() => window.location.href = '/signals'}
                  className={`group flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-full transition-all hover:scale-105 ${isNight
                      ? 'text-white hover:bg-white/15'
                      : 'text-black hover:bg-black/10'
                    }`}
                  title="Signals - Predictions & track records"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium leading-tight">Signals</span>
                    <span className={`text-[10px] leading-tight ${isNight ? 'text-white/50' : 'text-black/40'}`}>Predictions & track records</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Content */}
        {weatherData && !isLoading && (
          <footer
            className={`flex justify-between items-end ${textColor}`}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Main Temperature Card */}
            <div className="flex items-end space-x-2 sm:space-x-4">
              <div className="flex items-baseline">
                <span className="text-5xl sm:text-6xl font-thin leading-none">
                  {Math.round(displayWeatherData.current.temp_f)}
                </span>
                <span className="text-xl sm:text-2xl font-thin opacity-75">
                  °
                </span>
              </div>
              <div className="pb-1 sm:pb-2">
                <div className="text-xs sm:text-sm font-light opacity-80 capitalize mb-1">
                  {displayWeatherData.current.condition.text}
                </div>
                <div className="text-xs opacity-60 space-y-0.5">
                  <div>
                    H: {Math.round(displayWeatherData.current.temp_f + 5)}° L:{" "}
                    {Math.round(displayWeatherData.current.temp_f - 10)}°
                  </div>
                </div>
              </div>
            </div>


            {/* Compact Stats Bar */}
            <div className="flex flex-col space-y-2 sm:space-y-3 text-right text-xs sm:text-sm">
              <div className="flex items-center justify-end space-x-2">
                <span className="opacity-60">HUMIDITY</span>
                <span className="font-light">
                  {displayWeatherData.current.humidity}%
                </span>
              </div>
              <div className="flex items-center justify-end space-x-2">
                <span className="opacity-60">WIND</span>
                <span className="font-light">
                  {Math.round(displayWeatherData.current.wind_mph)} mph
                </span>
              </div>
              <div className="flex items-center justify-end space-x-2">
                <span className="opacity-60">FEELS</span>
                <span className="font-light">
                  {Math.round(displayWeatherData.current.feelslike_f)}°
                </span>
              </div>
              <div className="flex items-center justify-end space-x-2">
                <span className="opacity-60">VISIBILITY</span>
                <span className="font-light">
                  {Math.round(displayWeatherData.current.vis_miles)} mi
                </span>
              </div>
            </div>
          </footer>
        )}
      </div>



      {/* Loading and Error Modals */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-50">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
          <p className="text-lg font-light">Loading weather data...</p>
        </div>
      )}

      {error && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-lg z-50">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 max-w-sm mx-4 text-center border border-white/20">
            <p className="text-white text-lg font-light mb-6 leading-relaxed">
              {error}
            </p>

            <form onSubmit={handleErrorSearch} className="mb-6">
              <div className="flex items-center space-x-2 bg-white/10 rounded-2xl p-3 border border-white/20">
                <input
                  type="text"
                  value={errorSearchQuery}
                  onChange={(e) => setErrorSearchQuery(e.target.value)}
                  placeholder="Enter city name..."
                  className="flex-1 bg-transparent text-white placeholder-white/60 focus:outline-none text-sm font-light"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  className="text-white/80 hover:text-white transition-colors disabled:opacity-40"
                  disabled={!errorSearchQuery.trim() || isLoading}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
              </div>
            </form>

            <div className="flex space-x-3">
              <button
                onClick={loadCurrentLocationWeather}
                className="flex-1 bg-white/20 hover:bg-white/30 px-4 py-3 rounded-2xl text-white font-light transition-all duration-300 border border-white/30 hover:scale-105 text-sm"
                disabled={isLoading}
              >
                Try Location Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
