'use client';

import React, { useMemo } from 'react';

export default function AnimatedBackground({ isNight = true, timeOfDay = 'day' }) {
 const bgGradient = useMemo(() => {
 if (isNight) {
 return 'bg-gradient-to-br from-[var(--color-paper-deep)] via-[var(--color-evidence)] to-[var(--color-paper-deep)]';
 }
 
 switch (timeOfDay) {
 case 'dawn':
 return 'bg-gradient-to-br from-[var(--color-sealed)] via-[var(--color-review)] to-[var(--color-evidence)]';
 case 'dusk':
 return 'bg-gradient-to-br from-[var(--color-sealed)] via-[var(--color-breach)] to-[var(--color-review)]';
 case 'day':
 default:
 return 'bg-gradient-to-br from-[var(--color-evidence)] via-[var(--color-evidence)] to-[var(--color-evidence)]';
 }
 }, [isNight, timeOfDay]);

 return (
 <div className="absolute inset-0 z-0">
 <div className={`w-full h-full ${bgGradient} transition-all duration-1000`} />
 
 {/* Animated gradient overlay */}
 <div className="absolute inset-0 overflow-hidden">
 <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-[var(--color-evidence)]/10 to-[var(--color-review)]/10 mix-blend-screen filter blur-3xl animate-blob" />
 <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gradient-to-br from-[var(--color-review)]/10 to-[var(--color-review)]/10 mix-blend-screen filter blur-3xl animate-blob animation-delay-2000" />
 <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-gradient-to-br from-[var(--color-review)]/10 to-[var(--color-evidence)]/10 mix-blend-screen filter blur-3xl animate-blob animation-delay-4000" />
 </div>

 {/* Subtle noise texture overlay */}
 <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{
 backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="2"/%3E%3C/filter%3E%3Crect width="100" height="100" filter="url(%23noise)"%3E%3C/rect%3E%3C/svg%3E")',
 backgroundSize: '200px 200px'
 }} />
 </div>
 );
}
