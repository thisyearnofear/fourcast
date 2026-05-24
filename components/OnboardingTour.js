'use client';

import { useState, useEffect, useCallback } from 'react';

export const ONBOARDING_KEY = 'fourcast_onboarding_complete';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Fourcast',
    description: 'Your AI-powered prediction market companion. Discover insights, track your calls, and build a verifiable track record.',
    icon: '🔮',
    target: null, // Center screen
  },
  {
    id: 'markets',
    title: 'Browse & Analyze Markets',
    description: 'Explore prediction markets from Polymarket and Kalshi. Run AI analysis with ML-backed edge detection.',
    icon: '📊',
    target: '[data-onboard="markets"]',
  },
  {
    id: 'publish',
    title: 'Publish Signals',
    description: 'Record your predictions on-chain. Build a provable track record and earn tips from the community.',
    icon: '📡',
    target: '[data-onboard="publish"]',
  },
  {
    id: 'agent',
    title: 'Agent Mode',
    description: 'Let the AI autonomously scan markets, detect edges, and generate forecasts for you.',
    icon: '🤖',
    target: '[data-onboard="agent"]',
  },
  {
    id: 'positions',
    title: 'Your Track Record',
    description: 'View your positions, reputation, win rate, and Brier scores across every market.',
    icon: '💼',
    target: '[data-onboard="positions"]',
  },
];

export function useOnboarding() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(true); // Start true, check on mount

  // Check if onboarding was already completed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem(ONBOARDING_KEY);
      setIsComplete(!!completed);
    }
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipOnboarding = useCallback(() => {
    setIsActive(false);
    setIsComplete(true);
    localStorage.setItem(ONBOARDING_KEY, 'skipped');
  }, []);

  const completeOnboarding = useCallback(() => {
    setIsActive(false);
    setIsComplete(true);
    localStorage.setItem(ONBOARDING_KEY, 'complete');
  }, []);

  const restartOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    setCurrentStep(0);
    setIsComplete(false);
    setIsActive(true);
  }, []);

  return {
    isActive,
    currentStep,
    setCurrentStep,
    isComplete,
    steps: STEPS,
    step: STEPS[currentStep],
    progress: ((currentStep + 1) / STEPS.length) * 100,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    restartOnboarding,
  };
}

export default function OnboardingTour({
  isActive,
  step,
  currentStep,
  progress,
  onNext,
  onPrev,
  onSkip,
  onStepClick,
  isNight = true,
}) {
  const [targetRect, setTargetRect] = useState(null);

  // Find target element and position tooltip
  useEffect(() => {
    if (!isActive || !step?.target) {
      setTargetRect(null);
      return;
    }

    let frameId;
    let stopAt = performance.now() + 700;

    const measureTarget = () => {
      const element = document.querySelector(step.target);
      setTargetRect(element ? element.getBoundingClientRect() : null);

      if (performance.now() < stopAt) {
        frameId = requestAnimationFrame(measureTarget);
      }
    };

    const onResize = () => {
      stopAt = performance.now() + 300;
      if (!frameId) frameId = requestAnimationFrame(measureTarget);
    };

    measureTarget();
    window.addEventListener('resize', onResize);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
    };
  }, [isActive, step?.target, currentStep]);

  if (!isActive) return null;

  const isCentered = !step.target || !targetRect;

  // Calculate position
  const getPosition = () => {
    if (isCentered) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    // Position below target element
    return {
      top: targetRect.bottom + 16,
      left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 320)),
    };
  };

  const position = getPosition();

  return (
    <>
      {/* Backdrop with spotlight */}
      <div
        className="fixed inset-0 z-[100] transition-opacity duration-300"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        aria-hidden="true"
      />

      {/* Spotlight on target */}
      {targetRect && (
        <div
          className="fixed z-[101] pointer-events-none ring-4 ring-white/30 rounded-xl transition-all duration-300"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tooltip Card */}
      <div
        className={`fixed z-[102] w-80 rounded-2xl glass-surface shadow-2xl transition-all duration-300 ${
          isNight
            ? 'bg-slate-900/95 border-white/20'
            : 'bg-white/95 border-black/20'
        }`}
        style={{
          ...position,
          transform: isCentered ? 'translate(-50%, -50%)' : undefined,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div className={`h-1 rounded-t-2xl overflow-hidden ${isNight ? 'bg-white/10' : 'bg-black/10'}`}>
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-3xl">{step.icon}</span>
            <div className="flex-1">
              <h3 className={`text-lg font-medium ${isNight ? 'text-white' : 'text-black'}`}>
                {step.title}
              </h3>
              <p className={`text-sm ${isNight ? 'text-white/70' : 'text-black/70'} mt-1 leading-relaxed`}>
                {step.description}
              </p>
            </div>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-2 my-4">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => onStepClick?.(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStep
                    ? 'w-6 bg-purple-500'
                    : i < currentStep
                      ? isNight ? 'bg-white/40' : 'bg-black/40'
                      : isNight ? 'bg-white/20' : 'bg-black/20'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSkip}
              className={`px-4 py-2 rounded-xl text-sm font-light transition-all ${
                isNight
                  ? 'text-white/60 hover:text-white/80'
                  : 'text-black/60 hover:text-black/80'
              }`}
            >
              Skip tour
            </button>
            <div className="flex-1" />
            {currentStep > 0 && (
              <button
                onClick={onPrev}
                className={`px-4 py-2 rounded-xl text-sm font-light transition-all border ${
                  isNight
                    ? 'text-white border-white/20 hover:bg-white/10'
                    : 'text-black border-black/20 hover:bg-black/10'
                }`}
              >
                Back
              </button>
            )}
            <button
              onClick={onNext}
              className="px-5 py-2 rounded-xl text-sm font-medium transition-all bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90"
            >
              {currentStep === STEPS.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Hook for adding data-onboard attributes to components
export function getOnboardingAttr(id) {
  return { 'data-onboard': id };
}
