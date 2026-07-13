'use client';

import React, { createContext, useContext } from 'react';
import { useWeather } from '@/hooks/useWeather';

const WeatherContext = createContext({
  weatherData: null,
  isLoading: true,
  isNight: true,
});

export function WeatherProvider({ children }) {
  const weatherState = useWeather();

  return (
    <WeatherContext.Provider value={weatherState}>
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeatherContext() {
  return useContext(WeatherContext);
}
