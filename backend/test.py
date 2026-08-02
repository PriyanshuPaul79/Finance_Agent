from graph.workflow import app
import os

# Quick check to ensure API key is loaded
print(f"API Key loaded: {'Yes' if os.environ.get('GROQ_API_KEY') or os.environ.get('OPENAI_API_KEY') else 'NO!'}")

provider = "groq" if os.environ.get("GROQ_API_KEY") else "openai"
api_key = os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY") or ""

initial_state = {
    "messages": [{"role": "user", "content": "Analyze AAPL"}],
    "ticker": "MSFT",
    "llm_provider": provider,
    "api_key": api_key,
    "fundamentals_done": False,
    "sentiment_done": False,
    "industry_done": False,
}

print("--- STARTING GRAPH STREAM ---")

# Use stream() instead of invoke() to see the state after every single node executes
for output in app.stream(initial_state):
    # output is a dictionary where the key is the node name, and value is the state update
    for node_name, state_update in output.items():
        print(f"\n{'='*50}")
        print(f"🔵 NODE COMPLETED: {node_name}")
        print(f"{'='*50}")
        
        # Print the specific fields we care about for debugging
        if "next_agent" in state_update:
            print(f"➡️ Routing to: {state_update['next_agent']}")
            
        if "fundamentals_done" in state_update:
            print(f"✅ Fundamentals Done: {state_update['fundamentals_done']}")
            print(f"📝 Fundamentals Analysis:\n{state_update.get('fundamentals_analysis', 'ERROR: NONE RETURNED')[:500]}...")
            
        if "sentiment_done" in state_update:
            print(f"✅ Sentiment Done: {state_update['sentiment_done']}")
            print(f"📝 Sentiment Analysis:\n{state_update.get('sentiment_analysis', 'ERROR: NONE RETURNED')[:500]}...")

        if "industry_done" in state_update:
            print(f"✅ Industry Done: {state_update['industry_done']}")
            print(f"📝 Industry Analysis:\n{state_update.get('industry_analysis', 'ERROR: NONE RETURNED')[:500]}...")

        if "final_report" in state_update:
            print(f"📊 FINAL REPORT GENERATED")

print("\n--- GRAPH FINISHED ---")