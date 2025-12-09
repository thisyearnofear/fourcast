import { convertOpenMeteoToWeatherAPI } from '../../../services/dataConverter.js';

// Simple in-memory cache that works locally and with Next.js
const cache = new Map();
const rateLimitMap = new Map();

// Cache duration: 10 minutes
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
// For testing: temporarily set to 2 requests to test rate limiting quickly
// Change back to 20 for production
const MAX_REQUESTS_PER_HOUR = 15;

// Helper function to get client IP in Next.js
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIp) {
    return realIp.trim();
  }

  return '127.0.0.1';
}

// Rate limiting function
function isRateLimited(ip) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(ip) || [];

  // Remove old requests outside the window
  const validRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

  if (validRequests.length >= MAX_REQUESTS_PER_HOUR) {
    return true;
  }

  // Add current request
  validRequests.push(now);
  rateLimitMap.set(ip, validRequests);

  return false;
}

// Demo data function
function getDemoWeatherData(requestedLocation) {
  return {
    location: {
      name: "Demo City",
      region: "Demo State",
      country: "Demo Country",
      lat: 40.7128,
      lon: -74.0060,
      tz_id: "America/New_York",
      localtime_epoch: Math.floor(Date.now() / 1000),
      localtime: new Date().toISOString().slice(0, -5) // Remove Z and milliseconds
    },
    current: {
      last_updated_epoch: Math.floor(Date.now() / 1000),
      last_updated: new Date().toISOString().slice(0, -5),
      temp_c: 22,
      temp_f: 72,
      is_day: new Date().getHours() >= 6 && new Date().getHours() <= 18 ? 1 : 0,
      condition: {
        text: "Partly cloudy",
        icon: "//cdn.weatherapi.com/weather/64x64/day/116.png",
        code: 1003
      },
      wind_mph: 8.5,
      wind_kph: 13.7,
      wind_degree: 230,
      wind_dir: "SW",
      pressure_mb: 1013.0,
      pressure_in: 29.91,
      precip_mm: 0.0,
      precip_in: 0.0,
      humidity: 65,
      cloud: 40,
      feelslike_c: 24,
      feelslike_f: 75,
      vis_km: 16.0,
      vis_miles: 10.0,
      uv: 5.0,
      gust_mph: 12.1,
      gust_kph: 19.4
    },
    forecast: {
      forecastday: [
        {
          date: new Date().toISOString().split('T')[0],
          date_epoch: Math.floor(Date.now() / 1000),
          day: {
            maxtemp_c: 26,
            maxtemp_f: 79,
            mintemp_c: 18,
            mintemp_f: 64,
            avgtemp_c: 22,
            avgtemp_f: 72,
            maxwind_mph: 12.1,
            maxwind_kph: 19.4,
            totalprecip_mm: 0.0,
            totalprecip_in: 0.0,
            totalsnow_cm: 0.0,
            avgvis_km: 16.0,
            avgvis_miles: 10.0,
            avghumidity: 65,
            daily_will_it_rain: 0,
            daily_chance_of_rain: 10,
            daily_will_it_snow: 0,
            daily_chance_of_snow: 0,
            condition: {
              text: "Partly cloudy",
              icon: "//cdn.weatherapi.com/weather/64x64/day/116.png",
              code: 1003
            },
            uv: 5.0
          }
        },
        // Tomorrow
        {
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          date_epoch: Math.floor(Date.now() / 1000) + 86400,
          day: {
            maxtemp_c: 24,
            maxtemp_f: 75,
            mintemp_c: 16,
            mintemp_f: 61,
            avgtemp_c: 20,
            avgtemp_f: 68,
            maxwind_mph: 10.5,
            maxwind_kph: 16.9,
            totalprecip_mm: 2.1,
            totalprecip_in: 0.08,
            totalsnow_cm: 0.0,
            avgvis_km: 12.0,
            avgvis_miles: 7.0,
            avghumidity: 72,
            daily_will_it_rain: 1,
            daily_chance_of_rain: 80,
            daily_will_it_snow: 0,
            daily_chance_of_snow: 0,
            condition: {
              text: "Light rain",
              icon: "//cdn.weatherapi.com/weather/64x64/day/296.png",
              code: 1183
            },
            uv: 3.0
          }
        },
        // Day after tomorrow
        {
          date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
          date_epoch: Math.floor(Date.now() / 1000) + 172800,
          day: {
            maxtemp_c: 28,
            maxtemp_f: 82,
            mintemp_c: 20,
            mintemp_f: 68,
            avgtemp_c: 24,
            avgtemp_f: 75,
            maxwind_mph: 15.2,
            maxwind_kph: 24.4,
            totalprecip_mm: 0.0,
            totalprecip_in: 0.0,
            totalsnow_cm: 0.0,
            avgvis_km: 16.0,
            avgvis_miles: 10.0,
            avghumidity: 58,
            daily_will_it_rain: 0,
            daily_chance_of_rain: 5,
            daily_will_it_snow: 0,
            daily_chance_of_snow: 0,
            condition: {
              text: "Sunny",
              icon: "//cdn.weatherapi.com/weather/64x64/day/113.png",
              code: 1000
            },
            uv: 7.0
          }
        }
      ]
    },
    rateLimited: true, // Flag to indicate this is demo data
    cached: false,
    requestedLocation: requestedLocation // Store what user actually searched for
  };
}



