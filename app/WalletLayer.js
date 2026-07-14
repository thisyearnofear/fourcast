'use client';

import { WagmiProvider } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';
import { config } from '../onchain/config';

export default function WalletLayer({ children }) {
  return (
    <WagmiProvider config={config}>
      <ConnectKitProvider
        mode="dark"
        customTheme={{
          "--ck-accent-color": "#34d399",
          "--ck-accent-text": "#04110c",
          "--ck-primary-button-background": "#0f1a16",
          "--ck-primary-button-hover-background": "#1a2e26",
          "--ck-secondary-button-background": "#374151",
        }}
      >
        {children}
      </ConnectKitProvider>
    </WagmiProvider>
  );
}
