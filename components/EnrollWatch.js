'use client';

import { useEffect } from 'react';
import { watchReceipt } from '@/utils/watchedReceipts';

/** Opening a fixture, including a shared link, joins the return loop. */
export default function EnrollWatch() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fixtureId = params.get('fixture') || params.get('fixtureId');
    if (!fixtureId) return;
    watchReceipt({ fixtureId });
  }, []);
  return null;
}
