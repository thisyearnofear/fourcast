# @fourcast/signal-sdk

The standard SDK for publishing verifiable prediction signals to the Movement network.

## 🚀 Quick Start

### Installation

```bash
npm install @fourcast/signal-sdk
```

### Usage

```typescript
import { SignalPublisher } from '@fourcast/signal-sdk';

// 1. Initialize Publisher
const publisher = new SignalPublisher({
  network: 'custom', 
  moduleAddress: '0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c'
});

// 2. Prepare Signal Data
const signal = {
  eventId: 'market-123',
  marketTitle: 'Will it rain in London?',
  venue: 'London, UK',
  eventTime: 1735468800, // Unix timestamp
  marketSnapshotHash: '0xabc...',
  weatherHash: '0xdef...',
  aiDigest: 'High probability of rain based on pressure systems.',
  confidence: 'HIGH',
  oddsEfficiency: 'INEFFICIENT'
};

// 3. Generate Transaction Payload
const payload = publisher.preparePublishPayload(signal);

// 4. Sign and Submit (using your wallet adapter)
// const response = await signAndSubmitTransaction(payload);
```

## 🏗️ Architecture

This SDK is designed to be domain-agnostic. Whether you are analyzing weather, sentiment, or on-chain data, the `SignalPublisher` provides a consistent interface to the Movement network's `signal_registry`.

## 📚 API Reference

### `SignalPublisher`

- `constructor(config: SignalConfig)`
- `preparePublishPayload(signal: SignalData): TransactionPayload`
- `prepareTipPayload(analystAddress: string, signalId: string, amount: string): TransactionPayload`
- `getSignalCount(accountAddress: string): Promise<number>`

### `SignalConfig`

```typescript
interface SignalConfig {
  network?: Network; // 'mainnet' | 'testnet' | 'devnet' | 'custom'
  fullnode?: string; // RPC URL
  moduleAddress: string; // Address of the deployed signal_registry
}
```
