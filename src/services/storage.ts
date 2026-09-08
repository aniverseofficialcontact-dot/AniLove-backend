import { UserMediaListItem, UserSettings, Anime, EpisodeNote, AppTheme, WatchHistoryEntry, GachaCard, MediaListStatus } from '../types';
import { auth, saveGameDataToCloudFirestore, fetchGameDataFromCloudFirestore } from '../lib/firebase';
import { apiFetch } from './apiClient';

const SETTINGS_KEY = 'anilove_settings_v3';
const SETTINGS_KEY_LEGACY = 'anilove_settings_legacy';
const LIBRARY_KEY = 'anilove_library_v3';
const LIBRARY_KEY_LEGACY = 'anilove_library_legacy';
const NOTIFICATIONS_KEY = 'anilove_notifications_v3';
const NOTIFICATIONS_KEY_LEGACY = 'anilove_notifications_legacy';
const EPISODE_NOTES_KEY = 'anilove_episode_notes_v1';
const GACHA_VAULT_KEY = 'anilove_gacha_vault_v1';
const TIER_LIST_KEY = 'anilove_tier_list_v1';
const ARCADE_COINS_KEY = 'anilove_arcade_coins_v1';
const DAILY_GAMES_RECORD_KEY = 'anilove_daily_games_record_v1';
const CARD_AWAKENINGS_KEY = 'anilove_card_awakenings_v1';
const ACTIVE_COMPANION_KEY = 'anilove_active_companion_v1';
const WATCH_HISTORY_KEY = 'anilove_watch_history_v2';
const WATCH_HISTORY_KEY_LEGACY = 'anilove_watch_history_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'midnight',
  twoWaySyncEnabled: true,
  syncEpisodeProgress: true,
  syncWatchStatus: true,
  syncScores: true,
  anilistToken: null,
  anilistUser: null,
  importUsername: null,
  autoSyncAniList: true,
  lastSyncTimestamp: null,
  malUsername: null,
  malToken: null,
  malUser: null,
  malSyncEnabled: true,
  autoSyncMAL: true,
  primaryTracker: 'anilist',
  currentProfileId: 'profile-main',
  profiles: [
    {
      id: 'profile-main',
      name: 'Anime Explorer',
      avatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
      email: '',
      createdAt: Date.now(),
    },
    {
      id: 'profile-otaku',
      name: 'Otaku Mode',
      avatar: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&auto=format&fit=crop&q=80',
      email: '',
      createdAt: Date.now(),
    },
  ],
  profilePin: null,
  profilePinEnabled: false,
  profilePinBackupQuestion: 'what/who do you like most?',
  profilePinBackupAnswer: null,
  customDisplayName: 'Anime Explorer',
  customEmail: '',
  customAvatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
  contentRestrictions: false,
  notificationsEnabled: true,
  notifyAiringEpisodes: true,
  notifySyncUpdates: true,
  notifyDailyDigest: true,
  browserPushEnabled: false,
  preferredAudio: 'dub',
  preferredLanguages: ['DUB', 'SUB'],
  preferredServers: ['tatakai-multi', 'anify-cloud', 'anikoto-hd1'],
  autoPlayNextEpisode: true,
  defaultStreamServer: 'tatakai-multi',
  ambientGlowEnabled: true,
  autoSkipIntro: false,
  equalizerPreset: 'flat',
  soundEffectsEnabled: true,
  soundVolume: 0.8,
  enable3DCardPreview: true,
  ambientParticlesEnabled: false,
  ambientParticleStyle: 'sakura',
  appIntroAnimationEnabled: true,
};

// =============================================================
// USER SETTINGS
// =============================================================
export function getStoredSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(SETTINGS_KEY_LEGACY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    let theme: AppTheme = parsed.theme;
    if (parsed.theme === 'dark') theme = 'midnight';

    if (parsed.customEmail === 'shamu992728@gmail.com') {
      parsed.customEmail = '';
    }
    if (Array.isArray(parsed.profiles)) {
      parsed.profiles = parsed.profiles.map((p: any) => ({
        ...p,
        email: p.email === 'shamu992728@gmail.com' ? '' : p.email,
      }));
    }

    return { ...DEFAULT_SETTINGS, ...parsed, theme };
  } catch (e) {
    console.error('Error reading stored settings:', e);
    return DEFAULT_SETTINGS;
  }
}

export const getUserSettings = getStoredSettings;

export function saveStoredSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Trigger background cloud sync for cards and coins if logged in with AniList or MyAnimeList
    const trackerToken = getActiveTrackerToken(settings);
    if (trackerToken) {
      scheduleCloudSync(trackerToken);
    }
  } catch (e) {
    console.error('Error saving stored settings:', e);
  }
}

