# Hackathon Implementation Checklist

## Phase 1: DeFi Arbitrage Signals (Week 1-2)

### Backend ✅
- [x] Enhanced `arbitrageService.js` to detect price discrepancies across Polymarket/Kalshi
- [x] Created `/api/defi/arbitrage` endpoint returning profitable signal opportunities
- [x] Added DeFi-specific metrics: capital efficiency, liquidity score, flash loan suitability
- [x] Endpoint returns enriched signals suitable for LP consumption

**Endpoint:** `GET /api/defi/arbitrage?minSpread=5&limit=20&minVolume=50000`
- Returns array of arbitrage opportunities with platform pricing, spreads, profitability metrics
- Filters by minimum spread threshold (default 5%)
- Calculates per-$1k profit estimates and liquidity scores

### Frontend ✅
- [x] Created "💱 DeFi Arbs" tab in signals page
- [x] Built `DeFiArbitrageTab.js` component with filterable opportunities
- [x] Display arbitrage opportunities with buy/sell prices on each platform
- [x] Show profitability: spread %, profit per $1k, capital efficiency
- [x] Direct links to markets on Polymarket and Kalshi
- [x] Expandable cards showing full DeFi metrics

**Features:**
- Minimum spread slider filter (1-30%)
- Quick preview of buy/sell opportunities
- Expanded view showing liquidity scores, capital requirements, AI analysis
- Flash loan suitability indicator

### Move Module
- [x] Verified `signal_marketplace.move` supports tipping for DeFi signals
- [x] Signal shape generic enough for arbitrage use case
- [ ] Deploy test instance to Movement testnet

### Testing
- [x] Created test script: `scripts/test-defi-arbitrage.js`
- [ ] Test with live market data
- [ ] Verify signal publishing flow end-to-end
- [ ] Verify leaderboard tracks DeFi analyst earnings

---

## Phase 2: Consumer Experience & Consolidation (Week 2-3)

### Consolidation ✅
- [x] Merged `userStatsService.js` + `resolutionService.js` → `reputationService.js`
- [x] Deleted `shareableContentService.js` (moved to lightweight `utils/shareSignal.js`)
- [x] Updated all imports in API routes and components
- [x] Maintained backward compatibility through export functions

**Result:** Single source of truth for analyst reputation and signal resolution

### Consumer Signal Experience ✅ IN PROGRESS

### Frontend ✅
- [x] Deleted `shareableContentService.js` (moved to lightweight `utils/shareSignal.js`)
- [x] Enhanced LeaderboardTab with analyst tier badges and earnings display
- [x] Leaderboard shows: Rank, Tier (emoji + name), Win Rate, Signals, Tips Earned (APT)
- [x] Mobile-responsive grid (1-col mobile, 4-col desktop)
- [x] Existing tipping UI already works (on SignalCard via Aptos integration)
- [x] One-click Farcaster share already integrated (via `utils/shareSignal.js`)

**Visual Enhancements:**
- Analyst tiers: Sage 👑, Elite 🌟, Forecaster 🎯, Predictor 📊, Novice 🌱
- Earnings column shows APT from tips received
- Responsive layout adapts to screen size

### Backend ✅
- [x] Merged `userStatsService.js` + `resolutionService.js` → `reputationService.js`
- [x] Track analyst earnings from tips (calculated from total_tips field)
- [x] Leaderboard now shows: total_earnings (in APT), totalTipsReceived (in octa)
- [x] Single source of truth for reputation metrics

**Implementation:**
- `services/reputationService.js` - 350 LOC unified service
- Export functions maintain backward compatibility
- Calculates tiers, earnings, win rates, streaks, calibration

### On-Chain
- [x] Tipping already works via existing Aptos integration
- [x] Signal contract tracks total_tips for each signal
- [ ] Deploy/test on Movement testnet (Phase 2.5)

### Testing (Next)
- [ ] Publish demo signals and test tipping flow
- [ ] Verify earnings display in leaderboard
- [ ] Test tier badge updates

---

## Phase 3: DevEx SDK + Multi-Domain Framework (Week 3-4)

### SDK Architecture
- [ ] **Create `@fourcast/signal-sdk` package** (new TypeScript library)
  - Export `SignalPublisher` interface (generic)
  - Implement `WeatherSignalPublisher` (reuse existing logic)
  - Move domain-specific logic to config, not code
  - CLI: `npx @fourcast/sdk init <domain>`

### Backend Consolidation
- [ ] Refactor `aiService.js` → `EdgeAnalyzer` (generic pattern)
  - Input: edge data + config
  - Output: Signal shape
  - Works for weather, mobility, sentiment, on-chain

