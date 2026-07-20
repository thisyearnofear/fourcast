import { randomUUID } from 'crypto';
import { createDecisionPolicy, evaluateDecision } from '@/services/domain/decision/decisionPolicy';
import { buildDecisionReceipt } from '@/services/domain/decision/decisionReceipt';
import { deriveSimulationSeed, simulateBinaryMarket } from '@/services/domain/decision/simulation';
import { readReplayFixture, readReceiptFixture, normalizeFixture } from '@/services/txline/txlineService';

export const runtime = 'nodejs';

/**
 * Canonical demo fixture — France v Sweden, World Cup Round of 32 (fixtureId
 * 18175981). Odds from docs/API_REFERENCE.md (TxLINE consensus). Used as a
 * fallback when the cached replay has no odds snapshot, so the dry-run preview
 * works in replay mode after the July 19 TxLINE cutoff.
 */
const DEMO_FIXTURE = {
  fixtureId: '18175981',
  home: { name: 'France', id: 1999 },
  away: { name: 'Sweden', id: 3095 },
  competition: 'World Cup',
  odds: { implied: { home: 0.61, draw: 0.22, away: 0.17 } },
};

/**
 * POST /api/agent/dry-run
 *
 * Body: {
 *   fixtureId?: string (defaults to the canonical demo fixture),
 *   minAbsoluteEdge?: number (0-1),
 *   maxAllocationPct?: number (0-1),
 *   maxLossProbability?: number (0-1),
 *   simulationRuns?: number (100-100000),
 * }
 *
 * Returns the same { receipt, recommendation, simulation, decision, fixture,
 * policy } shape the VPS worker produces — WITHOUT writing a receipt to disk,
 * posting a heartbeat, or executing anything. This is the self-serve version
 * of the concierge test's "hand-roll a mandate and see what it would have
 * decided" step (docs/GO_TO_MARKET.md §2.2).
 *
 * Reuses the canonical decision domain modules so the verdict is identical to
 * what the worker would produce under the same policy.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const fixtureId = String(body.fixtureId || DEMO_FIXTURE.fixtureId);

    // Filter out undefined/null so createDecisionPolicy's DEFAULT_DECISION_POLICY
    // fills them in. Without this, { ...DEFAULT, ...{ minAbsoluteEdge: undefined } }
    // overwrites the default with undefined, which clamps to 0.
    // Note: the worker's env defaults (maxAllocationPct=0.03) differ from
    // DEFAULT_DECISION_POLICY (0.25); we use the worker's defaults so the
    // dry-run matches what a prospect would get if they deployed the worker
    // without overriding env vars.
    const WORKER_DEFAULTS = {
      minAbsoluteEdge: 0.05,
      maxAllocationPct: 0.03,
      maxLossProbability: 0.75,
      simulationRuns: 10_000,
    };
    const policyOverrides = { ...WORKER_DEFAULTS };
    for (const key of ['minAbsoluteEdge', 'maxAllocationPct', 'maxLossProbability', 'simulationRuns']) {
      if (body[key] != null && !Number.isNaN(Number(body[key]))) {
        policyOverrides[key] = Number(body[key]);
      }
    }
    const policy = createDecisionPolicy(policyOverrides);

    const resolved = resolveFixtureAndOdds(fixtureId);
    if (!resolved) {
      return Response.json(
        { success: false, error: `Fixture ${fixtureId} not found in cached replays and is not the demo fixture.` },
        { status: 404 },
      );
    }

    const { fixture, odds } = resolved;
    const homePrice = odds.implied.home;
    const forcedEdge = 0.056; // matches FOURCAST_AGENT_FAIR_EDGE default in the worker
    const fairProbability = clamp(homePrice + forcedEdge, 0.01, 0.99);

    const recommendation = {
      aiProbability: round(fairProbability),
      marketOdds: round(homePrice),
      edge: round(fairProbability - homePrice),
      sizePct: round(Math.min(policy.maxAllocationPct, Math.max(0, (fairProbability - homePrice) * 0.375))),
    };

    const marketId = `txline:${fixture.id}:home_win`;
    const seed = deriveSimulationSeed(['fourcast-dry-run', fixture.id, marketId, policy.version, new Date().toISOString()]);
    const simulation = simulateBinaryMarket({
      probability: recommendation.aiProbability,
      marketOdds: recommendation.marketOdds,
      direction: 'BUY YES',
      runs: policy.simulationRuns,
      seed,
    });

    const decision = evaluateDecision({ recommendation, simulation, policy });

    const receipt = buildDecisionReceipt({
      id: `fourcast-dry-run-${fixture.id}-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      policy,
      evidence: {
        sources: ['txline'],
        mode: 'dry-run',
        fixture: {
          id: fixture.id,
          competition: fixture.competition,
          kickoff: fixture.kickoff || null,
          home: fixture.home,
          away: fixture.away,
        },
        snapshot: {
          provider: 'txline',
          capturedAt: new Date().toISOString(),
          consensusOdds: odds,
        },
      },
      decisions: [
        {
          market: {
            id: marketId,
            fixtureId: fixture.id,
            side: 'home_win',
            title: `${fixture.home.name} to beat ${fixture.away.name}`,
          },
          forecast: {
            probability: recommendation.aiProbability,
            edge: recommendation.edge,
            source: 'fourcast-dry-run:preview',
          },
          simulation,
          decision,
        },
      ],
      execution: { attempted: 0, completed: 0, failed: 0, dryRun: true },
      ledger: {
        fixtureId: fixture.id,
        summary: {
          marketsScanned: 1,
          candidatesFiltered: 1,
          forecastsMade: 1,
          runMode: 'dry-run-preview',
        },
      },
    });

    return Response.json({
      success: true,
      fixture: {
        id: fixture.id,
        home: fixture.home,
        away: fixture.away,
        competition: fixture.competition,
      },
      policy,
      recommendation,
      simulation,
      decision,
      receipt,
    });
  } catch (error) {
    console.error('[POST /api/agent/dry-run]', error);
    return Response.json(
      { success: false, error: error.message || 'Dry-run failed' },
      { status: 500 },
    );
  }
}

/**
 * Resolve a fixture and its consensus odds. Tries (1) the cached replay
 * fixture's odds snapshot, (2) a receipt file bound to the fixture, (3) the
 * hardcoded DEMO_FIXTURE for the canonical fixtureId. Returns null if the
 * fixtureId is unknown and not the demo.
 */
