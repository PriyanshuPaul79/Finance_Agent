"use client";

import { motion } from "framer-motion";
import { TickerInput } from "@/components/ticker-input";
import { AgentSpine } from "@/components/agent-spine";
import type { AgentId, AgentNodeState } from "@/lib/types";
import { useRouter } from "@/lib/store";

// ============================================================================
// LandingView — the front door.
//
// Eyebrow + serif headline stating what the tool does, written from the
// user's side. One prominent ticker input. A condensed static preview of the
// agent spine so the mechanism is visible before anyone runs a query.
// ============================================================================

const PREVIEW_AGENTS: Record<AgentId, AgentNodeState> = {
  supervisor: {
    id: "supervisor",
    label: "Supervisor",
    status: "complete",
    transcript: [],
  },
  fundamentals: {
    id: "fundamentals",
    label: "Fundamentals",
    status: "complete",
    transcript: ["Revenue, margins, balance sheet pulled and normalized"],
  },
  sentiment: {
    id: "sentiment",
    label: "Sentiment",
    status: "running",
    transcript: ["Scoring recent headlines against sector lexicon…"],
  },
  industry: {
    id: "industry",
    label: "Industry",
    status: "queued",
    transcript: [],
  },
};

export function LandingView() {
  const setView = useRouter((s) => s.setView);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="pt-12 sm:pt-20 pb-10 sm:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="eyebrow mb-5">
            Multi-agent AI · LangGraph · live orchestration
          </p>
          <h1 className="font-serif font-semibold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-ink max-w-3xl">
            A full due-diligence report on any public stock — written by a team
            of AI analysts, not one.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-soft max-w-2xl">
            A supervisor agent delegates a stock to specialists — fundamentals,
            sentiment, industry — then weaves their findings into a single
            verdict. You watch it happen, line by line.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          className="mt-10 max-w-2xl"
        >
          <TickerInput />
        </motion.div>
      </section>

      {/* Static spine preview — the signature element, shown before any query */}
      <section className="border-t border-wire py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <p className="eyebrow mb-3">The mechanism</p>
            <h2 className="font-serif text-2xl sm:text-3xl text-ink tracking-tight leading-tight mb-4">
              Watch the agents hand off work in real time.
            </h2>
            <p className="text-[15px] leading-relaxed text-ink-soft mb-5">
              Each specialist runs in sequence, streams its reasoning to the
              spine, and reports back. The supervisor synthesizes. Partial
              failures degrade gracefully — if sentiment data is unavailable,
              the pipeline continues with what it has, and the verdict
              confidence is calibrated accordingly.
            </p>
            <button
              onClick={() => setView("architecture")}
              className="font-mono text-[12px] uppercase tracking-[0.12em] text-signal-deep hover:text-signal border-b border-signal-deep hover:border-signal pb-0.5 transition-colors"
            >
              See how it's built →
            </button>
          </div>

          <div className="lg:col-span-7">
            <div className="border border-wire bg-paper-2/30 p-5 sm:p-7">
              <div className="flex items-center justify-between mb-5">
                <span className="eyebrow">Live preview · AAPL</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">
                  demo state
                </span>
              </div>
              <AgentSpine agents={PREVIEW_AGENTS} converged={false} />
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="border-t border-wire py-12 sm:py-16">
        <p className="eyebrow mb-3">What you get</p>
        <h2 className="font-serif text-2xl sm:text-3xl text-ink tracking-tight leading-tight mb-8 max-w-2xl">
          One verdict, built from three lines of inquiry — each auditable.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-wire border border-wire">
          <FeatureCell
            title="Fundamentals"
            body="Revenue, net income, free cash flow, debt-to-equity. Five-year revenue trend. Written summary, not just a table."
          />
          <FeatureCell
            title="Sentiment"
            body="Scored recent headlines with source references and dates. Plain-language summary of the press tone."
          />
          <FeatureCell
            title="Industry"
            body="Competitive positioning, named comparables, relative-valuation cross-check."
          />
        </div>

        <p className="mt-6 text-[14px] leading-relaxed text-ink-soft max-w-2xl">
          The supervisor's synthesis shows how each finding contributed — not a
          black-box paragraph. The verdict card surfaces the single signal,
          headline, and confidence score, calibrated by agent agreement.
        </p>
      </section>
    </div>
  );
}

function FeatureCell({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-paper p-5 sm:p-6">
      <h3 className="font-serif text-lg text-ink mb-2">{title}</h3>
      <p className="text-[13.5px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
