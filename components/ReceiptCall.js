'use client';

import { useEffect, useState } from 'react';
import { getClientId } from '@/utils/clientId';

/**
 * A public yes/no on whether a sealed call held.
 * Counts come from the server. Zero is shown as "no judgments yet".
 */
export default function ReceiptCall({ fixtureId, onVote, compact = false }) {
  const [tally, setTally] = useState(null);
  const [error, setError] = useState(null);
  const [sentCall, setSentCall] = useState(null);

  useEffect(() => {
    if (!fixtureId) return undefined;
    let alive = true;
    const client = getClientId();
    fetch(`/api/receipts/judgments?fixtureId=${encodeURIComponent(fixtureId)}`, {
      headers: client ? { 'x-fourcast-client': client } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data?.success) {
          setTally(data);
          if (typeof data.mine === 'boolean') onVote?.(data.mine ? 'holds' : 'breaks');
        } else setError(data?.error || 'Judgments unavailable');
      })
      .catch(() => alive && setError('Judgments unavailable'));
    const params = new URLSearchParams(window.location.search);
    const sameFixture = params.get('fixture') === String(fixtureId);
    const call = params.get('call');
    if (sameFixture && (call === 'holds' || call === 'breaks')) setSentCall(call);
    return () => { alive = false; };
  }, [fixtureId, onVote]);

  async function vote(holds) {
    setError(null);
    const client = getClientId();
    if (!client) {
      setError('This browser cannot store a vote');
      return;
    }
    const res = await fetch('/api/receipts/judgments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-fourcast-client': client },
      body: JSON.stringify({ fixtureId, holds }),
    });
    const data = await res.json();
    if (!data?.success) {
      setError(data?.error || 'Could not record that');
      return;
    }
    setTally(data);
    onVote?.(holds ? 'holds' : 'breaks');
  }

  if (!fixtureId) return null;
  const total = (tally?.holds || 0) + (tally?.breaks || 0);
  const mine = tally?.mine;

  return (
    <div className={compact ? 'mt-1' : 'mt-3'}>
      {sentCall && (
        <p className="mb-2 text-[12px] text-[var(--color-ink-muted)]">
          {sentCall === 'holds' ? 'The person who sent this says the call holds.' : 'The person who sent this says the call does not hold.'}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={mine === true}
          onClick={() => vote(true)}
          className={`px-2.5 py-1.5 text-[12px] ${mine === true ? 'fc-action' : 'fc-action fc-action--quiet'}`}
        >
          It holds
        </button>
        <button
          type="button"
          aria-pressed={mine === false}
          onClick={() => vote(false)}
          className={`px-2.5 py-1.5 text-[12px] ${mine === false ? 'fc-action' : 'fc-action fc-action--quiet'}`}
        >
          It doesn&apos;t
        </button>
        <span className="font-mono text-[11px] text-[var(--color-ink-faint)]">
          {tally == null && !error ? 'Reading judgments…' : null}
          {tally && total === 0 ? 'No judgments yet' : null}
          {tally && total > 0 ? `${tally.holds} hold · ${tally.breaks} don’t` : null}
        </span>
      </div>
      {error && <p className="mt-1 text-[12px] text-[var(--color-breach)]">{error}</p>}
    </div>
  );
}
