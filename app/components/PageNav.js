'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { BRAND } from "@/constants/brand";
import WalletConnect from "@/app/components/WalletConnect";
import StatusBadge from "@/components/StatusBadge";
import OperatorPulse from "@/components/OperatorPulse";
import AudienceSwitcher from "@/app/components/AudienceSwitcher";
import { TourLink, replayTour } from "@/components/RouteGuide";

/**
 * Navigation + AppShell — the single source of truth for the app chrome.
 *
 * Design language mirrors the landing page (the highest-spec surface):
 * floating glass header card, slate/white-alpha text, emerald accents,
 * flat --app-bg backdrop. Dark-first: there is no light theme.
 *
 * Core loop: Search → Analyze → Publish/Trade → Track (matches BRAND.loop)
 */

/**
 * Nav architecture (kept tight to honour the Workbench macrostructure):
 *  - PRIMARY_NAV: 4 routes that cover the core loop, always visible.
 *  - OVERFLOW_NAV: long-tail routes, hidden behind a "More" menu.
 *  - UTILITY controls: audience switcher (icon popover) and tour replay
 *    (icon-only Sparkles), each separated from the nav cluster by whitespace.
 *
 * Labels can be overridden via BRAND.navLabels in constants/brand.js.
 */
const PRIMARY_NAV = [
  { name: BRAND.navLabels.agent ?? "Mandate", href: "/agent", description: BRAND.nav.agent, onboardId: "agent" },
  { name: BRAND.navLabels.worldCup ?? "Proof Theatre", href: "/world-cup", description: "TxLINE-verified proof of decision", onboardId: "world-cup" },
  { name: BRAND.navLabels.positions ?? "Diligence", href: "/positions", description: BRAND.nav.positions, onboardId: "positions" },
  { name: BRAND.navLabels.markets ?? "Markets", href: "/markets", description: BRAND.nav.markets, onboardId: "markets" },
];

const OVERFLOW_NAV = [
  { name: BRAND.navLabels.canton ?? "Private Markets", href: "/canton", description: BRAND.nav.canton, onboardId: "canton" },
  { name: BRAND.navLabels.signals ?? "Signals", href: "/signals", description: BRAND.nav.signals, onboardId: "publish" },
  { name: BRAND.navLabels.labs ?? "Labs", href: "/labs", description: BRAND.nav.labs },
  { name: BRAND.navLabels.alerts ?? "Alerts", href: "/notifications", description: "Notifications from analysts you follow" },
];

function useIsActive() {
  const pathname = usePathname();
  return (href) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));
}

function MoreMenu({ items, isActive }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close on route change — pathname change means the user navigated, so
  // the dropdown should not linger open across routes.
  const pathname = usePathname();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const active = items.find((i) => isActive(i.href));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
      {open && (
        <div
          role="menu"
          aria-label="More navigation"
          className="absolute right-0 top-full z-[60] mt-1.5 w-60 border border-[var(--color-rule)] bg-[var(--color-paper-deep)] p-1 shadow-xl"
        >
          {items.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              role="menuitem"
              data-onboard={item.onboardId}
              title={item.description}
              aria-current={isActive(item.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`flex w-full flex-col gap-0.5 px-2.5 py-2 text-left text-[11px] uppercase tracking-[0.1em] no-underline transition ${
                isActive(item.href)
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
        </div>
      )}
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
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`mc-nav-link no-underline ${isActive(item.href) ? "is-active" : ""}`}
          >
            {item.name}
          </Link>
        ))}
        <MoreMenu items={OVERFLOW_NAV} isActive={isActive} />
        <span className="mx-2 h-4 w-px bg-[var(--color-rule)]" aria-hidden="true" />
        <Link
          href="/agent"
          onClick={replayTour}
          title="Replay the route guides on /agent, /world-cup, and /positions"
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
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`mc-nav-link no-underline ${isActive(item.href) ? "is-active" : ""}`}
            style={{ padding: "0.3rem 0.4rem", fontSize: "9px" }}
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
      className="flex items-center gap-2.5 text-sm font-semibold tracking-wide text-white no-underline"
    >
      <span
        className="flex h-8 w-8 items-center justify-center border border-emerald-400/25 bg-emerald-400/5 font-display text-sm text-emerald-300"
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
 * Replaces the six hand-rolled per-page headers.
 *
 * @param {string}  title     - Page heading
 * @param {string}  subtitle  - One-line description under the heading
 * @param {node}    actions   - Right side of the title row (buttons, badges)
 * @param {node}    subheader - Below the title row (tabs, breadcrumbs)
 * @param {string}  maxWidth  - Tailwind max-w class for header + content
 * @param {boolean} wallet    - Render WalletConnect in the header (default true)
 */
export function AppShell({ title, subtitle, actions, subheader, maxWidth = "max-w-7xl", wallet = true, children }) {
  return (
    <div className="platform-shell flex min-h-screen flex-col text-white">
      <div className="platform-atmosphere" aria-hidden="true" />
      {/* Header always spans the full app width so nav never cramps on
          narrow-content pages; only <main> respects maxWidth. */}
      <div className="platform-frame mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 sm:pt-4">
        <header className="operator-header platform-header sticky top-3 z-50 flex items-center justify-between gap-4 px-3 py-2.5 sm:top-4">
          <HomeLink />
          <div className="flex items-center gap-2">
            <PageNav />
            <OperatorPulse compact className="hidden xl:flex" />
            <div className="hidden sm:block"><StatusBadge /></div>
            {wallet && <div className="platform-wallet"><WalletConnect /></div>}
          </div>
        </header>
      </div>

      <div className={`${maxWidth} platform-stage mx-auto w-full px-4 sm:px-6`}>
        {(title || subtitle || actions || subheader) && (
          <div className="platform-page-head pb-4 pt-10 sm:pt-14">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {title && (
                  <h1 className="fc-display max-w-3xl font-display text-3xl font-semibold leading-[1.02] text-[var(--color-ink)] sm:text-5xl">{title}</h1>
                )}
                {subtitle && (
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--color-ink-muted)] sm:text-base sm:leading-7">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            {subheader && <div className="mt-4">{subheader}</div>}
          </div>
        )}
      </div>

      <main className={`${maxWidth} platform-main platform-stage mx-auto w-full flex-1 px-4 pb-16 pt-5 sm:px-6 sm:pb-24`}>
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
