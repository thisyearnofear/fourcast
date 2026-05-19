'use client';

import { createElement, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import useCarouselPhysics, { CARDS } from '@/hooks/useCarouselPhysics';
import OnboardingTour, { ONBOARDING_KEY, useOnboarding } from './OnboardingTour';

export default function CarouselLanding() {
  const router = useRouter();

  const onboarding = useOnboarding();

  const [isEntered, setIsEntered] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const [showGestureHint, setShowGestureHint] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    const v = localStorage.getItem('fourcast_visited');
    return !v || v === 'false' ? true : false;
  });
  const [skeletonHidden, setSkeletonHidden] = useState(false);
  const [revealedCards, setRevealedCards] = useState(() => {
    if (typeof window === 'undefined') return 4;
    return localStorage.getItem('fourcast_visited') ? 4 : 2;
  });

  const {
    stageRef, cardsRootRef, bgCanvasRef, loaderRef, stateRef,
    measure, updateTransforms, startCarousel, pauseCarouselMotion,
    drawBackground, transitionGradient, resizeBG,
    animateEntry, warmupCompositing, createCards,
    onWheel, onPointerDown, onPointerMove, onPointerUp,
    tick, cleanup,
  } = useCarouselPhysics({
    onActiveCardChange: setActiveCard,
    onCardClick: (card) => router.push(card.route),
  });

  const finishWelcome = (visitState, completeTour = false) => {
    setShowWelcome(false);
    try {
      localStorage.setItem('fourcast_visited', visitState);
      if (completeTour) localStorage.setItem(ONBOARDING_KEY, visitState);
    } catch { /* noop */ }
  };

  // --------------------------------------------------------------------------
  // INIT
  // --------------------------------------------------------------------------

  useEffect(() => {
    const s = stateRef.current;
    let mounted = true;

    async function init() {
      createCards(revealedCards);
      await new Promise((r) => requestAnimationFrame(r));
      measure();
      s.scrollX = 0;
      updateTransforms();
      await new Promise((r) => setTimeout(r, 100));
      transitionGradient(CARDS[0].gradient);

      resizeBG();
      if (bgCanvasRef.current) {
        const ctx = bgCanvasRef.current.getContext('2d', { alpha: false });
        if (ctx) {
          ctx.fillStyle = '#0a0a0f';
          ctx.fillRect(0, 0, bgCanvasRef.current.width, bgCanvasRef.current.height);
        }
      }

      await warmupCompositing();

      if ('requestIdleCallback' in window) {
        await new Promise((r) => requestIdleCallback(r, { timeout: 100 }));
      } else {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (!mounted) return;

      s.bgRAF = requestAnimationFrame(drawBackground);
      await new Promise((r) => setTimeout(r, 100));

      await animateEntry();
      if (!mounted) return;

      s.isEntering = false;
      setIsEntered(true);
      setSkeletonHidden(true);

      setTimeout(() => setShowGestureHint(true), 600);
      setTimeout(() => setShowGestureHint(false), 4500);

      startCarousel();
    }

    // Keyboard navigation
    const onKey = (e) => {
      const s = stateRef.current;
      if (s.isEntering) return;
      if (e.key === 'ArrowLeft') { s.velocity -= 400; e.preventDefault(); }
      if (e.key === 'ArrowRight') { s.velocity += 400; e.preventDefault(); }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const card = CARDS[s.activeIndex >= 0 ? s.activeIndex : 0];
        if (card) {
          try {
            localStorage.setItem('fourcast_interests', JSON.stringify([card.id]));
            localStorage.setItem('fourcast_visited', 'true');
            setRevealedCards(CARDS.length);
          } catch { /* noop */ }
          router.push(card.route);
        }
      }
    };
    window.addEventListener('keydown', onKey);

    if (stageRef.current) init();

    return () => {
      window.removeEventListener('keydown', onKey);
      mounted = false; cleanup();
    };
  }, [revealedCards]);

  useEffect(() => {
    const s = stateRef.current;

    if (!onboarding.isActive) {
      if (isEntered) startCarousel();
      return;
    }

    pauseCarouselMotion();
    s.velocity = 0;

    const stepId = onboarding.step?.id;
    const targetIndex = CARDS.findIndex((card) => card.id === stepId);
    if (targetIndex === -1 || !s.TRACK || !s.STEP) return;

    if (revealedCards < CARDS.length) {
      setRevealedCards(CARDS.length);
      return;
    }

    gsap.to(s, {
      scrollX: ((targetIndex * s.STEP) % s.TRACK + s.TRACK) % s.TRACK,
      duration: 0.35,
      ease: 'power3.out',
      onUpdate: () => updateTransforms(),
    });
  }, [
    onboarding.isActive,
    onboarding.currentStep,
    onboarding.step?.id,
    revealedCards,
    isEntered,
    startCarousel,
    pauseCarouselMotion,
    updateTransforms,
  ]);

  // --------------------------------------------------------------------------
  // Resize Handler
  // --------------------------------------------------------------------------

  useEffect(() => {
    const onResize = () => {
      const s = stateRef.current;
      const prevStep = s.STEP || 1;
      const ratio = s.scrollX / (s.items.length * prevStep);
      measure();
      s.scrollX = ((s.scrollX + (ratio * s.TRACK - s.scrollX)) % s.TRACK + s.TRACK) % s.TRACK;
      updateTransforms();
      resizeBG();
    };

    let timer;
    const onResizeDebounced = () => {
      clearTimeout(timer);
      timer = setTimeout(onResize, 80);
    };
    window.addEventListener('resize', onResizeDebounced);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResizeDebounced);
    };
  }, [measure, updateTransforms, resizeBG]);

  // --------------------------------------------------------------------------
  // Visibility Handler
  // --------------------------------------------------------------------------

  useEffect(() => {
    const onVisibility = () => {
      const s = stateRef.current;
      if (document.hidden) {
        cleanup();
      } else {
        s.lastTime = 0;
        s.bgRAF = requestAnimationFrame(drawBackground);
        s.rafId = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div
      ref={stageRef}
      className="carousel-stage"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDragStart={(e) => e.preventDefault()}
    >
      <canvas ref={bgCanvasRef} id="carousel-bg" aria-hidden="true" />

      {/* Skeleton Cards */}
      <div className={`carousel-skeleton ${skeletonHidden ? 'hidden' : ''}`}>
        <div className="carousel-skeleton-card" />
        <div className="carousel-skeleton-card" />
        <div className="carousel-skeleton-card" />
      </div>

      {/* Loader */}
      <div ref={loaderRef} className="carousel-loader" aria-label="Loading" aria-live="assertive">
        <div className="carousel-loader-content">
          <div className="carousel-loader-ring" aria-hidden="true" />
          <span className="carousel-loader-text">Fourcast</span>
        </div>
      </div>

      {/* Cards Container */}
      <section ref={cardsRootRef} id="carousel-cards" className="carousel-cards" />

      {/* Active Card Info Panel */}
      {activeCard && isEntered && (
        <div className="carousel-info">
          <div className="carousel-info-inner">
            <h1 className="carousel-info-title">
              <span className="carousel-info-icon">{activeCard.icon}</span>
              {' '}{activeCard.title}
            </h1>
            <p className="carousel-info-description">{activeCard.description}</p>
            <div className="carousel-info-features">
              {activeCard.features.map((f, i) => (
                <span key={i} className="carousel-info-badge">{f}</span>
              ))}
            </div>
            <button
              className="carousel-info-cta"
              onClick={() => {
                if (stateRef.current.isEntering) return;
                try {
                  localStorage.setItem('fourcast_interests', JSON.stringify([activeCard.id]));
                  localStorage.setItem('fourcast_visited', 'true');
                } catch { /* noop */ }
                router.push(activeCard.route);
              }}
            >
              {activeCard.id === 'weather' ? 'Explore Weather →' : 'Find Your Edge →'}
            </button>
          </div>
        </div>
      )}

      {/* Dot Navigation */}
      <div className={`carousel-dots ${isEntered ? 'visible' : ''}`}>
        {CARDS.slice(0, revealedCards).map((c, i) => {
          const isActive = activeCard?.id === c.id;
          return (
            <button
              key={c.id}
              className={`carousel-dot ${isActive ? 'active' : ''}`}
              style={isActive ? { background: c.gradient[0] } : {}}
              onClick={() => {
                const s = stateRef.current;
                const targetX = i * s.STEP;
                const diff = targetX - s.scrollX;
                gsap.to(s, {
                  scrollX: ((s.scrollX + diff) % s.TRACK + s.TRACK) % s.TRACK,
                  duration: 0.5, ease: 'power3.out',
                  onUpdate: () => updateTransforms(),
                });
              }}
              aria-label={`Go to ${c.title}`}
            />
          );
        })}
      </div>

      {/* Remaining cards hint — only on first visit with 2 cards */}
      {revealedCards < 4 && isEntered && (
        <div className="carousel-reveal-hint">
          <span>Explore a vertical to unlock Politics + Weather →</span>
        </div>
      )}

      {/* Gesture Hint */}
      {showGestureHint && (
        <div className="carousel-gesture-hint">
          <span className="carousel-gesture-icon">↔</span>
          <span>Drag to browse &middot; Click to explore</span>
        </div>
      )}

      {/* Welcome Overlay */}
      {showWelcome && (
        <div className="carousel-welcome" onClick={() => {
          finishWelcome('dismiss', true);
        }}>
          <div className="carousel-welcome-card" onClick={(e) => e.stopPropagation()}>
            <span className="carousel-welcome-icon">🔮</span>
            <h2 className="carousel-welcome-title">Welcome to Fourcast</h2>
            <p className="carousel-welcome-desc">
              AI-powered prediction intelligence. Drag through verticals to explore markets, then click to dive into AI-driven edge analysis.
            </p>
            <div className="carousel-welcome-note">
              <span>💡 Quick start: just need a wallet + Venice AI key</span>
            </div>
            <button
              className="carousel-welcome-cta"
              onClick={() => {
                finishWelcome('true');
                setRevealedCards(CARDS.length);
                setShowGestureHint(false);
                onboarding.restartOnboarding();
              }}
            >
              Show me around →
            </button>
            <button
              className="carousel-welcome-skip"
              onClick={() => {
                finishWelcome('skipped', true);
                onboarding.skipOnboarding();
              }}
            >
              Skip — I know my way around
            </button>
          </div>
        </div>
      )}

      {createElement(OnboardingTour, {
        isActive: onboarding.isActive,
        step: onboarding.step,
        currentStep: onboarding.currentStep,
        progress: onboarding.progress,
        onNext: onboarding.nextStep,
        onPrev: onboarding.prevStep,
        onSkip: onboarding.skipOnboarding,
        onStepClick: onboarding.setCurrentStep,
        isNight: true,
      })}
    </div>
  );
}
