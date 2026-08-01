import logging
from typing import Callable, Dict, Any
from langchain_core.messages import HumanMessage

logger = logging.getLogger("guardrails.execution")

def circuit_breaker_node_wrapper(node_name: str, analysis_key: str, done_key: str, fn: Callable) -> Callable:
    """
    Wraps a LangGraph worker node function in a circuit breaker guardrail.
    If the node encounters an unhandled LLM or network exception, it catches
    the error gracefully, updates state with a partial failure notice, and prevents
    the whole pipeline from crashing.
    """
    def wrapped(state: Dict[str, Any]) -> Dict[str, Any]:
        try:
            return fn(state)
        except Exception as e:
            logger.error(f"Circuit Breaker activated on node '{node_name}': {str(e)}")
            fallback_message = f"Note: {node_name} analysis was unavailable due to a service error: {str(e)}"
            return {
                analysis_key: fallback_message,
                done_key: True,
                "hadPartialFailure": True,
                "messages": [HumanMessage(content=f"{node_name} Circuit Breaker: {fallback_message}")]
            }

    return wrapped
