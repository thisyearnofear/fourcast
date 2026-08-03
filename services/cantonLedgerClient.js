/**
 * Canton Ledger Client v2 — server-side direct JSON Ledger API.
 *
 * v2 speaks to the atomic-settlement contract set (canton-2.0.0, built against
 * the DevNet's vetted CIP-56 interface packages). The command surface changes
 * from IOU bookkeeping (SettlementObligation + manual wallet transfer) to:
 *
 *   market → holder-signed PositionOffer → operator AcceptOffer
 *          → both sides lock CIP-56 allocations (escrow)
 *          → attestation → resolve → Settle/SettleAsHolder executes+cancels
 *            the allocations IN the settlement transaction
 *
 * Env vars required (transport, unchanged from v1):
 *   CANTON_JSON_API_URL, CANTON_OIDC_TOKEN_URL, CANTON_OIDC_CLIENT_ID,
 *   CANTON_OIDC_USERNAME, CANTON_OIDC_PASSWORD, CANTON_OIDC_AUDIENCE,
 *   CANTON_OIDC_SCOPE, CANTON_LEDGER_USER_ID, CANTON_OPERATOR_PARTY_ID,
 *   NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID (the v2 package id after upload)
 * Env vars added in v2:
 *   CANTON_REFERENCE_RULES_CID — TokenRules contract id for the reference
 *     CIP-56 registry (Fourcast.Token); created once by canton-v2-preflight.
 *   CANTON_ATTESTER_PARTY_ID   — designated attester for new markets
 *     (defaults to the operator = devnet self-attestation).
 *   CANTON_IFACE_PKG_*         — overrides for the network CIP-56 interface
 *     package ids (defaults to the DevNet-vetted values from
 *     vendor/network-cip-0056/manifest.json).
 */

import crypto from 'node:crypto';

const LEDGER_API_URL = (process.env.CANTON_JSON_API_URL || '').replace(/\/$/, '');
const TOKEN_URL = process.env.CANTON_OIDC_TOKEN_URL || '';
const CLIENT_ID = process.env.CANTON_OIDC_CLIENT_ID || '';
const USERNAME = process.env.CANTON_OIDC_USERNAME || '';
const PASSWORD = process.env.CANTON_OIDC_PASSWORD || '';
const AUDIENCE = process.env.CANTON_OIDC_AUDIENCE || '';
const SCOPE = process.env.CANTON_OIDC_SCOPE || 'openid daml_ledger_api offline_access';
const LEDGER_USER_ID = process.env.CANTON_LEDGER_USER_ID || '';
const OPERATOR_PARTY_ID = process.env.CANTON_OPERATOR_PARTY_ID || '';
const PACKAGE_ID = process.env.NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID || '';

// v2: designated attester for newly created markets (devnet default: operator,
// i.e. self-attested; point this at an independent oracle party for prod).
const ATTESTER_PARTY_ID = process.env.CANTON_ATTESTER_PARTY_ID || '';

// v2: reference-registry TransactionRules contract (Fourcast.Token) on the
// ledger — the CIP-56 AllocationFactory/Holding implementation for the demo
// instrument. Created once by scripts/canton-v2-preflight.mjs.
const REFERENCE_RULES_CID = process.env.CANTON_REFERENCE_RULES_CID || '';

// Production CBTC (BitSafe) registry swap — config-only, no Daml change.
// When set, allocateLeg targets the BitSafe AllocationFactory (not the
// reference TokenRules) and the instrument carries BitSafe's admin + id.
// Leave unset to keep the reference-registry demo path.
//   CANTON_BTC_REGISTRY_CID     — BitSafe AllocationFactory contract id
//   CANTON_BTC_INSTRUMENT_ADMIN  — BitSafe registry admin party
//   CANTON_BTC_INSTRUMENT_ID     — real CBTC instrument id from BitSafe's registry
const BTC_REGISTRY_CID = process.env.CANTON_BTC_REGISTRY_CID || '';
const BTC_INSTRUMENT_ADMIN = process.env.CANTON_BTC_INSTRUMENT_ADMIN || '';
const BTC_INSTRUMENT_ID = process.env.CANTON_BTC_INSTRUMENT_ID || '';

