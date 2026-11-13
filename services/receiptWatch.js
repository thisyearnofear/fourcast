/**
 * Recheck watched receipts and push when a stored status changes.
 * The first status a watch has ever seen is stored and not announced.
 */

import { GET as verifyFixture } from '@/app/api/worldcup/verify/route';
import { receiptPhrase } from '@/utils/watchedReceipts';
import { pushableChange } from '@/utils/receiptPush';
import { deletePushSubscription, listPushWatches, setPushWatchStatus } from '@/services/db';
import { pushGone, sendReceiptPush, vapidConfigured } from '@/services/sendPush';

async function statusFor(fixtureId) {
  const res = await verifyFixture(new Request(`https://fourcast.local/api/txline/verify?fixtureId=${fixtureId}`));
  if (!res.ok) return null;
  const data = await res.json();
  return data?.reconciliation?.status || null;
}

function payloadFor(row, status) {
  const name = row.home && row.away ? `${row.home} v ${row.away}` : `Fixture ${row.fixture_id}`;
  return {
    title: `${name} changed`,
    body: receiptPhrase(status, true),
    url: `/world-cup?fixture=${encodeURIComponent(row.fixture_id)}`,
    tag: `receipt-${row.fixture_id}`,
  };
}

export async function checkReceiptWatches() {
  if (!vapidConfigured()) return { success: true, skipped: 'vapid', checked: 0, sent: 0 };
  const rows = await listPushWatches();
  const groups = new Map();
  for (const row of rows) {
    const list = groups.get(row.fixture_id) || [];
    list.push(row);
    groups.set(row.fixture_id, list);
  }

  let sent = 0;
  let pruned = 0;
  for (const [fixtureId, group] of groups) {
    const status = await statusFor(fixtureId);
    if (!status) continue;
    for (const row of group) {
      if (!pushableChange(row.last_status, status)) {
        if (row.last_status !== status) await setPushWatchStatus(row.endpoint, fixtureId, status);
        continue;
      }
      try {
        await sendReceiptPush(row, payloadFor(row, status));
        await setPushWatchStatus(row.endpoint, fixtureId, status);
        sent += 1;
      } catch (err) {
        if (pushGone(err)) {
          await deletePushSubscription(row.endpoint);
          pruned += 1;
        }
      }
    }
  }
  return { success: true, checked: groups.size, sent, pruned };
}
