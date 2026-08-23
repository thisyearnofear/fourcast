'use client';

import { useState } from 'react';

/**
 * GlowList — collapsible run-header wrapper for market card lists.
 *
 * Pattern: collapsed view shows a compact header with count + active filters.
 * Expanded view reveals cards via `grid-template-rows` animation (same grammar
 * as ThinkingState / ToolChips). Cards stagger independently via the Reveal
 * children.
 *
 * Props:
 *   count      — total items (shown in header)
 *   children   — rendered market card rows (wrapped in Reveal by caller)
 *   defaultOpen — whether to start expanded
 *   renderSummary — optional function to render custom filter chips
 */
export default function GlowList({
  count,
  children,
  defaultOpen = false,
  renderSummary,
  emptyLabel,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col gap-2">
      {/* Run header — shared across variants */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-control px-1.5 py-1 text-[13px] font-medium text-ink-2 transition-colors duration-100 hover:bg-hover-2"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-300"
          style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}
          aria-hidden
        />
        <span>
          {count} market{count !== 1 ? 's' : ''}
          {renderSummary && ' · '}
        </span>
        {renderSummary && renderSummary()}
      </button>

      {/* Expandable content */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-400"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        <div className="overflow-hidden">
          {children}
          {open && !emptyLabel && !children && (
            <span className="text-[12px] text-ink-3">No markets to display</span>
          )}
        </div>
      </div>
    </div>
  );
}
