import { AnimeReel } from '../types';
import { reelMediaCache } from './reelMediaCache';
import bundledReelsRaw from '../data/animeReels.json';
import { generateStratifiedDeck, reelDeckManager, recordReelAsWatched } from './reelRandomizer';
import { apiFetch, apiUrl } from './apiClient';

const SAVED_REELS_STORAGE_KEY = 'anilove_saved_anime_reels';
const WATCHED_REELS_HISTORY_KEY = 'anilove_watched_reels_history';
const REELS_SESSION_STORAGE_KEY = 'anilove_active_reels_session';

export interface ReelsSessionState {
  feedHistory: AnimeReel[];
  historyIndex: number;
  lastWatchedReelId?: string;
  filterMode?: 'all' | 'saved';
}

let inMemoryReelsSession: ReelsSessionState | null = null;

export function getStoredReelsSession(): ReelsSessionState | null {
  if (inMemoryReelsSession && inMemoryReelsSession.feedHistory.length > 0) {
    return inMemoryReelsSession;
  }
  try {
    const raw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(REELS_SESSION_STORAGE_KEY) : null) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem(REELS_SESSION_STORAGE_KEY) : null);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.feedHistory) && parsed.feedHistory.length > 0) {
      const sanitizedHistory = parsed.feedHistory.map(sanitizeReelForStorage).filter((r: AnimeReel) => Boolean(r.id));
      if (sanitizedHistory.length === 0) return null;
      const safeIndex = Math.max(0, Math.min(Number(parsed.historyIndex) || 0, sanitizedHistory.length - 1));
      inMemoryReelsSession = {
        feedHistory: sanitizedHistory,
        historyIndex: safeIndex,
        lastWatchedReelId: sanitizedHistory[safeIndex]?.id || parsed.lastWatchedReelId,
        filterMode: parsed.filterMode === 'saved' ? 'saved' : 'all',
      };
      return inMemoryReelsSession;
    }
  } catch {
    // silent
  }
  return null;
}

export function saveStoredReelsSession(session: ReelsSessionState): void {
  if (!session || !Array.isArray(session.feedHistory) || session.feedHistory.length === 0) return;
  const safeIndex = Math.max(0, Math.min(session.historyIndex, session.feedHistory.length - 1));
  let trimmedFeed = session.feedHistory;
  let targetIndex = safeIndex;
  if (trimmedFeed.length > 50) {
    const start = Math.max(0, targetIndex - 25);
    trimmedFeed = trimmedFeed.slice(start, start + 50);
    targetIndex = targetIndex - start;
  }

  const cleanSession: ReelsSessionState = {
    feedHistory: trimmedFeed.map(sanitizeReelForStorage),
    historyIndex: Math.max(0, Math.min(targetIndex, trimmedFeed.length - 1)),
    lastWatchedReelId: session.feedHistory[safeIndex]?.id || session.lastWatchedReelId,
    filterMode: session.filterMode || 'all',
  };
  inMemoryReelsSession = cleanSession;
  try {
    const json = JSON.stringify(cleanSession);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(REELS_SESSION_STORAGE_KEY, json);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(REELS_SESSION_STORAGE_KEY, json);
      if (cleanSession.lastWatchedReelId) {
        localStorage.setItem('anilove_last_watched_reel_id', cleanSession.lastWatchedReelId);
      }
    }
  } catch {
    // silent
  }
}

export function clearReelsSession(): void {
  inMemoryReelsSession = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(REELS_SESSION_STORAGE_KEY);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(REELS_SESSION_STORAGE_KEY);
    }
  } catch {
    // silent
  }
}

export function findReelByIdOrPrefix(reels: AnimeReel[], queryId?: string): AnimeReel | null {
  if (!queryId) return null;
  const q = String(queryId).trim();
  const qLower = q.toLowerCase();
  return reels.find(r => 
    r.id === q || 
    r.id.toLowerCase() === qLower || 
    (q.length >= 5 && r.id.toLowerCase().startsWith(qLower)) ||
    (r.title && r.title.toLowerCase().includes(qLower)) ||
    (r.cleanTitle && r.cleanTitle.toLowerCase().includes(qLower))
  ) || null;
}

