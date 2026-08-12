/**
 * Fourcast brand & product narrative — single source of truth.
 *
 * Core identity: venue-agnostic autonomous prediction-market operator.
 * Agent core (policy + sizing + receipts) is the constant.
 * Execution venues (Polymarket, Delphi, Canton) are additive layers.
 * Intelligence (TxLINE/TxOdds, Venice AI, Bright Data) feeds the core.
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
      'Autonomous prediction-market operator with verifiable mandates. Venue-agnostic execution. Provable discipline.',
    promise:
      'Discover edge · size under policy · execute across venues · prove every decision before the outcome.',
    excludeRetailLead: false,
    primaryRfb: '01 — Verifiable Autonomous Operator (mandate receipts + reconciliation)',
    secondaryRfb: '02 — Prediction Market Trader Intelligence (multi-venue edge)',
    tertiaryRfb: '03 — Cross-Platform Arbitrage (venue-agnostic execution)',
    acquisitionRfb: '04 — Social Trading Intelligence (signal marketplace)',
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
  tagline: 'Autonomous operator. Verifiable mandates. Multi-venue edge.',

  /** Supporting line — subheads, metadata. */
  subhead:
    'Policy-bound agent trading across Polymarket, Kalshi, and Delphi. Every decision receipted before the outcome. Private settlement when size requires it.',

  /** Footer / trust strip */
  footerStrip: 'Polymarket · Kalshi · Delphi · TxLINE/TxOdds · decision receipts',

  /** Demo CTA */
  demoTitle: 'See the agent decide in under a minute',
  demoSubcopy:
    'Watch a policy-bound decision from evidence through five gates to sealed receipt. Autopilot execution remains safety-gated.',

  /** Product loop (NarrativeSteps) */
  loop: {
    discover: { label: 'Discover', short: 'Discover', icon: '1' },
    analyze: { label: 'Analyze', short: 'Analyze', icon: '2' },
    execute: { label: 'Execute', short: 'Execute', icon: '3' },
    track: { label: 'Track', short: 'Track', icon: '4' },
  },

  /** Page subtitles — max ~12 words; prefer none when tabs explain. */
  pages: {
    markets: 'Find the edge. Act. Then track it.',
    signals: 'Publish calls — follow & reputation early.',
    agent: 'Policy, dry-run, sealed decision.',
    positions: 'Your book — all venues, one view.',
    proof: 'Receipt committed before outcome. Reconciled after.',
    labs: 'Autopilot, Builder, operator tools.',
  },

  /** Nav tooltips — short venue phrases. */
  nav: {
    markets: 'Find edge across venues',
    signals: 'Follow verified analyst calls',
    agent: 'Mandate and agent loop',
    arena: 'The agent, proving discipline live',
    positions: 'Your book after you act',
    canton: 'Private size · CBTC settle',
    labs: 'Autopilot and builder tools',
    alerts: 'Alerts from analysts you follow',
  },

  /** Nav label overrides.
   *  Primary: Markets · Positions · Mandate
   *  Supporting: Signals · Labs · Alerts · Private */
  navLabels: {
    markets: 'Markets',
    signals: 'Signals',
    agent: 'Mandate',
    arena: 'Arena',
    positions: 'Positions',
    labs: 'Labs',
    alerts: 'Alerts',
    canton: 'Private',
  },

  /** Wallet explainer — progressive; show the chain needed for the action. */
  walletExplainer: {
    headline: 'Connect for the action you need:',
    layers: [
      { icon: 'Ξ', name: 'Trade / publish', detail: 'EVM wallet — Polymarket, Kalshi, Delphi' },
      { icon: '◈', name: 'Private settle', detail: 'Canton — when position size must stay hidden' },
      { icon: '◎', name: 'Inspect proofs', detail: 'Phantom — Solana receipt anchoring' },
    ],
    cta: 'Connect only what the next action requires.',
  },

  publish: {
    arcPreferred: { chain: 'Arc (USDC)', gas: '~$0.01 USDC' },
    cantonPrivate: { chain: 'Canton (cBTC/cETH)', gas: 'sub-cent', privacy: 'Position sizes hidden from all third parties' },
    footnote: 'EVM = venue orders. Canton = private when needed.',
  },

  agent: {
    title: 'Mandate',
    subtitle: 'Policy · dry-run · sealed decision · multi-venue',
    badge: 'Autonomous operator',
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

  /** Execution venues — additive, not exclusive. */
  venues: {
    polymarket: { name: 'Polymarket', type: 'CLOB', status: 'live', chain: 'Polygon' },
    kalshi: { name: 'Kalshi', type: 'Exchange', status: 'live', chain: 'Centralized' },
    delphi: { name: 'Delphi', type: 'LMSR', status: 'active', chain: 'Gensyn Testnet' },
    canton: { name: 'Canton', type: 'Private settle', status: 'roadmap', chain: 'Canton DevNet' },
  },

  /** Intelligence sources — feed the agent core. */
  intelligence: {
    txline: {
      name: 'TxLINE / TxOdds',
      type: 'Professional odds + Merkle proofs',
      status: 'live',
      coverage: 'MLS (50%), Premier League (full Aug 21)',
    },
    venice: { name: 'Venice AI', type: 'LLM reasoning + forecasting', status: 'live' },
    brightData: { name: 'Bright Data', type: 'Web scrape + SERP', status: 'optional' },
    synthData: { name: 'SynthData', type: 'ML forecasting models', status: 'live' },
  },

  quad: {
    forOperators: 'Operators running real capital across prediction markets who need verified attribution and auditable mandate adherence.',
    forAnalysts: 'Signal publishers who want their calls surfaced to operator-tier followers, not retail engagement.',
    forAllocators: 'Allocators who need to diligence autonomous agents without trusting self-reported P&L.',
    notFor: "Casual lookers. If you don't intend to put capital at risk or delegate to an agent, Fourcast will underserve you.",
  },

  labs: {
    subtitle: 'Autopilot, Builder, operator tools',
    autopilot: {
      title: 'Autopilot',
      description:
        'Safety-gated execution of policy-bound, Kelly-sized agent decisions across connected venues.',
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

  competitions: {
    delphiArena: {
      label: 'Delphi Agent Arena',
      window: 'Aug 10–24, 2026',
      venue: 'Gensyn Testnet (LMSR)',
      status: 'active',
    },
  },

  metadata: {
    title: 'Fourcast — Autonomous Prediction-Market Operator',
    description:
      'Venue-agnostic autonomous agent for prediction markets. Policy-bound decisions with verifiable receipts across Polymarket, Kalshi, and Delphi.',
  },
};

/**
 * Onboarding copy — agent-first, venue-agnostic.
 */
export const ONBOARDING_COPY = [
  {
    id: 'welcome',
    title: 'Welcome to Fourcast',
    description:
      'Autonomous operator for prediction markets. Discover edge, act under mandate, prove every decision.',
    icon: '1',
    target: null,
  },
  {
    id: 'markets',
    title: 'Discover markets',
    description:
      'Scan across Polymarket, Kalshi, and Delphi. Find mispricing the crowd missed.',
    icon: '2',
    target: '[data-onboard="markets"]',
  },
  {
    id: 'analyze',
    title: 'Analyze edge',
    description:
      'Professional odds, LLM reasoning, Monte Carlo simulation. Fair value vs market price.',
    icon: '3',
    target: '[data-onboard="analyze"]',
  },
  {
    id: 'agent',
    title: 'Decide under mandate',
    description:
      'Five-gate policy sizes and approves. Receipt sealed before the outcome resolves.',
    icon: '4',
    target: '[data-onboard="agent"]',
  },
  {
    id: 'positions',
    title: 'Track everything',
    description:
      'All venues in one book. Verifiable track record. Allocator-ready diligence.',
    icon: '5',
    target: '[data-onboard="positions"]',
  },
];
