'use client';

import React from 'react';
import { Bot, Hammer, MessageCircle, FlaskConical, ArrowUpRight, ArrowRight } from 'lucide-react';
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
    gradient: 'from-emerald-600 to-teal-500',
  },
  {
    id: 'builder',
    title: 'Builder Program',
    description: BRAND.labs.builder.description,
    href: '/labs/builder',
    icon: Hammer,
    status: 'beta',
    gradient: 'from-amber-600 to-emerald-500',
  },
  {
    id: 'telegram',
    title: 'Telegram Bot',
    description: '@fourcasterbot — query /edge commands via messaging without a wallet.',
    href: 'https://t.me/fourcasterbot',
    icon: MessageCircle,
    status: 'stable',
    external: true,
    gradient: 'from-emerald-500 to-cyan-500',
  },
];

export default function LabsPage() {
  return (
    <AppShell title="Labs" subtitle={BRAND.labs.subtitle} maxWidth="max-w-5xl">
      {/* Labs Notice */}
      <div className="mb-10 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
            <FlaskConical className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium text-white">
              Execution &amp; monetization
            </h3>
            <p className="text-xs leading-relaxed text-white/[0.55]">
              Autopilot runs the agent loop with real order execution. Builder Program
              attributes fills for USDC builder fees. Telegram is a supporting tool.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 no-underline transition-all hover:border-white/20 hover:bg-white/[0.08]"
    >
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white shadow-lg mb-4`}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>

      {/* Title + Status */}
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-base font-medium text-white">
          {feature.title}
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
          isCore ? 'bg-emerald-500/15 text-emerald-300'
            : isStable ? 'bg-emerald-500/15 text-emerald-300'
            : 'bg-amber-500/15 text-amber-300'
        }`}>
          {isCore ? 'Core' : isStable ? 'Stable' : 'Beta'}
        </span>
        {isExternal && <ArrowUpRight className="h-3 w-3 text-white/30" />}
      </div>

      {/* Description */}
      <p className="flex-1 text-xs leading-relaxed text-white/50">
        {feature.description}
      </p>

      {/* Hover arrow */}
      <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-emerald-300 opacity-0 transition-opacity group-hover:opacity-100">
        {isExternal ? 'Open' : 'Explore'}
        <ArrowRight className="h-3 w-3" />
      </div>
    </a>
  );
}