export const saveUserSettings = saveStoredSettings;

// =============================================================
// TRACKER USER CLOUD SYNCHRONIZATION ENGINE (CARDS, COINS, HISTORY)
// =============================================================
export function getActiveTrackerToken(settings?: UserSettings | null): string | null {
  const current = settings || getStoredSettings();
  if (current.anilistToken) return current.anilistToken;
  if (current.malToken) return current.malToken;
  if (current.malUsername) return `mal_user:${current.malUsername}`;
  if (current.importUsername) return `anilist_user:${current.importUsername}`;
  if (current.customDisplayName) return `local_${current.customDisplayName}`;
  return null;
}

let syncDebounceTimer: any = null;

export function scheduleCloudSync(token?: string | null): void {
  const currentToken = token || getActiveTrackerToken();
  if (!currentToken) return;

  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(() => {
    pushUserDataToCloud(currentToken).catch(err => {
      console.warn('Background tracker user sync error:', err);
    });
  }, 1200);
}

export async function pushUserDataToCloud(tokenOrSettings?: string | UserSettings | null): Promise<boolean> {
  const token = typeof tokenOrSettings === 'string' ? tokenOrSettings : getActiveTrackerToken(tokenOrSettings);

  const coins = getStoredArcadeCoins();
  const characterCards = getStoredGachaVault();
  const cardAwakenings = getAllCardAwakenings();
  const activeCompanion = getStoredActiveCompanion();
  const watchHistory = getStoredWatchHistory();
  const rawDaily = localStorage.getItem(DAILY_GAMES_RECORD_KEY);
  const dailyGameRecords = rawDaily ? JSON.parse(rawDaily) : {};

  // 1. If user is signed in with Firebase, sync with Firestore game state
  if (auth?.currentUser) {
    saveGameDataToCloudFirestore(auth.currentUser.uid, {
      coins,
      characterCards,
      cardAwakenings,
      activeCompanion,
      watchHistory,
      dailyGameRecords,
    }).catch(err => {
      console.warn('Firebase game data background sync warn:', err);
    });
  }

  if (!token) return false;

  // 2. If browser is offline, don't attempt network fetch
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

    const response = await apiFetch('/api/user/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        coins,
        characterCards,
        cardAwakenings,
        activeCompanion,
        watchHistory,
        dailyGameRecords,
      }),
      signal: controller?.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn('Push user sync response not ok:', err);
      return false;
    }

    return true;
  } catch (error: any) {
    // Graceful handling without throwing fatal errors
    if (error?.name !== 'AbortError') {
      console.warn('Push user sync network notice (data preserved locally):', error?.message || error);
    }
    return false;
  }
}

