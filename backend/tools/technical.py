import time
import pandas as pd
import yfinance as yf
from langchain_core.tools import tool
from tools.ticker_utils import resolve_ticker_info, format_currency_symbol

def _fetch_price_history(stock, resolved_ticker: str):
    # 1. Try yf.download (public chart API, zero rate limiting)
    for p in ["1y", "6m", "3m"]:
        try:
            hist = yf.download(resolved_ticker, period=p, progress=False)
            if isinstance(hist.columns, pd.MultiIndex):
                hist = hist.xs(resolved_ticker, level=1, axis=1) if resolved_ticker in hist.columns.levels[1] else hist.droplevel(1, axis=1)
            if hist is not None and not hist.empty and len(hist) >= 10:
                return hist, p
        except Exception:
            pass

    # 2. Try stock.history fallback
    for p in ["1y", "6m", "3m"]:
        try:
            hist = stock.history(period=p)
            if hist is not None and not hist.empty and len(hist) >= 10:
                return hist, p
        except Exception:
            pass

    return None, None

@tool
def get_technical_data(ticker: str) -> str:
    """
    Fetches technical indicators (SMA20, SMA50, SMA200, RSI, MACD, Price Performance)
    for a given stock ticker using Yahoo Finance price history.
    Use this to evaluate price trends, momentum, and key technical levels.
    """
    try:
        stock, info, resolved_ticker = resolve_ticker_info(ticker)
        fast_info = getattr(stock, "fast_info", None)

        curr_code = info.get("currency") or getattr(fast_info, "currency", "USD")
        currency = format_currency_symbol(curr_code)

        hist, period_used = _fetch_price_history(stock, resolved_ticker)

        # Retrieve baseline values from fast_info if available
        last_price_fi = getattr(fast_info, "last_price", None)
        high_52w_fi = getattr(fast_info, "year_high", None)
        low_52w_fi = getattr(fast_info, "year_low", None)
        sma50_fi = getattr(fast_info, "fifty_day_average", None)
        sma200_fi = getattr(fast_info, "two_hundred_day_average", None)

        if hist is None or hist.empty or len(hist) < 10:
            if last_price_fi:
                high_str = f"{currency}{high_52w_fi:.2f}" if high_52w_fi else "N/A"
                low_str = f"{currency}{low_52w_fi:.2f}" if low_52w_fi else "N/A"
                sma50_str = f"{currency}{sma50_fi:.2f}" if sma50_fi else "N/A"
                sma200_str = f"{currency}{sma200_fi:.2f}" if sma200_fi else "N/A"
                return f"""Technical Indicators for {resolved_ticker}:
                Current Price: {currency}{last_price_fi:.2f}
                52-Week Range: {low_str} - {high_str}
                50-Day Moving Average: {sma50_str}
                200-Day Moving Average: {sma200_str}
                Note: Full daily price history was unavailable, summary built from fast market metrics.
                """
            return f"Error: Insufficient price history for {resolved_ticker}."

        close = hist["Close"]
        high = hist["High"]
        low = hist["Low"]
        volume = hist["Volume"]

        price = float(close.iloc[-1])
        prev_price = float(close.iloc[-2]) if len(close) > 1 else price
        change_1d = ((price - prev_price) / prev_price) * 100

        change_1m = ((price - float(close.iloc[-21])) / float(close.iloc[-21])) * 100 if len(close) >= 21 else 0.0
        change_6m = ((price - float(close.iloc[-126])) / float(close.iloc[-126])) * 100 if len(close) >= 126 else 0.0
        change_1y = ((price - float(close.iloc[0])) / float(close.iloc[0])) * 100 if len(close) >= 200 else 0.0

        sma_20 = float(close.rolling(20).mean().iloc[-1]) if len(close) >= 20 else price
        sma_50 = float(close.rolling(50).mean().iloc[-1]) if len(close) >= 50 else (sma50_fi or None)
        sma_200 = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else (sma200_fi or None)

        delta = close.diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss if loss is not None else None
        rsi = 100 - (100 / (1 + float(rs.iloc[-1]))) if rs is not None and pd.notna(rs.iloc[-1]) and (1 + float(rs.iloc[-1])) != 0 else 50.0

        ema_12 = close.ewm(span=12).mean()
        ema_26 = close.ewm(span=26).mean()
        macd = ema_12 - ema_26
        macd_signal = macd.ewm(span=9).mean()
        macd_hist = float(macd.iloc[-1] - macd_signal.iloc[-1])

        high_52w = float(high.max()) if high_52w_fi is None else float(high_52w_fi)
        low_52w = float(low.min()) if low_52w_fi is None else float(low_52w_fi)
        avg_vol = float(volume.mean()) if not volume.empty else 0.0

        price_vs_sma20 = ((price - sma_20) / sma_20) * 100 if sma_20 else 0.0
        price_vs_sma50 = ((price - sma_50) / sma_50) * 100 if sma_50 and sma_50 != 0 else None
        price_vs_sma200 = ((price - sma_200) / sma_200) * 100 if sma_200 and sma_200 != 0 else None

        bullish_signals = 0
        total_signals = 0
        if price_vs_sma20 > 0: bullish_signals += 1
        total_signals += 1
        if price_vs_sma50 is not None:
            if price_vs_sma50 > 0: bullish_signals += 1
            total_signals += 1
        if price_vs_sma200 is not None:
            if price_vs_sma200 > 0: bullish_signals += 1
            total_signals += 1
        if macd_hist > 0: bullish_signals += 1
        total_signals += 1
        if rsi > 50: bullish_signals += 1
        total_signals += 1

        ratio = bullish_signals / total_signals if total_signals > 0 else 0.5
        if ratio >= 0.8:
            trend_signal = "Strong Bullish"
        elif ratio >= 0.6:
            trend_signal = "Bullish"
        elif ratio <= 0.2:
            trend_signal = "Strong Bearish"
        elif ratio <= 0.4:
            trend_signal = "Bearish"
        else:
            trend_signal = "Neutral / Mixed"

        sma50_str = f"{currency}{sma_50:.2f} (Price is {price_vs_sma50:+.1f}%)" if price_vs_sma50 is not None else "N/A"
        sma200_str = f"{currency}{sma_200:.2f} (Price is {price_vs_sma200:+.1f}%)" if price_vs_sma200 is not None else "N/A"

        return f"""Technical Indicators for {resolved_ticker} ({period_used or 'historical'} period):
        Overall Technical Trend: {trend_signal}
        Current Price: {currency}{price:.2f} (1D Change: {change_1d:+.2f}%)
        Performance: 1M: {change_1m:+.1f}% | 6M: {change_6m:+.1f}% | 1Y: {change_1y:+.1f}%
        52-Week Range: {currency}{low_52w:.2f} - {currency}{high_52w:.2f}
        SMA(20): {currency}{sma_20:.2f} (Price is {price_vs_sma20:+.1f}% vs SMA20)
        SMA(50): {sma50_str}
        SMA(200): {sma200_str}
        RSI(14): {rsi:.1f} ({'Overbought' if rsi > 70 else 'Oversold' if rsi < 30 else 'Neutral'})
        MACD Line: {currency}{float(macd.iloc[-1]):.2f}
        MACD Signal: {currency}{float(macd_signal.iloc[-1]):.2f}
        MACD Histogram: {currency}{macd_hist:.2f} ({'Bullish Momentum' if macd_hist > 0 else 'Bearish Momentum'})
        Avg Volume: {avg_vol:,.0f}
        """
    except Exception as e:
        return f"Error fetching technical data for {ticker}: {str(e)}"
