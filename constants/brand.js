/**
 * Fourcast brand & product narrative — single source of truth.
 * Core story: evidence → policy-bound decision → receipt → reconciled reputation.
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

  /** Positioning — single source of truth for everyone (UI + docs + tests).
   * Every line below should read as: Fourcast verifies both the decisions an
   * agent made and the reputation it earned before capital is allocated. */
  positioning: {
    headline:
      'Fourcast is the verification and reputation layer for agent-managed prediction-market capital.',
    promise:
      'Policy-bound decisions · evidence receipts · Kelly-sized risk · a track record capital can verify.',
    excludeRetailLead: false, // keep free-tier acquisition open, but never as the lead
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

  /** One line — hero, OG, pitch. Reads "this is for operators" on second pass. */
  tagline:
    'Verifiable decision receipts and reputation for agent-managed prediction-market capital.',

  /** Supporting line — subheads, metadata. Speaks to the operator's daily job. */
  subhead:
    'Fourcast records what an agent knew, which risk policy constrained it, and why it allocated or passed—then builds a decision history that operators and allocators can independently audit.',

  /** Footer / trust strip — operator language; avoids the "edge detection" framing. */
  footerStrip: 'Polymarket · Kalshi · decision receipts · verified reputation',

  /** Demo CTA */
  demoTitle: 'Audit an agent decision in under a minute',
  demoSubcopy:
    'Inspect the evidence, risk gates, and allocation posture behind an agent decision. Autopilot execution remains safety-gated — see /autopilot.',

  /** Product loop (NarrativeSteps) */
  loop: {
    search: { label: 'Search', short: 'Search', icon: '1' },
    analyze: { label: 'Analyze', short: 'Analyze', icon: '2' },
    publish: { label: 'Publish / Trade', short: 'Publish', icon: '3' },
    scored: { label: 'Track Record', short: 'Track', icon: '4' },
  },
  /** Page subtitles */
  pages: {
    markets: 'Browse prediction markets, run AI analysis, and find mispricings',
    signals: 'Signal marketplace — the social acquisition layer that surfaces verified Quant Operators',
    agent: 'Evidence → risk policy → allocation or pass → decision receipt',
    positions: 'Your auditable reputation — decisions, outcomes, calibration, and policy adherence',
    labs: 'Execution layer — Autopilot, Builder attribution, Telegram bot',
  },

  /** Nav labels + tooltips. Renamed "Positions" → "Track Record" so the
   *  primary-customer language is visible without scrolling.                 */
  nav: {
    markets: 'Browse & analyze prediction markets',
    signals: 'Signal marketplace — verified analysts on the acquisition path',
    agent: 'Autonomous agent loop — operator mode',
    positions: 'Your on-chain track record',
    labs: 'Autopilot & Builder program tools',
  },

  /** Nav label overrides (string shown in the nav bar).
   *  The flagship story leads: Mandate → Proof Theatre → Diligence is one
   *  unfolding system, not five peer products. Markets/Signals/Labs remain
   *  as supporting capability. */
  navLabels: {
    markets: 'Markets',
    signals: 'Signals',
    agent: 'Mandate',
    positions: 'Diligence',
    labs: 'Labs',
    worldCup: 'Proof Theatre',
    alerts: 'Alerts',
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
    badge: 'Built for the operator loop',
    runCta: 'Run Agent',
    labsCta: 'Enable Autopilot execution →',
  },

  /** The headline loop from the operator's seat. Order matters — discovery
   *  only matters because it leads to attributed capital at risk. Used by
   *  landing hero, market-edge copy, and Autopilot onboarding.             */
  operatorLoop: {
    discover: { label: 'Discover', short: 'Discover', icon: '1' },
    forecast: { label: 'Forecast', short: 'Forecast', icon: '2' },
    size:     { label: 'Size with Kelly', short: 'Size', icon: '3' },
    execute:  { label: 'Execute / Publish', short: 'Execute', icon: '4' },
    track:    { label: 'Audited Track Record', short: 'Track', icon: '5' },
  },

  /** Who Fourcast is for / who it's not — the "quad" is what users hear
   *  in conversations, sales copy, and the /pricing-equivalent surface.    */
  quad: {
    forOperators: 'Polymarket & Kalshi operators running real capital who need verified attribution, not vibes.',
    forAnalysts:  'Signal publishers who want their calls surfaced to operator-tier followers, not retail engagement.',
    notFor:       "Casual lookers. If you don't intend to put capital at risk, Fourcast will underserve you. Use the free tier to audit, not to gamble.",
  },

  labs: {
    subtitle: 'Execution capability — policy-bound Autopilot, Builder attribution, and operator tools',
    autopilot: {
      title: 'Autopilot',
      description:
        'Safety-gated execution of policy-bound, Kelly-sized agent decisions.',
      status: 'core',
    },
    builder: {
      description:
        'Polymarket Builder Program — earn USDC per fill from attributed orders. Each Autopilot fill contributes.',
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
    title: 'Fourcast — Verifiable reputation for prediction-market agents',
    description:
      'Verification and reputation for agent-managed prediction-market capital: evidence, risk policy, allocation decisions, and outcomes that can be audited.',
  },
};

/**
 * Onboarding copy — kept neutral so first-time users don't get bounced off.
 * The Quant-Operator narrative is delivered through BRAND.positioning,
 * BRAND.navLabels and the Landing hero, not through this intro list.
 */
export const ONBOARDING_COPY = [
  {
    id: 'welcome',
    title: 'Welcome to Fourcast',
    description:
      'Verification and reputation for prediction-market agents: evidence, risk gates, allocation decisions, and track record. Free to audit. Autopilot execution is safety-gated — see /autopilot.',
    icon: '1',
    target: null,
  },
  {
    id: 'markets',
    title: 'Pick a market worth sizing',
    description:
      'Filter for markets where edge ≥ 5% — our lower bound for Kelly sizing. Free-tier audit is open to all; live Autopilot execution is gated on the concierge path (see docs/GO_TO_MARKET.md).',
    icon: '2',
    target: '[data-onboard="markets"]',
  },
  {
    id: 'publish',
    title: 'Run analysis, size with Kelly',
    description:
      'AI fair-odds vs market, Kelly-Criterion sizing, and Builder attribution in one block. Publishable as a free-tier public signal or as a Premium Autopilot fill.',
    icon: '3',
    target: '[data-onboard="publish"]',
  },
  {
    id: 'agent',
    title: 'Run the agent loop',
    description:
      'The agent scans, sizes, and routes Kelly recommendations to the Autopilot. Above Premium, every fill executes via Polymarket Builder attribution and lands in your Audited Track Record on Arc.',
    icon: '4',
    target: '[data-onboard="agent"]',
  },
  {
    id: 'positions',
    title: 'Build your Audited Track Record',
    description:
      'Decision receipts, outcomes, and Brier scores build an auditable record. Proof-backed and on-chain references appear when the relevant integration is available.',
    icon: '5',
    target: '[data-onboard="positions"]',
  },
];
