# Canton Wallet & Settlement UX Roadmap

> **Current status (2026-08):** DevNet prototype. The holder dashboard
> (`/canton/holder`) supports private queries and a **holder-signed settlement
> lane**: `/api/canton/settle/prepare` assembles an unsigned `SettleAsHolder`
> payload and `useCantonHolderWallet.settleAsHolder` signs it with the holder's
> own key. The real BitSafe CBTC lifecycle is verified on DevNet; mainnet is
> not deployed. Remaining product work is holder-signed position creation and
> an independent attester integration. The current DevNet resolver defaults to
> operator self-attestation, and the server-side ledger client remains the
> fallback judge-demo path.

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
- [x] `components/CantonHolderDashboard.js` — wallet connect, private position queries, dispute flow, **"Settle with my wallet" sovereignty lane**
- [x] `hooks/useCantonHolderWallet.js` — Console Wallet connection + contract queries + dispute + `settleAsHolder`
- [x] Connected party sees only contracts they are a signatory/observer on
- [x] Holder-signed `SettleAsHolder`: `services/cantonLedgerClient.prepareSettleSubmission()` builds the exact payload; `POST /api/canton/settle/prepare` serves it unsigned; wallet signs and submits via `prepareExecuteAndWait`
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

### Status: Delivered and verified on DevNet

The v2 contract model and real BitSafe CBTC lifecycle are complete on Canton
DevNet. The recorded lifecycle is `scripts/canton-bitsafe-lifecycle.mjs`, with
captured evidence in `public/proof/canton-receipts.json` (2026-08-04). It uses
real BitSafe CBTC holdings, CIP-56 allocations, and holder-side
`SettleAsHolder`; it is not merely the Fourcast reference-registry flow.

Remaining production work is not a second BitSafe qualification pass. It is:

1. integrate an independent attester instead of the current operator
   self-attestation default;
2. complete holder-signed position creation, rather than only holder-signed
   settlement; and
3. establish the target-network registry, wallet, permissions, and operational
   runbook before any mainnet deployment.

### Scope
- Keep the DevNet BitSafe lifecycle reproducible as a regression/operational check.
- Retain the server-side operator lane only as a judge/demo fallback; it is not the intended production holder-authority model.
- Do not claim mainnet deployment, independent oracle resolution, or cETH registry integration until each has separate evidence.

### Acceptance criteria
- The DevNet BitSafe lifecycle continues to pass with real CBTC and recorded evidence.
- A market cannot resolve without an attestation from its designated attester.
- A holder can sign settlement with their own wallet; holder-signed position creation and independent attester operation remain tracked production work.

### Risks & mitigations
- **Risk:** Target-network token registries, package versions, and party permissions differ from DevNet. **Mitigation:** obtain the production registry configuration and rerun the complete lifecycle before enabling real assets.
- **Risk:** The current self-attested DevNet resolver is mistaken for independent oracle operation. **Mitigation:** state this distinction explicitly in product and partner material; require a distinct attester party for production.

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
| 1 | Independent attester integration | Medium | Medium | Critical |
| ~~2~~ | ~~Complete external holder signing~~ — **DELIVERED for settlement** (`SettleAsHolder` via `/api/canton/settle/prepare` + dashboard). Position *creation* signing remains open (Phase 1) | Medium | Medium | High |
| 3 | Mainnet / production registry deployment | High | High | Medium |
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
