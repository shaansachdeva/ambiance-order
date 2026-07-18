"use client";

import { useEffect } from "react";

/**
 * Globally prevents the mouse wheel from changing values inside focused
 * `<input type="number">` fields. The browser default lets a scrolled wheel
 * silently increment / decrement a focused number input, which is a constant
 * source of "I scrolled the page and now my qty changed to 47" bugs.
 *
 * Mounted once at the app root via the dashboard layout.
 */
export function NumberWheelGuard() {
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        t.tagName === "INPUT" &&
        (t as HTMLInputElement).type === "number" &&
        document.activeElement === t
      ) {
        e.preventDefault();
        (t as HTMLInputElement).blur();
        // Re-focus on the next tick so the user keeps typing in the same field.
        requestAnimationFrame(() => (t as HTMLInputElement).focus());
      }
    };
    document.addEventListener("wheel", handler, { passive: false });
    return () => document.removeEventListener("wheel", handler);
  }, []);
  return null;
}
