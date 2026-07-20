'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastProvider } from '@/components/ToastProvider';
import WalletLayer from './WalletLayer';
import SolanaWalletLayer from './SolanaWalletLayer';
import { CantonWalletProvider } from './CantonWalletLayer';

/**
 * Always mount WagmiProvider + ConnectKitProvider + CantonWalletProvider +
 * SolanaWalletLayer (ConnectorKit).
 *
 * Wagmi covers EVM chains (Arc, Polygon, Arbitrum, BSC).
 * ConnectorKit covers Solana (Phantom, Solflare, Backpack) via Wallet Standard.
 * CantonWalletProvider covers private settlement.
 *
 * Both wallet layers are SSR-safe and always mounted so any page can use
 * either chain family without provider-missing errors.
 */
export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <WalletLayer>
          <SolanaWalletLayer>
            <CantonWalletProvider>{children}</CantonWalletProvider>
          </SolanaWalletLayer>
        </WalletLayer>
      </ToastProvider>
    </QueryClientProvider>
  );
}
