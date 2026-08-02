import os
import time
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

from tools.fundamentals import get_fundamentals
from tools.search import get_sentiment, get_industry_context
from tools.technical import get_technical_data
from graph.state import DueDiligenceState
from guardrails.execution_guardrails import circuit_breaker_node_wrapper
from guardrails.output_guardrails import clean_json_output

# Load Prompts
PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")
def load_prompt(name):
    with open(os.path.join(PROMPTS_DIR, name), 'r') as f:
        return f.read()

# --- HELPER: INITIALIZE LLM DYNAMICALLY ---
def get_llm(provider: str, api_key: str):
    """Initializes the correct LLM based on user's provider and key."""
    prov = (provider or "").lower().strip()
    
    if prov == "openai":
        return ChatOpenAI(model="gpt-4o-mini", api_key=api_key, temperature=0)
        
    elif prov == "groq":
        return ChatGroq(model="llama-3.3-70b-versatile", api_key=api_key, temperature=0)
        
    elif prov == "gemini":
        return ChatGoogleGenerativeAI(model="gemini-1.5-flash", api_key=api_key, temperature=0)
        
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

# --- UNWRAPPED WORKER NODES ---
def _raw_fundamentals_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_fundamentals.invoke({"ticker": ticker})
    llm = get_llm(state["llm_provider"], state["api_key"])
    
    prompt = load_prompt("fundamentals_analyst.txt").format(ticker=ticker)
    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
    ])
    
    return {
        "fundamentals_analysis": response.content,
        "fundamentals_done": True,
        "messages": [HumanMessage(content=f"Fundamentals Analyst: {response.content}")]
    }

def _raw_sentiment_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_sentiment.invoke({"ticker": ticker})
    llm = get_llm(state["llm_provider"], state["api_key"])
    
    prompt = load_prompt("sentiment_analyst.txt").format(ticker=ticker)
    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
    ])
    
    return {
        "sentiment_analysis": response.content,
        "sentiment_done": True,
        "messages": [HumanMessage(content=f"Sentiment Analyst: {response.content}")]
    }

def _raw_industry_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_industry_context.invoke({"ticker": ticker})
    llm = get_llm(state["llm_provider"], state["api_key"])
    
    prompt = load_prompt("industry_analyst.txt").format(ticker=ticker)
    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
    ])
    
    return {
        "industry_analysis": response.content,
        "industry_done": True,
        "messages": [HumanMessage(content=f"Industry Analyst: {response.content}")]
    }

def _raw_technical_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_technical_data.invoke({"ticker": ticker})
    llm = get_llm(state["llm_provider"], state["api_key"])

    prompt = load_prompt("technical_analyst.txt").format(ticker=ticker)
    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
    ])

    return {
        "technical_analysis": response.content,
        "technical_done": True,
        "messages": [HumanMessage(content=f"Technical Analyst: {response.content}")]
    }

def _raw_synthesis_node(state: DueDiligenceState):
    llm = get_llm(state["llm_provider"], state["api_key"])
    
    prompt = load_prompt("synthesis.txt").format(
        ticker=state["ticker"],
        fundamentals_analysis=state.get("fundamentals_analysis", "N/A"),
        sentiment_analysis=state.get("sentiment_analysis", "N/A"),
        industry_analysis=state.get("industry_analysis", "N/A"),
        technical_analysis=state.get("technical_analysis", "N/A"),
    )
    
    response = llm.invoke([SystemMessage(content=prompt)])
    cleaned_json = clean_json_output(response.content)
    
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