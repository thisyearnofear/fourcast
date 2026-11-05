# HACKATHON.md — NEAR HACKATHON (Nov 1–14, 2026)

> Project: **Fourcast — Autonomous Prediction-Market Operator**
> Track: **Unstoppable DeFi** (secondary: **Agent Economy**)
> Repo: https://github.com/thisyearnofear/fourcast
> Live: https://fourcastapp.vercel.app

## 1. Event essentials
- Build window: **Nov 1 00:00 UTC → Nov 14 23:59 UTC, 2026**.
- Judging: Nov 16–18; results by Nov 18 23:59 UTC.
- Submission requires: public repo + public demo post on X (video/screenshots), plus form with project name, description (20–2000 chars), team lead/email/size, preferred track, NEAR account address for payout, repo link, demo link.
- One submission per team; cannot be edited after sending.
- README must make it easy for judges to run the prototype with “do X, see Y” steps.

## 2. Why Fourcast is a strong NEAR candidate
Fourcast is a venue-agnostic autonomous agent for prediction markets. It discovers edge, sizes positions under a policy-bound mandate, executes across multiple venues, and produces verifiable decision receipts that prove mandate adherence before outcomes resolve.

The NEAR story is direct: **an autonomous trading agent moves value across chains and commits verifiable decision receipts.**

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

## 8. Submission checklist
- [ ] Repo public by Nov 14 23:59 UTC
- [ ] X demo post with video/screenshots and “built for NEAR HACKATHON”
- [ ] README has setup + “do X, see Y” steps
- [ ] HACKATHON.md present
- [ ] NEAR account address for prize payout
- [ ] Form submitted once, details double-checked

## 9. Related docs
- Architecture: `docs/ARCHITECTURE.md`
- Setup: `docs/SETUP.md`
- NEAR integration details: `docs/NEAR_HACKATHON.md`
- Hackathon history: `docs/HACKATHONS.md`
