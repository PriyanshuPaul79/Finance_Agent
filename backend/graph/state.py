from typing import TypedDict, Annotated, Optional
from langgraph.graph import add_messages

class DueDiligenceState(TypedDict):
    # LangGraph message history for agent context
    messages: Annotated[list, add_messages]
    
    # The target stock ticker (e.g., "AAPL")
    ticker: str
    
    # Routing & Completion Flags
    fundamentals_done: bool
    sentiment_done: bool
    industry_done: bool
    
    # Storage for worker outputs
    fundamentals_analysis: Optional[str]
    sentiment_analysis: Optional[str]
    industry_analysis: Optional[str]
    
    # Final synthesized report
    final_report: Optional[str]