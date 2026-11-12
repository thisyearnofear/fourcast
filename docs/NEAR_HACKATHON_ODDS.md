# NEAR hackathon — what past winners teach, and our odds plan

Compiled 2026-11-05 from NEARCON/1T-Agents/MetaBUILD winner patterns.
Companion to `NEAR_HACKATHON.md` (build plan) and `NEAR_AGENT_ENRICHMENT.md`
(implementation + audit). Deadline: **Nov 14 23:59 UTC**.

## The rubric we are actually scored on

NEARCON 2026 Innovation Sandbox criteria, verbatim:

> Working Demo, NEAR Leverage, Product Clarity, Technical Quality, Future
> Potential — plus "Only on NEAR" recognition for account model, global
> contracts, chain abstraction, off-chain computation, Shade Agents, or
> code-hash attestation.

Earlier events (MetaBUILD III, NEARCON IRL) used the same shape:
Technological Implementation, Design, Potential Impact, Idea Quality,
Sustainability — with judges including Illia, Pagoda dev-rel, and MetaWeb VC
doing **technical due diligence**, not just watching videos.

## What winners did (verified examples)

- **Bitcoin Agent** — 1T Agents 2025: DeFi track winner AND Proximity Labs
  bounty. AI agent doing real Bitcoin L1 transactions via NEAR chain
  signatures + `v1.signer` mainnet MPC. Shipped a *deployed, clickable*
  agent. Pattern: stacked three sponsor primitives in one flow + one live
  transaction.
- **Quex** — NEARCON 2023 devs track: fully autonomous AI treasury. The
  winning pitch was "even we can't move the funds" — the same claim shape
  as our mandate contract. The trust property was *falsifiable*, not
  asserted.
- **Field reality** — 1T Agents: 2,006 participants → 147 submissions.
  Retrospective: winners were "deployable, testable tools," not prototypes.
  Most submissions die in the technical-review screen before judging.

## Our position against the rubric

| Criterion | Where we stand | The gap |
|---|---|---|
| Working Demo | Anchor + verify path live; Intents card shows a real solver quote | No live order through `request_signature` yet — needs funded EOA + POLY_L2 bootstrap |
| NEAR Leverage | mandate contract, chain sigs, Intents, anchored receipts, code-hash gate — matches "Only on NEAR" verbatim | `approved_code_hash` unset → set it even without full TEE |
| Product Clarity | "every prediction deserves a proof trail" is a clean line | demo must not claim gated execution over the Delphi feed (different agent, raw key) |
| Technical Quality | public repo, honest claims, audit trail | README verify-path must let a judge check independently |
| Future Potential | mandate → follow-as-intent, operator self-serve MandateBuilder | state it, don't build it |

## Odds plan — ordered by leverage (Nov 5 → Nov 14)

Single highest-leverage artifact: **one live `request_signature` order with
the nearblocks link in the submission.** It answers Working Demo, NEAR
Leverage, and Technical Quality in one transaction.

### Step 1 — make the live order real (ops, ~half a day)

- [ ] `node scripts/polygon-agent-setup.mjs` — read-only check: derived
      address, POL/USDC.e balances, current approvals (no keys needed).
- [ ] Fund the derived EOA `0x6940…c61F` on Polygon (USDC via Intents
      deposit + dust POL for gas).
- [ ] `node scripts/polygon-agent-setup.mjs --approve` — signs the six
      CLOB approvals via the mandate contract itself, cooldown-aware
      (needs the owner NEAR key in env).
- [ ] `node scripts/near-derive-polycreds.mjs` once → paste `POLY_L2_*`
      into the worker env.
- [ ] Set `NEAR_MANDATE_CONTRACT`, `NEAR_ACCOUNT_ID`, `NEAR_PRIVATE_KEY`,
      `NEAR_INTENTS_RECIPIENT` on the worker env. (Note: `NEAR_ACCOUNT_ID`
      must be the contract owner `inexpensive-mother.testnet`.)
- [ ] `node scripts/near-first-order.mjs` — one order through
      `ChainSignatureSigner`; auto-picks an in-policy market, prints the
      nearblocks link for the `request_signature` tx plus the order id.
      `--dry` runs the market pick + gate pre-check with no keys.
      Cooldown is 60s between signature requests — the script waits it out.

### Step 2 — the falsifiable demo moments (code-light, high signal)

- [ ] **Refusal demo**: `node scripts/near-mandate-gates.mjs --venue|--cap|
      --liquidity|--slippage|--cooldown` — each submits a real out-of-policy
      call and prints the nearblocks failure receipt. A visible on-chain
      refusal beats any narration of "contract-gated."
- [ ] **Anchor demo**: set NEAR keys → run one worker cycle → `⬡ anchored`
      chip on the rail linking a real testnet tx (wire exists since the
      ingest fix).
- [ ] Record `nearTx`/`nearExplorer` on `constants/canonicalReceipt.js`
      once the canonical fixture is anchored → replay shows verified state
      cold (plan item 0.4).
- [ ] `node scripts/near-set-code-hash.mjs` (compute the worker manifest
      hash) then `--set` (owner call) — claims the "code-hash attestation"
      checkbox in "Only on NEAR" without waiting for the full Shade port.
      Do it AFTER code freeze and set `NEAR_WORKER_CODE_HASH` on the
      worker, or every subsequent signature request is refused.

### Step 3 — video + submission hygiene (now: 12–14 Nov)

Re-read of https://nearhackathon.com/HACKATHON.md on 2026-11-12. The
official prize table is the $250k pool only. It does not list a Proximity
or Shade bounty, and the submission body rejects unknown fields (`website`
is an explicit spam trap). Do not spend the remaining window claiming a
bounty that is not on that form.

- [ ] Record the 90s script, hardcode the demo path
      (`FORECAST_REPLAY` + a funded live leg if one exists), freeze code
      ~4h before 2026-11-14T23:59:00Z. The post needs a video. Hosted demo
      stays up through 18 Nov, ideally 25 Nov.
- [x] README verify-path for judges: contract on nearblocks, derived EVM
      address, `/api/txline/verify` link, "check the gates yourself" note.
- [ ] Human posts the video tagging `@NEARProtocol` and `#NEARHackathon`,
      saying it was built at NEAR HACKATHON. Optional: `@NearLegion`,
      `@NearBuilders`. Do not post on their behalf.
- [ ] Idea text (20–2000 chars) names the problem, the product, and the
      concrete NEAR role (mandate contract, chain signatures, Intents).
      One line of future work is enough: mandate → follow-as-intent.

## Cut list (what NOT to spend time on)

- Full Shade TEE port (Phase 4.2) — fallback "local worker, contract-gated"
  is already non-custodial + verifiable; `approved_code_hash` gets most of
  the credit for minutes of work.
- Porting more venues — judges reward one deep flow, not breadth.
- NEP-770 gasless, signals-leaderboard attestations — post-hackathon.
