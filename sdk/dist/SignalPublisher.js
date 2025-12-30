"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalPublisher = void 0;
const ts_sdk_1 = require("@aptos-labs/ts-sdk");
class SignalPublisher {
    constructor(config) {
        this.config = config;
        const aptosConfig = new ts_sdk_1.AptosConfig({
            network: config.network || ts_sdk_1.Network.TESTNET,
            fullnode: config.fullnode,
        });
        this.aptos = new ts_sdk_1.Aptos(aptosConfig);
    }
    /**
     * Prepare transaction payload for publishing a signal
     */
    preparePublishPayload(signal) {
        const { eventId, marketTitle, venue = "", eventTime = 0, marketSnapshotHash, weatherHash = "", aiDigest = "", confidence = "UNKNOWN", oddsEfficiency = "UNKNOWN", } = signal;
        const truncate = (s, n) => {
            if (!s)
                return "";
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
    prepareTipPayload(analystAddress, signalId, amount) {
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
    async getSignalCount(accountAddress) {
        try {
            const result = await this.aptos.view({
                payload: {
                    function: `${this.config.moduleAddress}::signal_registry::get_signal_count`,
                    typeArguments: [],
                    functionArguments: [accountAddress],
                },
            });
            return parseInt(result[0]);
        }
        catch (error) {
            console.error("Failed to get signal count:", error);
            return 0;
        }
    }
    /**
     * Wait for transaction confirmation
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
        }
        catch (error) {
            console.error("Transaction failed:", error);
            return {
                success: false,
                tx_hash: txHash,
                error: error.message,
            };
        }
    }
}
exports.SignalPublisher = SignalPublisher;
