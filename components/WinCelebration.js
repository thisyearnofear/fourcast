'use client';

import { useEffect, useState } from 'react';

/**
 * Win Celebration Modal
 * 
 * Full-screen celebration when a signal resolves profitably
 * - Confetti animation
 * - Sound effect
 * - Share buttons for X/Farcaster
 * - Endorphin hit → encourages further engagement
 */
export function WinCelebration({ isOpen, signal, onClose }) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      // Play sound if available
      playWinSound();
      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const profitMessage = signal.confidence === 'very-high'
    ? 'Excellent prediction! Your high confidence was justified.'
    : signal.confidence === 'high'
    ? 'Great call! Your analysis was spot on.'
    : 'You nailed it! Even low confidence calls can win.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Confetti */}
      {showConfetti && <Confetti />}

      {/* Celebration Modal */}
      <div className="pointer-events-auto bg-black/80 backdrop-blur-lg rounded-3xl p-8 max-w-md mx-4 text-center space-y-6 animate-bounce-in">
        {/* Big Win Emoji */}
        <div className="text-7xl animate-scale-in">🎉</div>

        {/* Win Message */}
        <div className="space-y-2">
          <h2 className="text-4xl font-light text-white">
            You Won!
          </h2>
          <p className="text-lg text-white/80 font-light">
            {signal.marketTitle}
          </p>
        </div>

        {/* Confidence Message */}
        <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-4">
          <p className="text-sm text-green-100 font-light">
            {profitMessage}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-white/60 mb-1">Your Prediction</p>
            <p className="text-lg text-white font-light">{signal.side}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-white/60 mb-1">Confidence</p>
            <p className="text-lg text-white font-light">
              {signal.confidence || 'High'}
            </p>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="space-y-2">
          <p className="text-xs text-white/60 uppercase tracking-wider">
            Share your win
          </p>
          <div className="flex gap-2">
            <ShareButton
              platform="x"
              signal={signal}
            />
            <ShareButton
              platform="farcaster"
              signal={signal}
            />
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-light transition-all"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/**
 * Share button for X or Farcaster
 */
function ShareButton({ platform, signal }) {
  const handleShare = async () => {
    const text = generateShareText(platform, signal);
    const url = platform === 'farcaster'
      ? `https://warpcast.com/compose?text=${encodeURIComponent(text)}`
      : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    
    window.open(url, '_blank', 'width=550,height=420');
  };

  const label = platform === 'x' ? '𝕏' : 'Warpcast';
  const icon = platform === 'x' ? '𝕏' : '⛵';

  return (
    <button
      onClick={handleShare}
      className={`flex-1 py-2 rounded-lg font-light text-sm transition-all border ${
        platform === 'x'
          ? 'bg-black/40 hover:bg-black/60 border-white/20 text-white'
          : 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-400/30 text-purple-200'
      }`}
    >
      {icon} Share on {label}
    </button>
  );
}

/**
 * Generate shareable text for X/Farcaster
 */
function generateShareText(platform, signal) {
  const baseText = `Just won predicting ${signal.side} on "${signal.marketTitle}" 🎯`;
  
  if (platform === 'farcaster') {
    return `${baseText}\n\nUsing weather-based analysis to beat the odds on @fourcast 🌤️\n\nBuilding my forecaster reputation on-chain.`;
  } else {
    // X/Twitter
    return `${baseText}\n\nBuilding my forecasting track record using weather analysis @fourcast 📊`;
  }
}

/**
 * Confetti animation
 */
function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute text-2xl animate-fall"
          style={{
            left: `${Math.random() * 100}%`,
            animation: `fall ${2 + Math.random() * 1}s linear forwards`,
            animationDelay: `${Math.random() * 0.5}s`,
          }}
        >
          {['🎉', '✨', '🎊', '⭐', '🏆'][Math.floor(Math.random() * 5)]}
        </div>
      ))}
      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        
        @keyframes bounce-in {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes scale-in {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }
        
        .animate-bounce-in {
          animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .animate-scale-in {
          animation: scale-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
      `}</style>
    </div>
  );
}

/**
 * Play win sound effect
 */
function playWinSound() {
  // Create a simple beep using Web Audio API
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    // Play ascending tone
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    // Silently fail if audio context not available
  }
}

export default WinCelebration;
