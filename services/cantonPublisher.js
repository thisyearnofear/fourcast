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
 * Map a Fourcast market to a Daml PredictionMarket create command.
 *
 * @param {object} marketData  The market data
 * @param {string} operatorPartyId  Canton party ID of the Fourcast operator
 * @returns {object} Daml CreateCommand for PredictionMarket
 */
export function mapMarketToCantonCommand(marketData, operatorPartyId) {
  const marketId = String(marketData.marketId || marketData.event_id || marketData.id || 'market-001');
  const question = String(marketData.question || marketData.title || marketData.market_title || '');
  const settlementAsset = String(marketData.settlement_asset || 'CBTC').toUpperCase() === 'CETH' ? 'CETH' : 'CBTC';
  const now = new Date().toISOString();
  const deadline = marketData.deadline
    ? new Date(marketData.deadline).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    CreateCommand: {
      templateId: marketTemplateId('PredictionMarket'),
      createArguments: {
        operator: operatorPartyId,
        marketId,
        question,
        settlementAsset,
        createdAt: now,
        deadline,
      },
    },
  };
}

/**
 * Create a prediction market on Canton via Console Wallet (operator action).
 *
 * @param {object} opts
 * @param {object} opts.cantonWallet  The operator's Canton wallet context
 * @param {object} opts.marketData    The market data
 * @param {string} opts.operatorPartyId  Canton party ID of the Fourcast operator
 * @param {boolean} [opts.wait]  If true, wait for finalization
 * @returns {Promise<object>} Transaction result
 */
export async function createMarketOnCanton({ cantonWallet, marketData, operatorPartyId, wait = true }) {
  if (!cantonWallet?.connected || !cantonWallet?.account?.partyId) {
    throw new Error('Connect the operator Canton wallet first');
  }
  if (!operatorPartyId) {
    throw new Error('Fourcast operator party ID not configured');
  }

  const command = mapMarketToCantonCommand(marketData, operatorPartyId);

  if (!command.CreateCommand.templateId) {
    throw new Error('Canton DAR package ID not configured. Set NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID.');
  }

  return cantonWallet.submitCommands({
    actAs: [operatorPartyId],
    commands: [command],
    wait,
  });
}

/**
 * Resolve a prediction market on Canton (operator action).
 *
 * @param {object} opts
 * @param {object} opts.cantonWallet  The operator's Canton wallet context
 * @param {string} opts.marketContractId  The contract ID of the PredictionMarket
 * @param {string} opts.outcome  The resolution outcome: 'ResolvedYes' | 'ResolvedNo' | 'Voided'
 * @param {boolean} [opts.wait]  If true, wait for finalization
 * @returns {Promise<object>} Transaction result
 */
