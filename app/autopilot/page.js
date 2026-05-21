"use client";

import React, { useState, useEffect } from "react";
import PageNav, { HomeLink } from "@/app/components/PageNav";
import Scene3D from "@/components/Scene3D";
import AutopilotDashboard from "@/components/AutopilotDashboard";
import { weatherService } from "@/services/weatherService";
import dynamic from "next/dynamic";

const WalletConnect = dynamic(() => import("@/app/components/WalletConnect"), {
  ssr: false,
});

export default function AutopilotPage() {
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
        const data = await weatherService.getCurrentWeather("Nairobi");
        setWeatherData(data);
      } catch {
        // fallback
      }
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const textColor = isNight ? "text-white" : "text-black";
  const cardBgColor = isNight
    ? "bg-slate-900/60 border-white/20"
    : "bg-white/60 border-black/20";

  if (isLoadingWeather) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-current/30 border-t-current rounded-full animate-spin text-white mb-4" />
          <p className="text-white font-light">Loading...</p>
        </div>
      </div>
    );
  }

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
                Autopilot
              </h1>
              <p className={`text-sm ${textColor} opacity-60 mt-2 font-light`}>
                Autonomous trade execution powered by Kelly Criterion sizing
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <PageNav currentPage="Autopilot" isNight={isNight} />
              <WalletConnect isNight={isNight} />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
          <AutopilotDashboard isNight={isNight} />
        </main>
      </div>
    </div>
  );
}
