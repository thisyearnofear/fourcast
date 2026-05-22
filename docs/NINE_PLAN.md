# Fourcast → 9/10 on Product & Architecture

A 6-week, opinionated plan. Each phase ships a tangible artifact and a measurable improvement. The order matters: foundation → focus → polish.

---

## Phase 0 — Stop the bleeding (Week 1, ~3 days)

**Goal:** never again have a Friday-night Vercel surprise.

### P0.1 — Pre-deploy CI gate (½ day)

- GitHub Action that runs on every PR: `npm run lint && npm run typecheck && npm run test && next build`
- Fails if any Edge route bundle > 900 KB (warn at 750 KB) using a tiny script that parses `.next/server/app/api/**/route.js` size.
- Fails if any new `app/api/**/route.js` lacks an explicit `export const runtime` line.

### P0.2 — Runtime policy doc + lint (½ day)

- Add `docs/RUNTIME_POLICY.md`: Edge = read-only JSON, no WASM, no Node SDK with native bindings; Node = DB writes, large SDKs (`@vercel/og`, `@polymarket/clob-client`, `better-sqlite3`), anything pulling WASM.
- Add an ESLint rule (custom or `no-restricted-syntax`) requiring `runtime` to be declared in every API route.

### P0.3 — Schema migrations runner (1 day)

- Create `migrations/` with numbered files: `0001_init.sql`, `0002_signals_outcome.sql`, `0003_agent_forecasts_autopilot.sql`.
- Add `migrations_applied` table (`id`, `hash`, `applied_at`). On boot, `services/db.js` runs only un-applied migrations.
- Delete the inline `ALTER TABLE` blob in `services/db.js`.
- `npm run migrate:status` and `npm run migrate:new <name>` scripts.

### P0.4 — Bundle audit (½ day)

- Add `@next/bundle-analyzer`; commit a baseline `bundle-report.json`.
- File issues for any client chunk > 250 KB gz.

**Exit criteria:** PR cannot merge without green CI; no route can grow past its size budget silently; no schema change can ship without a migration file.

---

## Phase 1 — Architectural focus (Week 2)

**Goal:** collapse sprawl into legible domains.

### P1.1 — API namespacing

Today: `agent/`, `bot/`, `builder/`, `analyze/`, `predictions/`, `validate/` — overlapping concepts.

Target structure:
```
app/api/
  markets/          # external feeds (Polymarket, Kalshi, counts)
  intelligence/     # analyze, predict, builder, validate  ← merge
  agent/           # autopilot loop (runs, executions, backtest, track-record)
  signals/         # on-chain publish + resolve + leaderboard
  wallet/          # positions, orders, balance, cctp
  social/          # farcaster, telegram bot
  meta/            # og, debug, stats, health
```

Use Next.js route groups or re-exports so URLs change once with a redirect map in `next.config.mjs`.

### P1.2 — services/ layering

Current `services/` has 25+ flat files. Reorganize:
```
services/
  providers/    # polymarket, kalshi, venice, synth, openMeteo, neynar  (pure I/O)
  domain/       # analysis, arbitrage, reputation, pathDependent       (pure logic)
  chain/        # movePublisher, chainConfig, cctp                      (on-chain I/O)
  infra/        # db, redis, telemetry, aiRouter                        (cross-cutting)
```

Each provider exposes a typed client with: timeout, retry, cache key, error type. No more raw fetch in route handlers.

### P1.3 — One typed contract

- Define `types/intelligence.ts` for `Market`, `Signal`, `Forecast`, `Position`, `Outcome` — single source of truth.
- Convert route handlers to TS one namespace at a time (start with `intelligence/`).

### P1.4 — Pick the EVM chain

- Choose one of BNB / Polygon / Arbitrum as GA, demote the other two to a single `docs/ROADMAP.md` entry.
- Update `README.md` badges to reflect reality.
- Reason: an architecture that maintains three half-finished EVM integrations cannot be 9/10.

**Exit criteria:** API tree fits on one screen; every external call goes through a provider client; one EVM chain documented as GA.

---

## Phase 2 — Reliability fabric (Week 3)

