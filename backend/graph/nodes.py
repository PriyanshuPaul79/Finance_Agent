import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

# Import your tools from Phase 1
from tools.fundamentals import get_fundamentals
from tools.search import get_news_sentiment, get_industry_context
from graph.state import DueDiligenceState

# Initialize LLM
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# Load Prompts
PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")
def load_prompt(name):
    with open(os.path.join(PROMPTS_DIR, name), 'r') as f:
        return f.read()

# --- SUPERVISOR NODE ---
def supervisor_node(state: DueDiligenceState):
    """Determines the next agent to run based on state flags."""
    
    # We bypass the LLM for routing to guarantee 100% reliable state machine logic.
    if not state.get("fundamentals_done"):
        next_agent = "FundamentalsAnalyst"
    elif not state.get("sentiment_done"):
        next_agent = "SentimentAnalyst"
    elif not state.get("industry_done"):
        next_agent = "IndustryAnalyst"
    else:
        next_agent = "FINISH"
        
    return {
        "messages": [HumanMessage(content=f"Supervisor routing to: {next_agent}")],
        "next_agent": next_agent
    }

# --- WORKER NODES ---
def fundamentals_node(state: DueDiligenceState):
    ticker = state["ticker"]
    
    # 1. Fetch data directly (reliable, no LLM tool-calling loops)
    tool_data = get_fundamentals.invoke({"ticker": ticker})
    
    # 2. LLM Analyzes the data
    prompt = load_prompt("fundamentals_analyst.txt").format(ticker=ticker)
    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
    ])
    
    # 3. Update state
    return {
        "fundamentals_analysis": response.content,
        "fundamentals_done": True,
        "messages": [HumanMessage(content=f"Fundamentals Analyst: {response.content}")]
    }

def sentiment_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_news_sentiment.invoke({"ticker": ticker})
    
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

def industry_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_industry_context.invoke({"ticker": ticker})
    
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

# --- SYNTHESIS NODE ---
def synthesis_node(state: DueDiligenceState):
    prompt = load_prompt("synthesis.txt").format(
        ticker=state["ticker"],
        fundamentals_analysis=state.get("fundamentals_analysis", "N/A"),
        sentiment_analysis=state.get("sentiment_analysis", "N/A"),
        industry_analysis=state.get("industry_analysis", "N/A")
    )
    
    response = llm.invoke([SystemMessage(content=prompt)])
    
    return {
        "final_report": response.content,
        "messages": [HumanMessage(content="Synthesizer: Final report generated.")]
    }