/**
 * Game Freshness & Anti-Repetition Service
 * Ensures all arcade mini-games (Blur Guesser, Higher or Lower, Emoji Cipher)
 * provide 100% unique, fresh content across sessions, days, and weeks.
 * Employs persistent LRU history caching in localStorage across 1000+ items.
 */

const MAX_HISTORY_LENGTH = 1000;

/**
 * Retrieve the list of seen item IDs for a specific game key.
 */
export function getPersistentSeenIds(gameKey: string): (number | string)[] {
  try {
    const raw = localStorage.getItem(`anilove_game_seen_${gameKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Record one or more item IDs as seen in the persistent history for a game key.
 */
export function recordPersistentSeenId(gameKey: string, id: number | string): void {
  try {
    const current = getPersistentSeenIds(gameKey);
    const filtered = current.filter(item => item !== id);
    filtered.push(id);

    // Keep history capped at MAX_HISTORY_LENGTH
    if (filtered.length > MAX_HISTORY_LENGTH) {
      filtered.splice(0, filtered.length - MAX_HISTORY_LENGTH);
    }

    localStorage.setItem(`anilove_game_seen_${gameKey}`, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Failed to record persistent seen id:', err);
  }
}

/**
 * Record multiple item IDs as seen simultaneously.
 */
export function recordGameSeen(gameKey: string, ids: (number | string)[]): void {
  try {
    const current = getPersistentSeenIds(gameKey);
    const set = new Set(ids);
    const filtered = current.filter(item => !set.has(item));
    filtered.push(...ids);

    if (filtered.length > MAX_HISTORY_LENGTH) {
      filtered.splice(0, filtered.length - MAX_HISTORY_LENGTH);
    }

    localStorage.setItem(`anilove_game_seen_${gameKey}`, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Failed to record game seen ids:', err);
  }
}

/**
 * Check if a specific ID has been seen in recent game history.
 */
export function isItemSeen(gameKey: string, id: number | string): boolean {
  const seen = getPersistentSeenIds(gameKey);
  return seen.includes(id);
}

/**
 * Clear the persistent history for a given game.
 */
export function clearGameHistory(gameKey: string): void {
  try {
    localStorage.removeItem(`anilove_game_seen_${gameKey}`);
  } catch {}
}

/**
 * Filter items to only include unseen items.
 * If unseen count is below minRequired, it gracefully falls back to the oldest (least recently seen) items.
 */
export function filterFreshItems<T extends { id: number | string }>(
  items: T[],
  gameKey: string,
  minRequired: number = 4
): { freshItems: T[]; seenCount: number } {
  const seenIds = new Set(getPersistentSeenIds(gameKey));
  const unseen = items.filter(item => !seenIds.has(item.id));

  if (unseen.length >= minRequired) {
    return { freshItems: unseen, seenCount: seenIds.size };
  }

  // If pool is near exhaustion, sort by LRU age (unseen first, then oldest seen items)
  const sortedByAge = [...items].sort((a, b) => {
    const aSeen = seenIds.has(a.id);
    const bSeen = seenIds.has(b.id);
    if (!aSeen && bSeen) return -1;
    if (aSeen && !bSeen) return 1;
    return 0;
  });

  return { freshItems: sortedByAge, seenCount: seenIds.size };
}

/**
 * Pick a guaranteed fresh item from an array that is not in excludeIds and not in seen history.
 */
export function pickGuaranteedFreshItem<T extends { id: number | string }>(
  items: T[],
  gameKey: string,
  excludeIds: (number | string)[] = []
): T | null {
  if (!items || items.length === 0) return null;

  const excludeSet = new Set(excludeIds);
  const seenSet = new Set(getPersistentSeenIds(gameKey));

  // 1. First priority: not excluded and completely unseen
  const unseen = items.filter(item => !excludeSet.has(item.id) && !seenSet.has(item.id));
  if (unseen.length > 0) {
    return unseen[Math.floor(Math.random() * unseen.length)];
  }

  // 2. Second priority: not excluded, pick from least recently seen
  const candidates = items.filter(item => !excludeSet.has(item.id));
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  return items[0] || null;
}
