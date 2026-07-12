# Fourcast — 3-Minute Demo Script (Agora Submission)

Use this order so judges see **agency → Arc → traction** in under three minutes.

## Opening (15s)

> "Fourcast is an **AI agent that finds mispriced prediction markets with auditable live-web evidence**. It uses Bright Data to scrape live web sources, synthesizes fair probabilities with AI, detects edge against Polymarket & Kalshi odds, publishes verifiable signals settled in USDC on Arc, and executes cross-venue arbitrage when the spread clears fees. We're built for Agora RFB 02, 05, and 06."

**Show:** Home (`/`) — tagline, narrative steps, footer (Arc · USDC).

---

## Act 1 — Intelligence (RFB 02) · 60s

1. **Search** — type `BTC $100k` or click demo pill → Markets.
2. **Analyze** — run AI analysis; expand reasoning / provenance panel.
3. Call out: confidence, edge %, Kelly sizing (Premium), SynthData / weather sources.

**Say:** "The agent doesn't just summarize — it compares our probability to market odds and sizes with Kelly."

---

## Act 2 — Agent loop (30% agentic sophistication) · 45s

1. Go to **Agent** → **Run Agent**.
2. Watch stream: Discover → Filter → Forecast → Edge recommendations.
3. Optional: **Labs → Autopilot** — show execution history / Kelly % on past runs.

**Say:** "This is the autonomous loop — scan, filter, forecast, recommend. Autopilot adds execution with builder attribution."

---

## Act 3 — Arc settlement (20% Circle tools) · 45s

1. **Connect wallet** on Arc testnet (chain 5042002).
2. **Pricing** — Pro subscribe: approve USDC → subscribe → Arc Explorer tx.
3. **Signals / Markets** — publish flow; modal shows **Arc (USDC)** when wallet is on Arc testnet (5042002). Requires `NEXT_PUBLIC_PREDICTION_RECEIPT_CONTRACT` deployed.
4. Optional: **CCTP** component if `CIRCLE_API_KEY` configured.

**Say:** "Every fee is USDC on Arc — subscriptions live today; signals and tips are the settlement layer we're shipping on testnet."

---

## Act 4 — Cross-venue arb (RFB 05) · 30s

1. **Signals → Arbitrage** tab (or Markets arb panel).
2. Show Polymarket ↔ Kalshi spread; one-click executor if configured.

**Say:** "Sub-second Arc finality and ~$0.01 USDC txs make low-margin arb economical — Gateway/CCTP for rebalancing is wired in the UI."

---

## Act 5 — Social layer (RFB 06) · 20s

1. **Signals** feed + **Leaderboard**.
2. **Labs → Builder** — builder key attribution on orders.

**Say:** "Track record is the product — builder fees monetize the agent's picks without custody."

---

## Close (15s)

> "Live at [your URL]. Repo on GitHub. [N] users during the hackathon, [M] agent runs, [K] USDC subs on Arc testnet."

**Traction numbers to prepare before recording:** unique wallets, agent runs, analyses, subscription txs, arb attempts.

---

## Pre-demo checklist

- [ ] Deployed URL loads (not localhost)
- [ ] Wallet on **Arc testnet** with testnet USDC
- [ ] `NEXT_PUBLIC_SUBSCRIPTION_CONTRACT` set
- [ ] Venice API key for live analysis
- [ ] Optional: Polymarket keys for Autopilot / builder demo
- [ ] Form: GitHub URL, video link, traction paragraph

## Copy source of truth

All UI strings: `constants/brand.js`
