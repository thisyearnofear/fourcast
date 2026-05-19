'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import useCarouselPhysics, { CARDS } from '@/hooks/useCarouselPhysics';

export default function CarouselLanding() {
  const router = useRouter();

  const [isEntered, setIsEntered] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const [showGestureHint, setShowGestureHint] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('fourcast_visited');
  });
  const [skeletonHidden, setSkeletonHidden] = useState(false);

  const {
    stageRef, cardsRootRef, bgCanvasRef, loaderRef, stateRef,
    measure, updateTransforms, startCarousel,
    drawBackground, transitionGradient, resizeBG,
    animateEntry, warmupCompositing, createCards,
    onWheel, onPointerDown, onPointerMove, onPointerUp,
    tick, cleanup,
  } = useCarouselPhysics({
    onActiveCardChange: setActiveCard,
    onCardClick: (card) => router.push(card.route),
  });

  // --------------------------------------------------------------------------
  // INIT
  // --------------------------------------------------------------------------

  useEffect(() => {
    const s = stateRef.current;
    let mounted = true;

    async function init() {
      createCards();
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

    if (stageRef.current) init();

    return () => { mounted = false; cleanup(); };
  }, []);

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
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(onResize, 80); });
    return () => window.removeEventListener('resize', onResize);
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
                } catch {}
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
        {CARDS.map((c, i) => {
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

      {/* Gesture Hint */}
      {showGestureHint && (
        <div className="carousel-gesture-hint">
          <span className="carousel-gesture-icon">↔</span>
          <span>Drag to browse &middot; Click to explore</span>
        </div>
      )}

      {/* Welcome Overlay */}
      {showWelcome && (
        <div className="carousel-welcome">
          <div className="carousel-welcome-card">
            <span className="carousel-welcome-icon">🔮</span>
            <h2 className="carousel-welcome-title">Welcome to Fourcast</h2>
            <p className="carousel-welcome-desc">
              AI-powered prediction intelligence. Drag through verticals to explore markets, then click to dive into AI-driven edge analysis.
            </p>
            <button
              className="carousel-welcome-cta"
              onClick={() => {
                setShowWelcome(false);
                try { localStorage.setItem('fourcast_visited', 'true'); } catch {}
              }}
            >
              Show me around →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
