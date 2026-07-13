/**
 * Fourcast brand & product narrative — single source of truth.
 * Bright Data Web Data UNLOCKED Hackathon — Track 2: Finance & Market Intelligence.
 * Core story: live web data → AI agent → mispriced markets.
 */

export const BRAND = {
  name: 'Fourcast',
  emoji: '🔮',

  /** One line — hero, OG, pitch */
  tagline: 'AI agent powered by live web data for prediction market intelligence',

  /** Supporting line — subheads, metadata */
  subhead:
    'Bright Data SERP + Scraping Browser + Web Unlocker → AI synthesis → edge detection across Polymarket & Kalshi',

  /** Footer / trust strip */
  footerStrip: 'Powered by Bright Data · SERP API · Scraping Browser · Web Unlocker',

  /** Demo CTA */
  demoTitle: 'Try a Demo — See Live Web Intelligence',
  demoSubcopy:
    'Watch the AI agent scrape, analyze, and detect market edges in real-time. Zero setup required.',

  /** Product loop (NarrativeSteps) — the user journey, one name everywhere:
   *  Search → Analyze → Publish/Trade → Track */
  loop: {
    search: { label: 'Search', short: 'Search', icon: '🔍' },
    analyze: { label: 'Analyze', short: 'Analyze', icon: '🧠' },
    publish: { label: 'Publish / Trade', short: 'Publish', icon: '📤' },
    scored: { label: 'Track Record', short: 'Track', icon: '🏆' },
  },

  /** Page subtitles */
  pages: {
    markets: 'Live web intelligence across Polymarket & Kalshi — Bright Data SERP, ML forecasts, and AI reasoning',
    signals:
      'Verifiable track records · evidence provenance · leaderboards & cross-platform arbitrage',
    agent:
      'Autonomous AI agent — web scraping, edge detection, Kelly-sized recommendations',
    positions: 'Your calls, win rate, Brier score, and reputation',
    labs: 'Execution layer — Autopilot, builder monetization, and integrations',
  },

  /** Nav tooltips (PageNav) */
  nav: {
    markets: 'Web intelligence + edge detection',
    signals: 'Verified predictions',
    agent: 'Autonomous agent loop',
    positions: 'Track record',
    labs: 'Autopilot & builder tools',
  },

  /** Wallet explainer — show everywhere users connect */
  walletExplainer: {
    headline: 'Fourcast uses two layers:',
    layers: [
      { icon: '🌀', name: 'Arc', detail: 'USDC settlement — subscriptions, signals, tips (~$0.01/tx)' },
      { icon: '📊', name: 'EVM (Polygon)', detail: 'Polymarket & Kalshi order placement' },
    ],
    cta: 'Connect an EVM wallet — Arc settlement is handled automatically.',
  },

  publish: {
    arcPreferred: { chain: 'Arc (USDC)', gas: '~$0.01 USDC' },
    footnote: 'All settlement happens on Arc. EVM wallets are used for venue order placement.',
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
        'Autonomous execution with Kelly Criterion sizing — the agent acts on Bright Data-powered recommendations.',
      status: 'core',
    },
    builder: {
      description:
        'Polymarket Builder Program — earn USDC per fill from attributed orders.',
    },
  },

  /** Hackathon — subtle, optional in UI */
  hackathon: {
    label: 'Bright Data · Web Data UNLOCKED',
    track: 'Track 2: Finance & Market Intelligence',
  },

  metadata: {
    title: 'Fourcast — AI Agent Powered by Live Web Data for Market Intelligence',
    description:
      'AI agent using Bright Data SERP API, Scraping Browser & Web Unlocker to detect mispriced prediction markets. Real-time web scraping → AI synthesis → edge detection across Polymarket & Kalshi.',
  },
};

export const ONBOARDING_COPY = [
  {
    id: 'welcome',
    title: 'Welcome to Fourcast',
    description:
      'An AI agent that uses Bright Data to scrape the live web, synthesize intelligence, and detect mispriced prediction markets before anyone else.',
    icon: '🔮',
    target: null,
  },
  {
    id: 'markets',
    title: 'Live Web Intelligence',
    description:
      'SERP API fetches structured search results. Scraping Browser renders JS-heavy pages. Web Unlocker bypasses bot detection. All in real-time.',
    icon: '🌐',
    target: '[data-onboard="markets"]',
  },
  {
    id: 'publish',
    title: 'AI Synthesis & Edge Detection',
    description:
      'AI reasons over live web evidence to produce fair probabilities. Detects mispricing across Polymarket and Kalshi with full source provenance.',
    icon: '🧠',
    target: '[data-onboard="publish"]',
  },
  {
    id: 'agent',
    title: 'Autonomous Agent',
    description:
      'The agent autonomously scans markets, scrapes evidence, detects edges, and recommends Kelly-sized positions — end-to-end with Bright Data.',
    icon: '🤖',
    target: '[data-onboard="agent"]',
  },
  {
    id: 'positions',
    title: 'Track Record & MCP',
    description: 'Verifiable track records, Brier scores, and an MCP Server so any AI agent can query Fourcast\'s intelligence pipeline.',
    icon: '⚡',
    target: '[data-onboard="positions"]',
  },
];
