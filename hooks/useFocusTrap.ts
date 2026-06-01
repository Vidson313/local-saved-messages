import { useEffect, useRef, type RefObject } from "react";

export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    previousFocusRef.current = document.activeElement as HTMLElement;

    const el = containerRef.current;
    if (!el) return;

    function getFocusable() {
      if (!el) return [];
      return Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])'
        )
      );
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    el.addEventListener("keydown", handleKeyDown);
    const focusable = getFocusable();
    if (focusable.length > 0) focusable[0].focus();

    return () => {
      el.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [active, containerRef]);
}