**Goal:** failures become observable and bounded.

### P2.1 — Resilience primitives (in `services/infra/http.ts`)

- `fetchWithBudget({ url, timeoutMs, retries, cacheTtl })` — used by every provider.
- Per-provider circuit breaker (open after N consecutive failures, half-open after 30s).
- Standard error type: `ProviderError { provider, code, retryable }`.

### P2.2 — Caching discipline

- Audit Redis usage; document a key namespace convention: `fc:<domain>:<entity>:<id>:v<n>`.
- Add `Cache-Control` + `s-maxage` headers on every read-only route in `markets/` and `intelligence/`.
- Stale-while-revalidate for Polymarket/Kalshi odds (1s fresh, 10s stale).

### P2.3 — Observability

- Wire structured logs (already have `pino-pretty`): one line per request with `route`, `runtime`, `provider_calls[]`, `db_ms`, `total_ms`, `status`.
- Add `/api/meta/health` that returns provider health (last ok timestamp, circuit state) — uses what P2.1 collects.
- Vercel log drain → a cheap sink (Axiom / Better Stack free tier) for searchable history.

### P2.4 — Test pyramid

- **Unit:** provider clients (mock fetch) + domain logic (`marketTypeDetector.test.js` is the only one — add 5 more for `arbitrage`, `pathDependent`, `reputation`, `kelly`, migration runner).
- **Integration:** one happy-path test per API namespace using `next/test` and the local SQLite db.
- **E2E smoke (Playwright):** landing search → analyze → see result. 1 test, runs in CI.

**Exit criteria:** every external dep has a timeout + retry + circuit breaker; one health endpoint shows truth; CI has unit + integration + 1 e2e.

---

## Phase 3 — Product sharpening (Week 4)

**Goal:** the product does fewer things, and each thing is undeniably better.

### P3.1 — The "one loop" decision

Pick one primary user loop and make it 9/10:

> "I search a market → I see AI + ML forecast with evidence → I publish a signal OR place a trade → I get scored."

Everything else (autopilot, 3D landing, deep-reasoning visualizer, Farcaster, Telegram, builder) is a side door, not part of the headline narrative.

### P3.2 — Information architecture rewrite

- **Landing:** search (already shipped). Keep it.
- **One nav:** Markets · Signals · Agent · You (positions + reputation). Retire any nav item that doesn't map.
- Move `autopilot`/`builder`/3D scene to "Labs" — labeled experimental. Honesty is a 9/10 product trait.

### P3.3 — Evidence-first analysis card

- Every AI prediction must show: data sources used (timestamps), confidence with method, "what would change my mind" counter-signal.
- No probability is rendered without provenance. This is the single biggest credibility lever.

### P3.4 — Reputation as the spine

- Surface Brier score, calibration curve, and 30-day win rate on every analyst profile and every published signal card.
- Add public, immutable "track record" page (already have `agent/track-record`) — link it from every AI output.

### P3.5 — Onboarding cut

- Empty-state for unconnected users: "Try a signal in 10 seconds" — preloaded market, no wallet required.
- ConnectKit only when actually needed (publish/trade).

**Exit criteria:** one primary loop, zero unlabeled experiments, every probability has provenance, reputation visible everywhere.

---

## Phase 4 — Performance & polish (Week 5)

### P4.1 — Streaming where it matters

- `analyze/stream` exists — make it the default for analysis. Show partial reasoning + provenance progressively.

### P4.2 — Three.js triage

- Lazy-load `Scene3D` only on routes where it's the headline (landing). Use `<Suspense>` + `dynamic(..., { ssr:false })`.
- Add a `prefers-reduced-motion` and low-power fallback (static gradient). This kills the ConnectKit/WebGL conflicts at the root.

### P4.3 — Image / OG hygiene

- Now that `api/og` is on Node runtime, it can include richer dynamic content. Make every signal share a beautiful OG (market, AI %, edge, author).
- This is high-leverage product surface — every Twitter share is a billboard.

### P4.4 — Web vitals budget

- LCP < 2.0s, TBT < 200ms, CLS < 0.05 on landing and a typical market page.
- Add Vercel Analytics watchdog or a Lighthouse-CI step in P0.1.

