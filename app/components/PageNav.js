"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/constants/brand";
import WalletConnect from "@/app/components/WalletConnect";
import StatusBadge from "@/components/StatusBadge";
import OperatorPulse from "@/components/OperatorPulse";

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
 * Primary nav. Notes:
 *  - "Positions" was renamed "Track Record" so the primary-customer language
 *    is visible without scrolling.
 *  - Labels can be overridden via BRAND.navLabels in constants/brand.js.
 */
// BRAND.navLabels is a required top-level key (see constants/brand.js). We still
// keep ?? fallbacks so unit tests / Storybook / partial mocks stay safe.
const PRIMARY_NAV = [
  // Flagship story leads — Mandate → Proof Theatre → Diligence is one
  // unfolding system, not peer products. Markets/Signals follow as
  // supporting capability so they no longer compete with the narrative.
  { name: BRAND.navLabels.agent ?? "Mandate", href: "/agent", description: BRAND.nav.agent, onboardId: "agent" },
  { name: BRAND.navLabels.worldCup ?? "Proof Theatre", href: "/world-cup", description: "TxLINE-verified proof of decision", onboardId: "world-cup" },
  { name: BRAND.navLabels.positions ?? "Diligence", href: "/positions", description: BRAND.nav.positions, onboardId: "positions" },
  { name: BRAND.navLabels.markets ?? "Markets", href: "/markets", description: BRAND.nav.markets, onboardId: "markets" },
  { name: BRAND.navLabels.signals ?? "Signals", href: "/signals", description: BRAND.nav.signals, onboardId: "publish" },
];

const SECONDARY_NAV = [
  { name: BRAND.navLabels.labs ?? "Labs", href: "/labs", description: BRAND.nav.labs },
  { name: BRAND.navLabels.alerts ?? "Alerts", href: "/notifications", description: "Notifications from analysts you follow" },
];

function useIsActive() {
  const pathname = usePathname();
  return (href) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));
}

/**
 * Primary navigation links. Used by AppShell and the landing header so the
 * link set can never drift between surfaces.
 */
export default function PageNav() {
  const isActive = useIsActive();

  return (
    <nav className="flex items-center gap-0.5" aria-label="Primary navigation">
      {/* Desktop */}
      <div className="hidden sm:flex items-center gap-0.5">
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            data-onboard={item.onboardId}
            title={item.description}
            className={`mc-nav-link no-underline ${isActive(item.href) ? "is-active" : ""}`}
          >
            {item.name}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" />
        {SECONDARY_NAV.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            title={item.description}
            className={`mc-nav-link no-underline ${isActive(item.href) ? "is-active" : ""}`}
          >
            {item.name}
          </Link>
        ))}
      </div>

      {/* Mobile: compact labels */}
      <div className="flex sm:hidden items-center gap-0.5">
        {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => (
          <Link
            key={item.name}
            href={item.href}
            aria-label={item.name}
            className={`mc-nav-link no-underline ${isActive(item.href) ? "is-active" : ""}`}
            style={{ padding: "0.3rem 0.4rem", fontSize: "9px" }}
          >
            {item.name}
          </Link>
        ))}
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
    <div className="flex min-h-screen flex-col text-white">
      {/* Header always spans the full app width so nav never cramps on
          narrow-content pages; only <main> respects maxWidth. */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
        <header className="operator-header sticky top-4 z-50 flex items-center justify-between gap-4 px-3 py-2.5">
          <HomeLink />
          <div className="flex items-center gap-2">
            <PageNav />
            <OperatorPulse compact className="hidden xl:flex" />
            <StatusBadge />
            {wallet && <WalletConnect />}
          </div>
        </header>
      </div>

      <div className={`${maxWidth} mx-auto w-full px-4 sm:px-6`}>
        {(title || subtitle || actions || subheader) && (
          <div className="pt-8 pb-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {title && (
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
                )}
                {subtitle && (
                  <p className="mt-2 max-w-xl text-sm font-light leading-6 text-white/[0.55]">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            {subheader && <div className="mt-4">{subheader}</div>}
          </div>
        )}
      </div>

      <main className={`${maxWidth} mx-auto w-full flex-1 px-4 py-8 sm:px-6`}>
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
