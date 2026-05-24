'use client';

import dynamic from 'next/dynamic';

// WeatherPage is a standalone full-screen page with its own Scene3D background,
// header (LocationSelector + UnifiedConnect), and navigation.
// Rendering it directly avoids layout conflicts from double Scene3D and double header.
const _WeatherPage = dynamic(() => import('@/app/WeatherPage'), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-current/30 border-t-current rounded-full animate-spin text-white mb-4" />
        <p className="text-white font-light">Loading...</p>
      </div>
    </div>
  ),
});

export default function LabsWeatherPage() {
  return <WeatherPage />;
}
