/**
 * UI Preview Cache
 *
 * Persists generated UI pages in localStorage keyed by workflow versionId.
 * Cache hit → skip API call and show previously generated UI instantly.
 * Cache miss → generate, then store for future visits.
 *
 * Eviction: LRU, keeps the most recent MAX_ENTRIES versions.
 */

import type { GeneratedUIPage } from "@/types/ai/uiGeneration";

const CACHE_KEY = "dg:ui-preview-cache";
const MAX_ENTRIES = 10;

interface UIPreviewCacheEntry {
  versionId: string;
  pages: GeneratedUIPage[];
  cachedAt: number;
}

interface UIPreviewCacheData {
  entries: UIPreviewCacheEntry[];
}

class UIPreviewCacheStorage {
  private isAvailable(): boolean {
    try {
      const test = "__uipc_test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private load(): UIPreviewCacheData {
    if (!this.isAvailable()) return { entries: [] };
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return { entries: [] };
      return JSON.parse(raw) as UIPreviewCacheData;
    } catch {
      return { entries: [] };
    }
  }

  private save(data: UIPreviewCacheData): void {
    if (!this.isAvailable()) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      // Quota exceeded — drop the oldest half and retry once
      if (err instanceof Error && err.name === "QuotaExceededError") {
        const trimmed: UIPreviewCacheData = {
          entries: data.entries.slice(0, Math.ceil(MAX_ENTRIES / 2)),
        };
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
        } catch {
          // Give up silently — cache is best-effort
        }
      }
    }
  }

  /** Returns cached pages for a versionId, or null on miss. */
  get(versionId: string): GeneratedUIPage[] | null {
    const data = this.load();
    const entry = data.entries.find((e) => e.versionId === versionId);
    return entry?.pages ?? null;
  }

  /** Stores pages for a versionId, evicting oldest entries beyond MAX_ENTRIES. */
  set(versionId: string, pages: GeneratedUIPage[]): void {
    const data = this.load();

    // Remove any existing entry for this versionId (upsert)
    const filtered = data.entries.filter((e) => e.versionId !== versionId);

    // Prepend newest, then cap to MAX_ENTRIES
    const entries: UIPreviewCacheEntry[] = [
      { versionId, pages, cachedAt: Date.now() },
      ...filtered,
    ].slice(0, MAX_ENTRIES);

    this.save({ entries });
  }

  /** Remove a specific version from cache (e.g. when workflow version is deleted). */
  delete(versionId: string): void {
    const data = this.load();
    this.save({
      entries: data.entries.filter((e) => e.versionId !== versionId),
    });
  }

  /** Wipe the entire cache. */
  clear(): void {
    if (!this.isAvailable()) return;
    localStorage.removeItem(CACHE_KEY);
  }
}

export const uiPreviewCache = new UIPreviewCacheStorage();
