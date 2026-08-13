"use client";

import React, { useState, useEffect } from "react";
import { AppShell, SecondaryNav } from "@/app/components/PageNav";
import PositionsDashboard from "@/components/PositionsDashboard";
import CantonHolderDashboard from "@/components/CantonHolderDashboard";
import AgentTrackRecord from "@/components/AgentTrackRecord";
import EventTape from "@/components/EventTape";
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
        <SecondaryNav
          items={[
            { id: "public", label: "Public", icon: "◆" },
            { id: "private", label: "Private", icon: "◈" },
          ]}
          activeItem={view}
          onChange={selectView}
        />
      }
    >
      <div className="mb-2">
 <EventTape />
</div>

{view === "private" ? (
        <Reveal key="private">
          <div className="fc-view-swap fc-life-stage">
            <CantonHolderDashboard />
          </div>
        </Reveal>
      ) : (
        <Reveal key="public">
          <div className="fc-view-swap">
            <PositionsDashboard />
          </div>
        </Reveal>
      )}
    </AppShell>
  );
}
