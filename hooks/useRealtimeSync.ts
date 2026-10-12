"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export type RealtimeSyncOptions = {
  onEvent: (event: Record<string, unknown>) => void;
  onResync: () => Promise<void> | void;
  enabled?: boolean;
};

/**
 * هوک اختصاصی مدیریت همگام‌سازی بلادرنگ SSE با حذف Polling مداوم،
 * مدیریت هوشمند اتصالات، بازپخش رویدادها، و پولینگ مشروط فقط در زمان قطعی.
 */
export function useRealtimeSync({ onEvent, onResync, enabled = true }: RealtimeSyncOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const onEventRef = useRef(onEvent);
  const onResyncRef = useRef(onResync);
  const esRef = useRef<EventSource | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstConnectRef = useRef(true);

  // به‌روزرسانی مراجع توابع جهت جلوگیری از بازسازی مکرر افکت
  useEffect(() => {
    onEventRef.current = onEvent;
    onResyncRef.current = onResync;
  }, [onEvent, onResync]);

  const clearFallbackPolling = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  }, []);

  const startFallbackPolling = useCallback(() => {
    if (fallbackIntervalRef.current || typeof window === "undefined") return;
    // در زمان قطعی SSE، یک پولینگ آرام هر ۱۵ ثانیه فعال می‌شود
    fallbackIntervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        onResyncRef.current();
      }
    }, 15000);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setStatus("connecting");
    const es = new EventSource("/api/events");
    esRef.current = es;

    es.onopen = () => {
      setStatus("connected");
      clearFallbackPolling();

      // در اتصال مجدد (نه بار اول)، یکبار وضعیت را سینک می‌کنیم تا پیام‌های زمان قطعی لود شوند
      if (!isFirstConnectRef.current) {
        onResyncRef.current();
      }
      isFirstConnectRef.current = false;
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ready") return;

        if (data.type === "resync") {
          onResyncRef.current();
          return;
        }

        onEventRef.current(data);
      } catch (err) {
        console.error("[SSE Parse Error]", err);
      }
    };

    es.onerror = () => {
      setStatus("connecting");
      // فعال‌سازی پولینگ مشروط فقط در زمان بروز اختلال در اتصال
      startFallbackPolling();
    };
  }, [enabled, clearFallbackPolling, startFallbackPolling]);

  useEffect(() => {
    if (!enabled) return;

    connect();

    // مدیریت وضعیت فعال شدن مجدد تب (مانند باز شدن قفل گوشی یا سوئیچ تب‌ها)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // بازخوانی سبک وضعیت چت‌ها و پیام‌ها در زمان بازگشت به برنامه
        onResyncRef.current();
        if (esRef.current?.readyState === EventSource.CLOSED) {
          connect();
        }
      } else {
        // در پس‌زمینه پولینگ غیرفعال می‌شود تا باتری هدر نرود
        clearFallbackPolling();
      }
    };

    // مدیریت رویدادهای آنلاین/آفلاین شبکه
    const handleOnline = () => {
      connect();
      onResyncRef.current();
    };

    const handleOffline = () => {
      setStatus("disconnected");
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      clearFallbackPolling();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearFallbackPolling();
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [enabled, connect, clearFallbackPolling]);

  return {
    status,
    reconnect: connect
  };
}
