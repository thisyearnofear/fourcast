# Agent System Improvements

## Overview
This document tracks the improvements made to the autonomous agent system based on the architecture review.

## Implemented (Priority 1-3)

### ✅ 1. AgentDashboard Wired into App
- **Location**: `/app/vision/page.js`
- **Impact**: Users can now access and run the agent directly from the Vision page
- **Status**: Complete

### ✅ 2. Track Record & Brier Scoring Infrastructure
- **Database Tables Added**:
  - `agent_forecasts`: Stores every forecast with AI probability, market odds, edge, confidence
  - `agent_runs`: Tracks agent execution metadata
- **New Functions** (`services/db.js`):
  - `saveForecast()`: Persist forecasts for track record
  - `resolveForecast()`: Update with actual outcome and calculate Brier score
  - `getAgentTrackRecord()`: Retrieve historical performance stats
  - `wasRecentlyAnalyzed()`: Check if market was analyzed recently
- **API Endpoints**:
  - `GET /api/agent/track-record`: Fetch agent performance stats
  - `POST /api/agent/resolve`: Resolve forecasts with actual outcomes
- **Impact**: Builds trust through transparent historical accuracy tracking
- **Status**: Complete - infrastructure ready, needs UI component

### ✅ 3. Arbitrage Detection Integration
- **Location**: `services/aiService.server.js` - `runAgentLoop()`
- **Integration**: After filtering candidates, runs `arbitrageService.findSimilarMarkets()`
- **Output**: Yields arbitrage opportunities in filter step data
- **UI**: AgentDashboard displays top 3 arbitrage opportunities
- **Impact**: Leverages existing cross-platform price discrepancy detection
- **Status**: Complete

### ✅ 4. Persistent Agent State
- **Feature**: Skip re-analyzing markets forecasted within 6 hours
- **Implementation**: `wasRecentlyAnalyzed()` check in forecast loop
- **Impact**: Reduces redundant API calls, improves efficiency
- **Status**: Complete

### ✅ 5. Calibration Guardrails
- **Rule**: If edge > 30%, override confidence to LOW
- **Warning**: Display "Edge >30% - high uncertainty" in UI
- **Rationale**: Markets are usually more right than LLMs; extreme edges are suspicious
- **Impact**: Prevents overconfidence in likely-wrong predictions
- **Status**: Complete

## Pending (Priority 4-6)

### 🔲 6. Track Record UI Component
- **Needed**: Display Brier scores, win rate, calibration curve
- **Location**: New component or add to AgentDashboard
- **Blockers**: None - infrastructure ready
- **Effort**: ~1-2 hours

### 🔲 7. Background/Scheduled Runs
- **Options**:
  - Next.js API route with `revalidate` (ISR)
  - Separate cron script
  - Vercel Cron Jobs
- **Blockers**: Need to decide on deployment strategy
- **Effort**: ~2-3 hours

### 🔲 8. Notification/Alert System
- **Features**:
  - Email/webhook when high-confidence edges appear
  - Push notifications for actionable recommendations
- **Blockers**: Requires user preference storage, notification service
- **Effort**: ~4-6 hours

## Usage

### Running the Agent
1. Navigate to `/vision` page
2. Configure category, markets to scan, risk tolerance
3. Click "Run Agent"
4. Watch real-time progress through discover → filter → forecast → edge steps
5. Review recommendations and arbitrage opportunities

### Resolving Forecasts (Manual)
```bash
curl -X POST http://localhost:3000/api/agent/resolve \
  -H "Content-Type: application/json" \
  -d '{"marketId": "12345", "actualOutcome": 1}'
```

### Viewing Track Record
```bash
curl http://localhost:3000/api/agent/track-record
```

## Database Schema

### agent_forecasts
```sql
CREATE TABLE agent_forecasts (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  market_title TEXT,
  platform TEXT,
  ai_probability REAL NOT NULL,
  market_odds REAL NOT NULL,
  edge REAL NOT NULL,
  confidence TEXT,
  reasoning TEXT,
  key_factors TEXT,
  timestamp INTEGER NOT NULL,
  resolved BOOLEAN DEFAULT 0,
  actual_outcome REAL,
  brier_score REAL,
  resolution_time INTEGER
);
```

### agent_runs
```sql
CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  config TEXT,
  markets_scanned INTEGER,
  candidates_filtered INTEGER,
  forecasts_made INTEGER,
  timestamp INTEGER NOT NULL
);
```

## Metrics to Track

### Calibration
- Brier score (lower is better, perfect = 0)
- Calibration curve (predicted vs actual)
- Confidence-stratified accuracy

### Edge Detection
- % of forecasts with >5% edge
- Realized edge (actual outcome vs market odds)
- Arbitrage opportunity hit rate

### Efficiency
- Markets skipped due to recent analysis
- Average forecast time
- API cost per run

## Next Steps

1. **Build Track Record UI** - Show Brier scores, calibration curve, recent forecasts
2. **Automate Resolution** - Poll Polymarket/Kalshi for market resolutions, auto-resolve forecasts
3. **Background Runs** - Schedule agent to run every 6 hours, cache results
4. **Alerts** - Notify users when high-confidence edges appear
5. **Backtesting** - Run agent on historical markets to validate calibration

## Notes

- Rate limit: 3 agent runs per hour per IP (in-memory, resets on deploy)
- Forecast TTL: 6 hours (configurable via `wasRecentlyAnalyzed()`)
- Calibration threshold: 30% edge triggers low confidence override
- Arbitrage threshold: 5% price difference, 60% title similarity