// Network-vetted CIP-56 interface package ids (vendor/network-cip-0056/manifest.json).
const IFACE_PKG = {
  metadata: process.env.CANTON_IFACE_PKG_METADATA_V1
    || '4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f',
  holding: process.env.CANTON_IFACE_PKG_HOLDING_V1
    || '718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b',
  transferInstruction: process.env.CANTON_IFACE_PKG_TRANSFER_INSTRUCTION_V1
    || '55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281',
  allocation: process.env.CANTON_IFACE_PKG_ALLOCATION_V1
    || '93c942ae2b4c2ba674fb152fe38473c507bda4e82b4e4c5da55a552a9d8cce1d',
  allocationInstruction: process.env.CANTON_IFACE_PKG_ALLOCATION_INSTRUCTION_V1
    || '275064aacfe99cea72ee0c80563936129563776f67415ef9f13e4297eecbc520',
  allocationRequest: process.env.CANTON_IFACE_PKG_ALLOCATION_REQUEST_V1
    || '6fe848530b2404017c4a12874c956ad7d5c8a419ee9b040f96b5c13172d2e193',
};

// Package name (used for query template IDs — Canton v2 expects names, not hashes).
// v2 ships under a NEW lineage: `fourcast` (the legacy `canton` v1 package stays
// resolvable at #canton — see docs/CANTON_V2_DEPLOY.md).
const PACKAGE_NAME = 'fourcast';

let cachedToken = null;
let tokenExpiryMs = 0;

export function isCantonConfigured() {
  return Boolean(LEDGER_API_URL && TOKEN_URL && CLIENT_ID && USERNAME && PASSWORD && AUDIENCE);
}

async function getToken() {
  if (cachedToken && tokenExpiryMs && Date.now() < tokenExpiryMs - 60_000) {
    return cachedToken;
  }

  const params = new URLSearchParams();
  params.set('grant_type', 'password');
  params.set('client_id', CLIENT_ID);
  params.set('username', USERNAME);
  params.set('password', PASSWORD);
  params.set('scope', SCOPE);
  if (AUDIENCE) params.set('audience', AUDIENCE);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Canton OIDC token fetch failed: ${data.error_description || data.error || res.statusText}`);
  }

  cachedToken = data.access_token;
  tokenExpiryMs = Date.now() + (data.expires_in ? data.expires_in * 1000 : 3_600_000);
  return cachedToken;
}

async function ledgerCall(method, path, body) {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  const init = { method, headers };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${LEDGER_API_URL}${path}`, init);
  const parsed = await res.json().catch(() => ({}));

  const isError = !res.ok || (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && ('code' in parsed || 'cause' in parsed));
  if (isError) {
    throw new Error(`Canton Ledger API ${method} ${path} failed: ${parsed.cause || parsed.message || `HTTP ${res.status}`}`);
  }

  return parsed;
}

function commandId() {
  return `fourcast-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function templateId(module, name) {
  if (!PACKAGE_ID) return '';
  return `${PACKAGE_ID}:${module}:${name}`;
}

function queryTemplateId(module, name) {
  return `#${PACKAGE_NAME}:${module}:${name}`;
}

// ── Command submission ──────────────────────────────────────────────────

export async function submitCommands({ actAs, readAs = [], commands, userId }) {
  if (!isCantonConfigured()) {
    throw new Error('Canton ledger not configured — set CANTON_JSON_API_URL and OIDC env vars');
  }
  if (!commands?.length) {
    throw new Error('No commands to submit');
  }

  const body = {
    commands,
    userId: userId || LEDGER_USER_ID,
    commandId: commandId(),
    actAs,
    readAs,
  };

  const result = await ledgerCall('POST', '/v2/commands/submit-and-wait', body);
  return {
    updateId: result.updateId,
    completionOffset: result.completionOffset,
    raw: result,
  };
}

