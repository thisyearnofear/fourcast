# Canton Wallet & Settlement UX Roadmap

> Status: DevNet prototype. The holder dashboard (`/canton/holder`) has
> Console Wallet connection and private queries, but external holder signing
> and self-service position creation are incomplete. The operator server-side
> ledger client remains the primary judge-demo path.

---

## Goals

1. Move from a **server-only operator model** to a **true multi-party Canton dApp** where end users connect their own wallets.
2. Use the v2 atomic allocation flow so the demo does not rely on manual payout transfers.
3. Improve security of operator authentication without risking the live demo.

---

## Phase 1: Prototype Console Wallet connect (CIP-0103 dApp SDK)

**Why first:** highest impact, lowest risk, additive to existing operator hub.

### Status: Partially implemented
- [x] Holder / Trader view at `/canton/holder` (was `/canton/trader` in the original plan)
- [x] `components/CantonHolderDashboard.js` — wallet connect, private position queries, dispute flow
- [x] `hooks/useCantonHolderWallet.js` — Console Wallet connection + contract queries + dispute
- [x] Connected party sees only contracts they are a signatory/observer on
- [ ] "Take position" form (YES/NO, stake, asset) — currently the operator creates positions on behalf of holders
- [ ] `POST /api/canton/positions` (holder takes a position) — not yet wired
- [ ] Update `components/CantonMarkets.js` CTA to route to `/canton/holder`

### Scope (remaining)
- Leave `CantonSettlementHub` (operator view) unchanged.
- Add a new **Holder / Trader** view (e.g., `/canton/trader`) that uses the Console Wallet browser extension.
- Integrate the Canton dApp SDK (`@canton-network/wallet-adapter`) for:
  - Wallet discovery
  - Connect / disconnect
  - Querying active contracts as the signed-in party
  - Signing `Create` and `Exercise` commands

### Implementation steps
1. Add `@canton-network/wallet-adapter` (or current equivalent) to dependencies.
2. Create `app/canton/trader/page.js` as a new route.
3. Build `components/CantonTraderHub.js`:
   - Wallet connect button with party/address display
   - List of markets the holder can participate in
   - “Take position” form (YES/NO, stake, asset)
   - “Settle position” button after market resolution
4. Add API routes where needed:
   - `POST /api/canton/positions` (holder takes a position)
   - Reuse `/api/canton/markets` for read-only market discovery
5. Update `components/CantonMarkets.js` CTA to route to `/canton/trader`.

### Acceptance criteria
- A user with the Console Wallet extension can connect.
- Connected party sees only contracts they are a signatory/observer on.
- Taking a position creates a `PredictionPosition` on Canton Devnet visible to the holder and operator, but not to a non-signatory.

### Risks & mitigations
- **Risk:** dApp SDK may not support Devnet party creation. **Mitigation:** pre-seed known parties (Alice/Bob) and allow wallet to act as them.
- **Risk:** Browser extension required. **Mitigation:** keep the server-side operator flow as fallback for judges without Console Wallet.

---

## Phase 2: Automate CIP-56 settlement

**Why second:** high demo impact, but touches Daml contracts and working settlement logic.

### Status: **Daml layer and DevNet reference-registry flow delivered (v2.0.0)**

The contract rework is done and verified — see `docs/CANTON_ATOMIC_SETTLEMENT.md`
and `canton/daml/Fourcast/PredictionPosition.daml`. Instead of automating a
post-hoc transfer, v2 eliminated the obligation entirely: stakes are locked as
CIP-56 allocations at position entry, and `Settle`/`SettleAsHolder` execute /
cancel the escrow legs inside the settlement transaction itself. 7/7 Daml
Scripts pass (`dpm test` in `canton/`, SDK 3.5.2).

The remaining production work is registry-specific integration and evidence
capture; the reference-registry lifecycle is already wired and tested.

### Scope
- Verify the same flow against BitSafe's real CBTC registry and instrument.
- Keep the manual Console Wallet fallback only for operational recovery, not as the product settlement path.

### Implementation steps
1. Add the CIP-56 token DAR to the Daml project in `canton/daml/`.
2. Extend the `PredictionPosition` Daml model so that `Settle` exercises a token transfer choice.
3. Update `services/cantonLedgerClient.js::settlePosition()` to submit the transfer command.
4. Capture transaction IDs and before/after balances for the real BitSafe registry run.

### Acceptance criteria
- A resolved reference-registry market can be settled with one command.
- Escrow legs execute or cancel atomically and no obligation remains.
- The real BitSafe CBTC registry flow is separately verified before claiming CBTC integration.

### Risks & mitigations
- **Risk:** Token transfer DAR may require different party permissions. **Mitigation:** test on Canton Devnet with pre-funded parties before touching main code.
- **Risk:** Could break the existing settlement UI. **Mitigation:** keep the current settle route as `/api/canton/settle-legacy` until the new flow is verified.

---

## Phase 3: Refactor operator auth to OAuth / Wallet Gateway

**Why third:** important for production security but low hackathon ROI and high risk.

### Scope
- Replace the server-side OIDC password grant in `services/cantonLedgerClient.js` with a short-lived OAuth flow via a Wallet Gateway.
- Operator credentials should no longer be stored as environment variables accessible to the app runtime.

### Implementation steps
1. Register the app with the NODERS Wallet Gateway / OAuth provider.
2. Replace `getToken()` with an OAuth2 authorization-code or client-credentials flow.
3. Store tokens in a short-lived cache and refresh as needed.
4. Rotate and remove `CANTON_OIDC_PASSWORD` from Vercel env vars once the Gateway flow works.

### Acceptance criteria
- No plaintext passwords in environment variables.
- Server can still authenticate and submit operator commands.

### Risks & mitigations
- **Risk:** High chance of breaking the live demo during the refactor. **Mitigation:** do this only after the hackathon, or run it on a separate preview branch with a full end-to-end test.

---

## Recommended order

| Order | Phase | Effort | Risk | Hackathon Value |
|-------|-------|--------|------|-----------------|
| 1 | Verify BitSafe CBTC registry swap | Medium | Medium | Critical |
| 2 | Complete external holder signing | Medium | Medium | High |
| 3 | Independent attestation | Low | Low | Medium |
| 4 | OAuth/Wallet Gateway auth | Medium | High | Low |

---

## Open questions

- Does the current Canton Devnet support Console Wallet extension connections, or do we need a specific NODERS Devnet wallet build?
- Are CIP-56 token DARs available for the HackCanton Devnet, or do we need to request them?
- Should the trader view be public (`/canton/trader`) or gated behind the feature flag (`NEXT_PUBLIC_CANTON_ENABLED`)?

---

## Files likely to change by phase

- **Phase 1:** `app/canton/trader/page.js`, `components/CantonTraderHub.js`, `app/api/canton/positions/route.js`, `components/CantonMarkets.js`
- **Phase 2:** `canton/daml/Fourcast/`, `services/cantonLedgerClient.js`, `components/CantonSettlementHub.js`, `app/api/canton/settle/route.js`
- **Phase 3:** `services/cantonLedgerClient.js`, `.env.local.example`, Vercel env vars
