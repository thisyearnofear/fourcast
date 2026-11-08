'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { BRAND } from "@/constants/brand";
import useAnchoredMenu from "@/hooks/useAnchoredMenu";
import useTabArrowKeys from "@/hooks/useTabArrowKeys";
import WalletConnect from "@/app/components/WalletConnect";
import SystemHealthMenu from "@/app/components/SystemHealthMenu";
import AudienceSwitcher from "@/app/components/AudienceSwitcher";
import { replayTour } from "@/components/RouteGuide";

/**
 * Navigation + AppShell — the single source of truth for the app chrome.
 *
 * Venue loop: Markets → act → Positions, with Private (Canton) as differentiator.
 * Design language: floating glass header, charcoal/emerald tokens, dark-first.
 */

/**
 * Nav architecture (as implemented — verified 2026-09-29):
 *  - PRIMARY_NAV: Markets · Positions · Arena · Private (always visible)
 *  - OVERFLOW_NAV: Signals · Agent · Labs
 *  - UTILITY: tour replay + audience switcher
 *
 * `/agent` redirects to `/arena?lane=mandate` and `/notifications` to
 * `/signals?tab=alerts` (next.config.mjs), so neither is a nav destination.
 *
 * Labels overridden via BRAND.navLabels in constants/brand.js.
 */
const PRIMARY_NAV = [
  { name: BRAND.navLabels.markets ?? "Markets", href: "/markets", match: "/markets", description: BRAND.nav.markets, onboardId: "markets" },
  { name: BRAND.navLabels.positions ?? "Positions", href: "/positions", match: "/positions", description: BRAND.nav.positions, onboardId: "positions" },
  { name: BRAND.navLabels.arena ?? "Arena", href: "/arena", match: "/arena", description: BRAND.nav.arena, onboardId: "agent" },
  { name: BRAND.navLabels.canton ?? "Private", href: "/proof?chain=canton", match: "/proof", description: BRAND.nav.canton, onboardId: "world-cup" },
];

const OVERFLOW_NAV = [
  { name: BRAND.navLabels.signals ?? "Signals", href: "/signals", match: "/signals", description: BRAND.nav.signals, onboardId: "publish" },
  { name: BRAND.navLabels.agent ?? "Agent", href: "/arena?lane=mandate", match: "/arena", description: BRAND.nav.agent, onboardId: "agent" },
  { name: BRAND.navLabels.labs ?? "Labs", href: "/labs", match: "/labs", description: BRAND.nav.labs },
];

// Utility entry — replaying the tour also navigates to a live lane (the
// /agent redirect resolves to /arena?lane=mandate), same as the old header
// sparkles button did.
const TOUR_ITEM = {
  name: "Replay tour",
  href: "/agent",
  description: "Re-run the route guides",
  onSelect: replayTour,
};

function pathMatches(pathname, item) {
  const match = item.match || item.href.split("?")[0];
  if (match === "/") return pathname === "/";
  return pathname?.startsWith(match);
}

function useIsActive() {
  const pathname = usePathname();
  return (item) => pathMatches(pathname, typeof item === "string" ? { href: item } : item);
}

function MenuPanel({ coords, menuRef, items, isActive, ariaLabel, onClose }) {
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      style={{ top: coords.top, right: coords.right }}
      className="fc-menu-pop fixed z-[var(--z-menu)] w-56 border border-[var(--color-rule-strong)] bg-[var(--color-paper-raised)] p-1 shadow-xl backdrop-blur-[18px] backdrop-saturate-[1.2]"
    >
      {items.map((item) => (
        <Link
          key={item.name}
          href={item.href}
          role="menuitem"
          data-onboard={item.onboardId}
          title={item.description}
          aria-current={isActive?.(item) ? "page" : undefined}
          onClick={() => {
            item.onSelect?.();
            onClose();
          }}
          className={`flex w-full flex-col gap-0.5 px-2.5 py-2 text-left text-[11px] uppercase tracking-[0.1em] no-underline transition-colors ${
            isActive?.(item)
              ? "bg-[var(--color-accent-quiet)] text-[var(--color-accent)]"
              : "text-[var(--color-ink)] hover:bg-white/[0.04]"
          }`}
        >
          <span className="font-semibold">{item.name}</span>
          {item.description && (
            <span className="text-[10px] font-normal normal-case tracking-normal text-[var(--color-ink-muted)]">
              {item.description}
            </span>
          )}
        </Link>
      ))}
    </div>,
    document.body
  );
}

