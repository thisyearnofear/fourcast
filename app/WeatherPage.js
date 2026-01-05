'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Scene3D from '@/components/Scene3D';
import LocationSelector from '@/components/LocationSelector';
import { ConnectKitButton } from 'connectkit';
import { weatherService } from '@/services/weatherService';
import { WinCelebration } from '@/components/WinCelebration';
import { BuilderDashboard } from '@/components/BuilderDashboard';

export default function WeatherPage() {
  const [weatherData, setWeatherData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentLocationName, setCurrentLocationName] = useState('');
  const [isPortalMode, setIsPortalMode] = useState(false);
  const [exitPortalFunction, setExitPortalFunction] = useState(null);
  const [portalWeatherData, setPortalWeatherData] = useState(null);
  const [errorSearchQuery, setErrorSearchQuery] = useState('');
  
  // New States for UX improvements
  const [isBuilderMode, setIsBuilderMode] = useState(false);
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

                  {/* Mode Toggle Switch */}
                  <div className="hidden sm:flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20">
                    <button
                      onClick={() => setIsBuilderMode(false)}
                      className={`px-3 py-1 rounded-full text-xs transition-all ${!isBuilderMode ? 'bg-white/20 text-white font-medium' : 'text-white/60 hover:text-white'}`}
                    >
                      Trader
                    </button>
                    <button
                      onClick={() => setIsBuilderMode(true)}
                      className={`px-3 py-1 rounded-full text-xs transition-all ${isBuilderMode ? 'bg-white/20 text-white font-medium' : 'text-white/60 hover:text-white'}`}
                    >
                      Builder
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-4">
                  <LocationSelector
                    onLocationChange={handleLocationChange}
                    currentLocation={currentLocationName}
                    isLoading={isLoading}
                    isNight={isNight}
                  />
                  <ConnectKitButton
                    mode="dark"
                    customTheme={{
                      "--ck-accent-color": isNight ? "#3b82f6" : "#1e293b",
                      "--ck-accent-text": "#ffffff",
                      "--ck-primary-button-background": isNight
                        ? "rgba(255,255,255,0.2)"
                        : "#1f2937",
                    }}
                  />
                </div>
              </>
            )}
          </header>
        )}

        {/* Builder Dashboard Overlay */}
        {isBuilderMode && !isPortalMode && !isLoading && (
          <div className="absolute top-24 right-6 w-80 z-30 pointer-events-auto animate-in fade-in slide-in-from-right-10 duration-500">
             <BuilderDashboard isNight={isNight} onClose={() => setIsBuilderMode(false)} />
          </div>
        )}

        {/* Portal Coach Mark */}
        {!isPortalMode && !isLoading && !isBuilderMode && weatherData && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0 opacity-0 animate-pulse-slow delay-1000 duration-1000 fill-mode-forwards pointer-events-none">
            <div className={`flex flex-col items-center ${isNight ? 'text-white/50' : 'text-black/30'}`}>
              <span className="text-xs font-light tracking-widest uppercase mb-2">Tap a portal to travel</span>
              <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <style jsx>{`
              @keyframes pulse-slow {
                0%, 100% { opacity: 0; }
                50% { opacity: 0.8; }
              }
              .animate-pulse-slow {
                animation: pulse-slow 4s ease-in-out infinite;
              }
            `}</style>
          </div>
        )}

        {/* Spacer to push content to the bottom */}
        <div className="flex-grow" />

        {/* Centered Floating Navigation - Trader Mode Only */}
        {weatherData && !isLoading && !isBuilderMode && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 pointer-events-auto">
            <div className={`backdrop-blur-md border rounded-full px-6 py-3 transition-all duration-300 ${isNight
                ? 'bg-white/10 border-white/20 hover:bg-white/15'
                : 'bg-white/20 border-white/30 hover:bg-white/25'
              }`}>
              <div className="flex items-center space-x-6 sm:space-x-8">
                <button
                  onClick={() => window.location.href = '/markets'}
                  className={`flex items-center space-x-2 px-2 sm:px-3 py-2 rounded-lg transition-all hover:scale-110 ${isNight
                      ? 'text-white hover:bg-white/20'
                      : 'text-black hover:bg-black/20'
                    }`}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span className="text-xs sm:text-sm font-light hidden xs:inline">Markets</span>
                </button>

                <div className={`w-px h-4 ${isNight ? 'bg-white/20' : 'bg-black/20'}`}></div>

                <button
                  onClick={() => window.location.href = '/signals'}
                  className={`flex items-center space-x-2 px-2 sm:px-3 py-2 rounded-lg transition-all hover:scale-110 ${isNight
                      ? 'text-white hover:bg-white/20'
                      : 'text-black hover:bg-black/20'
                    }`}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs sm:text-sm font-light hidden xs:inline">Signals</span>
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
