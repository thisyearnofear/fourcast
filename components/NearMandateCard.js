'use client';

import { useEffect, useState } from 'react';

/**
 * NearMandateCard — surfaces the on-chain mandate and the agent's
 * chain-signature-derived EVM account inside the Arena Mandate lane.
 * Read-only. Amounts are USD. A failed read says so and links the contract.
 */
const CONTRACT_URL = 'https://testnet.nearblocks.io/address/inexpensive-mother.testnet';

/** Contract notionals are 6-decimal USD micros. */
function usd(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  return `$${(n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function NearMandateCard({ variant = 'lane' }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/near/mandate')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d?.success) setData(d);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  const hero = variant === 'hero';
  const signed = data ? Number(data.lastTradeNs) > 0 : false;

  return (
    <section className={hero
      ? 'mt-3 w-full text-left'
      : 'border-t border-b border-[var(--color-rule)] px-2 py-3 sm:px-3'}
    >
      <p className="mc-kicker mb-2">On-chain mandate</p>
      {!data && (
        <p className="font-mono text-[11px] text-[var(--color-ink-faint)]">
          {failed ? (
            <a href={CONTRACT_URL} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] no-underline hover:opacity-80">
              Contract unread from here — open it on NEAR
            </a>
          ) : 'Reading the contract…'}
        </p>
      )}
      {data && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
            <a
              href={data.contractUrl || CONTRACT_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent)] no-underline hover:opacity-80"
              title="Mandate contract on NEAR"
            >
              {data.contract}
            </a>
            <span className="text-[var(--color-ink-faint)]">
              venues {data.allowedVenues?.join(' · ')}
            </span>
            <span className="text-[var(--color-ink-faint)]">
              cap {usd(data.maxNotional)}
            </span>
            <span className="text-[var(--color-ink-faint)]">
              floor {usd(data.minLiquidity)}
            </span>
            <span className="text-[var(--color-ink-faint)]">
              slippage ≤{data.maxSlippageBps} bps
            </span>
            <span className="text-[var(--color-ink-faint)]">
              cooldown {data.cooldownSecs}s
            </span>
            <span className="text-[var(--color-ink-muted)]">
              {signed ? 'a signature has been requested' : 'no signature requested yet'}
            </span>
            {data.approvedCodeHash && (
              <span className="text-[var(--color-ink-faint)]" title="Approved worker code hash — signature requests with a different hash are refused">
                code {data.approvedCodeHash.slice(0, 18)}…
              </span>
            )}
          </div>
          <p className="mt-2 font-mono text-[10px] text-[var(--color-ink-faint)]">
            agent EVM <span className="text-[var(--color-ink-muted)]">{data.evmAddress}</span>
            {' '}· derived via chain signatures ({data.path}) — no private key exists
          </p>
        </>
      )}
    </section>
  );
}

export default NearMandateCard;
