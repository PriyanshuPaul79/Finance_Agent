from langchain_core.tools import tool
from duckduckgo_search import DDGS
import yfinance as yf

@tool
def get_sentiment(ticker: str) -> str:
    """
    Searches the web for recent news, sentiment, and analyst ratings for a specific 
    stock ticker. Use this to gauge market mood and recent press.
    """
    try:
        with DDGS() as ddgs:
            # .news() specifically searches recent news articles
            results = list(ddgs.news(
                f"{ticker} stock news analyst upgrade downgrade 2024",
                max_results=5
            ))
            
        if not results:
            return f"No recent news found for {ticker}."

        context = f"Top Recent News for {ticker}:\n"
        for r in results:
            # Slicing the body to keep token count low for the LLM
            context += f"- {r['title']}\n  Summary: {r['body'][:200]}...\n  Date: {r['date']}\n"
            
        return context
    except Exception as e:
        return f"Error fetching sentiment for {ticker}: {str(e)}"


@tool
def get_industry_context(ticker: str) -> str:
    """
    Searches for macroeconomic and industry-specific trends affecting a stock. 
    Requires the stock ticker to automatically identify its sector.
    """
    try:
        # 1. Identify the industry using yfinance
        stock = yf.Ticker(ticker)
        industry = stock.info.get("industry", "Technology")
        sector = stock.info.get("sector", "Technology")
        
        # 2. Search for industry trends
        with DDGS() as ddgs:
            # .text() is better for general industry analysis and macro trends
            results = list(ddgs.text(
                f"{sector} {industry} industry trends headwinds tailwinds 2024",
                max_results=4
            ))
            
        if not results:
            return f"Industry context unavailable for {industry}."

        context = f"Industry/Sector: {sector} / {industry}\nIndustry Trends:\n"
        for r in results:
            context += f"- {r['title']}\n  Summary: {r['body'][:200]}...\n"
            
        return context
    except Exception as e:
        return f"Error fetching industry context: {str(e)}"