# Agora Agents Hackathon — Fourcast Strategy

**Hackathon**: Agora Agents Hackathon · Canteen × Circle  
**Dates**: May 11 → May 25, 2026  
**Settlement**: Arc (Circle's stablecoin-native L1), USDC-denominated  
**Prizes**: $50k total — 1st ($10k), 2nd ($7.5k×2), 3rd ($5k×3), standout teams, feedback incentives, easter eggs  
**Submission Form**: https://forms.gle/hFPM2t4Jt1zGfqzM7  
**Demo script**: [DEMO_SCRIPT_PROOF.md](./DEMO_SCRIPT_PROOF.md)
**Brand copy (UI)**: [constants/brand.js](../constants/brand.js)

---

## Brand & positioning (aligned in codebase)

| Layer | Message |
|-------|---------|
| **One-liner** | Verification and reputation layer for agent-managed prediction-market capital |
| **Subhead** | Evidence + versioned risk policy → agent allocation or pass → auditable decision receipt → proof-backed outcome reconciliation |
| **Primary RFB** | 02 Prediction Market Trader Intelligence |
| **Secondary** | 05 Cross-Platform Arbitrage · 06 Social Trading / builder fees |
| **Settlement story** | Arc for settlement; Polygon for venue orders |
| **Product loop** | Evidence → Simulation → Policy-bound allocation/pass → Receipt → TxLINE/Solana reconciliation |

Judges should never see "multi-chain" as the lead — **the AI agent is the product**, Arc is **settlement plumbing**, EVM chains are **venues**.

---

## Why Fourcast Fits

Fourcast is the **verification and reputation layer for agent-managed prediction-market capital**. It combines live evidence, AI-synthesized fair probabilities, Kelly-sized risk controls, and a durable decision history so operators and allocators can distinguish skill, luck, hindsight, and policy violations.

We are built for one primary customer and one acquisition loop. Our features map to RFBs with that discipline.

| RFB | Title | Fourcast Feature | Role |
|-----|-------|------------------|------|
| 02 | **Prediction Market Trader Intelligence** | AI analysis, Kelly sizing, Builder-attributed execution, Audited Track Record | 🎯 **Primary — the product** |
| 05 | **Cross-Platform Arbitrage Agent** | Polymarket↔Kalshi arb detection + unified execution | 🔧 Secondary — execution layer of the primary loop |
| 06 | Social Trading Intelligence | Signal publishing, reputation, leaderboards, tipping, follow graph | 📣 **Acquisition loop** — used to surface operators, not as the headline product |
| 01 | Perpetual Futures Trading Agent | SynthData ML forecasts | 🟰 Background capability |
| 03 | Prediction Market Verticals | Weather×sports, crypto | 🟰 Vertical coverage |
| 04 | Adaptive Portfolio Manager | Track record spine | 🔧 Cross-cutting |

**Primary RFB**: 02 (Prediction Market Trader Intelligence) — this is what we ship first.  
**Secondary RFB**: 05 (Cross-Platform Arbitrage Agent) — the execution engine that makes RFB 02 real.  
**Acquisition RFB**: 06 (Social Trading Intelligence) — *not* a separate product; it is the distribution loop that pulls operators in.

Judges should see one loop, not three products.

---

## Judging Criteria Alignment

| Criteria | Weight | Our Strategy |
|----------|--------|--------------|
| Agentic Sophistication | 30% | Autonomous agent loop: scan → verify cross-venue contract equivalence → forecast → Kelly-size → execute or decline → persist a decision receipt. The agent records evidence, risk gates, and rationale for every allocation and pass. |
| Traction | 30% | Live product with real users. Deploy on Arc testnet, get testnet USDC flowing through signals/tips/trades. Use `arc-canteen update traction` to log progress. |
| Circle Tool Usage | 20% | CCTP/Gateway (cross-chain USDC for multi-venue trading), Circle Wallets (agent-managed accounts), Paymaster (USDC gas), USYC (idle capital yield), App Kit (Bridge/Swap/Send in UI). |
| Innovation | 20% | Builder code monetization (Polymarket V2), reasoning traces on-chain, Kelly Criterion sizing, cross-platform prediction market arb on Arc. |

---

## Technical Architecture on Arc

### Before (Current)
```
Fourcast → Arc (signals, USDC settlement, tipping)
         → BNB/Polygon/Arbitrum (trading contracts)
         → Polymarket/Kalshi (live odds)
```

### After (Arc-Native)
```
Fourcast → Arc (signals + settlement + USDC tipping + gas)
         → Gateway/CCTP (cross-chain USDC to Polymarket/Kalshi venues)
         → Circle Wallets (agent-managed trading accounts)
         → USYC (idle capital yield between trading cycles)
         → Paymaster (every cost denominated in USDC)
         → Polymarket/Kalshi (live odds, execution venues)
```

### Arc Network Configuration
- **Chain ID**: 5042002
- **RPC**: Via ARC CLI (`arc-canteen rpc eth_chainId`)
- **Gas token**: USDC (via Paymaster)
- **Settlement**: Sub-second deterministic finality
- **Tx cost**: ~$0.01 USDC

### Circle Developer Tools Integration

| Tool | Use Case | Implementation |
|------|----------|----------------|
| CCTP | Cross-chain USDC transfers | Move USDC between Arc↔Polygon for Polymarket execution |
| Gateway | Unified USDC balance | Single-balance agent that acts on any chain instantly |
| Wallets | Embedded agent wallets | Trading accounts with automated key management |
| Contracts | Smart contracts on Arc | SignalRegistry, PredictionReceipt, BuilderFeeSplitter |
| Paymaster | USDC gas fees | User-facing UX where every cost is in USDC |
| USYC | Yield on idle capital | Park agent capital between analysis cycles |
| App Kit | Bridge/Swap/Send UI | Drop-in components for cross-chain operations |

---

## Implementation Roadmap

### Day 1-2: Arc Chain Integration (Critical Path)
### Day 1: Arc Chain Integration (10% of Judging)
- [x] Run `arc-canteen login` and get RPC credentials
- [x] Add Arc to `constants/appConstants.js` (Chain ID 5042002)
- [x] Arc publish wired in `useSignalPublisher` → `services/arcPublisher.js`
- [ ] Deploy PredictionReceiptERC20 on Arc (`node scripts/deploy-prediction-receipt.js`)
- [x] Test basic RPC interactions (`arc-canteen rpc eth_chainId`)

### Day 2-3: Circle Tool Integration (20% of Judging)
- [ ] Integrate CCTP for Arc↔Polygon USDC transfers
- [ ] Set up Gateway for unified USDC balance
- [ ] Add Circle Wallets for agent account management
- [x] Configure Paymaster for USDC-denominated gas
- [ ] Add USYC integration for idle capital
- [x] Add App Kit components to UI (Bridge, Swap, Send)
- [x] **Deploy SubscriptionManager contract on Arc** — USDC-native subscriptions
- [x] **PricingOverlay with wallet tx flow** — approve USDC → subscribe
- [x] **Rate limit bypass via on-chain subscription check**
- [x] **UnifiedConnect** — single button for all chains (EVM + Aptos + Arc)
- [x] **3D interactive carousel landing** — 4 verticals with canvas animations
- [x] **PortfolioCard** — track record overview (signals, win rate, Brier)
- [x] **CctpTransfer component** — UI for cross-chain USDC (needs Circle API key)
- [x] **POST /api/cctp/transfer** — API stub for CCTP endpoint (CIRCLE_API_KEY set)
- [x] **Unified arbitrage executor** — one-click cross-platform arb (Polymarket + Kalshi)
- [x] **Telegram bot (@fourcasterbot)** — /edge commands for AI analysis via messaging
- [x] **Progressive disclosure** — 2 cards on first visit, keyboard nav, auto-analyze on entry
- [x] **Onboarding fixes** — skip button, click-outside dismiss, gesture hint on welcome

### CCTP/Gateway Setup
To enable cross-chain USDC transfers:
1. Get Circle API key from https://console.circle.com
2. Add `CIRCLE_API_KEY` to .env.local
3. Add CCTP contract addresses to .env.local:
   - `NEXT_PUBLIC_CCTP_ARC_CONTRACT`
   - `NEXT_PUBLIC_CCTP_POLYGON_CONTRACT`
4. Set `NEXT_PUBLIC_CCTP_ENABLED=true`
5. The `CctpTransfer` component and `/api/cctp/transfer` endpoint will go live

### Day 3-4: Feature Enhancements (Core Differentiation)
- [ ] Add Kelly Criterion position sizing to analysis output
- [ ] Enhance agent autonomy (auto-publish, auto-execute small trades)
- [ ] Implement Polymarket V2 builder code integration (monetize signals)
- [ ] Add reasoning trace hashing + on-chain pinning on Arc
- [ ] Port signal tipping from APT to USDC on Arc

### Day 4-5: UI/UX Updates
- [x] Add Arc chain to ChainSelector component
- [x] Update WalletConnect for Arc/Circle wallets (now UnifiedConnect)
- [ ] Add Circle App Kit components (Bridge, Swap, Unified Balance)
- [ ] Update signal cards to show Arc settlement status
- [ ] Add USDC-denominated tipping flow
- [ ] Add agent dashboard with Arc transaction history

### Day 5-6: Testing & Demo
- [ ] End-to-end test on Arc testnet
- [ ] Generate testnet USDC flow (signals → tips → trades)
- [ ] Record demo video showing full flow
- [ ] Document all Circle tool integrations

### Day 6-7: Traction & Submission
- [ ] Use `arc-canteen update product` to log progress
- [ ] Use `arc-canteen update traction` to log user metrics
- [ ] Get 5+ testnet users interacting with Fourcast on Arc
- [ ] Submit via Google Forms: product demo + GitHub repo + traction metrics
- [ ] Post in Canteen Discord and Arc builder Discord

---

## RFB 02: Prediction Market Trader Intelligence — Detailed Response

### The Problem
Prediction markets offer alpha through information asymmetry, but finding mispriced contracts requires synthesizing news, data, and sentiment at speed. How does an AI identify +EV bets and size positions optimally?

### Our Solution: Fourcast on Arc

Fourcast is an AI-powered prediction market intelligence agent that:

1. **Synthesizes multiple data sources** — Polymarket odds, Kalshi odds, weather data, ML price forecasts (SynthData), and web search — to generate probability estimates
2. **Detects edge** — Compares AI probability to market odds, flagging mispriced contracts (>5% edge threshold, with >30% override for suspicious opportunities)
3. **Sizes positions** — Kelly Criterion/optimal f sizing based on edge magnitude and confidence level
4. **Publishes on-chain signals** — Verifiable predictions settled on Arc with USDC tipping
5. **Assesses cross-platform opportunities** — compares Polymarket and Kalshi contracts for semantic and resolution compatibility, estimates a conservative fee/slippage reserve, then marks each pair `READY` or `REVIEW`
6. **Tracks track record** — Brier scores, win rates, calibration curves, accuracy streaks
7. **Monetizes via builder codes** — Polymarket V2 builder integration earns USDC per fill

### What the AI Decides
- Which prediction markets have mispriced probabilities based on multi-source analysis
- Optimal bet sizing using Kelly Criterion based on edge and confidence
- When to hedge positions or close early for profit
- Whether a cross-platform pair is contract-compatible and profitable after a conservative cost reserve
- When to publish signals on-chain vs keep private
- Which reasoning traces to pin on-chain for verification

### What We Build
- Prediction market analytics with AI-driven probability estimates (already live)
- Autonomous betting agent with Kelly Criterion position sizing (enhanced for Arc)
- Cross-market contract assessment and autonomous execution posture (already live; live venue execution remains credential- and safety-gated)
- On-chain signal publishing with USDC-denominated tipping (ported to Arc)
- Builder code monetization through Polymarket V2 (new)
- Reasoning trace verification on Arc (new)

### Traction Metrics
- Number of active traders using Fourcast
- Prediction accuracy rate (current: ~68% win rate)
- Total USDC volume through Arc
- Number of signals published on-chain
- Builder code revenue earned
- Cross-platform arbitrage profits captured

---

## RFB 05: Cross-Platform Arbitrage Agent — Detailed Response

### The Problem
Price discrepancies across exchanges and chains exist but disappear in seconds. Capturing arbitrage requires instant detection, cross-chain execution, and precise cost accounting.

### Our Solution
Fourcast already detects Polymarket↔Kalshi arbitrage. On Arc, we enhance this with:

1. **Sub-second settlement** — Arc's deterministic finality means arbitrage trades settle instantly, no reorgs
2. **~$0.01 tx fees in USDC** — High-frequency, low-margin strategies become economical on-chain for the first time
3. **Gateway cross-chain execution** — Single USDC balance acts on any chain via Gateway
4. **CCTP rebalancing** — Move USDC between chains to fill positions at the best venue
5. **Precise cost accounting** — Every fee denominated in USDC, no volatile gas tokens to budget around

---

## Research Insights We're Building On

### Builder Codes as Monetization (Trading-R1 → RFB 06)
The hackathon research notes that Polymarket V2 builder codes let agents earn USDC per fill. We wrap Fourcast's AI analysis as a builder, exposing structured outputs as a signed feed.

### Reasoning Traces On-Chain (Trading-R1)
With Arc's ~$0.01 fees, we can hash and pin full reasoning traces without eroding PnL. This creates a new market type: bets on which reasoning patterns converge to profit.

### Translation as Alpha (RFB 03)
Our multi-domain analysis (weather × sports × crypto × politics) is already a translation layer — converting domain-specific data into prediction market probabilities.

---

## Key Resources

- **ARC CLI**: `uv tool install git+https://github.com/the-canteen-dev/ARC-cli`
- **Arc Node Docs**: https://rpc.testnet.arc.network/
- **Hackathon Page**: https://agora.thecanteenapp.com/
- **Arc Developer Docs**: https://docs.arc.network
- **Circle Developer Docs**: https://developers.circle.com
- **Canteen Discord**: https://discord.gg/TGnyfKh23V
- **Arc Builder Discord**: https://discord.com/invite/buildonarc
- **Submission Form**: https://forms.gle/hFPM2t4Jt1zGfqzM7
