'use client';

import './global.css/index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';
import { config } from '../onchain/config';

const queryClient = new QueryClient();

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
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
              {children}
            </ConnectKitProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
