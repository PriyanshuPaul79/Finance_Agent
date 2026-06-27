"use client";

import { motion } from "framer-motion";
import { Check, AlertCircle, Loader2, Minus } from "lucide-react";
import type { AgentNodeState, AgentId } from "@/lib/types";
import { cn } from "@/lib/utils";

// ============================================================================
// AgentSpine — the signature element.
//
// A vertical Verdikt spine down the left, with one node per agent. As each
// agent runs, its node transitions: hollow (queued) → signal-filled (running)
// → verified-filled (complete) or caution-filled (error). Streamed reasoning
// text appears in monospace next to each node, line by line.
//
// On narrow viewports the spine collapses to a top-to-bottom stacked timeline
// (no horizontal scrolling).
// ============================================================================

interface AgentSpineProps {
  agents: Record<AgentId, AgentNodeState>;
  /** When true, show the convergence animation at the bottom of the spine. */
  converged: boolean;
  /** Compact variant: used on the landing page's static preview. */
  compact?: boolean;
}

const AGENT_ORDER: AgentId[] = [
  "supervisor",
  "fundamentals",
  "sentiment",
  "industry",
];

export function AgentSpine({ agents, converged, compact = false }: AgentSpineProps) {
  return (
    <div
      className="relative pl-6 sm:pl-8"
      role="log"
      aria-live="polite"
      aria-label="Agent activity timeline"
    >
      {/* The vertical spine rule */}
      <div
        className={cn(
          "absolute left-[7px] sm:left-[9px] top-2 bottom-2 w-px spine-rule",
          compact && "top-1 bottom-1"
        )}
        aria-hidden
      />

      <ol className={cn("space-y-5", compact && "space-y-3")}>
        {AGENT_ORDER.map((id) => (
          <AgentRow
            key={id}
            agent={agents[id]}
            compact={compact}
            indented={id !== "supervisor"}
          />
        ))}
      </ol>

      {/* Convergence SVG: drawn from the three sub-agent rows into a single
          point when synthesis completes. This is the one orchestrated motion
          moment in the product. */}
      {converged && !compact && (
        <ConvergenceGraphic />
      )}
    </div>
  );
}

