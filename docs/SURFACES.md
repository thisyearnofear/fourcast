# Surface registry — the quality bar's ledger

**This is the registry for gate G4 and G6 of the quality bar** defined in
[`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md#surface-quality-bar-all-21-routes). One row per
route in `app/**/page.js`. Adding a route without a row fails
`scripts/check-surface-registry.mjs`.

**Ownership here is PROPOSED, pending the lead's sign-off** (the plan was requested before
assignment). Nothing in this file is a commitment until the lead says so.

## How to read a row

- **Renders** — does the route actually render, or does `next.config.mjs` redirect it first?
  A route that never renders is not audited; it is deleted or un-redirected.
- **Gates** — `G1` tokens · `G2` one job per section · `G3` truthful states ·
  `G4` evidence one tap · `G5` a11y floor · `G6` one primary CTA ·
  `G7` story legibility (spine only). `—` = not applicable, `?` = not yet audited.
- **Last audit** — the date the row was last checked against the gates. A row older than the
  review cadence is flagged by the registry checker.

## The registry

| Route | Renders | Class | Job | Primary CTA | Owner (proposed) | Gates | Last audit |
|---|---|---|---|---|---|---|---|
| `/` | yes | A spine | Hero, live agent rail, latest execution, proof timeline | *See the proof* | C (audit) / A (if editing) | G1–G6 ? · G7 ? | — |
| `/arena` | yes | A spine | The agent's decisions, positions, calibration — three lanes: Ledger \| Mandate \| Memory | *(none — read surface; the Memory lane's two buttons are spend-gated reads, not CTAs)* | **A** | G1 ✓ (CalibrationCurve's 12 raw literals moved to named tokens, 21 Oct) · G2 ✓ · G3 ✓ · G5 ✓ (mechanical — `BUDGET['/arena'] = 0`) · G4 ? · G6 ? · G7 ? | 2026-10-21 mech. |
| `/signals` | yes | A spine | Publish a signal; the paid premium tier | *Publish signal* | **C** | G1–G6 ? · G7 ? | — |
| `/signal/[id]` | yes | A | One signal, its receipt, its outcome | *(none)* | **A** | G2 G3 G5 ? | — |
| `/markets` | yes | A spine | The act — find a market, take a side | *Take side* | C (audit) | G1–G6 ? · G7 ? | — |
| `/positions` | yes | A | Open and closed positions | *(none)* | C (audit) | G2 G3 G5 ? | — |
| `/proof` | yes | A spine | Private (Canton) settlement + the proof theatre | *Create private market* | **B** | G1 ✓ (0 literals in shell/CantonProof; ProofTheatre.js 2 in baseline) · G2 ✓ (h1 via AppShell, chain tabs) · G3 ✓ (6 state branches) · G4 ✓ (the surface *is* the receipt expander) · G6 ? · G7 ? | 2026-10-21 mech. |
| `/status` | yes | A | Provider health | *(none — read surface)* | **B** | G1 ✓ (0 literals) · G2 ✓ · G3 ✓ (spinner + error-retry + emptyLabel) · G5 ✓ (named controls; a11y-contrast not yet measured) | 2026-10-21 mech. |
| `/labs` | yes | B | The labs hub | *(none)* | C (audit) | G2 G3 G5 ? | — |
| `/labs/autopilot` | yes | B | Kelly sizing + Builder fills | *(none)* | C (audit) | G2 G3 G5 ? | — |
| `/labs/builder` | yes | B | Polymarket Builder volume + gasless trades | *(none)* | C (audit) | G2 G3 G5 ? | — |
| `/labs/canton` | yes | B | Create · resolve · settle private CBTC markets | *Create market* | **B** | G2 ✓ · G3 ✓ (parties-fetch failure now renders, 21 Oct) · G5 ✓ · G6 ? | 2026-10-21 |
| `/labs/weather` | yes | B | Weather visualisation lab | *(none)* | C (audit) | G2 G3 G5 ? | — |
| `/canton` | **no — redirect** | — | → `/proof?chain=canton` (verified in page.js, 2026-10-21) | — | **B** | — | 2026-10-21 |
| `/canton/holder` | **no — redirect** | — | → `/positions?view=private` (verified in page.js, 2026-10-21 — it is not an orphan, it is a redirect) | — | **B** | — | 2026-10-21 |
| `/agent/[operatorId]` | yes | B | One operator's track record | *(none)* | **A** | G2 G3 G5 ? | — |
| `/weather` | **no — redirect** | — | → `/labs/weather` | — | — | — | — |
| `/autopilot` | **no — redirect** | — | → `/labs/autopilot` | — | — | — | — |
| `/world-cup` | **no — redirect** | — | → `/proof` | — | — | — | — |
| `/agent` | **no — redirect** | — | → `/arena?lane=mandate` | — | — | — | — |
| `/notifications` | **no — redirect** | — | → `/signals?tab=alerts` | — | — | — | — |

**16 routes render. 5 are redirect stubs.** The "21 routes" count in the plan counts files, not
surfaces — five of those files never reach a user.

## Findings already banked (21 Oct, first pass)

These were real and verified when written; items 2 and 3 are fixed, the rest are the work list.

1. **Five redirect stubs still have full page bodies.** `/weather`, `/autopilot`, `/world-cup`,
   `/agent` and `/notifications` each have a `page.js` *and* a redirect in `next.config.mjs`.
   The page is unreachable, so it is dead code that costs a route's worth of maintenance and
   still passes the runtime check. **Decision needed:** delete the page, or drop the redirect.
   (The `app/weather/page.js` body is already a `router.replace('/labs/weather')` — a redirect
   inside a redirect.)
2. **The footer carried a second, contradicting link set.** ~~It links to `/agent` and
   `/notifications` (both redirects) and **omits Arena**, which is a primary destination.~~
   **fixed 21 Oct (A)**: the footer reads Markets · Positions · Arena · Private · Signals ·
   Agent · Labs · Status, which is `PRIMARY_NAV` then `OVERFLOW_NAV` then Status, and the Agent
   link goes to the mandate lane instead of the `/agent` redirect. It does not *derive* from the
   exported arrays — `PRIMARY_NAV` lives in a client module and `app/layout.js` is the server
   root, so importing it there would turn the layout into a client component. The two lists are
   now the same list; a third one is still possible.
3. **G1 debt: 70 raw colour literals across 14 DOM files** (baseline:
   `scripts/design-tokens-baseline.json`, and `--enforce` is in CI as of 21 Oct). Worst offenders:
   `BackdropProvider.js` (30 — it
   re-declares the semantic palette as rgba() instead of reading the tokens it is supposed to
   *be*),
   `WalletLayer.js` (5), `ProofTheatre.js` (5), `PersonalStatsDashboard.js` (5),
   `ForecastPortals.js` (4), `HistoricalLabPanel.js` (4).
   ~~`CalibrationCurve.jsx` (12 — and it spends emerald, which this system reserves for
   *verified*, on a probability bucket)~~ — **fixed 21 Oct (A)**: the buckets now take
   `evidence` / `sealed` / `review` by name and all 12 literals are banked out of the baseline.
   `app/api/og`, `components/canvasui`, `components/weather3d` and the three canvas/3D
   renderers are **excluded on purpose** — they paint pixels, where a CSS custom property
   does not exist.
4. **`/arena` shows the calibration curve in both lanes** (Ledger and Mandate). Defensible —
   different lanes, different jobs — but it is the one place G2 ("one job per section") is
   arguable, and the two instances will drift.
5. **`/canton/holder` is an orphan** — zero inbound links, and its only mention in the codebase
   is a comment saying the flow is "CIP-0103 when available". Either link it from `/canton` or
   let it be a documented dead route.
6. **G7 is the gate with no owner yet.** The memory lane, the paid rail and the plain-language
   credibility strip are all G7 work: making a non-operator able to say what the surface is
   for in ten seconds. A is closest to the memory lane, C to the paid rail, and the credibility
   strip is unassigned.

## Mechanical audit — 21 Oct 2026 (`tests/surfaceContract.test.jsx`)

Every route that renders was mounted in jsdom inside the app's own Providers, with the app's own
router semantics (`redirect()` and `notFound()` throw, as in Next), and driven through three
states: **empty**, **error**, **loading**. The check that matters is behavioural, not textual:
*if the request failed, can a reader tell it apart from "there is nothing here"?* A surface whose
error render is byte-identical to its empty render fails G3.

The ratchet lives in `tests/surfaceContract.test.jsx` — `BUDGET` holds each surface's remaining
allowance, and the suite fails when a number goes UP. Fix a finding and lower its budget in the
same commit.

| Route | G2 one `h1` | G3 states | G5 names | Finding |
|---|---|---|---|---|
| `/` | ✓ | ~~✗~~ ✓ fixed | ✓ | failure was indistinguishable from empty — **fixed 21 Oct (A)** |
| `/arena` | ✓ | ✓ | ✓ | — |
| `/signals` | ✓ | ✓ | ✓ | — |
| `/signal/[id]` | — | — | — | not a data surface (server read; a missing signal correctly 404s) |
| `/positions` | ✓ | ~~✗~~ ✓ fixed | ✓ | failure was indistinguishable from empty — **fixed 21 Oct (A)** |
| `/markets` | ✓ | ~~✗~~ ✓ fixed | ✓ | failure was indistinguishable from empty — **fixed 21 Oct (A)** |
| `/proof` | ✓ | ✓ | ✓ | — |
| `/status` | ✓ | ✓ | ✓ | — |
| `/labs` | ✓ | n/a | ✓ | not a data surface (a directory, no fetch of its own) |
| `/labs/autopilot` | ✓ | ✓ | ✓ | — |
| `/labs/builder` | ✓ | n/a | ✓ | not a data surface |
| `/labs/canton` | ✓ | ~~✗~~ ✓ fixed | ✓ | failure was indistinguishable from empty — **fixed 21 Oct (B)** |
| `/labs/weather` | — | — | — | not mountable (three.js, no WebGL in jsdom) |
| `/canton` | — | — | — | redirect → `/proof?chain=canton` |
| `/canton/holder` | — | — | — | redirect → `/positions?view=private` |
| `/agent` | ✓ | ✓ | ✓ | — |
| `/agent/[operatorId]` | ✓ | n/a | ✓ | not a data surface (server read from the DB) |

**The four G3 findings, and what each one actually was.** In each case the surface rendered the
same text when its own request failed as when it succeeded with nothing in it, so a reader could
not tell "it failed" from "there is nothing here yet". All four are closed; `BUDGET` is 0 for
every mountable route, so the next one of these fails CI.

| Route | Where | What it was, and the fix |
|---|---|---|
| `/` | `components/AgentRail.js` (the landing's feed) | **fixed 21 Oct (A)** — the request had no error state at all (`.catch(() => {})`), so a dead feed read "no agent cycle recorded yet". It now names why it could not read the feed, in `role="alert"`. |
| `/positions` | `components/PositionsDashboard.js` | **fixed 21 Oct (A)** — the failure existed in state but was printed bare; it now says "Could not load positions — …" with `role="alert"`. |
| `/markets` | `app/markets/SportsTab.js`, `app/markets/DiscoveryTab.js` | **fixed 21 Oct (A)** — a failed first fetch left `markets === null`, so `isLoading \|\| !markets` rendered the skeleton forever and the error branch was unreachable. The list now renders the failure with a Retry, and an empty result stopped travelling down the error channel. |
| `/labs/canton` | `CantonSettlementHub.js` parties fetch | **fixed 21 Oct (B)** — the catch now calls `setError`, and the failure renders in the breach banner |

The pattern, in one line of JSX and one line of state:

```jsx
const [error, setError] = useState(null);
// …on failure:
setError(err.message || 'The request failed');
// …in the render, next to the empty state:
{error && (
  <p role="alert" className="text-[12px] text-[var(--color-breach)]">
    Could not load markets — {error}
  </p>
)}
```

The rule it comes from: **an absent value is `—`/NA/a stated reason, never a confident zero**
(SURFACES.md §4). A swallowed failure is the same lie in a different shape.

**What is still not checked mechanically:** G4 (evidence one tap — a review gate), G6 (one primary
CTA — a review gate), G7 (story legibility — a review gate, spine only). The registry rows carry
those. G1 is a ratchet, not a review: `scripts/check-design-tokens.mjs --enforce` is in CI, so raw
colour cannot go up and a new file cannot bring raw colour in. `check:surfaces` and `check:runtimes`
run in the same job — a registry row that stops matching the app now fails the build instead of
waiting for someone to notice.

## The audit procedure (20 minutes per route)

1. Open the route. Screenshot the first viewport and one scrolled viewport.
2. Walk G1–G7 against the row. For G3, force the three states: throttle the network to see
   loading, point the API at an empty result, and point it at an error.
3. For G4, expand every row on the surface. If a claim does not open into its receipt, it is
   a finding.
4. Write the date in this table. Fix what you find in the same session — an audit that defers
   its fixes is a second pass nobody makes.


---

## Design contract — the rules a surface cannot break

Twenty lines, not a style guide. `tokens.css` and `design.md` hold the system;
this file holds the invariants the quality bar enforces (see
`EXECUTION_PLAN.md` → Surface quality bar). A new surface is built to this
once, not retrofitted.

1. **Colour by name, never literal.** No `#hex`, `rgb()`, or `hsl()` in
   `components/` or `app/`. Semantic tokens only: `ink`/`ink-muted`/`ink-faint`,
   `rule`/`rule-strong`, `accent`, `evidence`, `breach`, `sealed`, `paper-*`.
   Emerald means *verified* — do not spend it on decoration.
2. **Zero radius.** Sharp corners everywhere. No `rounded` unless the token
   provides it (status pills are the documented exception).
3. **Mono for evidence.** Numbers that are claims — sizes, latencies, hashes,
   hit rates, blob/object ids — render in `--font-mono`. Prose does not.
4. **`NA` over `0`.** An absent value is `—`/`NA`/a stated reason, never a
   confident zero, an empty string dressed as a status, or a guessed name.
5. **Three states, always.** Every data surface renders loading, empty and
   error — and the empty state says *why* it is empty.
6. **`verified: true` means a real Merkle root.** Nothing else earns the word.
7. **One job per section, one `<h1>` per route, one primary CTA** — verb-led,
   square, emerald.
8. **Evidence is one tap.** Every claim row expands to its receipt, hash, or
   raw ledger. A claim you cannot expand is a claim you cannot audit.
9. **The floor:** `:focus-visible` on every control, accessible names,
   reduced motion honoured, AA contrast on body text.
