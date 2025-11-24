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

import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const APTOS_NETWORK = process.env.NEXT_PUBLIC_APTOS_NETWORK || Network.DEVNET;
const MODULE_ADDRESS = process.env.NEXT_PUBLIC_APTOS_MODULE_ADDRESS || '0xa03f13d8fb211a9f7dfbe8f24b7872ce4b4205f8d1bee1a36cdeabaae3df5df1'; // Updated to deployed address

export class AptosSignalPublisher {
    constructor() {
        const config = new AptosConfig({ network: APTOS_NETWORK });
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
            venue = '',
            event_time = 0,
            market_snapshot_hash,
            weather_json = {},
            ai_digest = '',
            confidence = 'UNKNOWN',
            odds_efficiency = 'UNKNOWN',
        } = signalData;

        return {
            function: `${MODULE_ADDRESS}::signal_registry::publish_signal`,
            typeArguments: [],
            functionArguments: [
                event_id,
                market_title,
                venue,
                event_time.toString(),
                market_snapshot_hash,
                JSON.stringify(weather_json),
                ai_digest,
                confidence,
                odds_efficiency,
            ],
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
                }
            });
            return parseInt(result[0]);
        } catch (error) {
            console.error('Failed to get signal count:', error);
            return 0;
        }
    }

    /**
     * Check if transaction was successful
     */
    async waitForTransaction(txHash) {
        try {
            const txn = await this.aptos.waitForTransaction({ transactionHash: txHash });
            return {
                success: txn.success,
                tx_hash: txHash,
                vm_status: txn.vm_status,
            };
        } catch (error) {
            console.error('Transaction failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

export const aptosPublisher = new AptosSignalPublisher();