/**
 * Fetch a full transaction by updateId (the deployed JSON API's
 * submit-and-wait returns only {updateId, completionOffset} — no inline tree).
 */
export async function getTransactionById(updateId, requestingParties) {
  const result = await ledgerCall('POST', '/v2/updates/transaction-by-id', {
    updateId,
    requestingParties: requestingParties?.length ? requestingParties : [OPERATOR_PARTY_ID],
  });
  return result?.transaction || result;
}

/**
 * Submit ONE command and return the contract id the flow actually needs.
 * Resolution order: (1) an ExercisedEvent whose exerciseResult is a plain cid
 * string (choices returning ContractId); (2) a token-standard result record
 * (output.allocationCid / output.transferInstructionCid); (3) the LAST
 * CreatedEvent in the transaction (allocation impls create change first, the
 * target contract last); (4) the first CreatedEvent.
 */
async function submitForContractId({ actAs, readAs = [], commands }) {
  const { raw } = await submitCommands({ actAs, readAs, commands });
  const updateId = raw?.updateId;
  if (!updateId) throw new Error(`submission returned no updateId: ${JSON.stringify(raw).slice(0, 300)}`);
  const tx = await getTransactionById(updateId, [...new Set([...actAs, ...readAs, OPERATOR_PARTY_ID])]);
  const events = tx?.events || raw?.transaction?.events || [];

  let lastCreated = null;
  let firstCreated = null;
  for (const ev of events) {
    const exercised = ev.ExercisedEvent || ev.exercisedEvent;
    if (exercised?.exerciseResult !== undefined) {
      const r = exercised.exerciseResult;
      if (typeof r === 'string') return r;
      const cid = r?.output?.allocationCid || r?.output?.transferInstructionCid
        || r?.output?.receiverHoldingCids?.[0];
      if (cid) return cid;
    }
    const created = ev.CreatedEvent || ev.createdEvent;
    if (created?.contractId) {
      if (!firstCreated) firstCreated = created.contractId;
      lastCreated = created.contractId;
    }
  }
  if (lastCreated) return lastCreated;
  throw new Error('no contract id found in submission result');
}

// ── Contract queries ────────────────────────────────────────────────────

export async function queryActiveContracts(partyId, templates = []) {
  if (!isCantonConfigured()) return [];
  if (!partyId) return [];

  const end = await ledgerCall('GET', '/v2/state/ledger-end');
  const activeAtOffset = end.offset ?? 0;

  const cumulative = templates.map((t) => ({
    identifierFilter: {
      TemplateFilter: {
        value: {
          templateId: typeof t === 'string' ? t : queryTemplateId(t.module, t.name),
          includeCreatedEventBlob: false,
        },
      },
    },
  }));

  const eventFormat = {
    filtersByParty: {
      [partyId]: { cumulative },
    },
    verbose: false,
  };

  const result = await ledgerCall('POST', '/v2/state/active-contracts', {
    activeAtOffset,
    eventFormat,
  });

  if (!Array.isArray(result)) return [];

  return result.flatMap((item) => {
    const ev = item.contractEntry?.JsActiveContract?.createdEvent;
    if (!ev) return [];
    return [{
      contractId: ev.contractId,
      templateId: ev.templateId,
      payload: ev.createArgument,
    }];
  });
}

// ── Value helpers (JSON API v2 encodings, same conventions v1 verified) ──

const EMPTY_META = { values: {} };
const NO_EXTRA_ARGS = { context: { values: {} }, meta: { values: {} } };

/** Daml Decimal as a string with at most 10 decimal places, no trailing zeros. */
function dec(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(10).replace(/\.?0+$/, '') || '0';
}

