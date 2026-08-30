import re

from tools.ticker_utils import resolve_ticker_info
from tools.technical import get_technical_data

_SENTIMENT_PATTERNS = [
    (r"\bstrongly\s+positive\b|\bvery\s+positive\b|\bhighly\s+positive\b|\bstrongly\s+bullish\b", 85),
    (r"\bcautiously\s+positive\b|\bmildly\s+positive\b|\bslightly\s+positive\b|\bcautiously\s+bullish\b", 40),
    (r"\bpositive\b|\bbullish\b", 65),
    (r"\bstrongly\s+negative\b|\bvery\s+negative\b|\bhighly\s+negative\b|\bstrongly\s+bearish\b", -85),
    (r"\bcautiously\s+negative\b|\bmildly\s+negative\b|\bslightly\s+negative\b|\bcautiously\s+bearish\b", -40),
    (r"\bnegative\b|\bbearish\b", -65),
    (r"\bmixed\b|\bneutral\b", 0),
]

_LABEL_DISPLAY_MAP = {
    85:  "Strongly Positive",
    40:  "Cautiously Positive",
    65:  "Positive",
   -85:  "Strongly Negative",
   -40:  "Cautiously Negative",
   -65:  "Negative",
     0:  "Mixed / Neutral",
}


def extract_sentiment(text: str) -> dict:
    if not text:
        return {"score": 0, "label": "Mixed / Neutral"}

    text_lower = text.lower()

    section = re.search(
        r'\*\*overall sentiment\*\*[:\s]*(.+?)(?:\n\s*\*\*|$)',
        text_lower,
        re.DOTALL,
    )
    search_text = section.group(1) if section else text_lower

    score = 0
    label = "Mixed / Neutral"

    for pattern, s in _SENTIMENT_PATTERNS:
        if re.search(pattern, search_text):
            score = s
            label = _LABEL_DISPLAY_MAP[s]
            break

    return {"score": score, "label": label}


def sentiment_stance(text: str) -> dict:
    s = extract_sentiment(text)
    return {
        "score": max(5, min(95, round((s["score"] + 100) / 2))),
        "stance": "bullish" if s["score"] >= 0 else "bearish",
    }


def compute_fundamental_score(info: dict) -> int:
    """
    Fundamentals conviction score (0-100) from actual financials.
    Formula: start at 50, then:
      +15 FCF positive / -15 FCF negative
      +15 D/E < 1.0 | +5 D/E < 2.0 | -5 D/E 2.0-3.0 | -15 D/E > 3.0
      +10 profit margin > 15% | +5 margin > 0 | -10 negative margin
      +10 ROE > 15% | +5 ROE > 0 | -10 negative ROE
    Clamped to [5, 95].
    """
    score = 50

    fcf = info.get("freeCashflow")
    if fcf is not None:
        try:
            score += 15 if float(fcf) > 0 else -15
        except Exception:
            pass

    dte = info.get("debtToEquity")
    if dte is not None:
        try:
            dte = float(dte)
            dte = dte / 100.0 if dte > 10 else dte
            score += 15 if dte < 1 else (5 if dte < 2 else (-5 if dte <= 3 else -15))
        except Exception:
            pass

    pm = info.get("profitMargins")
    if pm is not None:
        try:
            pm = float(pm)
            score += 10 if pm > 0.15 else (5 if pm > 0 else -10)
        except Exception:
            pass

    roe = info.get("returnOnEquity")
    if roe is not None:
        try:
            roe = float(roe)
            score += 10 if roe > 0.15 else (5 if roe > 0 else -10)
        except Exception:
            pass

    return max(5, min(95, score))


def fundamentals_stance(info: dict) -> dict:
    score = compute_fundamental_score(info)
    stance = "bullish" if score >= 55 else ("bearish" if score <= 45 else "neutral")
    return {"score": score, "stance": stance}


_INDUSTRY_BULLISH = [
    "tailwind", "growth", "expand", "strong", "strength", "leader", "robust",
    "momentum", "opportunity", "favorable", "outperform",
]
_INDUSTRY_BEARISH = [
    "headwind", "pressure", "weak", "decline", "risk", "sluggish", "challeng",
    "cut", "downside", "volatile", "uncertain",
]


def industry_stance(text: str) -> dict:
    """
    Industry stance from the agent's own analysis text.
    Formula: count bullish vs bearish keywords; score = 50 + (bull - bear) * 10, clamped [5, 95].
    """
    t = text.lower()
    bull = sum(t.count(w) for w in _INDUSTRY_BULLISH)
    bear = sum(t.count(w) for w in _INDUSTRY_BEARISH)
    if bull == bear:
        return {"score": 50, "stance": "neutral"}
    stance = "bullish" if bull > bear else "bearish"
    score = max(5, min(95, 50 + (bull - bear) * 10))
    return {"score": score, "stance": stance}


def technical_stance(tool_data: str) -> dict:
    """
    Technical stance from the tool's own signal math.
    Score = bullish signal ratio * 100 (SMA20/50/200 vs price, MACD histogram, RSI>50).
    """
    m = re.search(r"Technical Score:\s*(\d+)", tool_data)
    score = max(5, min(95, int(m.group(1)))) if m else 50
    trend = re.search(r"Overall Technical Trend:\s*([A-Za-z\s/]+)", tool_data)
    raw = trend.group(1).strip().lower() if trend else "neutral"
    if "bearish" in raw:
        stance = "bearish"
    elif "bullish" in raw:
        stance = "bullish"
    else:
        stance = "neutral"
    return {"score": score, "stance": stance}


def agent_stances(ticker: str, state: dict) -> dict:
    """Derives the 4 agent stances (0-100 score + bullish/bearish/neutral) from real evidence."""
    stock, info, _ = resolve_ticker_info(ticker)
    tech_tool = get_technical_data.invoke({"ticker": ticker})
    return {
        "fundamentals": fundamentals_stance(info),
        "sentiment": sentiment_stance(state.get("sentiment_analysis", "")),
        "industry": industry_stance(state.get("industry_analysis", "")),
        "technical": technical_stance(tech_tool),
    }


def stance_split(agent_scores: dict):
    """Returns the most opposed (bullish, bearish) agent pair, or (None, None) if no split exists."""
    bulls = [k for k, v in agent_scores.items() if v.get("stance") == "bullish"]
    bears = [k for k, v in agent_scores.items() if v.get("stance") == "bearish"]
    if bulls and bears:
        return bulls[0], bears[0]
    return None, None
