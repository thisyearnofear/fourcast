import { Network } from "@aptos-labs/ts-sdk";
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
export declare class SignalPublisher {
    private aptos;
    private config;
    constructor(config: SignalConfig);
    /**
     * Prepare transaction payload for publishing a signal
     */
    preparePublishPayload(signal: SignalData): TransactionPayload;
    /**
     * Prepare transaction payload for tipping an analyst
     */
    prepareTipPayload(analystAddress: string, signalId: string | number, amount: string | number): TransactionPayload;
    /**
     * Get signal count for an account
     */
    getSignalCount(accountAddress: string): Promise<number>;
    /**
     * Wait for transaction confirmation
     */
    waitForTransaction(txHash: string): Promise<{
        success: boolean;
        tx_hash: string;
        vm_status?: string;
        error?: string;
    }>;
}