async function getWeatherData(location, ip) {
  if (isRateLimited(ip)) {
    console.log(`Rate limit exceeded for IP: ${ip}, serving demo data`);
    return getDemoWeatherData(location);
  }

  const cacheKey = `weather:${location.toLowerCase()}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Cache hit for location: ${location}`);
    return {
      ...cachedData.data,
      cached: true,
      cacheAge: Math.round((Date.now() - cachedData.timestamp) / 1000),
    };
  }

  // Try Open-Meteo first (free, no API key required)
  try {
    console.log('Trying Open-Meteo API for location:', location);
    // Geocode location to get coordinates using Open-Meteo Geocoding API
    const geocodeResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`);
    if (geocodeResponse.ok) {
      const geocodeData = await geocodeResponse.json();
      if (geocodeData.results && geocodeData.results.length > 0) {
        const { latitude, longitude, name } = geocodeData.results[0];
        
        // Get weather data
        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone}&forecast_days=7`);
        
        if (weatherResponse.ok) {
          const weatherData = await weatherResponse.json();
          const convertedData = convertOpenMeteoToWeatherAPI(weatherData, name);
          
          // Cache the converted data
          cache.set(cacheKey, {
            data: convertedData,
            timestamp: Date.now(),
          });
          
          if (cache.size > 100) {
            const oldestKey = cache.keys().next().value;
            cache.delete(oldestKey);
          }
          
          console.log(`Successfully fetched weather data from Open-Meteo for: ${location}`);
          return {
            ...convertedData,
            cached: false,
          };
        }
      }
    }
  } catch (openMeteoError) {
    console.log('Open-Meteo API failed, falling back to WeatherAPI:', openMeteoError.message);
  }

  const API_KEY =
    process.env.NEXT_PUBLIC_WEATHER_API_KEY || process.env.WEATHER_API_KEY;

  if (!API_KEY) {
    throw new Error("Server configuration error");
  }

  const weatherResponse = await fetch(
    `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${encodeURIComponent(
      location
    )}&days=3&aqi=no&alerts=no&tz=${
      Intl.DateTimeFormat().resolvedOptions().timeZone
    }`
  );

  if (!weatherResponse.ok) {
    const errorData = await weatherResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Weather API error");
  }

  const weatherData = await weatherResponse.json();

  cache.set(cacheKey, {
    data: weatherData,
    timestamp: Date.now(),
  });

  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  return {
    ...weatherData,
    cached: false,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location");

  if (!location) {
    return Response.json({ error: "Location parameter is required" }, { status: 400 });
  }

  try {
    const clientIP = getClientIP(request);
    const weatherData = await getWeatherData(location, clientIP);
    return Response.json(weatherData);
  } catch (error) {
    console.error("Weather API error:", error);
    return Response.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const {
    untrustedData: { inputText },
  } = await req.json();
  const location = inputText || "Nairobi";

  try {
    const clientIP = getClientIP(req);
    const weatherData = await getWeatherData(location, clientIP);

    const temp = Math.round(weatherData.current.temp_f);
    const condition = weatherData.current.condition.text;

    const imageUrl = `${process.env.NEXT_PUBLIC_HOST}/api/og?temp=${temp}&condition=${condition}&location=${weatherData.location.name}`;

    return new Response(
      `
      <meta name="fc:frame" content="vNext" />
      <meta name="fc:frame:image" content="${imageUrl}" />
      <meta name="og:image" content="${imageUrl}" />
      <meta name="fc:frame:input:text" content="Enter a city" />
      <meta name="fc:frame:button:1" content="Get Weather" />
      `,
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }
    );
  } catch (error) {
    return new Response("Error", { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}