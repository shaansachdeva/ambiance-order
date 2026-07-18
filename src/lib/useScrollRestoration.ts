"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Preserve `window.scrollY` per URL across in-app navigations so users land on
 * the same row they clicked instead of being snapped to the top of the list.
 *
 * Why we don't trust sessionStorage alone: Next.js App Router runs its own
 * scroll-to-top step after a navigation, and depending on timing the captured
 * scroll value can be 0 by the time cleanup fires. We keep a module-level Map
 * as the primary store (lives as long as the tab does, immune to weird
 * unmount/mount ordering) and mirror to sessionStorage for tab refreshes.
 *
 * Why we don't rely on the saved value being final: the user can click a row
 * mid-scroll, so we also save on pointerdown/keydown — that captures the exact
 * scroll position at the moment of the click, not the last throttled value.
 *
 * Usage:
 *   useScrollRestoration(!loading);  // pass true once the page's data has rendered
 */

const memCache = new Map<string, number>();

function saveScroll(key: string) {
  if (typeof window === "undefined") return;
  const y = window.scrollY;
  if (!Number.isFinite(y)) return;
  memCache.set(key, y);
  try { sessionStorage.setItem(`scroll:${key}`, String(y)); } catch { /* ignore */ }
}

function readScroll(key: string): number {
  if (memCache.has(key)) return memCache.get(key) || 0;
  try {
    const raw = sessionStorage.getItem(`scroll:${key}`);
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) return n;
    }
  } catch { /* ignore */ }
  return 0;
}

// Take over scroll restoration from the browser/Next.js. Setting this to
// "manual" once means Next's automatic scroll-to-top after navigation doesn't
// fight our restore. (Plain anchor links still scroll via #hash.)
let installed = false;
function installManualMode() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  try {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  } catch { /* ignore */ }
}

export function useScrollRestoration(ready: boolean = true) {
  const pathname = usePathname();
  const restoredFor = useRef<string | null>(null);

  // Save listeners — set up per-pathname so every save targets the current key.
  useEffect(() => {
    if (typeof window === "undefined") return;
    installManualMode();
    const key = pathname;

    // Throttled save while the user is scrolling — catches the latest position
    // without writing 60×/s.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; saveScroll(key); }, 100);
    };

    // Immediate save on any interaction that might trigger navigation. Without
    // this, throttled saves can lag behind the click and we end up storing the
    // scroll position from 100ms ago — or worse, post-navigation 0.
    const onInteract = () => saveScroll(key);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", onInteract, { capture: true });
    window.addEventListener("keydown", onInteract, { capture: true });
    window.addEventListener("pagehide", onInteract);
    document.addEventListener("visibilitychange", onInteract);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onInteract, { capture: true } as any);
      window.removeEventListener("keydown", onInteract, { capture: true } as any);
      window.removeEventListener("pagehide", onInteract);
      document.removeEventListener("visibilitychange", onInteract);
      if (timer) clearTimeout(timer);
      // Final flush — but only IF the user actually scrolled away from 0,
      // otherwise we'd persist a value of 0 that overwrites the real one on
      // the next mount.
      if (window.scrollY > 0) saveScroll(key);
    };
  }, [pathname]);

  // Restore once the page is ready. Retries while the document is still
  // growing (skeleton → real items → image decode all change scrollHeight).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!ready) return;
    if (restoredFor.current === pathname) return;
    restoredFor.current = pathname;

    const target = readScroll(pathname);
    if (target <= 0) return;

    let attempts = 0;
    let lastHeight = 0;
    let stableCount = 0;
    let userInterrupted = false;
    let cancelled = false;

    const onUserScroll = () => { userInterrupted = true; };
    window.addEventListener("wheel", onUserScroll, { passive: true });
    window.addEventListener("touchmove", onUserScroll, { passive: true });

    const cleanup = () => {
      cancelled = true;
      window.removeEventListener("wheel", onUserScroll);
      window.removeEventListener("touchmove", onUserScroll);
    };

    const tryScroll = () => {
      if (cancelled || userInterrupted) return cleanup();
      attempts++;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const wantedY = Math.min(target, Math.max(0, maxY));
      window.scrollTo(0, wantedY);

      const reached = Math.abs(window.scrollY - target) < 50 || maxY >= target;

      const h = document.documentElement.scrollHeight;
      if (h === lastHeight) stableCount++; else { stableCount = 0; lastHeight = h; }

      if (reached) return cleanup();
      if (attempts > 60 || stableCount > 6) return cleanup();   // ~2s cap

      setTimeout(tryScroll, 33);
    };

    // Two animation frames before the first attempt so React has committed.
    requestAnimationFrame(() => requestAnimationFrame(tryScroll));

    return cleanup;
  }, [pathname, ready]);
}
