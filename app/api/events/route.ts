import { formatSSEMessage, getEventsSince, subscribe } from "@/lib/events";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let ping: NodeJS.Timeout | undefined;
  let closed = false;

  // خواندن شناسه آخرین رویداد از هدر استاندارد یا پارامتر کوئری
  const url = new URL(req.url);
  const lastEventIdHeader = req.headers.get("last-event-id") || url.searchParams.get("lastEventId");
  const parsedLastId = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) : null;
  const lastEventId = parsedLastId !== null && !Number.isNaN(parsedLastId) ? parsedLastId : null;

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

      // ۱. ارسال رویداد آماده‌سازی اولیه
      send(`data: ${JSON.stringify({ type: "ready" })}\n\n`);

      // ۲. در صورت اتصال مجدد با Last-Event-ID، بررسی و ارسال رویدادهای از دست رفته
      if (lastEventId !== null && lastEventId > 0) {
        const { events, canCatchUp } = getEventsSince(lastEventId);
        if (canCatchUp) {
          for (const ev of events) {
            send(formatSSEMessage(ev));
          }
        } else {
          // در صورت فاصله زیاد، به کلاینت اطلاع می‌دهیم یکبار کل وضعیت را بازخوانی کند
          send(`data: ${JSON.stringify({ type: "resync" })}\n\n`);
        }
      }

      // ۳. ثبت لیسنر برای رویدادهای جدید زنده
      unsubscribe = subscribe((payload) => {
        send(payload);
      });

      // ۴. ارسال پینگ دوره‌ای هر ۱۵ ثانیه جهت پایدار نگه داشتن کانال در برابر فایروال و NAT
      ping = setInterval(() => {
        send(": ping\n\n");
      }, 15000);
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