---

## Phase 5 — Trust, docs, and contributor surface (Week 6)

### P5.1 — Architecture truth

- Rewrite `docs/ARCHITECTURE.md` with the real fan-out (providers, caches, circuit breakers, on-chain settlement), not the simplified mermaid in the README.
- Add a sequence diagram for the headline loop end-to-end with retry/cache annotations.

### P5.2 — Honest status page

- `app/status` (public) reading `/api/meta/health`. Visitors see whether Polymarket/Kalshi/Venice/Synth are healthy right now.
- This converts an embarrassment vector (flaky third parties) into a trust signal.

### P5.3 — SDK & extension story

- The `sdk/` folder is a real differentiator. Ship a 1-screen "Build a custom signal publisher" tutorial + a working example repo.

### P5.4 — License & contribution

- `CONTRIBUTING.md` with the runtime policy, migration policy, provider-client policy, and "where features go to die" (Labs criteria).

---

## Sequencing & risk

| Week | Phases | Notes |
|------|--------|-------|
| Week 1 | P0 (foundation) | Must come first; everything else depends on it |
| Week 2 | P1 (structure) | Do before adding more reliability code |
| Week 3 | P2 (reliability) | Now that structure exists, harden it |
| Week 4 | P3 (product focus) | Parallelizable with P2 in second half |
| Week 5 | P4 (perf & polish) | |
| Week 6 | P5 (trust & docs) | |

### What we explicitly do NOT do

- No new chains, no new providers, no new top-level features for 6 weeks.
- No rewrites. Every change is in-place, behind feature flags where risky.

---

## Definition of 9/10

### Architecture (9/10)

- Zero ad-hoc `ALTER TABLE`. All schema via migrations.
- Every external call goes through a typed provider client with timeout/retry/circuit-breaker.
- Every API route declares its runtime; CI enforces bundle budgets.
- One health endpoint reflects reality; structured logs are searchable.
- One EVM chain GA, others honestly labeled.
- Test pyramid in place; PRs blocked without it.

### Product (9/10)

- One headline loop, executed beautifully.
- Every probability shows provenance.
- Reputation is the spine, visible everywhere.
- Experiments are labeled "Labs," not hidden among GA features.
- Onboarding is action-first, wallet-lazy.
- Status page makes third-party flakiness a trust signal, not a tax.

---

## Progress Tracking

| Phase | Status | Completed |
|-------|--------|-----------|
| P0.1 — Pre-deploy CI gate | ⬜ Pending | |
| P0.2 — Runtime policy doc + lint | ⬜ Pending | |
| P0.3 — Schema migrations runner | ⬜ Pending | |
| P0.4 — Bundle audit | ⬜ Pending | |
| P1.1 — API namespacing | ⬜ Pending | |
| P1.2 — services/ layering | ⬜ Pending | |
| P1.3 — One typed contract | ⬜ Pending | |
| P1.4 — Pick the EVM chain | ⬜ Pending | |
| P2.1 — Resilience primitives | ⬜ Pending | |
| P2.2 — Caching discipline | ⬜ Pending | |
| P2.3 — Observability | ⬜ Pending | |
| P2.4 — Test pyramid | ⬜ Pending | |
| P3.1 — The "one loop" decision | ⬜ Pending | |
| P3.2 — Information architecture rewrite | ⬜ Pending | |
| P3.3 — Evidence-first analysis card | ⬜ Pending | |
| P3.4 — Reputation as the spine | ⬜ Pending | |
| P3.5 — Onboarding cut | ⬜ Pending | |
| P4.1 — Streaming where it matters | ⬜ Pending | |
| P4.2 — Three.js triage | ⬜ Pending | |
| P4.3 — Image / OG hygiene | ⬜ Pending | |
| P4.4 — Web vitals budget | ⬜ Pending | |
| P5.1 — Architecture truth | ⬜ Pending | |
| P5.2 — Honest status page | ⬜ Pending | |
| P5.3 — SDK & extension story | ⬜ Pending | |
| P5.4 — License & contribution | ⬜ Pending | |