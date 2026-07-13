'use client';

import React, { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Scene3D from '@/components/Scene3D';
import { useWeatherContext } from '@/components/WeatherProvider';

const ALLOWED_PATHS = new Set([
  '/',
  '/markets',
  '/signals',
  '/agent',
  '/positions',
  '/labs',
  '/labs/autopilot',
  '/labs/builder',
]);

export default function RouteScene3D() {
  const pathname = usePathname();
  const { weatherData, isLoading } = useWeatherContext();

  if (!ALLOWED_PATHS.has(pathname)) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <Scene3D
        weatherData={weatherData}
        isLoading={isLoading}
        quality="ambient"
      />
    </Suspense>
  );
}
