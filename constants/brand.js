/**
 * Fourcast brand & product narrative — single source of truth.
 * Venue loop: Markets → act → Positions, with Canton privacy as differentiator.
 * Bright Data scrape enrichment is optional when credits/keys are available.
 */

export const BRAND = {
  name: 'Fourcast',
  /** Wordmark-only identity preferred in UI; emoji kept for OG/legacy */
  emoji: '◆',

  /** Primary customer — drives every product decision. */
  primaryCustomer: 'Quant Operator',
  /** How we acquire them — the distribution loop. */
  acquisitionLayer: 'Signal Marketplace (Farcaster / Warpcast / X)',
  /** The fall-back customer if the test fails on custody. */
  fallbackCustomer: 'Signal Analyst / Reputation Climber',

  /** Positioning — single source of truth for everyone (UI + docs + tests). */
  positioning: {
    headline:
      'Prediction markets with private size — settle in CBTC, prove what the public ledger cannot see.',
    promise:
      'Browse · trade or publish · track · private settle when size must stay hidden.',
    excludeRetailLead: false,
    primaryRfb: '02 — Prediction Market Trader Intelligence',
    secondaryRfb: '05 — Cross-Platform Arbitrage (execution layer)',
    acquisitionRfb: '06 — Social Trading Intelligence (acquisition loop)',
    operatorMath: {
      claim: 'Premium pays for itself on 3 attributed fills per month.',
      formula: 'Net = (attribution × fills) − $19.99 / mo',
      breakeven: '3 attributed fills at any size',
      assumption:
        'Builder attribution pays the configured revenue share per fill — reference values live in services/builderRevenue.js.',
      digest: 'At ≥ $6.67 net per attributed fill, Premium is net-positive in month 1. Daily operators hit that on day 3.',
    },
  },

  /** One line — hero, OG, pitch. */
  tagline: 'Private size. Public markets. Atomic CBTC settle.',

  /** Supporting line — subheads, metadata. */
  subhead:
    'Trade and publish like a venue you know. When size must stay hidden, settle privately on Canton — same ledger, two views.',

  /** Footer / trust strip */
  footerStrip: 'Polymarket · Kalshi · Canton CBTC · decision receipts',

  /** Demo CTA */
  demoTitle: 'See private settlement in under a minute',
  demoSubcopy:
    'Run the privacy check, then settle a position. Autopilot execution remains safety-gated — see /autopilot.',

  /** Product loop (NarrativeSteps) */
  loop: {
    search: { label: 'Search', short: 'Search', icon: '1' },
    analyze: { label: 'Analyze', short: 'Analyze', icon: '2' },
    publish: { label: 'Publish / Trade', short: 'Publish', icon: '3' },
    scored: { label: 'Track Record', short: 'Track', icon: '4' },
  },

  /** Page subtitles — max ~12 words; prefer none when tabs explain. */
  pages: {
    markets: 'Find the edge. Act. Then track it.',
    signals: 'Publish from Markets — follow & reputation still early.',
    agent: 'Policy, dry-run, sealed decision.',
    positions: 'Your book — public venues, then private size.',
    proof: 'Hide size. See escrow. Atomic CBTC.',
    labs: 'Autopilot, Builder, operator tools.',
  },

  /** Nav tooltips — short venue phrases that chain Markets → Positions → Private. */
  nav: {
    markets: 'Find edge · trade or publish',
    signals: 'Follow verified analyst calls',
    agent: 'Mandate and agent loop',
    positions: 'Your book after you act',
    canton: 'Private size · CBTC settle',
    labs: 'Autopilot and builder tools',
    alerts: 'Alerts from analysts you follow',
  },

  /** Nav label overrides.
   *  Primary: Markets · Positions · Private
   *  Overflow: Signals · Mandate · Labs · Alerts */
  navLabels: {
    markets: 'Markets',
    signals: 'Signals',
    agent: 'Mandate',
    positions: 'Positions',
    labs: 'Labs',
    worldCup: 'Private',
    alerts: 'Alerts',
    canton: 'Private',
  },

  /** Wallet explainer — progressive; show the chain needed for the action. */
  walletExplainer: {
    headline: 'Connect for the action you need:',
    layers: [
      { icon: 'Ξ', name: 'Trade / publish', detail: 'EVM wallet — Polymarket, Kalshi, Arc reputation' },
      { icon: '◈', name: 'Private settle', detail: 'No wallet needed for the privacy proof — see Private' },
      { icon: '◎', name: 'Inspect proofs', detail: 'Phantom — Solana receipt anchoring' },
    ],
    cta: 'Connect only what the next action requires.',
  },

  publish: {
    arcPreferred: { chain: 'Arc (USDC)', gas: '~$0.01 USDC' },
    cantonPrivate: { chain: 'Canton (cBTC/cETH)', gas: 'sub-cent', privacy: 'Position sizes hidden from all third parties' },
    footnote: 'Arc = public receipt. Canton = private position. EVM = venue orders.',
  },

  agent: {
    title: 'Mandate',
    subtitle: 'Policy · dry-run · sealed decision',
    badge: 'Operator loop',
    runCta: 'Run Agent',
    labsCta: 'Enable Autopilot →',
  },

  operatorLoop: {
    discover: { label: 'Discover', short: 'Discover', icon: '1' },
    forecast: { label: 'Forecast', short: 'Forecast', icon: '2' },
    size:     { label: 'Size with Kelly', short: 'Size', icon: '3' },
    execute:  { label: 'Execute / Publish', short: 'Execute', icon: '4' },
    track:    { label: 'Track Record', short: 'Track', icon: '5' },
  },

  quad: {
    forOperators: 'Polymarket & Kalshi operators running real capital who need verified attribution, not vibes.',
    forAnalysts:  'Signal publishers who want their calls surfaced to operator-tier followers, not retail engagement.',
    notFor:       "Casual lookers. If you don't intend to put capital at risk, Fourcast will underserve you. Use the free tier to audit, not to gamble.",
  },

  labs: {
    subtitle: 'Autopilot, Builder, Canton ops',
    autopilot: {
      title: 'Autopilot',
      description:
        'Safety-gated execution of policy-bound, Kelly-sized agent decisions.',
      status: 'core',
    },
    builder: {
      description:
        'Polymarket Builder Program — earn USDC per fill from attributed orders.',
    },
  },

  webIntel: {
    label: 'Deep web scrape',
    shortLabel: 'Web scrape',
    optionalNote: 'Optional enrichment when available — analysis works without it.',
    unavailableNote: 'Deep web scrape is offline. Analysis uses AI + market data.',
  },

  hackathon: {
    label: 'Bright Data · Web Data UNLOCKED',
    track: 'Track 2: Finance & Market Intelligence',
  },

  metadata: {
    title: 'Fourcast — Private prediction-market settlement',
    description:
      'Prediction markets with private size and atomic CBTC settlement on Canton — plus verified decision receipts operators can audit.',
  },
};

/**
 * Onboarding copy — venue-first, short.
 */
export const ONBOARDING_COPY = [
  {
    id: 'welcome',
    title: 'Welcome to Fourcast',
    description:
      'Browse markets, act, and track. Private CBTC settle when size must stay hidden.',
    icon: '1',
    target: null,
  },
  {
    id: 'markets',
    title: 'Pick a market',
    description:
      'Scan odds and edge. One action: analyze, trade, or publish.',
    icon: '2',
    target: '[data-onboard="markets"]',
  },
  {
    id: 'publish',
    title: 'Act on edge',
    description:
      'Fair odds vs market, Kelly size, then trade or publish a receipt.',
    icon: '3',
    target: '[data-onboard="publish"]',
  },
  {
    id: 'agent',
    title: 'Run under a mandate',
    description:
      'Policy-bound agent decisions seal to a receipt before the outcome.',
    icon: '4',
    target: '[data-onboard="agent"]',
  },
  {
    id: 'positions',
    title: 'Track positions',
    description:
      'Public track record and private Canton positions in one place.',
    icon: '5',
    target: '[data-onboard="positions"]',
  },
];
