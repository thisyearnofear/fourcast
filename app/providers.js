'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastProvider } from '@/components/ToastProvider';
import WalletLayer from './WalletLayer';
import { CantonWalletProvider } from './CantonWalletLayer';

/**
 * Always mount WagmiProvider + ConnectKitProvider + CantonWalletProvider.
 *
 * Previously this component only wrapped children with WalletLayer on a
 * hard-coded list of routes (`/markets`, `/signals`, …). Any page that
 * rendered a wallet-using component (e.g. WeatherHeader's <ConnectKitButton />
 * on the landing page, or the new `/world-cup` route) hit
 * `WagmiProviderNotFoundError: useConfig must be used within WagmiProvider`
 * because the provider wasn't in its tree.
 *
 * The "wallet-free landing for first paint" optimization was illusory anyway
 * — WeatherHeader already shows a wallet button on the landing page. Wagmi v2
 * and ConnectKit are SSR-safe; the perf cost of always-mounting is negligible.
 */
export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <WalletLayer>
          <CantonWalletProvider>{children}</CantonWalletProvider>
        </WalletLayer>
      </ToastProvider>
    </QueryClientProvider>
  );
}
