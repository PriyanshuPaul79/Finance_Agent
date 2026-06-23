# import os
# from langchain_groq import ChatGroq
# from langchain_core.messages import HumanMessage, SystemMessage
# from dotenv import load_dotenv
# from langchain_openai import ChatOpenAI
# from langchain_google_genai import ChatGoogleGenerativeAI
# # Load environment variables
# load_dotenv()

# # Import your tools from Phase 1
# from tools.fundamentals import get_fundamentals
# from tools.search import get_sentiment, get_industry_context
# from graph.state import DueDiligenceState

# # Initialize LLM
# # llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
# llm = get_llm(state["llm_provider"], state["api_key"])


# # Load Prompts
# PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")
# def load_prompt(name):
#     with open(os.path.join(PROMPTS_DIR, name), 'r') as f:
#         return f.read()

# # --- SUPERVISOR NODE ---
# # def supervisor_node(state: DueDiligenceState):
# #     """Determines the next agent to run based on state flags."""
    
# #     # We bypass the LLM for routing to guarantee 100% reliable state machine logic.
# #     if not state.get("fundamentals_done"):
# #         next_agent = "FundamentalsAnalyst"
# #     elif not state.get("sentiment_done"):
# #         next_agent = "SentimentAnalyst"
# #     elif not state.get("industry_done"):
# #         next_agent = "IndustryAnalyst"
# #     else:
# #         next_agent = "FINISH"
        
# #     return {
# #         "messages": [HumanMessage(content=f"Supervisor routing to: {next_agent}")],
# #         "next_agent": next_agent
# #     }

# def get_llm(provider: str, api_key: str):
#     """Initializes the correct LLM based on user's provider and key."""
    
#     if provider == "openai":
#         return ChatOpenAI(model="gpt-4o-mini", api_key=api_key, temperature=0)
        
#     elif provider == "groq":
#         return ChatGroq(model="llama-3.3-70b-versatile", api_key=api_key, temperature=0)
        
#     elif provider == "gemini":
#         return ChatGoogleGenerativeAI(model="gemini-1.5-flash", api_key=api_key, temperature=0)
        
#     else:
#         raise ValueError(f"Unsupported LLM provider: {provider}")



# def supervisor_node(state: DueDiligenceState):
#     """Determines the next agent to run based on state flags."""
    
#     # We bypass the LLM for routing to guarantee 100% reliable state machine logic.
#     if not state.get("fundamentals_done"):
#         next_agent = "FundamentalsAnalyst"
#     elif not state.get("sentiment_done"):
#         next_agent = "SentimentAnalyst"
#     elif not state.get("industry_done"):
#         next_agent = "IndustryAnalyst"
#     else:
#         next_agent = "FINISH"
        
#     return {
#         "messages": [HumanMessage(content=f"Supervisor routing to: {next_agent}")],
#         "next_agent": next_agent
#     }



# # --- WORKER NODES ---
# def fundamentals_node(state: DueDiligenceState):
#     ticker = state["ticker"]
    
#     # 1. Fetch data directly (reliable, no LLM tool-calling loops)
#     tool_data = get_fundamentals.invoke({"ticker": ticker})
    
#     # 2. LLM Analyzes the data
#     prompt = load_prompt("fundamentals_analyst.txt").format(ticker=ticker)
#     response = llm.invoke([
#         SystemMessage(content=prompt),
#         HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
#     ])
    
#     # 3. Update state
#     return {
#         "fundamentals_analysis": response.content,
#         "fundamentals_done": True,
#         "messages": [HumanMessage(content=f"Fundamentals Analyst: {response.content}")]
#     }

# def sentiment_node(state: DueDiligenceState):
#     ticker = state["ticker"]
#     tool_data = get_sentiment.invoke({"ticker": ticker})
    
#     prompt = load_prompt("sentiment_analyst.txt").format(ticker=ticker)
#     response = llm.invoke([
#         SystemMessage(content=prompt),
#         HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
#     ])
    
#     return {
#         "sentiment_analysis": response.content,
#         "sentiment_done": True,
#         "messages": [HumanMessage(content=f"Sentiment Analyst: {response.content}")]
#     }

# def industry_node(state: DueDiligenceState):
#     ticker = state["ticker"]
#     tool_data = get_industry_context.invoke({"ticker": ticker})
    
#     prompt = load_prompt("industry_analyst.txt").format(ticker=ticker)
#     response = llm.invoke([
#         SystemMessage(content=prompt),
#         HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
#     ])
    
#     return {
#         "industry_analysis": response.content,
#         "industry_done": True,
#         "messages": [HumanMessage(content=f"Industry Analyst: {response.content}")]
#     }

# # --- SYNTHESIS NODE ---
# def synthesis_node(state: DueDiligenceState):
#     prompt = load_prompt("synthesis.txt").format(
#         ticker=state["ticker"],
#         fundamentals_analysis=state.get("fundamentals_analysis", "N/A"),
#         sentiment_analysis=state.get("sentiment_analysis", "N/A"),
#         industry_analysis=state.get("industry_analysis", "N/A")
#     )
    
#     response = llm.invoke([SystemMessage(content=prompt)])
    
#     return {
#         "final_report": response.content,
#         "messages": [HumanMessage(content="Synthesizer: Final report generated.")]
#     }



import os
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

# Load environment variables
load_dotenv()

# Import your tools from Phase 1
# Make sure these match the exact function names in your tools/search.py!
from tools.fundamentals import get_fundamentals
from tools.search import get_news_sentiment, get_industry_context
from graph.state import DueDiligenceState

# Load Prompts
PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")
def load_prompt(name):
    with open(os.path.join(PROMPTS_DIR, name), 'r') as f:
        return f.read()

# --- HELPER: INITIALIZE LLM DYNAMICALLY ---
def get_llm(provider: str, api_key: str):
    """Initializes the correct LLM based on user's provider and key."""
    
    if provider == "openai":
        return ChatOpenAI(model="gpt-4o-mini", api_key=api_key, temperature=0)
        
    elif provider == "groq":
        return ChatGroq(model="llama-3.3-70b-versatile", api_key=api_key, temperature=0)
        
    elif provider == "gemini":
        return ChatGoogleGenerativeAI(model="gemini-1.5-flash", api_key=api_key, temperature=0)
        
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")

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
    
    # 2. Initialize LLM dynamically with user's key
    llm = get_llm(state["llm_provider"], state["api_key"])
    
    # 3. LLM Analyzes the data
    prompt = load_prompt("fundamentals_analyst.txt").format(ticker=ticker)
    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Raw Tool Data:\n{tool_data}")
    ])
    
    # 4. Update state
    return {
        "fundamentals_analysis": response.content,
        "fundamentals_done": True,
        "messages": [HumanMessage(content=f"Fundamentals Analyst: {response.content}")]
    }

def sentiment_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_news_sentiment.invoke({"ticker": ticker})
    
    # Initialize LLM dynamically
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

def industry_node(state: DueDiligenceState):
    ticker = state["ticker"]
    tool_data = get_industry_context.invoke({"ticker": ticker})
    
    # Initialize LLM dynamically
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

# --- SYNTHESIS NODE ---
def synthesis_node(state: DueDiligenceState):
    # Initialize LLM dynamically
    llm = get_llm(state["llm_provider"], state["api_key"])
    
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