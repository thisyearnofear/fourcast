# Design Alignment Review — 2026-08-12

Holistic review of fourcastapp.vercel.app ahead of the agent-proof (`/arena`)
work. Measured with Playwright against production (DOM extracts, page weight,
route inventory), read against `design.md` (locked system) and `STRATEGY.md`
(positioning). No hackathon clock on this — the bar is clear, compact,
intuitive, delightful, performant.

## What the site is today (evidence)

| Route | Words | Interactive | Verdict |
|---|---|---|---|
| `/` | 181 | 37 | Hero leads **Canton privacy** ("Every size bet in public is a confession") — contradicts STRATEGY.md's 2026-08-10 decision to lead with the agent core |
| `/markets` | 428 | 43 | Solid workbench; healthy |
| `/positions` | **97** | 24 | Hollow — should be the verifiable-track-record page |
| `/agent` | 493 | 39 | Mandate cockpit (Polymarket/TxLINE stack), strong bones |
| `/autopilot` | 445 | 27 | **Second, overlapping agent surface** (Run Agent) — user confusion |
| `/signals` | **1504** | 67 | Wordiest page by 3× — violates density budgets in design.md |
| `/status` | 131 | 19 | Fine utility |
| `/world-cup` | — | — | **Times out entirely (30s+)** — dead hackathon artifact in production |
| `/month` | 46 | 9 | 404 page |
| `/weather` | 120 | 17 | Orphaned onboarding tour, no nav chrome |

Page weight: 0.9–1.26 MB transferred per route (63–96 resources) — heavy for
mostly-static surfaces. `/world-cup` unbudgeted by being dead.

## The core misalignments

1. **Strategy ↔ home conflict.** We decided (and re-confirmed by the Delphi
   work) that the wedge is *verifiable autonomous operation* — but the home
   leads "privacy," which STRATEGY.md positions as roadmap, not hero.
2. **The week's best material is invisible.** Data-feeds, gate refusals,
   Exa-cited reasoning, a live arena position, calibration curve — none of it
   reaches a visitor; it lives in VPS logs.
3. **Surface sprawl.** 14+ routes with overlap: two agent pages (`/agent`,
   `/autopilot`), a dead `/world-cup`, a 404 `/month`, orphaned `/weather`,
   hollow `/positions`, bloated `/signals`.
4. **design.md is under-used as the arbiter.** It already names the mental
   model — *act → confirm → prove*, proof as signature motion — but agent
   reasoning (the proof object) has no first-class visual grammar.

## Aligned IA (proposal)

Primary nav: **Markets · Positions · Arena · Private** (+ More: Signals,
Status, Labs).

- `/` — hero refocused on the verifiable agent: *"One agent core. Multiple
  venues. Every decision provable."* + a **live arena strip** (real numbers:
  current position, gates, source mix) above the door grid. Canton demoted to
  a door (per STRATEGY.md; its page `/private` keeps the privacy arc).
- `/markets` — unchanged workbench.
- `/positions` — built out into the track record: verifier-grade receipts,
  mandate-adherence stats, calibration; current depth is a placeholder.
- `/arena` (new) — absorbs the Delphi agent lane AND `/autopilot`'s "run the
  agent" concept as **one** agent surface: live cycle feed, decision ledger,
  source attribution, calibration curve, what-it-means explainer. `/agent`
  stays the mandate cockpit; both cross-link; **kill `/autopilot`**
  (redirect to `/arena`).
- Redirects: `/world-cup → /status` (with archive note), `/month` → home,
  `/weather` → home tour query or off-nav.

## Design-language approach (beautifului.dev fit)

Import the *primitives*, keep our system: their reasoning timelines, citation
chips, verdict stamps, thinking states — restyled to `tokens.css`:

- **Reasoning timeline** → "proof progression" (already our signature motion
  per design.md): forecast (est vs mkt) → edge → five gates → verdict.
- **Citation chips** → Exa `[1][2]` snippets and datafeed published values,
  mapped to our semantic colors (evidence-blue).
- **Verdict stamps** → ALLOCATE (accent emerald) / PASS (ink-muted) /
  PAPER (review violet) / SETTLED (sealed amber) / BREACH (breach red) — these
  colors already exist for exactly this.
- **Approvals** → future "delegate capital, approve trades over X" operator
  primitive (monetization lane in STRATEGY.md).

Do NOT adopt their general chrome/typography — that would fork our locked
system (Syne/DM Sans/JetBrains Mono, square CTAs, card policy).

## Performance budget (add to lighthouserc)

- Route transfer ≤ 600 KB desktop, ≤ 450 KB mobile outliers justified inline.
- Kill `/world-cup` assets (route + data fetchers gated off by default).
- Code-split: agent/arena views must not load chart libs above the fold;
  citation/evidence lists virtualized past 20 rows.
- LCP ≤ 2.0s on `/`, `/markets`, `/arena`; INP ≤ 200ms.

## Live-presence policy (where liveness lives)

Consistency rule for tapes, pulses, and verdict grammar, so it stays a
decision, not an accident:

- **Shared grammar module**: `utils/arenaUi.js` (verdict stamps, ago/until
  helpers) — every live element consumes it; never fork color/time semantics.
- **EventTape (scrolling tape)**: trading family only — Landing (under the
  hero), Markets, Positions (all tabs). It answers "is anything happening?"
  before any scroll.
- **Arena**: owns decision/execution ROWS (the tape's deep form) — no tape
  there, it would duplicate its own content. Status page IS liveness — no
  tape added. Signals/Private/Labs: different jobs, no tape.
- **Heartbeat** (header pulse): global, every AppShell page, lamp on all
  viewports, labels xl+.
- **Verdict colors** (tokens, locked): ALLOCATE=emerald, PASS=muted,
  PAPER=violet, SETTLED=amber, BREACH=red. Motion only on genuinely-live
  values; reduced-motion = static.

## Creative-motion explorations (verdicts)

Candidates reviewed for a signature proof moment (2026-08-13):

- **View Transitions (native)**: ADOPTED for arena lane morphs
  (`arena-lane-host` + `vt-lane-*`, reduced-motion aware). Cheap, accessible,
  no deps.
- **Seal→verify reveal**: ADOPTED as CSS signature (`fc-unseal`) — every
  ledger-row expansion 'unseals' via evidence wipe + scan. Fulfills
  design.md's proof-progression signature without GPU complexity.
- **WebGPU page transitions (bnpne/page-transitions-with-webgpu)** +
  **Codrops motion-path (Ibaliqbal)** + **GSAP shaders (biazo)**: PARKED as
  the upgrade path for the seal moment on full receipts. Verdict: impressive
  but WebGPU coverage (Safari partial, Firefox flag-only) makes it a
  progressive-enhancement play only; build the fuller reveal when a real
  receipts dossier exists to explode, behind `?gpu` capability detection and
  a CSS fallback. Do NOT sprinkle shaders as ambient decor — the moment must
  mean something (seal → verify), or it violates our own motion policy.

## Execution order

1. **Arena data plumbing first** (worker → `/api/arena` ingest via Turso +
   public read) — history starts accruing immediately; page renders after.
2. **`/arena` page** with the primitives above.
3. Home refocus (hero copy + arena strip; Canton to door).
4. Consolidations + redirects (kill `/autopilot`, `/world-cup`, `/month`,
   `/weather` handling; `/positions` depth pass; `/signals` density diet).
5. Perf pass vs budget.
