import os
import time
from typing import Optional
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from tools.fundamentals import get_fundamentals
from tools.search import get_sentiment, get_industry_context
from tools.technical import get_technical_data
from tools.scoring import agent_stances
from graph.state import DueDiligenceState
from guardrails.execution_guardrails import circuit_breaker_node_wrapper
from guardrails.output_guardrails import clean_json_output

load_dotenv()


# Load Prompts
PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")
def load_prompt(name):
    with open(os.path.join(PROMPTS_DIR, name), 'r') as f:
        return f.read()

_DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "groq": "openai/gpt-oss-120b",
    "gemini": "gemini-3.7-flash",
}

def _resolve_gemini_model(model: Optional[str]) -> str:
    m = (model or "").strip()
    # Reject 1.x and 2.x models and use Gemini 3.x
    if not m or m.startswith("gemini-1") or m.startswith("gemini-2") or "flash" in m and not m.startswith("gemini-3"):
        return "gemini-3.7-flash"
    return m

def _resolve_groq_model(model: Optional[str]) -> str:
    m = (model or "").strip()
    if m in ("openai/gpt-oss-120b", "openai/gpt-oss-20b"):
        return m
    if m in ("gpt-oss-120b", "120b"):
        return "openai/gpt-oss-120b"
    if m in ("gpt-oss-20b", "20b"):
        return "openai/gpt-oss-20b"
    return "openai/gpt-oss-120b"

# --- HELPER: INITIALIZE LLM DYNAMICALLY ---
def get_llm(provider: str, api_key: str, model: Optional[str] = None):
    """Initializes the correct LLM based on user's provider, key, and model."""
    prov = (provider or "").lower().strip()
    raw_model = (model or "").strip()
    resolved_model = raw_model or _DEFAULT_MODELS.get(prov, "gpt-4o-mini")

    if prov == "openai":
        return ChatOpenAI(model=resolved_model, api_key=api_key, temperature=0)

    elif prov == "groq":
        resolved_model = _resolve_groq_model(resolved_model)
        return ChatGroq(model=resolved_model, api_key=api_key, temperature=0)

    elif prov == "gemini":
        resolved_model = _resolve_gemini_model(resolved_model)
        return ChatGoogleGenerativeAI(model=resolved_model, api_key=api_key, google_api_key=api_key, temperature=0)

    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")

# --- SUPERVISOR NODE ---
def supervisor_node(state: DueDiligenceState):
    """Determines the next agent to run based on state flags."""
    if not state.get("fundamentals_done"):
        next_agent = "FundamentalsAnalyst"
    elif not state.get("sentiment_done"):
        next_agent = "SentimentAnalyst"
    elif not state.get("industry_done"):
        next_agent = "IndustryAnalyst"
    elif not state.get("technical_done"):
        next_agent = "TechnicalAnalyst"
    else:
        next_agent = "FINISH"
        
    return {
        "messages": [HumanMessage(content=f"Supervisor routing to: {next_agent}")],
        "next_agent": next_agent
    }

def _format_content(content) -> str:
    """Safely extracts string content from LLM response which may be a list of strings/dicts/parts or a string."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                if "text" in part:
                    parts.append(str(part["text"]))
                elif "content" in part:
                    parts.append(str(part["content"]))
                else:
                    parts.append(str(part))
            elif hasattr(part, "text"):
                parts.append(str(getattr(part, "text")))
            else:
                parts.append(str(part))
        return "\n".join(parts)
    return str(content) if content is not None else ""

# --- UNWRAPPED WORKER NODES ---
def _raw_fundamentals_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_fundamentals.invoke({"ticker": ticker})
    llm = get_llm(state["llm_provider"], state["api_key"], state["model"])

    prompt = load_prompt("fundamentals_analyst.txt").format(ticker=ticker)
    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
    ])
    content = _format_content(response.content)
    
    return {
        "fundamentals_analysis": content,
        "fundamentals_done": True,
        "messages": [HumanMessage(content=f"Fundamentals Analyst: {content}")]
    }

def _raw_sentiment_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_sentiment.invoke({"ticker": ticker})
    llm = get_llm(state["llm_provider"], state["api_key"], state["model"])

    prompt = load_prompt("sentiment_analyst.txt").format(ticker=ticker)
    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
    ])
    content = _format_content(response.content)
    
    return {
        "sentiment_analysis": content,
        "sentiment_done": True,
        "messages": [HumanMessage(content=f"Sentiment Analyst: {content}")]
    }

def _raw_industry_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_industry_context.invoke({"ticker": ticker})
    llm = get_llm(state["llm_provider"], state["api_key"], state["model"])

    prompt = load_prompt("industry_analyst.txt").format(ticker=ticker)
    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
    ])
    content = _format_content(response.content)
    
    return {
        "industry_analysis": content,
        "industry_done": True,
        "messages": [HumanMessage(content=f"Industry Analyst: {content}")]
    }

def _raw_technical_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_technical_data.invoke({"ticker": ticker})
    llm = get_llm(state["llm_provider"], state["api_key"], state["model"])

    prompt = load_prompt("technical_analyst.txt").format(ticker=ticker)
    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
    ])
    content = _format_content(response.content)

    return {
        "technical_analysis": content,
        "technical_done": True,
        "messages": [HumanMessage(content=f"Technical Analyst: {content}")]
    }

def _raw_synthesis_node(state: DueDiligenceState):
    llm = get_llm(state["llm_provider"], state["api_key"], state["model"])

    stances = agent_stances(state["ticker"], state)
    stance_lines = "\n".join(
        f"- {name}: {s['stance']} (score {s['score']})" for name, s in stances.items()
    )

    prompt = load_prompt("synthesis.txt").format(
        ticker=state["ticker"],
        fundamentals_analysis=state.get("fundamentals_analysis", "N/A"),
        sentiment_analysis=state.get("sentiment_analysis", "N/A"),
        industry_analysis=state.get("industry_analysis", "N/A"),
        technical_analysis=state.get("technical_analysis", "N/A"),
        agent_stances=stance_lines,
    )
    
    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content="Synthesize the final verdict report now."),
    ])
    content = _format_content(response.content)
    cleaned_json = clean_json_output(content)
    
    return {
        "final_report": cleaned_json,
        "messages": [HumanMessage(content="Synthesizer: Final report generated.")]
    }

# --- GUARDRAIL WRAPPED NODES ---
fundamentals_node = circuit_breaker_node_wrapper(
    "FundamentalsAnalyst", "fundamentals_analysis", "fundamentals_done", _raw_fundamentals_node
)
sentiment_node = circuit_breaker_node_wrapper(
    "SentimentAnalyst", "sentiment_analysis", "sentiment_done", _raw_sentiment_node
)
industry_node = circuit_breaker_node_wrapper(
    "IndustryAnalyst", "industry_analysis", "industry_done", _raw_industry_node
)
technical_node = circuit_breaker_node_wrapper(
    "TechnicalAnalyst", "technical_analysis", "technical_done", _raw_technical_node
)
synthesis_node = circuit_breaker_node_wrapper(
    "Synthesizer", "final_report", "synthesis_done", _raw_synthesis_node
)