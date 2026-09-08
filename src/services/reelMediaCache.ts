/**
 * High-Performance Client-Side Media Cache for Anime Reels
 * 
 * Features:
 * 1. Cache Storage API integration for persistent cross-session reel caching
 * 2. In-memory Blob & Object URL LRU cache for 0ms instant playback
 * 3. Priority-based background prefetching
 * 4. Automatic memory reclamation & Object URL revoking
 */

import { apiUrl } from './apiClient';

const CACHE_NAME = 'anime-reels-media-v1';
const MAX_MEMORY_OBJECT_URLS = 25; // Keep up to 25 reels in instant RAM (~75-100MB)
const MAX_PERSISTENT_ENTRIES = 50; // Cache Storage limit

interface CacheEntry {
  objectUrl: string;
  blob: Blob;
  size: number;
  lastAccessed: number;
}

class ReelMediaCache {
  private memoryCache = new Map<string, CacheEntry>();
  private inFlightFetches = new Map<string, Promise<string | null>>();
  private isCacheStorageSupported = typeof window !== 'undefined' && 'caches' in window;

  /**
   * Get direct playable URL for a reel.
   * Returns in-memory Object URL if available, or Cache Storage URL, or falls back to stream endpoint.
   */
  async getReelVideoUrl(reelId: string): Promise<string> {
    if (!reelId) return '';

    // 1. Check in-memory Object URL cache (fastest: 0ms RAM lookup)
    const mem = this.memoryCache.get(reelId);
    if (mem) {
      mem.lastAccessed = Date.now();
      return mem.objectUrl;
    }

    // 2. Check Browser Cache Storage API
    if (this.isCacheStorageSupported) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cacheKey = `/api/reels/stream/${reelId}`;
        const match = await cache.match(cacheKey);
        if (match && match.ok) {
          const blob = await match.blob();
          if (blob.size > 1000) {
            const objectUrl = URL.createObjectURL(blob);
            this.setMemoryCache(reelId, objectUrl, blob);
            return objectUrl;
          }
        }
      } catch (err) {
        console.warn('[ReelCache] Cache Storage lookup failed:', err);
      }
    }

    // 3. Fallback to direct streaming endpoint
    return apiUrl(`/api/reels/stream/${reelId}`);
  }

  /**
   * Preload a reel into local cache in the background
   */
  async preloadReel(reelId: string, priority: 'high' | 'low' = 'low'): Promise<string | null> {
    if (!reelId) return null;

    // Check if already in memory
    const mem = this.memoryCache.get(reelId);
    if (mem) {
      mem.lastAccessed = Date.now();
      return mem.objectUrl;
    }

    // Check in-flight fetches
    if (this.inFlightFetches.has(reelId)) {
      return this.inFlightFetches.get(reelId)!;
    }

    const fetchPromise = (async () => {
      try {
        const streamUrl = apiUrl(`/api/reels/stream/${reelId}`);

        // Check persistent Cache Storage first
        if (this.isCacheStorageSupported) {
          try {
            const cache = await caches.open(CACHE_NAME);
            const match = await cache.match(streamUrl);
            if (match && match.ok) {
              const blob = await match.blob();
              if (blob.size > 1000) {
                const objectUrl = URL.createObjectURL(blob);
                this.setMemoryCache(reelId, objectUrl, blob);
                return objectUrl;
              }
            }
          } catch {
            // continue to fetch
          }
        }

        // Fetch over network
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(streamUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
          },
          // @ts-ignore
          priority: priority === 'high' ? 'high' : 'low'
        });
        clearTimeout(timeoutId);

        if (!response.ok && response.status !== 206) {
          return null;
        }

        // Clone response to put into Cache Storage
        if (this.isCacheStorageSupported) {
          try {
            const cache = await caches.open(CACHE_NAME);
            cache.put(streamUrl, response.clone()).catch(() => {});
            this.pruneCacheStorage(cache).catch(() => {});
          } catch {
            // silent
          }
        }

        const blob = await response.blob();
        if (blob.size < 1000) return null;

        const objectUrl = URL.createObjectURL(blob);
        this.setMemoryCache(reelId, objectUrl, blob);
        return objectUrl;
      } catch {
        // Silent recovery: direct stream route handles it on demand with fallback endpoints
        return null;
      } finally {
        this.inFlightFetches.delete(reelId);
      }
    })();

    this.inFlightFetches.set(reelId, fetchPromise);
    return fetchPromise;
  }

  /**
   * Preload a list of reels with high priority for the next 2 reels
   */
  async preloadBatch(reelIds: string[]): Promise<void> {
    if (!reelIds || reelIds.length === 0) return;
    
    // The active and next 2 reels get high priority in parallel
    const highPriorityBatch = reelIds.slice(0, 3);
    const lowPriorityBatch = reelIds.slice(3);

    // Launch high priority downloads simultaneously for instant next-reel readiness
    await Promise.allSettled(
      highPriorityBatch.map(id => (id ? this.preloadReel(id, 'high') : Promise.resolve(null)))
    );

    // Launch low priority downloads sequentially in background
    for (const id of lowPriorityBatch) {
      if (id) {
        this.preloadReel(id, 'low').catch(() => {});
      }
    }
  }

  /**
   * Check if a reel is already cached in memory
   */
  isMemoryCached(reelId: string): boolean {
    return this.memoryCache.has(reelId);
  }

  /**
   * Get cached object URL synchronously if available
   */
  getSynchronousObjectUrl(reelId: string): string | null {
    const mem = this.memoryCache.get(reelId);
    if (mem) {
      mem.lastAccessed = Date.now();
      return mem.objectUrl;
    }
    return null;
  }

  private setMemoryCache(reelId: string, objectUrl: string, blob: Blob) {
    // Evict oldest if memory cache is full
    if (this.memoryCache.size >= MAX_MEMORY_OBJECT_URLS) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [k, v] of this.memoryCache.entries()) {
        if (v.lastAccessed < oldestTime) {
          oldestTime = v.lastAccessed;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        const oldEntry = this.memoryCache.get(oldestKey);
        if (oldEntry) {
          URL.revokeObjectURL(oldEntry.objectUrl);
          this.memoryCache.delete(oldestKey);
        }
      }
    }

    this.memoryCache.set(reelId, {
      objectUrl,
      blob,
      size: blob.size,
      lastAccessed: Date.now()
    });
  }

  private async pruneCacheStorage(cache: Cache) {
    try {
      const requests = await cache.keys();
      if (requests.length > MAX_PERSISTENT_ENTRIES) {
        // Delete oldest entries
        const toDelete = requests.slice(0, requests.length - MAX_PERSISTENT_ENTRIES);
        for (const req of toDelete) {
          await cache.delete(req);
        }
      }
    } catch {
      // silent
    }
  }

  /**
   * Clear all active memory object URLs when unmounting or leaving view
   */
  cleanup() {
    for (const entry of this.memoryCache.values()) {
      try {
        URL.revokeObjectURL(entry.objectUrl);
      } catch {
        // silent
      }
    }
    this.memoryCache.clear();
    this.inFlightFetches.clear();
  }
}

export const reelMediaCache = new ReelMediaCache();
