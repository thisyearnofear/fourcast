'use client';

export default function WeatherNavigation({ isNight }) {
  const bgColor = isNight
    ? 'bg-white/10 border-white/20 hover:bg-white/15'
    : 'bg-white/20 border-white/30 hover:bg-white/25';
  
  const textColor = isNight ? 'text-white' : 'text-black';
  const hoverBg = isNight ? 'hover:bg-white/20' : 'hover:bg-black/20';

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
      <div className={`backdrop-blur-md border rounded-full px-6 py-3 transition-all duration-300 ${bgColor}`}>
        <div className="flex items-center space-x-6 sm:space-x-8">
          <button
            onClick={() => window.location.href = '/markets'}
            className={`flex items-center space-x-2 px-2 sm:px-3 py-2 rounded-lg transition-all hover:scale-110 ${textColor} ${hoverBg}`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-xs sm:text-sm font-light hidden xs:inline">Markets</span>
          </button>

          <div className={`w-px h-4 ${isNight ? 'bg-white/20' : 'bg-black/20'}`}></div>

          <button
            onClick={() => window.location.href = '/signals'}
            className={`flex items-center space-x-2 px-2 sm:px-3 py-2 rounded-lg transition-all hover:scale-110 ${textColor} ${hoverBg}`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs sm:text-sm font-light hidden xs:inline">Signals</span>
          </button>
        </div>
      </div>
    </div>
  );
}