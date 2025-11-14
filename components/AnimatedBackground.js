'use client';

import React, { useMemo } from 'react';

export default function AnimatedBackground({ isNight = true, timeOfDay = 'day' }) {
  const bgGradient = useMemo(() => {
    if (isNight) {
      return 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900';
    }
    
    switch (timeOfDay) {
      case 'dawn':
        return 'bg-gradient-to-br from-orange-100 via-purple-100 to-blue-100';
      case 'dusk':
        return 'bg-gradient-to-br from-orange-200 via-rose-100 to-purple-100';
      case 'day':
      default:
        return 'bg-gradient-to-br from-blue-100 via-cyan-50 to-blue-50';
    }
  }, [isNight, timeOfDay]);

  return (
    <div className="absolute inset-0 z-0">
      <div className={`w-full h-full ${bgGradient} transition-all duration-1000`} />
      
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full mix-blend-screen filter blur-3xl animate-blob" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-gradient-to-br from-pink-500/10 to-blue-500/10 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="2"/%3E%3C/filter%3E%3Crect width="100" height="100" filter="url(%23noise)"%3E%3C/rect%3E%3C/svg%3E")',
        backgroundSize: '200px 200px'
      }} />
    </div>
  );
}
