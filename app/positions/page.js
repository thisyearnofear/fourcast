"use client";

import { useState, useEffect } from 'react';



import { weatherService } from "@/services/weatherService";



export default function PositionsPage() {
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex justify-between items-center">          <div>
                            <h1 className={`text-3xl font-thin ${textColor} tracking-wide`}>
                                Positions
                            </h1>
                            <p className={`text-sm ${textColor} opacity-60 mt-2 font-light`}>
                                Your positions, reputation, and performance
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
