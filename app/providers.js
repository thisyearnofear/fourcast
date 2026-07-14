'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ToastProvider } from '@/components/ToastProvider';
import WalletLayer from './WalletLayer';
import { CantonWalletProvider } from './CantonWalletLayer';

/** Routes that need wagmi/ConnectKit. Landing stays wallet-free for first paint. */
const WALLET_PREFIXES = [
  '/markets',
  '/signals',
  '/signal',
  '/positions',
  '/labs',
  '/agent',
  '/notifications',
];

function routeNeedsWallet(pathname) {
  if (!pathname) return false;
  return WALLET_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Landing skips WagmiProvider mount (faster init).
 * Wallet routes always wrap so SSR + wagmi hooks stay valid.
 */
export function Providers({ children }) {
  const pathname = usePathname();
  const [queryClient] = useState(() => new QueryClient());
  const withWallet = routeNeedsWallet(pathname);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {withWallet ? (
          <WalletLayer>
            <CantonWalletProvider>{children}</CantonWalletProvider>
          </WalletLayer>
        ) : children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
