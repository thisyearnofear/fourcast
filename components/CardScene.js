'use client';

import { useEffect, useRef } from 'react';

/**
 * Lightweight canvas-based procedural animations for carousel cards.
 * Runs at 60fps using requestAnimationFrame, no Three.js overhead.
 */

// ============================================================================
// Crypto — rotating geometric shapes with particle trail
// ============================================================================

function drawCryptoScene(ctx, w, h, t) {
  const cx = w / 2, cy = h / 2;

  // Particle trail
  for (let i = 0; i < 20; i++) {
    const angle = t * 0.5 + (i / 20) * Math.PI * 2;
    const radius = Math.min(w, h) * 0.25 + Math.sin(t * 1.3 + i) * 8;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const alpha = 1 - (i / 20);
    ctx.beginPath();
    ctx.arc(x, y, 2 * alpha + 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.6})`;
    ctx.fill();
  }

  // Central cube (rotating)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.4);

  const size = Math.min(w, h) * 0.12;
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
  ctx.lineWidth = 1.5;

  // Draw cube faces
  for (let i = 0; i < 3; i++) {
    const offset = i * 4;
    const s = size - offset;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
  }

  // Inner glow
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
  grad.addColorStop(0, 'rgba(168, 85, 247, 0.1)');
  grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-size, -size, size * 2, size * 2);

  ctx.restore();
}

// ============================================================================
// Sports — wave terrain with moving ball
// ============================================================================

function drawSportsScene(ctx, w, h, t) {
  const cx = w / 2, cy = h / 2 + 10;
  const groundY = cy + Math.min(w, h) * 0.15;

  // Green ground
  ctx.fillStyle = 'rgba(5, 150, 105, 0.15)';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0; x <= w; x += 2) {
    const wave = Math.sin(x * 0.03 + t * 0.8) * 6 + Math.sin(x * 0.05 + t * 1.2) * 3;
    ctx.lineTo(x, groundY - wave);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Field lines
  ctx.strokeStyle = 'rgba(5, 150, 105, 0.2)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, groundY);
  ctx.lineTo(cx, h);
  ctx.stroke();

  // Moving ball
  const ballX = cx + Math.sin(t * 0.6) * (w * 0.2);
  const ballY = groundY - 8 - Math.abs(Math.sin(t * 0.8)) * 20;
  ctx.beginPath();
  ctx.arc(ballX, ballY, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ============================================================================
// Politics — connected node graph
// ============================================================================

function drawPoliticsScene(ctx, w, h, t) {
  const cx = w / 2, cy = h / 2;
  const nodes = [
    { x: cx, y: cy - 25 },
    { x: cx - 20, y: cy + 15 },
    { x: cx + 20, y: cy + 15 },
    { x: cx - 10, y: cy - 5 },
    { x: cx + 10, y: cy - 5 },
  ];

  // Pulsing connections
  const pulse = Math.sin(t * 1.5) * 0.3 + 0.7;
  ctx.strokeStyle = `rgba(67, 56, 202, ${pulse * 0.3})`;
  ctx.lineWidth = 1;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 50) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }

  // Nodes
  nodes.forEach((n, i) => {
    const glow = Math.sin(t * 1.2 + i) * 0.3 + 0.7;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 3 + glow, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(67, 56, 202, ${0.5 + glow * 0.3})`;
    ctx.fill();
  });
}

// ============================================================================
// Weather — animated gradient with floating particles
// ============================================================================

function drawWeatherScene(ctx, w, h, t) {
  const cx = w / 2, cy = h / 2 - 5;

  // Cloud shapes
  const cloudX = cx + Math.sin(t * 0.3) * 15;
  const cloudY = cy - 5;

  ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
  [
    [cloudX, cloudY, 30, 18],
    [cloudX - 12, cloudY + 3, 22, 14],
    [cloudX + 14, cloudY + 2, 20, 13],
  ].forEach(([x, y, rw, rh]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Rain drops
  for (let i = 0; i < 8; i++) {
    const rx = cx + Math.sin(t * 0.5 + i * 2) * 25 + (i - 4) * 5;
    const ry = ((t * 40 + i * 30) % 80) - 10 + 15;
    const alpha = ry > 10 && ry < 70 ? 0.4 : 0.1;
    ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
    ctx.fillRect(rx, ry, 1.5, 5);
  }

  // Sun glow
  const grad = ctx.createRadialGradient(cx + 25, cy - 20, 0, cx + 25, cy - 20, 30);
  grad.addColorStop(0, 'rgba(251, 191, 36, 0.08)');
  grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - 10, cy - 55, 70, 70);
}

// ============================================================================
// Scene Router
// ============================================================================

const SCENES = {
  crypto: drawCryptoScene,
  sports: drawSportsScene,
  politics: drawPoliticsScene,
  weather: drawWeatherScene,
};

// ============================================================================
// Component
// ============================================================================

export default function CardScene({ cardId, className = '' }) {
  const canvasRef = useRef(null);
  const drawFn = SCENES[cardId];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !drawFn) return;

    let rafId;
    let startTime = performance.now();

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };

    resize();

    const draw = (now) => {
      const t = (now - startTime) / 1000;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawFn(ctx, canvas.width, canvas.height, t);
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [cardId, drawFn]);

  if (!drawFn) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ opacity: 0.6 }}
      aria-hidden="true"
    />
  );
}
