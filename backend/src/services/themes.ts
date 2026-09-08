// AnimeThemes.moe API & Media Proxy Service
// Provides fast 24-hour in-memory cache and concurrent candidate searching

export const animeThemesCache = new Map<string, { data: any; timestamp: number }>();
export const THEME_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in-memory cache

export const THEME_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://animethemes.moe/',
};

export async function queryAnimeThemesFast(candidates: string[]): Promise<any> {
  const cleanCandidates = candidates
    .map(s => (s || '').trim())
    .filter((s, idx, arr) => s.length > 0 && arr.indexOf(s) === idx);

  if (cleanCandidates.length === 0) return null;

  const cacheKey = cleanCandidates.map(c => c.toLowerCase()).sort().join('|');
  const cached = animeThemesCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < THEME_CACHE_TTL) {
    return cached.data;
  }

  // Construct parallel fetch promises for all candidates simultaneously
  const fetchPromises: Promise<any>[] = [];

  for (const cand of cleanCandidates) {
    // 1. filter[name]
    const filterUrl = `https://api.animethemes.moe/anime?filter[name]=${encodeURIComponent(cand)}&include=animethemes.animethemeentries.videos.audio,animethemes.song.artists`;
    fetchPromises.push(
      fetch(filterUrl, { headers: THEME_HEADERS })
        .then(r => r.json())
        .then(data => (data.anime && data.anime.length > 0 ? data.anime[0] : null))
        .catch(() => null)
    );

    // 2. search?q=
    const searchUrl = `https://api.animethemes.moe/search?q=${encodeURIComponent(cand)}&include[anime]=animethemes.animethemeentries.videos.audio,animethemes.song.artists`;
    fetchPromises.push(
      fetch(searchUrl, { headers: THEME_HEADERS })
        .then(r => r.json())
        .then(data => (data.search?.anime && data.search.anime.length > 0 ? data.search.anime[0] : null))
        .catch(() => null)
    );
  }

  const results = await Promise.all(fetchPromises);
  const foundAnime = results.find(item => item && item.animethemes && item.animethemes.length > 0) || results.find(item => item !== null) || null;

  if (foundAnime) {
    animeThemesCache.set(cacheKey, { data: foundAnime, timestamp: Date.now() });
    cleanCandidates.forEach(cand => {
      animeThemesCache.set(cand.toLowerCase(), { data: foundAnime, timestamp: Date.now() });
    });
  }

  return foundAnime;
}
