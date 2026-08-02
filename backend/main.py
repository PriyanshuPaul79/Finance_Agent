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
from tools.ticker_utils import resolve_ticker_info
from guardrails.input_guardrails import validate_ticker_input, validate_api_key_and_provider
from guardrails.output_guardrails import apply_output_guardrails, clean_json_output

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
    "TechnicalAnalyst": "technical",
}

ANALYSIS_KEY_MAP = {
    "FundamentalsAnalyst": "fundamentals_analysis",
    "SentimentAnalyst": "sentiment_analysis",
    "IndustryAnalyst": "industry_analysis",
    "TechnicalAnalyst": "technical_analysis",
}


def extract_fundamentals(ticker: str) -> dict:
    try:
        tool_data = get_fundamentals.invoke({"ticker": ticker})
        revenue = "N/A"
        net_income = "N/A"
        fcf = "N/A"
        dte = "N/A"

        r = re.search(r'Total Revenue:\s*([^\n]+)', tool_data)
        if r and r.group(1).strip() != "N/A":
            revenue = r.group(1).strip()

        r = re.search(r'Net Income:\s*([^\n]+)', tool_data)
        if r and r.group(1).strip() != "N/A":
            net_income = r.group(1).strip()

        r = re.search(r'Free Cash Flow:\s*([^\n]+)', tool_data)
        if r and r.group(1).strip() != "N/A":
            fcf = r.group(1).strip()

        r = re.search(r'Debt-to-Equity Ratio:\s*([^\n]+)', tool_data)
        if r and r.group(1).strip() != "N/A":
            dte = r.group(1).strip()

        return {
            "revenue": revenue,
            "netIncome": net_income,
            "freeCashFlow": fcf,
            "debtToEquity": dte,
        }
    except Exception:
        return {"revenue": "N/A", "netIncome": "N/A", "freeCashFlow": "N/A", "debtToEquity": "N/A"}


_SENTIMENT_PATTERNS = [
    (r"\bstrongly\s+positive\b|\bvery\s+positive\b|\bhighly\s+positive\b|\bstrongly\s+bullish\b", 85),
    (r"\bcautiously\s+positive\b|\bmildly\s+positive\b|\bslightly\s+positive\b|\bcautiously\s+bullish\b", 40),
    (r"\bpositive\b|\bbullish\b", 65),
    (r"\bstrongly\s+negative\b|\bvery\s+negative\b|\bhighly\s+negative\b|\bstrongly\s+bearish\b", -85),
    (r"\bcautiously\s+negative\b|\bmildly\s+negative\b|\bslightly\s+negative\b|\bcautiously\s+bearish\b", -40),
    (r"\bnegative\b|\bbearish\b", -65),
    (r"\bmixed\b|\bneutral\b", 0),
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
    if not text:
        return {"score": 0, "label": "Mixed / Neutral"}

    text_lower = text.lower()

    section = re.search(
        r'\*\*overall sentiment\*\*[:\s]*(.+?)(?:\n\s*\*\*|$)',
        text_lower,
        re.DOTALL,
    )
    search_text = section.group(1) if section else text_lower

    score = 0
    label = "Mixed / Neutral"

    for pattern, s in _SENTIMENT_PATTERNS:
        if re.search(pattern, search_text):
            score = s
            label = _LABEL_DISPLAY_MAP[s]
            break

    return {"score": score, "label": label}


def build_report(state: dict, ticker: str) -> dict:
    stock, info, resolved_ticker = resolve_ticker_info(ticker)
    company_name = info.get("longName") or info.get("shortName") or resolved_ticker
    sector = info.get("sector") or info.get("industry") or "N/A"

    fund_data = extract_fundamentals(ticker)

    final_report_str = state.get("final_report", "")
    synthesis_data = {}
    if final_report_str:
        cleaned_json = clean_json_output(final_report_str)
        try:
            synthesis_data = json.loads(cleaned_json)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', cleaned_json, re.DOTALL)
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
    technical_text = state.get("technical_analysis", "")
    had_partial_failure = state.get("hadPartialFailure", False)

    raw_report = {
        "ticker": resolved_ticker,
        "companyName": company_name,
        "sector": sector,
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
        "technical": {
            "summary": technical_text,
        },
        "synthesis": {
            "paragraphs": synthesis.get("paragraphs", [final_report_str]),
            "contributions": synthesis.get(
                "contributions",
                [
                    {"agent": "fundamentals", "weight": "Primary", "note": "Financial health assessment"},
                    {"agent": "sentiment", "weight": "Reinforcing", "note": "Market sentiment analysis"},
                    {"agent": "industry", "weight": "Calibrating", "note": "Industry positioning context"},
                    {"agent": "technical", "weight": "Reinforcing", "note": "Technical indicators & price trends"},
                ],
            ),
        },
        "hadPartialFailure": had_partial_failure,
    }

    # Apply Output & Compliance Guardrails
    return apply_output_guardrails(raw_report)


_SENTINEL = object()


def _run_graph_sync(initial_state: dict, event_q: queue.Queue):
    ticker = initial_state["ticker"]
    full_state: dict = dict(initial_state)

    try:
        for output in graph_app.stream(initial_state):
            for node_name, state_update in output.items():
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
    return {"status": "Multi-Agent DD System is running with Guardrails enabled!"}


@app.post("/analyze")
async def analyze_stock(req: AnalyzeRequest):
    # 1. INPUT GUARDRAIL: Validate Ticker & Prompt Injection
    is_valid_ticker, sanitized_ticker, ticker_err = validate_ticker_input(req.ticker)
    if not is_valid_ticker:
        async def err_generator():
            yield sse("agent_error", {
                "agent": "supervisor",
                "note": f"Input Guardrail Violation: {ticker_err}",
            })
            yield sse("done", {"message": "Halted due to Guardrail violation."})
        return EventSourceResponse(err_generator())

    # 2. INPUT GUARDRAIL: Validate Provider & API Key Format
    is_valid_key, key_err = validate_api_key_and_provider(req.llm_provider, req.api_key)
    if not is_valid_key:
        async def err_generator():
            yield sse("agent_error", {
                "agent": "supervisor",
                "note": f"Key Guardrail Violation: {key_err}",
            })
            yield sse("done", {"message": "Halted due to Guardrail violation."})
        return EventSourceResponse(err_generator())

    initial_state = {
        "messages": [{"role": "user", "content": f"Analyze {sanitized_ticker}"}],
        "ticker": sanitized_ticker,
        "llm_provider": req.llm_provider.strip().lower(),   
        "api_key": req.api_key.strip(),
        "fundamentals_done": False,
        "sentiment_done": False,
        "industry_done": False,
        "technical_done": False,
    }

    event_q: queue.Queue = queue.Queue()

    async def event_generator():
        yield sse("supervisor_start", {"ticker": sanitized_ticker})

        loop = asyncio.get_event_loop()
        thread_future = loop.run_in_executor(None, _run_graph_sync, initial_state, event_q)

        while True:
            try:
                item = event_q.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.05)
                continue

            if item is _SENTINEL:
                break

            yield item

        await thread_future
        yield sse("done", {"message": "Analysis complete."})

    return EventSourceResponse(event_generator())