function MoreMenu({ items, isActive, suppressActive = false }) {
  const { open, setOpen, mounted, coords, rootRef, menuRef } = useAnchoredMenu({ arrowNav: true });
  // suppressActive: when a PRIMARY destination already matches (e.g. /arena
  // matches both Arena and the overflow "Agent" alias), the overflow button
  // must not light up — one active route, one active indicator.
  const active = suppressActive ? null : items.find((i) => isActive(i));

  const menu =
    open && mounted && coords
      ? (
          <MenuPanel
            coords={coords}
            menuRef={menuRef}
            // The tour entry is utility chrome, not a destination — it stays
            // out of `items` so route matching can't mark it active.
            items={[...items, TOUR_ITEM]}
            isActive={isActive}
            ariaLabel="More navigation"
            onClose={() => setOpen(false)}
          />
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={active ? `More · ${active.name} selected` : "More navigation"}
        title={active ? `More · ${active.name} selected` : "More navigation"}
        className={`mc-nav-link no-underline inline-flex items-center gap-1 ${
          open || active ? "is-active" : ""
        }`}
      >
        More
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {menu}
    </div>
  );
}

/**
 * MobileNavMenu — hamburger holding every destination. Used below `sm` in
 * AppShell and on the landing header so the chrome never collides with
 * Connect Wallet at narrow widths.
 */
export function MobileNavMenu({ className = "" }) {
  const isActive = useIsActive();
  const { open, setOpen, mounted, coords, rootRef, menuRef } = useAnchoredMenu({ arrowNav: true });
  const links = [
    ...PRIMARY_NAV.map((i) => ({ name: i.name, href: i.href, description: i.description, onboardId: i.onboardId })),
    ...OVERFLOW_NAV.map((i) => ({ name: i.name, href: i.href, description: i.description, onboardId: i.onboardId })),
    { name: "Status", href: "/status" },
    { name: "Replay tour", href: "/agent", description: "Re-run the route guides", onSelect: replayTour },
  ];

  const menu =
    open && mounted && coords
      ? (
          <MenuPanel
            coords={coords}
            menuRef={menuRef}
            items={links}
            isActive={isActive}
            ariaLabel="All navigation"
            onClose={() => setOpen(false)}
          />
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? "Close navigation" : "Open navigation"}
        className="mc-nav-link no-underline inline-flex items-center gap-1 px-2.5 py-2"
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
      </button>
      {menu}
    </div>
  );
}

/**
 * Primary navigation links. Used by AppShell and the landing header so the
 * link set can never drift between surfaces.
 */
export default function PageNav() {
  const isActive = useIsActive();
  const primaryActive = PRIMARY_NAV.some((item) => isActive(item));

  return (
    <nav className="platform-nav flex min-w-0 items-center gap-1" aria-label="Primary navigation">
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-1">
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            data-onboard={item.onboardId}
            title={item.description}
            aria-current={isActive(item) ? "page" : undefined}
            className={`mc-nav-link no-underline ${isActive(item) ? "is-active" : ""}`}
          >
            {item.name}
          </Link>
        ))}
        <MoreMenu items={OVERFLOW_NAV} isActive={isActive} suppressActive={primaryActive} />
        <span className="mx-2 h-4 w-px bg-[var(--color-rule)]" aria-hidden="true" />
        <AudienceSwitcher />
      </div>

      {/* Below sm: a single menu holds every destination — four primary links
          plus More plus Connect Wallet cannot coexist without collisions. */}
      <div className="flex items-center gap-1 sm:hidden">
        <MobileNavMenu />
      </div>

      {/* sm–md: compact labels, tap-friendly targets */}
      <div className="hidden min-w-0 items-center gap-1 sm:flex md:hidden">
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            aria-label={item.name}
            aria-current={isActive(item) ? "page" : undefined}
            className={`mc-nav-link no-underline ${isActive(item) ? "is-active" : ""}`}
            style={{ padding: "0.55rem 0.5rem", fontSize: "12px" }}
          >
            {item.name}
          </Link>
        ))}
        <MoreMenu items={OVERFLOW_NAV} isActive={isActive} suppressActive={primaryActive} />
      </div>
    </nav>
  );
}

