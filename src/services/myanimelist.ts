import { UserMediaListItem, MediaListStatus, Anime, MALUser } from '../types';
import { apiFetch } from './apiClient';

export const MAL_CLIENT_ID = '6114d00ca681b7701d1e15004a44ba50'; // Default public MAL OAuth client ID

// Get MAL OAuth2 Authorization URL
export function getMALAuthUrl(): string {
  const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
  // PKCE / Code flow URL for MAL
  return `https://myanimelist.net/v1/oauth2/authorize?response_type=token&client_id=${MAL_CLIENT_ID}&state=mal_auth_state`;
}

// Convert MyAnimeList status string to AniLove / AniList standard MediaListStatus
export function mapMALStatusToMediaListStatus(status?: string): MediaListStatus {
  if (!status) return 'CURRENT';
  const clean = status.toLowerCase().replace(/[\s_-]/g, '');
  switch (clean) {
    case 'watching':
    case 'currentlywatching':
    case '1':
      return 'CURRENT';
    case 'completed':
    case '2':
      return 'COMPLETED';
    case 'onhold':
    case 'on_hold':
    case 'paused':
    case '3':
      return 'PAUSED';
    case 'dropped':
    case '4':
      return 'DROPPED';
    case 'plantowatch':
    case 'plan_to_watch':
    case '6':
      return 'PLANNING';
    default:
      return 'CURRENT';
  }
}

// Convert MediaListStatus to MAL status
export function mapMediaListStatusToMAL(status: MediaListStatus): string {
  switch (status) {
    case 'CURRENT':
      return 'watching';
    case 'COMPLETED':
      return 'completed';
    case 'PAUSED':
      return 'on_hold';
    case 'DROPPED':
      return 'dropped';
    case 'PLANNING':
    default:
      return 'plan_to_watch';
  }
}

// Cache for MAL user profiles & animelists
const malCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 mins

/**
 * Fetch MyAnimeList User Profile (via backend proxy or direct Jikan v4 API)
 */
export async function fetchMALUserProfile(username: string): Promise<MALUser | null> {
  const cleanUser = username.trim();
  if (!cleanUser) return null;

  const cacheKey = `mal_user_${cleanUser.toLowerCase()}`;
  const cached = malCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Strategy 1: Server proxy
  try {
    const res = await apiFetch(`/api/mal/user/${encodeURIComponent(cleanUser)}/profile`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.user) {
        malCache.set(cacheKey, { timestamp: Date.now(), data: json.user });
        return json.user;
      }
    }
  } catch (err) {
    console.warn('Backend MAL profile proxy error:', err);
  }

  // Strategy 2: Direct Jikan v4 API
  try {
    const jikanUrl = `https://api.jikan.moe/v4/users/${encodeURIComponent(cleanUser)}`;
    const res = await fetch(jikanUrl);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.data;
    if (!data) return null;

    const user: MALUser = {
      name: data.username,
      picture: data.images?.jpg?.image_url || data.images?.webp?.image_url,
      location: data.location || undefined,
      joinedAt: data.joined || undefined,
      animeStats: {
        daysWatched: data.statistics?.anime?.days_watched || 0,
        meanScore: data.statistics?.anime?.mean_score || 0,
        watching: data.statistics?.anime?.watching || 0,
        completed: data.statistics?.anime?.completed || 0,
        onHold: data.statistics?.anime?.on_hold || 0,
        dropped: data.statistics?.anime?.dropped || 0,
        planToWatch: data.statistics?.anime?.plan_to_watch || 0,
        totalEntries: data.statistics?.anime?.total_entries || 0,
        episodesWatched: data.statistics?.anime?.episodes_watched || 0,
      },
    };

    malCache.set(cacheKey, { timestamp: Date.now(), data: user });
    return user;
  } catch (err) {
    console.error('Direct Jikan MAL profile fetch error:', err);
    return null;
  }
}

/**
 * Fetch MyAnimeList User Watchlist (via backend proxy or direct Jikan v4 API)
 * Converts MAL data structure into unified UserMediaListItem format
 */
export async function fetchMALUserAnimelist(username: string): Promise<UserMediaListItem[]> {
  const cleanUser = username.trim();
  if (!cleanUser) return [];

  const cacheKey = `mal_list_${cleanUser.toLowerCase()}`;
  const cached = malCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Strategy 1: Server proxy
  try {
    const res = await apiFetch(`/api/mal/user/${encodeURIComponent(cleanUser)}/animelist`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.items) && json.items.length > 0) {
        malCache.set(cacheKey, { timestamp: Date.now(), data: json.items });
        return json.items;
      }
    }
  } catch (err) {
    console.warn('Backend MAL list proxy error, falling back to direct Jikan API:', err);
  }

  // Strategy 2: Direct Jikan v4 with pagination
  try {
    const allItems: UserMediaListItem[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= 5) {
      const url = `https://api.jikan.moe/v4/users/${encodeURIComponent(cleanUser)}/animelist?page=${page}`;
      const res = await fetch(url);
      if (!res.ok) break;

      const json = await res.json();
      const rawList = json.data || [];
      if (!Array.isArray(rawList) || rawList.length === 0) break;

      for (const item of rawList) {
        const entry = item.entry;
        if (!entry || !entry.mal_id) continue;

        const malId = entry.mal_id;
        const title = entry.title || 'Anime';
        const coverImg = entry.images?.jpg?.large_image_url || entry.images?.jpg?.image_url || '';
        const episodes = typeof item.episodes_total === 'number' && item.episodes_total > 0 ? item.episodes_total : undefined;

        const animeObj: Anime = {
          id: malId,
          idMal: malId,
          title: {
            romaji: title,
            english: title,
            userPreferred: title,
          },
          coverImage: {
            large: coverImg,
            extraLarge: coverImg,
            medium: entry.images?.jpg?.small_image_url || coverImg,
          },
          format: 'TV',
          episodes,
          status: 'FINISHED',
          genres: [],
        };

        allItems.push({
          id: malId,
          mediaId: malId,
          status: mapMALStatusToMediaListStatus(item.status || item.watching_status),
          progress: item.episodes_seen || item.num_episodes_watched || 0,
          score: item.score || 0,
          updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : Date.now(),
          media: animeObj,
        });
      }

      hasNext = Boolean(json.pagination?.has_next_page);
      page++;
      if (hasNext) {
        // Small delay to respect Jikan rate limits
        await new Promise(r => setTimeout(r, 350));
      }
    }

    if (allItems.length > 0) {
      malCache.set(cacheKey, { timestamp: Date.now(), data: allItems });
    }

    return allItems;
  } catch (err) {
    console.error('Failed to fetch user animelist from MyAnimeList:', err);
    return [];
  }
}
