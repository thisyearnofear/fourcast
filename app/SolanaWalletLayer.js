'use client';

import { useMemo } from 'react';
import { AppProvider } from '@solana/connector/react';
import { getDefaultConfig, getDefaultMobileConfig } from '@solana/connector/headless';

/**
 * SolanaWalletLayer — ConnectorKit provider wrapping the app alongside wagmi.
 *
 * Uses @solana/connector (Solana Foundation's ConnectorKit, v0.2.6 Jul 2026)
 * for Wallet Standard auto-discovery (Phantom, Solflare, Backpack, etc.).
 * Cluster defaults to devnet where the match-escrow program is deployed.
 *
 * The legacy useTransactionSigner() hook works with the existing
 * @solana/web3.js Transaction objects used by OnChainSettlementPanel.
 */
export default function SolanaWalletLayer({ children }) {
  const connectorConfig = useMemo(() => {
    const customRpcUrl = process.env.SOLANA_RPC_URL ||
      (process.env.HELIUS_API_KEY
        ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
        : null);

    const clusters = customRpcUrl
      ? [
          { id: 'solana:devnet', label: 'Devnet', url: customRpcUrl },
          { id: 'solana:mainnet', label: 'Mainnet', url: 'https://api.mainnet-beta.solana.com' },
        ]
      : undefined;

    return getDefaultConfig({
      appName: 'Fourcast',
      appUrl: process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app',
      autoConnect: true,
      network: 'devnet',
      enableMobile: true,
      clusters,
      wallets: {
        allowList: ['Phantom', 'Solflare', 'Backpack'],
        featured: ['Phantom', 'Solflare'],
      },
    });
  }, []);

  const mobile = useMemo(
    () =>
      getDefaultMobileConfig({
        appName: 'Fourcast',
        appUrl: process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app',
      }),
    [],
  );

  return (
    <AppProvider connectorConfig={connectorConfig} mobile={mobile}>
      {children}
    </AppProvider>
  );
}
