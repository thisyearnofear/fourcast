'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';
import { AptosProvider } from './providers/AptosProvider';
import { config } from '../onchain/config';
import { useState } from 'react';

export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <ConnectKitProvider
          mode="dark"
          customTheme={{
            "--ck-accent-color": "#2563eb",
            "--ck-accent-text": "#ffffff",
            "--ck-primary-button-background": "#1f2937",
            "--ck-primary-button-hover-background": "#374151",
            "--ck-secondary-button-background": "#6b7280",
          }}
        >
          <AptosProvider>
            {children}
          </AptosProvider>
        </ConnectKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