export function findReelIndexByIdOrPrefix(reels: AnimeReel[], queryId?: string): number {
  if (!queryId) return -1;
  const q = String(queryId).trim();
  const qLower = q.toLowerCase();
  return reels.findIndex(r => 
    r.id === q || 
    r.id.toLowerCase() === qLower || 
    (q.length >= 5 && r.id.toLowerCase().startsWith(qLower)) ||
    (r.title && r.title.toLowerCase().includes(qLower)) ||
    (r.cleanTitle && r.cleanTitle.toLowerCase().includes(qLower))
  );
}

/**
 * Returns the exact resume feed & index so users always resume where they left off,
 * or starts a dedicated saved-reels feed when requested.
 */
export function getStartingReelsFeed(
  initialReelId?: string,
  initialFilterMode?: 'all' | 'saved'
): {
  feed: AnimeReel[];
  index: number;
  filterMode: 'all' | 'saved';
} {
  const existingSession = getStoredReelsSession();
  const bundled = getBundledReels(false);
  const savedReels = getStoredSavedReels();

  // If saved reels mode was explicitly requested
  if (initialFilterMode === 'saved') {
    if (savedReels.length > 0) {
      const foundIdx = initialReelId ? findReelIndexByIdOrPrefix(savedReels, initialReelId) : 0;
      const targetIdx = foundIdx >= 0 ? foundIdx : 0;
      return {
        feed: savedReels,
        index: targetIdx,
        filterMode: 'saved',
      };
    } else {
      return {
        feed: [],
        index: 0,
        filterMode: 'saved',
      };
    }
  }

  // If a specific reel was explicitly requested (e.g. from deep link or shared url)
  if (initialReelId && String(initialReelId).trim()) {
    const cleanId = String(initialReelId).trim();
    // 1. Search in bundled reels
    let match = findReelByIdOrPrefix(bundled, cleanId) || findReelByIdOrPrefix(savedReels, cleanId);

    // 2. Check in existing session feed history
    if (!match && existingSession && Array.isArray(existingSession.feedHistory)) {
      match = findReelByIdOrPrefix(existingSession.feedHistory, cleanId);
    }

    // 3. If not found in bundled, synthesize a completely valid AnimeReel from the fileId
    //    so the video stream and thumbnail always point directly to the reel stream without delay!
    if (!match) {
      match = sanitizeReelForStorage({
        id: cleanId,
        name: `Anime Reel ${cleanId.slice(0, 6)}`,
        title: `Anime Reel ${cleanId.slice(0, 6)}`,
        cleanTitle: 'Anime Reel',
        folderId: '',
        folderName: 'Anime Edits',
        url: apiUrl(`/api/reels/stream/${cleanId}`),
        directUrl: apiUrl(`/api/reels/download/${cleanId}`),
        thumbnailUrl: apiUrl(`/api/reels/thumbnail/${cleanId}`),
        mimeType: 'video/mp4'
      });
    }

    // Proactively preload the shared reel immediately
    reelMediaCache.preloadReel(match.id);

    // Queue 3 upcoming reels right behind the shared reel so the user can continue scrolling
    const others = bundled.filter(r => r.id !== match!.id).slice(0, 3);
    const feed = [match, ...others];

    // Save as active session with the shared reel at index 0
    saveStoredReelsSession({
      feedHistory: feed,
      historyIndex: 0,
      lastWatchedReelId: match.id,
      filterMode: 'all',
    });

    return {
      feed,
      index: 0,
      filterMode: 'all',
    };
  }

  // If we have an existing session, resume at the exact reel index user left off!
  if (existingSession && existingSession.feedHistory.length > 0) {
    if (existingSession.filterMode === 'saved' && savedReels.length === 0) {
      return {
        feed: bundled.slice(0, 4),
        index: 0,
        filterMode: 'all',
      };
    }

    let resumeIndex = existingSession.historyIndex;
    if (existingSession.lastWatchedReelId) {
      const matchIdx = existingSession.feedHistory.findIndex(r => r.id === existingSession.lastWatchedReelId);
      if (matchIdx >= 0) {
        resumeIndex = matchIdx;
      }
    }
    resumeIndex = Math.max(0, Math.min(resumeIndex, existingSession.feedHistory.length - 1));

    return {
      feed: existingSession.feedHistory,
      index: resumeIndex,
      filterMode: existingSession.filterMode || 'all',
    };
  }

  // Default initial feed on very first run
  return {
    feed: bundled.slice(0, 4),
    index: 0,
    filterMode: 'all',
  };
}

