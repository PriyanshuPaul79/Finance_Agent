"use client";

import { motion } from "framer-motion";
import type { Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

// ============================================================================
// VerdictCard — the singular conclusion.
//
// This is the single `signal`-colored moment per report. Everything else on
// the page builds toward it. The verdict line reads like a single confident
// analyst sentence; the disclaimer lives in the footer, not here.
// ============================================================================

const SIGNAL_TONE: Record<string, string> = {
  Buy: "text-signal-deep",
  Accumulate: "text-signal-deep",
  Hold: "text-ink",
  Watch: "text-ink-soft",
  Reduce: "text-caution-deep",
  Sell: "text-caution-deep",
};

interface VerdictCardProps {
  verdict: Verdict;
  /** Use to suppress the entrance animation when re-rendering. */
  animate?: boolean;
}

export function VerdictCard({ verdict, animate = true }: VerdictCardProps) {
  const tone = SIGNAL_TONE[verdict.signal] ?? "text-signal-deep";

  const inner = (
    <section
      className="relative border-l-2 border-signal bg-paper-2/60 px-5 py-6 sm:px-8 sm:py-8"
      aria-label="Final verdict"
    >
      {/* Eyebrow */}
      <div className="flex items-center gap-3 mb-4">
        <span className="eyebrow">Verdict</span>
        <span className="h-px flex-1 bg-wire" />
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute">
          confidence {verdict.confidence}
          <span className="text-ink-mute/60">/100</span>
        </span>
      </div>

      {/* Signal badge + headline */}
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 sm:gap-5">
        <div
          className={cn(
            "inline-flex items-baseline gap-2 self-start",
          )}
        >
          <span
            className={cn(
              "font-serif font-semibold text-3xl sm:text-4xl leading-none tracking-tight",
              tone
            )}
          >
            {verdict.signal}
          </span>
        </div>
        <p className="font-serif text-lg sm:text-xl leading-snug text-ink flex-1">
          {verdict.headline}
        </p>
      </div>

      {/* Reasoning — body face */}
      <p className="mt-5 text-[15px] leading-relaxed text-ink-soft max-w-2xl">
        {verdict.reasoning}
      </p>

      {/* Confidence meter */}
      <div className="mt-6 max-w-md">
        <div className="h-1 bg-paper-3 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-signal"
            initial={animate ? { width: 0 } : { width: `${verdict.confidence}%` }}
            animate={{ width: `${verdict.confidence}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          />
        </div>
      </div>
    </section>
  );

  if (!animate) return inner;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {inner}
    </motion.div>
  );
}
