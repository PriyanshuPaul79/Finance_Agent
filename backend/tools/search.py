import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from langchain_core.tools import tool
import yfinance as yf
from ddgs import DDGS
from tools.ticker_utils import resolve_ticker_info

def _fetch_google_news_rss(search_query: str) -> str:
    """Fetch recent news from Google News RSS feed."""
    encoded_query = urllib.parse.quote(search_query)
    url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-US&gl=US&ceid=US:en"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"}
    )
    with urllib.request.urlopen(req, timeout=6) as response:
        xml_data = response.read()

    root = ET.fromstring(xml_data)
    items = root.findall(".//item")
    if not items:
        return ""

    context = ""
    for item in items[:6]:
        title = item.find("title").text if item.find("title") is not None else ""
        pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
        source = item.find("source").text if item.find("source") is not None else ""
        link = item.find("link").text if item.find("link") is not None else ""
        if title:
            context += f"- Headline: {title} | Source: {source} | Date: {pub_date}\n"
    return context

def _fetch_ddg_news(query: str) -> str:
    """Fetch recent news using DuckDuckGo News."""
    try:
        ddgs = DDGS()
        news = list(ddgs.news(query, max_results=5))
        if not news:
            return ""
        context = ""
        for article in news:
            title = article.get("title", "")
            source = article.get("source", "")
            date = article.get("date", "")
            if title:
                context += f"- Headline: {title} | Source: {source} | Date: {date}\n"
        return context
    except Exception:
        return ""

@tool
def get_sentiment(ticker: str) -> str:
    """
    Fetches recent news headlines and articles for a stock ticker.
    Use this to gauge market mood and recent press coverage.
    """
    stock, info, resolved_ticker = resolve_ticker_info(ticker)
    company_name = info.get("shortName") or info.get("longName") or resolved_ticker

    queries = [
        f"{company_name} stock news",
        f"{resolved_ticker} stock news",
        f"{company_name} news"
    ]

    # 1. Try Google News RSS
    for q in queries:
        try:
            rss_news = _fetch_google_news_rss(q)
            if rss_news:
                return f"Top Recent News for {company_name} ({resolved_ticker}):\n" + rss_news
        except Exception:
            continue

    # 2. Try Yahoo Finance news
    try:
        news = stock.news
        if news and len(news) > 0:
            context = f"Top Recent News for {company_name} ({resolved_ticker}):\n"
            for article in news[:5]:
                c = article.get("content", {})
                title = c.get("title", "")
                provider = c.get("provider", {})
                publisher = provider.get("displayName", "")
                pub_date = c.get("pubDate", "")
                if title:
                    context += f"- Headline: {title} | Source: {publisher} | Date: {pub_date}\n"
            if len(context.strip().split("\n")) > 1:
                return context
    except Exception:
        pass

    # 3. Fallback to DuckDuckGo News
    for q in queries:
        ddg_news = _fetch_ddg_news(q)
        if ddg_news:
            return f"Top Recent News for {company_name} ({resolved_ticker}) (DuckDuckGo):\n" + ddg_news

    return f"No recent news found for {company_name} ({resolved_ticker})."

@tool
def get_industry_context(ticker: str) -> str:
    """
    Fetches industry/sector classification, business summary, and market context for a stock.
    Use this to understand the company's competitive landscape.
    """
    stock, info, resolved_ticker = resolve_ticker_info(ticker)
    
    sector = info.get("sector", "N/A")
    industry = info.get("industry", "N/A")
    summary = info.get("longBusinessSummary", "")
    company_name = info.get("longName") or info.get("shortName") or resolved_ticker

    if sector != "N/A" or summary:
        return f"""
Company: {company_name} ({resolved_ticker})
Sector: {sector}
Industry: {industry}

Business & Sector Summary:
{summary[:1000]}
""".strip()

    # Fallback to DuckDuckGo Search
    try:
        ddgs = DDGS()
        results = list(ddgs.text(f"{resolved_ticker} {company_name} company sector industry business profile", max_results=4))
        if results:
            snippets = [r.get("body", "") for r in results if r.get("body")]
            summary_text = "\n".join(snippets)
            return f"Industry/Sector Context for {company_name} ({resolved_ticker}):\n\nBusiness & Sector Overview:\n{summary_text[:1000]}"
    except Exception as e:
        return f"Error fetching industry context for {ticker}: {str(e)}"

    return f"Unable to fetch industry context for {ticker}."