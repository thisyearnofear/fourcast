'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, Hammer, MessageCircle, FlaskConical, ArrowUpRight, ArrowRight, Zap } from 'lucide-react';
import { AppShell } from '@/app/components/PageNav';
import { BRAND } from '@/constants/brand';

const LAB_FEATURES = [
  {
    id: 'autopilot',
    title: BRAND.labs.autopilot.title,
    description: BRAND.labs.autopilot.description,
    href: '/labs/autopilot',
    icon: Bot,
    status: BRAND.labs.autopilot.status,
  },
  {
    id: 'canton',
    title: 'Canton ops',
    description: 'Create, resolve, settle private CBTC markets.',
    href: '/labs/canton',
    icon: Zap,
    status: 'core',
  },
  {
    id: 'builder',
    title: 'Builder Program',
    description: BRAND.labs.builder.description,
    href: '/labs/builder',
    icon: Hammer,
    status: 'beta',
  },
  {
    id: 'telegram',
    title: 'Telegram Bot',
    description: '@fourcasterbot — /edge without a wallet.',
    href: 'https://t.me/fourcasterbot',
    icon: MessageCircle,
    status: 'stable',
    external: true,
  },
];

export default function LabsPage() {
  return (
    <AppShell title="Labs" subtitle={BRAND.labs.subtitle} maxWidth="max-w-5xl">
      <section className="mb-4 border-b border-[var(--color-wash)] py-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            <FlaskConical className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <p className="mc-kicker mb-0.5">Execution tools</p>
            <p className="text-xs text-[var(--color-ink-faint)]">
              Autopilot, Builder attribution, Canton ops.
            </p>
          </div>
        </div>
      </section>

      {/* Linked rows — workbench voice, not icon-tile cards */}
      <div className="border-t border-[var(--color-rule-strong)] border-b border-[var(--color-rule)]">
        {LAB_FEATURES.map((feature) => (
          <LabRow key={feature.id} feature={feature} />
        ))}
      </div>
    </AppShell>
  );
}

function LabRow({ feature }) {
  const Icon = feature.icon;
  const isExternal = feature.external;
  const isBeta = feature.status === 'beta';

  const row = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)] transition-colors group-hover:text-[var(--color-accent)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">{feature.title}</h3>
          <span
            className={`px-1.5 py-0.5 text-[9px] font-medium ${
              isBeta
                ? 'bg-[var(--color-sealed)]/15 text-[var(--color-sealed)]'
                : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
            }`}
          >
            {isBeta ? 'Beta' : feature.status === 'core' ? 'Core' : 'Stable'}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-ink-faint)]">
          {feature.description}
        </p>
      </div>
      {isExternal ? (
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-faint)] transition-colors group-hover:text-[var(--color-accent)]" aria-hidden />
      ) : (
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-faint)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]" aria-hidden />
      )}
    </>
  );

  const cls =
    'group flex items-center gap-3 border-t border-[var(--color-rule)] px-1 py-4 no-underline transition-colors first:border-t-0 hover:bg-white/[0.03] sm:px-3';

  return isExternal ? (
    <a href={feature.href} target="_blank" rel="noopener noreferrer" className={cls}>
      {row}
    </a>
  ) : (
    <Link href={feature.href} className={cls}>
      {row}
    </Link>
  );
}
