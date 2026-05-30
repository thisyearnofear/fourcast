'use client';
import { useState, useEffect } from 'react';
import { weatherService } from '@/services/weatherService';
import { UserPreferences } from '@/services/userPreferences';

export function useWeather() {
  const [weatherData, setWeatherData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLocationName, setCurrentLocationName] = useState('');
  const [isNight] = useState(true);

  const loadWeather = async () => {
    setIsLoading(true);
    const locationMode = UserPreferences.getLocationMode();
    let location;

    if (locationMode === 'manual') {
      location = UserPreferences.getUserLocation();
    } else if (locationMode === 'geolocation') {
      try {
        location = await weatherService.getCurrentLocation();
      } catch {
        location = null;
      }
    }

    // Default: random city (also fallback if geolocation fails)
    if (!location) {
      location = weatherService.getRandomCity();
    }

    try {
      const data = await weatherService.getCurrentWeather(location);
      setWeatherData(data);
      setCurrentLocationName(`${data.location.name}, ${data.location.region}`);
    } catch {
      try {
        const fallbackCity = weatherService.getRandomCity();
        const data = await weatherService.getCurrentWeather(fallbackCity);
        setWeatherData(data);
        setCurrentLocationName(`${data.location.name}, ${data.location.region}`);
      } catch {
        try {
          const data = await weatherService.getCurrentWeather('Nairobi');
          setWeatherData(data);
          setCurrentLocationName(`${data.location.name}, ${data.location.region}`);
        } catch {
          // Silently fail — demo data handles itself
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWeather();
  }, []);

  return { weatherData, isLoading, currentLocationName, isNight, loadWeather };
}
