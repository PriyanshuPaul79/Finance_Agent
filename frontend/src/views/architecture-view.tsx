"use client";

import { Github, ArrowRight } from "lucide-react";
import { useRouter } from "@/lib/store";

// ============================================================================
// ArchitectureView — how it works.
//
// A diagram of the LangGraph supervisor pattern, built in the same visual
// language as the live spine (so this page doubles as a legend for the
// interactive one). Tech stack listed plainly. Written for a technical
// reader — recruiter or engineer evaluating the build.
// ============================================================================

export function ArchitectureView() {
  const setView = useRouter((s) => s.setView);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <header className="pt-12 pb-8 border-b border-wire">
        <p className="eyebrow mb-3">How it works</p>
        <h1 className="font-serif font-semibold text-4xl sm:text-5xl tracking-tight text-ink">
          A supervisor, three specialists, one verdict.
        </h1>
        <p className="mt-4 text-[15px] text-ink-soft max-w-2xl leading-relaxed">
          The backend is a LangGraph state machine. A supervisor node receives
          a ticker, delegates work to three worker agents in sequence, and
          synthesizes their findings into a single verdict. Every step of the
          process streams to the frontend over Server-Sent Events — which is
          why the spine on the analysis page is alive, not just a loading bar.
        </p>
      </header>

      {/* Diagram */}
      <section className="py-10">
        <p className="eyebrow mb-5">Graph topology</p>
        <div className="border border-wire bg-paper-2/30 p-6 sm:p-10">
          <ArchitectureDiagram />
        </div>
        <p className="mt-4 text-[13px] text-ink-mute max-w-2xl">
          The same node states you see on the live spine — queued, running,
          complete, error — are surfaced here as a legend. Partial failures
          don't halt the graph; the supervisor collects whatever each worker
          returned and recalibrates confidence accordingly.
        </p>
      </section>

      {/* Tech stack */}
      <section className="py-10 border-t border-wire">
        <p className="eyebrow mb-5">Stack</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-wire border border-wire">
          <StackCell
            layer="Orchestration"
            tech="LangGraph (Supervisor pattern)"
            note="State graph with one supervisor node + three worker nodes. Workers run sequentially; the supervisor aggregates via a synthesis node."
          />
          <StackCell
            layer="Backend"
            tech="FastAPI + SSE"
            note="Async endpoint streams `astream_events()` frames to the frontend as `event:` / `data:` lines over a persistent connection."
          />
          <StackCell
            layer="Data sources"
            tech="Financial APIs + news + sector taxonomy"
            note="Fundamentals pulls from financial-statements APIs. Sentiment queries news providers and scores against a sector-aware lexicon. Industry uses a static sector/comparables taxonomy."
          />
          <StackCell
            layer="Frontend"
            tech="Next.js 16 (App Router) · TypeScript · Tailwind 4"
            note="Single-page experience with hash-based routing. Agent spine rendered as a state machine; spine convergence is the one orchestrated motion moment."
          />
          <StackCell
            layer="Persistence"
            tech="Postgres (Supabase)"
            note="Past reports stored with ticker, verdict, confidence, timestamp, and the full agent transcript for auditability."
          />
          <StackCell
            layer="Deploy"
            tech="Vercel (frontend) · Fly.io / Render (backend)"
            note="Frontend on Vercel for edge proximity. Backend on a long-running host to keep SSE connections alive."
          />
        </div>
      </section>

      {/* Partial-failure handling — surfaced as a deliberate feature */}
      <section className="py-10 border-t border-wire">
        <p className="eyebrow mb-5">Partial-failure handling</p>
        <div className="space-y-4 max-w-2xl">
          <p className="text-[14.5px] leading-relaxed text-ink-soft">
            Most multi-agent demos either succeed completely or fail
            completely. Real data sources don't work that way — a news
            provider rate-limits, a fundamentals endpoint lags, a sector
            taxonomy has a gap. Verdikt treats each agent failure as a
            first-class signal, not a crash.
          </p>
          <p className="text-[14.5px] leading-relaxed text-ink-soft">
            When an agent errors mid-run, its node on the spine turns caution
            red with a plain-language explanation, the rest of the pipeline
            continues with what it has, and the supervisor's synthesis
            explicitly notes which input was missing and recalibrates
            confidence downward. Try{" "}
            <button
              onClick={() => setView("analysis", "TSLA")}
              className="font-mono text-[13px] text-signal-deep hover:text-signal border-b border-signal-deep hover:border-signal pb-0.5 transition-colors"
            >
              TSLA
            </button>{" "}
            to see this in action — its sentiment agent is configured to fail
            on this demo build.
          </p>
        </div>
      </section>

      {/* Source */}
      <section className="py-10 border-t border-wire">
        <p className="eyebrow mb-5">Source</p>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 border border-wire hover:border-ink px-5 py-3 transition-colors group"
        >
          <Github className="w-5 h-5 text-ink" />
          <span className="font-mono text-[13px] text-ink">
            github.com/your-handle/Verdikt
          </span>
          <ArrowRight className="w-4 h-4 text-ink-mute group-hover:text-ink group-hover:translate-x-0.5 transition-all" />
        </a>
        <p className="mt-3 text-[12.5px] text-ink-mute">
          The repo includes the LangGraph backend, the FastAPI SSE endpoint,
          the Next.js frontend, and a docker-compose for local Postgres.
        </p>
      </section>
    </div>
  );
}

