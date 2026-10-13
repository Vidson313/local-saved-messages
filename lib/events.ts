export type SSEEvent = {
  id: number;
  data: Record<string, unknown>;
  timestamp: number;
};

export type Listener = (payload: string, eventId: number) => void;

interface SSEEventHub {
  listeners: Set<Listener>;
  buffer: SSEEvent[];
  lastId: number;
}

const BUFFER_CAPACITY = 100;

/**
 * دریافت یا ایجاد هاب رویدادها روی globalThis جهت پایداری در برابر HMR و ارزیابی چندباره ماژول‌ها
 */
function getHub(): SSEEventHub {
  const globalRef = globalThis as unknown as { __sseEventHub?: SSEEventHub };
  if (!globalRef.__sseEventHub) {
    globalRef.__sseEventHub = {
      listeners: new Set<Listener>(),
      buffer: [],
      lastId: 0
    };
  }
  return globalRef.__sseEventHub;
}

/**
 * ثبت شنونده جدید برای رویدادهای زنده
 */
export function subscribe(listener: Listener): () => void {
  const hub = getHub();
  hub.listeners.add(listener);
  return () => {
    hub.listeners.delete(listener);
  };
}

/**
 * انتشار رویداد برای تمامی کلاینت‌های متصل و ثبت در بافر چرخشی
 */
export function broadcast(event: Record<string, unknown>): number {
  const hub = getHub();
  hub.lastId += 1;
  const eventId = hub.lastId;

  const item: SSEEvent = {
    id: eventId,
    data: event,
    timestamp: Date.now()
  };

  hub.buffer.push(item);
  if (hub.buffer.length > BUFFER_CAPACITY) {
    hub.buffer.shift();
  }

  const payload = `id: ${eventId}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const listener of hub.listeners) {
    try {
      listener(payload, eventId);
    } catch (err) {
      console.error("[SSE Hub Listener Error]", err);
    }
  }

  return eventId;
}

/**
 * استخراج رویدادهای ثبت‌شده پس از یک شناسه خاص جهت همگام‌سازی پس از قطعی موقت
 */
export function getEventsSince(lastEventId: number): {
  events: SSEEvent[];
  canCatchUp: boolean;
} {
  const hub = getHub();
  if (hub.buffer.length === 0) {
    return { events: [], canCatchUp: true };
  }

  const oldestBufferedId = hub.buffer[0].id;
  // اگر آیدی کلاینت از قدیمی‌ترین رویداد بافر قدیمی‌تر باشد، نیاز به همگام‌سازی کامل (resync) است
  if (lastEventId < oldestBufferedId - 1) {
    return { events: [], canCatchUp: false };
  }

  const missed = hub.buffer.filter((e) => e.id > lastEventId);
  return { events: missed, canCatchUp: true };
}

/**
 * تبدیل رویداد به قالب استاندارد پروتکل SSE
 */
export function formatSSEMessage(event: SSEEvent): string {
  return `id: ${event.id}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
