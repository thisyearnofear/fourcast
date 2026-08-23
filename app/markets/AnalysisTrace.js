'use client';

/**
 * AnalysisTrace — ThinkingState pattern applied to agent analysis results.
 *
 * When a market is analyzed, the expanded card shows a ThinkingState-style
 * trace: verdict header → expandable reasoning/search/tool trace → remains
 * interactive after settling.
 *
 * Props adapted from analysis pipeline:
 *   analysis — the analysis result object from streaming API
 *   market   — the market being analyzed
 */
import { useState, useRef, useEffect } from "react";

const STAGES = [800, 600, 1800, 2600, 1600];

function useSequence(steps) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= steps.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), steps[stage]);
    return () => clearTimeout(t);
  }, [stage, steps]);
  return stage;
}

export function AnalysisTrace({
  analysis,
  market,
  onSettled,
}) {
  const stage = useSequence(STAGES);
  const [manualExpanded, setManualExpanded] = useState(null);
  const autoExpanded = stage >= 1 && stage < 4;
  const expanded = manualExpanded ?? autoExpanded;
  const working = stage < 3;
  const settledRef = useRef(false);

  useEffect(() => {
    if (working || settledRef.current) return;
    settledRef.current = true;
    onSettled?.();
  }, [working, onSettled]);

  const verdict = analysis?.recommended_action || analysis?.assessment?.direction;
  const edge = analysis?.synthData?.polymarketEdge;
  const edgePct = edge != null ? Math.abs(edge.edge * 100) : null;
  const hasEdge = edgePct != null && edgePct > 3;

  return (
    <div
      className="flex w-full flex-col gap-2"
      style={{
        minHeight: working || expanded ? 176 : undefined,
        transition: 'min-height 400ms cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      {/* Header — verdict + edge */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setManualExpanded((current) => (current ?? autoExpanded) ? null : true)}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-control px-1.5 py-1 text-[13px] font-medium text-ink-2 transition-colors duration-100 hover:bg-hover-2"
      >
        {/* Verdict chip */}
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          verdict === 'ALLOCATE' || verdict === 'YES'
            ? 'bg-accent/15 text-accent border border-accent/35'
            : verdict === 'PASS' || verdict === 'NO'
            ? 'bg-line-strong/20 text-ink-2 border border-line'
            : 'bg-field text-ink-2'
        }`}>
          {verdict || 'Evaluating'}
        </span>

        {/* Edge readout */}
        {hasEdge && (
          <span className={`font-mono text-[12px] font-bold tabular-nums ${
            edge?.edge > 0 ? 'text-accent' : 'text-breach'
          }`}>
            {edge?.edge > 0 ? '+' : ''}{edgePct?.toFixed(1)}% edge
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
              style={{ top: -8, height: 120, transition: 'height 500ms cubic-bezier(0.23,1,0.32,1)' }}
            />

            <div className="flex flex-col gap-1 py-1">
              {/* Reasoning prose (when settled) */}
              {!working && analysis?.reasoning && (
                <div className="text-[12.5px] leading-relaxed text-ink-2 whitespace-normal">
                  {analysis.reasoning}
                </div>
              )}

              {/* Source chips */}
              {!working && analysis?.source && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="inline-flex h-5.5 items-center rounded-full bg-field px-2 text-[11px] font-medium text-ink-2 shadow-hairline">
                    {analysis.source === 'synthdata+llm' ? 'SynthData + LLM' :
                     analysis.source === 'synthdata+path' ? 'SynthData + Path' :
                     analysis.source}
                  </span>
                  {analysis.assessment?.confidence && (
                    <span className={`inline-flex h-5.5 items-center rounded-full px-2 text-[11px] font-medium shadow-hairline ${
                      analysis.assessment.confidence === 'HIGH'
                        ? 'bg-accent/15 text-accent border border-accent/35'
                        : analysis.assessment.confidence === 'MEDIUM'
                        ? 'bg-sealed/15 text-sealed border border-sealed/35'
                        : 'bg-breach/15 text-breach border border-breach/35'
                    }`}>
                      Confidence: {analysis.assessment.confidence}
                    </span>
                  )}
                </div>
              )}

              {/* Raw thinking (collapsed) */}
              {analysis?.thinking && (
                <details className="group mt-1 border-t border-line pt-2">
                  <summary className="cursor-pointer list-none text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink">
                    Raw thinking
                  </summary>
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words bg-paper-deep p-2 font-mono text-[10px] text-ink-faint">
                    {analysis.thinking}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
