'use client';

import { AppShell } from '@/app/components/PageNav';
import NotificationsPanel from '@/components/NotificationsPanel';

/**
 * Transitional route — canonical home is now the Signals "Alerts" tab
 * (next.config redirects /notifications → /signals?tab=alerts). Kept as a
 * thin wrapper so deep links degrade gracefully if the redirect is removed.
 */
export default function NotificationsPage() {
  return (
    <AppShell title="Notifications" subtitle="Alerts from analysts you follow" maxWidth="max-w-[720px]">
      <NotificationsPanel />
    </AppShell>
  );
}
