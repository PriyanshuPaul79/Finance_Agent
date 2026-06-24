import os
import json
import re
import queue
import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from graph.workflow import app as graph_app
from tools.fundamentals import get_fundamentals

app = FastAPI(title="Multi-Agent Financial Due Diligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    ticker: str
    llm_provider: str
    api_key: str


def sse(event_type: str, data: dict):
    return {"event": event_type, "data": json.dumps(data, default=str)}


AGENT_NODE_MAP = {
    "FundamentalsAnalyst": "fundamentals",
    "SentimentAnalyst": "sentiment",
    "IndustryAnalyst": "industry",
}

ANALYSIS_KEY_MAP = {
    "FundamentalsAnalyst": "fundamentals_analysis",
    "SentimentAnalyst": "sentiment_analysis",
    "IndustryAnalyst": "industry_analysis",
}


def extract_fundamentals(ticker: str) -> dict:
    try:
        tool_data = get_fundamentals.invoke({"ticker": ticker})
        revenue = "N/A"
        net_income = "N/A"
        fcf = "N/A"
        dte = "N/A"

        r = re.search(r'Total Revenue:\s*\$\s*([\d,]+(?:\.\d+)?)', tool_data)
        if r:
            revenue = f"${float(r.group(1).replace(',', '')) / 1e9:.1f}B"

        r = re.search(r'Net Income:\s*\$\s*([\d,]+(?:\.\d+)?)', tool_data)
        if r:
            net_income = f"${float(r.group(1).replace(',', '')) / 1e9:.1f}B"

        r = re.search(r'Free Cash Flow:\s*\$\s*([\d,]+(?:\.\d+)?)', tool_data)
        if r:
            fcf = f"${float(r.group(1).replace(',', '')) / 1e9:.1f}B"

        r = re.search(r'Debt-to-Equity Ratio:\s*([\d.]+|N/A)', tool_data)
        if r:
            dte = r.group(1)

        return {
            "revenue": revenue,
            "netIncome": net_income,
            "freeCashFlow": fcf,
            "debtToEquity": dte,
        }
    except Exception:
        return {"revenue": "N/A", "netIncome": "N/A", "freeCashFlow": "N/A", "debtToEquity": "N/A"}


# Sentiment label → numeric score mapping.
# Covers the typical phrases the Groq LLM produces.
_SENTIMENT_SCORE_MAP = [
    (r"strongly\s+positive|very\s+positive|highly\s+positive",          85),
    (r"cautiously\s+positive|mildly\s+positive|slightly\s+positive",    40),
    (r"positive",                                                        65),
    (r"strongly\s+negative|very\s+negative|highly\s+negative",          -85),
    (r"cautiously\s+negative|mildly\s+negative|slightly\s+negative",   -40),
    (r"negative",                                                       -65),
    (r"mixed|neutral",                                                    0),
]

_LABEL_DISPLAY_MAP = {
    85:  "Strongly Positive",
    40:  "Cautiously Positive",
    65:  "Positive",
   -85:  "Strongly Negative",
   -40:  "Cautiously Negative",
   -65:  "Negative",
     0:  "Mixed / Neutral",
}


def extract_sentiment(text: str) -> dict:
    """Parse score and label out of the LLM's sentiment analysis text."""
    if not text:
        return {"score": 0, "label": "Neutral"}

    # Try to find the overall sentiment label.
    # The LLM typically writes things like:
    #   "overall sentiment for AAPL is **Negative**"
    #   "The overall market sentiment is: Cautiously Positive"
    #   "sentiment is mixed"
    # We search the whole text (case-insensitive).
    text_lower = text.lower()

    score = 0  # default neutral
    label = "Neutral"

    for pattern, s in _SENTIMENT_SCORE_MAP:
        if re.search(pattern, text_lower):
            score = s
            label = _LABEL_DISPLAY_MAP[s]
            break

    return {"score": score, "label": label}


def build_report(state: dict, ticker: str) -> dict:
    fund_data = extract_fundamentals(ticker)

    final_report_str = state.get("final_report", "")
    synthesis_data = {}
    if final_report_str:
        try:
            synthesis_data = json.loads(final_report_str)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', final_report_str, re.DOTALL)
            if match:
                try:
                    synthesis_data = json.loads(match.group(0))
                except json.JSONDecodeError:
                    synthesis_data = {}

    verdict = synthesis_data.get("verdict", {})
    synthesis = synthesis_data.get("synthesis", {})

    fundamentals_text = state.get("fundamentals_analysis", "")
    sentiment_text = state.get("sentiment_analysis", "")
    industry_text = state.get("industry_analysis", "")

    return {
        "ticker": ticker,
        "companyName": ticker,
        "sector": "N/A",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "verdict": {
            "signal": verdict.get("signal", "Hold"),
            "headline": verdict.get("headline", "Analysis complete."),
            "reasoning": verdict.get("reasoning", ""),
            "confidence": verdict.get("confidence", 50),
        },
        "fundamentals": {
            "revenue": fund_data["revenue"],
            "netIncome": fund_data["netIncome"],
            "freeCashFlow": fund_data["freeCashFlow"],
            "debtToEquity": fund_data["debtToEquity"],
            "revenueHistory": [],
            "summary": fundamentals_text,
        },
        "sentiment": {
            **extract_sentiment(sentiment_text),
            "summary": sentiment_text,
            "headlines": [],
        },
        "industry": {
            "positioning": industry_text,
            "comparables": [],
            "summary": industry_text,
        },
        "synthesis": {
            "paragraphs": synthesis.get("paragraphs", [final_report_str]),
            "contributions": synthesis.get(
                "contributions",
                [
                    {"agent": "fundamentals", "weight": "Primary", "note": "Financial health assessment"},
                    {"agent": "sentiment", "weight": "Reinforcing", "note": "Market sentiment analysis"},
                    {"agent": "industry", "weight": "Calibrating", "note": "Industry positioning context"},
                ],
            ),
        },
        "hadPartialFailure": False,
    }


# ─────────────────────────────────────────────────────────────────────────────
# The graph.stream() call is synchronous and blocks for several seconds per
# node (LLM calls).  Running it directly inside an async generator starves
# the asyncio event loop so no SSE bytes ever reach the browser until the
# whole graph finishes.
#
# Fix: run the blocking loop in a thread-pool worker.  The worker puts events
# onto a Queue; the async generator drains the queue with a small sleep so it
# never blocks the loop.
# ─────────────────────────────────────────────────────────────────────────────

_SENTINEL = object()  # marks end-of-stream


def _run_graph_sync(initial_state: dict, event_q: queue.Queue):
    """Runs graph_app.stream() in a background thread and pushes SSE dicts onto event_q."""
    ticker = initial_state["ticker"]
    full_state: dict = dict(initial_state)

    try:
        for output in graph_app.stream(initial_state):
            for node_name, state_update in output.items():
                # merge into full_state so build_report has everything
                for k, v in state_update.items():
                    full_state[k] = v

                if node_name == "Supervisor":
                    next_agent = state_update.get("next_agent", "")
                    if next_agent in AGENT_NODE_MAP:
                        agent_id = AGENT_NODE_MAP[next_agent]
                        event_q.put(sse("agent_queued", {"agent": agent_id}))
                        event_q.put(sse("agent_running", {"agent": agent_id}))
                    continue

                if node_name == "Synthesizer":
                    event_q.put(sse("synthesis_start", {}))
                    final_report = state_update.get("final_report", "")
                    if final_report:
                        lines = [l.strip() for l in final_report.split("\n") if l.strip()]
                        for line in lines[:30]:
                            # Skip raw JSON structural lines — only emit readable prose
                            skip = (
                                line.startswith("{") or line.startswith("}") or
                                line.startswith("[") or line.startswith("]") or
                                line.startswith('"') or
                                line.rstrip(",").rstrip() in ("{", "}", "[", "]")
                            )
                            if not skip:
                                event_q.put(sse("synthesis_log", {"line": line}))
                    continue

                analysis_key = ANALYSIS_KEY_MAP.get(node_name)
                if analysis_key:
                    text = state_update.get(analysis_key, "")
                    agent_id = AGENT_NODE_MAP[node_name]
                    lines = [l.strip() for l in text.split("\n") if l.strip()]
                    for line in lines:
                        event_q.put(sse("agent_log", {"agent": agent_id, "line": line}))
                    event_q.put(sse("agent_complete", {"agent": agent_id}))

        report = build_report(full_state, ticker)
        event_q.put(sse("report_ready", {"report": report}))

    except Exception as e:
        event_q.put(sse("agent_error", {
            "agent": "supervisor",
            "note": f"The analysis pipeline failed: {str(e)}. Please try again.",
        }))
    finally:
        event_q.put(_SENTINEL)


@app.get("/")
def read_root():
    return {"status": "Multi-Agent DD System is running!"}


@app.post("/analyze")
async def analyze_stock(req: AnalyzeRequest):
    ticker = req.ticker.upper()

    initial_state = {
        "messages": [{"role": "user", "content": f"Analyze {ticker}"}],
        "ticker": ticker,
        "llm_provider": req.llm_provider,   
        "api_key": req.api_key,
        "fundamentals_done": False,
        "sentiment_done": False,
        "industry_done": False,
    }

    event_q: queue.Queue = queue.Queue()

    async def event_generator():
        # Emit supervisor_start immediately so the UI updates right away
        yield sse("supervisor_start", {"ticker": ticker})

        # Launch the blocking graph in a thread so the event loop stays free
        loop = asyncio.get_event_loop()
        thread_future = loop.run_in_executor(None, _run_graph_sync, initial_state, event_q)

        # Drain the queue asynchronously
        while True:
            try:
                item = event_q.get_nowait()
            except queue.Empty:
                # Nothing yet — yield control back to the event loop briefly
                await asyncio.sleep(0.05)
                continue

            if item is _SENTINEL:
                break

            yield item

        # Make sure the thread is done
        await thread_future

        yield sse("done", {"message": "Analysis complete."})

    return EventSourceResponse(event_generator())
