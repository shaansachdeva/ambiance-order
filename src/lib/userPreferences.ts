"use client";

// Per-user preferences synced to the server so the same login on multiple
// devices sees the same UI state.
//
// Reads cache once per page load and writes are debounced; localStorage is used
// purely as a startup hint (so the UI doesn't flash) and is kept in sync.

const LS_KEY = "user_prefs_cache_v1";

type Prefs = Record<string, any>;

let cache: Prefs | null = null;
let inflight: Promise<Prefs> | null = null;
const writeQueue: Prefs = {};
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function readLocalCache(): Prefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalCache(prefs: Prefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {}
}

export function getCachedPreference<T = any>(key: string, fallback: T): T {
  if (cache && key in cache) return cache[key] as T;
  const local = readLocalCache();
  return (key in local ? local[key] : fallback) as T;
}

export async function fetchPreferences(): Promise<Prefs> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/user/preferences", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((data: Prefs) => {
      cache = data || {};
      writeLocalCache(cache);
      return cache;
    })
    .catch(() => {
      cache = readLocalCache();
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function flushWrites() {
  const payload = { ...writeQueue };
  for (const k of Object.keys(writeQueue)) delete writeQueue[k];
  writeTimer = null;
  if (Object.keys(payload).length === 0) return;
  fetch("/api/user/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // best-effort; localStorage already has the latest values
  });
}

export function setPreference(key: string, value: any) {
  cache = { ...(cache || readLocalCache()), [key]: value };
  writeLocalCache(cache);
  writeQueue[key] = value;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flushWrites, 350);
}

export function clearPreferencesCache() {
  cache = null;
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(LS_KEY); } catch {}
  }
}
