/**
 * brandColors — sRGB hex equivalents of the oklch tokens in tokens.css.
 *
 * For the contexts that cannot resolve CSS variables: OG image generation
 * (Satori), canvas/three.js scenes, chart library props, wallet-modal themes,
 * and self-contained error documents. Every UI surface that CAN use
 * var(--color-*) or the Tailwind theme utilities must keep doing so — these
 * constants are the escape hatch, not the default.
 *
 * Values were converted from tokens.css (oklch → sRGB). If tokens.css changes,
 * regenerate this file.
 */
export const BRAND_HEX = {
  paper: '#0c1410',
  paperDeep: '#050b08',
  paperRaised: '#141d19',
  paperSoft: '#1c2722',
  ink: '#f2eee3',
  inkMuted: '#b0b2a9',
  inkFaint: '#7f857e',
  accent: '#63f0a8',
  accentInk: '#01170b',
  evidence: '#57a8ff',
  sealed: '#f7c15f',
  breach: '#fd7466',
  review: '#b9aaf8',
  focus: '#66ffb2',
};

/** Ink at hairline/faint opacities — the rule family, for canvas + charts. */
export const RULE_HEX = {
  hairline: 'rgba(242, 238, 227, 0.12)',
  strong: 'rgba(242, 238, 227, 0.22)',
  faint: 'rgba(242, 238, 227, 0.35)',
};

/**
 * RGB triplets for canvas 2D/WebGL contexts (gradients, shaders) where CSS
 * colour functions cannot be evaluated. Same tokens, unpacked.
 */
export const BRAND_RGB = {
  accent: [99, 240, 168],
  sealed: [247, 193, 95],
  breach: [253, 116, 102],
  review: [185, 170, 248],
  evidence: [87, 168, 255],
  ink: [242, 238, 227],
};

/** Accent at the atmosphere/quiet opacities used by backdrop + glow states. */
export const ACCENT_ALPHA = {
  quiet: 'rgba(99, 240, 168, 0.035)',
  atmosphere: 'rgba(99, 240, 168, 0.1)',
  soft: 'rgba(99, 240, 168, 0.15)',
  pulse: 'rgba(99, 240, 168, 0.18)',
  strong: 'rgba(99, 240, 168, 0.25)',
};
