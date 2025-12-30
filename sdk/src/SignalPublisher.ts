import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

export interface SignalConfig {
  network?: Network;
  fullnode?: string;
  moduleAddress: string;
  marketplaceAddress?: string;
}

export interface SignalData {
  eventId: string;
  marketTitle: string;
  venue?: string;
  eventTime: number;
  marketSnapshotHash: string;
  weatherHash?: string;
  aiDigest?: string;
  confidence?: string;
  oddsEfficiency?: string;
}

export interface TransactionPayload {
  function: string;
  typeArguments: string[];
  functionArguments: (string | number)[];
}

export class SignalPublisher {
  private aptos: Aptos;
  private config: SignalConfig;

  constructor(config: SignalConfig) {
    this.config = config;
    const aptosConfig = new AptosConfig({
      network: config.network || Network.TESTNET,
      fullnode: config.fullnode,
    });
    this.aptos = new Aptos(aptosConfig);
  }

  /**
   * Prepare transaction payload for publishing a signal
   */
  preparePublishPayload(signal: SignalData): TransactionPayload {
    const {
      eventId,
      marketTitle,
      venue = "",
      eventTime = 0,
      marketSnapshotHash,
      weatherHash = "",
      aiDigest = "",
      confidence = "UNKNOWN",
      oddsEfficiency = "UNKNOWN",
    } = signal;

    const truncate = (s: string | undefined, n: number): string => {
      if (!s) return "";
      const str = String(s);
      return str.length > n ? str.slice(0, n) : str;
    };

    const et = typeof eventTime === "number" ? Math.floor(eventTime) : parseInt(String(eventTime || 0), 10);

    return {
      function: `${this.config.moduleAddress}::signal_registry::publish_signal`,
      typeArguments: [],
      functionArguments: [
        truncate(eventId, 128),
        truncate(marketTitle, 256),
        truncate(venue, 128),
        et,
        truncate(marketSnapshotHash, 64),
        truncate(weatherHash, 64),
        truncate(aiDigest, 512),
        truncate(confidence, 32),
        truncate(oddsEfficiency, 32),
      ],
    };
  }

  /**
   * Prepare transaction payload for tipping an analyst
   */
  prepareTipPayload(analystAddress: string, signalId: string | number, amount: string | number): TransactionPayload {
    const marketplaceAddr = this.config.marketplaceAddress || this.config.moduleAddress;
    
    return {
      function: `${marketplaceAddr}::signal_marketplace::tip_analyst`,
      typeArguments: [],
      functionArguments: [
        analystAddress,
        String(signalId),
        String(amount)
      ]
    };
  }

  /**
   * Get signal count for an account
   */
  async getSignalCount(accountAddress: string): Promise<number> {
    try {
      const result = await this.aptos.view({
        payload: {
          function: `${this.config.moduleAddress}::signal_registry::get_signal_count`,
          typeArguments: [],
          functionArguments: [accountAddress],
        },
      });
      return parseInt(result[0] as string);
    } catch (error) {
      console.error("Failed to get signal count:", error);
      return 0;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(txHash: string): Promise<{ success: boolean; tx_hash: string; vm_status?: string; error?: string }> {
    try {
      const txn = await this.aptos.waitForTransaction({
        transactionHash: txHash,
      });
      return {
        success: txn.success,
        tx_hash: txHash,
        vm_status: txn.vm_status,
      };
    } catch (error: any) {
      console.error("Transaction failed:", error);
      return {
        success: false,
        tx_hash: txHash,
        error: error.message,
      };
    }
  }
}
