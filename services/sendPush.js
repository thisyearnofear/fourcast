/**
 * Web Push send. Node runtime only — web-push uses Node crypto.
 * A 404 or 410 means the browser dropped the subscription.
 */

let configured = false;

export function vapidConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function client() {
  return import('web-push').then((mod) => mod.default || mod);
}

async function webpush() {
  const webpush = await client();
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'https://fourcastapp.vercel.app',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    configured = true;
  }
  return webpush;
}

export async function sendReceiptPush(sub, payload) {
  const lib = await webpush();
  await lib.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
  );
}

export function pushGone(err) {
  const code = err?.statusCode || err?.status;
  return code === 404 || code === 410;
}
