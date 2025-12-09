/**
 * Data conversion utilities for normalizing weather data from different sources
 * to the WeatherAPI format used throughout the application
 */

/**
 * Convert temperature from Celsius to Fahrenheit
 */
export const celsiusToFahrenheit = (celsius) => (celsius * 9/5) + 32;

/**
 * Convert wind speed from km/h to mph
 */
export const kmhToMph = (kmh) => kmh / 1.60934;

/**
 * Convert millimeters to inches
 */
export const mmToInches = (mm) => mm / 25.4;

/**
 * Calculate wind direction from degrees (0-360)
 */
export const getWindDirection = (degrees) => {
  if (degrees === undefined || degrees === null) return 'N';
  
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((degrees % 360) / 22.5)) % 16;
  return dirs[index];
};

/**
 * Determine if it's daytime based on current time
 */
export const isDaytime = () => {
  const hour = new Date().getHours();
  return hour >= 6 && hour <= 18 ? 1 : 0;
};

/**
 * Get weather condition text from Open-Meteo data
 */
export const getConditionFromOpenMeteo = (weatherCode, precipitation, isDay = true) => {
  // WMO Weather interpretation codes
  // https://www.open-meteo.com/en/docs
  
  if (weatherCode === 0) return 'Clear sky';
  if (weatherCode === 1 || weatherCode === 2) return 'Mainly clear';
  if (weatherCode === 3) return 'Overcast';
  if (weatherCode === 45 || weatherCode === 48) return 'Foggy';
  if (weatherCode >= 51 && weatherCode <= 67) return 'Drizzle';
  if (weatherCode >= 71 && weatherCode <= 77) return 'Snow';
  if (weatherCode === 80 || weatherCode === 81 || weatherCode === 82) return 'Rain showers';
  if (weatherCode === 85 || weatherCode === 86) return 'Snow showers';
  if (weatherCode >= 80 && weatherCode <= 82) return 'Rain';
  if (weatherCode >= 90 && weatherCode <= 99) return 'Thunderstorm';
  
  // Fallback based on precipitation
  if (precipitation > 0) return 'Rainy';
  return 'Clear';
};

/**
 * Convert Open-Meteo API response to WeatherAPI format
 */
export const convertOpenMeteoToWeatherAPI = (openMeteoData, locationName) => {
  if (!openMeteoData || !openMeteoData.hourly || !openMeteoData.daily) {
    throw new Error('Invalid Open-Meteo data structure');
  }

  // Find current hour index
  const now = new Date();
  const currentHourIndex = openMeteoData.hourly.time.findIndex(time => {
    const hourTime = new Date(time);
    return hourTime.getDate() === now.getDate() && hourTime.getHours() === now.getHours();
  }) || 0;

  // Get current hourly data
  const currentTempC = openMeteoData.hourly.temperature_2m[currentHourIndex];
  const currentWindSpeedKmh = openMeteoData.hourly.wind_speed_10m[currentHourIndex] || 0;
  const currentWindDirection = openMeteoData.hourly.wind_direction_10m?.[currentHourIndex] || 0;
  const currentPrecip = openMeteoData.hourly.precipitation[currentHourIndex] || 0;
  const currentHumidity = openMeteoData.hourly.relative_humidity_2m[currentHourIndex] || 0;
  const isDay = isDaytime();

  // Get weather code if available
  const weatherCode = openMeteoData.hourly.weather_code?.[currentHourIndex];

  // Create forecast days (using daily data)
  const forecastDays = openMeteoData.daily.time.slice(0, 3).map((date, index) => {
    const dateObj = new Date(date);
    const maxTempC = openMeteoData.daily.temperature_2m_max[index];
    const minTempC = openMeteoData.daily.temperature_2m_min[index];
    const avgTempC = (maxTempC + minTempC) / 2;
    const precipitation = openMeteoData.daily.precipitation_sum[index] || 0;
    const windSpeedKmh = openMeteoData.daily.windspeed_10m_max?.[index] || 0;

    return {
      date: date,
      date_epoch: Math.floor(dateObj.getTime() / 1000),
      day: {
        maxtemp_c: maxTempC,
        maxtemp_f: celsiusToFahrenheit(maxTempC),
        mintemp_c: minTempC,
        mintemp_f: celsiusToFahrenheit(minTempC),
        avgtemp_c: avgTempC,
        avgtemp_f: celsiusToFahrenheit(avgTempC),
        maxwind_mph: kmhToMph(windSpeedKmh),
        maxwind_kph: windSpeedKmh,
        totalprecip_mm: precipitation,
        totalprecip_in: mmToInches(precipitation),
        totalsnow_cm: openMeteoData.daily.snowfall_sum?.[index] || 0,
        avgvis_km: 10,
        avgvis_miles: 6.2,
        avghumidity: openMeteoData.daily.relative_humidity_2m_max?.[index] || 70,
        daily_will_it_rain: precipitation > 0 ? 1 : 0,
        daily_chance_of_rain: precipitation > 0 ? 80 : 10,
        daily_will_it_snow: openMeteoData.daily.snowfall_sum?.[index] > 0 ? 1 : 0,
        daily_chance_of_snow: openMeteoData.daily.snowfall_sum?.[index] > 0 ? 50 : 0,
        condition: {
          text: getConditionFromOpenMeteo(
            openMeteoData.daily.weather_code?.[index],
            precipitation,
            index === 0 ? isDay : 1
          ),
          icon: "//cdn.weatherapi.com/weather/64x64/day/113.png",
          code: weatherCode || 1000
        },
        uv: openMeteoData.daily.uv_index_max?.[index] || 3
      }
    };
  });

  return {
    location: {
      name: locationName || "Unknown Location",
      region: "",
      country: "",
      lat: openMeteoData.latitude,
      lon: openMeteoData.longitude,
      tz_id: openMeteoData.timezone,
      localtime_epoch: Math.floor(Date.now() / 1000),
      localtime: new Date().toISOString().slice(0, -5)
    },
    current: {
      last_updated_epoch: Math.floor(Date.now() / 1000),
      last_updated: new Date().toISOString().slice(0, -5),
      temp_c: currentTempC,
      temp_f: celsiusToFahrenheit(currentTempC),
      is_day: isDay,
      condition: {
        text: getConditionFromOpenMeteo(weatherCode, currentPrecip, isDay),
        icon: "//cdn.weatherapi.com/weather/64x64/day/113.png",
        code: weatherCode || 1000
      },
      wind_mph: kmhToMph(currentWindSpeedKmh),
      wind_kph: currentWindSpeedKmh,
      wind_degree: currentWindDirection,
      wind_dir: getWindDirection(currentWindDirection),
      pressure_mb: 1013,
      pressure_in: 29.92,
      precip_mm: currentPrecip,
      precip_in: mmToInches(currentPrecip),
      humidity: currentHumidity,
      cloud: 25,
      feelslike_c: currentTempC,
      feelslike_f: celsiusToFahrenheit(currentTempC),
      vis_km: 10,
      vis_miles: 6.2,
      uv: openMeteoData.hourly.uv_index?.[currentHourIndex] || 3,
      gust_mph: kmhToMph(currentWindSpeedKmh * 1.3),
      gust_kph: currentWindSpeedKmh * 1.3
    },
    forecast: {
      forecastday: forecastDays
    },
    rateLimited: false,
    serviceUnavailable: false,
    requestedLocation: locationName,
    cached: false,
    source: 'open-meteo'
  };
};
