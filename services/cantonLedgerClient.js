/**
 * Canton Ledger Client — server-side direct JSON Ledger API.
 *
 * Authenticates to the NODERS NaaS Keycloak via OIDC password grant,
 * then submits Daml commands and queries active contracts against the
 * Canton JSON Ledger API (v2).
 *
 * This replaces the client-side Console Wallet / Wallet SDK approach.
 * All credentials stay server-side — never exposed to the browser.
 *
 * Env vars required:
 *   CANTON_JSON_API_URL        — ledger API base URL
 *   CANTON_OIDC_TOKEN_URL      — Keycloak token endpoint
 *   CANTON_OIDC_CLIENT_ID      — Keycloak client ID (password grant)
 *   CANTON_OIDC_USERNAME       — Keycloak user email/username
 *   CANTON_OIDC_PASSWORD       — Keycloak user password
 *   CANTON_OIDC_AUDIENCE       — token audience
 *   CANTON_OIDC_SCOPE          — token scope (default: openid daml_ledger_api offline_access)
 *   CANTON_LEDGER_USER_ID      — ledger user ID (Keycloak subject UUID)
 *   CANTON_OPERATOR_PARTY_ID   — FourcastOperator party ID
 *   NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID — DAR package hash
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

// DAR package name (used for query template IDs — Canton v2 expects names, not hashes)
const PACKAGE_NAME = 'canton';

// Module-level token cache (survives across requests in the same serverless instance)
let cachedToken = null;
let tokenExpiryMs = 0;

/**
 * Check if the ledger client is configured (all required env vars present).
 */
export function isCantonConfigured() {
  return Boolean(LEDGER_API_URL && TOKEN_URL && CLIENT_ID && USERNAME && PASSWORD && AUDIENCE);
}

/**
 * Fetch an OIDC access token from Keycloak (password grant).
 * Caches the token with a 60s safety margin before expiry.
 */
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

/**
 * Make an authenticated call to the Canton JSON Ledger API (v2).
 */
async function ledgerCall(method, path, body) {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  const init = { method, headers };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${LEDGER_API_URL}${path}`, init);
  const parsed = await res.json();

  const isError = !res.ok || (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && ('code' in parsed || 'cause' in parsed));
  if (isError) {
    throw new Error(`Canton Ledger API ${method} ${path} failed: ${parsed.cause || parsed.message || `HTTP ${res.status}`}`);
  }

  return parsed;
}

/**
 * Generate a unique command ID.
 */
function commandId() {
  return `fourcast-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Build a template ID string from module + template name.
 * Uses the package hash for command submission (Canton accepts both forms for commands).
 */
function templateId(module, name) {
  if (!PACKAGE_ID) return '';
  return `${PACKAGE_ID}:${module}:${name}`;
}

/**
 * Build a template ID for queries using the package NAME (not hash).
 * Canton v2 active-contracts queries require package names, not hashes.
 */
function queryTemplateId(module, name) {
  return `#${PACKAGE_NAME}:${module}:${name}`;
}

// ── Command submission ──────────────────────────────────────────────────

/**
 * Submit Daml commands to the ledger and wait for completion.
 *
 * @param {object} opts
 * @param {string[]} opts.actAs       Parties acting on the commands
 * @param {string[]} [opts.readAs]    Parties reading the results
 * @param {object[]} opts.commands    Array of CreateCommand / ExerciseCommand
 * @param {string}  [opts.userId]     Override user ID (defaults to LEDGER_USER_ID)
 * @returns {Promise<object>} Transaction result with updateId and completionOffset
 */
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

// ── Contract queries ────────────────────────────────────────────────────

/**
 * Query active contracts for a party, filtered by template IDs.
 *
 * @param {string} partyId       The party to query as
 * @param {string[]} templates   Array of { module, name } objects
 * @returns {Promise<object[]>}  Array of { contractId, templateId, payload }
 */
export async function queryActiveContracts(partyId, templates = []) {
  if (!isCantonConfigured()) return [];
  if (!partyId) return [];

  // Get current ledger end offset (required for active-contracts queries)
  const end = await ledgerCall('GET', '/v2/state/ledger-end');
  const activeAtOffset = end.offset ?? 0;

  // Build eventFormat with TemplateFilter for each template
  const cumulative = templates.map(({ module, name }) => ({
    identifierFilter: {
      TemplateFilter: {
        value: {
          templateId: queryTemplateId(module, name),
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
    verbose: false,
  });

  // Parse the response — each item has contractEntry.JsActiveContract.createdEvent
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

// ── High-level market operations ────────────────────────────────────────

/**
 * Create a prediction market on Canton (operator action).
 *
 * @param {object} marketData  Market data (marketId, question, settlementAsset, deadline)
 * @returns {Promise<object>}   { updateId, completionOffset }
 */
export async function createMarket(marketData) {
  const marketId = String(marketData.marketId || marketData.event_id || marketData.id || 'market-001');
  const question = String(marketData.question || marketData.title || marketData.market_title || '');
  const settlementAsset = String(marketData.settlement_asset || 'CBTC').toUpperCase() === 'CETH' ? 'CETH' : 'CBTC';
  const now = new Date().toISOString();
  const deadline = marketData.deadline
    ? new Date(marketData.deadline).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return submitCommands({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      CreateCommand: {
        templateId: templateId('Fourcast.PredictionMarket', 'PredictionMarket'),
        createArguments: {
          operator: OPERATOR_PARTY_ID,
          marketId,
          question,
          settlementAsset,
          createdAt: now,
          deadline,
        },
      },
    }],
  });
}

/**
 * Resolve a prediction market on Canton (operator action).
 *
 * @param {string} marketContractId  Contract ID of the PredictionMarket
 * @param {string} outcome           'ResolvedYes' | 'ResolvedNo' | 'Voided'
 * @returns {Promise<object>}         { updateId, completionOffset }
 */
export async function resolveMarket(marketContractId, outcome) {
  const validOutcome = ['ResolvedYes', 'ResolvedNo', 'Voided'].includes(outcome) ? outcome : 'ResolvedYes';

  return submitCommands({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: templateId('Fourcast.PredictionMarket', 'PredictionMarket'),
        contractId: marketContractId,
        choice: 'ResolveMarket',
        choiceArgument: { outcome: validOutcome },
      },
    }],
  });
}

/**
 * Create a prediction position on Canton (operator creates for a holder).
 *
 * @param {object} signalData     Signal data (event_id, recommended_action, stake, settlement_asset)
 * @param {string} holderPartyId  Canton party ID of the position holder
 * @returns {Promise<object>}      { updateId, completionOffset }
 */
export async function createPosition(signalData, holderPartyId) {
  const rawId = String(signalData.event_id || signalData.market_title || 'market-001');
  const side = String(signalData.recommended_action || signalData.confidence || 'UNKNOWN').toUpperCase();
  const stake = parseFloat(signalData.stake || signalData.position_size || '0');
  const settlementAsset = String(signalData.settlement_asset || 'CBTC').toUpperCase();

  const damlSide = side === 'YES' || side === 'HIGH' || side === 'BUY' ? 'Yes'
    : side === 'NO' || side === 'LOW' || side === 'SELL' ? 'No'
    : 'Yes';

  const damlAsset = settlementAsset === 'CETH' ? 'CETH' : 'CBTC';

  return submitCommands({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      CreateCommand: {
        templateId: templateId('Fourcast.PredictionPosition', 'PredictionPosition'),
        createArguments: {
          operator: OPERATOR_PARTY_ID,
          holder: holderPartyId,
          marketId: rawId,
          side: damlSide,
          stake: stake.toString(),
          settlementAsset: damlAsset,
          status: 'Open',
          createdAt: new Date().toISOString(),
        },
      },
    }],
  });
}

