"use client";

import { create } from "zustand";
import { streamAnalysis } from "./api-stream";
import type {
  AgentId,
  AgentNodeState,
  AgentStatus,
  AnalysisReport,
} from "./types";

// ============================================================================
// View router — single-page app with hash-based routing.
// The sandbox restricts us to the `/` route, but we still want deep-linkable
// URLs and browser back/forward. We sync `view` and `ticker` to the URL hash:
//   #/                  -> landing
//   #/analysis/AAPL     -> analysis for AAPL
//   #/dashboard         -> history
//   #/architecture      -> how it works
// ============================================================================

export type ViewKind = "landing" | "analysis" | "dashboard" | "architecture";

interface RouterState {
  view: ViewKind;
  ticker: string | null;
  setView: (view: ViewKind, ticker?: string | null) => void;
  syncFromHash: () => void;
}

function parseHash(): { view: ViewKind; ticker: string | null } {
  if (typeof window === "undefined") return { view: "landing", ticker: null };
  const raw = window.location.hash.replace(/^#/, "").replace(/^\//, "");
  if (!raw) return { view: "landing", ticker: null };
  const [seg, param] = raw.split("/");
  if (seg === "analysis" && param) {
    return { view: "analysis", ticker: param.toUpperCase() };
  }
  if (seg === "dashboard") return { view: "dashboard", ticker: null };
  if (seg === "architecture") return { view: "architecture", ticker: null };
  return { view: "landing", ticker: null };
}

function buildHash(view: ViewKind, ticker: string | null): string {
  if (view === "analysis" && ticker) return `#/analysis/${ticker}`;
  if (view === "dashboard") return "#/dashboard";
  if (view === "architecture") return "#/architecture";
  return "#/";
}

export const useRouter = create<RouterState>((set, get) => ({
  view: "landing",
  ticker: null,
  setView: (view, ticker = null) => {
    const targetTicker =
      view === "analysis" ? ticker ?? get().ticker ?? null : null;
    if (typeof window !== "undefined") {
      const newHash = buildHash(view, targetTicker);
      if (window.location.hash !== newHash) {
        window.location.hash = newHash;
      }
    }
    set({ view, ticker: targetTicker });
  },
  syncFromHash: () => {
    const parsed = parseHash();
    set({ view: parsed.view, ticker: parsed.ticker });
  },
}));

// ============================================================================
// Live analysis state — the agent spine, current transcript, and final report.
// Driven by `streamAnalysis()` from api-stream.ts.
// ============================================================================

const INITIAL_AGENTS: Record<AgentId, AgentNodeState> = {
  supervisor: {
    id: "supervisor",
    label: "Supervisor",
    status: "queued",
    transcript: [],
  },
  fundamentals: {
    id: "fundamentals",
    label: "Fundamentals",
    status: "queued",
    transcript: [],
  },
  sentiment: {
    id: "sentiment",
    label: "Sentiment",
    status: "queued",
    transcript: [],
  },
  industry: {
    id: "industry",
    label: "Industry",
    status: "queued",
    transcript: [],
  },
};

interface AnalysisState {
  ticker: string | null;
  isRunning: boolean;
  isComplete: boolean;
  hadPartialFailure: boolean;
  agents: Record<AgentId, AgentNodeState>;
  report: AnalysisReport | null;
  errorMessage: string | null;
  llmProvider: string;
  apiKey: string;
  // Internal: AbortController for the current run
  _abort: AbortController | null;

  startRun: (ticker: string) => Promise<void>;
  cancelRun: () => void;
  reset: () => void;
  setLlmProvider: (provider: string) => void;
  setApiKey: (key: string) => void;
}

export const useAnalysis = create<AnalysisState>((set, get) => ({
  ticker: null,
  isRunning: false,
  isComplete: false,
  hadPartialFailure: false,
  agents: structuredClone(INITIAL_AGENTS),
  report: null,
  errorMessage: null,
  llmProvider: "groq",
  apiKey: "",
  _abort: null,

  startRun: async (ticker: string) => {
    // Cancel any prior run
    get()._abort?.abort();

    const abort = new AbortController();
    set({
      ticker: ticker.toUpperCase(),
      isRunning: true,
      isComplete: false,
      hadPartialFailure: false,
      agents: structuredClone(INITIAL_AGENTS),
      report: null,
      errorMessage: null,
      _abort: abort,
    });

    // Mark supervisor as running immediately
    set((s) => ({
      agents: {
        ...s.agents,
        supervisor: {
          ...s.agents.supervisor,
          status: "running" as AgentStatus,
          transcript: [`Delegating to specialist agents for ${ticker.toUpperCase()}…`],
        },
      },
    }));

    try {
      for await (const ev of streamAnalysis({
        ticker,
        llmProvider: get().llmProvider,
        apiKey: get().apiKey,
        signal: abort.signal,
      })) {
        if (abort.signal.aborted) return;

        switch (ev.type) {
          case "supervisor_start":
            // Already handled above; no-op
            break;

          case "agent_queued":
            set((s) => ({
              agents: {
                ...s.agents,
                [ev.agent]: {
                  ...s.agents[ev.agent],
                  status: "queued" as AgentStatus,
                },
              },
            }));
            break;

          case "agent_running":
            set((s) => ({
              agents: {
                ...s.agents,
                [ev.agent]: {
                  ...s.agents[ev.agent],
                  status: "running" as AgentStatus,
                  transcript:
                    s.agents[ev.agent].transcript.length === 0
                      ? ["Starting…"]
                      : s.agents[ev.agent].transcript,
                },
              },
            }));
            break;

          case "agent_log":
            set((s) => {
              // If the "Starting…" placeholder is still there, replace it.
              const current = s.agents[ev.agent].transcript;
              const next =
                current.length === 1 && current[0] === "Starting…"
                  ? [ev.line]
                  : [...current, ev.line];
              return {
                agents: {
                  ...s.agents,
                  [ev.agent]: {
                    ...s.agents[ev.agent],
                    transcript: next,
                  },
                },
              };
            });
            break;

          case "agent_complete":
            set((s) => ({
              agents: {
                ...s.agents,
                [ev.agent]: {
                  ...s.agents[ev.agent],
                  status: "complete" as AgentStatus,
                },
              },
            }));
            break;

          case "agent_error":
            if (ev.agent === "supervisor") {
              // Total pipeline failure
              set({
                errorMessage: ev.note,
                isRunning: false,
                isComplete: false,
                agents: {
                  ...get().agents,
                  supervisor: {
                    ...get().agents.supervisor,
                    status: "error" as AgentStatus,
                    errorNote: ev.note,
                  },
                },
              });
              return;
            }
            // Partial failure — flag the agent, keep the pipeline going
            set((s) => ({
              hadPartialFailure: true,
              agents: {
                ...s.agents,
                [ev.agent]: {
                  ...s.agents[ev.agent],
                  status: "error" as AgentStatus,
                  errorNote: ev.note,
                  transcript: [
                    ...s.agents[ev.agent].transcript,
                    "— aborted —",
                  ],
                },
              },
            }));
            break;

          case "synthesis_start":
            set((s) => ({
              agents: {
                ...s.agents,
                supervisor: {
                  ...s.agents.supervisor,
                  status: "synthesizing" as AgentStatus,
                  transcript: [
                    ...s.agents.supervisor.transcript,
                    "Synthesizing findings into a single verdict…",
                  ],
                },
              },
            }));
            break;

          case "synthesis_log":
            set((s) => ({
              agents: {
                ...s.agents,
                supervisor: {
                  ...s.agents.supervisor,
                  transcript: [...s.agents.supervisor.transcript, ev.line],
                },
              },
            }));
            break;

          case "report_ready":
            set((s) => ({
              report: ev.report,
              isRunning: false,
              isComplete: true,
              agents: {
                ...s.agents,
                supervisor: {
                  ...s.agents.supervisor,
                  status: "complete" as AgentStatus,
                },
              },
            }));
            // Persist to the dashboard history (localStorage)
            try {
              const key = "dossier:history";
              const existing = JSON.parse(localStorage.getItem(key) || "[]");
              const entry = {
                ticker: ev.report.ticker,
                companyName: ev.report.companyName,
                verdict: ev.report.verdict.signal,
                confidence: ev.report.verdict.confidence,
                timestamp: ev.report.timestamp,
                hadPartialFailure: ev.report.hadPartialFailure,
              };
              const next = [entry, ...existing].slice(0, 25);
              localStorage.setItem(key, JSON.stringify(next));
            } catch {
              /* ignore quota errors */
            }
            break;
        }
      }
    } catch (err) {
      set({
        errorMessage:
          err instanceof Error
            ? err.message
            : "The analysis pipeline failed unexpectedly.",
        isRunning: false,
      });
    }
  },

  cancelRun: () => {
    get()._abort?.abort();
    set({
      isRunning: false,
      _abort: null,
      agents: {
        ...get().agents,
        supervisor: {
          ...get().agents.supervisor,
          status: "queued",
          transcript: [],
        },
      },
    });
  },

  reset: () => {
    get()._abort?.abort();
    set({
      ticker: null,
      isRunning: false,
      isComplete: false,
      hadPartialFailure: false,
      agents: structuredClone(INITIAL_AGENTS),
      report: null,
      errorMessage: null,
      _abort: null,
    });
  },
  setLlmProvider: (provider: string) => {
    set({ llmProvider: provider });
    if (typeof window !== "undefined") {
      localStorage.setItem("dossier:llm_provider", provider);
    }
  },
  setApiKey: (apiKey: string) => {
    set({ apiKey });
    if (typeof window !== "undefined") {
      localStorage.setItem("dossier:api_key", apiKey);
    }
  },
}));