/**
 * Instrument for the settlement asset. Defaults to the reference-registry
 * demo instrument (admin = operator, id = "cBTC"/"cETH"). When BitSafe CBTC
 * envs are set, returns the real BitSafe instrument (admin + id) instead —
 * the Daml code is unchanged, only the instrument identity swaps.
 */
function referenceInstrumentId(settlementAsset, admin) {
  const asset = String(settlementAsset || 'CBTC').toUpperCase() === 'CETH' ? 'CETH' : 'CBTC';
  if (asset === 'CETH') return { admin, id: 'cETH' };
  return { admin: BTC_INSTRUMENT_ADMIN || admin, id: BTC_INSTRUMENT_ID || 'cBTC' };
}

/** True when the BitSafe CBTC registry swap is configured (production path). */
export function isBitSafeConfigured() {
  return Boolean(BTC_REGISTRY_CID && BTC_INSTRUMENT_ADMIN && BTC_INSTRUMENT_ID);
}

/** The AllocationFactory contract id + expected admin to submit against. */
export function registryFactory() {
  const cid = BTC_REGISTRY_CID || REFERENCE_RULES_CID;
  const admin = BTC_INSTRUMENT_ADMIN || OPERATOR_PARTY_ID;
  return { cid, admin, isBitSafe: Boolean(BTC_REGISTRY_CID) };
}

// ── Markets ─────────────────────────────────────────────────────────────

export async function getOpenMarkets(partyId = OPERATOR_PARTY_ID) {
  return queryActiveContracts(partyId, [
    { module: 'Fourcast.PredictionMarket', name: 'PredictionMarket' },
  ]);
}

export async function getMarketResolutions(partyId = OPERATOR_PARTY_ID) {
  return queryActiveContracts(partyId, [
    { module: 'Fourcast.PredictionMarket', name: 'MarketResolution' },
  ]);
}

export async function getAttestations(partyId = OPERATOR_PARTY_ID) {
  return queryActiveContracts(partyId, [
    { module: 'Fourcast.PredictionMarket', name: 'ResolutionAttestation' },
  ]);
}

/**
 * Create a prediction market. The instrument is bound at creation; the demo
 * uses the reference registry (admin = operator). Production cBTC/cETH passes
 * an explicit `instrument: { admin, id }`.
 */
export async function createMarket({ marketId, question, settlementAsset, deadline, instrument, attester }) {
  const now = new Date().toISOString();
  const asset = String(settlementAsset || 'CBTC').toUpperCase() === 'CETH' ? 'CETH' : 'CBTC';
  return submitCommands({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      CreateCommand: {
        templateId: templateId('Fourcast.PredictionMarket', 'PredictionMarket'),
        createArguments: {
          operator: OPERATOR_PARTY_ID,
          marketId: String(marketId || `market-${Date.now()}`),
          question: String(question || ''),
          settlementAsset: asset,
          instrument: instrument || referenceInstrumentId(asset, OPERATOR_PARTY_ID),
          attester: attester || ATTESTER_PARTY_ID || OPERATOR_PARTY_ID,
          createdAt: now,
          deadline: deadline ? new Date(deadline).toISOString()
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    }],
  });
}

/** Issue a resolution attestation (attester action; devnet: operator). */
export async function createAttestation({ marketId, outcome, evidenceHash, evidenceUri }) {
  const attester = ATTESTER_PARTY_ID || OPERATOR_PARTY_ID;
  const result = await submitForContractId({
    actAs: [attester],
    commands: [{
      CreateCommand: {
        templateId: templateId('Fourcast.PredictionMarket', 'ResolutionAttestation'),
        createArguments: {
          attester,
          marketId: String(marketId),
          outcome,
          evidenceHash: String(evidenceHash || ''),
          evidenceUri: String(evidenceUri || ''),
          issuedAt: new Date().toISOString(),
        },
      },
    }],
  });
  return { attestationContractId: result };
}

