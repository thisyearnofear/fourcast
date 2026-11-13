/** Pure rules for receipt push. No browser and no keys. */

const FIXTURE = /^\d{1,12}$/;

export function pushableChange(previous, next) {
  if (previous == null || previous === '' || next == null || next === '') return false;
  return String(previous) !== String(next);
}

export function pushPromptState({ pushManager, ios, standalone }) {
  if (ios && !standalone) return 'install';
  if (!pushManager) return 'unsupported';
  return 'ready';
}

export function cleanSubscription(body) {
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== 'string' || endpoint.length > 2000 || !endpoint.startsWith('https://')) return null;
  if (typeof p256dh !== 'string' || p256dh.length < 16 || p256dh.length > 200) return null;
  if (typeof auth !== 'string' || auth.length < 8 || auth.length > 64) return null;
  return { endpoint, p256dh, auth };
}

export function cleanWatches(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const fixtureId = String(row?.fixtureId || '').trim();
    if (!FIXTURE.test(fixtureId) || seen.has(fixtureId)) continue;
    seen.add(fixtureId);
    out.push({
      fixtureId,
      home: row.home ? String(row.home).slice(0, 80) : null,
      away: row.away ? String(row.away).slice(0, 80) : null,
    });
    if (out.length === 5) break;
  }
  return out;
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
