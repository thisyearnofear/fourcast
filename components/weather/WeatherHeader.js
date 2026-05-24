'use client';

import LocationSelector from '@/components/LocationSelector';
import { ConnectKitButton } from 'connectkit';

export default function WeatherHeader({ 
  weatherData, 
  isLoading, 
  isNight, 
  isPortalMode,
  exitPortalFunction,
  onLocationChange,
  currentLocationName
}) {
  if (!weatherData || isLoading) return null;

  const textColor = isPortalMode || !isNight ? 'text-black' : 'text-white';

  if (isPortalMode) {
    return (
      <header className="flex justify-between items-start">
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
        <div className={`text-right ${textColor}`}>
          <div className="text-base sm:text-lg font-light tracking-wide opacity-95">
            {weatherData.location.name}
            {weatherData.rateLimited && (
              <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                DEMO
              </span>
            )}
          </div>
          <div className="text-xs sm:text-sm opacity-60 tracking-wide">
            {weatherData.location.region}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="flex justify-between items-start">
      <div className={`flex-1 ${textColor}`}>
        <div className="text-base sm:text-lg font-light tracking-wide opacity-95">
          {weatherData.location.name}
          {weatherData.rateLimited && (
            <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
              DEMO
            </span>
          )}
        </div>
        <div className="text-xs sm:text-sm opacity-60 tracking-wide">
          {weatherData.location.region}
        </div>
      </div>
      <div className="flex items-center space-x-2 sm:space-x-4">
        <LocationSelector
          onLocationChange={onLocationChange}
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
    </header>
  );
}