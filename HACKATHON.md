# HACKATHON.md — NEAR HACKATHON (Nov 1–14, 2026)

> Project: **Fourcast — Autonomous Prediction-Market Operator**
> Tracks to list: **`defi`** (Unstoppable DeFi), **`agents`** (Agent Economy), **`security`** (AI Security & Defense). One submission. Do not build extra features for the extra tracks.
> Repo: https://github.com/thisyearnofear/fourcast
> Live: https://fourcastapp.vercel.app
> Official instructions, re-read 2026-11-12: https://nearhackathon.com/HACKATHON.md

## 0. Where we are (2026-11-12)

About 66 hours remain. Measured 2026-11-12, read-only:

- Mandate is live. Cap $1,000, liquidity floor $500, slippage ≤ 300 bps, cooldown 60s, `approved_code_hash` unset, `last_trade_ns` 0. No `request_signature` has landed. [Contract](https://testnet.nearblocks.io/address/inexpensive-mother.testnet). Same numbers from `GET /api/near/mandate`.
- Contract account holds about 10 NEAR. The owner key is not in local `.env` / `.env.local`, and not in the worker's `.env.agent` on `nuncio-vultr`. `fourcast-agent` is online and dry-run.
- Derived Polygon account `0x6940B97505567816A75B1A952f234630af81c61F` holds 0 POL and 0 USDC.e.
- Repo is already public. Canonical fixture `18175981` verifies, and its `nearCommitment` is `not-anchored`.
- `node_modules` is not installed on this machine, so the local scripts cannot run until `npm ci`.

Do these in order. Stop at the first one that needs a human:

1. **One falsifiable on-chain moment.** Prefer `node scripts/near-first-order.mjs` (a real `request_signature`) if the derived EOA is funded. If it is not, ship the refusal receipts from `scripts/near-mandate-gates.mjs` plus one anchored receipt. Do not open a new venue.
2. **Keep the hosted demo up through 18 Nov, ideally 25 Nov.** A local-only demo is allowed only with a public repo, a reproducible README, and an X video. Screenshots are not enough when a judge cannot open the demo. Claude and Codex screen reproducibility before the human jury; a low machine score alone cannot reject the entry.
3. **Human publishes the X post.** It must say the project was built at NEAR HACKATHON, tag `@NEARProtocol` and `#NEARHackathon` (optionally `@NearLegion` and `@NearBuilders`), and attach a video. Draft the text here; do not post it.
4. **Human confirms the payload, then submit once** to `POST https://nearhackathon.com/api/applications` or https://nearhackathon.com/#apply. There is no earlier sign-up. A second POST of the same repo is a 409. Fixes go to https://nearhackathon.com/request-changes.
5. **Disclose the baseline.** Code from the 19 Oct 2026 announcement through 14 Nov is in-window. Everything older is baseline. An existing product on another chain is allowed; only the NEAR work is judged (official Q-001, Q-002).

Human-only fields, never invented: project name (2–80), lead name, email, size (`1` | `2 - 4` | `4 - 6` | `6 - 8` | `8+`), mainnet payout account, public repo URL, demo post URL, idea (20–2000), and consent to: "I agree that the organizers may use these details to review our submission and contact us about this hackathon."

## 1. Event essentials
- Build window: **2026-11-01T00:00:00Z → 2026-11-14T23:59:00Z**.
- Judging starts **2026-11-16T00:00:00Z**. Results by **2026-11-18T23:59:00Z**.
- Prize pool **$250,000** in NEAR, single payment, no vesting, within 30 days of results: grand prize $55,000, then $10,000 / $3,000 / $2,000 for 1st / 2nd / 3rd in each of 13 tracks.
- Hints (Intents, Chain Signatures) are hints. An own NEAR contract that fits the track is enough (Q-011). Testnet-only entries are eligible (Q-010). Intents has no testnet (Q-007).
- 1Click JWT is optional. The official note (Q-006, read 2026-11-12) says quotes without it add a **0.2%** fee and points at https://partners.near-intents.org. Our 2026-11-02 live probe recorded **0.25%**. Quote the live response in the demo.

## 2. Why Fourcast is a strong NEAR candidate
Fourcast is a venue-agnostic autonomous agent for prediction markets. It discovers edge, sizes positions under a policy-bound mandate, executes across multiple venues, and produces verifiable decision receipts that prove mandate adherence before outcomes resolve.

The NEAR story is direct: **an autonomous trading agent moves value across chains and commits verifiable decision receipts.** The same mandate contract is why `security` is listed as well as `defi` and `agents`: the track hint is spending limits and policy engines, which we already enforce on-chain. Listing the track is not a new build.

## 3. NEAR tools we will use (name these in README)
- **NEAR Intents** — move value across chains into positions.
- **Chain Signatures** — agent signs transactions across chains without holding a root key.
- **Sub-accounts + function-call keys** — scoped agent treasury and execution permissions.
- **NEAR AI Cloud** — optional: signal/edge reasoning or agent decisioning.
- **1-Click Swap SDK** — optional: asset conversion for treasury/positions.

## 4. Minimum viable win (2 weeks)
Scope to **one market, one trade, one receipt verification**.

1. Agent detects edge and shows policy-bound mandate.
2. Agent moves value via NEAR Intent.
3. Agent commits decision receipt (hash on NEAR).
4. Outcome resolves.
5. Receipt reconciles against independently verifiable data.
6. Mandate adherence is shown.

Out of scope for the hackathon: full multi-venue parity, all asset classes, production allocator flows.

## 5. Integration plan

### Week 1 — NEAR rail
- Add NEAR account/config for agent treasury.
- Implement NEAR Intent movement for one demo trade.
- Anchor decision receipt hash on NEAR.
- Keep existing venues as context; do not port all of them.

### Week 2 — demo + submission
- Polish one end-to-end trade + receipt verification.
- Add “do X, see Y” README steps.
- Record 60–90s X demo video.
- Publish repo + X post.
- Submit form.

## 6. Demo script (do X, see Y)
1. Agent detects edge → see mandate and policy gates.
2. Agent moves value via NEAR Intent → see transaction.
3. Agent commits receipt → see receipt hash on NEAR.
4. Outcome resolves → see reconciliation + mandate adherence.

## 7. Risks and fallbacks
- **Risk:** multi-venue complexity slows NEAR integration.  
  **Fallback:** simulate/record one successful NEAR Intent trade and anchor receipts; keep existing venue as comparison.
- **Risk:** decision receipt verification is complex.  
  **Fallback:** show receipt hash anchoring + reconciliation against cached outcome data.

## 7.1 Draft post (human publishes, after the tx exists)

Do not post this while `last_trade_ns` is still 0. Replace `TX` with the nearblocks link from the refusal or the live order.

```
Prediction-market agents claim discipline. Fourcast puts the mandate on NEAR, so an out-of-policy trade never gets a signature.

The agent account on Polygon has no private key. It is derived from inexpensive-mother.testnet via chain signatures. The contract checks venue, size, liquidity, slippage, and cooldown before it asks the MPC to sign.

Built at NEAR HACKATHON. Watch the refusal, then check the contract yourself.

TX
https://testnet.nearblocks.io/address/inexpensive-mother.testnet
https://github.com/thisyearnofear/fourcast

@NEARProtocol #NEARHackathon
```

Idea text for the form, once you confirm the other fields:

```
Fourcast is an autonomous prediction-market operator. The problem is that agents claim they followed their risk mandate, and nobody can check until the trade is already done. We deployed that mandate as a NEAR contract. It allows only listed venues, a notional cap, a liquidity floor, a slippage limit, and a cooldown. The trading account on Polygon is derived with chain signatures, so no venue private key exists. Out-of-policy requests are refused on-chain before the MPC signs. Decision receipts are anchored on NEAR and reconciled against an independent outcome. NEAR is the policy and the signer, not a logo.
```

## 8. Submission checklist
- [ ] One on-chain moment a stranger can open: live `request_signature`, or refusal receipts plus an anchored receipt
- [ ] Repo public by 2026-11-14T23:59:00Z, with baseline vs in-window NEAR work named in the README
- [ ] README “do X, see Y” still runs with no secrets (AI screen reads this)
- [ ] Hosted demo left up through 18 Nov (ideally 25 Nov)
- [ ] Human posts the X demo: “built at NEAR HACKATHON”, `@NEARProtocol`, `#NEARHackathon`, video attached
- [ ] Payout account is a real mainnet NEAR account the human already controls
- [ ] Payload printed and confirmed, then sent **once**. `requestId` is a UUID, reused on retry, never committed
- [ ] Tracks on that one payload: `defi`, `agents`, `security`

## 9. Related docs
- Architecture: `docs/ARCHITECTURE.md`
- Setup: `docs/SETUP.md`
- NEAR integration details: `docs/NEAR_HACKATHON.md`
- Hackathon history: `docs/HACKATHONS.md`
