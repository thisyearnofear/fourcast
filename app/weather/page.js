'use client';

import WeatherPage from '../WeatherPage';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { weatherService } from '@/services/weatherService';

export default function WeatherRoute() {
  return (
    <>
      {/* Weather Prediction Context Banner */}
      <WeatherPage />
      <WeatherRelatedMarkets />
    </>
  );
}

// Inline component for weather-related prediction markets
function WeatherRelatedMarkets() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const location = await weatherService.getCurrentLocation();
        const data = await weatherService.getCurrentWeather(location);
        setWeatherData(data);

        // Fetch weather-related markets
        const res = await fetch('/api/markets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'Sports',
            limitCount: 5,
            maxDaysToResolution: 7,
            minVolume: 10000,
            theme: 'weather',
          }),
        });
        const result = await res.json();
        if (result.success && Array.isArray(result.markets)) {
          setMarkets(result.markets.slice(0, 5));
        }
      } catch (e) {
        console.warn('Could not load weather markets:', e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 30,
      padding: '12px 16px',
      background: 'rgba(10,10,15,0.7)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        maxWidth: 600,
        margin: '0 auto',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 14 }}>🌤</span>
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            Weather-Affected Markets
          </span>
        </div>

        {markets.length > 0 ? (
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'none',
          }}>
            {markets.map((m) => (
              <Link
                key={m.id || m.marketID}
                href={`/markets?analyze=${m.marketID || m.id || m.tokenID}`}
                style={{
                  flexShrink: 0,
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  textDecoration: 'none',
                  minWidth: 180,
                }}
              >
                <div style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.3,
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {m.title || m.question || 'Market'}
                </div>
                {m.currentOdds && (
                  <div style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                  }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#22c55e',
                    }}>
                      {m.currentOdds.yes || (m.bid !== undefined ? m.ask : '—')}%
                    </span>
                    {m.edge && (
                      <span style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(34,197,94,0.15)',
                        color: '#4ade80',
                      }}>
                        +{m.edge}%
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            color: 'rgba(255,255,255,0.35)',
          }}>
            No weather-affected markets found at this time.
          </div>
        )}
      </div>
    </div>
  );
}
