"use client";

import { useState, useRef, useEffect, useId } from "react";
import { Search, ArrowRight, X } from "lucide-react";
import { useRouter, useAnalysis } from "@/lib/store";
import { cn } from "@/lib/utils";

// ============================================================================
// TickerInput — the primary entry point on the landing page.
//
// Autocomplete dropdown that filters popular tickers. Submitting either via
// Enter on a highlighted row or by typing a known ticker + Enter kicks off
// a new analysis and routes to /analysis/[ticker].
// ============================================================================

const POPULAR_TICKERS = [
  // ── Best condition ────────────────────────────────────────────────────────
  { ticker: "NVDA",  name: "NVIDIA Corporation",         sector: "Technology · Semiconductors",                 condition: "best" },
  { ticker: "MSFT",  name: "Microsoft Corporation",      sector: "Technology · Software - Infrastructure",      condition: "best" },
  // ── Good condition ────────────────────────────────────────────────────────
  { ticker: "AAPL",  name: "Apple Inc.",                 sector: "Technology · Consumer Electronics",           condition: "good" },
  { ticker: "AMZN",  name: "Amazon.com, Inc.",           sector: "Consumer Cyclical · Internet Retail",         condition: "good" },
  // ── Mixed condition ───────────────────────────────────────────────────────
  { ticker: "META",  name: "Meta Platforms, Inc.",       sector: "Technology · Social Media",                   condition: "mixed" },
  { ticker: "GOOGL", name: "Alphabet Inc.",              sector: "Technology · Internet Content & Information", condition: "mixed" },
  // ── Bad condition ─────────────────────────────────────────────────────────
  { ticker: "TSLA",  name: "Tesla, Inc.",                sector: "Consumer Cyclical · Auto Manufacturers",      condition: "bad" },
  { ticker: "INTC",  name: "Intel Corporation",          sector: "Technology · Semiconductors",                 condition: "bad" },
  // ── Worst condition ───────────────────────────────────────────────────────
  { ticker: "PFE",   name: "Pfizer Inc.",                sector: "Healthcare · Drug Manufacturers",             condition: "worst" },
  { ticker: "WBA",   name: "Walgreens Boots Alliance",  sector: "Healthcare · Pharmacy Retail",                condition: "worst" },
];

interface TickerInputProps {
  /** Optional className override */
  className?: string;
  /** Initial value */
  defaultValue?: string;
  /** Render the example chips below the input */
  showExamples?: boolean;
  /** Compact variant — used in headers */
  compact?: boolean;
}

