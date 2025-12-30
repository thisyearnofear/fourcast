'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Scene3D from '@/components/Scene3D';
import { weatherService } from '@/services/weatherService';
import WeatherHeader from '@/components/weather/WeatherHeader';
import WeatherNavigation from '@/components/weather/WeatherNavigation';
import TemperatureDisplay from '@/components/weather/TemperatureDisplay';
import WeatherStats from '@/components/weather/WeatherStats';

export default function WeatherPage() {
  const [weatherData, setWeatherData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentLocationName, setCurrentLocationName] = useState('');
  const [isPortalMode, setIsPortalMode] = useState(false);
  const [exitPortalFunction, setExitPortalFunction] = useState(null);
  const [portalWeatherData, setPortalWeatherData] = useState(null);
  const [errorSearchQuery, setErrorSearchQuery] = useState('');

  useEffect(() => {
    console.log('Page loaded, calling loadCurrentLocationWeather');
    loadCurrentLocationWeather();
  }, []);

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

      {/* UI Container */}
      <div className="relative z-10 flex flex-col flex-grow p-4 sm:p-6">
        {/* Header */}
        <WeatherHeader
          weatherData={displayWeatherData}
          isLoading={isLoading}
          isNight={isNight}
          isPortalMode={isPortalMode}
          exitPortalFunction={exitPortalFunction}
          onLocationChange={handleLocationChange}
          currentLocationName={currentLocationName}
        />

        {/* Spacer to push content to the bottom */}
        <div className="flex-grow" />

        {/* Centered Floating Navigation */}
        {weatherData && !isLoading && (
          <WeatherNavigation isNight={isNight} />
        )}

        {/* Bottom Content */}
        {weatherData && !isLoading && (
          <footer
            className={`flex justify-between items-end ${textColor}`}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <TemperatureDisplay 
              weatherData={displayWeatherData}
              isNight={isNight}
              isPortalMode={isPortalMode}
            />
            
            <WeatherStats 
              weatherData={displayWeatherData}
              isPortalMode={isPortalMode}
            />
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