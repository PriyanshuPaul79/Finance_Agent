// Shared types for the Dossier system.
// These mirror what a real LangGraph + FastAPI backend would emit over SSE.

export type AgentId = "supervisor" | "fundamentals" | "sentiment" | "industry";

export type AgentStatus =
  | "queued"
  | "running"
  | "complete"
  | "error"
  | "synthesizing";

export interface AgentNodeState {
  id: AgentId;
  label: string; // user-facing, e.g. "Fundamentals"
  status: AgentStatus;
  /** Lines of streamed reasoning/status text, displayed in monospace */
  transcript: string[];
  /** Optional plain-language note shown when status === "error" */
  errorNote?: string;
}

export interface Verdict {
  /** "Buy" / "Hold" / "Sell" / "Accumulate" / "Watch" — analyst-style */
  signal: string;
  /** One-line headline finding, serif face */
  headline: string;
  /** 1–2 sentences of plain-language reasoning, body face */
  reasoning: string;
  /** Composite confidence 0–100 */
  confidence: number;
}

export interface FundamentalsFinding {
  revenue: string; // formatted with currency, e.g. "$383.3B"
  netIncome: string;
  freeCashFlow: string;
  debtToEquity: string;
  revenueHistory: { year: string; value: number }[];
  summary: string;
}

export interface SentimentHeadline {
  source: string;
  title: string;
  url: string;
  sentiment: "positive" | "neutral" | "negative";
  date: string;
}

export interface SentimentFinding {
  score: number; // -100 to 100
  label: string; // "Cautiously positive", etc.
  summary: string;
  headlines: SentimentHeadline[];
}

export interface IndustryFinding {
  positioning: string;
  comparables: { ticker: string; name: string; note: string }[];
  summary: string;
}

export interface SynthesisFinding {
  /** The supervisor's full reasoning, broken into paragraphs */
  paragraphs: string[];
  /** How each sub-finding contributed — surfaced for auditability */
  contributions: { agent: AgentId; weight: string; note: string }[];
}

export interface AnalysisReport {
  ticker: string;
  companyName: string;
  sector: string;
  timestamp: string; // ISO
  verdict: Verdict;
  fundamentals: FundamentalsFinding;
  sentiment: SentimentFinding;
  industry: IndustryFinding;
  synthesis: SynthesisFinding;
  /** True if any sub-agent errored during the run */
  hadPartialFailure: boolean;
}

// SSE-style events emitted by the (mocked) backend.
// In production these arrive as `event:` / `data:` frames over EventSource.
export type AnalysisEvent =
  | { type: "supervisor_start"; ticker: string }
  | { type: "agent_queued"; agent: AgentId }
  | { type: "agent_running"; agent: AgentId }
  | { type: "agent_log"; agent: AgentId; line: string }
  | { type: "agent_complete"; agent: AgentId }
  | { type: "agent_error"; agent: AgentId; note: string }
  | { type: "synthesis_start" }
  | { type: "synthesis_log"; line: string }
  | { type: "report_ready"; report: AnalysisReport };
