import time
import urllib.request
import xml.etree.ElementTree as ET
import requests
from langchain_core.tools import tool
import yfinance as yf
from yfinance.exceptions import YFRateLimitError
from ddgs import DDGS


def _get_yf_session():
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    })
    return session


def _yf_retry(fn, max_retries=3):
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                time.sleep(1.5 * attempt)
            return fn()
        except Exception:
            if attempt < max_retries - 1:
                continue
            raise


def _fetch_google_news_rss(ticker: str) -> str:
    """Fallback: Fetch recent news from Google News RSS feed."""
    url = f"https://news.google.com/rss/search?q={ticker}+stock&hl=en-US&gl=US&ceid=US:en"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    )
    with urllib.request.urlopen(req, timeout=6) as response:
        xml_data = response.read()

    root = ET.fromstring(xml_data)
    items = root.findall(".//item")
    if not items:
        return ""

    context = f"Top Recent News for {ticker} (Google News):\n"
    for item in items[:6]:
        title = item.find("title").text if item.find("title") is not None else ""
        pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
        source = item.find("source").text if item.find("source") is not None else ""
        if title:
            context += f"- {title} ({source}) [{pub_date}]\n"
    return context


def _fetch_ddg_news(ticker: str) -> str:
    """Fallback: Fetch recent news using DuckDuckGo News."""
    try:
        ddgs = DDGS()
        news = list(ddgs.news(f"{ticker} stock news", max_results=5))
        if not news:
            return ""
        context = f"Top Recent News for {ticker} (DuckDuckGo News):\n"
        for article in news:
            title = article.get("title", "")
            source = article.get("source", "")
            date = article.get("date", "")
            if title:
                context += f"- {title} ({source}) [{date}]\n"
        return context
    except Exception:
        return ""


@tool
def get_sentiment(ticker: str) -> str:
    """
    Fetches recent news headlines and articles for a stock ticker.
    Use this to gauge market mood and recent press coverage.
    """
    # 1. Try Google News RSS (Fastest & Most Reliable: ~300ms)
    try:
        rss_news = _fetch_google_news_rss(ticker)
        if rss_news:
            return rss_news
    except Exception:
        pass

    # 2. Try Yahoo Finance news
    try:
        session = _get_yf_session()
        stock = yf.Ticker(ticker, session=session)
        news = stock.news
        if news and len(news) > 0:
            context = f"Top Recent News for {ticker}:\n"
            for article in news[:5]:
                c = article.get("content", {})
                title = c.get("title", "")
                provider = c.get("provider", {})
                publisher = provider.get("displayName", "")
                pub_date = c.get("pubDate", "")
                if title:
                    context += f"- {title} ({publisher}) [{pub_date}]\n"
            if len(context.strip().split("\n")) > 1:
                return context
    except Exception:
        pass

    # 3. Fallback to DuckDuckGo News
    ddg_news = _fetch_ddg_news(ticker)
    if ddg_news:
        return ddg_news

    return f"No recent news found for {ticker}."



@tool
def get_industry_context(ticker: str) -> str:
    """
    Fetches industry/sector classification and business summary for a stock.
    Use this to understand the company's competitive landscape.
    """
    # 1. Try Yahoo Finance .info
    try:
        session = _get_yf_session()
        stock = yf.Ticker(ticker, session=session)
        info = _yf_retry(lambda: stock.info)
        if not info.get("industry") and not ticker.endswith(".NS"):
            stock = yf.Ticker(f"{ticker}.NS", session=session)
            info = _yf_retry(lambda: stock.info)

        sector = info.get("sector", "N/A")
        industry = info.get("industry", "N/A")
        summary = info.get("longBusinessSummary", "")

        if sector != "N/A" or summary:
            return f"Industry/Sector: {sector} / {industry}\n\nBusiness Summary:\n{summary[:800]}"
    except Exception:
        pass

    # 2. Fallback to DuckDuckGo Search
    try:
        ddgs = DDGS()
        results = list(ddgs.text(f"{ticker} company sector industry business summary profile", max_results=4))
        if results:
            snippets = [r.get("body", "") for r in results if r.get("body")]
            summary_text = "\n".join(snippets)
            return f"Industry/Sector Context for {ticker} (DuckDuckGo Search):\n\nBusiness & Sector Overview:\n{summary_text[:1000]}"
    except Exception as e:
        return f"Error fetching industry context for {ticker}: {str(e)}"

    return f"Unable to fetch industry context for {ticker}."