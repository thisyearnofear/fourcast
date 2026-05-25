/**
 * Fourcast brand & product narrative — single source of truth.
 * Agora Agents Hackathon: RFB 02 (primary), 05, 06.
 * Settlement story: Arc · USDC · Circle tools.
 */

export const BRAND = {
  name: 'Fourcast',
  emoji: '🔮',

  /** One line — hero, OG, pitch */
  tagline: 'Arc-native prediction market intelligence',

  /** Supporting line — subheads, metadata */
  subhead:
    'Scan Polymarket & Kalshi · detect edge · publish USDC-verified signals on Arc · execute cross-venue arbitrage',

  /** Footer / trust strip */
  footerStrip: 'Settled on Arc · USDC · Polymarket & Kalshi',

  /** Demo CTA */
  demoTitle: 'Try a Demo — No Wallet Needed',
  demoSubcopy:
    'Full AI analysis with provenance. Zero setup — see how the agent finds edge.',

  /** Product loop (NarrativeSteps) */
  loop: {
    search: { label: 'Search', short: 'Search', icon: '🔮' },
    analyze: { label: 'Analyze', short: 'Analyze', icon: '📊' },
    publish: { label: 'Publish on Arc', short: 'Publish', icon: '🌀' },
    scored: { label: 'Get Scored', short: 'Score', icon: '📡' },
  },

  /** Page subtitles */
  pages: {
    markets: 'Find +EV edge across Polymarket & Kalshi — ML forecasts, weather, and AI reasoning',
    signals:
      'Verifiable track records · USDC tips on Arc · leaderboards & cross-platform arbitrage',
    agent:
      'Intelligence agent — autonomous scan, Kelly-sized recommendations, optional Autopilot execution',
    positions: 'Your calls, win rate, Brier score, and on-chain reputation',
    labs: 'Execution layer — Autopilot, builder monetization, and integrations',
  },

  /** Nav tooltips (PageNav) */
  nav: {
    markets: 'Edge detection · RFB 02',
    signals: 'Social signals · RFB 06',
    agent: 'Agent loop · RFB 02 & 05',
    positions: 'Track record',
    labs: 'Autopilot & builder tools',
  },

  /** Wallet explainer — show everywhere users connect */
  walletExplainer: {
    headline: 'Fourcast uses three layers:',
    layers: [
      { icon: '🌀', name: 'Arc', detail: 'USDC settlement — subscriptions, signals, tips (~$0.01/tx)' },
      { icon: '📊', name: 'EVM (Polygon)', detail: 'Polymarket & Kalshi order placement' },
      { icon: '💎', name: 'Movement / Aptos', detail: 'Legacy testnet signal records (optional)' },
    ],
    cta: 'Connect any EVM wallet — switch to Arc testnet for settlement.',
  },

  publish: {
    arcPreferred: { chain: 'Arc (USDC)', gas: '~$0.01 USDC' },
    legacy: { chain: 'Movement / Aptos', gas: '~0.001 APT' },
    footnote: 'Arc is primary settlement. Legacy chains remain for existing testnet signals.',
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
        'Autonomous execution with Kelly Criterion sizing — the agent acts on recommendations (RFB 05).',
      status: 'core',
    },
    builder: {
      description:
        'Polymarket Builder Program — earn USDC per fill from attributed orders (RFB 06).',
    },
  },

  /** Hackathon — subtle, optional in UI */
  hackathon: {
    label: 'Agora Agents · Circle Arc',
    rfbs: 'RFB 02 · 05 · 06',
  },

  metadata: {
    title: 'Fourcast — Arc-Native Prediction Market Intelligence Agent',
    description:
      'AI agent for Polymarket & Kalshi: edge detection, Kelly sizing, USDC signals on Arc, cross-platform arbitrage. Built for the Agora Agents Hackathon.',
  },
};

export const ONBOARDING_COPY = [
  {
    id: 'welcome',
    title: 'Welcome to Fourcast',
    description:
      'An Arc-native intelligence agent for prediction markets. Search any market, get AI-backed edge, publish verifiable signals in USDC.',
    icon: '🔮',
    target: null,
  },
  {
    id: 'markets',
    title: 'Find Edge',
    description:
      'Polymarket and Kalshi in one view. ML forecasts, weather, and reasoning traces — sized for +EV opportunities.',
    icon: '📊',
    target: '[data-onboard="markets"]',
  },
  {
    id: 'publish',
    title: 'Publish on Arc',
    description:
      'Record predictions on Arc with USDC-denominated settlement. Build a Brier-scored track record others can trust.',
    icon: '🌀',
    target: '[data-onboard="publish"]',
  },
  {
    id: 'agent',
    title: 'Intelligence Agent',
    description:
      'Let the agent scan markets, filter candidates, and surface Kelly-sized recommendations — optional Autopilot execution in Labs.',
    icon: '🤖',
    target: '[data-onboard="agent"]',
  },
  {
    id: 'positions',
    title: 'Track Record',
    description: 'Win rate, Brier score, positions, and reputation — the scoreboard for your calls.',
    icon: '💼',
    target: '[data-onboard="positions"]',
  },
];
