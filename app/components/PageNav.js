"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Primary Navigation Component
 * 
 * Architecture:
 * - Brand (Home) always visible
 * - Primary nav: Markets, Signals
 * - Mobile: Bottom tab bar style
 * - Desktop: Horizontal nav with active state
 * 
 * Props:
 * - currentPage: string - for backward compatibility
 * - isNight: boolean - theme
 * - secondaryNav: array - optional secondary navigation items
 */
export default function PageNav({ currentPage, isNight, secondaryNav = [] }) {
  const pathname = usePathname();
  
  const textColor = isNight ? "text-white" : "text-black";
  const glassClass = isNight ? "glass-subtle" : "glass-subtle-light";
  const activeBgClass = isNight
    ? "bg-white/20 border-white/30"
    : "bg-black/20 border-black/30";

  // Primary navigation structure
  const primaryNav = [
    { 
      name: "Markets", 
      href: "/markets", 
      icon: "📊",
      description: "ML-powered edge detection",
      onboardId: "markets"
    },
    { 
      name: "Signals", 
      href: "/signals", 
      icon: "📡",
      description: "Track record & leaderboard",
      onboardId: "publish"
    },
  ];

  // Determine active page
  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <nav className="flex items-center gap-2">
      {/* Desktop Navigation */}
      <div className="hidden sm:flex items-center gap-2">
        {primaryNav.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            data-onboard={item.onboardId}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive(item.href)
                ? `${activeBgClass} ${textColor}`
                : `${glassClass} ${textColor} opacity-70 hover:opacity-100 hover:scale-[1.02]`
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.name}</span>
          </Link>
        ))}
      </div>

      {/* Mobile Navigation - Icon only */}
      <div className="flex sm:hidden items-center gap-1">
        {primaryNav.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            data-onboard={item.onboardId}
            className={`flex items-center justify-center w-10 h-10 rounded-lg text-lg transition-all ${
              isActive(item.href)
                ? `${activeBgClass}`
                : `${glassClass} opacity-70`
            }`}
            aria-label={item.name}
          >
            <span>{item.icon}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

/**
 * Secondary Navigation Component
 * For page-specific tab navigation (used within pages)
 */
export function SecondaryNav({ items, activeItem, onChange, isNight }) {
  const textColor = isNight ? "text-white" : "text-black";
  const glassClass = isNight ? "glass-subtle" : "glass-subtle-light";

  return (
    <div className={`inline-flex rounded-2xl p-1 ${glassClass}`}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`px-4 py-2 rounded-xl text-sm font-light transition-all ${
            activeItem === item.id
              ? isNight
                ? "bg-purple-500/30 text-white border border-purple-400/40"
                : "bg-purple-400/30 text-black border border-purple-500/40"
              : `${textColor} opacity-60 hover:opacity-100`
          }`}
        >
          {item.icon && <span className="mr-1.5">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Home Link Component
 * Brand link for header
 */
export function HomeLink({ isNight, showLabel = false }) {
  const textColor = isNight ? "text-white" : "text-black";
  
  return (
    <Link
      href="/"
      data-onboard="weather"
      className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all hover:opacity-80 ${textColor}`}
    >
      <span className="text-xl">🔮</span>
      {showLabel && <span className="text-sm font-light">Fourcast</span>}
    </Link>
  );
}