function StackCell({
  layer,
  tech,
  note,
}: {
  layer: string;
  tech: string;
  note: string;
}) {
  return (
    <div className="bg-paper p-5">
      <p className="eyebrow mb-1.5">{layer}</p>
      <p className="font-mono text-[13.5px] text-ink mb-2">{tech}</p>
      <p className="text-[12.5px] leading-relaxed text-ink-soft">{note}</p>
    </div>
  );
}

// ============================================================================
// ArchitectureDiagram — built in the same visual language as the live spine.
// Doubles as a legend: the node states match exactly.
// ============================================================================

function ArchitectureDiagram() {
  return (
    <div className="font-mono text-[12px] text-ink-soft">
      <div className="flex flex-col items-center gap-2">
        {/* Supervisor */}
        <DiagramNode
          label="Supervisor"
          sublabel="LangGraph entry node"
          tone="ink"
        />
        <DiagramArrow label="delegates" />
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-center">
          <DiagramNode
            label="Fundamentals"
            sublabel="financial statements"
            tone="verified"
          />
          <DiagramNode
            label="Sentiment"
            sublabel="news + scoring"
            tone="signal"
          />
          <DiagramNode
            label="Industry"
            sublabel="comparables + positioning"
            tone="queued"
          />
        </div>
        <DiagramArrow label="findings returned" up />
        <DiagramNode
          label="Synthesis"
          sublabel="supervisor aggregates + calibrates"
          tone="ink"
        />
        <DiagramArrow label="verdict" />
        <DiagramNode
          label="Verdict card"
          sublabel="signal · headline · confidence"
          tone="signal"
          final
        />
      </div>

      {/* Legend */}
      <div className="mt-8 pt-6 border-t border-wire grid grid-cols-2 sm:grid-cols-4 gap-3">
        <LegendItem label="queued" tone="queued" />
        <LegendItem label="running" tone="signal" />
        <LegendItem label="complete" tone="verified" />
        <LegendItem label="error" tone="caution" />
      </div>
    </div>
  );
}

function DiagramNode({
  label,
  sublabel,
  tone,
  final,
}: {
  label: string;
  sublabel: string;
  tone: "ink" | "signal" | "verified" | "queued" | "caution";
  final?: boolean;
}) {
  const toneCls = {
    ink: "border-ink text-ink bg-paper",
    signal: "border-signal text-signal-deep bg-signal/[0.06]",
    verified: "border-verified text-verified-deep bg-verified/[0.06]",
    queued: "border-wire text-ink-mute bg-paper",
    caution: "border-caution text-caution-deep bg-caution/[0.06]",
  }[tone];

  return (
    <div
      className={`min-w-[180px] sm:min-w-[200px] border ${toneCls} px-4 py-3 text-center ${
        final ? "ring-1 ring-signal/30" : ""
      }`}
    >
      <p className="text-[13px] font-semibold tracking-tight">{label}</p>
      <p className="text-[10.5px] text-ink-mute mt-0.5">{sublabel}</p>
    </div>
  );
}

function DiagramArrow({
  label,
  up,
}: {
  label: string;
  up?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-0.5">
      <span className="text-[10px] text-ink-mute uppercase tracking-[0.12em]">
        {label}
      </span>
      <span className="text-ink-mute text-base leading-none">
        {up ? "↑" : "↓"}
      </span>
    </div>
  );
}

function LegendItem({
  label,
  tone,
}: {
  label: string;
  tone: "queued" | "signal" | "verified" | "caution";
}) {
  const cls = {
    queued: "border-wire bg-paper",
    signal: "border-signal bg-signal",
    verified: "border-verified bg-verified",
    caution: "border-caution bg-caution",
  }[tone];
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full border ${cls}`} />
      <span className="text-[11px] uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
    </div>
  );
}