/**
 * Settle a prediction position on Canton (operator action).
 *
 * @param {string} positionContractId     Contract ID of the PredictionPosition
 * @param {string} resolutionContractId   Contract ID of the MarketResolution
 * @returns {Promise<object>}              { updateId, completionOffset }
 */
export async function settlePosition(positionContractId, resolutionContractId) {
  return submitCommands({
    actAs: [OPERATOR_PARTY_ID],
    commands: [{
      ExerciseCommand: {
        templateId: templateId('Fourcast.PredictionPosition', 'PredictionPosition'),
        contractId: positionContractId,
        choice: 'Settle',
        choiceArgument: { resolutionCid: resolutionContractId },
      },
    }],
  });
}

// ── Query helpers ───────────────────────────────────────────────────────

/**
 * Get all open prediction markets visible to the operator.
 */
export async function getOpenMarkets() {
  return queryActiveContracts(OPERATOR_PARTY_ID, [
    { module: 'Fourcast.PredictionMarket', name: 'PredictionMarket' },
  ]);
}

/**
 * Get all market resolutions visible to the operator.
 */
export async function getMarketResolutions() {
  return queryActiveContracts(OPERATOR_PARTY_ID, [
    { module: 'Fourcast.PredictionMarket', name: 'MarketResolution' },
  ]);
}

/**
 * Get all open positions visible to the operator.
 */
export async function getOpenPositions() {
  return queryActiveContracts(OPERATOR_PARTY_ID, [
    { module: 'Fourcast.PredictionPosition', name: 'PredictionPosition' },
  ]);
}

/**
 * Get all settled positions visible to the operator.
 */
export async function getSettledPositions() {
  return queryActiveContracts(OPERATOR_PARTY_ID, [
    { module: 'Fourcast.PredictionPosition', name: 'PositionSettled' },
  ]);
}

/**
 * Get all pending settlement obligations for the operator.
 */
export async function getPendingObligations() {
  return queryActiveContracts(OPERATOR_PARTY_ID, [
    { module: 'Fourcast.PredictionPosition', name: 'SettlementObligation' },
  ]);
}

export { templateId, queryTemplateId, OPERATOR_PARTY_ID, PACKAGE_ID };