/** Resolve a market with a signed attestation (operator action). */
export async function resolveMarket(marketContractId, { attestationCid, viewers = [] }) {
  return submitCommands({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: templateId('Fourcast.PredictionMarket', 'PredictionMarket'),
        contractId: marketContractId,
        choice: 'ResolveMarket',
        choiceArgument: { attestationCid, viewers },
      },
    }],
  });
}

/** Void a market (refund scenario). */
export async function voidMarket(marketContractId, { reason, viewers = [] }) {
  return submitCommands({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: templateId('Fourcast.PredictionMarket', 'PredictionMarket'),
        contractId: marketContractId,
        choice: 'VoidMarket',
        choiceArgument: { reason: String(reason || ''), viewers },
      },
    }],
  });
}

// ── Positions (offer / accept consent flow) ─────────────────────────────

export async function getPositionOffers(partyId = OPERATOR_PARTY_ID) {
  return queryActiveContracts(partyId, [
    { module: 'Fourcast.PredictionPosition', name: 'PositionOffer' },
  ]);
}

export async function getOpenPositions(partyId = OPERATOR_PARTY_ID) {
  return queryActiveContracts(partyId, [
    { module: 'Fourcast.PredictionPosition', name: 'PredictionPosition' },
  ]);
}

export async function getSettledPositions(partyId = OPERATOR_PARTY_ID) {
  return queryActiveContracts(partyId, [
    { module: 'Fourcast.PredictionPosition', name: 'PositionSettled' },
  ]);
}

export async function getExpiredPositions(partyId = OPERATOR_PARTY_ID) {
  return queryActiveContracts(partyId, [
    { module: 'Fourcast.PredictionPosition', name: 'PositionExpired' },
  ]);
}

/**
 * Holder-signed position offer — v2 consent primitive.
 * `asParty` is the holder; until external wallet signing lands (roadmap
 * Phase 1), the server submits on the holder party's behalf (the ledger user
 * needs actAs rights over that party).
 */
export async function createPositionOffer({ holder, marketCid, side, stake, oddsMultiplier }) {
  if (!holder) throw new Error('holder party is required for a position offer');
  return submitForContractId({
    actAs: [holder],
    commands: [{
      CreateCommand: {
        templateId: templateId('Fourcast.PredictionPosition', 'PositionOffer'),
        createArguments: {
          holder: holder,
          operator: OPERATOR_PARTY_ID,
          marketCid,
          side,
          stake: dec(stake),
          oddsMultiplier: dec(oddsMultiplier ?? 2),
          proposedAt: new Date().toISOString(),
        },
      },
    }],
  }).then((offerContractId) => ({ offerContractId }));
}

/** Operator accepts a holder's offer → creates the position (both signatories). */
export async function acceptOffer(offerContractId) {
  return submitForContractId({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: templateId('Fourcast.PredictionPosition', 'PositionOffer'),
        contractId: offerContractId,
        choice: 'AcceptOffer',
        choiceArgument: {},
      },
    }],
  }).then((positionContractId) => ({ positionContractId }));
}

/** Operator rejects an offer (nothing was ever locked). */
export async function rejectOffer(offerContractId) {
  return submitCommands({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: templateId('Fourcast.PredictionPosition', 'PositionOffer'),
        contractId: offerContractId,
        choice: 'RejectOffer',
        choiceArgument: {},
      },
    }],
  });
}

// ── Reference registry (Fourcast.Token) — escrow + demo funding ─────────

export function isReferenceRegistryConfigured() {
  return Boolean(REFERENCE_RULES_CID);
}

/** One-time: create the reference registry's TokenRules contract. */
export async function createTokenRules() {
  return submitForContractId({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      CreateCommand: {
        templateId: templateId('Fourcast.Token', 'TokenRules'),
        createArguments: { admin: OPERATOR_PARTY_ID },
      },
    }],
  }).then((rulesCid) => ({ rulesCid }));
}

