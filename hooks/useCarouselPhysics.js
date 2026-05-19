'use client';

import { useCallback, useRef } from 'react';
import { gsap } from 'gsap';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FRICTION = 0.9;
const WHEEL_SENS = 0.6;
const DRAG_SENS = 1.0;
const MAX_ROTATION = 28;
const MAX_DEPTH = 140;
const MIN_SCALE = 0.92;
const SCALE_RANGE = 0.1;
const GAP = 28;
const BLUR_AMOUNT = 2;

// ============================================================================
// CARD DATA — Fourcast Verticals
// ============================================================================

export const CARDS = [
  {
    id: 'crypto', title: 'Crypto', tagline: 'ML-Powered Market Analysis',
    description: 'AI-driven edge detection across crypto prediction markets. 200+ ML models surface mispriced opportunities.',
    icon: '₿', badge: 'ML',
    gradient: ['#6B21A8', '#BE185D'], gradientLight: ['#A855F7', '#F472B6'],
    route: '/markets?category=Crypto&analyze=auto',
    features: ['ML Confidence Scores', 'Live Odds Comparison', 'Edge Detection'],
  },
  {
    id: 'sports', title: 'Sports', tagline: 'Weather-Aware Predictions',
    description: 'Real-time weather data combined with AI analysis to find edges in sports prediction markets.',
    icon: '⚽', badge: 'Wx',
    gradient: ['#059669', '#0D9488'], gradientLight: ['#34D399', '#2DD4BF'],
    route: '/markets?category=Sports&analyze=auto',
    features: ['Weather Impact Analysis', 'Game-Day Forecasts', 'Multi-League Coverage'],
  },
  {
    id: 'politics', title: 'Politics', tagline: 'Forecast Intelligence',
    description: 'Multi-source sentiment analysis with polling data, news signals, and historical patterns.',
    icon: '🏛', badge: 'AI',
    gradient: ['#4338CA', '#2563EB'], gradientLight: ['#818CF8', '#60A5FA'],
    route: '/markets?category=Politics&analyze=auto',
    features: ['Poll Aggregation', 'Sentiment Analysis', 'Historical Models'],
  },
  {
    id: 'weather', title: 'Weather', tagline: 'Weather-Driven Markets',
    description: 'Explore how meteorological conditions create trading edges across sports, agriculture, and event markets.',
    icon: '🌤', badge: '3D',
    gradient: ['#0284C7', '#06B6D4'], gradientLight: ['#38BDF8', '#22D3EE'],
    route: '/weather',
    features: ['3D Weather Visualization', 'Market Impact Scores', 'Live Conditions'],
  },
];

// ============================================================================
// UTILITIES
// ============================================================================

function mod(n, m) { return ((n % m) + m) % m; }

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [200, 200, 200];
}

// ============================================================================
// CARD SCENE — Procedural canvas animations inside each carousel card
// ============================================================================

