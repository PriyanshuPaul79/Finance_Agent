import type { AnalysisEvent, AnalysisReport } from "./types";

// NEXT_PUBLIC_ variables are inlined into the client bundle at build time.
// This file only ever runs in the browser (called from the Zustand store).
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;
const ANALYZE_URL = `${BACKEND_URL}/analyze`;

export interface StreamOptions {
  ticker: string;
  llmProvider: string;
  apiKey: string;
  signal?: AbortSignal;
}

interface SSEMessage {
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export async function* streamAnalysis(
  opts: StreamOptions
): AsyncGenerator<AnalysisEvent, void, void> {
  const controller = new AbortController();

  if (opts.signal) {
    if (opts.signal.aborted) return;
    opts.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  console.log(`[api-stream] POST ${ANALYZE_URL} ticker=${opts.ticker}`);

  let response: Response;
  try {
    response = await fetch(ANALYZE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        ticker: opts.ticker,
        llm_provider: opts.llmProvider,
        api_key: opts.apiKey,
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    throw err;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend returned ${response.status}: ${text}`);
  }

  if (!response.body) {
    throw new Error("Response body is null — SSE stream unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        throw err;
      }

      const { done, value } = chunk;
      if (done) break;

      // Normalize \r\n → \n so the parser works regardless of whether
      // the server sends \n\n or \r\n\r\n as the SSE event separator.
      // sse_starlette uses \r\n\r\n, which breaks a naive "\n\n" split.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      const { parsed, remainder } = extractEvents(buffer);
      buffer = remainder;

      for (const msg of parsed) {
        const ev = toAnalysisEvent(msg);
        if (ev) yield ev;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

function extractEvents(buffer: string): {
  parsed: SSEMessage[];
  remainder: string;
} {
  const parsed: SSEMessage[] = [];
  const parts = buffer.split("\n\n");
  const complete = parts.slice(0, -1);
  const remainder = parts[parts.length - 1];

  for (const block of complete) {
    let eventType = "message";
    let dataStr = "";

    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataStr += line.slice(6);
      }
    }

    if (dataStr) {
      try {
        parsed.push({ event: eventType, data: JSON.parse(dataStr) });
      } catch {
        /* skip malformed frame */
      }
    }
  }

  return { parsed, remainder };
}

function toAnalysisEvent(msg: SSEMessage): AnalysisEvent | null {
  const d = msg.data;
  switch (msg.event) {
    case "supervisor_start":
      return { type: "supervisor_start", ticker: d.ticker };
    case "agent_queued":
      return { type: "agent_queued", agent: d.agent };
    case "agent_running":
      return { type: "agent_running", agent: d.agent };
    case "agent_log":
      return { type: "agent_log", agent: d.agent, line: d.line };
    case "agent_complete":
      return { type: "agent_complete", agent: d.agent };
    case "agent_error":
      return { type: "agent_error", agent: d.agent, note: d.note };
    case "synthesis_start":
      return { type: "synthesis_start" };
    case "synthesis_log":
      return { type: "synthesis_log", line: d.line };
    case "report_ready":
      return { type: "report_ready", report: d.report as AnalysisReport };
    default:
      return null;
  }
}
