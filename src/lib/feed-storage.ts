import {
  emptyTaste,
  MAX_EXCLUDE,
  parseTaste,
  type FeedTaste,
} from "@/lib/feed";

export const TASTE_STORAGE_KEY = "phlox.feed.taste.v1";
export const SEEN_STORAGE_KEY = "phlox.feed.seen.v1";

const listeners = new Set<() => void>();

// Snapshot cache keyed by the raw stored string so useSyncExternalStore gets
// a stable reference while nothing changed, and a fresh parse the moment the
// stored value differs (another tab, a reset, a test clearing storage).
let cachedRaw: string | null | undefined;
let cachedTaste: FeedTaste = emptyTaste;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(TASTE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getTasteSnapshot(): FeedTaste {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedTaste = parseTaste(raw);
  }
  return cachedTaste;
}

export function getServerTasteSnapshot(): FeedTaste {
  return emptyTaste;
}

export function subscribeTaste(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function writeTaste(taste: FeedTaste): void {
  const raw = JSON.stringify(taste);
  try {
    window.localStorage.setItem(TASTE_STORAGE_KEY, raw);
  } catch {
    // Taste still works for this page session without storage.
  }
  cachedRaw = readRaw() ?? raw;
  cachedTaste = taste;
  notify();
}

export function clearTaste(): void {
  try {
    window.localStorage.removeItem(TASTE_STORAGE_KEY);
    window.localStorage.removeItem(SEEN_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
  cachedRaw = null;
  cachedTaste = emptyTaste;
  notify();
}

export function readSeen(): string[] {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(SEEN_STORAGE_KEY) || "[]",
    );
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(-MAX_EXCLUDE)
      : [];
  } catch {
    return [];
  }
}

export function writeSeen(seen: string[]): void {
  try {
    window.localStorage.setItem(
      SEEN_STORAGE_KEY,
      JSON.stringify(seen.slice(-MAX_EXCLUDE)),
    );
  } catch {
    // Seen history is a nicety; the feed dedupes within a session regardless.
  }
}
