from langgraph.graph import StateGraph, END
from graph.state import DueDiligenceState
from graph.nodes import (
    supervisor_node,
    fundamentals_node,
    sentiment_node,
    industry_node,
    synthesis_node
)

# 1. Initialize the Graph
workflow = StateGraph(DueDiligenceState)

# 2. Add all nodes
workflow.add_node("Supervisor", supervisor_node)
workflow.add_node("FundamentalsAnalyst", fundamentals_node)
workflow.add_node("SentimentAnalyst", sentiment_node)
workflow.add_node("IndustryAnalyst", industry_node)
workflow.add_node("Synthesizer", synthesis_node)

# 3. Set Entry Point
workflow.set_entry_point("Supervisor")

# 4. Define Conditional Routing from Supervisor
def route_from_supervisor(state: DueDiligenceState) -> str:
    return state.get("next_agent", "FINISH")

# Map the string returned by the supervisor to the actual node names
workflow.add_conditional_edges(
    "Supervisor",
    route_from_supervisor,
    {
        "FundamentalsAnalyst": "FundamentalsAnalyst",
        "SentimentAnalyst": "SentimentAnalyst",
        "IndustryAnalyst": "IndustryAnalyst",
        "FINISH": "Synthesizer"
    }
)

# 5. Define edges from Workers back to Supervisor (The Cyclic Loop)
workflow.add_edge("FundamentalsAnalyst", "Supervisor")
workflow.add_edge("SentimentAnalyst", "Supervisor")
workflow.add_edge("IndustryAnalyst", "Supervisor")

# 6. Define End edge
workflow.add_edge("Synthesizer", END)

# 7. Compile the graph
app = workflow.compile()