export async function resolveMarketOnCanton({ cantonWallet, marketContractId, outcome, wait = true }) {
  if (!cantonWallet?.connected || !cantonWallet?.account?.partyId) {
    throw new Error('Connect the operator Canton wallet first');
  }

  const validOutcome = ['ResolvedYes', 'ResolvedNo', 'Voided'].includes(outcome)
    ? outcome
    : 'ResolvedYes';

  const exerciseCommand = {
    ExerciseCommand: {
      templateId: marketTemplateId('PredictionMarket'),
      contractId: marketContractId,
      choice: 'ResolveMarket',
      choiceArgument: { outcome: validOutcome },
    },
  };

  return cantonWallet.submitCommands({
    actAs: [cantonWallet.account.partyId],
    commands: [exerciseCommand],
    wait,
  });
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
    CreateCommand: {
      templateId: templateId('PredictionPosition'),
      createArguments: {
        operator: operatorPartyId,
        holder: holderPartyId,
        marketId: rawId,
        side: damlSide,
        stake: stake.toString(),
        settlementAsset: damlAsset,
        status: 'Open',
        createdAt: new Date().toISOString(),
      },
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
 * @param {string} opts.resolutionContractId  The contract ID of the MarketResolution
 * @param {boolean} [opts.wait]  If true, wait for finalization
 * @returns {Promise<object>} Transaction result
 */
export async function settlePositionOnCanton({ cantonWallet, positionContractId, resolutionContractId, wait = true }) {
  if (!cantonWallet?.connected || !cantonWallet?.account?.partyId) {
    throw new Error('Connect a Canton wallet (Console Wallet) first');
  }
  if (!resolutionContractId) {
    throw new Error('MarketResolution contract ID is required — cannot settle without proof of resolution');
  }

  const exerciseCommand = {
    ExerciseCommand: {
      templateId: templateId('PredictionPosition'),
      contractId: positionContractId,
      choice: 'Settle',
      choiceArgument: { resolutionCid: resolutionContractId },
    },
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
 * Query open prediction markets on Canton.
 *
 * @param {object} cantonWallet  The Canton wallet context value
 * @returns {Promise<object[]>} Active PredictionMarket contracts
 */
export async function getOpenMarkets(cantonWallet) {
  if (!cantonWallet?.connected) return [];
  return cantonWallet.queryContracts([marketTemplateId('PredictionMarket')]);
}

/**
 * Query market resolutions on Canton.
 *
 * @param {object} cantonWallet  The Canton wallet context value
 * @returns {Promise<object[]>} MarketResolution contracts
 */
export async function getMarketResolutions(cantonWallet) {
  if (!cantonWallet?.connected) return [];
  return cantonWallet.queryContracts([marketTemplateId('MarketResolution')]);
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

/**
 * Query pending SettlementObligation contracts for the operator.
 *
 * After a position is settled, a SettlementObligation is created instructing
 * the operator to transfer cBTC/cETH to the winner via CIP-56. This function
 * fetches all outstanding obligations.
 *
 * @param {object} cantonWallet  The Canton wallet context value
 * @returns {Promise<object[]>} Pending SettlementObligation contracts
 */
export async function getPendingObligations(cantonWallet) {
  if (!cantonWallet?.connected) return [];
  return cantonWallet.queryContracts([templateId('SettlementObligation')]);
}

/**
 * Execute a CIP-56 token transfer for a SettlementObligation.
 *
 * This is the off-chain step that moves actual cBTC/cETH from the operator
 * to the winner. The Daml SettlementObligation authorizes the transfer;
 * this function executes it via the Wallet SDK's token transfer API.
 *
 * Flow:
 * 1. sdk.token.transfer.create() → builds the transfer command
 * 2. prepared.sign() → signs with the operator's key
 * 3. sdk.ledger.execute() → submits to the ledger
 * 4. Exercise ConfirmTransfer on the SettlementObligation with the tx ID
 *
 * @param {object} opts
 * @param {object} opts.cantonWallet  The Canton wallet context (operator's wallet)
 * @param {object} opts.obligation  The SettlementObligation contract
 * @param {string} opts.obligationId  The contract ID of the SettlementObligation
 * @param {string} opts.registryUrl  CIP-56 registry URL for the token
 * @param {string} opts.instrumentId  Token instrument ID (e.g. 'Amulet' for CC, cBTC/cETH specific)
 * @returns {Promise<object>} Transfer result + confirmation
 */
export async function executeSettlementTransfer({ cantonWallet, obligation, obligationId, registryUrl, instrumentId }) {
  if (!cantonWallet?.connected || !cantonWallet?.account?.partyId) {
    throw new Error('Operator Canton wallet not connected');
  }

  const sdk = cantonWallet.getWalletSDK?.();
  if (!sdk?.token?.transfer) {
    throw new Error('Wallet SDK token transfer API not available (requires Wallet SDK mode)');
  }

  const { winner, amount, settlementAsset, memo } = obligation.payload || obligation;
  if (!winner || !amount) {
    throw new Error('SettlementObligation missing winner or amount');
  }

  // 1. Create the CIP-56 transfer command
  const prepared = await sdk.token.transfer.create({
    sender: cantonWallet.account.partyId,
    recipient: winner,
    amount: String(amount),
    instrumentId: instrumentId || (settlementAsset === 'CETH' ? 'cETH' : 'cBTC'),
    registryUrl: new URL(registryUrl),
    memo: memo || 'Fourcast settlement',
  });

  // 2. Sign and execute the transfer
  const signed = await prepared.sign();
  const transferResult = await sdk.ledger.execute(signed, {
    partyId: cantonWallet.account.partyId,
  });

  const transferTxId = transferResult?.completionId || transferResult?.submissionId || '';
  if (!transferTxId) {
    throw new Error('Transfer executed but no transaction ID returned');
  }

  // 3. Exercise ConfirmTransfer on the SettlementObligation
  const confirmCommand = {
    ExerciseCommand: {
      templateId: templateId('SettlementObligation'),
      contractId: obligationId,
      choice: 'ConfirmTransfer',
      choiceArgument: { transferTxId },
    },
  };

  const confirmResult = await cantonWallet.submitCommands({
    actAs: [cantonWallet.account.partyId],
    commands: [confirmCommand],
    wait: true,
  });

  return {
    transfer: transferResult,
    transferTxId,
    confirmation: confirmResult,
  };
}

/**
 * Process all pending SettlementObligations for the operator.
 *
 * Iterates outstanding obligations, executes the CIP-56 transfer for each,
 * and confirms on-ledger. This is the settlement batch processor —
 * the operator runs it after market resolution to pay out winners.
 *
 * @param {object} opts
 * @param {object} opts.cantonWallet  The operator's Canton wallet context
 * @param {string} opts.registryUrl  CIP-56 registry URL
 * @param {string} [opts.instrumentId]  Token instrument ID override
 * @returns {Promise<object[]>} Results for each processed obligation
 */
export async function processPendingObligations({ cantonWallet, registryUrl, instrumentId }) {
  const obligations = await getPendingObligations(cantonWallet);
  const results = [];

  for (const [obligationId, obligation] of obligations) {
    try {
      const result = await executeSettlementTransfer({
        cantonWallet,
        obligation,
        obligationId,
        registryUrl,
        instrumentId,
      });
      results.push({ obligationId, success: true, ...result });
    } catch (err) {
      results.push({ obligationId, success: false, error: err.message });
    }
  }

  return results;
}

export { templateId, marketTemplateId };
