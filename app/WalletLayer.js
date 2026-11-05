'use client';

import { WagmiProvider } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';
import { config } from '../onchain/config';
import { BRAND_HEX } from '@/constants/brandColors';

export default function WalletLayer({ children }) {
  return (
    <WagmiProvider config={config}>
      <ConnectKitProvider
        mode="dark"
        customTheme={{
          "--ck-accent-color": BRAND_HEX.accent,
          "--ck-accent-text": BRAND_HEX.accentInk,
          "--ck-primary-button-background": BRAND_HEX.paper,
          "--ck-primary-button-hover-background": BRAND_HEX.paperRaised,
          "--ck-secondary-button-background": BRAND_HEX.paperSoft,
        }}
      >
        {children}
      </ConnectKitProvider>
    </WagmiProvider>
  );
}