export function TickerInput({
  className,
  defaultValue = "",
  showExamples = true,
  compact = false,
}: TickerInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const setView = useRouter((s) => s.setView);
  const { llmProvider, apiKey, setLlmProvider, setApiKey } = useAnalysis();
  const [apiKeyError, setApiKeyError] = useState(false);
  const apiKeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedProvider = localStorage.getItem("dossier:llm_provider");
    const savedKey = localStorage.getItem("dossier:api_key");
    if (savedProvider) setLlmProvider(savedProvider);
    if (savedKey) setApiKey(savedKey);
  }, [setLlmProvider, setApiKey]);

  const valueUpper = value.trim().toUpperCase();
  const matches =
    valueUpper.length === 0
      ? POPULAR_TICKERS
      : POPULAR_TICKERS.filter(
          (t) =>
            t.ticker.toUpperCase().includes(valueUpper) ||
            t.name.toUpperCase().includes(valueUpper)
        );

  function submit(ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    if (!apiKey.trim()) {
      setApiKeyError(true);
      apiKeyRef.current?.focus();
      return;
    }
    setOpen(false);
    setValue(t);
    setView("analysis", t);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && matches[highlight]) {
        submit(matches[highlight].ticker);
      } else if (value.trim()) {
        submit(value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        <div
          className={cn(
            "flex items-stretch border border-ink bg-paper transition-shadow",
            "focus-within:ring-2 focus-within:ring-signal/30",
            compact ? "h-10" : "h-14"
          )}
        >
          <div className="flex items-center pl-3 sm:pl-4 text-ink-mute">
            <Search className={compact ? "w-4 h-4" : "w-5 h-5"} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
              setHighlight(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            placeholder={
              compact ? "Ticker…" : "Enter a ticker — NVDA, AAPL, WBA…"
            }
            aria-label="Stock ticker"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={
              open && matches[highlight] ? `${listId}-${highlight}` : undefined
            }
            className={cn(
              "flex-1 bg-transparent px-3 outline-none font-mono uppercase tracking-wide",
              compact ? "text-sm" : "text-base sm:text-lg"
            )}
            autoComplete="off"
            spellCheck={false}
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue("");
                inputRef.current?.focus();
              }}
              className="px-2 text-ink-mute hover:text-ink transition-colors"
              aria-label="Clear input"
            >
              <X className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
            </button>
          )}
          <button
            type="button"
            onClick={() => value.trim() && submit(value)}
            disabled={!value.trim() || !apiKey.trim()}
            className={cn(
              "flex items-center gap-1.5 px-4 sm:px-5 bg-ink text-paper font-mono text-[11px] uppercase tracking-[0.12em]",
              "hover:bg-signal-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            Analyze
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Autocomplete dropdown */}
        {open && matches.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 left-0 right-0 top-full mt-1 bg-paper border border-wire shadow-sm max-h-96 overflow-y-auto scroll-dossier"
          >
            {/* header row when showing all */}
            {valueUpper.length === 0 && (
              <li className="px-4 py-2 border-b border-wire bg-paper-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  10 test companies — best → worst
                </span>
              </li>
            )}
            {matches.map((m, i) => (
              <li
                key={m.ticker}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  submit(m.ticker);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-wire/40 last:border-0",
                  i === highlight ? "bg-paper-2" : "bg-paper"
                )}
              >
                {/* Condition dot */}
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    m.condition === "best"  && "bg-emerald-500",
                    m.condition === "good"  && "bg-green-400",
                    m.condition === "mixed" && "bg-amber-400",
                    m.condition === "bad"   && "bg-orange-500",
                    m.condition === "worst" && "bg-red-500",
                    !m.condition && "bg-ink-mute"
                  )}
                  title={m.condition ?? ""}
                />
                <span className="font-mono text-sm text-ink w-14 shrink-0">
                  {m.ticker}
                </span>
                <span className="text-[13px] text-ink-soft truncate flex-1">
                  {m.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute shrink-0 hidden sm:block">
                  {m.sector.split(" · ")[1] ?? m.sector.split(" · ")[0]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!compact && (
        <div className="mt-3.5 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
              LLM Provider
            </label>
            <select
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              className="h-10 px-3 border border-wire bg-paper font-mono text-[12px] text-ink outline-none focus:border-ink transition-colors cursor-pointer"
            >
              <option value="groq">Groq (Llama-3.3-70b)</option>
              <option value="openai">OpenAI (GPT-4o-mini)</option>
              <option value="gemini">Gemini (Gemini-1.5-flash)</option>
            </select>
          </div>
          <div className="flex-[2] flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
              API Key
            </label>
            <input
              ref={apiKeyRef}
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                if (e.target.value.trim()) {
                  setApiKeyError(false);
                }
              }}
              placeholder={`Enter your ${
                llmProvider === "groq"
                  ? "Groq"
                  : llmProvider === "openai"
                  ? "OpenAI"
                  : "Gemini"
              } API Key...`}
              className={cn(
                "h-10 px-3 border bg-paper font-mono text-[12px] text-ink outline-none transition-colors",
                apiKeyError
                  ? "border-caution focus:border-caution-deep focus:ring-1 focus:ring-caution/30"
                  : "border-wire focus:border-ink"
              )}
            />
          </div>
        </div>
      )}

      {showExamples && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="eyebrow">Try</span>
          {["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL"].map((t) => (
            <button
              key={t}
              onClick={() => submit(t)}
              className="font-mono text-[12px] px-2.5 py-1 border border-wire hover:border-ink hover:bg-paper-2 transition-colors text-ink"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
