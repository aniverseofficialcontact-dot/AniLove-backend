import { AnimeReel } from '../types';

const WATCHED_REELS_STORAGE_KEY = 'anilove_watched_reels_history_v2';
const UNPLAYED_DECK_STORAGE_KEY = 'anilove_unplayed_deck_v2';
const MAX_WATCHED_HISTORY_ITEMS = 5000;

/**
 * Fisher-Yates shuffle algorithm for true uniform randomness
 */
export function fisherYatesShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Group reels by drive source (folderId or folderName)
 */
export function partitionReelsByDrive(reels: AnimeReel[]): Map<string, AnimeReel[]> {
  const driveMap = new Map<string, AnimeReel[]>();

  for (const reel of reels) {
    if (!reel || !reel.id) continue;
    const driveKey = reel.folderId || reel.folderName || 'DefaultSource';
    let list = driveMap.get(driveKey);
    if (!list) {
      list = [];
      driveMap.set(driveKey, list);
    }
    list.push(reel);
  }

  return driveMap;
}

/**
 * Multi-Drive Stratified Shuffler
 * 
 * Takes reels across N drives (e.g. 10 current drives, and any newly populated future drives)
 * and produces a balanced interleaved deck where:
 * 1. Each non-empty drive is shuffled independently.
 * 2. Items from different drives are evenly distributed and interleaved.
 * 3. Drives with few items are spaced out smoothly across the deck.
 * 4. Empty drives are safely omitted without errors.
 */
export function generateStratifiedDeck(allReels: AnimeReel[]): AnimeReel[] {
  if (!allReels || allReels.length === 0) return [];

  const driveMap = partitionReelsByDrive(allReels);
  const activeDrives: AnimeReel[][] = [];

  // Shuffle each drive's reels independently and filter out any empty drives
  driveMap.forEach((items) => {
    if (items.length > 0) {
      activeDrives.push(fisherYatesShuffle(items));
    }
  });

  if (activeDrives.length === 0) return [];
  if (activeDrives.length === 1) return activeDrives[0];

  // Shuffle the order of active drives for unpredictable entry order
  const shuffledDrives = fisherYatesShuffle(activeDrives);

  const totalReels = allReels.length;
  const result: AnimeReel[] = [];
  const drivePointers = new Array(shuffledDrives.length).fill(0);

  // Round-robin / fair interleave across active drives until all are consumed
  while (result.length < totalReels) {
    let anyAddedInCycle = false;

    for (let d = 0; d < shuffledDrives.length; d++) {
      const driveList = shuffledDrives[d];
      const pointer = drivePointers[d];

      if (pointer < driveList.length) {
        result.push(driveList[pointer]);
        drivePointers[d] = pointer + 1;
        anyAddedInCycle = true;
      }
    }

    // Safety guard to avoid infinite loops if data is malformed
    if (!anyAddedInCycle) break;
  }

  return result;
}

/**
 * Watched Reels History Persistence
 */
export function getWatchedReelIds(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(WATCHED_REELS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map(String));
    }
  } catch (err) {
    console.warn('[ReelsRandomizer] Failed to read watched history:', err);
  }
  return new Set();
}

export function recordReelAsWatched(reelId: string): void {
  if (!reelId) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const watched = getWatchedReelIds();
    watched.add(String(reelId));

    // Cap history size to prevent storage bloat
    const array = Array.from(watched);
    const capped = array.length > MAX_WATCHED_HISTORY_ITEMS ? array.slice(-MAX_WATCHED_HISTORY_ITEMS) : array;
    localStorage.setItem(WATCHED_REELS_STORAGE_KEY, JSON.stringify(capped));
  } catch (err) {
    console.warn('[ReelsRandomizer] Failed to save watched history:', err);
  }
}

export function clearWatchedReelHistory(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(WATCHED_REELS_STORAGE_KEY);
      localStorage.removeItem(UNPLAYED_DECK_STORAGE_KEY);
    }
  } catch {}
}

/**
 * Persistent Unplayed Stratified Deck Manager
 * Guarantees 0% repeats until all reels in the active pool are watched.
 */
class ReelDeckManager {
  private unplayedDeck: AnimeReel[] = [];
  private poolFingerprint: string = '';

  /**
   * Initializes or replenishes the unplayed deck with multi-drive stratified distribution.
   */
  public ensureDeck(allReels: AnimeReel[], forceReset: boolean = false): void {
    if (!allReels || allReels.length === 0) {
      this.unplayedDeck = [];
      return;
    }

    const currentFingerprint = `${allReels.length}-${allReels[0]?.id || ''}`;
    if (!forceReset && this.unplayedDeck.length > 5 && this.poolFingerprint === currentFingerprint) {
      return;
    }

    this.poolFingerprint = currentFingerprint;
    const watchedSet = getWatchedReelIds();

    // Find all unplayed reels
    let unplayed = allReels.filter(r => !watchedSet.has(r.id));

    // If the entire library (2049+ reels) has been watched or fewer than 10 remain:
    // Reset watched history for a fresh cycle and reshuffle
    if (unplayed.length < 10) {
      clearWatchedReelHistory();
      unplayed = allReels;
    }

    // Stratify the unplayed items across all drives
    this.unplayedDeck = generateStratifiedDeck(unplayed);
  }

  /**
   * Draw N non-repeating reels from the deck
   */
  public drawNextReels(allReels: AnimeReel[], count: number, excludeIds: string[] = []): AnimeReel[] {
    this.ensureDeck(allReels);

    const excludeSet = new Set(excludeIds);
    const drawn: AnimeReel[] = [];

    while (drawn.length < count && this.unplayedDeck.length > 0) {
      const candidate = this.unplayedDeck.shift()!;
      if (!excludeSet.has(candidate.id)) {
        drawn.push(candidate);
        excludeSet.add(candidate.id);
        recordReelAsWatched(candidate.id);
      }
    }

    // If deck ran dry, replenish and continue drawing
    if (drawn.length < count && allReels.length > 0) {
      this.ensureDeck(allReels, true);
      while (drawn.length < count && this.unplayedDeck.length > 0) {
        const candidate = this.unplayedDeck.shift()!;
        if (!excludeSet.has(candidate.id)) {
          drawn.push(candidate);
          excludeSet.add(candidate.id);
          recordReelAsWatched(candidate.id);
        }
      }
    }

    return drawn;
  }

  /**
   * Returns a single random reel adhering to the multi-drive stratified non-repeating rule
   */
  public pickNextReel(allReels: AnimeReel[], excludeIds: string[] = []): AnimeReel | null {
    const drawn = this.drawNextReels(allReels, 1, excludeIds);
    return drawn[0] || null;
  }

  /**
   * Gets remaining unplayed count in current cycle
   */
  public getRemainingCount(): number {
    return this.unplayedDeck.length;
  }
}

export const reelDeckManager = new ReelDeckManager();
