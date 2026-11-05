'use client';

import { useEffect, useState } from 'react';

/**
 * NearMandateCard — surfaces the on-chain mandate and the agent's
 * chain-signature-derived EVM account inside the Arena Mandate lane.
 * Read-only; renders nothing when the contract is unreachable (quiet
 * by design — same honesty rule as the rest of the rail).
 */
export function NearMandateCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/near/mandate')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d?.success && setData(d))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!data) return null;

  return (
    <section className="border-t border-b border-[var(--color-rule)] px-2 py-3 sm:px-3">
      <p className="mc-kicker mb-2">On-chain mandate</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
        <a
          href={data.contractUrl}
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
          cap {Number(data.maxNotional).toLocaleString()}
        </span>
        <span className="text-[var(--color-ink-faint)]">
          cooldown {data.cooldownSecs}s
        </span>
      </div>
      <p className="mt-2 font-mono text-[10px] text-[var(--color-ink-faint)]">
        agent EVM <span className="text-[var(--color-ink-muted)]">{data.evmAddress}</span>
        {' '}· derived via chain signatures ({data.path}) — no private key exists
      </p>
    </section>
  );
}

export default NearMandateCard;
