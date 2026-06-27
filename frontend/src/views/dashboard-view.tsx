"use client";

import { useEffect, useState } from "react";
import { Plus, ArrowRight } from "lucide-react";
import { useRouter } from "@/lib/store";
import { cn } from "@/lib/utils";

// ============================================================================
// DashboardView — history of past analyses.
//
// Each row uses the same monospace-for-data, serif-for-ticker-name pattern
// established elsewhere. Empty state for first-time users: invitation to run
// their first analysis, with a button straight back to /.
// ============================================================================

interface HistoryEntry {
  ticker: string;
  companyName: string;
  verdict: string;
  confidence: number;
  timestamp: string;
  hadPartialFailure: boolean;
}

export function DashboardView() {
  const setView = useRouter((s) => s.setView);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    // Read user's analysis history from localStorage on mount.
    try {
      const stored: HistoryEntry[] = JSON.parse(
        localStorage.getItem("dossier:history") || "[]"
      );
      setEntries(stored);
    } catch {
      setEntries([]);
    }
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <header className="pt-12 pb-8 border-b border-wire">
        <p className="eyebrow mb-3">History</p>
        <h1 className="font-serif font-semibold text-4xl sm:text-5xl tracking-tight text-ink">
          Past analyses
        </h1>
        <p className="mt-3 text-[15px] text-ink-soft max-w-xl">
          Every report you've run is saved here, newest first. Click any row to
          reopen the full Verdikt.
        </p>
      </header>

      <div className="py-6">
        {entries === null ? (
          // Skeleton — matches final row geometry
          <ul className="space-y-px">
            {Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="h-16 skeleton-dossier"
              />
            ))}
          </ul>
        ) : entries.length === 0 ? (
          <EmptyState onNew={() => setView("landing")} />
        ) : (
          <ul className="border-y border-wire">
            <li className="grid grid-cols-12 gap-3 px-3 sm:px-4 py-2 bg-paper-2 border-b border-wire">
              <span className="col-span-3 eyebrow">Ticker</span>
              <span className="col-span-4 sm:col-span-5 eyebrow">Company</span>
              <span className="col-span-2 eyebrow">Verdict</span>
              <span className="col-span-2 eyebrow hidden sm:block">Conf.</span>
              <span className="col-span-3 sm:col-span-2 eyebrow">Date</span>
            </li>
            {entries.map((e, i) => (
              <li key={`${e.ticker}-${i}`}>
                <button
                  onClick={() => setView("analysis", e.ticker)}
                  className={cn(
                    "w-full text-left grid grid-cols-12 gap-3 px-3 sm:px-4 py-4 items-center",
                    "hover:bg-paper-2 transition-colors border-b border-wire/60 last:border-0",
                    "group"
                  )}
                >
                  {/* Ticker — serif, large */}
                  <span className="col-span-3 font-serif text-lg sm:text-xl text-ink tracking-tight">
                    {e.ticker}
                  </span>
                  {/* Company name — body sans */}
                  <span className="col-span-4 sm:col-span-5 text-[13.5px] text-ink-soft truncate">
                    {e.companyName}
                    {e.hadPartialFailure && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-caution-deep">
                        partial
                      </span>
                    )}
                  </span>
                  {/* Verdict badge — color follows the verdict */}
                  <span className="col-span-2">
                    <VerdictBadge verdict={e.verdict} />
                  </span>
                  {/* Confidence — monospace */}
                  <span className="col-span-2 hidden sm:block font-mono text-[13px] text-ink-soft">
                    {e.confidence}
                    <span className="text-ink-mute">/100</span>
                  </span>
                  {/* Date — monospace */}
                  <span className="col-span-3 sm:col-span-2 font-mono text-[11px] text-ink-mute">
                    {formatDate(e.timestamp)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* New analysis CTA */}
      {entries && entries.length > 0 && (
        <div className="pt-4 pb-12">
          <button
            onClick={() => setView("landing")}
            className="inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.12em] text-signal-deep hover:text-signal border-b border-signal-deep hover:border-signal pb-0.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New analysis
          </button>
        </div>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const tone: Record<string, string> = {
    Buy: "text-signal-deep border-signal/50",
    Accumulate: "text-signal-deep border-signal/50",
    Hold: "text-ink border-wire",
    Watch: "text-ink-soft border-wire",
    Reduce: "text-caution-deep border-caution/50",
    Sell: "text-caution-deep border-caution/50",
  };
  const cls = tone[verdict] || "text-ink border-wire";
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-[11px] uppercase tracking-[0.1em] px-2 py-0.5 border",
        cls
      )}
    >
      {verdict}
    </span>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="py-16 text-center">
      <p className="font-serif text-2xl text-ink mb-3">
        No analyses yet.
      </p>
      <p className="text-[15px] text-ink-soft mb-6 max-w-md mx-auto">
        Run your first due-diligence report and it'll be saved here for
        reference.
      </p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 bg-ink text-paper font-mono text-[12px] uppercase tracking-[0.12em] px-5 py-3 hover:bg-signal-deep transition-colors"
      >
        Run your first analysis
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}
