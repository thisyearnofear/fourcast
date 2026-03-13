"use client";

import Link from "next/link";

export default function PageNav({ currentPage, isNight }) {
  const textColor = isNight ? "text-white" : "text-black";
  const bgClass = isNight
    ? "bg-white/10 border-white/20"
    : "bg-black/10 border-black/20";

  const pages = [
    { name: "Home", href: "/", label: "🔮", onboardId: "weather" },
    { name: "Markets", href: "/markets", label: "📊", onboardId: "markets" },
    { name: "Signals", href: "/signals", label: "📡", onboardId: "publish" },
  ];

  const otherPages = pages.filter((page) => page.name !== currentPage);

  return (
    <div className="flex items-center space-x-2">
      {otherPages.map((page) => (
        <Link
          key={page.name}
          href={page.href}
          data-onboard={page.onboardId}
          className={`flex items-center space-x-2 px-3 py-2 ${textColor} rounded-lg border ${bgClass} text-sm font-medium hover:scale-[1.03] transition-transform`}
        >
          <span>{page.label}</span>
          <span>{page.name}</span>
        </Link>
      ))}
    </div>
  );
}
