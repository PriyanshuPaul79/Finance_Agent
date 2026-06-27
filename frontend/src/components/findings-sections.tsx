"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentNodeState, AgentId } from "@/lib/types";
import { MarkdownText } from "@/components/markdown-text";

// ============================================================================
// FindingsSection — one per agent, attached to the dossier spine.
//
// Each section is collapsible (auditable by default, foldable for review).
// Order is fixed: Fundamentals → Sentiment → Industry → Synthesis.
// The spine attachment is achieved with a left border + tab-style header,
// not a floating card.
// ============================================================================

interface FindingsSectionProps {
  /** Which agent this section belongs to — used for the eyebrow label */
  agent: AgentId;
  /** Live agent state — used to show the node status next to the title */
  agentState?: AgentNodeState;
  /** Optional title override */
  title: string;
  /** Default open? Defaults to true for the synthesis section. */
  defaultOpen?: boolean;
  /** Right-aligned metadata, e.g. "fundamentals" */
  meta?: string;
  children: React.ReactNode;
}

export function FindingsSection({
  agent,
  agentState,
  title,
  defaultOpen = true,
  meta,
  children,
}: FindingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      asChild
    >
      <section
        className={cn(
          "relative border-l border-wire pl-5 sm:pl-7 ml-3 sm:ml-4",
          "transition-colors",
          open ? "bg-transparent" : "bg-transparent"
        )}
        aria-label={`${title} findings`}
      >
        {/* Section-attached node on the spine */}
        <span
          className={cn(
            "absolute -left-[5px] sm:-left-[7px] top-2 w-2.5 h-2.5 rounded-full border-2",
            "border-wire bg-paper",
            agentState?.status === "complete" && "bg-verified border-verified",
            agentState?.status === "error" && "bg-caution border-caution",
            (agentState?.status === "running" ||
              agentState?.status === "synthesizing") &&
              "bg-signal border-signal"
          )}
          aria-hidden
        />

        <CollapsibleTrigger asChild>
          <button
            className="w-full text-left py-4 group"
            aria-expanded={open}
          >
            <div className="flex items-center gap-3">
              <ChevronRight
                className={cn(
                  "w-4 h-4 text-ink-mute transition-transform shrink-0",
                  open && "rotate-90"
                )}
              />
              <div className="flex-1 flex items-baseline gap-3 flex-wrap">
                <h3 className="font-serif text-xl sm:text-2xl text-ink tracking-tight">
                  {title}
                </h3>
                {agentState?.status === "error" && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-caution-deep">
                    unavailable
                  </span>
                )}
                {agentState?.status === "complete" && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-verified-deep">
                    complete
                  </span>
                )}
              </div>
              {meta && (
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">
                  {meta}
                </span>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="pb-7 pr-1">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

// ============================================================================
// Fundamentals findings — labeled monospace data points + small trend chart.
// ============================================================================

export function FundamentalsFindings({
  data,
}: {
  data: import("@/lib/types").FundamentalsFinding;
}) {
  return (
    <div className="space-y-6">
      {/* Key metrics grid first — numbers before text */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-wire border border-wire">
        <DataPoint label="Revenue (TTM)" value={data.revenue} />
        <DataPoint label="Net income" value={data.netIncome} />
        <DataPoint label="Free cash flow" value={data.freeCashFlow} />
        <DataPoint label="Debt / equity" value={data.debtToEquity} />
      </div>

      {data.revenueHistory.length > 1 && (
        <RevenueSparkline data={data.revenueHistory} />
      )}

      {data.summary && <MarkdownText text={data.summary} />}
    </div>
  );
}

function DataPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper px-3 py-3">
      <p className="eyebrow mb-1.5">{label}</p>
      <p className="font-mono text-base text-ink">{value}</p>
    </div>
  );
}

function RevenueSparkline({
  data,
}: {
  data: { year: string; value: number }[];
}) {
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const w = 280;
  const h = 60;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.value - min) / range) * (h - 8) - 4;
    return { x, y, ...d };
  });
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;

  return (
    <div>
      <p className="eyebrow mb-2">5-year revenue ($B)</p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-md h-auto"
        preserveAspectRatio="none"
      >
        <path d={area} fill="var(--color-signal)" fillOpacity={0.08} />
        <path d={path} fill="none" stroke="var(--color-signal)" strokeWidth={1.5} />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill="var(--color-paper)"
            stroke="var(--color-signal)"
            strokeWidth={1.5}
          />
        ))}
      </svg>
      <div className="flex justify-between mt-1 max-w-md">
        {data.map((d, i) => (
          <span
            key={i}
            className="font-mono text-[10px] text-ink-mute"
          >
            {d.year}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Sentiment findings — score, headline references, written summary.
// ============================================================================

export function SentimentFindings({
  data,
  unavailable,
}: {
  data: import("@/lib/types").SentimentFinding;
  unavailable?: boolean;
}) {
  if (unavailable) {
    return (
      <div className="border border-caution/40 bg-caution/[0.05] p-4 rounded-[2px]">
        <p className="text-[14px] leading-relaxed text-caution-deep">
          {data.summary}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="border border-wire px-4 py-3 min-w-[120px]">
          <p className="eyebrow mb-1">Sentiment score</p>
          <p className="font-mono text-2xl text-ink">
            {data.score > 0 ? "+" : ""}{data.score}
            <span className="text-ink-mute text-sm"> / 100</span>
          </p>
        </div>
        {data.label && (
          <div className="border border-wire px-4 py-3">
            <p className="eyebrow mb-1">Overall tone</p>
            <p className="font-mono text-sm text-ink">{data.label}</p>
          </div>
        )}
      </div>

      {data.summary && <MarkdownText text={data.summary} />}

      {data.headlines.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Headline references</p>
          <ul className="space-y-2.5">
            {data.headlines.map((h, i) => (
              <li
                key={i}
                className="flex items-baseline gap-3 text-[13.5px] leading-relaxed"
              >
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.12em] mt-0.5 shrink-0 w-16",
                    h.sentiment === "positive" && "text-verified-deep",
                    h.sentiment === "negative" && "text-caution-deep",
                    h.sentiment === "neutral" && "text-ink-mute"
                  )}
                >
                  {h.sentiment}
                </span>
                <span className="text-ink-mute font-mono text-[11px] shrink-0 w-20">{h.date}</span>
                <span className="text-ink-mute font-mono text-[11px] shrink-0 w-16">{h.source}</span>
                <a
                  href={h.url}
                  className="text-ink hover:text-signal-deep underline-offset-2 hover:underline transition-colors"
                >
                  {h.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Industry findings — competitive positioning summary, named comparables.
// ============================================================================

export function IndustryFindings({
  data,
}: {
  data: import("@/lib/types").IndustryFinding;
}) {
  // Avoid duplicating identical positioning + summary text
  const hasDuplicateSummary = data.summary === data.positioning;
  return (
    <div className="space-y-5">
      {data.positioning && <MarkdownText text={data.positioning} />}

      {data.comparables.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Comparables</p>
          <ul className="space-y-2">
            {data.comparables.map((c, i) => (
              <li
                key={i}
                className="flex items-baseline gap-3 text-[13.5px] py-2 border-b border-wire/60 last:border-0"
              >
                <span className="font-mono text-sm text-ink w-16 shrink-0">{c.ticker}</span>
                <span className="text-ink w-48 shrink-0 truncate">{c.name}</span>
                <span className="text-ink-soft flex-1">{c.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasDuplicateSummary && data.summary && <MarkdownText text={data.summary} />}
    </div>
  );
}

// ============================================================================
// Synthesis findings — the supervisor's full reasoning + agent contributions.
// The transparency here (each sub-finding's contribution surfaced) is a
// deliberate trust-building choice.
// ============================================================================

export function SynthesisFindings({
  data,
}: {
  data: import("@/lib/types").SynthesisFinding;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {data.paragraphs.map((p, i) => (
          <MarkdownText key={i} text={p} className="text-ink" />
        ))}
      </div>

      <div>
        <p className="eyebrow mb-3">How each agent contributed</p>
        <div className="border border-wire">
          <table className="w-full text-left">
            <thead className="bg-paper-2">
              <tr>
                <th className="eyebrow px-3 py-2 font-normal">Agent</th>
                <th className="eyebrow px-3 py-2 font-normal">Weight</th>
                <th className="eyebrow px-3 py-2 font-normal">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {data.contributions.map((c, i) => (
                <tr
                  key={i}
                  className="border-t border-wire/60 align-top"
                >
                  <td className="px-3 py-2.5 font-mono text-[12px] text-ink capitalize">
                    {c.agent}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em]",
                      c.weight === "Primary" && "text-signal-deep",
                      c.weight === "Reinforcing" && "text-verified-deep",
                      c.weight === "Calibrating" && "text-ink-soft",
                      c.weight === "Unavailable" && "text-caution-deep"
                    )}
                  >
                    {c.weight}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-ink-soft leading-relaxed">
                    {c.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
