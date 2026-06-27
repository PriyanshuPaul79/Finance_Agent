"use client";

import { useEffect } from "react";
import { useRouter, type ViewKind } from "@/lib/store";
import { cn } from "@/lib/utils";

// ============================================================================
// SiteHeader — sticky top nav.
//
// Logo (serif) + nav (Dashboard, Architecture) on the right. Mobile collapses
// to logo + a horizontal-scrollable nav strip.
// ============================================================================

const NAV_ITEMS: { label: string; view: ViewKind }[] = [
  { label: "Dashboard", view: "dashboard" },
  { label: "Architecture", view: "architecture" },
];

export function SiteHeader() {
  const { view, setView, syncFromHash } = useRouter();

  // Sync to URL hash changes (back/forward buttons)
  useEffect(() => {
    const onHash = () => syncFromHash();
    window.addEventListener("hashchange", onHash);
    // Also sync on mount in case of deep link
    syncFromHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, [syncFromHash]);

  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur-[6px] border-b border-wire">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <button
            onClick={() => setView("landing")}
            className="flex items-baseline gap-2 group"
            aria-label="Dossier home"
          >
            <span className="font-serif text-xl sm:text-2xl font-semibold text-ink tracking-tight">
              Verdikt
            </span>
            <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              AI Due Diligence
            </span>
          </button>

          {/* Nav */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={cn(
                  "px-2.5 sm:px-3 py-1.5 text-[13px] font-medium transition-colors",
                  "border-b-2 -mb-px",
                  view === item.view
                    ? "text-ink border-signal"
                    : "text-ink-soft border-transparent hover:text-ink hover:border-wire"
                )}
                aria-current={view === item.view ? "page" : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
