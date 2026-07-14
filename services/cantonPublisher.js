/**
 * Canton (Daml) signal publishing via Console Wallet.
 *
 * Submits Daml commands to create a PredictionPosition on Canton,
 * enabling private settlement with cBTC/cETH. Position sizes are
 * visible only to the operator and the holder — no public explorer,
 * no competing trader, no validator can see them.
 *
 * This is the Canton parallel to services/arcPublisher.js (EVM/Arc).
 * Arc publishes public reputation receipts; Canton creates private positions.
 */

// Daml template IDs are hashes of the package + module + template name.
// These are computed at DAR build time. In production, the operator
// publishes the DAR and these IDs are known. For dev, we load them
// from the environment or fall back to placeholder hashes.
const FOURCAST_PACKAGE_ID = process.env.NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID || '';

// Template IDs (packageId:Module:Template)
function templateId(name) {
  if (!FOURCAST_PACKAGE_ID) return '';
  return `${FOURCAST_PACKAGE_ID}:Fourcast.PredictionPosition:${name}`;
}

function marketTemplateId(name) {
  if (!FOURCAST_PACKAGE_ID) return '';
  return `${FOURCAST_PACKAGE_ID}:Fourcast.PredictionMarket:${name}`;
}

/**
 * Map a Fourcast signal to a Daml PredictionPosition create command.
 *
 * @param {object} signalData  The signal/prediction data
 * @param {string} operatorPartyId  Canton party ID of the Fourcast operator
 * @param {string} holderPartyId  Canton party ID of the user (from Console Wallet)
 * @returns {object} Daml create command for PredictionPosition
 */
export function mapSignalToCantonCommand(signalData, operatorPartyId, holderPartyId) {
  const rawId = String(signalData.event_id || signalData.market_title || 'market-001');
  const side = String(signalData.recommended_action || signalData.confidence || 'UNKNOWN').toUpperCase();
  const stake = parseFloat(signalData.stake || signalData.position_size || '0');
  const settlementAsset = String(signalData.settlement_asset || 'CBTC').toUpperCase();

  // Map confidence to Side enum
  const damlSide = side === 'YES' || side === 'HIGH' || side === 'BUY'
    ? 'Yes'
    : side === 'NO' || side === 'LOW' || side === 'SELL'
      ? 'No'
      : 'Yes'; // default to Yes

  const damlAsset = settlementAsset === 'CETH' ? 'CETH' : 'CBTC';

  return {
    type: 'create',
    templateId: templateId('PredictionPosition'),
    payload: {
      operator: operatorPartyId,
      holder: holderPartyId,
      marketId: rawId,
      side: damlSide,
      stake: stake.toString(),
      settlementAsset: damlAsset,
      status: 'Open',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Publish a prediction position on Canton via Console Wallet.
 *
 * @param {object} opts
 * @param {object} opts.cantonWallet  The Canton wallet context value (from useCantonWalletContext)
 * @param {object} opts.signalData    The signal/prediction data
 * @param {string} opts.operatorPartyId  Canton party ID of the Fourcast operator
 * @param {boolean} [opts.wait]  If true, wait for transaction finalization
 * @returns {Promise<object>} Transaction result from Console Wallet
 */
export async function publishPositionOnCanton({ cantonWallet, signalData, operatorPartyId, wait = true }) {
  if (!cantonWallet?.connected || !cantonWallet?.account?.partyId) {
    throw new Error('Connect a Canton wallet (Console Wallet) first');
  }
  if (!operatorPartyId) {
    throw new Error('Fourcast operator party ID not configured');
  }

  const holderPartyId = cantonWallet.account.partyId;
  const command = mapSignalToCantonCommand(signalData, operatorPartyId, holderPartyId);

  if (!command.templateId) {
    throw new Error('Canton DAR package ID not configured. Set NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID.');
  }

  return cantonWallet.submitCommands({
    actAs: [operatorPartyId, holderPartyId],
    readAs: [holderPartyId],
    commands: [command],
    wait,
  });
}

/**
 * Settle a prediction position on Canton.
 *
 * @param {object} opts
 * @param {object} opts.cantonWallet  The Canton wallet context value
 * @param {string} opts.positionContractId  The contract ID of the PredictionPosition
 * @param {string} opts.outcome  The resolution outcome: 'ResolvedYes' | 'ResolvedNo' | 'Voided'
 * @param {boolean} [opts.wait]  If true, wait for finalization
 * @returns {Promise<object>} Transaction result
 */
export async function settlePositionOnCanton({ cantonWallet, positionContractId, outcome, wait = true }) {
  if (!cantonWallet?.connected || !cantonWallet?.account?.partyId) {
    throw new Error('Connect a Canton wallet (Console Wallet) first');
  }

  const exerciseCommand = {
    type: 'exercise',
    templateId: templateId('PredictionPosition'),
    contractId: positionContractId,
    choice: 'Settle',
    argument: { outcome },
  };

  return cantonWallet.submitCommands({
    actAs: [cantonWallet.account.partyId],
    commands: [exerciseCommand],
    wait,
  });
}

/**
 * Query the user's open positions on Canton.
 *
 * @param {object} cantonWallet  The Canton wallet context value
 * @returns {Promise<object[]>} Active PredictionPosition contracts
 */
export async function getOpenPositions(cantonWallet) {
  if (!cantonWallet?.connected) return [];
  return cantonWallet.queryContracts([templateId('PredictionPosition')]);
}

/**
 * Query the user's settled positions on Canton.
 *
 * @param {object} cantonWallet  The Canton wallet context value
 * @returns {Promise<object[]>} PositionSettled contracts
 */
export async function getSettledPositions(cantonWallet) {
  if (!cantonWallet?.connected) return [];
  return cantonWallet.queryContracts([templateId('PositionSettled')]);
}

export { templateId, marketTemplateId };