const CARD_SCENE_DRAW = {
  crypto(ctx, w, h, t) {
    const cx = w / 2, cy = h / 2;
    // Orbiting particles
    for (let i = 0; i < 16; i++) {
      const angle = t * 0.5 + (i / 16) * Math.PI * 2;
      const r = Math.min(w, h) * 0.2 + Math.sin(t * 1.3 + i) * 6;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.arc(px, py, 2 - (i / 16), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168, 85, 247, ${(1 - i / 16) * 0.5})`;
      ctx.fill();
    }
    // Rotating cube
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.3);
    const s = Math.min(w, h) * 0.1;
    for (let i = 0; i < 3; i++) {
      const o = i * 3;
      ctx.strokeStyle = `rgba(168, 85, 247, ${0.35 - i * 0.1})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-(s - o) / 2, -(s - o) / 2, s - o, s - o);
    }
    ctx.restore();
    // Center glow
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.15);
    g.addColorStop(0, 'rgba(168, 85, 247, 0.1)');
    g.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 40, cy - 40, 80, 80);
  },

  sports(ctx, w, h, t) {
    const cx = w / 2, gy = h * 0.72;
    // Animated terrain
    ctx.fillStyle = 'rgba(5, 150, 105, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let x = 0; x <= w; x += 2) {
      ctx.lineTo(x, gy - Math.sin(x * 0.03 + t * 0.6) * 5 - Math.sin(x * 0.05 + t * 1.0) * 3);
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    // Ball
    const bx = cx + Math.sin(t * 0.5) * w * 0.18;
    const by = gy - 6 - Math.abs(Math.sin(t * 0.7)) * 18;
    ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
  },

  politics(ctx, w, h, t) {
    const cx = w / 2, cy = h / 2;
    const nodes = [
      [cx, cy - 20], [cx - 18, cy + 12], [cx + 18, cy + 12],
      [cx - 8, cy - 4], [cx + 8, cy - 4],
    ];
    const pulse = Math.sin(t * 1.5) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(67, 56, 202, ${pulse * 0.25})`;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[j][0] - nodes[i][0], nodes[j][1] - nodes[i][1]);
        if (d < 40) { ctx.beginPath(); ctx.moveTo(...nodes[i]); ctx.lineTo(...nodes[j]); ctx.stroke(); }
      }
    nodes.forEach(([x, y], i) => {
      const g = Math.sin(t * 1.2 + i) * 0.3 + 0.7;
      ctx.beginPath(); ctx.arc(x, y, 2.5 + g, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(67, 56, 202, ${0.4 + g * 0.3})`; ctx.fill();
    });
  },

  weather(ctx, w, h, t) {
    const cx = w / 2, cy = h / 2 - 5;
    // Cloud
    const cxo = cx + Math.sin(t * 0.3) * 12;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.07)';
    [[cxo, cy - 2, 24, 15], [cxo - 10, cy + 2, 18, 11], [cxo + 12, cy + 1, 16, 10]].forEach(([x, y, rw, rh]) => {
      ctx.beginPath(); ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2); ctx.fill();
    });
    // Rain
    for (let i = 0; i < 6; i++) {
      const rx = cx + Math.sin(t * 0.5 + i * 2) * 20 + (i - 3) * 6;
      const ry = ((t * 35 + i * 30) % 70) + 18;
      ctx.fillStyle = `rgba(56, 189, 248, ${ry > 15 && ry < 60 ? 0.35 : 0.05})`;
      ctx.fillRect(rx, ry, 1.2, 4);
    }
    // Sun glow
    const g = ctx.createRadialGradient(cx + 20, cy - 18, 0, cx + 20, cy - 18, 28);
    g.addColorStop(0, 'rgba(251, 191, 36, 0.07)'); g.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 10, cy - 48, 60, 60);
  },
};

