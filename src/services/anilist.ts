import { Anime, AnimeDetail, AiringScheduleItem, AniListUser, MediaListStatus, UserMediaListItem } from '../types';

export const ANILIST_API_URL = 'https://graphql.anilist.co';
export const ANILIST_CLIENT_ID = '50555';

export function extractAniListToken(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.includes('access_token=')) {
    const match = trimmed.match(/access_token=([^&]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return trimmed;
}

export function getAniListAuthUrl(): string {
  // Implicit grant flow using configured AniList Client ID
  return `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_CLIENT_ID}&response_type=token`;
}

export const getOAuthLoginUrl = getAniListAuthUrl;

export function parseOAuthTokenFromHash(): string | null {
  if (!window.location.hash) return null;
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

export function sanitizeDescription(raw?: string): string {
  if (!raw) return 'No synopsis available for this title.';
  return raw
    .replace(/~!\s*([\s\S]*?)\s*!~/g, '$1') // remove spoiler tags but preserve text
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/__|\*\*|\*|~~/g, '')
    .trim();
}

export function getCurrentSeasonAndYear(): { season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'; year: number } {
  const date = new Date();
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  
  if (month >= 0 && month <= 2) return { season: 'WINTER', year };
  if (month >= 3 && month <= 5) return { season: 'SPRING', year };
  if (month >= 6 && month <= 8) return { season: 'SUMMER', year };
  return { season: 'FALL', year };
}

const MEDIA_CARD_FRAGMENT = `
  id
  idMal
  title {
    romaji
    english
    native
    userPreferred
  }
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  format
  episodes
  duration
  status
  season
  seasonYear
  averageScore
  meanScore
  popularity
  genres
  description
  source
  studios(isMain: true) {
    nodes {
      id
      name
      isAnimationStudio
    }
  }
  startDate {
    year
    month
    day
  }
  nextAiringEpisode {
    id
    episode
    airingAt
    timeUntilAiring
  }
  trailer {
    id
    site
    thumbnail
  }
  siteUrl
`;

const memoryCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes fresh cache

function getCacheKey(query: string, variables: Record<string, any> = {}, accessToken?: string | null): string {
  return `${accessToken || 'anon'}::${query.replace(/\s+/g, ' ').trim()}::${JSON.stringify(variables)}`;
}

function getFromCache<T>(key: string, allowStale: boolean = false): T | null {
  const cached = memoryCache.get(key);
  if (cached) {
    const isFresh = Date.now() - cached.timestamp < CACHE_TTL_MS;
    if (isFresh || allowStale) {
      return cached.data as T;
    }
  }
  try {
    const stored = localStorage.getItem(`anilist_cache_${key}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      const isFresh = Date.now() - parsed.timestamp < CACHE_TTL_MS;
      if (isFresh || allowStale) {
        memoryCache.set(key, parsed);
        return parsed.data as T;
      }
    }
  } catch (e) {
    // Ignore storage errors
  }
  return null;
}

function saveToCache<T>(key: string, data: T) {
  const entry = { timestamp: Date.now(), data };
  memoryCache.set(key, entry);
  try {
    localStorage.setItem(`anilist_cache_${key}`, JSON.stringify(entry));
  } catch (e) {
    // Ignore storage quota errors
  }
}

export async function executeQuery<T>(
  query: string,
  variables: Record<string, any> = {},
  accessToken?: string | null,
  retriesLeft: number = 2
): Promise<T> {
  const isMutation = query.trim().startsWith('mutation');
  const cacheKey = getCacheKey(query, variables, accessToken);

  if (!isMutation) {
    const freshCached = getFromCache<T>(cacheKey, false);
    if (freshCached) {
      return freshCached;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429) {
      console.warn('AniList rate limit (429) encountered.');
      if (!isMutation) {
        const stale = getFromCache<T>(cacheKey, true);
        if (stale) {
          console.info('Serving cached data under rate-limit protection.');
          return stale;
        }
      }

      if (retriesLeft > 0) {
        const delay = 2000 * (3 - retriesLeft);
        await new Promise(r => setTimeout(r, delay));
        return executeQuery<T>(query, variables, accessToken, retriesLeft - 1);
      }
    }

    const json = await response.json().catch(() => null);

    if (!response.ok || (json && json.errors && json.errors.length > 0)) {
      const errorMsg = json?.errors?.map((e: any) => e.message).join(', ') || `HTTP ${response.status} Error`;

      if (!isMutation) {
        const stale = getFromCache<T>(cacheKey, true);
        if (stale) {
          console.warn('Serving cached fallback after error:', errorMsg);
          return stale;
        }
      }

      if (response.status === 429 && retriesLeft > 0) {
        await new Promise(r => setTimeout(r, 2000));
        return executeQuery<T>(query, variables, accessToken, retriesLeft - 1);
      }

      throw new Error(errorMsg || 'AniList GraphQL Error');
    }

    if (json?.data && !isMutation) {
      saveToCache(cacheKey, json.data);
    }

    return json.data as T;
  } catch (error: any) {
    if (!isMutation) {
      const stale = getFromCache<T>(cacheKey, true);
      if (stale) {
        return stale;
      }
    }
    throw error;
  }
}

export interface HomeFeedData {
  trending: Anime[];
  popular: Anime[];
  topRated: Anime[];
  newest: Anime[];
  upcoming: Anime[];
  movies: Anime[];
  action: Anime[];
  fantasy: Anime[];
  romcom: Anime[];
}

export async function fetchHomeFeed(perPage: number = 24): Promise<HomeFeedData> {
  const query = `
    query ($perPage: Int) {
      trending: Page (page: 1, perPage: $perPage) {
        media (sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
      popular: Page (page: 1, perPage: $perPage) {
        media (sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
      topRated: Page (page: 1, perPage: $perPage) {
        media (sort: SCORE_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
      newest: Page (page: 1, perPage: $perPage) {
        media (sort: START_DATE_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
      upcoming: Page (page: 1, perPage: $perPage) {
        media (status: NOT_YET_RELEASED, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
      movies: Page (page: 1, perPage: $perPage) {
        media (format: MOVIE, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
      action: Page (page: 1, perPage: $perPage) {
        media (genre: "Action", sort: SCORE_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
      fantasy: Page (page: 1, perPage: $perPage) {
        media (genre: "Fantasy", sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
      romcom: Page (page: 1, perPage: $perPage) {
        media (genre_in: ["Romance", "Comedy"], sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;

  try {
    const data = await executeQuery<{
      trending: { media: Anime[] };
      popular: { media: Anime[] };
      topRated: { media: Anime[] };
      newest: { media: Anime[] };
      upcoming: { media: Anime[] };
      movies: { media: Anime[] };
      action: { media: Anime[] };
      fantasy: { media: Anime[] };
      romcom: { media: Anime[] };
    }>(query, { perPage });

    return {
      trending: data.trending?.media || [],
      popular: data.popular?.media || [],
      topRated: data.topRated?.media || [],
      newest: data.newest?.media || [],
      upcoming: data.upcoming?.media || [],
      movies: data.movies?.media || [],
      action: data.action?.media || [],
      fantasy: data.fantasy?.media || [],
      romcom: data.romcom?.media || [],
    };
  } catch (err) {
    console.warn('fetchHomeFeed encountered error, attempting resilient recovery:', err);
    // If combined query has issues, attempt fallback to individual getters with settle
    const [trending, popular, topRated, newest, upcoming, movies, action, fantasy, romcom] = await Promise.allSettled([
      fetchTrendingAnime(1, perPage),
      fetchPopularAnime(1, perPage),
      fetchTopRatedAnime(1, perPage),
      fetchNewestAnime(1, perPage),
      fetchUpcomingAnime(1, perPage),
      fetchTopMoviesAnime(1, perPage),
      fetchGenreAnime('Action', 'SCORE_DESC', 1, perPage),
      fetchGenreAnime('Fantasy', 'POPULARITY_DESC', 1, perPage),
      fetchRomComAnime(1, perPage),
    ]);

    return {
      trending: trending.status === 'fulfilled' ? trending.value : [],
      popular: popular.status === 'fulfilled' ? popular.value : [],
      topRated: topRated.status === 'fulfilled' ? topRated.value : [],
      newest: newest.status === 'fulfilled' ? newest.value : [],
      upcoming: upcoming.status === 'fulfilled' ? upcoming.value : [],
      movies: movies.status === 'fulfilled' ? movies.value : [],
      action: action.status === 'fulfilled' ? action.value : [],
      fantasy: fantasy.status === 'fulfilled' ? fantasy.value : [],
      romcom: romcom.status === 'fulfilled' ? romcom.value : [],
    };
  }
}

export async function fetchTrendingAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;
  const data = await executeQuery<{ Page: { media: Anime[] } }>(query, { page, perPage });
  return data.Page.media;
}

export async function fetchPopularAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;
  const data = await executeQuery<{ Page: { media: Anime[] } }>(query, { page, perPage });
  return data.Page.media;
}

export const fetchPopularSeason = fetchPopularAnime;

export async function fetchTopRatedAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (sort: SCORE_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;
  const data = await executeQuery<{ Page: { media: Anime[] } }>(query, { page, perPage });
  return data.Page.media;
}

export async function fetchNewestAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (sort: START_DATE_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;
  const data = await executeQuery<{ Page: { media: Anime[] } }>(query, { page, perPage });
  return data.Page.media;
}

export async function fetchUpcomingAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (status: NOT_YET_RELEASED, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;
  const data = await executeQuery<{ Page: { media: Anime[] } }>(query, { page, perPage });
  return data.Page.media;
}

export async function fetchTopMoviesAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (format: MOVIE, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;
  const data = await executeQuery<{ Page: { media: Anime[] } }>(query, { page, perPage });
  return data.Page.media;
}

export async function fetchGenreAnime(genre: string, sort: string = 'POPULARITY_DESC', page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const query = `
    query ($genre: String, $sort: [MediaSort], $page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (genre: $genre, sort: $sort, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;
  const data = await executeQuery<{ Page: { media: Anime[] } }>(query, { genre, sort: [sort], page, perPage });
  return data.Page.media;
}

/**
 * High-diversity anime pool fetcher for Arcade Mini-Games (Blur Guesser, Higher or Lower, Emoji Cipher)
 * Dynamically queries random pages across genres, popularity, and top rated catalogs
 * to ensure that users encounter fresh, unique anime every single game even after weeks of play.
 */
export async function fetchVastArcadeAnimePool(): Promise<Anime[]> {
  const allGenres = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
    'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological',
    'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
  ];

  // Pick 3 random distinct genres for variety
  const shuffledGenres = [...allGenres].sort(() => Math.random() - 0.5).slice(0, 3);
  
  // Pick random page offsets (between 1 and 8)
  const randomPopPage = Math.floor(Math.random() * 6) + 1;
  const randomScorePage = Math.floor(Math.random() * 6) + 1;
  const randomTrendingPage = Math.floor(Math.random() * 4) + 1;
  const randomGenrePage = Math.floor(Math.random() * 4) + 1;

  try {
    const results = await Promise.allSettled([
      fetchTrendingAnime(randomTrendingPage, 50),
      searchAnimeAdvanced({ sort: 'POPULARITY_DESC', page: randomPopPage, perPage: 50 }),
      searchAnimeAdvanced({ sort: 'SCORE_DESC', page: randomScorePage, perPage: 50 }),
      fetchGenreAnime(shuffledGenres[0], 'POPULARITY_DESC', randomGenrePage, 40),
      fetchGenreAnime(shuffledGenres[1], 'SCORE_DESC', randomGenrePage, 40),
    ]);

    const combined: Anime[] = [];
    const seenIds = new Set<number>();

    results.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        res.value.forEach(anime => {
          if (
            anime &&
            anime.id &&
            !seenIds.has(anime.id) &&
            (anime.coverImage?.large || anime.coverImage?.extraLarge || anime.bannerImage)
          ) {
            seenIds.add(anime.id);
            combined.push(anime);
          }
        });
      }
    });

    // Thorough Fisher-Yates shuffle
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }

    return combined;
  } catch (err) {
    console.warn('Failed to fetch vast arcade pool, falling back to standard trending:', err);
    return fetchTrendingAnime(1, 50);
  }
}

export async function fetchRomComAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (genre_in: ["Romance", "Comedy"], sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;
  const data = await executeQuery<{ Page: { media: Anime[] } }>(query, { page, perPage });
  return data.Page.media;
}

export async function fetchSeasonalAnime(
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL',
  seasonYear: number,
  format?: string,
  sort: string = 'POPULARITY_DESC',
  page: number = 1,
  perPage: number = 36
): Promise<Anime[]> {
  const query = `
    query ($season: MediaSeason, $seasonYear: Int, $format: MediaFormat, $sort: [MediaSort], $page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (season: $season, seasonYear: $seasonYear, format: $format, sort: $sort, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;

  const variables: Record<string, any> = {
    season,
    seasonYear,
    sort: [sort],
    page,
    perPage,
  };

  if (format && format !== 'All') {
    variables.format = format;
  }

  const data = await executeQuery<{ Page: { media: Anime[] } }>(query, variables);
  return data.Page.media;
}

export async function searchAnimeAdvanced({
  search,
  genres = [],
  status,
  format,
  seasonYear,
  sort = 'POPULARITY_DESC',
  page = 1,
  perPage = 36,
}: {
  search?: string;
  genres?: string[];
  status?: string;
  format?: string;
  seasonYear?: number;
  sort?: string;
  page?: number;
  perPage?: number;
}): Promise<Anime[]> {
  const query = `
    query ($search: String, $genre_in: [String], $status: MediaStatus, $format: MediaFormat, $seasonYear: Int, $sort: [MediaSort], $page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (search: $search, genre_in: $genre_in, status: $status, format: $format, seasonYear: $seasonYear, sort: $sort, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;

  const variables: Record<string, any> = {
    page,
    perPage,
    sort: search && search.trim() ? ['SEARCH_MATCH'] : [sort],
  };

  if (search && search.trim()) variables.search = search.trim();
  if (genres && genres.length > 0 && !genres.includes('All')) variables.genre_in = genres;
  if (status && status !== 'All') variables.status = status;
  if (format && format !== 'All') variables.format = format;
  if (seasonYear && seasonYear > 0) variables.seasonYear = seasonYear;

  const data = await executeQuery<{ Page: { media: Anime[] } }>(query, variables);
  return data.Page.media;
}

export async function searchAnime(
  queryOrOptions: string | { search?: string; genre?: string; status?: string; sort?: string; page?: number; perPage?: number },
  page: number = 1,
  perPage: number = 24,
  genre?: string,
  status?: string
): Promise<Anime[]> {
  let searchStr: string | undefined;
  let genreVal: string | undefined = genre;
  let statusVal: string | undefined = status;
  let pageVal: number = page;
  let perPageVal: number = perPage;

  if (typeof queryOrOptions === 'object') {
    searchStr = queryOrOptions.search;
    genreVal = queryOrOptions.genre;
    statusVal = queryOrOptions.status;
    pageVal = queryOrOptions.page || 1;
    perPageVal = queryOrOptions.perPage || 24;
  } else {
    searchStr = queryOrOptions;
  }

  const query = `
    query ($search: String, $genre: String, $status: MediaStatus, $sort: [MediaSort], $page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (search: $search, genre: $genre, status: $status, sort: $sort, type: ANIME, isAdult: false) {
          ${MEDIA_CARD_FRAGMENT}
        }
      }
    }
  `;

  const variables: Record<string, any> = {
    page: pageVal,
    perPage: perPageVal,
    sort: searchStr && searchStr.trim() ? ['SEARCH_MATCH'] : ['POPULARITY_DESC'],
  };

  if (searchStr && searchStr.trim()) variables.search = searchStr.trim();
  if (genreVal && genreVal !== 'All') variables.genre = genreVal;
  if (statusVal && statusVal !== 'All') variables.status = statusVal;

  const data = await executeQuery<{ Page: { media: Anime[] } }>(query, variables);
  return data.Page.media;
}

export async function fetchAiringSchedule(airingAt_greater: number, airingAt_lesser: number): Promise<AiringScheduleItem[]> {
  const query = `
    query ($airingAt_greater: Int, $airingAt_lesser: Int, $page: Int) {
      Page (page: $page, perPage: 50) {
        pageInfo {
          hasNextPage
          currentPage
        }
        airingSchedules (airingAt_greater: $airingAt_greater, airingAt_lesser: $airingAt_lesser, sort: TIME) {
          id
          episode
          airingAt
          timeUntilAiring
          media {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    }
  `;

  let allSchedules: AiringScheduleItem[] = [];
  let page = 1;
  let hasNextPage = true;
  const maxPages = 8; // Fetch up to 400 airing schedule entries across the week

  while (hasNextPage && page <= maxPages) {
    try {
      const data = await executeQuery<{
        Page: {
          pageInfo?: { hasNextPage: boolean };
          airingSchedules: AiringScheduleItem[];
        };
      }>(query, {
        airingAt_greater,
        airingAt_lesser,
        page,
      });

      const items = data.Page?.airingSchedules || [];
      const validItems = items.filter(item => item.media && !item.media.isAdult);
      allSchedules = allSchedules.concat(validItems);

      hasNextPage = Boolean(data.Page?.pageInfo?.hasNextPage) && items.length >= 50;
      page++;
    } catch (err) {
      console.error(`Error fetching airing schedule page ${page}:`, err);
      break;
    }
  }

  // Deduplicate entries by unique ID or media ID + episode
  const seenIds = new Set<string>();
  return allSchedules.filter(item => {
    const key = `${item.id || item.media?.id}-${item.episode}`;
    if (seenIds.has(key)) return false;
    seenIds.add(key);
    return true;
  });
}

export async function fetchAnimeDetails(id: number): Promise<AnimeDetail> {
  const query = `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
        ${MEDIA_CARD_FRAGMENT}
        relations {
          edges {
            relationType
            node {
              ${MEDIA_CARD_FRAGMENT}
            }
          }
        }
        recommendations (sort: RATING_DESC, perPage: 24) {
          nodes {
            id
            rating
            mediaRecommendation {
              ${MEDIA_CARD_FRAGMENT}
            }
          }
        }
        characters (sort: ROLE, perPage: 12) {
          edges {
            role
            node {
              id
              name {
                full
                native
              }
              image {
                large
                medium
              }
            }
            voiceActors (language: JAPANESE) {
              id
              name {
                full
                native
              }
              image {
                large
                medium
              }
              language
            }
          }
        }
        externalLinks {
          id
          url
          site
          icon
          color
        }
        streamingEpisodes {
          title
          thumbnail
          url
          site
        }
      }
    }
  `;
  const data = await executeQuery<{ Media: AnimeDetail }>(query, { id });
  return data.Media;
}

export async function fetchAnimeByStudio(studioName: string, page: number = 1, perPage: number = 40): Promise<Anime[]> {
  const cleanName = studioName.trim();
  if (!cleanName) return [];

  // Strategy 1: Search studios list via Page
  const pageStudioQuery = `
    query ($studio: String, $perPage: Int) {
      Page (page: 1, perPage: 10) {
        studios (search: $studio, sort: SEARCH_MATCH) {
          id
          name
          isAnimationStudio
          media (sort: [SCORE_DESC, POPULARITY_DESC], type: ANIME, isAdult: false, perPage: $perPage) {
            nodes {
              ${MEDIA_CARD_FRAGMENT}
            }
          }
        }
      }
    }
  `;

  try {
    const data = await executeQuery<{
      Page?: {
        studios?: {
          id: number;
          name: string;
          isAnimationStudio?: boolean;
          media?: {
            nodes: Anime[];
          };
        }[];
      };
    }>(pageStudioQuery, { studio: cleanName, perPage });

    const studios = data.Page?.studios || [];
    const mediaMap = new Map<number, Anime>();
    for (const st of studios) {
      st.media?.nodes?.forEach(m => {
        if (!mediaMap.has(m.id)) {
          mediaMap.set(m.id, m);
        }
      });
    }
    if (mediaMap.size > 0) {
      const list = Array.from(mediaMap.values());
      list.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
      return list;
    }
  } catch (err) {
    console.warn(`Page studios search query failed for "${cleanName}":`, err);
  }

  // Strategy 2: Search direct Studio by name
  const singleStudioQuery = `
    query ($studio: String, $page: Int, $perPage: Int) {
      Studio (search: $studio) {
        id
        name
        isAnimationStudio
        media (sort: [SCORE_DESC, POPULARITY_DESC], type: ANIME, isAdult: false, page: $page, perPage: $perPage) {
          nodes {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    }
  `;

  try {
    const data = await executeQuery<{
      Studio?: {
        id: number;
        name: string;
        media?: {
          nodes: Anime[];
        };
      };
    }>(singleStudioQuery, { studio: cleanName, page, perPage });

    if (data.Studio?.media?.nodes && data.Studio.media.nodes.length > 0) {
      const list = [...data.Studio.media.nodes];
      list.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
      return list;
    }
  } catch (err) {
    console.warn(`Single Studio search failed for "${cleanName}":`, err);
  }

  // Strategy 3: Fallback to keyword media search
  try {
    const fallbackSearch = await searchAnimeAdvanced({ search: cleanName, sort: 'SCORE_DESC', page: 1, perPage });
    return fallbackSearch;
  } catch (err) {
    console.error(`All studio search strategies failed for "${cleanName}":`, err);
    return [];
  }
}

// Option 1: One-Time Playlist Import (Static Copy · No Login · No Sync)
export async function fetchUserAnimeList(username: string): Promise<UserMediaListItem[]> {
  const query = `
    query ($username: String) {
      MediaListCollection (userName: $username, type: ANIME) {
        lists {
          name
          isCustomList
          status
          entries {
            id
            mediaId
            status
            progress
            score(format: POINT_10_DECIMAL)
            updatedAt
            media {
              ${MEDIA_CARD_FRAGMENT}
            }
          }
        }
      }
    }
  `;

  const data = await executeQuery<{
    MediaListCollection: {
      lists: {
        name: string;
        isCustomList: boolean;
        status: MediaListStatus;
        entries: UserMediaListItem[];
      }[];
    };
  }>(query, { username });

  const allEntries: UserMediaListItem[] = [];
  const seenMediaIds = new Set<number>();

  data.MediaListCollection.lists.forEach(list => {
    list.entries.forEach(entry => {
      if (!seenMediaIds.has(entry.mediaId)) {
        seenMediaIds.add(entry.mediaId);
        allEntries.push({
          id: entry.id,
          mediaId: entry.mediaId,
          status: entry.status || list.status || 'CURRENT',
          progress: entry.progress || 0,
          score: entry.score || 0,
          updatedAt: entry.updatedAt || Date.now(),
          media: entry.media,
        });
      }
    });
  });

  return allEntries;
}

// Fetch Public AniList User Profile by Username (No Token Required)
export async function fetchAniListUserProfile(username: string): Promise<AniListUser> {
  const query = `
    query ($username: String) {
      User (name: $username) {
        id
        name
        avatar {
          large
          medium
        }
        bannerImage
        statistics {
          anime {
            count
            meanScore
            minutesWatched
            episodesWatched
          }
        }
      }
    }
  `;
  const data = await executeQuery<{ User: AniListUser }>(query, { username });
  return data.User;
}

export const fetchUserMediaList = fetchUserAnimeList;

// Option 2: Authenticated Two-Way Cloud Sync
export async function fetchAuthenticatedViewer(accessToken: string): Promise<AniListUser> {
  const query = `
    query {
      Viewer {
        id
        name
        avatar {
          large
          medium
        }
        bannerImage
        statistics {
          anime {
            count
            meanScore
            minutesWatched
            episodesWatched
          }
        }
      }
    }
  `;
  const data = await executeQuery<{ Viewer: AniListUser }>(query, {}, accessToken);
  return data.Viewer;
}

export const fetchViewerProfile = fetchAuthenticatedViewer;

export async function syncMediaListEntryToAniList(
  accessToken: string,
  mediaId: number,
  status?: MediaListStatus,
  progress?: number,
  score?: number,
  id?: number
): Promise<{ id: number; status: MediaListStatus; progress: number; score: number }> {
  const mutation = `
    mutation ($id: Int, $mediaId: Int, $status: MediaListStatus, $progress: Int, $score: Float) {
      SaveMediaListEntry (id: $id, mediaId: $mediaId, status: $status, progress: $progress, score: $score) {
        id
        mediaId
        status
        progress
        score
      }
    }
  `;
  const data = await executeQuery<{
    SaveMediaListEntry: {
      id: number;
      mediaId: number;
      status: MediaListStatus;
      progress: number;
      score: number;
    };
  }>(mutation, { id, mediaId, status, progress, score }, accessToken);

  return data.SaveMediaListEntry;
}

export const saveMediaListEntry = (
  accessToken: string,
  variables: { mediaId: number; status?: MediaListStatus; progress?: number; score?: number; id?: number }
) => syncMediaListEntryToAniList(accessToken, variables.mediaId, variables.status, variables.progress, variables.score, variables.id);

export async function deleteMediaListEntry(accessToken: string, id: number): Promise<boolean> {
  const mutation = `
    mutation ($id: Int) {
      DeleteMediaListEntry (id: $id) {
        deleted
      }
    }
  `;
  const data = await executeQuery<{ DeleteMediaListEntry: { deleted: boolean } }>(mutation, { id }, accessToken);
  return data.DeleteMediaListEntry.deleted;
}
