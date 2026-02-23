"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ConnectKitButton } from "connectkit";
import PageNav from "@/app/components/PageNav";
import { AgentDashboard } from "@/components/AgentDashboard";

export default function VisionPage() {
  const [isNight, setIsNight] = useState(() => {
    const hour = new Date().getHours();
    return hour >= 19 || hour <= 6;
  });

  const textColor = useMemo(
    () => (isNight ? "text-white" : "text-black"),
    [isNight]
  );
  const bgClass = useMemo(
    () =>
      isNight
        ? "bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800"
        : "bg-gradient-to-br from-blue-50 via-white to-blue-100",
    [isNight]
  );
  const cardClass = useMemo(
    () =>
      isNight ? "bg-white/10 border-white/20" : "bg-black/10 border-black/20",
    [isNight]
  );

  const sources = [
    "Effect of weather on stock returns",
    "Why good weather isn’t good for stock returns",
    "Weather based trading strategies",
    "[roadmap] Prediction markets are coming for insurance markets",
  ];

  return (
    <div className={`min-h-screen relative ${bgClass}`}>
      <div className="relative z-20 flex flex-col min-h-screen overflow-y-auto">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-12">
            <div className="mb-6 sm:mb-0">
              <h1
                className={`text-4xl sm:text-4xl font-thin tracking-wide ${textColor}`}
              >
                Vision
              </h1>
              <p
                className={`${textColor} opacity-60 mt-3 font-light max-w-md text-sm`}
              >
                Weather-aware prediction intelligence, transparent and
                composable.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <PageNav currentPage="Vision" isNight={isNight} />
              <ConnectKitButton mode={isNight ? "dark" : "light"} />
            </div>
          </header>

          <main className="space-y-8">
            <section
              className={`backdrop-blur-md border rounded-2xl p-6 ${cardClass}`}
            >
              <h2 className={`text-xl font-light ${textColor} mb-3`}>
                Company Description
              </h2>
              <p className={`${textColor} opacity-80 text-sm leading-relaxed`}>
                I am building a data-driven intelligence company focused on
                uncovering weather-related informational edges in prediction
                markets. My team combines expertise in machine learning, weather
                modeling, and market microstructure to identify how
                environmental factors create mispriced risk across sports,
                events, and other real-world outcomes. My mission is to make
                weather-influenced insight accessible, verifiable, and
                composable — transforming an overlooked data source into a
                powerful forecasting tool for traders, builders, and analysts.
              </p>
            </section>

            <section
              className={`backdrop-blur-md border rounded-2xl p-6 ${cardClass}`}
            >
              <h2 className={`text-xl font-light ${textColor} mb-3`}>
                Sources
              </h2>
              <ul className="space-y-2">
                {sources.map((s, i) => (
                  <li key={i} className={`text-sm ${textColor} opacity-80`}>
                    {s}
                  </li>
                ))}
              </ul>
            </section>

            <section
              className={`backdrop-blur-md border rounded-2xl p-6 ${cardClass}`}
            >
              <h2 className={`text-xl font-light ${textColor} mb-3`}>
                Product Description
              </h2>
              <p className={`${textColor} opacity-80 text-sm leading-relaxed`}>
                An AI-powered inference engine that detects and quantifies
                weather-related mispricings in external prediction markets. For
                each event, the system ingests real-time odds, local weather
                data, and historical performance patterns, then generates a
                concise edge summary describing where markets may be under- or
                over-pricing weather impacts. These insights are written to
                Aptos as on-chain market objects, forming a public, composable
                dataset of odds × weather × AI inference.
              </p>
              <p
                className={`${textColor} opacity-80 text-sm leading-relaxed mt-4`}
              >
                Users can pay to unlock deeper analysis, richer weather
                modeling, and advanced AI breakdowns. Public signals power the
                ecosystem; private signals power monetization. This hybrid
                design produces a transparent and trustworthy intelligence layer
                while preserving proprietary research for paying users. Over
                time, on-chain records enable reputation scoring, accuracy
                metrics, and decentralized access control for premium signals —
                all built natively on Aptos.
              </p>
            </section>

            <section
              className={`backdrop-blur-md border rounded-2xl p-6 ${cardClass}`}
            >
              <h2 className={`text-xl font-light ${textColor} mb-3`}>
                Funding Justification & Benefits
              </h2>
              <p className={`${textColor} opacity-80 text-sm leading-relaxed`}>
                Funding accelerates development of a core on-chain primitive for
                the Aptos ecosystem: a canonical, public registry of
                weather-aware prediction data that builders, traders, and future
                DeFi protocols can integrate into their products. By writing
                standardized market objects to Aptos, we create a shared
                infrastructure layer that enables new financial tools,
                prediction markets, risk dashboards, and bots to flourish in the
                Aptos ecosystem.
              </p>
              <div className="mt-4">
                <h3 className={`${textColor} text-sm font-light mb-2`}>
                  Grant funding allows me to:
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li className={`${textColor} opacity-80 text-sm`}>
                    build the inference engine and Aptos on-chain registry
                  </li>
                  <li className={`${textColor} opacity-80 text-sm`}>
                    implement wallet-based identity and access control
                  </li>
                  <li className={`${textColor} opacity-80 text-sm`}>
                    create the first weather × odds × AI dataset on Aptos
                  </li>
                  <li className={`${textColor} opacity-80 text-sm`}>
                    attract developers by exposing open APIs and SDKs
                  </li>
                  <li className={`${textColor} opacity-80 text-sm`}>
                    establish Aptos as the natural chain for prediction
                    intelligence and DePIN weather integrations
                  </li>
                </ul>
              </div>
              <p
                className={`${textColor} opacity-80 text-sm leading-relaxed mt-4`}
              >
                The measurable value to Aptos is simple: we generate ongoing
                on-chain activity, create reusable data primitives, attract
                developers seeking composable prediction infrastructure, and
                anchor a new vertical — weather-aware intelligence — that no
                other chain currently owns. This positions Aptos as the go-to
                network for real-world forecasting apps and future prediction
                markets.
              </p>
            </section>
            <section
              className={`backdrop-blur-md border rounded-2xl p-6 ${cardClass}`}
            >
              <AgentDashboard isNight={isNight} />
            </section>
            <section
              className={`backdrop-blur-md border rounded-2xl p-6 ${cardClass}`}
            >
              <LatestSignals
                isNight={isNight}
                textColor={textColor}
                cardClass={cardClass}
              />
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function LatestSignals({ isNight, textColor, cardClass }) {
  const [signals, setSignals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/signals?limit=20");
        const data = await res.json();
        if (mounted) {
          if (data.success) {
            setSignals(Array.isArray(data.signals) ? data.signals : []);
            setError(null);
          } else {
            setError(data.error || "Failed to load signals");
          }
        }
      } catch (e) {
        if (mounted) setError("Failed to load signals");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const badgeClass = isNight
    ? "bg-white/10 border-white/20"
    : "bg-black/10 border-black/20";
  const muted = isNight ? "text-white/70" : "text-black/70";

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div
          className={`w-5 h-5 rounded-full border-2 ${
            isNight
              ? "border-white/30 border-t-white"
              : "border-black/30 border-t-black"
          } animate-spin`}
        ></div>
        <span className={`${muted}`}>Loading signals</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${textColor} opacity-70`}>Failed to load signals</div>
    );
  }

  if (signals.length === 0) {
    return <div className={`${textColor} opacity-70`}>No signals yet</div>;
  }

  return (
    <div className="space-y-3">
      {signals.map((s) => {
        const ts = s.timestamp ? new Date(s.timestamp * 1000) : null;
        const timeStr = ts ? ts.toLocaleString() : "Unknown time";
        const conf = s.confidence || "UNKNOWN";
        const eff = s.odds_efficiency || "UNKNOWN";
        return (
          <div key={s.id} className={`rounded-xl border ${badgeClass} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className={`${textColor} font-light text-sm`}>
                  {s.market_title || "Untitled Market"}
                </div>
                <div className={`text-xs ${muted} mt-1`}>
                  {s.venue || "Unknown venue"}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs ${muted}`}>{timeStr}</div>
                <div className="mt-1 flex items-center gap-2 justify-end">
                  <span className={`text-xs ${textColor} opacity-80`}>
                    {conf}
                  </span>
                  <span
                    className={`text-xs ${
                      eff === "INEFFICIENT"
                        ? isNight
                          ? "text-orange-300"
                          : "text-orange-700"
                        : isNight
                        ? "text-green-300"
                        : "text-green-700"
                    }`}
                  >
                    {eff}
                  </span>
                </div>
              </div>
            </div>
            {s.ai_digest && (
              <div
                className={`text-sm ${textColor} opacity-80 mt-3 line-clamp-3`}
              >
                {s.ai_digest}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
