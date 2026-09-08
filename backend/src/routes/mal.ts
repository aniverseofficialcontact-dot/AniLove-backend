import { Router } from 'express';

const router = Router();

export const malCacheStore = new Map<string, { timestamp: number; data: any }>();
export const MAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export function mapMALStatusToMediaListStatus(malStatus: string | number): string {
  const s = String(malStatus || '').toLowerCase().trim();
  switch (s) {
    case 'watching':
    case '1':
      return 'CURRENT';
    case 'completed':
    case '2':
      return 'COMPLETED';
    case 'on_hold':
    case 'onhold':
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

// MAL User Profile
router.get('/mal/user/:username/profile', async (req, res) => {
  try {
    const username = String(req.params.username || '').trim();
    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const cacheKey = `mal_prof_${username.toLowerCase()}`;
    const cached = malCacheStore.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MAL_CACHE_TTL) {
      res.json({ success: true, user: cached.data });
      return;
    }

    const jikanUrl = `https://api.jikan.moe/v4/users/${encodeURIComponent(username)}`;
    const response = await fetch(jikanUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AniLove/4.0',
      },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `MyAnimeList user '${username}' not found or service busy.` });
      return;
    }

    const json = await response.json();
    const data = json?.data;
    if (!data) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    const userObj = {
      id: data.mal_id,
      name: data.username,
      picture: data.images?.jpg?.image_url || data.images?.webp?.image_url,
      location: data.location || null,
      joinedAt: data.joined || null,
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

    malCacheStore.set(cacheKey, { timestamp: Date.now(), data: userObj });
    res.json({ success: true, user: userObj });
  } catch (err: any) {
    console.error('MAL profile fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch MyAnimeList profile' });
  }
});

// MAL User Anime Watchlist
router.get('/mal/user/:username/animelist', async (req, res) => {
  try {
    const username = String(req.params.username || '').trim();
    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const cacheKey = `mal_list_${username.toLowerCase()}`;
    const cached = malCacheStore.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MAL_CACHE_TTL) {
      res.json({ success: true, count: cached.data.length, items: cached.data });
      return;
    }

    const allItems: any[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= 4) {
      const jikanUrl = `https://api.jikan.moe/v4/users/${encodeURIComponent(username)}/animelist?page=${page}`;
      const response = await fetch(jikanUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniLove/4.0',
        },
      });

      if (!response.ok) break;

      const json = await response.json();
      const rawList = json?.data || [];
      if (!Array.isArray(rawList) || rawList.length === 0) break;

      for (const item of rawList) {
        const entry = item.entry;
        if (!entry || !entry.mal_id) continue;

        const malId = entry.mal_id;
        const title = entry.title || 'Anime';
        const coverImg = entry.images?.jpg?.large_image_url || entry.images?.jpg?.image_url || '';
        const eps = typeof item.episodes_total === 'number' && item.episodes_total > 0 ? item.episodes_total : undefined;

        allItems.push({
          id: malId,
          mediaId: malId,
          status: mapMALStatusToMediaListStatus(item.status || item.watching_status),
          progress: item.episodes_seen || item.num_episodes_watched || 0,
          score: item.score || 0,
          updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : Date.now(),
          media: {
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
            episodes: eps,
            status: 'FINISHED',
            genres: [],
          },
        });
      }

      hasNext = Boolean(json?.pagination?.has_next_page);
      page++;
      if (hasNext) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    if (allItems.length > 0) {
      malCacheStore.set(cacheKey, { timestamp: Date.now(), data: allItems });
    }

    res.json({ success: true, count: allItems.length, items: allItems });
  } catch (err: any) {
    console.error('MAL animelist fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch MyAnimeList animelist' });
  }
});

// MAL 2-Way Sync / Update Media List Entry
router.post('/mal/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const { animeId, status, numWatchedEpisodes, score } = req.body || {};

    if (!animeId) {
      res.status(400).json({ error: 'animeId is required' });
      return;
    }

    if (token) {
      const bodyParams = new URLSearchParams();
      if (status) bodyParams.append('status', status);
      if (typeof numWatchedEpisodes === 'number') bodyParams.append('num_watched_episodes', String(numWatchedEpisodes));
      if (typeof score === 'number') bodyParams.append('score', String(score));

      const malRes = await fetch(`https://api.myanimelist.net/v2/anime/${animeId}/my_list_status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      if (!malRes.ok) {
        const errData = await malRes.json().catch(() => ({}));
        console.warn('MAL API update response not ok:', errData);
      }
    }

    res.json({ success: true, updated: { animeId, status, numWatchedEpisodes, score } });
  } catch (err: any) {
    console.error('MAL sync error:', err);
    res.status(500).json({ error: err.message || 'Failed to sync to MyAnimeList' });
  }
});

export default router;