// Sanitize reel object to prevent any circular or DOM references from being stored
export function sanitizeReelForStorage(reel: Partial<AnimeReel>): AnimeReel {
  return {
    id: String(reel.id || ''),
    title: String(reel.title || 'Anime Reel'),
    cleanTitle: String(reel.cleanTitle || reel.title || 'Anime Reel'),
    folderId: String(reel.folderId || ''),
    folderName: String(reel.folderName || ''),
    url: String(apiUrl(reel.url || `/api/reels/stream/${reel.id}`)),
    directUrl: String(apiUrl(reel.directUrl || `/api/reels/download/${reel.id}`)),
    thumbnailUrl: String(apiUrl(reel.thumbnailUrl || `/api/reels/thumbnail/${reel.id}`)),
    size: reel.size ? String(reel.size) : undefined,
    sizeBytes: typeof reel.sizeBytes === 'number' ? reel.sizeBytes : undefined,
    mimeType: String(reel.mimeType || 'video/mp4')
  };
}

export function getBundledReels(shuffle: boolean = true): AnimeReel[] {
  let list = Array.isArray(bundledReelsRaw) ? bundledReelsRaw.map(sanitizeReelForStorage) : [];
  if (shuffle && list.length > 0) {
    list = generateStratifiedDeck(list);
  }
  return list;
}

export function getStoredSavedReels(): AnimeReel[] {
  try {
    const raw = localStorage.getItem(SAVED_REELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(sanitizeReelForStorage).filter(r => Boolean(r.id));
    }
    return [];
  } catch (err) {
    console.error('Error loading saved reels from localStorage:', err);
    return [];
  }
}

export function saveStoredSavedReels(reels: AnimeReel[]): void {
  try {
    const cleanList = reels.map(sanitizeReelForStorage).filter(r => Boolean(r.id));
    localStorage.setItem(SAVED_REELS_STORAGE_KEY, JSON.stringify(cleanList));
    window.dispatchEvent(new CustomEvent('anilove-saved-reels-updated'));
  } catch (err) {
    console.error('Error saving reels to localStorage:', err);
  }
}

export function isReelSaved(reelId: string): boolean {
  if (!reelId) return false;
  const current = getStoredSavedReels();
  return current.some(r => r.id === reelId);
}

export function toggleSaveReel(reel: AnimeReel): boolean {
  if (!reel || !reel.id) return false;
  const current = getStoredSavedReels();
  const index = current.findIndex(r => r.id === reel.id);
  let isNowSaved = false;

  let updated: AnimeReel[];
  if (index >= 0) {
    updated = current.filter(r => r.id !== reel.id);
    isNowSaved = false;
  } else {
    updated = [sanitizeReelForStorage(reel), ...current];
    isNowSaved = true;
  }

  saveStoredSavedReels(updated);
  return isNowSaved;
}

export function removeSavedReel(reelId: string): AnimeReel[] {
  if (!reelId) return getStoredSavedReels();
  const current = getStoredSavedReels();
  const updated = current.filter(r => r.id !== reelId);
  saveStoredSavedReels(updated);
  return updated;
}

export function clearAllSavedReels(): void {
  localStorage.removeItem(SAVED_REELS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('anilove-saved-reels-updated'));
}

