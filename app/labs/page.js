'use client';

import React from 'react';
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
      <section className="mb-6 border-b border-[var(--color-wash)] py-3">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LAB_FEATURES.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </div>
    </AppShell>
  );
}

function FeatureCard({ feature }) {
  const isStable = feature.status === 'stable';
  const isCore = feature.status === 'core';
  const isExternal = feature.external;
  const Icon = feature.icon;

  const extraProps = isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <a
      href={feature.href}
      {...extraProps}
      className="group flex flex-col border border-[var(--color-rule)] bg-white/[0.02] p-4 no-underline transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/[0.04]"
    >
      <div className="w-10 h-10 border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)] mb-3">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>

      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          {feature.title}
        </h3>
        <span className={`px-1.5 py-0.5 text-[9px] font-medium ${
          isCore ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
          : isStable ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
          : 'bg-[var(--color-sealed)]/15 text-[var(--color-sealed)]'
        }`}>
          {isCore ? 'Core' : isStable ? 'Stable' : 'Beta'}
        </span>
        {isExternal && <ArrowUpRight className="h-3 w-3 text-[var(--color-ink-faint)]" />}
      </div>

      <p className="flex-1 text-xs leading-relaxed text-[var(--color-ink-faint)]">
        {feature.description}
      </p>

      <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-[var(--color-accent)] opacity-0 transition-opacity group-hover:opacity-100">
        {isExternal ? 'Open' : 'Explore'}
        <ArrowRight className="h-3 w-3" />
      </div>
    </a>
  );
}