- [ ] Create `services/domains/` folder:
  - `weather.js` - existing WeatherSignalPublisher
  - `mobility.js` - Google Popular Times → event turnout signals
  - `sentiment.js` - Neynar sentiment → narrative signals
  - `onchain.js` - Movement tx patterns → governance signals

### Move Module
- [ ] Deploy single Signal Registry module to Movement testnet
- [ ] Test all 4 domains publishing to same contract

### Testing
- [ ] Unit tests for each domain analyzer
- [ ] Integration tests: publish from each domain, verify on-chain
- [ ] Verify all 4 domains use same Signal shape

### Documentation
- [ ] Update ARCHITECTURE_GUIDE.md (done ✅)
- [ ] Create `SDK.md` with getting-started guide
- [ ] Publish SDK to npm (@fourcast/signal-sdk)

---

## Phase 4: Video Proof of Concept (Week 3-4)

### Video Content (5-7 min)
- [ ] **Intro (30s)**: Explain Fourcast modular architecture
  - Problem: Signal types require rebuilding
  - Solution: Generic Signal Registry + SDK
  
- [ ] **Weather Domain (1 min)**: Show existing signals publishing
  - Run analyzer, publish to Movement
  - Show on-chain verification
  
- [ ] **Mobility Domain (1.5 min)**: Fork for event turnout
  - Swap data source to Google Popular Times
  - Publish same signal type
  - Show same contract, different domain
  
- [ ] **Sentiment Domain (1.5 min)**: Adapt Neynar integration
  - Fetch Farcaster sentiment shifts
  - Analyze narrative momentum
  - Publish signals
  
- [ ] **On-Chain Domain (1 min)**: Movement network signals
  - Analyze tx patterns, validator behavior
  - Publish to same registry
  - Show all 4 side-by-side
  
- [ ] **Outro (1 min)**: Ease of replication
  - Show `npm init @fourcast/signal-sdk`
  - Point to docs
  - Show any team can build next domain

### Recording
- [ ] Screen capture: Terminal + browser
- [ ] Audio: Clear narration
- [ ] Subtitles for Discord/YouTube

### Distribution
- [ ] Post on GitHub (pin in repo)
- [ ] Share in Movement Discord
- [ ] Include in hackathon submission

---

## Phase 5: People's Choice (Ongoing)

### Community Engagement
- [ ] Post SDK + video in Movement Discord
- [ ] Showcase leaderboard with real signals
- [ ] Invite community to publish signals
- [ ] Monitor Farcaster mentions + reactions

### Key Metrics for Voting
- Signal quality (analyst accuracy)
- Community engagement (tips, shares, reactions)
- Technical excellence (SDK quality, docs)

---

## Consolidation Checklist (Core Principles)

### ENHANCEMENT FIRST
- [x] Reuse existing signal marketplace
- [x] Extend arbitrageService.js (no new service)
- [x] Adapt existing Neynar integration
- ✅ No x402 integration

### AGGRESSIVE CONSOLIDATION
- [ ] Delete `shareableContentService.js`
- [ ] Merge `userStatsService.js` + `resolutionService.js`
- [ ] Extract `EdgeAnalyzer` pattern from `aiService.js`
- [ ] Consolidate Move module (deploy once, use 4 ways)

### PREVENT BLOAT
- [x] One signal marketplace (all domains)
- [x] One Move contract (multi-domain)
- [x] One SDK pattern (no domain-specific code)
- [ ] One video (proves all use cases)

### DRY
- [x] Signal shape = single source of truth (Move module)
- [x] Analyzer pattern = single template (EdgeAnalyzer)
- [ ] Config-driven domains (no code duplication)

---

## Deliverables Summary

| Bounty | Phase | Deliverable | Status |
|--------|-------|-------------|--------|
| **Best DeFi App** ($5K) | 1 | `/api/defi/arbitrage` endpoint + demo | ⏳ |
| **Best Consumer App** ($5K) | 2 | Signal feed + tipping + leaderboard | ⏳ |
| **Best DevEx Tool** ($5K) | 3 | @fourcast/signal-sdk package + docs | ⏳ |
| **People's Choice** ($5K) | 4 | Video + community signals | ⏳ |

**Total Potential Prize:** $20,000

---

## Success Metrics

✅ **Hackathon:**
- All 4 bounties submitted and evaluated
- Video shows 3+ domains using same Move contract
- SDK is published and documented
- Movement testnet has live signals from each domain

🚀 **Post-Hackathon (Mainnet):**
- Signal SDK used by other teams
- DeFi protocol integrations (flash loan consumers)
- Multi-domain signal ecosystem active
