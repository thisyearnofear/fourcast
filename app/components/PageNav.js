'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Sparkles } from "lucide-react";
import { BRAND } from "@/constants/brand";
import WalletConnect from "@/app/components/WalletConnect";
import StatusBadge from "@/components/StatusBadge";
import OperatorPulse from "@/components/OperatorPulse";
import AudienceSwitcher from "@/app/components/AudienceSwitcher";
import { replayTour } from "@/components/RouteGuide";

/**
 * Navigation + AppShell — the single source of truth for the app chrome.
 *
 * Venue loop: Markets → act → Positions, with Private (Canton) as differentiator.
 * Design language: floating glass header, charcoal/emerald tokens, dark-first.
 */

/**
 * Nav architecture:
 *  - PRIMARY_NAV: Markets · Positions · Private (always visible)
 *  - OVERFLOW_NAV: Signals · Agent · Labs · Alerts
 *  - UTILITY: tour replay + audience switcher
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

function pathMatches(pathname, item) {
  const match = item.match || item.href.split("?")[0];
  if (match === "/") return pathname === "/";
  return pathname?.startsWith(match);
}

function useIsActive() {
  const pathname = usePathname();
  return (item) => pathMatches(pathname, typeof item === "string" ? { href: item } : item);
}

function MoreMenu({ items, isActive }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const placeMenu = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({
      top: Math.round(r.bottom + 6),
      right: Math.round(Math.max(8, window.innerWidth - r.right)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open, placeMenu]);

  useEffect(() => {
    if (!open) return undefined;
    // Use click (not mousedown): mousedown-outside closes + unmounts the
    // menu before the link's click fires — items look dead.
    const onDocClick = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const active = items.find((i) => isActive(i));

  const menu =
    open && mounted && coords
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="More navigation"
            style={{ top: coords.top, right: coords.right }}
            className="fixed z-[200] w-56 border border-[var(--color-rule-strong)] bg-[var(--color-paper-raised)] p-1 shadow-xl backdrop-blur-[18px] backdrop-saturate-[1.2]"
          >
            {items.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                role="menuitem"
                data-onboard={item.onboardId}
                title={item.description}
                aria-current={isActive(item) ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex w-full flex-col gap-0.5 px-2.5 py-2 text-left text-[11px] uppercase tracking-[0.1em] no-underline transition ${
                  isActive(item)
                    ? "bg-[var(--color-accent-quiet)] text-[var(--color-accent)]"
                    : "text-[var(--color-ink)] hover:bg-white/[0.04]"
                }`}
              >
                <span className="font-semibold">{item.name}</span>
                <span className="text-[10px] font-normal normal-case tracking-normal text-[var(--color-ink-muted)]">
                  {item.description}
                </span>
              </Link>
            ))}
          </div>,
          document.body
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
 * Primary navigation links. Used by AppShell and the landing header so the
 * link set can never drift between surfaces.
 */
export default function PageNav() {
  const isActive = useIsActive();

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
        <MoreMenu items={OVERFLOW_NAV} isActive={isActive} />
        <span className="mx-2 h-4 w-px bg-[var(--color-rule)]" aria-hidden="true" />
        <Link
          href="/agent"
          onClick={replayTour}
          title="Replay the route guides"
          aria-label="Replay the tour"
          className="mc-nav-link no-underline inline-flex items-center"
        >
          <Sparkles className="h-3 w-3" aria-hidden="true" />
        </Link>
        <span className="mx-2 h-4 w-px bg-[var(--color-rule)]" aria-hidden="true" />
        <AudienceSwitcher />
      </div>

      {/* Mobile: compact labels */}
      <div className="flex min-w-0 items-center gap-1 md:hidden">
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            aria-label={item.name}
            aria-current={isActive(item) ? "page" : undefined}
            className={`mc-nav-link no-underline ${isActive(item) ? "is-active" : ""}`}
            style={{ padding: "0.4rem 0.5rem", fontSize: "11px" }}
          >
            {item.name}
          </Link>
        ))}
        <MoreMenu items={OVERFLOW_NAV} isActive={isActive} />
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
      <div className="platform-atmosphere" aria-hidden="true" />
      <div className="platform-frame mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 sm:pt-4">
        <header className="operator-header platform-header sticky top-3 z-50 flex items-center justify-between gap-4 px-3 py-2.5 sm:top-4">
          <HomeLink />
          <div className="flex items-center gap-2">
            <PageNav />
            <OperatorPulse compact className="flex" />
            <div className="hidden sm:block"><StatusBadge /></div>
            {wallet && <div className="platform-wallet"><WalletConnect /></div>}
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

      <main className={`${maxWidth} platform-main platform-stage mx-auto w-full flex-1 px-4 pb-16 pt-4 sm:px-6 sm:pb-24`}>
        {children}
      </main>
    </div>
  );
}

/**
 * Secondary Navigation — page-level tab switcher.
 */
export function SecondaryNav({ items, activeItem, onChange }) {
  return (
    <div className="mc-tab-strip">
      {items.map((item) => (
        <button
          key={item.id}
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
