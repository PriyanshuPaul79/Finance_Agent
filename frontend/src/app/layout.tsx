import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const bodySans = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const dataMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const displaySerif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verdikt — AI Due Diligence on Public Stocks",
  description:
    "A multi-agent AI system that runs full due-diligence reports on public stocks. Watch a team of specialist agents — fundamentals, sentiment, industry — compile a single verdict in real time.",
  keywords: [
    "AI due diligence",
    "multi-agent",
    "LangGraph",
    "stock analysis",
    "financial research",
  ],
  authors: [{ name: "Verdikt" }],
  icons: {
    icon: "/Verdikt_logo.svg",
  },
  openGraph: {
    title: "Verdikt — AI Due Diligence on Public Stocks",
    description:
      "Watch a team of AI analysts compile a full due-diligence report on any public stock, in real time.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${bodySans.variable} ${dataMono.variable} ${displaySerif.variable} antialiased bg-paper text-ink font-sans`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
