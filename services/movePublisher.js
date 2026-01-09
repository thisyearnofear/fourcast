/**
 * Aptos Signal Publisher Service
 *
 * Handles publishing signals to Aptos blockchain using user wallet connection.
 *
 * Architecture:
 * - User wallet signs transactions (no backend private keys)
 * - Signals stored on-chain in user's account
 * - Events emitted for indexing
 * - Graceful fallback to SQLite if Aptos fails
 */

import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { APTOS_NETWORKS, MOVEMENT_NETWORKS } from "@/constants/appConstants";

const APTOS_MODULE_ADDRESS =
  process.env.NEXT_PUBLIC_APTOS_MODULE_ADDRESS ||
  "0xa03f13d8fb211a9f7dfbe8f24b7872ce4b4205f8d1bee1a36cdeabaae3df5df1";

const MOVEMENT_MODULE_ADDRESS =
  process.env.NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS ||
  process.env.NEXT_PUBLIC_APTOS_MODULE_ADDRESS ||
  "0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c";

export class MoveSignalPublisher {
  constructor() {
    // 1. Initialize Aptos Client (Testnet)
    // Use env var or fall back to constants
    const aptosUrl =
      process.env.NEXT_PUBLIC_APTOS_RPC_URL ||
      APTOS_NETWORKS.TESTNET.rpcUrl;

    this.aptosClient = new Aptos(new AptosConfig({
      network: Network.TESTNET,
      fullnode: aptosUrl
    }));

    // 2. Initialize Movement Client (Custom/Testnet)
    const movementUrl =
      process.env.NEXT_PUBLIC_MOVEMENT_RPC_URL ||
      MOVEMENT_NETWORKS.TESTNET.rpcUrl;

    this.movementClient = new Aptos(new AptosConfig({
      network: Network.CUSTOM,
      fullnode: movementUrl
    }));

    /* console.log('[MoveSignalPublisher] Multi-chain initialized:', {
      aptos: { url: aptosUrl, module: APTOS_MODULE_ADDRESS },
      movement: { url: movementUrl, module: MOVEMENT_MODULE_ADDRESS }
    }); */
  }

  /**
   * Detect current network from wallet context or chainId
   */
  isMovementNetwork(network) {
    if (!network) return false;
    const chainId = typeof network === 'object' ? network.chainId : network;
    const url = typeof network === 'object' ? (network.url || '') : '';

    // Check known Movement Chain IDs (250 is standard testnet/bardock) or URL patterns
    return String(chainId) === '250' || url.includes('movement');
  }

  /**
   * Get the correct client based on network context
   */
  getClient(network) {
    return this.isMovementNetwork(network) ? this.movementClient : this.aptosClient;
  }

  getModuleAddress(network) {
    return this.isMovementNetwork(network) ? MOVEMENT_MODULE_ADDRESS : APTOS_MODULE_ADDRESS;
  }

  /**
   * Prepare transaction payload for publishing a signal
   * User's wallet will sign this transaction
   * @param {Object} signalData - Signal data to publish
   * @param {Object} network - Current network from useWallet (optional, falls back to env)
   */
  preparePublishSignalPayload(signalData, network = null) {
    const {
      event_id,
      market_title,
      venue = "",
      event_time = 0,
      market_snapshot_hash,
      weather_hash = "",
      ai_digest = "",
      confidence = "UNKNOWN",
      odds_efficiency = "UNKNOWN",
    } = signalData;

    const truncate = (s, n) => {
      if (!s) return "";
      const str = String(s);
      return str.length > n ? str.slice(0, n) : str;
    };

    const et = typeof event_time === "number"
      ? Math.floor(event_time)
      : parseInt(String(event_time || 0), 10);

    const isMovement = this.isMovementNetwork(network);
    const targetModule = this.getModuleAddress(network);

    // Movement uses 'signal_marketplace' (if integrated) or 'signal_registry'
    // Aptos uses 'signal_registry'
    // Logic: If on Movement AND we want to use marketplace features, use signal_marketplace.
    // Otherwise default to signal_registry.
    // For now, assume consistent contracts unless specified.
    const targetContract = (isMovement && process.env.NEXT_PUBLIC_USE_MARKETPLACE_CONTRACT === 'true')
      ? "signal_marketplace"
      : "signal_registry";

    // console.log(`[MoveSignalPublisher] Preparing payload for ${isMovement ? 'Movement' : 'Aptos'} (${targetContract})`);

    return {
      function: `${targetModule}::${targetContract}::publish_signal`,
      typeArguments: [],
      functionArguments: [
        truncate(event_id, 128),
        truncate(market_title, 256),
        truncate(venue, 128),
        et,
        truncate(market_snapshot_hash, 64),
        truncate(weather_hash, 64),
        truncate(ai_digest, 512),
        truncate(confidence, 32),
        truncate(odds_efficiency, 32),
      ],
    };
  }

  /**
   * Prepare transaction payload for tipping an analyst
   * This calls the 'signal_marketplace' contract on Movement
   * @param {string} authorAddress - Address of signal author
   * @param {string|number} signalId - ID of the signal
   * @param {number} amount - Tip amount (default 0.1 MOVE)
   * @param {Object} network - Current network from useWallet (optional)
   */
  prepareTipAnalystPayload(authorAddress, signalId, amount = 10000000, network = null) {
    if (!this.isMovementNetwork(network)) {
      throw new Error('Tipping is only available on Movement network.');
    }

    return {
      function: `${MOVEMENT_MODULE_ADDRESS}::signal_marketplace::tip_analyst`,
      typeArguments: [],
      functionArguments: [
        authorAddress,
        String(signalId),
        String(amount)
      ]
    };
  }

  /**
   * Get signal count for an account
   */
  async getSignalCount(accountAddress, network = null) {
    try {
      const client = this.getClient(network);
      const moduleAddr = this.getModuleAddress(network);

      const result = await client.view({
        payload: {
          function: `${moduleAddr}::signal_registry::get_signal_count`,
          typeArguments: [],
          functionArguments: [accountAddress],
        },
      });
      return parseInt(result[0]);
    } catch (error) {
      console.error(`[MoveSignalPublisher] Failed to get signal count (${this.isMovementNetwork(network) ? 'Movement' : 'Aptos'}):`, error.message);
      return 0;
    }
  }

  /**
   * Check if transaction was successful
   */
  async waitForTransaction(txHash, network = null) {
    try {
      const client = this.getClient(network);
      // console.log(`[MoveSignalPublisher] Waiting for TX on ${this.isMovementNetwork(network) ? 'Movement' : 'Aptos'}...`);

      const txn = await client.waitForTransaction({
        transactionHash: txHash,
      });
      return {
        success: txn.success,
        tx_hash: txHash,
        vm_status: txn.vm_status,
      };
    } catch (error) {
      console.error("Transaction failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Fetch real-time network statistics
   */
  async getNetworkStats(network = null) {
    try {
      const client = this.getClient(network);
      const info = await client.getLedgerInfo();
      const gasPrice = await client.getGasPriceEstimation();

      return {
        gasPrice: gasPrice.gas_estimate || 100,
        blockHeight: parseInt(info.ledger_version),
        chainID: info.chain_id,
        epoch: info.epoch,
        timestamp: parseInt(info.ledger_timestamp) / 1000,
      };
    } catch (error) {
      console.warn("Failed to fetch stats:", error.message);
      return null;
    }
  }
}

export const movePublisher = new MoveSignalPublisher();
