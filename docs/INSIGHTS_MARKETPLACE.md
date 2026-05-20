# Fourcast Product Strategy — Prediction Insights Marketplace

## The Core Insight

We cannot credibly claim to "provide an edge." A true edge requires:
- A systematic, backtested strategy
- Real-time market odds comparison (Polymarket vs Kalshi vs fair value)
- Verifiable track record with statistical significance

What we actually have is an **AI-assisted analysis pipeline** that generates informed opinions. These are useful — analysts use them to make better decisions — but they are not edges.

## The Strategic Pivot

| Before | After |
|--------|-------|
| "We find edges in prediction markets" | "We connect you with analysts who find edges" |
| AI is the product | AI is the tool for analysts |
| Prediction market intelligence | Prediction insights marketplace |
| Users subscribe for AI analysis | Users follow analysts, tip signals, build reputation |
| "Edge: +7.2%" | "Analysis by @trader — 73% confidence, 12-2 record" |

## How It Works

### For Analysts (Supply Side)
1. Publish predictions with reasoning, confidence level, and market target
2. Attach on-chain signature (Arc) for verifiability
3. Build a track record — Brier score, win rate, ROI — displayed on your profile
4. Earn tips, subscribers, and reputation
5. AI assists: market scanning, data enrichment, draft analysis

### For Followers (Demand Side)
1. Discover analysts via leaderboard (sorted by recency, win rate, volume)
2. Follow analysts whose style matches your strategy
3. Get notified when they publish new signals
4. Tip USDC to analysts whose predictions you find valuable
5. Publish your own analysis to build your reputation

### For Fourcast
1. Surface the best analysis via Telegram bot, web app, and API
2. Verify track records on-chain (Arc) — immutable, trustless
3. Take a small cut on tips (e.g., 5%) for platform sustainability
4. AI enriches but doesn't claim to be the source of the edge

## Revised Bot Messaging

| Before | After |
|--------|-------|
| "I see an edge on: BTC" | "📊 Analysis for: BTC" |
| "⚡ Edge: +7.2%" | Removed (unless analyst-submitted) |
| "Confidence: HIGH" | "AI Assessment: 🟢 Favorable" |
| "prediction intelligence agent" | "analysis curator" |
| /pro → unlimited AI analysis | /pro → publish signals, build following |

## On-Chain Reputation

Every signal published on Arc creates an immutable record:
- `analyst_address → prediction → outcome → Brier_score`
- No backdating, no selective reporting
- Followers can verify any analyst's full history
- Smart contract handles tipping and settlement

## Roadmap

### Phase 1: Positioning Shift (this week)
- [x] Update bot messaging to remove "edge" claims
- [x] Add /top command for analyst discovery
- [ ] Update web app copy (FEATURES.md, landing page, /markets)

### Phase 2: Analyst Infrastructure (next)
- [ ] Analyst profiles with on-chain track record
- [ ] Follow/unfollow system
- [ ] Tip via USDC on Arc
- [ ] Notification when followed analyst publishes

### Phase 3: Network Effects
- [ ] Leaderboard with filters (category, timeframe, min sample)
- [ ] Telegram notifications for followed analysts
- [ ] Referral system for analyst acquisition
- [ ] Subscription tiers for premium analysts

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Low analyst supply | Seed with AI-generated signals, invite power users |
| Low quality signals | Leaderboard filters by min sample size, Brier score |
| Gaming the system | On-chain verification prevents selective reporting |
| Regulatory exposure | We surface analysis, not financial advice |