/**
 * Brand link for headers.
 */
export function HomeLink({ showLabel = true }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 text-sm font-semibold tracking-wide text-[var(--color-ink)] no-underline"
    >
      <span
        className="flex h-8 w-8 items-center justify-center border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/5 font-display text-sm text-[var(--color-accent)]"
        style={{ borderRadius: 0 }}
      >
        {BRAND.emoji}
      </span>
      {showLabel && (
        <span className="font-display hidden text-base tracking-tight sm:inline">{BRAND.name}</span>
      )}
    </Link>
  );
}

/**
 * AppShell — the one page chrome every route uses (except the landing hero,
 * which shares HomeLink/PageNav but owns its own layout).
 *
 * @param {string}  title     - Page heading
 * @param {node}    subtitle  - Short line under the heading (≤ ~12 words)
 * @param {node}    actions   - Right side of the title row (buttons, badges)
 * @param {node}    subheader - Below the title row (tabs, breadcrumbs)
 * @param {string}  maxWidth  - Tailwind max-w class for header + content
 * @param {boolean} wallet    - Render WalletConnect in the header (default true)
 */
export function AppShell({ title, subtitle, actions, subheader, maxWidth = "max-w-7xl", wallet = true, children }) {
  return (
    <div className="platform-shell flex min-h-screen flex-col text-[var(--color-ink)]">
      <div className="platform-frame mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 sm:pt-4">
        <header className="operator-header platform-header sticky top-3 z-[var(--z-chrome)] flex items-center justify-between gap-4 px-3 py-2.5 sm:top-4">
          <HomeLink />
          <div className="flex items-center gap-2">
            <PageNav />
            {/* One header health indicator: providers + agent feed behind a
                single popover (was OperatorPulse + StatusBadge side by side). */}
            <SystemHealthMenu className="hidden sm:inline-flex" />
            {wallet && <WalletConnect />}
          </div>
        </header>
      </div>

      <div className={`${maxWidth} platform-stage mx-auto w-full px-4 sm:px-6`}>
        {(title || subtitle || actions || subheader) && (
          <div className="platform-page-head pb-3 pt-7 sm:pt-9">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                {title && (
                  <h1 className="fc-display max-w-3xl font-display text-2xl font-semibold leading-[1.05] text-[var(--color-ink)] sm:text-4xl">{title}</h1>
                )}
                {subtitle && (
                  <p className="mt-1.5 max-w-xl text-sm leading-5 text-[var(--color-ink-muted)]">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{actions}</div>}
            </div>
            {subheader && <div className="mt-3">{subheader}</div>}
          </div>
        )}
      </div>

      <main className={`${maxWidth} platform-main platform-stage mobile-readable mx-auto w-full flex-1 px-4 pb-16 pt-4 sm:px-6 sm:pb-24`}>
        {children}
      </main>
    </div>
  );
}

/**
 * Secondary Navigation — page-level tab switcher.
 *
 * Pass `ariaLabel` and `idPrefix` so consumers can wire a matching
 * `role="tabpanel" id={`${idPrefix}-panel`}` around the switched content.
 */
export function SecondaryNav({ items, activeItem, onChange, ariaLabel, idPrefix }) {
  const { onKeyDown, tabProps } = useTabArrowKeys(
    items.map((item) => item.id),
    activeItem,
    onChange
  );
  return (
    <div className="mc-tab-strip" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={idPrefix ? `${idPrefix}-tab-${item.id}` : undefined}
          aria-selected={activeItem === item.id}
          aria-controls={idPrefix ? `${idPrefix}-panel` : undefined}
          {...tabProps(item.id)}
          onClick={() => onChange(item.id)}
          className={`mc-tab ${activeItem === item.id ? "is-active" : ""}`}
        >
          {item.icon && <span className="mr-1.5" aria-hidden="true">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}

// Re-export for landing mobile nav sync — consumers that need the link set.
export { PRIMARY_NAV, OVERFLOW_NAV };
