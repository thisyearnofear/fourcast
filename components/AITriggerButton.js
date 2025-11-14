import React, { useState } from 'react';

const AITriggerButton = ({
  onTrigger,
  isActive,
  isLoading,
  isNight,
  position = 'bottom-left',
  className = ''
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const buttonClasses = `
    absolute z-20 p-3 rounded-2xl backdrop-blur-md border transition-all duration-300
    ${isNight ? 'bg-black/20 border-white/20 hover:bg-black/30' : 'bg-white/10 border-black/20 hover:bg-white/20'}
    ${position === 'bottom-left' ? 'bottom-6 left-6' : 'bottom-6 right-6'}
    ${isActive ? 'ring-2 ring-blue-400/50' : ''}
    ${className}
  `;

  const iconColor = isNight ? 'text-white' : 'text-black';
  const iconOpacity = isActive ? 'opacity-100' : 'opacity-70';

  return (
    <div className="relative">
      <button
        onClick={onTrigger}
        disabled={isLoading}
        className={buttonClasses}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {isLoading ? (
          <div className={`w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin ${iconColor}`}></div>
        ) : (
          <div className={`relative ${iconColor} ${iconOpacity}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {isActive && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            )}
          </div>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && !isLoading && (
        <div className={`
          absolute bottom-full mb-2 px-3 py-2 rounded-lg backdrop-blur-md border text-sm font-light whitespace-nowrap
          ${isNight ? 'bg-black/80 border-white/20 text-white' : 'bg-white/80 border-black/20 text-black'}
          ${position === 'bottom-left' ? 'left-0' : 'right-0'}
        `}>
          {isActive ? 'Hide AI Analysis' : 'Analyze Weather Edge'}
          <div className={`
            absolute top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent
            ${isNight ? 'border-t-black/80' : 'border-t-white/80'}
            ${position === 'bottom-left' ? 'left-3' : 'right-3'}
          `}></div>
        </div>
      )}

      {/* Subtle hint for first-time users */}
      {!isActive && !isLoading && (
        <div className={`
          absolute inset-0 rounded-2xl border-2 border-dashed opacity-30 animate-pulse
          ${isNight ? 'border-white/40' : 'border-black/40'}
        `}></div>
      )}
    </div>
  );
};

export default AITriggerButton;