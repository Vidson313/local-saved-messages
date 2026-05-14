import { subscribe } from "@/lib/events";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let ping: NodeJS.Timeout | undefined;
  let closed = false;

  function cleanup() {
    closed = true;
    if (ping) clearInterval(ping);
    if (unsubscribe) unsubscribe();
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup();
        }
      };

      send(`data: ${JSON.stringify({ type: "ready" })}\n\n`);
      unsubscribe = subscribe(send);
      ping = setInterval(() => send(": ping\n\n"), 15000);
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
