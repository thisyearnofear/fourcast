'use client';

import dynamic from 'next/dynamic';
import { AppShell } from '@/app/components/PageNav';

const CantonHolderDashboard = dynamic(() => import('@/components/CantonHolderDashboard'), {
  ssr: false,
  loading: () => (
    <div className="platform-open-section p-8 text-center text-xs text-[var(--color-ink-faint)]">
      Loading holder wallet…
    </div>
  ),
});

export default function CantonHolderPage() {
  return (
    <AppShell
      title="Holder Wallet"
      subtitle="Connect your Console Wallet to view private positions and dispute unsettled obligations on Canton Devnet."
      maxWidth="max-w-4xl"
    >
      <CantonHolderDashboard />
    </AppShell>
  );
}
