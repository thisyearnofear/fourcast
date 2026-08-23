'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { onBackdropPulse } from '@/components/BackdropProvider';

/**
 * LiquidFieldScene — the R3F liquid wave field (Tier 3 backdrop).
 *
 * A displacement-shader plane seen at a grazing angle: layered traveling
 * waves + pointer ripples + state-colored pulse wavefronts, rendered as an
 * antialiased glowing grid with specular sheen — the "liquid metal" look,
 * rebuilt from scratch (the reference demo is CC BY-NC and unusable here).
 *
 * State-aware: reads data-backdrop-state (set by BackdropProvider) and
 * lerps the field tint toward the matching palette. Pulse-reactive:
 * subscribes to the shared emitBackdropPulse bus, same as the 2D WaveGrid.
 *
 * This file is dynamically imported by LiquidField only after WebGL +
 * fine-pointer + no-reduced-motion checks pass, so three.js never loads
 * for incapable clients.
 */

// Backdrop state → tint (matches BackdropProvider semantics).
const STATE_TINTS = {
  idle: new THREE.Color(0.47, 0.96, 0.72),
  scanning: new THREE.Color(0.47, 0.96, 0.72), // emerald
  sealed: new THREE.Color(0.96, 0.77, 0.42), // amber
  breach: new THREE.Color(1.0, 0.48, 0.44), // red
  review: new THREE.Color(0.77, 0.71, 0.99), // violet
  reconciled: new THREE.Color(0.47, 0.96, 0.72),
};
const DEFAULT_TINT = STATE_TINTS.scanning;
const MAX_PULSES = 4;

// Venue peaks in uv space, mapped from the 2D WaveGrid's field coords
// (v = 1 - ny, since v=0 is the near edge and v=1 the horizon).
// x = u position, y = v position, z = quiet flag (1 → amber roadmap venue).
const PEAKS = [
  { u: 0.22, v: 0.48, quiet: 0 }, // Polymarket
  { u: 0.7, v: 0.6, quiet: 0 }, // Kalshi
  { u: 0.84, v: 0.32, quiet: 0 }, // Delphi
  { u: 0.38, v: 0.74, quiet: 1 }, // Canton
];

const VERT = /* glsl */ `
uniform float uTime;
uniform vec3 uMouse;      // xz in plane-local coords, y = strength
uniform vec4 uPulses[${MAX_PULSES}]; // xy origin, z start time, w amp
varying vec2 vUv;
varying float vH;

float waveH(vec2 p, float t) {
  float h = 0.0;
  h += sin(p.x * 0.55 + t * 0.60) * 0.30;
  h += sin(p.y * 0.80 + t * 0.45) * 0.22;
  h += sin((p.x + p.y) * 0.35 + t * 0.30) * 0.26;
  h += sin(length(p) * 0.45 - t * 0.80) * 0.16;
  return h;
}

void main() {
  vUv = uv;
  vec3 pos = position;
  float h = waveH(pos.xy, uTime);

  // Pointer ripple — a decaying ring around the cursor.
  if (uMouse.z > 0.001) {
    float d = distance(pos.xy, uMouse.xy);
    h += sin(d * 1.4 - uTime * 5.0) * exp(-d * 0.28) * 0.55 * uMouse.z;
  }

  // Pulse wavefronts from the shared backdrop bus.
  for (int i = 0; i < ${MAX_PULSES}; i++) {
    vec4 P = uPulses[i];
    if (P.w > 0.0) {
      float age = uTime - P.z;
      if (age > 0.0 && age < 2.4) {
        float d = distance(pos.xy, P.xy);
        float front = age * 7.0;
        float band = exp(-pow((d - front) / 1.6, 2.0));
        h += sin(d * 0.9 - age * 6.0) * band * (1.0 - age / 2.4) * P.w;
      }
    }
  }

  pos.z += h;
  vH = h;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uTint;
uniform float uTime;
uniform vec3 uPeaks[4];   // x=u, y=v, z=quiet flag
uniform vec4 uPulses[${MAX_PULSES}];
varying vec2 vUv;
varying float vH;

void main() {
  // Antialiased grid lines in uv space (30 x 18 cells).
  vec2 g = vUv * vec2(30.0, 18.0);
  vec2 fw = fwidth(g);
  vec2 ga = abs(fract(g - 0.5) - 0.5) / max(fw, vec2(1e-4));
  float line = 1.0 - min(min(ga.x, ga.y), 1.0);

  // Depth fade: v=0 is the near edge (bright), v=1 the horizon (dissolves).
  float fade = 1.0 - smoothstep(0.42, 0.98, vUv.y);
  // Edge fade left/right so the plane never shows a hard border.
  float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);

  // Height-based lighting: crests catch light, troughs recede.
  float light = clamp(0.35 + vH * 0.55, 0.0, 1.0);
  float spec = pow(clamp(vH * 0.5 + 0.5, 0.0, 1.0), 6.0) * 0.35;

  vec3 deep = vec3(0.016, 0.055, 0.04);
  vec3 col = deep + uTint * (line * (0.22 + light * 0.5) + spec * line);
  float alpha = (line * (0.30 + light * 0.45) + spec * 0.25) * fade * edge;

  // Venue peaks — glowing dots that flash as a pulse wavefront passes.
  // Names live in the hero legend strip; the field carries the light.
  for (int i = 0; i < 4; i++) {
    vec3 pk = uPeaks[i];
    float aspect = 30.0 / 18.0; // match grid cell aspect so dots stay round
    vec2 d = (vUv - pk.xy) * vec2(aspect, 1.0);
    float dist = length(d);
    float quiet = pk.z;
    vec3 peakCol = mix(uTint, vec3(0.96, 0.77, 0.42), quiet); // amber if quiet

    // Flash when a pulse wavefront crosses this peak. Pulses originate at
    // plane center (uv 0.5, 0.5); the peak's plane-unit distance from center
    // is compared against the expanding wavefront radius (age * 7.0).
    vec2 peakLocal = (pk.xy - 0.5) * vec2(34.0, 22.0);
    float peakDist = length(peakLocal);
    float flash = 0.0;
    for (int j = 0; j < ${MAX_PULSES}; j++) {
      vec4 P = uPulses[j];
      if (P.w > 0.0) {
        float age = uTime - P.z;
        if (age > 0.0 && age < 2.4) {
          float front = age * 7.0;
          flash = max(flash, exp(-pow((peakDist - front) / 1.6, 2.0)) * (1.0 - age / 2.4));
        }
      }
    }

    float breathe = 0.5 + 0.5 * sin(uTime * 1.4 + float(i) * 1.7);
    float glow = exp(-pow(dist / 0.028, 2.0));
    float peakA = glow * (0.35 + breathe * 0.25 + flash * 0.9) * (1.0 - quiet * 0.4);
    col += peakCol * peakA * fade;
    alpha += peakA * 0.6 * fade;
  }

  gl_FragColor = vec4(col, alpha);
}
`;

