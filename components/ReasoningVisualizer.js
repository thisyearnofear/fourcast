'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ReasoningVisualizer
 * 
 * A high-fidelity "thinking" overlay that shows the AI's step-by-step reasoning.
 * Provides the "Wow" factor while the backend is processing complex analysis.
 */
export default function ReasoningVisualizer({ 
  isActive, 
  onComplete, 
  title = "Analyzing Market",
  steps = [],
  currentStepIndex = 0
}) {
  const [internalStep, setInternalStep] = useState(0);
  const [dots, setDots] = useState('');

  // Fallback simulated steps if none provided
  const getSimulatedSteps = () => {
    const marketName = title.replace('Analyzing ', '') || "Market";
    return [
      { label: `Initializing deep reasoning engine for "${marketName}"...`, icon: "🧠" },
      { label: `Searching Polymarket & Kalshi for active "${marketName}" contracts...`, icon: "📊" },
      { label: "Verifying event venue and local conditions...", icon: "📍" },
      { label: "Accessing Venice AI Multi-Agent Mesh (Llama 3.3 70B)...", icon: "🌐" },
      { label: "Analyzing weather impact vectors and path dependency...", icon: "🌤" },
      { label: "Calculating cross-chain arbitrage edge and expected value...", icon: "⛓️" },
      { label: "Synthesizing final predictive assessment...", icon: "✅" }
    ];
  };

  const activeSteps = steps.length > 0 ? steps : getSimulatedSteps();
  const displayStep = steps.length > 0 ? currentStepIndex : internalStep;

  useEffect(() => {
    if (!isActive) {
      setInternalStep(0);
      return;
    }

    // Dots animation
    const dotsInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    // Auto-advance internal steps if no external steps provided
    let stepInterval;
    if (steps.length === 0) {
      stepInterval = setInterval(() => {
        setInternalStep(prev => {
          if (prev < activeSteps.length - 1) return prev + 1;
          return prev;
        });
      }, 2500);
    }

    return () => {
      clearInterval(dotsInterval);
      if (stepInterval) clearInterval(stepInterval);
    };
  }, [isActive, steps.length, activeSteps.length]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      <div className="absolute inset-0 bg-[#080a0d]/60 backdrop-blur-md" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-lg bg-[#12121a]/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl pointer-events-auto"
      >
        {/* Progress bar at the top */}
        <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 w-full overflow-hidden">
          <motion.div 
            className="h-full bg-white/20"
            animate={{ 
              x: ["-100%", "100%"] 
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "linear" 
            }}
          />
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-light text-white/90">
                {title}
                <span className="inline-block w-8 text-left ml-1">{dots}</span>
              </h2>
              <p className="text-xs text-white/30 uppercase tracking-widest mt-1">
                Venice AI • Llama 3.3 • 70B
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl animate-pulse">
              {activeSteps[displayStep]?.icon || "✅"}
            </div>
          </div>

          <div className="space-y-4">
            {activeSteps.map((step, idx) => {
              const isPast = idx < displayStep;
              const isCurrent = idx === displayStep;
              const isFuture = idx > displayStep;

              return (
                <div 
                  key={idx} 
                  className={`flex items-start gap-4 transition-all duration-500 ${
                    isFuture ? 'opacity-20 grayscale' : 'opacity-100'
                  }`}
                >
                  <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                    isPast 
                      ? 'bg-purple-500 border-purple-500 text-white' 
                      : isCurrent
                      ? 'border-purple-500 text-purple-500 animate-pulse'
                      : 'border-white/10 text-white/20'
                  }`}>
                    {isPast ? "✓" : idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-light ${
                      isCurrent ? 'text-white' : isPast ? 'text-white/60' : 'text-white/20'
                    }`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2"
                      >
                        <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-purple-500/50"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2.5 }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-6 h-6 rounded-full border border-[#12121a] bg-white/5 flex items-center justify-center text-[10px]">
                    {['🌐', '🔍', '📊'][i-1]}
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-white/30 font-light">
                Connected to Multi-Agent Mesh
              </span>
            </div>
            
            <div className="text-[10px] text-white/20 font-mono">
              EST: {Math.max(0, (activeSteps.length - displayStep) * 2)}s remaining
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
