"use client";

import React, { useState, useEffect } from "react";
import PageNav, { HomeLink } from "@/app/components/PageNav";
import Scene3D from "@/components/Scene3D";
import useHUDStore from "@/hooks/useHUDStore";
import PositionsDashboard from "@/components/PositionsDashboard";
import { useWeather } from "@/hooks/useWeather";
import WalletConnect from "@/app/components/WalletConnect";
import NarrativeSteps from "@/components/NarrativeSteps";
import { BRAND } from "@/constants/brand";

export default function PositionsPage() {
  const { weatherData, isLoading: isLoadingWeather, isNight } = useWeather();
  const { isHUDVisible } = useHUDStore();

  const textColor = isNight ? "text-white" : "text-black";
  const cardBgColor = isNight
    ? "bg-slate-900/60 border-white/20"
    : "bg-white/60 border-black/20";

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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex justify-between items-center">          <div>
                            <h1 className={`text-3xl font-thin ${textColor} tracking-wide`}>
                                Positions
                            </h1>
                            <p className={`text-sm ${textColor} opacity-60 mt-2 font-light`}>
                                {BRAND.pages.positions}
                            </p>
                            {/* Narrative step — step 4: Get Scored */}
                            <NarrativeSteps currentStep="scored" isNight={isNight} className="mt-3" />
                        </div>
            <div className="flex items-center space-x-3">
              <PageNav currentPage="Positions" isNight={isNight} />
              <WalletConnect isNight={isNight} />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
          <PositionsDashboard isNight={isNight} />
        </main>
      </div>
    </div>
  );
}
