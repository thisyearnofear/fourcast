'use client';

export default function TemperatureDisplay({ weatherData, isNight, isPortalMode }) {
  if (!weatherData) return null;

  const displayWeatherData = isPortalMode && weatherData.portal ? weatherData.portal : weatherData;
  const textColor = isPortalMode || !isNight ? 'text-black' : 'text-white';

  return (
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
  );
}