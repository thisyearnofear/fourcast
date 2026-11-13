'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readWatched, receiptPhrase, watchReceipt } from '@/utils/watchedReceipts';
import { pushPromptState, urlBase64ToUint8Array } from '@/utils/receiptPush';
import ReceiptCall from '@/components/ReceiptCall';

const NOTIFY_KEY = 'fourcast:watch-notify';
const ENDPOINT_KEY = 'fourcast:push-endpoint';

export default function WatchedReceipts() {
  const [rows, setRows] = useState([]);
  const [notify, setNotify] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [hint, setHint] = useState('');

  useEffect(() => {
    try {
      setNotify(window.localStorage.getItem(NOTIFY_KEY) === '1' && Notification.permission === 'granted');
      setPushOn(Boolean(window.localStorage.getItem(ENDPOINT_KEY)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let alive = true;

    async function recheck() {
      const current = readWatched();
      if (current.length === 0) {
        if (alive) setRows([]);
        return;
      }
      const checked = await Promise.all(current.map(async (row) => {
        try {
          const res = await fetch(`/api/txline/verify?fixtureId=${encodeURIComponent(row.fixtureId)}`);
          const data = await res.json();
          const status = data?.reconciliation?.status || null;
          const changed = Boolean(row.status && status && row.status !== status);
          watchReceipt({
            fixtureId: row.fixtureId,
            home: row.home,
            away: row.away,
            hash: data?.receipt?.integrity?.contentHash || row.hash,
            status,
          }, { silent: true });
          if (changed && !window.localStorage.getItem(ENDPOINT_KEY) && window.localStorage.getItem(NOTIFY_KEY) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const name = row.home && row.away ? `${row.home} v ${row.away}` : `Fixture ${row.fixtureId}`;
            try {
              new Notification(`${name} changed`, { body: receiptPhrase(status, true) });
            } catch { /* a browser can refuse even after a grant */ }
          }
          return { ...row, status, changed };
        } catch {
          return { ...row, changed: false, unread: true };
        }
      }));
      if (checked.some((row) => row.changed) && window.localStorage.getItem(ENDPOINT_KEY)) {
        fetch('/api/push/check', { method: 'POST' }).catch(() => {});
      }
      if (alive) setRows(checked);
    }

    recheck();
    const onWatch = () => { recheck(); };
    window.addEventListener('fourcast:watched', onWatch);
    const timer = window.setInterval(recheck, 120000);
    return () => {
      alive = false;
      window.removeEventListener('fourcast:watched', onWatch);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function sync() {
      let endpoint = '';
      try { endpoint = window.localStorage.getItem(ENDPOINT_KEY) || ''; } catch { return; }
      if (!endpoint) return;
      fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ syncOnly: true, endpoint, watches: readWatched() }),
      }).catch(() => {});
    }
    sync();
    window.addEventListener('fourcast:watched', sync);
    return () => window.removeEventListener('fourcast:watched', sync);
  }, []);

  async function enableLocal(message) {
    if (typeof Notification === 'undefined') {
      setHint(message);
      return;
    }
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setNotify(granted);
    setHint(granted ? message : 'The browser kept notifications off.');
    try {
      window.localStorage.setItem(NOTIFY_KEY, granted ? '1' : '0');
    } catch { /* ignore */ }
  }

  async function enableNotify() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const state = pushPromptState({
      pushManager: typeof window.PushManager !== 'undefined',
      ios,
      standalone,
    });
    if (state === 'install') {
      setHint('On iPhone, add Fourcast to your Home Screen and open it from the icon, then ask again.');
      return;
    }
    if (state === 'unsupported' || typeof Notification === 'undefined') {
      await enableLocal('This browser can only tell you while a Fourcast tab is open.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setNotify(false);
      try { window.localStorage.setItem(NOTIFY_KEY, '0'); } catch { /* ignore */ }
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const keyRes = await fetch('/api/push/public-key');
      if (!keyRes.ok) {
        await enableLocal('This host still needs push keys. A change shows while this tab is open.');
        return;
      }
      const { publicKey } = await keyRes.json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      const saved = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...json, watches: readWatched() }),
      });
      if (!saved.ok || !json.endpoint) {
        await enableLocal('The subscription did not save. A change shows while this tab is open.');
        return;
      }
      window.localStorage.setItem(ENDPOINT_KEY, json.endpoint);
      window.localStorage.setItem(NOTIFY_KEY, '1');
      setNotify(true);
      setPushOn(true);
      setHint('You will hear about a change after this tab is closed.');
    } catch {
      await enableLocal('Push did not start. A change shows while this tab is open.');
    }
  }

  return (
    <section className="relative z-10 border-t border-[var(--color-rule)] px-4 py-4 sm:px-6">
      <p className="mc-kicker">Receipts you are watching</p>
      {rows.length > 0 && !pushOn && (
        <button type="button" onClick={enableNotify} className="fc-action fc-action--quiet mt-2 px-2.5 py-1.5 text-[12px]">
          Notify me when one changes
        </button>
      )}
      {hint && (
        <p className="mt-2 max-w-xl text-sm text-[var(--color-ink-muted)]">{hint}</p>
      )}
      {rows.length === 0 ? (
        <p className="mt-2 max-w-xl text-sm text-[var(--color-ink-muted)]">
          Open a receipt, or a link someone sent you. This page tells you when it resolves.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => {
            const name = row.home && row.away ? `${row.home} v ${row.away}` : `Fixture ${row.fixtureId}`;
            return (
              <li key={row.fixtureId} className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/world-cup?fixture=${encodeURIComponent(row.fixtureId)}`}
                  className="text-sm text-[var(--color-ink)] no-underline hover:text-[var(--color-accent)]"
                >
                  {name}
                </Link>
                <span className="font-mono text-[11px] text-[var(--color-ink-muted)]">
                  {row.unread ? 'Could not recheck.' : receiptPhrase(row.status, row.changed)}
                </span>
                <ReceiptCall fixtureId={row.fixtureId} compact />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
