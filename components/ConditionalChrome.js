'use client';

import { usePathname } from 'next/navigation';
import HUDToggle from '@/components/HUDToggle';
import LocationSettingsButton from '@/components/LocationSettingsButton';

/**
 * Legacy weather HUD / location chrome — only on weather lab routes.
 */
export default function ConditionalChrome() {
  const pathname = usePathname();
  const isWeatherRoute =
    pathname?.startsWith('/labs/weather') || pathname === '/weather';

  if (!isWeatherRoute) return null;

  return (
    <>
      <HUDToggle />
      <LocationSettingsButton />
    </>
  );
}
