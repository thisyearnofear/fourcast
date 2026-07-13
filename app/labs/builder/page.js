'use client';

import React from 'react';
import { AppShell } from '@/app/components/PageNav';
import { BuilderDashboard } from '@/components/BuilderDashboard';

export default function LabsBuilderPage() {
  return (
    <AppShell
      title="🧪 Builder"
      subtitle="Experimental — Polymarket Builder Program volume tracking & gasless trading"
      maxWidth="max-w-4xl"
    >
      <div className="mx-auto max-w-md">
        <BuilderDashboard isNight={true} />
      </div>
    </AppShell>
  );
}
