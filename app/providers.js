'use client';

import { QueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';


// Dynamic import to prevent chunk loading race conditions with wagmi/connectkit
const _WalletLayer = dynamic(
  () => import('./WalletLayer'),
  { ssr: false }
);

export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WalletLayer>
        <AptosProvider>
          {children}
        </AptosProvider>
      </WalletLayer>
    </QueryClientProvider>
  );
}