export async function fetchAllReels(shuffle: boolean = true): Promise<AnimeReel[]> {
  try {
    const url = shuffle ? '/api/reels?shuffle=true' : '/api/reels';
    const res = await apiFetch(url);
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data?.reels) ? data.reels : (Array.isArray(data) ? data : []);
      if (items.length > 0) {
        return items.map(sanitizeReelForStorage);
      }
    }
  } catch {
    // fallback to static JSON
  }

  try {
    const staticRes = await fetch('/data/animeReels.json');
    if (staticRes.ok) {
      const staticData = await staticRes.json();
      let items = Array.isArray(staticData?.reels) ? staticData.reels : (Array.isArray(staticData) ? staticData : []);
      if (items.length > 0) {
        const sanitized = items.map(sanitizeReelForStorage);
        return shuffle ? generateStratifiedDeck(sanitized) : sanitized;
      }
    }
  } catch {
    // fallback
  }

  return getBundledReels(shuffle);
}

export async function fetchReelById(reelId: string): Promise<AnimeReel | null> {
  if (!reelId) return null;
  const cleanId = String(reelId).trim();
  const bundled = getBundledReels(false);
  const foundLocal = findReelByIdOrPrefix(bundled, cleanId);
  if (foundLocal) return foundLocal;

  try {
    const res = await apiFetch(`/api/reels/item/${encodeURIComponent(cleanId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.reel) {
        return sanitizeReelForStorage(data.reel);
      }
    }
  } catch {
    // fallback
  }

  // Fallback to searching /api/reels
  try {
    const res = await apiFetch(`/api/reels?id=${encodeURIComponent(cleanId)}`);
    if (res.ok) {
      const data = await res.json();
      const first = data?.reels?.[0];
      if (first) {
        return sanitizeReelForStorage(first);
      }
    }
  } catch {
    // fallback
  }

  return sanitizeReelForStorage({
    id: cleanId,
    title: `Anime Reel ${cleanId.slice(0, 6)}`,
    cleanTitle: 'Anime Reel',
    url: apiUrl(`/api/reels/stream/${cleanId}`),
    directUrl: apiUrl(`/api/reels/download/${cleanId}`),
    thumbnailUrl: apiUrl(`/api/reels/thumbnail/${cleanId}`),
    mimeType: 'video/mp4',
  });
}

export async function preloadReels(reelIds: string[]): Promise<void> {
  if (!reelIds || reelIds.length === 0) return;
  // 1. Client-side Blob & Cache Storage preload
  try {
    reelMediaCache.preloadBatch(reelIds);
  } catch {
    // silent
  }

  // 2. Proactive server LRU buffer warming
  try {
    apiFetch('/api/reels/preload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reelIds })
    }).catch(() => {});
  } catch {
    // silent
  }
}

/**
 * Pre-warms the top candidate reels into memory & browser blob cache
 * immediately upon website launch so that entering the Reels tab is instantaneous.
 */
export function prewarmInitialReelsOnAppStart(): void {
  try {
    const bundled = getBundledReels(false);
    if (bundled && bundled.length > 0) {
      const topReelIds = bundled.slice(0, 5).map(r => r.id);
      preloadReels(topReelIds);

      // Pre-warm thumbnail posters in browser image cache from both Proxy & Google Edge CDN
      for (const id of topReelIds) {
        const img1 = new Image();
        img1.src = apiUrl(`/api/reels/thumbnail/${id}`);
        const img2 = new Image();
        img2.src = `https://lh3.googleusercontent.com/d/${id}`;
      }
    }
  } catch {
    // silent
  }
}

// Auto trigger on module evaluation
if (typeof window !== 'undefined') {
  setTimeout(() => {
    prewarmInitialReelsOnAppStart();
  }, 50);
}

export async function syncReelsFromGoogleDrive(): Promise<AnimeReel[]> {
  try {
    const res = await apiFetch('/api/reels/sync', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.reels && Array.isArray(data.reels)) {
        return data.reels.map(sanitizeReelForStorage);
      }
    }
  } catch (err) {
    console.error('Failed to trigger live Google Drive sync:', err);
  }
  return fetchAllReels();
}
