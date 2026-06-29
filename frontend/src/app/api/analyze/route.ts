/**
 * /api/analyze — Next.js edge-compatible proxy for the FastAPI SSE stream.
 *
 * Why proxy? Sending the request through the same origin avoids browser
 * quirks around cross-origin EventSource and ensures the ReadableStream
 * isn't silently buffered by an intermediate layer.
 */

import { NextRequest } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();

  const backendRes = await fetch(`${BACKEND_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body,
    // @ts-expect-error — node-fetch / undici duplex
    duplex: "half",
  });

  if (!backendRes.ok || !backendRes.body) {
    return new Response(await backendRes.text(), {
      status: backendRes.status,
    });
  }

  // Stream the SSE body straight through to the browser
  return new Response(backendRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering if present
    },
  });
}
