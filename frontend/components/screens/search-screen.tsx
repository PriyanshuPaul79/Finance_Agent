"use client"

// Search screen: the app's entry point. Provides a ticker/company search box with a filterable
// autocomplete dropdown (keyboard navigable, backed by searchTickers), trending-stock quick chips,
// and an "LLM Provider & API Key" card that persists the chosen provider and key to localStorage.
// Submitting validates the key and calls onSelect(ticker, provider, apiKey) to kick off analysis.
import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Search, TrendingUp, TrendingDown, CornerDownLeft, Key, ShieldCheck, Eye, EyeOff } from "lucide-react"
import { TRENDING, searchTickers } from "@/lib/verdikt-data"

interface SearchScreenProps {
  onSelect: (ticker: string, provider: string, apiKey: string) => void
}

export function SearchScreen({ onSelect }: SearchScreenProps) {
  const reduce = useReducedMotion()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [provider, setProvider] = useState("groq")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const savedProvider = localStorage.getItem("verdikt_llm_provider") || "groq"
    const savedKey = localStorage.getItem("verdikt_api_key") || ""
    setProvider(savedProvider)
    setApiKey(savedKey)
  }, [])

  function handleProviderChange(val: string) {
    setProvider(val)
    localStorage.setItem("verdikt_llm_provider", val)
  }

  function handleKeyChange(val: string) {
    setApiKey(val)
    localStorage.setItem("verdikt_api_key", val.trim())
    if (val.trim()) setErrorMsg("")
  }

  const results = useMemo(() => searchTickers(query), [query])

  function submit(ticker: string) {
    if (!ticker) return
    const keyToUse = apiKey.trim()
    if (!keyToUse) {
      setErrorMsg("Please enter your API Key below to start multi-agent analysis.")
      return
    }
    setErrorMsg("")
    onSelect(ticker.toUpperCase(), provider, keyToUse)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (!open || results.length === 0) {
      if (e.key === "Enter" && query.trim()) submit(query.trim())
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => (a + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => (a - 1 + results.length) % results.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      submit(results[active]?.ticker ?? query.trim())
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="flex flex-col items-center pt-6 text-center sm:pt-14">
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-signal" />
        Four minds. One verdict.
      </motion.span>

      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="max-w-2xl text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl"
      >
        Watch AI research a stock{" "}
        <span className="text-signal">in real time.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
        className="mt-4 max-w-lg text-pretty leading-relaxed text-muted-foreground"
      >
        Four specialist agents analyze fundamentals, sentiment, technicals and industry position
        in parallel — then reconcile their disagreement into a single call.
      </motion.p>

      {/* search input */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18 }}
        className="relative z-20 mt-9 w-full max-w-xl"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
              setActive(0)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={handleKeyDown}
            placeholder="Search a ticker or company — try NVDA, AAPL…"
            aria-label="Search a stock ticker or company"
            aria-expanded={open && results.length > 0}
            role="combobox"
            aria-controls="ticker-listbox"
            autoComplete="off"
            className="tabular h-14 w-full rounded-xl border border-border bg-card pl-12 pr-28 text-base text-foreground placeholder:text-slate focus:border-signal focus:outline-none"
          />
          <button
            onClick={() => submit(results[active]?.ticker ?? query.trim())}
            disabled={!query.trim()}
            className="absolute right-2 top-1/2 flex h-10 -translate-y-1/2 items-center gap-1.5 rounded-lg bg-signal px-4 text-sm font-semibold text-signal-foreground transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analyze
            <CornerDownLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <AnimatePresence>
          {open && results.length > 0 && (
            <motion.ul
              id="ticker-listbox"
              role="listbox"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: reduce ? 0 : 0.18 }}
              className="absolute left-0 right-0 top-16 z-30 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-black/40"
            >
              {results.map((r, i) => (
                <li key={r.ticker} role="option" aria-selected={i === active}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => submit(r.ticker)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${
                      i === active ? "bg-secondary" : "bg-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="tabular font-display text-sm font-bold text-foreground">
                        {r.ticker}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {r.name}
                      </span>
                    </span>
                    <span
                      className={`tabular text-sm ${
                        r.change >= 0 ? "text-agent-1" : "text-slate"
                      }`}
                    >
                      {r.change >= 0 ? "+" : ""}
                      {r.change.toFixed(2)}%
                    </span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        {errorMsg && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-xs font-medium text-destructive">
            {errorMsg}
          </motion.p>
        )}
      </motion.div>

      {/* API Key Configuration Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.22 }}
        className="mt-6 w-full max-w-xl rounded-xl border border-border/80 bg-card/70 p-4 text-left shadow-lg backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-signal" />
            <span className="font-display text-sm font-semibold text-foreground">LLM Provider & API Key</span>
          </div>
          {apiKey.trim() ? (
            <span className="flex items-center gap-1.5 rounded-full border border-agent-1/40 bg-agent-1/10 px-2.5 py-0.5 text-[11px] font-medium text-agent-1">
              <ShieldCheck className="h-3 w-3" /> Key Saved
            </span>
          ) : (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
              Required
            </span>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-signal focus:outline-none"
            >
              <option value="groq">Groq (Recommended)</option>
              <option value="openai">OpenAI (GPT-4o-mini)</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate">
              {provider.toUpperCase()} API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder={provider === "groq" ? "gsk_..." : provider === "openai" ? "sk-..." : "AIzaSy..."}
                className="h-10 w-full rounded-lg border border-border bg-background pl-3 pr-9 text-xs text-foreground placeholder:text-slate/60 focus:border-signal focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* trending chips */}
      <div className="mt-8 w-full max-w-2xl">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate">Trending now</p>
        <motion.div
          className="flex flex-wrap items-center justify-center gap-2"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: reduce ? 0 : 0.05 } },
          }}
        >
          {TRENDING.map((t) => {
            const up = t.change >= 0
            return (
              <motion.button
                key={t.ticker}
                variants={{
                  hidden: { opacity: 0, y: 10, scale: 0.96 },
                  show: { opacity: 1, y: 0, scale: 1 },
                }}
                whileHover={reduce ? undefined : { y: -2 }}
                onClick={() => submit(t.ticker)}
                className="group flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 transition hover:border-signal/60"
              >
                <span className="tabular font-display text-sm font-bold text-foreground">
                  {t.ticker}
                </span>
                <span
                  className={`flex items-center gap-1 text-xs ${
                    up ? "text-agent-1" : "text-slate"
                  }`}
                >
                  {up ? (
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {up ? "+" : ""}
                  {t.change.toFixed(2)}%
                </span>
              </motion.button>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}
