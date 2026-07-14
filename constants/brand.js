/**
 * Fourcast brand & product narrative — single source of truth.
 * Core story: ask a market question → AI finds edge → publish / trade → track.
 * Bright Data scrape enrichment is optional when credits/keys are available.
 */

export const BRAND = {
  name: 'Fourcast',
  /** Wordmark-only identity preferred in UI; emoji kept for OG/legacy */
  emoji: '◆',

  /** One line — hero, OG, pitch */
  tagline: 'Find mispriced prediction markets before the crowd',

  /** Supporting line — subheads, metadata */
  subhead:
    'AI estimates fair odds across Polymarket & Kalshi, surfaces the edge, and lets you publish a trackable call.',

  /** Footer / trust strip */
  footerStrip: 'Polymarket · Kalshi · AI edge detection',

  /** Demo CTA */
  demoTitle: 'See an edge in under a minute',
  demoSubcopy:
    'Search a market question, run analysis, and get a fair probability vs live odds — no wallet required to start.',

  /** Product loop (NarrativeSteps) */
  loop: {
    search: { label: 'Search', short: 'Search', icon: '1' },
    analyze: { label: 'Analyze', short: 'Analyze', icon: '2' },
    publish: { label: 'Publish / Trade', short: 'Publish', icon: '3' },
    scored: { label: 'Track Record', short: 'Track', icon: '4' },
  },

  /** Page subtitles */
  pages: {
    markets: 'Browse live markets, run AI analysis, and catch mispricing',
    signals: 'Verifiable calls · provenance · leaderboards · cross-venue arb',
    agent: 'Autonomous scan → edge detection → Kelly-sized recommendations',
    positions: 'Your calls, win rate, Brier score, and reputation',
    labs: 'Execution layer — Autopilot, builder monetization, Telegram',
  },

  /** Nav tooltips (PageNav) */
  nav: {
    markets: 'Browse & analyze markets',
    signals: 'Verified predictions',
    agent: 'Autonomous agent loop',
    positions: 'Track record',
    labs: 'Autopilot & builder tools',
  },

  /** Wallet explainer — show everywhere users connect */
  walletExplainer: {
    headline: 'Fourcast uses three layers:',
    layers: [
      { icon: '◆', name: 'Arc', detail: 'Public reputation — USDC settlement for signals, subscriptions, tips (~$0.01/tx)' },
      { icon: '◈', name: 'Canton', detail: 'Private settlement — cBTC/cETH positions with hidden sizes via Daml smart contracts' },
      { icon: 'Ξ', name: 'EVM (Polygon)', detail: 'Venue execution — Polymarket & Kalshi order placement' },
    ],
    cta: 'Connect an EVM wallet for Arc + venues. Connect Console Wallet for private Canton settlement.',
  },

  publish: {
    arcPreferred: { chain: 'Arc (USDC)', gas: '~$0.01 USDC' },
    cantonPrivate: { chain: 'Canton (cBTC/cETH)', gas: 'sub-cent', privacy: 'Position sizes hidden from all third parties' },
    footnote: 'Arc publishes public reputation receipts. Canton creates private positions with hidden sizes. EVM wallets handle venue order placement.',
  },

  agent: {
    title: 'Intelligence Agent',
    subtitle: 'Discover → filter → forecast → size with Kelly · cross-venue arb when edge clears fees',
    badge: 'Monitors the full loop',
    runCta: 'Run Agent',
    labsCta: 'Enable Autopilot execution →',
  },

  labs: {
    subtitle: 'Execution & monetization — Autopilot trades, builder fees, Telegram',
    autopilot: {
      title: 'Autopilot',
      description:
        'Autonomous execution with Kelly Criterion sizing on AI recommendations.',
      status: 'core',
    },
    builder: {
      description:
        'Polymarket Builder Program — earn USDC per fill from attributed orders.',
    },
  },

  /** Optional enrichment — never required for core product */
  webIntel: {
    label: 'Deep web scrape',
    shortLabel: 'Web scrape',
    optionalNote: 'Optional enrichment when available — analysis works without it.',
    unavailableNote: 'Deep web scrape is offline. Analysis uses AI + market data.',
  },

  /** Hackathon — subtle, optional in UI */
  hackathon: {
    label: 'Bright Data · Web Data UNLOCKED',
    track: 'Track 2: Finance & Market Intelligence',
  },

  metadata: {
    title: 'Fourcast — AI edge detection for prediction markets',
    description:
      'Fourcast estimates fair odds on Polymarket and Kalshi, surfaces mispricing, and lets you publish trackable signals. Start with a search — wallet optional.',
  },
};

export const ONBOARDING_COPY = [
  {
    id: 'welcome',
    title: 'Welcome to Fourcast',
    description:
      'Search a prediction market question. AI estimates fair odds, compares them to live prices, and shows you the edge.',
    icon: '1',
    target: null,
  },
  {
    id: 'markets',
    title: 'Find a market',
    description:
      'Browse Polymarket and Kalshi in one place. Filter by topic or paste a question from the home search.',
    icon: '2',
    target: '[data-onboard="markets"]',
  },
  {
    id: 'publish',
    title: 'Analyze, then share',
    description:
      'Run analysis to get a fair probability and recommendation. Publish a signal or share the card — build a public track record.',
    icon: '3',
    target: '[data-onboard="publish"]',
  },
  {
    id: 'agent',
    title: 'Let the agent scan',
    description:
      'The agent can scan markets, score edges, and recommend Kelly-sized positions when you are ready to automate.',
    icon: '4',
    target: '[data-onboard="agent"]',
  },
  {
    id: 'positions',
    title: 'Track what matters',
    description:
      'Win rate, Brier score, and reputation compound when your calls resolve. Follow analysts whose edge you trust.',
    icon: '5',
    target: '[data-onboard="positions"]',
  },
];