/** Operator self-mint (devnet payout reserve). */
export async function mintSelf({ amount, instrumentId }) {
  return submitForContractId({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: templateId('Fourcast.Token', 'TokenRules'),
        contractId: REFERENCE_RULES_CID,
        choice: 'Mint',
        choiceArgument: {
          owner: OPERATOR_PARTY_ID,
          amount: dec(amount),
          instrumentId: instrumentId || referenceInstrumentId('CBTC', OPERATOR_PARTY_ID),
        },
      },
    }],
  }).then((tokenCid) => ({ tokenCid }));
}

/** User mint: holder-signed request, admin fulfills. */
export async function requestMint(ownerPartyId) {
  return submitForContractId({
    actAs: [ownerPartyId],
    commands: [{
      CreateCommand: {
        templateId: templateId('Fourcast.Token', 'MintRequest'),
        createArguments: { owner: ownerPartyId, admin: OPERATOR_PARTY_ID },
      },
    }],
  }).then((mintRequestCid) => ({ mintRequestCid }));
}

export async function acceptMint(mintRequestCid, { amount, instrumentId }) {
  return submitForContractId({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: templateId('Fourcast.Token', 'MintRequest'),
        contractId: mintRequestCid,
        choice: 'AcceptMint',
        choiceArgument: {
          amount: dec(amount),
          instrumentId: instrumentId || referenceInstrumentId('CBTC', OPERATOR_PARTY_ID),
        },
      },
    }],
  }).then((tokenCid) => ({ tokenCid }));
}

/** Unlocked reference holdings of a party (Fourcast.Token:Token). */
export async function getHoldings(partyId) {
  return queryActiveContracts(partyId, [
    { module: 'Fourcast.Token', name: 'Token' },
  ]);
}

/** Locked escrow allocations visible to a party (Fourcast.Token:TokenAllocation). */
export async function getAllocations(partyId = OPERATOR_PARTY_ID) {
  return queryActiveContracts(partyId, [
    { module: 'Fourcast.Token', name: 'TokenAllocation' },
  ]);
}

export async function getBalances(partyId) {
  const [holdings, allocations] = await Promise.all([getHoldings(partyId), getAllocations(partyId)]);
  // NB: party visibility ≠ ownership — the registry admin sees everyone's
  // tokens (it's a signatory), so filter by owner/sender explicitly.
  const unlocked = holdings
    .filter((h) => h.payload?.holding?.owner === partyId)
    .reduce((acc, h) => acc + Number(h.payload?.holding?.amount ?? 0), 0);
  const locked = allocations
    .filter((a) => a.payload?.allocation?.transferLeg?.sender === partyId)
    .reduce((acc, a) => acc + Number(a.payload?.allocation?.transferLeg?.amount ?? 0), 0);
  return { partyId, unlocked, locked, holdings, allocations };
}

// ── Escrow: fund a position's allocation legs ───────────────────────────

/**
 * Build the exact AllocationSpecification a position expects for a leg.
 * Must match the Daml-computed spec byte-for-byte (Settle validates equality).
 */
export function allocationSpecFor(pos, legId) {
  const stake = Number(pos.stake);
  const mult = Number(pos.oddsMultiplier ?? 2);
  const transferLeg = legId === 'stake'
    ? { sender: pos.holder, receiver: pos.operator, amount: dec(stake), instrumentId: pos.instrument, meta: EMPTY_META }
    : { sender: pos.operator, receiver: pos.holder, amount: dec(stake * (mult - 1)), instrumentId: pos.instrument, meta: EMPTY_META };
  return {
    settlement: {
      executor: pos.operator,
      settlementRef: { id: `position:${pos.marketId}`, cid: pos.offerCid },
      requestedAt: pos.createdAt,
      allocateBefore: pos.allocateBefore,
      settleBefore: pos.settleBefore,
      meta: EMPTY_META,
    },
    transferLegId: legId,
    transferLeg,
  };
}

