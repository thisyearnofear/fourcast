"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/app/components/PageNav";
import PositionsDashboard from "@/components/PositionsDashboard";
import CantonHolderDashboard from "@/components/CantonHolderDashboard";
import AgentTrackRecord from "@/components/AgentTrackRecord";
import AgentRail from "@/components/AgentRail";
import Reveal from "@/components/motion/Reveal";
import { BRAND } from "@/constants/brand";

export default function PositionsPage() {
  const [view, setView] = useState("public");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "private") setView("private");
    else if (params.get("view") === "agent") setView("agent");
  }, []);

  const selectView = (next) => {
    setView(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (next === "public") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  return (
    <AppShell
      title="Positions"
      subtitle={BRAND.pages.positions}
      maxWidth="max-w-4xl"
      subheader={
        <div className="mc-tab-strip">
          {["public", "private", "agent"].map((id) => (
            <button
              key={id}
              onClick={() => selectView(id)}
              className={`mc-tab ${view === id ? "is-active" : ""}`}
            >
              {id === "public" ? "Public" : id === "private" ? "Private" : "Agent"}
            </button>
          ))}
        </div>
      }
    >
      <AgentRail />

      {view === "agent" ? (
        <Reveal>
          <AgentTrackRecord />
        </Reveal>
      ) : view === "private" ? (
        <Reveal>
          <div className="fc-view-swap fc-life-stage">
            <CantonHolderDashboard />
          </div>
        </Reveal>
      ) : (
        <Reveal>
          <PositionsDashboard />
        </Reveal>
      )}
    </AppShell>
  );
}
