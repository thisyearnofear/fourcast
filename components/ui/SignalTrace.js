'use client';

/**
 * SignalTrace — ThinkingState pattern applied to signal outcomes.
 *
 * Shows verdict chip (YES/CORRECT → green, NO/INCORRECT → red, PENDING → amber),
 * edge readout, reasoning prose, source chips, and confidence badge.
 *
 * Props:
 *   signal — the signal object with outcome, ai_digest, source data
 *   analysis — optional analysis result for richer trace data
 */
import { useState } from "react";

export function SignalTrace({ signal, analysis }) {
  const [expanded, setExpanded] = useState(false);

  const verdict = signal?.outcome || analysis?.recommended_action || analysis?.assessment?.direction;
  const isPositive = verdict === 'YES' || verdict === 'CORRECT';
  const isNegative = verdict === 'NO' || verdict === 'INCORRECT';
  const isPending = verdict === 'PENDING' || !verdict;

  const edge = analysis?.synthData?.polymarketEdge;
  const edgePct = edge != null ? Math.abs(edge.edge * 100) : null;
  const hasEdge = edgePct != null && edgePct > 3;

  const reasoning = analysis?.reasoning || signal?.ai_digest;
  const source = analysis?.source;
  const confidence = analysis?.assessment?.confidence;

  const verdictLabel = verdict
    ? verdict === 'YES' || verdict === 'CORRECT' ? 'CORRECT'
    : verdict === 'NO' || verdict === 'INCORRECT' ? 'INCORRECT'
    : 'PENDING'
    : 'PENDING';

  const verdictColor = isPending
    ? 'bg-sealed/15 text-sealed border border-sealed/35'
    : isPositive
    ? 'bg-accent/15 text-accent border border-accent/35'
    : 'bg-breach/15 text-breach border border-breach/35';

  const reasoningColor = isPositive
    ? 'text-accent'
    : isNegative
    ? 'text-breach'
    : '';

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Header — verdict + edge */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-control px-1.5 py-1 text-[13px] font-medium text-ink-2 transition-colors duration-100 hover:bg-hover-2"
      >
        {/* Verdict chip */}
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${verdictColor}`}>
          {verdictLabel}
        </span>

        {/* Edge readout */}
        {hasEdge && (
          <span className={`font-mono text-[12px] font-bold tabular-nums ${edge?.edge > 0 ? 'text-accent' : 'text-breach'}`}>
            {edge?.edge > 0 ? '+' : ''}{edgePct?.toFixed(1)}% edge
          </span>
        )}

        {/* Source chip */}
        {source && (
          <span className="inline-flex items-center rounded-full bg-field px-2 py-0.5 text-[10px] font-medium text-ink-faint shadow-hairline">
            {source === 'synthdata+llm' ? 'SynthData + LLM' :
             source === 'synthdata+path' ? 'SynthData + Path' :
             source}
          </span>
        )}

        {/* Expander chevron */}
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
          style={{ transform: expanded ? 'rotate(0)' : 'rotate(-90deg)' }}
        />
      </button>

      {/* Expandable trace */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-400"
        style={{
          gridTemplateRows: expanded ? '1fr' : '0fr',
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        <div className="overflow-hidden">
          <div className="relative mt-1 ml-[5px] pl-4">
            {/* Timeline line */}
            <span
              aria-hidden
              className="absolute left-[3px] w-px bg-line"
              style={{ top: -8, height: 100, transition: 'height 500ms cubic-bezier(0.23,1,0.32,1)' }}
            />

            <div className="flex flex-col gap-1 py-1">
              {/* Reasoning prose */}
              {reasoning && (
                <div className={`text-[12.5px] leading-relaxed whitespace-normal ${reasoningColor}`}>
                  {reasoning}
                </div>
              )}

              {/* Confidence badge */}
              {confidence && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className={`inline-flex h-5.5 items-center rounded-full px-2 text-[11px] font-medium shadow-hairline ${
                    confidence === 'HIGH'
                      ? 'bg-accent/15 text-accent border border-accent/35'
                      : confidence === 'MEDIUM'
                      ? 'bg-sealed/15 text-sealed border border-sealed/35'
                      : 'bg-breach/15 text-breach border border-breach/35'
                  }`}>
                    Confidence: {confidence}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}