function Field() {
  const matRef = useRef(null);
  const { camera } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const planeRef = useRef(null);
  const pointerNdc = useRef(new THREE.Vector2(10, 10));
  const mouseTarget = useRef(new THREE.Vector3(0, 0, 0)); // x, y(local), strength
  const pulsesRef = useRef([]);
  const tintRef = useRef(DEFAULT_TINT.clone());

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uPulses: {
        value: Array.from({ length: MAX_PULSES }, () => new THREE.Vector4(0, 0, 0, 0)),
      },
      uPeaks: {
        value: PEAKS.map((p) => new THREE.Vector3(p.u, p.v, p.quiet)),
      },
      uTint: { value: DEFAULT_TINT.clone() },
    }),
    [],
  );

  // Subscribe to the shared backdrop pulse bus.
  useEffect(() => {
    const unsubscribe = onBackdropPulse(({ state } = {}) => {
      const tint = STATE_TINTS[state] || DEFAULT_TINT;
      const amp = state === 'sealed' ? 0.35 : 0.9;
      const now = matRef.current ? matRef.current.uniforms.uTime.value : 0;
      const pulses = pulsesRef.current;
      pulses.push({ x: 0, y: 0, t0: now, amp, tint: tint.clone() });
      if (pulses.length > MAX_PULSES) pulses.shift();
    });
    return unsubscribe;
  }, []);

  // Pointer tracking — the canvas is pointer-events:none (it sits under
  // the content), so listen on window like the 2D WaveGrid does and
  // raycast onto the plane from there.
  useEffect(() => {
    const onMove = (e) => {
      pointerNdc.current.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
    };
    const onLeave = () => pointerNdc.current.set(10, 10);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    const u = mat.uniforms;
    u.uTime.value += delta;
    const t = u.uTime.value;

    // Raycast pointer onto the plane; ease strength in/out.
    let strengthTarget = 0;
    if (planeRef.current && pointerNdc.current.x < 5) {
      raycaster.setFromCamera(pointerNdc.current, camera);
      const hit = raycaster.intersectObject(planeRef.current, false)[0];
      if (hit) {
        // Convert world hit point to plane-local xy (plane is rotated).
        const local = planeRef.current.worldToLocal(hit.point.clone());
        mouseTarget.current.set(local.x, local.y, 1);
        strengthTarget = 1;
      }
    }
    const m = u.uMouse.value;
    m.x += (mouseTarget.current.x - m.x) * Math.min(1, delta * 8);
    m.y += (mouseTarget.current.y - m.y) * Math.min(1, delta * 8);
    m.z += (strengthTarget - m.z) * Math.min(1, delta * 4);

    // Write live pulses into the uniform ring.
    const live = pulsesRef.current.filter((p) => t - p.t0 < 2.4);
    pulsesRef.current = live;
    for (let i = 0; i < MAX_PULSES; i++) {
      const P = u.uPulses.value[i];
      const p = live[i];
      if (p) P.set(p.x, p.y, p.t0, p.amp);
      else P.set(0, 0, 0, 0);
    }

    // Lerp tint toward the current backdrop state palette.
    const stateAttr =
      typeof document !== 'undefined'
        ? document.documentElement.getAttribute('data-backdrop-state')
        : null;
    const target = STATE_TINTS[stateAttr] || DEFAULT_TINT;
    tintRef.current.lerp(target, Math.min(1, delta * 1.5));
    u.uTint.value.copy(tintRef.current);
  });

  return (
    <mesh
      ref={planeRef}
      rotation={[-Math.PI / 2.35, 0, 0]}
      position={[0, -1.6, 0]}
    >
      <planeGeometry args={[34, 22, 140, 90]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export default function LiquidFieldScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 2.6, 9], fov: 50 }}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      aria-hidden
    >
      <Field />
    </Canvas>
  );
}
