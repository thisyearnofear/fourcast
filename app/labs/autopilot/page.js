'use client';

import { AppShell } from '@/app/components/PageNav';
import AutopilotDashboard from '@/components/AutopilotDashboard';
import OperatorMath from '@/components/OperatorMath';

export default function LabsAutopilotPage() {
  return (
    <AppShell
      title="Autopilot"
      subtitle="Kelly size · Builder fills"
      maxWidth="max-w-4xl"
    >
      <OperatorMath />
      <AutopilotDashboard />
    </AppShell>
  );
}