function startCardScene(canvas, cardId, stateRef) {
  const drawFn = CARD_SCENE_DRAW[cardId];
  if (!drawFn) return;

  let rafId;
  let startTime = performance.now();

  const resize = () => {
    const p = canvas.parentElement;
    if (p) { canvas.width = p.clientWidth; canvas.height = p.clientHeight; }
  };
  resize();

  const loop = (now) => {
    if (stateRef.current.isEntering) { rafId = requestAnimationFrame(loop); return; }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawFn(ctx, canvas.width, canvas.height, (now - startTime) / 1000);
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);

  canvas._sceneCleanup = () => { cancelAnimationFrame(rafId); ro.disconnect(); };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * useCarouselPhysics — pure physics, interaction, DOM creation, and rendering logic.
 * Returns refs and handler callbacks for use by the React component.
 *
 * @param {object} params
 * @param {(card: object) => void} params.onActiveCardChange - called when centered card changes
 * @param {(router: any, cardData: object) => void} params.onCardClick - called when a card is clicked
 */
export default function useCarouselPhysics({ onActiveCardChange, onCardClick }) {
  const stageRef = useRef(null);
  const cardsRootRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const loaderRef = useRef(null);

  const stateRef = useRef({
    items: [],
    positions: null,
    scrollX: 0,
    velocity: 0,
    activeIndex: -1,
    isEntering: true,
    isDragging: false,
    lastPointerX: 0,
    lastPointerT: 0,
    lastDelta: 0,
    rafId: null,
    bgRAF: null,
    lastTime: 0,
    lastBgDraw: 0,
    bgFastUntil: 0,
    CARD_W: 0, CARD_H: 0, STEP: 0, TRACK: 0, VW_HALF: 0,
    gradCurrent: { r1: 107, g1: 33, b1: 168, r2: 190, g2: 24, b2: 93 },
  });

  // --------------------------------------------------------------------------
  // Layout Measurement
  // --------------------------------------------------------------------------

  const measure = useCallback(() => {
    const s = stateRef.current;
    const sample = s.items[0]?.el;
    if (!sample) return;
    const r = sample.getBoundingClientRect();
    s.CARD_W = r.width || 300;
    s.CARD_H = r.height || 400;
    s.STEP = s.CARD_W + GAP;
    s.TRACK = s.items.length * s.STEP;
    s.items.forEach((it, i) => { it.x = i * s.STEP; });
    s.positions = new Float32Array(s.items.length);
    s.VW_HALF = window.innerWidth * 0.5;
  }, []);

  // --------------------------------------------------------------------------
  // 3D Transform Calculation
  // --------------------------------------------------------------------------

  const transformForScreenX = useCallback((screenX, _step, vwHalf) => {
    const norm = Math.max(-1, Math.min(1, screenX / vwHalf));
    const absNorm = Math.abs(norm);
    const invNorm = 1 - absNorm;
    return {
      norm, absNorm, invNorm,
      ry: -norm * MAX_ROTATION,
      tz: invNorm * MAX_DEPTH,
      scale: MIN_SCALE + invNorm * SCALE_RANGE,
    };
  }, []);

  // --------------------------------------------------------------------------
  // Update Card Transforms
  // --------------------------------------------------------------------------

  const updateTransforms = useCallback(() => {
    const s = stateRef.current;
    if (!s.items.length || !s.positions) return;

    const half = s.TRACK / 2;
    let closestIdx = -1;
    let closestDist = Infinity;

    for (let i = 0; i < s.items.length; i++) {
      let pos = s.items[i].x - s.scrollX;
      if (pos < -half) pos += s.TRACK;
      if (pos > half) pos -= s.TRACK;
      s.positions[i] = pos;
      const dist = Math.abs(pos);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    }

    const prevIdx = (closestIdx - 1 + s.items.length) % s.items.length;
    const nextIdx = (closestIdx + 1) % s.items.length;

    for (let i = 0; i < s.items.length; i++) {
      const it = s.items[i];
      const pos = s.positions[i];
      const { norm, ry, tz, scale } = transformForScreenX(pos, s.STEP, s.VW_HALF);
      it.el.style.transform = `translate3d(${pos}px,-50%,${tz}px) rotateY(${ry}deg) scale(${scale})`;
      it.el.style.zIndex = String(1000 + Math.round(tz));
      const isCore = i === closestIdx || i === prevIdx || i === nextIdx;
      it.el.style.filter = `blur(${isCore ? 0 : BLUR_AMOUNT * Math.pow(Math.abs(norm), 1.1).toFixed(2)}px)`;
    }

    if (closestIdx !== s.activeIndex) {
      s.activeIndex = closestIdx;
      const card = CARDS[closestIdx];
      onActiveCardChange?.(card);
      transitionGradient(card.gradient);
    }
  });

  // --------------------------------------------------------------------------
  // Background Gradient
  // --------------------------------------------------------------------------

  const transitionGradient = useCallback((colors) => {
    const s = stateRef.current;
    if (!colors || colors.length < 2) return;
    const [c1, c2] = [hexToRgb(colors[0]), hexToRgb(colors[1])];
    s.bgFastUntil = performance.now() + 800;
    gsap.to(s.gradCurrent, {
      r1: c1[0], g1: c1[1], b1: c1[2],
      r2: c2[0], g2: c2[1], b2: c2[2],
      duration: 0.45, ease: 'power2.out',
    });
  }, []);

  const drawBackground = useCallback(() => {
    const s = stateRef.current;
    const canvas = bgCanvasRef.current;
    if (!canvas) { s.bgRAF = requestAnimationFrame(drawBackground); return; }
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const now = performance.now();
    if (now - s.lastBgDraw < (now < s.bgFastUntil ? 16 : 33)) {
      s.bgRAF = requestAnimationFrame(drawBackground);
      return;
    }
    s.lastBgDraw = now;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const tw = Math.floor(w * dpr), th = Math.floor(h * dpr);
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw; canvas.height = th;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    const time = now * 0.0002;
    const cx = w * 0.5, cy = h * 0.5;
    const a1 = Math.min(w, h) * 0.45, a2 = Math.min(w, h) * 0.35;
    const x1 = cx + Math.cos(time) * a1, y1 = cy + Math.sin(time * 0.8) * a1 * 0.4;
    const x2 = cx + Math.cos(-time * 0.9 + 1.2) * a2, y2 = cy + Math.sin(-time * 0.7 + 0.7) * a2 * 0.5;

    const g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, Math.max(w, h) * 0.8);
    g1.addColorStop(0, `rgba(${s.gradCurrent.r1},${s.gradCurrent.g1},${s.gradCurrent.b1},0.65)`);
    g1.addColorStop(1, 'rgba(10,10,15,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, Math.max(w, h) * 0.7);
    g2.addColorStop(0, `rgba(${s.gradCurrent.r2},${s.gradCurrent.g2},${s.gradCurrent.b2},0.50)`);
    g2.addColorStop(1, 'rgba(10,10,15,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    s.bgRAF = requestAnimationFrame(drawBackground);
  }, []);

  // --------------------------------------------------------------------------
  // Animation Loop
  // --------------------------------------------------------------------------

  const tick = useCallback((t) => {
    const s = stateRef.current;
    const dt = s.lastTime ? (t - s.lastTime) / 1000 : 0;
    s.lastTime = t;
    s.scrollX = mod(s.scrollX + s.velocity * dt, s.TRACK);
    s.velocity *= Math.pow(FRICTION, dt * 60);
    if (Math.abs(s.velocity) < 0.02) s.velocity = 0;
    updateTransforms();
    s.rafId = requestAnimationFrame(tick);
  }, [updateTransforms]);

  const stopCarousel = useCallback(() => {
    const s = stateRef.current;
    if (s.rafId) { cancelAnimationFrame(s.rafId); s.rafId = null; }
    if (s.bgRAF) { cancelAnimationFrame(s.bgRAF); s.bgRAF = null; }
  }, []);

  const pauseCarouselMotion = useCallback(() => {
    const s = stateRef.current;
    if (s.rafId) { cancelAnimationFrame(s.rafId); s.rafId = null; }
    s.velocity = 0;
  }, []);

  const startCarousel = useCallback(() => {
    const s = stateRef.current;
    if (s.rafId) cancelAnimationFrame(s.rafId);
    s.lastTime = 0;
    s.rafId = requestAnimationFrame((t) => { updateTransforms(); tick(t); });
  }, [tick, updateTransforms]);

  // --------------------------------------------------------------------------
  // Entry Animation (GSAP)
  // --------------------------------------------------------------------------

  const animateEntry = useCallback(async () => {
    await new Promise((r) => requestAnimationFrame(r));
    const s = stateRef.current;
    const visibleCards = [];
    const half = s.TRACK / 2;
    for (let i = 0; i < s.items.length; i++) {
      let pos = s.items[i].x - s.scrollX;
      if (pos < -half) pos += s.TRACK;
      if (pos > half) pos -= s.TRACK;
      if (Math.abs(pos) < window.innerWidth * 0.6) visibleCards.push({ item: s.items[i], screenX: pos, index: i });
    }
    visibleCards.sort((a, b) => a.screenX - b.screenX);

    if (loaderRef.current) loaderRef.current.classList.add('loader--hide');

    const tl = gsap.timeline();
    visibleCards.forEach(({ item, screenX }, idx) => {
      const state = { p: 0 };
      const { ry, tz, scale: baseScale } = transformForScreenX(screenX, s.STEP, s.VW_HALF);
      item.el.style.opacity = '0';
      item.el.style.transform = `translate3d(${screenX}px,-50%,${tz}px) rotateY(${ry}deg) scale(0.90) translateY(40px)`;

      tl.to(state, {
        p: 1, duration: 0.6, ease: 'power3.out',
        onUpdate: () => {
          const t = state.p;
          const curScale = 0.90 + (baseScale - 0.90) * t;
          const curY = 40 * (1 - t);
          item.el.style.opacity = t.toFixed(3);
          if (t >= 0.999) {
            const { ry: ry2, tz: tz2, scale: sc2 } = transformForScreenX(screenX, s.STEP, s.VW_HALF);
            item.el.style.transform = `translate3d(${screenX}px,-50%,${tz2}px) rotateY(${ry2}deg) scale(${sc2})`;
          } else {
            item.el.style.transform = `translate3d(${screenX}px,-50%,${tz}px) rotateY(${ry}deg) scale(${curScale}) translateY(${curY}px)`;
          }
        },
      }, idx * 0.05);
    });
    await new Promise((resolve) => tl.eventCallback('onComplete', resolve));
  }, [transformForScreenX]);

  // --------------------------------------------------------------------------
  // Canvas Resize
  // --------------------------------------------------------------------------

  const resizeBG = useCallback(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const tw = Math.floor(w * dpr), th = Math.floor(h * dpr);
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw; canvas.height = th;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, []);

  // --------------------------------------------------------------------------
  // Create Card DOM
  // --------------------------------------------------------------------------

  const createCards = useCallback((maxCards = 4) => {
    const root = cardsRootRef.current;
    if (!root) return;
    root.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const sItems = [];

    const visibleCards = CARDS.slice(0, Math.min(maxCards, CARDS.length));

    visibleCards.forEach((cardData) => {
      const card = document.createElement('article');
      card.className = 'carousel-card';
      card.style.willChange = 'transform';
      card.setAttribute('data-onboard', cardData.id);

      const inner = document.createElement('div');
      inner.className = 'carousel-card-inner';

      const icon = document.createElement('div');
      icon.className = 'carousel-card-icon';
      icon.textContent = cardData.icon;

      const badge = document.createElement('div');
      badge.className = 'carousel-card-badge';
      badge.textContent = cardData.badge;

      const title = document.createElement('h2');
      title.className = 'carousel-card-title';
      title.textContent = cardData.title;

      const tagline = document.createElement('p');
      tagline.className = 'carousel-card-tagline';
      tagline.textContent = cardData.tagline;

      inner.append(icon, badge, title, tagline);

      const overlay = document.createElement('div');
      overlay.className = 'carousel-card-overlay';
      overlay.style.background = `linear-gradient(135deg, ${cardData.gradient[0]}33, ${cardData.gradient[1]}22)`;

      card.append(overlay, inner);

      // Scene canvas — procedural animation inside each card
      const sceneCanvas = document.createElement('canvas');
      sceneCanvas.className = 'carousel-card-scene';
      sceneCanvas.setAttribute('data-card-scene', cardData.id);
      sceneCanvas.setAttribute('aria-hidden', 'true');
      card.appendChild(sceneCanvas);
      startCardScene(sceneCanvas, cardData.id, stateRef);

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        if (stateRef.current.isEntering) return;
        try {
          localStorage.setItem('fourcast_interests', JSON.stringify([cardData.id]));
          localStorage.setItem('fourcast_visited', 'true');
        } catch { /* noop */ }
        onCardClick?.(cardData);
      });

      fragment.appendChild(card);
      sItems.push({ el: card, x: 0, cardData });
    });

    root.appendChild(fragment);
    stateRef.current.items = sItems;
  }, []);

  // --------------------------------------------------------------------------
  // Warmup Compositing
  // --------------------------------------------------------------------------

  const warmupCompositing = useCallback(async () => {
    const s = stateRef.current;
    const originalScrollX = s.scrollX;
    const stepSize = s.STEP * 0.5;
    const numSteps = Math.ceil(s.TRACK / stepSize);
    for (let i = 0; i < numSteps; i++) {
      s.scrollX = mod(originalScrollX + i * stepSize, s.TRACK);
      updateTransforms();
      if (i % 3 === 0) await new Promise((r) => requestAnimationFrame(r));
    }
    s.scrollX = originalScrollX;
    updateTransforms();
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
  }, [updateTransforms]);

  // --------------------------------------------------------------------------
  // Interaction Handlers
  // --------------------------------------------------------------------------

  const onWheel = useCallback((e) => {
    if (stateRef.current.isEntering) return;
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    stateRef.current.velocity += delta * WHEEL_SENS * 20;
  }, []);

  const onPointerDown = useCallback((e) => {
    if (stateRef.current.isEntering) return;

    // Don't start drag if clicking an interactive element
    if (e.target.closest('button, a, input, [role="button"]')) {
      return;
    }

    const s = stateRef.current;
    s.isDragging = true;
    s.lastPointerX = e.clientX;
    s.lastPointerT = performance.now();
    s.lastDelta = 0;
    stageRef.current?.setPointerCapture(e.pointerId);
    stageRef.current?.classList.add('dragging');
  }, []);

  const onPointerMove = useCallback((e) => {
    const s = stateRef.current;
    if (!s.isDragging) return;
    const now = performance.now();
    const dx = e.clientX - s.lastPointerX;
    const dt = Math.max(1, now - s.lastPointerT) / 1000;
    s.scrollX = mod(s.scrollX - dx * DRAG_SENS, s.TRACK);
    s.lastDelta = dx / dt;
    s.lastPointerX = e.clientX;
    s.lastPointerT = now;
  }, []);

  const onPointerUp = useCallback((e) => {
    const s = stateRef.current;
    if (!s.isDragging) return;
    s.isDragging = false;
    stageRef.current?.releasePointerCapture(e.pointerId);
    s.velocity = -s.lastDelta * DRAG_SENS;
    stageRef.current?.classList.remove('dragging');
  }, []);

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  const cleanup = useCallback(() => {
    const s = stateRef.current;
    if (s.rafId) cancelAnimationFrame(s.rafId);
    if (s.bgRAF) cancelAnimationFrame(s.bgRAF);
    // Cleanup card scene canvases
    s.items.forEach((it) => {
      const canvas = it.el?.querySelector('.carousel-card-scene');
      if (canvas?._sceneCleanup) canvas._sceneCleanup();
    });
  }, []);

  return {
    stageRef, cardsRootRef, bgCanvasRef, loaderRef, stateRef,
    measure, updateTransforms, startCarousel, stopCarousel, pauseCarouselMotion,
    drawBackground, transitionGradient, resizeBG,
    animateEntry, warmupCompositing, createCards,
    onWheel, onPointerDown, onPointerMove, onPointerUp,
    tick, cleanup,
  };
}
