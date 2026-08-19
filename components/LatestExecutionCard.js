'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { timeAgo as ago } from '@/utils/arenaUi';

/**
 * LatestExecutionCard — surfaces the most recent live arena execution.
 * Pulls from /api/arena/feed; renders nothing while empty or loading.
 * Product-native proof surface — no venue names in the frame.
 */

function shortenQuestion(q) {
  if (!q) return 'Market';
  return q.length > 72 ? `${q.slice(0, 69)}…` : q;
}

function findLatestExecution(runs) {
  for (const run of runs || []) {
    for (const exec of run.executions || []) {
      if (exec.status === 'executed' && exec.txHash) {
        return { ...exec, runTs: run.timestamp };
      }
    }
  }
  return null;
}

export default function LatestExecutionCard() {
  const [exec, setExec] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/arena/feed?limit=15')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d?.success) return;
          setExec(findLatestExecution(d.runs));
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!exec) return null;

  const explorer = exec.txHash
    ? `https://gensyn-testnet.explorer.alchemy.com/tx/${exec.txHash}`
    : null;

  return (
    <div className="fc-instrument mt-4 overflow-hidden p-1">
      <div className="fc-instrument__inner flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
            Latest live execution · {ago(exec.runTs)}
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-[var(--color-ink)]">
            {exec.shares} sh <span className="text-[var(--color-accent)]">{exec.outcome}</span>
          </p>
          <p className="mt-1 max-w-lg text-xs leading-5 text-[var(--color-ink-muted)]">
            {shortenQuestion(exec.question)}
          </p>
          {exec.cost != null && (
            <p className="mt-2 font-mono text-[11px] text-[var(--color-ink-faint)]">
              {exec.cost.toFixed(3)} TST · policy-gated · hash-bound before settlement
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2">
          <Link
            href="/arena"
            className="fc-action inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm"
          >
            Open ledger
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {explorer && (
            <a
              href={explorer}
              target="_blank"
              rel="noreferrer"
              className="mc-nav-link no-underline inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              On-chain tx
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