function AgentRow({
  agent,
  compact,
  indented,
}: {
  agent: AgentNodeState;
  compact: boolean;
  indented: boolean;
}) {
  const isActive = agent.status === "running" || agent.status === "synthesizing";
  const isComplete = agent.status === "complete";
  const isError = agent.status === "error";

  return (
    <li className="relative">
      <div className="flex gap-3 sm:gap-4">
        {/* Node */}
        <div
          className={cn(
            "absolute -left-6 sm:-left-8 top-1 flex items-center justify-center",
          )}
          aria-hidden
        >
          <span
            className={cn(
              "spine-node",
              agent.status === "running" && "spine-node--active",
              agent.status === "synthesizing" && "spine-node--synthesizing",
              agent.status === "complete" && "spine-node--complete",
              agent.status === "error" && "spine-node--error"
            )}
          >
            {/* Status icon overlaid on the node */}
            {isComplete && (
              <Check
                className="w-2.5 h-2.5 text-paper"
                strokeWidth={3.5}
              />
            )}
            {isError && (
              <AlertCircle
                className="w-2.5 h-2.5 text-paper"
                strokeWidth={3}
              />
            )}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={cn(
                "font-mono text-[11px] uppercase tracking-[0.12em]",
                isActive && "text-signal-deep",
                isComplete && "text-verified-deep",
                isError && "text-caution-deep",
                agent.status === "queued" && "text-ink-mute"
              )}
            >
              {agent.label}
            </span>
            <StatusPill status={agent.status} />
          </div>

          {/* Transcript */}
          {(agent.transcript.length > 0 || isActive) && !compact && (
            <div className="mt-2 space-y-1 scroll-dossier max-h-48 overflow-y-auto pr-2">
              {agent.transcript
                // Filter out raw JSON lines (start with { or contain "signal":)
                .filter((line) => {
                  const t = line.trim();
                  if (t.startsWith("{") || t.startsWith("}") || t.startsWith('"')) return false;
                  if (t.startsWith("[") || t.startsWith("]")) return false;
                  return true;
                })
                // Strip markdown syntax for the monospace transcript view
                .map((line) => line.replace(/\*\*/g, "").replace(/^[-*]\s+/, "· ").trim())
                .filter(Boolean)
                .map((line, i, arr) => {
                  const isLast = i === arr.length - 1;
                  return (
                    <p
                      key={i}
                      className={cn(
                        "font-mono text-[12.5px] leading-[1.55] text-ink-soft transcript-line",
                        isLast && isActive && "text-ink"
                      )}
                    >
                      <span className="text-ink-mute select-none">›</span>{" "}
                      {line}
                      {isLast && isActive && <span className="transcript-caret" />}
                    </p>
                  );
                })}
            </div>
          )}

          {/* Compact transcript: show only the last line */}
          {compact && agent.transcript.length > 0 && (
            <p className="mt-1 font-mono text-[11px] leading-tight text-ink-mute truncate">
              <span className="select-none">›</span>{" "}
              {agent.transcript[agent.transcript.length - 1]}
            </p>
          )}

          {/* Error note (plain language, no apology) */}
          {isError && agent.errorNote && !compact && (
            <div className="mt-2 border border-caution/40 bg-caution/[0.06] p-3 rounded-[2px]">
              <p className="text-[13px] leading-relaxed text-caution-deep">
                {agent.errorNote}
              </p>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: AgentNodeState["status"] }) {
  const labels: Record<AgentNodeState["status"], string> = {
    queued: "queued",
    running: "running",
    synthesizing: "synthesizing",
    complete: "complete",
    error: "failed",
  };

  const tone: Record<AgentNodeState["status"], string> = {
    queued: "text-ink-mute",
    running: "text-signal-deep",
    synthesizing: "text-ink",
    complete: "text-verified-deep",
    error: "text-caution-deep",
  };

  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.15em] flex items-center gap-1",
        tone[status]
      )}
      aria-label={`Status: ${labels[status]}`}
    >
      {(status === "running" || status === "synthesizing") && (
        <Loader2 className="w-3 h-3 animate-spin" />
      )}
      {status === "complete" && <Check className="w-3 h-3" strokeWidth={3} />}
      {status === "error" && <AlertCircle className="w-3 h-3" />}
      {status === "queued" && <Minus className="w-3 h-3" />}
      {labels[status]}
    </span>
  );
}

// ============================================================================
// ConvergenceGraphic — the spine convergence SVG.
// Three short paths draw together from the bottom of the sub-agent rows into
// a single point. Fades instead of draws when prefers-reduced-motion is set
// (handled by the CSS class on .convergence-path).
// ============================================================================

function ConvergenceGraphic() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative h-12 sm:h-16 -ml-6 sm:-ml-8 mt-4"
      aria-hidden
    >
      <svg
        viewBox="0 0 200 60"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        {/* Three sub-agent lanes converging into one */}
        {[10, 100, 190].map((x, i) => (
          <line
            key={i}
            x1={x}
            y1={2}
            x2={100}
            y2={58}
            stroke="var(--color-signal)"
            strokeWidth={1.25}
            className="convergence-path convergence-path--drawn"
            style={{ transitionDelay: `${i * 120}ms` }}
          />
        ))}
        {/* Convergence node */}
        <circle
          cx={100}
          cy={58}
          r={4}
          fill="var(--color-signal)"
        />
      </svg>
      <p className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-6 font-mono text-[10px] uppercase tracking-[0.15em] text-signal-deep whitespace-nowrap">
        ▼ verdict
      </p>
    </motion.div>
  );
}
