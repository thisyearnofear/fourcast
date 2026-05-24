'use client';

import { useState, useEffect } from 'react';


import { weatherService } from '@/services/weatherService';
import dynamic from 'next/dynamic';

const _WalletConnect = dynamic(() => import('@/app/components/WalletConnect'), {
  ssr: false,
});

const LAB_FEATURES = [
  {
    id: 'autopilot',
    title: 'Autopilot',
    description: 'Full autonomous trade execution with Kelly Criterion sizing, live agent loop, and execution history.',
    href: '/labs/autopilot',
    icon: '🤖',
    status: 'beta',
    gradient: 'from-cyan-600 to-blue-500',
  },
  {
    id: 'builder',
    title: 'Builder Program',
    description: 'Polymarket Builder integration with gasless trading, volume tracking, and leaderboard.',
    href: '/labs/builder',
    icon: '🏗️',
    status: 'beta',
    gradient: 'from-amber-600 to-orange-500',
  },
  {
    id: 'weather',
    title: 'Weather',
    description: 'Live weather data and its impact on prediction markets — standalone page.',
    href: '/labs/weather',
    icon: '🌤️',
    status: 'stable',
    gradient: 'from-sky-600 to-cyan-500',
  },
  {
    id: 'telegram',
    title: 'Telegram Bot',
    description: '@fourcasterbot — query /edge commands via messaging without a wallet.',
    href: 'https://t.me/fourcasterbot',
    icon: '💬',
    status: 'stable',
    external: true,
    gradient: 'from-blue-600 to-indigo-500',
  },
  {
    id: '3d',
    title: '3D Scene',
    description: 'Immersive weather-reactive 3D backdrop that powers the app theme.',
    href: '/markets',
    icon: '🌌',
    status: 'stable',
    gradient: 'from-purple-600 to-pink-500',
  },
];

export default function LabsPage() {
  const [isNight, setIsNight] = useState(() => {
    const hour = new Date().getHours();
    return hour >= 19 || hour <= 6;
  });
  const [weatherData, setWeatherData] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);

  useEffect(() => {
    loadWeather();
  }, []);

  const loadWeather = async () => {
    try {
      const location = await weatherService.getCurrentLocation();
      const data = await weatherService.getCurrentWeather(location);
      setWeatherData(data);
      if (data?.location?.localtime) {
        const currentHour = new Date(data.location.localtime).getHours();
        setIsNight(currentHour >= 19 || currentHour <= 6);
      }
    } catch (err) {
      try {
        const data = await weatherService.getCurrentWeather('Nairobi');
        setWeatherData(data);
      } catch { /* empty */ }
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const textColor = isNight ? 'text-white' : 'text-black';
  const cardBgColor = isNight
    ? 'bg-slate-900/60 border-white/20'
    : 'bg-white/60 border-black/20';

  return (
    <div className="min-h-screen relative">
      {/* 3D Scene Background */}
      <div className="fixed inset-0 z-0">
        <Scene3D
          weatherData={weatherData}
          isLoading={isLoadingWeather}
          quality="ambient"
        />
      </div>

      {/* Content */}
      <div className="relative z-20 flex flex-col min-h-screen overflow-y-auto">
        {/* Header */}
        <header className={`sticky top-0 z-50 border-b ${cardBgColor} backdrop-blur-md`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex justify-between items-center">
            <div>
              <h1 className={`text-3xl font-thin ${textColor} tracking-wide`}>
                🧪 Labs
              </h1>
              <p className={`text-sm ${textColor} opacity-60 mt-2 font-light`}>
                Experimental features — not part of the core product loop
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <PageNav currentPage="Labs" isNight={isNight} />
              <WalletConnect isNight={isNight} />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
          {/* Labs Notice */}
          <div className={`${cardBgColor} backdrop-blur-sm border rounded-2xl p-5 mb-10`}>
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">🧪</div>
              <div>
                <h3 className={`text-sm font-medium ${textColor} mb-1`}>
                  Experimental Zone
                </h3>
                <p className={`text-xs ${textColor} opacity-60 leading-relaxed`}>
                  These features are experimental or peripheral to the core product loop. 
                  They remain fully functional but are not actively promoted in the primary navigation.
                  Feedback welcome.
                </p>
              </div>
            </div>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LAB_FEATURES.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                isNight={isNight}
                textColor={textColor}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function _FeatureCard({ feature, isNight, textColor }) {
  const isStable = feature.status === 'stable';
  const isExternal = feature.external;

  const _Tag = isExternal ? 'a' : 'a';
  const extraProps = isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <Tag
      href={feature.href}
      {...extraProps}
      className={`group flex flex-col p-5 rounded-2xl border transition-all ${
        isNight
          ? 'bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
          : 'bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/30'
      } no-underline`}
    >
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-xl shadow-lg mb-4`}>
        {feature.icon}
      </div>

      {/* Title + Status */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className={`text-base font-medium ${textColor}`}>
          {feature.title}
        </h3>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
          isStable
            ? isNight
              ? 'bg-green-500/15 text-green-300'
              : 'bg-green-400/15 text-green-700'
            : isNight
              ? 'bg-amber-500/15 text-amber-300'
              : 'bg-amber-400/15 text-amber-700'
        }`}>
          {isStable ? 'Stable' : 'Beta'}
        </span>
        {isExternal && (
          <span className={`text-[10px] ${isNight ? 'text-white/30' : 'text-black/30'}`}>
            ↗
          </span>
        )}
      </div>

      {/* Description */}
      <p className={`text-xs ${isNight ? 'text-white/50' : 'text-black/50'} leading-relaxed flex-1`}>
        {feature.description}
      </p>

      {/* Hover arrow */}
      <div className={`mt-3 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity ${
        isNight ? 'text-purple-400' : 'text-purple-600'
      }`}>
        {isExternal ? 'Open ↗' : 'Explore →'}
      </div>
    </Tag>
  );
}