export async function syncUserDataWithCloud(
  tokenOrSettings?: string | UserSettings | null
): Promise<{ success: boolean; coins: number; cardsCount: number; user?: any }> {
  const token = typeof tokenOrSettings === 'string' ? tokenOrSettings : getActiveTrackerToken(tokenOrSettings);

  // 1. If Firebase user is signed in, merge from Firestore
  if (auth?.currentUser) {
    try {
      const cloudGameData = await fetchGameDataFromCloudFirestore(auth.currentUser.uid);
      if (cloudGameData) {
        // Merge coins
        const localCoins = getStoredArcadeCoins();
        const cloudCoins = typeof cloudGameData.coins === 'number' ? cloudGameData.coins : 10;
        const mergedCoins = Math.max(localCoins, cloudCoins);
        localStorage.setItem(ARCADE_COINS_KEY, mergedCoins.toString());
        window.dispatchEvent(new CustomEvent('arcade_coins_updated', { detail: mergedCoins }));

        // Merge character cards
        const localCards = getStoredGachaVault();
        const cloudCards: GachaCard[] = Array.isArray(cloudGameData.characterCards) ? cloudGameData.characterCards : [];
        const cardMap = new Map<string, GachaCard>();
        localCards.forEach(c => {
          if (c && c.id) cardMap.set(c.id, c);
        });
        cloudCards.forEach(c => {
          if (c && c.id) {
            const current = cardMap.get(c.id);
            if (!current || (c.obtainedAt && c.obtainedAt > (current.obtainedAt || 0))) {
              cardMap.set(c.id, c);
            }
          }
        });
        const mergedCards = Array.from(cardMap.values());
        localStorage.setItem(GACHA_VAULT_KEY, JSON.stringify(mergedCards));
        window.dispatchEvent(new CustomEvent('vault_updated', { detail: mergedCards }));

        // Merge awakenings
        const localAwakenings = getAllCardAwakenings();
        const cloudAwakenings = cloudGameData.cardAwakenings || {};
        const mergedAwakenings = { ...localAwakenings };
        Object.entries(cloudAwakenings).forEach(([cId, lvl]) => {
          mergedAwakenings[cId] = Math.max(mergedAwakenings[cId] || 1, Number(lvl) || 1);
        });
        localStorage.setItem(CARD_AWAKENINGS_KEY, JSON.stringify(mergedAwakenings));
        window.dispatchEvent(new CustomEvent('character_awakened', { detail: mergedAwakenings }));

        // Active companion
        if (cloudGameData.activeCompanion) {
          localStorage.setItem(ACTIVE_COMPANION_KEY, JSON.stringify(cloudGameData.activeCompanion));
          window.dispatchEvent(new CustomEvent('active_companion_changed', { detail: cloudGameData.activeCompanion }));
        }
      }
    } catch (e) {
      console.warn('Firestore game data merge notice:', e);
    }
  }

  if (!token) return { success: true, coins: getStoredArcadeCoins(), cardsCount: getStoredGachaVault().length };

  // If offline, return local state without throwing
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { success: true, coins: getStoredArcadeCoins(), cardsCount: getStoredGachaVault().length };
  }

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

    const response = await apiFetch('/api/user/sync', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      signal: controller?.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      // First push current local data to initialize cloud store
      await pushUserDataToCloud(token);
      return { success: true, coins: getStoredArcadeCoins(), cardsCount: getStoredGachaVault().length };
    }

    const json = await response.json();
    const cloudData = json?.data;
    const user = json?.user;

    if (cloudData) {
      // 1. Merge coins (take max balance so user never loses earned coins)
      const localCoins = getStoredArcadeCoins();
      const cloudCoins = typeof cloudData.coins === 'number' ? cloudData.coins : 10;
      const mergedCoins = Math.max(localCoins, cloudCoins);
      localStorage.setItem(ARCADE_COINS_KEY, mergedCoins.toString());
      window.dispatchEvent(new CustomEvent('arcade_coins_updated', { detail: mergedCoins }));

      // 2. Merge character cards (union by id)
      const localCards = getStoredGachaVault();
      const cloudCards: GachaCard[] = Array.isArray(cloudData.characterCards) ? cloudData.characterCards : [];
      const cardMap = new Map<string, GachaCard>();
      localCards.forEach(c => {
        if (c && c.id) cardMap.set(c.id, c);
      });
      cloudCards.forEach(c => {
        if (c && c.id) {
          const current = cardMap.get(c.id);
          if (!current || (c.obtainedAt && c.obtainedAt > (current.obtainedAt || 0))) {
            cardMap.set(c.id, c);
          }
        }
      });
      const mergedCards = Array.from(cardMap.values());
      localStorage.setItem(GACHA_VAULT_KEY, JSON.stringify(mergedCards));
      window.dispatchEvent(new CustomEvent('vault_updated', { detail: mergedCards }));

      // 3. Merge card awakenings
      const localAwakenings = getAllCardAwakenings();
      const cloudAwakenings = cloudData.cardAwakenings || {};
      const mergedAwakenings = { ...localAwakenings };
      Object.entries(cloudAwakenings).forEach(([cId, lvl]) => {
        mergedAwakenings[cId] = Math.max(mergedAwakenings[cId] || 1, Number(lvl) || 1);
      });
      localStorage.setItem(CARD_AWAKENINGS_KEY, JSON.stringify(mergedAwakenings));
      window.dispatchEvent(new CustomEvent('character_awakened', { detail: mergedAwakenings }));

      // 4. Merge active companion
      if (cloudData.activeCompanion) {
        localStorage.setItem(ACTIVE_COMPANION_KEY, JSON.stringify(cloudData.activeCompanion));
        window.dispatchEvent(new CustomEvent('active_companion_changed', { detail: cloudData.activeCompanion }));
      }

      // 5. Merge watch history
      const localHistory = getStoredWatchHistory();
      const cloudHistory: WatchHistoryEntry[] = Array.isArray(cloudData.watchHistory) ? cloudData.watchHistory : [];
      const histMap = new Map<string, WatchHistoryEntry>();
      localHistory.forEach(h => histMap.set(`${h.animeId}-${h.episodeNumber}`, h));
      cloudHistory.forEach(h => {
        const key = `${h.animeId}-${h.episodeNumber}`;
        const cur = histMap.get(key);
        if (!cur || (h.lastWatchedAt && h.lastWatchedAt >= (cur.lastWatchedAt || 0))) {
          histMap.set(key, h);
        }
      });
      const mergedHistory = Array.from(histMap.values()).slice(0, 50);
      localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(mergedHistory));

      // Push final merged state back to ensure cloud is in sync
      await pushUserDataToCloud(token);

      return {
        success: true,
        coins: mergedCoins,
        cardsCount: mergedCards.length,
        user,
      };
    } else {
      // Initialize cloud with current local cards and coins
      await pushUserDataToCloud(token);
      return {
        success: true,
        coins: getStoredArcadeCoins(),
        cardsCount: getStoredGachaVault().length,
        user,
      };
    }
  } catch (err: any) {
    console.warn('User sync notice (data retained locally):', err?.message || err);
    return { success: true, coins: getStoredArcadeCoins(), cardsCount: getStoredGachaVault().length };
  }
}