function resolveFixtureAndOdds(fixtureId) {
  // (3) Demo fixture fallback — always available, even in replay mode.
  if (String(fixtureId) === DEMO_FIXTURE.fixtureId) {
    const replay = readReplayFixture(fixtureId);
    const normalized = replay ? normalizeFixture(replay.fixture || replay) : null;
    return {
      fixture: normalized || {
        id: DEMO_FIXTURE.fixtureId,
        home: DEMO_FIXTURE.home,
        away: DEMO_FIXTURE.away,
        competition: DEMO_FIXTURE.competition,
      },
      odds: DEMO_FIXTURE.odds,
    };
  }

  // (1) Cached replay fixture
  const replay = readReplayFixture(fixtureId);
  if (replay) {
    const normalized = normalizeFixture(replay.fixture || replay);
    if (normalized?.odds?.implied?.home) {
      return { fixture: normalized, odds: normalized.odds };
    }
  }

  // (2) Receipt file bound to the fixture
  const receiptFile = readReceiptFixture(fixtureId);
  if (receiptFile?.proof?.evidence?.snapshot?.consensusOdds?.implied?.home) {
    const normalized = replay ? normalizeFixture(replay.fixture || replay) : normalizeFixture({ FixtureId: fixtureId });
    return { fixture: normalized, odds: receiptFile.proof.evidence.snapshot.consensusOdds };
  }

  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
