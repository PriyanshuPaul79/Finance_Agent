"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LandingView } from "@/views/landing-view";
import { AnalysisView } from "@/views/analysis-view";
import { DashboardView } from "@/views/dashboard-view";
import { ArchitectureView } from "@/views/architecture-view";
import { useRouter } from "@/lib/store";

// ============================================================================
// Page — the single `/` route.
//
// Renders the active view based on the hash-based router. The router syncs
// to `window.location.hash`, so users can deep-link to /#/analysis/AAPL etc.
// and use browser back/forward.
//
// Layout: sticky header at top, view content in a flex-1 main, sticky footer
// at the bottom. The footer sticks when content is short and is pushed down
// naturally when content is long.
// ============================================================================

export default function Page() {
  const { view, ticker, syncFromHash } = useRouter();
  // Track whether we've hydrated on the client yet.
  // On the server (and the first client render) we always show the landing
  // view so SSR HTML matches — hash routing only kicks in after mount.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    syncFromHash();

    // Keep in sync with browser back/forward
    const onHashChange = () => syncFromHash();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [syncFromHash]);

  // Scroll to top on view change — feels like a page navigation
  useEffect(() => {
    if (mounted) window.scrollTo({ top: 0, behavior: "auto" });
  }, [view, ticker, mounted]);

  // Before hydration always render landing (matches SSR output → no mismatch)
  const activeView = mounted ? view : "landing";
  const activeTicker = mounted ? ticker : null;

  return (
    <div className="min-h-screen flex flex-col bg-paper" suppressHydrationWarning>
      <SiteHeader />
      <main className="flex-1 w-full">
        {activeView === "landing" && <LandingView />}
        {activeView === "analysis" && activeTicker && <AnalysisView ticker={activeTicker} />}
        {activeView === "analysis" && !activeTicker && <LandingView />}
        {activeView === "dashboard" && <DashboardView />}
        {activeView === "architecture" && <ArchitectureView />}
      </main>
      <SiteFooter />
    </div>
  );
}