export const syncUserDataWithAniList = (token: string) => syncUserDataWithCloud(token);
export const syncUserDataWithMAL = (tokenOrUsername: string) => syncUserDataWithCloud(tokenOrUsername.startsWith('mal_user:') || tokenOrUsername.startsWith('Bearer ') ? tokenOrUsername : `mal_user:${tokenOrUsername}`);

// =============================================================
// USER LIBRARY
// =============================================================
export function getStoredLibrary(): UserMediaListItem[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY) || localStorage.getItem(LIBRARY_KEY_LEGACY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading stored library:', e);
    return [];
  }
}

export const getUserLibrary = getStoredLibrary;

export function saveStoredLibrary(items: UserMediaListItem[]): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error saving stored library:', e);
  }
}

export const saveUserLibrary = saveStoredLibrary;

export function updateLibraryItem(
  library: UserMediaListItem[],
  anime: Anime,
  updates: Partial<UserMediaListItem>
): UserMediaListItem[] {
  const index = library.findIndex(i => i.mediaId === anime.id);
  let updated: UserMediaListItem[];
  let targetItem: UserMediaListItem;

  if (index >= 0) {
    targetItem = {
      ...library[index],
      ...updates,
      media: anime,
      updatedAt: Date.now(),
    };
    updated = [...library];
    updated[index] = targetItem;
  } else {
    targetItem = {
      mediaId: anime.id,
      status: updates.status || 'PLANNING',
      progress: updates.progress || 0,
      score: updates.score || 0,
      updatedAt: Date.now(),
      media: anime,
      ...updates,
    };
    updated = [targetItem, ...library];
  }

  saveStoredLibrary(updated);
  return updated;
}

export const upsertLibraryItem = (library: UserMediaListItem[], item: UserMediaListItem) =>
  updateLibraryItem(library, item.media, item);

export function removeLibraryItem(library: UserMediaListItem[], mediaId: number): UserMediaListItem[] {
  const updated = library.filter(i => i.mediaId !== mediaId);
  saveStoredLibrary(updated);
  return updated;
}

