'use client';

import React, { useState, useEffect } from 'react';
import PageNav, { HomeLink } from '@/app/components/PageNav';
import useHUDStore from '@/hooks/useHUDStore';
import { BuilderDashboard } from '@/components/BuilderDashboard';
import { useWeather } from '@/hooks/useWeather';
import dynamic from 'next/dynamic';

const WalletConnect = dynamic(() => import('@/app/components/WalletConnect'), {
  ssr: false,
});

export default function LabsBuilderPage() {
  const { isNight } = useWeather();
  const { isHUDVisible } = useHUDStore();

  const textColor = isNight ? 'text-white' : 'text-black';
  const cardBgColor = isNight
    ? 'bg-slate-900/60 border-white/20'
    : 'bg-white/60 border-black/20';

  return (
    <div className="min-h-screen relative">
      {/* Content */}
      <div className={`relative z-20 flex flex-col min-h-screen overflow-y-auto transition-opacity duration-500 ${isHUDVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Header */}
        <header className={`sticky top-0 z-50 border-b ${cardBgColor} backdrop-blur-md`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🧪</span>
                <h1 className={`text-3xl font-thin ${textColor} tracking-wide`}>
                  Builder
                </h1>
              </div>
              <p className={`text-sm ${textColor} opacity-60 mt-2 font-light`}>
                Experimental — Polymarket Builder Program volume tracking &amp; gasless trading
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <PageNav currentPage="Labs" isNight={isNight} />
              <WalletConnect isNight={isNight} />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
          <div className="max-w-md mx-auto">
            <BuilderDashboard isNight={isNight} />
          </div>
        </main>
      </div>
    </div>
  );
}
