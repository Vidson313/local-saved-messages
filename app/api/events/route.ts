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

      // ۲. ثبت لیسنر پیش از بازپخش برای جلوگیری از Race Condition
      // رویدادهایی که در طول بازپخش منتشر شوند در صف موقت قرار می‌گیرند
      const pendingQueue: { payload: string; eventId: number }[] = [];
      let isCatchingUp = true;

      unsubscribe = subscribe((payload, eventId) => {
        if (isCatchingUp) {
          pendingQueue.push({ payload, eventId });
        } else {
          send(payload);
        }
      });

      // ۳. در صورت ارسال Last-Event-ID، بازپخش رویدادهای از دست رفته
      let highestDeliveredId = lastEventId ?? 0;
      if (lastEventId !== null && lastEventId > 0) {
        const { events, canCatchUp } = getEventsSince(lastEventId);
        if (canCatchUp) {
          for (const ev of events) {
            send(formatSSEMessage(ev));
            if (ev.id > highestDeliveredId) {
              highestDeliveredId = ev.id;
            }
          }
        } else {
          // در صورت انقضای بافر، اطلاع به کلاینت جهت بازخوانی کامل
          send(`data: ${JSON.stringify({ type: "resync" })}\n\n`);
        }
      }

      // ۴. تخلیه رویدادهای صف که شناسه‌شان جدیدتر از آخرین رویداد بازپخش‌شده است
      for (const item of pendingQueue) {
        if (item.eventId > highestDeliveredId) {
          send(item.payload);
          highestDeliveredId = item.eventId;
        }
      }
      isCatchingUp = false;

      // ۵. ارسال پینگ دوره‌ای هر ۱۵ ثانیه جهت باز نگه‌داشتن کانال
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
