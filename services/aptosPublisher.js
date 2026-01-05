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

const APTOS_NETWORK = process.env.NEXT_PUBLIC_APTOS_NETWORK || Network.DEVNET;
const MODULE_ADDRESS =
  process.env.NEXT_PUBLIC_APTOS_MODULE_ADDRESS ||
  "0xa03f13d8fb211a9f7dfbe8f24b7872ce4b4205f8d1bee1a36cdeabaae3df5df1"; // Aptos Testnet

// Movement has a separate module that supports payments/tipping
const MOVEMENT_MODULE_ADDRESS =
  process.env.NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS ||
  MODULE_ADDRESS;

export class AptosSignalPublisher {
  constructor() {
    const rpcUrl = process.env.NEXT_PUBLIC_APTOS_CUSTOM_RPC_URL || process.env.NEXT_PUBLIC_APTOS_NODE_URL;
    const config = new AptosConfig({
      network: APTOS_NETWORK,
      fullnode: rpcUrl
    });
    this.aptos = new Aptos(config);
  }

  /**
   * Prepare transaction payload for publishing a signal
   * User's wallet will sign this transaction
   */
  preparePublishSignalPayload(signalData) {
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

    const et =
      typeof event_time === "number"
        ? Math.floor(event_time)
        : parseInt(String(event_time || 0), 10);

    // Dynamic switching for Movement Marketplace
    const useMarketplace = process.env.NEXT_PUBLIC_USE_MARKETPLACE_CONTRACT === 'true';
    const targetModule = useMarketplace ? MOVEMENT_MODULE_ADDRESS : MODULE_ADDRESS;
    const targetContract = useMarketplace ? "signal_marketplace" : "signal_registry";

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
   */
  prepareTipAnalystPayload(authorAddress, signalId, amount = 10000000) {
    // Default to 0.1 MOVE (assuming 8 decimals, check unit)
    return {
      function: `${MOVEMENT_MODULE_ADDRESS}::signal_marketplace::tip_analyst`,
      typeArguments: [],
      functionArguments: [
        authorAddress,
        String(signalId), // Ensure u64 is passed as string if needed, or number
        String(amount)
      ]
    };
  }

  /**
   * Get signal count for an account
   */
  async getSignalCount(accountAddress) {
    try {
      const result = await this.aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::signal_registry::get_signal_count`,
          typeArguments: [],
          functionArguments: [accountAddress],
        },
      });
      return parseInt(result[0]);
    } catch (error) {
      console.error("Failed to get signal count:", error);
      return 0;
    }
  }

  /**
   * Check if transaction was successful
   */
  async waitForTransaction(txHash) {
    try {
      const txn = await this.aptos.waitForTransaction({
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
  async getNetworkStats() {
    try {
      const info = await this.aptos.getLedgerInfo();
      const gasPrice = await this.aptos.getGasPriceEstimation();
      
      return {
        gasPrice: gasPrice.gas_estimate || 100,
        tps: 0, // Aptos TS SDK doesn't give live TPS in a single call easily without blocks
        blockHeight: parseInt(info.ledger_version),
        chainID: info.chain_id,
        epoch: info.epoch,
        timestamp: parseInt(info.ledger_timestamp) / 1000,
        congestion: (gasPrice.gas_estimate > 200) ? "HIGH" : "LOW"
      };
    } catch (error) {
      console.warn("Failed to fetch real Aptos stats, using fallback:", error.message);
      return null;
    }
  }
}

export const aptosPublisher = new AptosSignalPublisher();