/**
 * Lock one side of a position's escrow via the registry's CIP-56
 * AllocationFactory (the wallet-funding step). `senderPartyId` must hold
 * unlocked holdings of the leg's instrument.
 */
export async function allocateLeg(positionPayload, legId, senderPartyId) {
  const factory = registryFactory();
  if (!factory.cid) {
    throw new Error('registry not configured — set CANTON_BTC_REGISTRY_CID (BitSafe) or CANTON_REFERENCE_RULES_CID (reference, run canton-v2-preflight)');
  }
  const spec = allocationSpecFor(positionPayload, legId);
  const holdings = await getHoldings(senderPartyId);
  const inputHoldingCids = holdings
    .filter((h) => h.payload?.holding?.owner === senderPartyId)
    .map((h) => h.contractId);

  return submitForContractId({
    // readAs operator: the registry factory contract is disclosed through the
    // operator party (mirrors production registry discovery).
    actAs: [senderPartyId],
    readAs: senderPartyId === OPERATOR_PARTY_ID ? [] : [OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: `${IFACE_PKG.allocationInstruction}:Splice.Api.Token.AllocationInstructionV1:AllocationFactory`,
        contractId: factory.cid,
        choice: 'AllocationFactory_Allocate',
        choiceArgument: {
          expectedAdmin: factory.admin,
          allocation: spec,
          requestedAt: new Date().toISOString(),
          inputHoldingCids,
          extraArgs: NO_EXTRA_ARGS,
        },
      },
    }],
  }).then((allocationCid) => ({ allocationCid, spec }));
}

/**
 * Fetch a position payload and return the two escrow allocation contract ids
 * already on-ledger for it (matched by settlementRef + leg id). Operator view
 * sees all reference-registry allocations.
 */
export async function findPositionAllocations(positionPayload) {
  const allocations = await getAllocations(OPERATOR_PARTY_ID);
  const matchLeg = (legId) => allocations.find((a) => {
    const alloc = a.payload?.allocation;
    return alloc?.transferLegId === legId
      && alloc?.settlement?.settlementRef?.cid === positionPayload.offerCid
      && String(alloc?.transferLeg?.instrumentId?.id) === String(positionPayload.instrument?.id);
  });
  return {
    stakeAllocationCid: matchLeg('stake')?.contractId || null,
    payoutAllocationCid: matchLeg('payout')?.contractId || null,
  };
}

// ── Escrow withdrawal helpers (cleanup of unfunded positions) ────────────

/** Withdraw (archive) a position's AllocationRequest — aborts an unfunded
 *  position. Operator (settlement executor) controlled. */
export async function withdrawAllocationRequest(positionContractId) {
  return submitCommands({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: `${IFACE_PKG.allocationRequest}:Splice.Api.Token.AllocationRequestV1:AllocationRequest`,
        contractId: positionContractId,
        choice: 'AllocationRequest_Withdraw',
        choiceArgument: { extraArgs: NO_EXTRA_ARGS },
      },
    }],
  });
}

/** Sender withdraws an escrowed allocation → funds return, unlocked.
 *  Controlled by the allocation's sender party. */
export async function withdrawAllocation(allocationContractId, senderPartyId) {
  return submitCommands({
    actAs: [senderPartyId],
    commands: [{
      ExerciseCommand: {
        templateId: `${IFACE_PKG.allocation}:Splice.Api.Token.AllocationV1:Allocation`,
        contractId: allocationContractId,
        choice: 'Allocation_Withdraw',
        choiceArgument: { extraArgs: NO_EXTRA_ARGS },
      },
    }],
  });
}

// ── Settlement + expiry (atomic) ────────────────────────────────────────

/**
 * Settle a position atomically. If allocation cids are not provided, they are
 * discovered from the position's settlementRef. `lane`: 'operator' (Settle)
 * or 'holder' (SettleAsHolder; needs holder actAs rights).
 */
