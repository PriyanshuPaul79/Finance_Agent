import time
from langchain_core.tools import tool
import yfinance as yf
import pandas as pd

def safe_get(df: pd.DataFrame, row_name: str, default=0):
    if df is None or df.empty or row_name not in df.index:
        return default
    val = df.loc[row_name].iloc[0]
    return val

def _fetch_fundamentals(ticker: str):
    for attempt in range(3):
        try:
            if attempt > 0:
                time.sleep(1.5 * attempt)
            stock = yf.Ticker(ticker)
            income_stmt = stock.financials
            balance_sheet = stock.balance_sheet
            cashflow = stock.cashflow
            if income_stmt is not None and not income_stmt.empty:
                currency = "$"
                try:
                    currency = stock.fast_info.currency or stock.info.get("currency", "$")
                except Exception:
                    pass
                return income_stmt, balance_sheet, cashflow, currency
        except Exception:
            if attempt < 2:
                continue
    return None



@tool
def get_fundamentals(ticker: str) -> str:
    """
    Fetches key fundamental financial data (Revenue, Net Income, FCF, Debt-to-Equity) 
    for a given stock ticker using Yahoo Finance. Use this tool to evaluate the 
    financial health of a company.
    """
    try:
        data = _fetch_fundamentals(ticker)
        if data is None and not ticker.endswith(".NS"):
            data = _fetch_fundamentals(f"{ticker}.NS")
            if data is not None:
                ticker = f"{ticker}.NS"
        if data is None:
            return f"Error: Could not find financial data for {ticker}."

        income_stmt, balance_sheet, cashflow, currency = data

        revenue = safe_get(income_stmt, 'Total Revenue', 0)
        net_income = safe_get(income_stmt, 'Net Income', 0)
        fcf = safe_get(cashflow, 'Free Cash Flow', 0)
        total_debt = safe_get(balance_sheet, 'Total Debt', 0)
        total_equity = safe_get(balance_sheet, 'Stockholders Equity', 1)

        debt_to_equity = float(total_debt) / float(total_equity) if total_equity not in (0, None) else "N/A"
        dte_str = f"{debt_to_equity:.2f}" if isinstance(debt_to_equity, float) else debt_to_equity

        return f"""
        Fundamentals for {ticker} (Most Recent Fiscal Year):
        - Total Revenue: {currency}{float(revenue):,.2f}
        - Net Income: {currency}{float(net_income):,.2f}
        - Free Cash Flow: {currency}{float(fcf):,.2f}
        - Debt-to-Equity Ratio: {dte_str}
        """
    except Exception as e:
        return f"Error fetching fundamentals for {ticker}: {str(e)}"