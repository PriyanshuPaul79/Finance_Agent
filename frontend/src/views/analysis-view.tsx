"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, AlertTriangle } from "lucide-react";
import { AgentSpine } from "@/components/agent-spine";
import { VerdictCard } from "@/components/verdict-card";
import {
  FindingsSection,
  FundamentalsFindings,
  SentimentFindings,
  IndustryFindings,
  SynthesisFindings,
} from "@/components/findings-sections";
import { TickerInput } from "@/components/ticker-input";
import { useAnalysis, useRouter } from "@/lib/store";

// ============================================================================
// AnalysisView — the core experience.
//
// Two states that share layout: running and complete. The live agent spine
// IS the loading state — no generic centered spinner. When synthesis
// completes, the spine converges into the verdict card (the one orchestrated
// motion moment), and findings sections appear below, each attached to the
// spine.
// ============================================================================

export function AnalysisView({ ticker }: { ticker: string }) {
  const {
    ticker: activeTicker,
    isRunning,
    isComplete,
    hadPartialFailure,
    agents,
    report,
    errorMessage,
    startRun,
    reset,
  } = useAnalysis();
  const setView = useRouter((s) => s.setView);
  const startedFor = useRef<string | null>(null);

  // Auto-start a run when the ticker changes (via URL or new analysis)
  useEffect(() => {
    const t = ticker.toUpperCase();
    if (startedFor.current === t) return;
    startedFor.current = t;
    reset();
    startRun(t);
  }, [ticker, startRun, reset]);

  // Total failure state — invalid ticker, etc.
  if (errorMessage && !report) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <BackLink />
        <div className="mt-8 border-l-2 border-caution bg-caution/[0.05] p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-caution-deep" />
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-caution-deep">
              Pipeline halted
            </span>
          </div>
          <p className="text-[15px] leading-relaxed text-ink mb-5">
            {errorMessage}
          </p>
          <div className="border-t border-caution/30 pt-5">
            <p className="eyebrow mb-3">Try another ticker</p>
            <TickerInput showExamples={false} />
            <div className="mt-3 flex flex-wrap gap-2">
              {["AAPL", "NVDA", "MSFT", "GOOGL"].map((t) => (
                <button
                  key={t}
                  onClick={() => setView("analysis", t)}
                  className="font-mono text-[12px] px-2.5 py-1 border border-wire hover:border-ink transition-colors text-ink"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayTicker = activeTicker || ticker.toUpperCase();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
      <BackLink />

      {/* Header */}
      <header className="mt-6 pb-6 border-b border-wire">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow mb-2">
              <span className="font-mono">{displayTicker}</span>
              <span className="mx-2 text-ink-mute/50">·</span>
              <span className="text-ink-mute">
                {report
                  ? formatTimestamp(report.timestamp)
                  : new Date().toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
              </span>
              {hadPartialFailure && (
                <>
                  <span className="mx-2 text-ink-mute/50">·</span>
                  <span className="text-caution-deep">partial run</span>
                </>
              )}
            </p>
            <h1 className="font-serif font-semibold text-5xl sm:text-6xl tracking-tight text-ink leading-none">
              {displayTicker}
            </h1>
            <p className="mt-3 text-[15px] text-ink-soft">
              {report ? (
                <>
                  <span className="text-ink">{report.companyName}</span>
                  <span className="mx-1.5 text-ink-mute">·</span>
                  <span>{report.sector}</span>
                </>
              ) : (
                "Loading…"
              )}
            </p>
          </div>

          {/* Run-again action */}
          <button
            onClick={() => {
              startedFor.current = null;
              reset();
              startRun(displayTicker);
            }}
            disabled={isRunning}
            className="shrink-0 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-2 border border-wire hover:border-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-ink"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isComplete ? "Run again" : isRunning ? "Running…" : "New analysis"}
            </span>
          </button>
        </div>
      </header>

      {/* Live agent spine */}
      <section className="pt-7 pb-2" aria-label="Agent activity">
        <div className="flex items-center justify-between mb-5">
          <h2 className="eyebrow">Agent timeline</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">
            {isRunning ? "live" : isComplete ? "complete" : "queued"}
          </span>
        </div>
        <AgentSpine agents={agents} converged={isComplete} />
      </section>

      {/* Verdict card — the single signal-colored moment */}
      {isComplete && report && (
        <section className="mt-10">
          <VerdictCard verdict={report.verdict} />
        </section>
      )}

      {/* Findings sections — attached to the spine, collapsible */}
      {isComplete && report && (
        <section className="mt-12 space-y-2" aria-label="Agent findings">
          <h2 className="eyebrow mb-6">Findings</h2>

          <FindingsSection
            agent="fundamentals"
            agentState={agents.fundamentals}
            title="Fundamentals"
            meta="agent 01"
          >
            <FundamentalsFindings data={report.fundamentals} />
          </FindingsSection>

          <FindingsSection
            agent="sentiment"
            agentState={agents.sentiment}
            title="Sentiment"
            meta="agent 02"
            defaultOpen={agents.sentiment.status !== "error"}
          >
            <SentimentFindings
              data={report.sentiment}
              unavailable={agents.sentiment.status === "error"}
            />
          </FindingsSection>

          <FindingsSection
            agent="industry"
            agentState={agents.industry}
            title="Industry"
            meta="agent 03"
          >
            <IndustryFindings data={report.industry} />
          </FindingsSection>

          <FindingsSection
            agent="supervisor"
            agentState={agents.supervisor}
            title="Synthesis"
            meta="supervisor"
          >
            <SynthesisFindings data={report.synthesis} />
          </FindingsSection>
        </section>
      )}

      {/* Skeleton: when running but no report yet, the spine IS the loading
          state. We add a quiet "compiling findings" hint below the spine. */}
      {isRunning && !report && (
        <div className="mt-10 border-t border-wire pt-6">
          <p className="font-mono text-[12px] text-ink-mute">
            <span className="text-ink-mute/60">›</span> compiling findings as
            agents report back…
          </p>
        </div>
      )}
    </div>
  );
}

function BackLink() {
  const setView = useRouter((s) => s.setView);
  return (
    <div className="pt-8">
      <button
        onClick={() => setView("landing")}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute hover:text-ink transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        New analysis
      </button>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
