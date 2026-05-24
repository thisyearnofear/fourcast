'use client';

import React, { useState, useEffect } from 'react';
import PageNav, { HomeLink } from '@/app/components/PageNav';
import Scene3D from '@/components/Scene3D';
import useHUDStore from '@/hooks/useHUDStore';
import { AgentDashboard } from '@/components/AgentDashboard';
import { useWeather } from '@/hooks/useWeather';
import WalletConnect from '@/app/components/WalletConnect';
import NarrativeSteps from '@/components/NarrativeSteps';

export default function AgentPage() {
  const { weatherData, isLoading: isLoadingWeather, isNight } = useWeather();
  const { isHUDVisible } = useHUDStore();

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
      <div className={`relative z-20 flex flex-col min-h-screen overflow-y-auto transition-opacity duration-500 ${isHUDVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Header */}
        <header className={`sticky top-0 z-50 border-b ${cardBgColor} backdrop-blur-md`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex justify-between items-center">
            <div>
              <h1 className={`text-3xl font-thin ${textColor} tracking-wide`}>
                Agent
              </h1>
              <p className={`text-sm ${textColor} opacity-60 mt-2 font-light`}>
                Mission control — scan markets, detect edges, and track the AI agent's performance
              </p>

              {/* Agent as monitoring layer — sits above all 4 steps */}
              <div className="relative mt-4">
                {/* Monitor badge positioned above */}
                <div className="flex items-center justify-center mb-1.5">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wider uppercase border ${
                    isNight 
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-400/20' 
                      : 'bg-cyan-400/10 text-cyan-700 border-cyan-500/20'
                  }`}>
                    <span>🤖</span>
                    <span>Agent monitors all</span>
                  </div>
                </div>
                {/* The 4-step loop — all steps shown as completed (observed) */}
                <NarrativeSteps currentStep="scored" isNight={isNight} />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <PageNav currentPage="Agent" isNight={isNight} />
              <WalletConnect isNight={isNight} />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
          <AgentDashboard isNight={isNight} />

          {/* Labs CTA */}
          <div className="mt-12 text-center">
            <p className={`text-xs ${textColor} opacity-40 mb-3 font-light`}>
              Looking for the full autopilot with autonomous trade execution?
            </p>
            <a
              href="/labs"
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-light transition-all border ${
                isNight
                  ? 'bg-white/5 hover:bg-white/10 text-white/70 border-white/10'
                  : 'bg-black/5 hover:bg-black/10 text-black/70 border-black/10'
              }`}
            >
              <span>🧪</span>
              Visit Labs for Autopilot & Builder
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
