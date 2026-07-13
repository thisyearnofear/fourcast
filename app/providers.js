'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastProvider } from '@/components/ToastProvider';
import WalletLayer from './WalletLayer';

export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <WalletLayer>
          {children}
        </WalletLayer>
      </ToastProvider>
    </QueryClientProvider>
  );
}
