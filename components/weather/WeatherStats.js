'use client';

export default function WeatherStats({ weatherData, isPortalMode }) {
  if (!weatherData) return null;

  const displayWeatherData = isPortalMode && weatherData.portal ? weatherData.portal : weatherData;

  return (
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
  );
}