export function exportLibraryAsJSON(library: UserMediaListItem[], settings?: UserSettings): void {
  const allVaultCards = getStoredGachaVault();
  const allCoins = getStoredArcadeCoins();
  const allAwakenings = getAllCardAwakenings();
  const allCompanion = getStoredActiveCompanion();

  const data = {
    exportedAt: new Date().toISOString(),
    version: '4.0',
    library,
    characterCards: allVaultCards,
    coins: allCoins,
    cardAwakenings: allAwakenings,
    activeCompanion: allCompanion,
    settings: settings
      ? {
          theme: settings.theme,
          importUsername: settings.importUsername,
          twoWaySyncEnabled: settings.twoWaySyncEnabled,
        }
      : undefined,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `anilove-complete-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const exportLibraryToJson = (library: UserMediaListItem[]) => exportLibraryAsJSON(library);

export function importLibraryFromJSON(
  file: File,
  onSuccess: (library: UserMediaListItem[], settings?: UserSettings) => void,
  onError: (errorMsg: string) => void
): void {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const content = e.target?.result as string;
      const parsed = JSON.parse(content);
      const importedLib: UserMediaListItem[] = Array.isArray(parsed) ? parsed : parsed.library || [];
      if (!Array.isArray(importedLib)) {
        throw new Error('Invalid JSON format: missing library array.');
      }

      // Restore character cards & coins if in backup
      if (Array.isArray(parsed.characterCards)) {
        saveStoredGachaCards(parsed.characterCards);
      }
      if (typeof parsed.coins === 'number') {
        saveStoredArcadeCoins(parsed.coins);
      }
      if (parsed.cardAwakenings && typeof parsed.cardAwakenings === 'object') {
        localStorage.setItem(CARD_AWAKENINGS_KEY, JSON.stringify(parsed.cardAwakenings));
      }
      if (parsed.activeCompanion) {
        setStoredActiveCompanion(parsed.activeCompanion);
      }

      scheduleCloudSync();
      onSuccess(importedLib, parsed.settings);
    } catch (err: any) {
      onError(err.message || 'Failed to parse JSON backup file.');
    }
  };
  reader.onerror = () => {
    onError('Failed to read file from disk.');
  };
  reader.readAsText(file);
}

export const importLibraryFromJson = (jsonStr: string, currentLibrary: UserMediaListItem[]): UserMediaListItem[] => {
  const data = JSON.parse(jsonStr);
  const importedItems: UserMediaListItem[] = Array.isArray(data) ? data : data.library || [];
  const map = new Map<number, UserMediaListItem>();
  currentLibrary.forEach(item => map.set(item.mediaId, item));
  importedItems.forEach(item => {
    if (item.mediaId && item.media) {
      map.set(item.mediaId, item);
    }
  });
  const merged = Array.from(map.values());
  saveStoredLibrary(merged);
  return merged;
};

// =============================================================
// NOTIFICATIONS
// =============================================================
export function getStoredNotifications(): import('../types').AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY) || localStorage.getItem(NOTIFICATIONS_KEY_LEGACY);
    if (!raw) {
      return [
        {
          id: 'welcome-1',
          type: 'system',
          title: 'Welcome to AniLove!',
          message: 'Explore trending anime, sync with your AniList account, and collect character cards.',
          timestamp: Date.now() - 3600000,
          read: false,
        },
      ];
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading stored notifications:', e);
    return [];
  }
}

export function saveStoredNotifications(notifications: import('../types').AppNotification[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (e) {
    console.error('Error saving stored notifications:', e);
  }
}

// =============================================================
// WATCH HISTORY
// =============================================================
export function getStoredWatchHistory(): WatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(WATCH_HISTORY_KEY) || localStorage.getItem(WATCH_HISTORY_KEY_LEGACY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Deduplicate by animeId: Keep only the single latest active episode per anime
    const animeMap = new Map<number, WatchHistoryEntry>();
    let hadDuplicates = false;

    // Sort by lastWatchedAt descending
    const sorted = [...parsed].sort((a, b) => (b.lastWatchedAt || 0) - (a.lastWatchedAt || 0));

    for (const item of sorted) {
      if (!item || !item.animeId || !item.anime) continue;

      // Filter out completed episodes (progress >= 85% or explicitly marked completed)
      const isCompleted = item.completed || (item.duration > 0 && item.currentTime / item.duration >= 0.85);
      if (isCompleted) {
        hadDuplicates = true;
        continue;
      }

      if (!animeMap.has(item.animeId)) {
        animeMap.set(item.animeId, item);
      } else {
        // If there were multiple episodes for the same anime, keep the one with higher episode number
        const existing = animeMap.get(item.animeId)!;
        if (
          item.episodeNumber > existing.episodeNumber ||
          (item.episodeNumber === existing.episodeNumber && (item.lastWatchedAt || 0) > (existing.lastWatchedAt || 0))
        ) {
          animeMap.set(item.animeId, item);
        }
        hadDuplicates = true;
      }
    }

    const deduplicated = Array.from(animeMap.values()).sort(
      (a, b) => (b.lastWatchedAt || 0) - (a.lastWatchedAt || 0)
    );

    if (hadDuplicates) {
      try {
        localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(deduplicated));
      } catch {}
    }

    return deduplicated;
  } catch (e) {
    console.error('Error reading stored watch history:', e);
    return [];
  }
}

export function saveStoredWatchHistory(history: WatchHistoryEntry[]): void {
  try {
    // Ensure strict uniqueness per anime
    const animeMap = new Map<number, WatchHistoryEntry>();
    const sorted = [...history].sort((a, b) => (b.lastWatchedAt || 0) - (a.lastWatchedAt || 0));
    for (const item of sorted) {
      if (item && item.animeId && !animeMap.has(item.animeId)) {
        animeMap.set(item.animeId, item);
      }
    }
    const cleanList = Array.from(animeMap.values()).slice(0, 30);
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(cleanList));
    scheduleCloudSync();
  } catch (e) {
    console.error('Error saving stored watch history:', e);
  }
}

export function recordWatchProgress(entry: {
  anime: Anime;
  episodeNumber: number;
  episodeTitle?: string;
  seasonTitle?: string;
  currentTime: number;
  duration: number;
  thumbnailStyle?: import('../types').ThumbnailAppearance;
}): WatchHistoryEntry[] {
  const isEpisodeCompleted = entry.duration > 0 && entry.currentTime / entry.duration >= 0.85;

  // 1. Auto-complete prior episodes in user's library
  // When watching episode N, episodes 1..(N-1) are automatically considered completed.
  try {
    const library = getStoredLibrary();
    const existingLibItem = library.find(item => item.mediaId === entry.anime.id);
    const targetProgress = isEpisodeCompleted ? entry.episodeNumber : Math.max(1, entry.episodeNumber - 1);
    const currentProgress = existingLibItem?.progress || 0;

    const totalEps =
      typeof entry.anime.episodes === 'number' && entry.anime.episodes > 0 ? entry.anime.episodes : null;
    const isFullAnimeCompleted = totalEps !== null && targetProgress >= totalEps;

    if (
      !existingLibItem ||
      currentProgress < targetProgress ||
      (isFullAnimeCompleted && existingLibItem.status !== 'COMPLETED')
    ) {
      const nextStatus: MediaListStatus = isFullAnimeCompleted
        ? 'COMPLETED'
        : existingLibItem?.status === 'COMPLETED' && !isFullAnimeCompleted
        ? 'CURRENT'
        : existingLibItem?.status || 'CURRENT';
      updateLibraryItem(library, entry.anime, {
        progress: Math.max(currentProgress, targetProgress),
        status: nextStatus,
      });
    }
  } catch (e) {
    console.warn('Auto library update on watch progress error:', e);
  }

  // 2. Manage Continue Watching history:
  // Strictly at most 1 episode per anime. All previous episodes for this anime are removed from continue watching.
  const currentHistory = getStoredWatchHistory();
  const otherAnimeHistory = currentHistory.filter(h => h.animeId !== entry.anime.id);

  if (isEpisodeCompleted) {
    // If the episode is completed, do not keep it in Continue Watching
    saveStoredWatchHistory(otherAnimeHistory);
    return otherAnimeHistory;
  }

  const newEntry: WatchHistoryEntry = {
    animeId: entry.anime.id,
    anime: entry.anime,
    episodeNumber: entry.episodeNumber,
    episodeTitle: entry.episodeTitle,
    seasonTitle: entry.seasonTitle,
    currentTime: Math.max(0, Math.round(entry.currentTime)),
    duration: Math.max(1, Math.round(entry.duration || 1440)),
    lastWatchedAt: Date.now(),
    thumbnailStyle: entry.thumbnailStyle || 'snapshot',
    completed: false,
  };

  const updated = [newEntry, ...otherAnimeHistory].slice(0, 30);
  saveStoredWatchHistory(updated);
  return updated;
}

export function removeWatchHistoryItem(animeId: number, episodeNumber?: number): WatchHistoryEntry[] {
  const current = getStoredWatchHistory();
  const updated = current.filter(item => {
    if (item.animeId !== animeId) return true;
    if (episodeNumber !== undefined && item.episodeNumber !== episodeNumber) return true;
    return false;
  });
  saveStoredWatchHistory(updated);
  return updated;
}

export function updateWatchHistoryThumbnailStyle(
  animeId: number,
  thumbnailStyle: import('../types').ThumbnailAppearance
): WatchHistoryEntry[] {
  const current = getStoredWatchHistory();
  const updated = current.map(item => (item.animeId === animeId ? { ...item, thumbnailStyle } : item));
  saveStoredWatchHistory(updated);
  return updated;
}

export function clearWatchHistory(): void {
  saveStoredWatchHistory([]);
}

// =============================================================
// EPISODE NOTES
// =============================================================
export function getStoredEpisodeNotes(animeId?: number, episodeNumber?: number): EpisodeNote[] {
  try {
    const raw = localStorage.getItem(EPISODE_NOTES_KEY);
    if (!raw) return [];
    const notes: EpisodeNote[] = JSON.parse(raw);
    if (animeId !== undefined && episodeNumber !== undefined) {
      return notes.filter(n => n.animeId === animeId && n.episodeNumber === episodeNumber);
    }
    if (animeId !== undefined) {
      return notes.filter(n => n.animeId === animeId);
    }
    return notes;
  } catch (e) {
    console.error('Error reading episode notes:', e);
    return [];
  }
}

export function saveStoredEpisodeNote(note: Omit<EpisodeNote, 'id' | 'createdAt'>): EpisodeNote[] {
  try {
    const allNotes = getStoredEpisodeNotes();
    const newNote: EpisodeNote = {
      ...note,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: Date.now(),
    };
    const updated = [newNote, ...allNotes];
    localStorage.setItem(EPISODE_NOTES_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error saving episode note:', e);
    return [];
  }
}

export function deleteStoredEpisodeNote(noteId: string): EpisodeNote[] {
  try {
    const allNotes = getStoredEpisodeNotes();
    const updated = allNotes.filter(n => n.id !== noteId);
    localStorage.setItem(EPISODE_NOTES_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error deleting episode note:', e);
    return [];
  }
}

// =============================================================
// GACHA & CHARACTER CARDS VAULT
// =============================================================
export function getStoredGachaVault(): GachaCard[] {
  try {
    const raw = localStorage.getItem(GACHA_VAULT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading gacha vault:', e);
    return [];
  }
}

export const getStoredGachaCards = getStoredGachaVault;

export function saveStoredGachaCards(cards: GachaCard[]): void {
  try {
    localStorage.setItem(GACHA_VAULT_KEY, JSON.stringify(cards));
    window.dispatchEvent(new CustomEvent('vault_updated', { detail: cards }));
    scheduleCloudSync();
  } catch (e) {
    console.error('Error saving gacha cards:', e);
  }
}

export function saveGachaCardToVault(card: GachaCard): GachaCard[] {
  try {
    const current = getStoredGachaVault();
    // Prevent duplicate cards if already exists, or update timestamp
    const existingIdx = current.findIndex(c => c.id === card.id);
    let updated: GachaCard[];
    if (existingIdx >= 0) {
      updated = [...current];
      updated[existingIdx] = { ...updated[existingIdx], ...card };
    } else {
      updated = [card, ...current];
    }
    saveStoredGachaCards(updated);
    return updated;
  } catch (e) {
    console.error('Error saving gacha card:', e);
    return [];
  }
}

export function getStoredGachaSpinsUsed(): number {
  try {
    const raw = localStorage.getItem('anilove_gacha_spins_used_v1');
    if (!raw) return 0;
    const num = parseInt(raw, 10);
    return isNaN(num) ? 0 : num;
  } catch (e) {
    return 0;
  }
}

export function saveStoredGachaSpinsUsed(count: number): void {
  try {
    localStorage.setItem('anilove_gacha_spins_used_v1', Math.max(0, count).toString());
  } catch (e) {
    console.error('Error saving gacha spins used:', e);
  }
}

export function incrementGachaSpinsUsed(by: number = 1): number {
  const current = getStoredGachaSpinsUsed();
  const next = current + by;
  saveStoredGachaSpinsUsed(next);
  return next;
}

export function getStoredTierList(): import('../types').TierListEntry[] {
  try {
    const raw = localStorage.getItem(TIER_LIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading tier list:', e);
    return [];
  }
}

export const getStoredTierLists = getStoredTierList;

export function saveStoredTierList(entries: import('../types').TierListEntry[]): void {
  try {
    localStorage.setItem(TIER_LIST_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Error saving tier list:', e);
  }
}

export const saveStoredTierLists = saveStoredTierList;

// =============================================================
// ARCADE ECONOMY & DAILY LIMITS
// =============================================================
export function getStoredArcadeCoins(): number {
  try {
    const raw = localStorage.getItem(ARCADE_COINS_KEY);
    if (raw === null) {
      localStorage.setItem(ARCADE_COINS_KEY, '10');
      return 10;
    }
    const val = parseInt(raw, 10);
    return isNaN(val) ? 10 : Math.max(0, val);
  } catch (e) {
    return 10;
  }
}

export function saveStoredArcadeCoins(coins: number): void {
  try {
    const safeCoins = Math.max(0, Math.floor(coins));
    localStorage.setItem(ARCADE_COINS_KEY, safeCoins.toString());
    window.dispatchEvent(new CustomEvent('arcade_coins_updated', { detail: safeCoins }));
    scheduleCloudSync();
  } catch (e) {
    console.error('Error saving arcade coins:', e);
  }
}

export function addArcadeCoins(amount: number): number {
  const current = getStoredArcadeCoins();
  const updated = current + Math.max(0, amount);
  saveStoredArcadeCoins(updated);
  return updated;
}

export function spendArcadeCoins(amount: number): boolean {
  const current = getStoredArcadeCoins();
  if (current < amount) {
    return false;
  }
  saveStoredArcadeCoins(current - amount);
  return true;
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export interface AllDailyGameRecords {
  [gameType: string]: {
    date: string;
    played: number;
    correct: number;
    bonusUnlocked: boolean;
    maxAllowed: number;
  };
}

export type ArcadeGameType = 'blur' | 'higherlower' | 'emoji' | 'shadow' | 'quotes' | string;

export function getDailyGameRecord(game: ArcadeGameType): {
  date: string;
  played: number;
  correct: number;
  bonusUnlocked: boolean;
  maxAllowed: number;
  remaining: number;
} {
  const today = getTodayKey();
  try {
    const raw = localStorage.getItem(DAILY_GAMES_RECORD_KEY);
    const records: AllDailyGameRecords = raw ? JSON.parse(raw) : {};
    const gameRec = records[game];

    if (!gameRec || gameRec.date !== today) {
      const fresh = {
        date: today,
        played: 0,
        correct: 0,
        bonusUnlocked: false,
        maxAllowed: 5,
      };
      records[game] = fresh;
      localStorage.setItem(DAILY_GAMES_RECORD_KEY, JSON.stringify(records));
      return { ...fresh, remaining: 5 };
    }

    const remaining = Math.max(0, gameRec.maxAllowed - gameRec.played);
    return { ...gameRec, remaining };
  } catch (e) {
    return {
      date: today,
      played: 0,
      correct: 0,
      bonusUnlocked: false,
      maxAllowed: 5,
      remaining: 5,
    };
  }
}

export function recordGameAttempt(
  game: ArcadeGameType,
  isCorrect: boolean
): {
  success: boolean;
  coinsAwarded: number;
  bonusJustUnlocked: boolean;
  newRecord: {
    date: string;
    played: number;
    correct: number;
    bonusUnlocked: boolean;
    maxAllowed: number;
    remaining: number;
  };
} {
  const today = getTodayKey();
  const raw = localStorage.getItem(DAILY_GAMES_RECORD_KEY);
  const records: AllDailyGameRecords = raw ? JSON.parse(raw) : {};
  let gameRec = records[game];

  if (!gameRec || gameRec.date !== today) {
    gameRec = {
      date: today,
      played: 0,
      correct: 0,
      bonusUnlocked: false,
      maxAllowed: 5,
    };
  }

  if (gameRec.played >= gameRec.maxAllowed) {
    return {
      success: false,
      coinsAwarded: 0,
      bonusJustUnlocked: false,
      newRecord: { ...gameRec, remaining: 0 },
    };
  }

  gameRec.played += 1;
  let coinsAwarded = 0;
  let bonusJustUnlocked = false;

  if (isCorrect) {
    gameRec.correct += 1;
    coinsAwarded = 1;

    if (gameRec.correct === 5 && !gameRec.bonusUnlocked) {
      gameRec.bonusUnlocked = true;
      gameRec.maxAllowed = 6;
      bonusJustUnlocked = true;
      coinsAwarded += 1;
    }

    addArcadeCoins(coinsAwarded);
  }

  records[game] = gameRec;
  try {
    localStorage.setItem(DAILY_GAMES_RECORD_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Error recording daily game attempt:', e);
  }

  const remaining = Math.max(0, gameRec.maxAllowed - gameRec.played);

  return {
    success: true,
    coinsAwarded,
    bonusJustUnlocked,
    newRecord: { ...gameRec, remaining },
  };
}

// =============================================================
// CARD AWAKENING & ACTIVE COMPANION STORAGE
// =============================================================
export function getAllCardAwakenings(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CARD_AWAKENINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function getCardAwakeningLevel(cardId: string): number {
  try {
    const map = getAllCardAwakenings();
    return map[cardId] || 1;
  } catch (e) {
    return 1;
  }
}

export function upgradeCardAwakeningLevel(cardId: string, targetLevel: number): void {
  try {
    const map = getAllCardAwakenings();
    map[cardId] = targetLevel;
    localStorage.setItem(CARD_AWAKENINGS_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('card_awakened', { detail: { cardId, level: targetLevel } }));
    scheduleCloudSync();
  } catch (e) {
    console.error('Error saving card awakening:', e);
  }
}

export function getStoredActiveCompanion(): any | null {
  try {
    const raw = localStorage.getItem(ACTIVE_COMPANION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredActiveCompanion(card: any | null): void {
  try {
    if (card) {
      localStorage.setItem(ACTIVE_COMPANION_KEY, JSON.stringify(card));
    } else {
      localStorage.removeItem(ACTIVE_COMPANION_KEY);
    }
    window.dispatchEvent(new CustomEvent('active_companion_changed', { detail: card }));
    scheduleCloudSync();
  } catch (e) {
    console.error('Error saving companion:', e);
  }
}
