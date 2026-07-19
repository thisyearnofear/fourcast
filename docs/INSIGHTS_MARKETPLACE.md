# Insights Marketplace — The Acquisition Layer

## Position

The Insights Marketplace is **not** Fourcast's primary product. It is the **distribution loop that pulls Quant Operators into the headline Autopilot product**.

We commit to that hierarchy. Social and reputation mechanics exist to feed the operator funnel, not as standalone value propositions.

## Why

The core insight from the original marketplace doc still holds:

> We cannot credibly claim to "provide an edge." A true edge requires:
> - A systematic, backtested strategy
> - Real-time market odds comparison (Polymarket vs Kalshi vs fair value)
> - Verifiable track record with statistical significance

What we actually have is an **AI-assisted analysis pipeline + Polymarket Builder attribution + an on-chain reputation record**. That combination is valuable to one customer: the **Quant Operator** who needs verified attribution, not vibes. Everyone else uses one slice.

So:

| Before (retail-friendly framing) | After (operator-first framing) |
|---|---|
| "We connect you with analysts who find edges" | "We turn your verified fills into an Audited Track Record that follow-on capital trusts" |
| AI is the product | AI + Kelly + Builder attribution is the product — for the operator who deploys capital |
| Prediction insights marketplace | **Acquisition layer** for the operator funnel |
| Users subscribe for AI analysis | Operators monetize Autopilot fills via Builder + get scored publicly |
| "Edge: +7.2%" | "12-win streak · 0.18 Brier · +$3,240 Builder attribution on Arc" |

## How the two surfaces work together

### Operator (Primary — the product)

1. Concierge configures the Autopilot with their risk tolerance + market universe
2. Agent loop runs: discover → forecast → size with Kelly → execute via Builder attribution
3. Every fill publishes an `AuditedTrackRecord` entry on Arc: edge, size, outcome, Brier contribution
4. Operator now has a public, verifiable track record they can show follow-on capital
5. Followers + tips + leaderboard fuel the acquisition loop

### Follower / Acquisition Layer (the marketplace)

1. Discovers operators via leaderboard (sorted by recency, win rate, attribution volume, Brier score)
2. Follows operators whose edge matches their risk tolerance
3. Gets notified on new fills / signals / arbitrages
4. Tips USDC to operators whose track records they trust
5. Several of them convert to **operators themselves** — the funnel self-fills

### What Fourcast owns

1. The Autopilot + Builder integration (the moat — execution cost is real)
2. The on-chain `AuditedTrackRecord` registry on Arc (the trust)
3. The leaderboard + follow graph (the distribution)
4. The AI analysis tooling that boosts operator success rates (the utility)
5. Telegram bot as one surface of the loop, not the headline

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
