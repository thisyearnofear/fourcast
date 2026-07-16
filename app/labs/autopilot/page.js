'use client';

import React from 'react';
import { AppShell } from '@/app/components/PageNav';
import AutopilotDashboard from '@/components/AutopilotDashboard';

export default function LabsAutopilotPage() {
  return (
    <AppShell
      title="Autopilot"
      subtitle="Experimental — Autonomous trade execution powered by Kelly Criterion sizing"
      maxWidth="max-w-4xl"
    >
      <AutopilotDashboard />
    </AppShell>
  );
}