export async function settlePositionV2(positionContractId, { resolutionCid, lane = 'operator', holderPartyId, stakeAllocationCid, payoutAllocationCid } = {}) {
  if (lane === 'holder' && !holderPartyId) {
    throw new Error('holder lane requires holderPartyId (SettleAsHolder is holder-controlled)');
  }
  if (!stakeAllocationCid || !payoutAllocationCid) {
    const positions = await getOpenPositions(OPERATOR_PARTY_ID);
    const pos = positions.find((p) => p.contractId === positionContractId)?.payload;
    if (!pos) throw new Error('position not visible to operator — cannot discover allocations');
    const found = await findPositionAllocations(pos);
    stakeAllocationCid = stakeAllocationCid || found.stakeAllocationCid;
    payoutAllocationCid = payoutAllocationCid || found.payoutAllocationCid;
    if (!stakeAllocationCid || !payoutAllocationCid) {
      throw new Error('escrow legs not fully allocated yet — cannot settle');
    }
  }

  const params = {
    resolutionCid,
    stakeAllocationCid,
    payoutAllocationCid,
    stakeExtraArgs: NO_EXTRA_ARGS,
    payoutExtraArgs: NO_EXTRA_ARGS,
  };

  return submitCommands({
    actAs: [lane === 'holder' ? holderPartyId : OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: templateId('Fourcast.PredictionPosition', 'PredictionPosition'),
        contractId: positionContractId,
        choice: lane === 'holder' ? 'SettleAsHolder' : 'Settle',
        choiceArgument: { params },
      },
    }],
  });
}

/** Expire an unresolved position after settleBefore; refunds both legs. */
export async function expirePosition(positionContractId, { lane = 'operator', holderPartyId, reason = 'settlement window closed' } = {}) {
  if (lane === 'holder' && !holderPartyId) {
    throw new Error('holder lane requires holderPartyId (ExpirePositionAsHolder is holder-controlled)');
  }
  const positions = await getOpenPositions(OPERATOR_PARTY_ID);
  const pos = positions.find((p) => p.contractId === positionContractId)?.payload;
  if (!pos) throw new Error('position not visible to operator');
  const found = await findPositionAllocations(pos);
  if (!found.stakeAllocationCid || !found.payoutAllocationCid) {
    throw new Error('escrow legs not fully allocated — expire must cancel both');
  }

  const params = {
    stakeAllocationCid: found.stakeAllocationCid,
    payoutAllocationCid: found.payoutAllocationCid,
    stakeExtraArgs: NO_EXTRA_ARGS,
    payoutExtraArgs: NO_EXTRA_ARGS,
    reason: String(reason),
  };

  return submitCommands({
    actAs: [lane === 'holder' ? holderPartyId : OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: templateId('Fourcast.PredictionPosition', 'PredictionPosition'),
        contractId: positionContractId,
        choice: lane === 'holder' ? 'ExpirePositionAsHolder' : 'ExpirePosition',
        choiceArgument: { params },
      },
    }],
  });
}

// ── Package ops (deployment) ────────────────────────────────────────────

/** Upload a DAR (Buffer) to the participant. Returns true if accepted. */
export async function uploadDar(darBytes) {
  const token = await getToken();
  const res = await fetch(`${LEDGER_API_URL}/v2/packages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ darFile: darBytes.toString('base64') }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`DAR upload failed: HTTP ${res.status} — ${text.slice(0, 400)}`);
  }
  return true;
}

/** List package ids known to the participant. */
export async function listPackages() {
  const result = await ledgerCall('GET', '/v2/packages');
  return result.packageIds || [];
}

export { templateId, queryTemplateId, IFACE_PKG, NO_EXTRA_ARGS, EMPTY_META, referenceInstrumentId, OPERATOR_PARTY_ID, PACKAGE_ID };
