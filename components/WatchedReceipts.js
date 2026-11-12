'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readWatched, receiptPhrase, watchReceipt } from '@/utils/watchedReceipts';

export default function WatchedReceipts() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = () => setRows(readWatched());
    load();
    window.addEventListener('fourcast:watched', load);

    (async () => {
      const current = readWatched();
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
          });
          return { ...row, status, changed };
        } catch {
          return { ...row, changed: false, unread: true };
        }
      }));
      if (alive) setRows(checked);
    })();

    return () => {
      alive = false;
      window.removeEventListener('fourcast:watched', load);
    };
  }, []);

  return (
    <section className="relative z-10 border-t border-[var(--color-rule)] px-4 py-4 sm:px-6">
      <p className="mc-kicker">Receipts you are watching</p>
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
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
