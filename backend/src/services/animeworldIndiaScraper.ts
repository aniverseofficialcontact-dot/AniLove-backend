/**
 * AnimeWorld India & Regional Indian Multi-Audio Scraper
 *
 * Scrapes WatchAnimeWorld / AnimeSalt / Zephyrix for Hindi, Tamil, Telugu,
 * Malayalam, Bengali, English Dub and Japanese Sub streams.
 *
 * Provides embed player URLs for seamless WebView playback and direct master .m3u8 for downloads.
 */

import { extractDirectStreamFromEmbed } from './directVideoResolver';

export interface IndianAnimeSearchResult {
  id: string;
  title: string;
  url: string;
  poster?: string;
  languages: string[];
  type?: string;
}

export interface ResolveIndianStreamResult {
  success: boolean;
  streamUrl?: string;
  directStreamUrl?: string | null;
  embedUrl?: string;
  subtitleUrl?: string | null;
  isDirectVideo?: boolean;
  availableServers?: Array<{ name: string; type: string; linkId: string }>;
  availableLanguages?: string[];
  selectedServer?: string;
  language?: string;
  requestedLanguage?: string;
  actualLanguage?: string;
  provider?: string;
  error?: string;
  status?: number;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
};

// Search domains in priority order
const SEARCH_DOMAINS = [
  'https://watchanimeworld.one',
  'https://watchanimeworld.top',
  'https://animeworld-india.me',
  'https://animesalt.top',
];

/**
 * Maps anime seasons to specific ARC keywords used on Indian sites
 */
const ARC_KEYWORDS: Record<string, Record<number, string[]>> = {
  'demon slayer': {
    1: ['tanjiro kamado', 'unwavering resolve'],
    2: ['mugen train', 'entertainment district', 'yukaku'],
    3: ['swordsmith village', 'katanakaji'],
    4: ['hashira training', 'hashira']
  },
  'jujutsu kaisen': {
    1: ['curse', 'season 1'],
    2: ['hidden inventory', 'shibuya', 'kaikyu', 'season 2', '2nd season']
  },
  'attack on titan': {
    1: ['season 1'],
    2: ['season 2'],
    3: ['season 3'],
    4: ['final season', 'the final season', 'season 4']
  },
  'my hero academia': {
    1: ['season 1'],
    2: ['season 2'],
    3: ['season 3'],
    4: ['season 4'],
    5: ['season 5'],
    6: ['season 6'],
    7: ['season 7']
  },
  'dr stone': {
    1: ['season 1'],
    2: ['stone wars', 'season 2'],
    3: ['new world', 'season 3'],
    4: ['science future', 'season 4']
  },
  'bleach': {
    1: ['bleach'],
    2: ['thousand year blood war', 'tybw']
  },
  'solo leveling': {
    1: ['season 1', 'solo leveling'],
    2: ['season 2', 'arise from the shadow']
  },
  'spy x family': {
    1: ['season 1', 'part 1', 'part 2'],
    2: ['season 2']
  }
};

/**
 * Normalizes title string for search comparison
 */
function cleanTitle(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects season number from title or explicit season
 */
function detectSeason(title: string, explicitSeason?: number): number {
  if (explicitSeason && explicitSeason > 0) return explicitSeason;
  const clean = cleanTitle(title);

  const sm = clean.match(/season\s*(\d+)/i) || 
             clean.match(/(\d+)(?:st|nd|rd|th)\s*season/i) || 
             clean.match(/\bs(\d+)\b/i) || 
             clean.match(/part\s*(\d+)/i);
  if (sm) return parseInt(sm[1], 10);

  for (const [animeKey, seasons] of Object.entries(ARC_KEYWORDS)) {
    if (clean.includes(animeKey)) {
      for (const [sNumStr, keywords] of Object.entries(seasons)) {
        const sNum = parseInt(sNumStr, 10);
        if (keywords.some(k => clean.includes(k))) {
          return sNum;
        }
      }
    }
  }

  return 1;
}

/**
 * Generates base search query variations from raw titles
 */
function getBaseSearchQueries(rawTitles: string[], isMovie: boolean): string[] {
  const queries = new Set<string>();
  for (const raw of rawTitles) {
    if (!raw) continue;
    // Extract base name BEFORE removing punctuation
    const rawBase = raw.split(/[:\-\–\—\;]/)[0].trim();
    const cleanBase = cleanTitle(rawBase)
      .replace(/\s*season\s*\d+/gi, '')
      .replace(/\s*\d+(?:st|nd|rd|th)\s*season/gi, '')
      .replace(/\s*arc\b/gi, '')
      .replace(/\s*movie\b/gi, '')
      .trim();

    if (cleanBase.length >= 3) queries.add(cleanBase);

    const fullClean = cleanTitle(raw)
      .replace(/\s*season\s*\d+/gi, '')
      .replace(/\s*part\s*\d+/gi, '')
      .replace(/\s*arc\b/gi, '')
      .replace(/\s*the movie\b/gi, '')
      .trim();
    if (fullClean.length >= 3) queries.add(fullClean);

    if (isMovie && cleanBase.length >= 3) {
      queries.add(`${cleanBase} movie`);
    }

    queries.add(cleanTitle(raw));
  }
  return Array.from(queries);
}

/**
 * Extracts language tags from title or tags string
 */
export function detectLanguages(text: string): string[] {
  const upper = (text || '').toUpperCase();
  const langs: Set<string> = new Set();

  if (upper.includes('HINDI') || upper.includes('HIN') || upper.includes('हिन्दी')) langs.add('HIN');
  if (upper.includes('TAMIL') || upper.includes('TAM') || upper.includes('தமிழ்')) langs.add('TAM');
  if (upper.includes('TELUGU') || upper.includes('TEL') || upper.includes('తెలుగు')) langs.add('TEL');
  if (upper.includes('MALAYALAM') || upper.includes('MAL') || upper.includes('മലയാളം')) langs.add('MAL');
  if (upper.includes('BENGALI') || upper.includes('BEN') || upper.includes('বাংলা')) langs.add('BEN');
  if (upper.includes('ENGLISH') || upper.includes('ENG') || upper.includes('DUB')) langs.add('DUB');
  if (upper.includes('JAPANESE') || upper.includes('JAP') || upper.includes('SUB')) langs.add('SUB');
  if (upper.includes('MULTI') || upper.includes('DUAL')) {
    langs.add('HIN');
    langs.add('TAM');
    langs.add('TEL');
    langs.add('DUB');
    langs.add('SUB');
  }

  if (langs.size === 0) {
    langs.add('HIN');
    langs.add('TAM');
    langs.add('TEL');
    langs.add('MAL');
    langs.add('BEN');
    langs.add('DUB');
    langs.add('SUB');
  }
  return Array.from(langs);
}

/**
 * Searches WatchAnimeWorld / AnimeWorld India for matching anime
 */
export async function searchIndianAnime(query: string): Promise<IndianAnimeSearchResult[]> {
  const results: IndianAnimeSearchResult[] = [];
  const cleanQ = cleanTitle(query);
  if (!cleanQ) return results;

  for (const base of SEARCH_DOMAINS) {
    try {
      const searchUrl = `${base}/?s=${encodeURIComponent(cleanQ)}`;
      const res = await fetch(searchUrl, {
        headers: { ...HEADERS, Referer: `${base}/` },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;
      const html = await res.text();

      // Matches series or movies links
      const linkRegex = /<a\s+[^>]*href=["'](https?:\/\/[^"']*(?:\/series\/|\/movies?\/|\/anime\/)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const itemUrl = match[1];
        const innerContent = match[2];

        // Extract title
        const titleMatch =
          innerContent.match(/alt=["']([^"']+)["']/) ||
          innerContent.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) ||
          innerContent.match(/title=["']([^"']+)["']/) ||
          [null, innerContent.replace(/<[^>]+>/g, '').trim()];
        const itemTitle = (titleMatch[1] || '').trim() || itemUrl.split('/').filter(Boolean).pop() || 'Anime';

        // Extract poster
        const posterMatch = innerContent.match(/(?:src|data-src)=["'](https?:\/\/[^"']+)["']/i);
        const poster = posterMatch ? posterMatch[1] : undefined;

        if (itemUrl && !results.some(r => r.url === itemUrl)) {
          const detected = detectLanguages(itemTitle + ' ' + itemUrl + ' Multi Audio Hindi Tamil Telugu Malayalam Bengali English');
          const type = itemUrl.includes('/movies/') || itemUrl.includes('/movie/') ? 'movie' : 'series';
          results.push({
            id: itemUrl.split('/').filter(Boolean).pop() || itemUrl,
            title: itemTitle,
            url: itemUrl.startsWith('http') ? itemUrl : `${base}${itemUrl}`,
            poster,
            languages: detected,
            type,
          });
        }
      }

      if (results.length > 0) break;
    } catch {
      // Try next domain
    }
  }

  return results;
}

/**
 * Scores a search candidate for best match
 */
function scoreCandidate(item: IndianAnimeSearchResult, baseTitle: string, isMovie: boolean): number {
  const norm = cleanTitle(item.title || item.id);
  const targetNorm = cleanTitle(baseTitle);

  let score = 0;
  const isItemMovie = item.type === 'movie' || (item.url || '').includes('/movies/') || (item.url || '').includes('/movie/');

  if (isMovie) {
    if (isItemMovie) score += 200;
    else score -= 100;
  } else {
    if (isItemMovie) return -999; // Reject movie for TV series episode request
    score += 100;
  }

  // Exact match bonus
  if (norm === targetNorm) score += 150;
  else if (norm.startsWith(targetNorm)) score += 80;
  else if (targetNorm.startsWith(norm)) score += 60;

  // Penalize spin-offs when main show is requested
  if (targetNorm === 'my hero academia' && norm.includes('vigilantes')) score -= 200;
  if (targetNorm === 'naruto' && norm.includes('shippuden')) score -= 100;
  if (targetNorm === 'demon slayer' && norm.includes('infinity castle')) score -= 200;

  return score;
}

/**
 * Resolves Zephyrix video hash to secured direct .m3u8 URL
 */
async function resolveZephyrixVideo(hash: string, refererUrl: string): Promise<string | null> {
  try {
    const postUrl = `https://play.zephyrix.org/player/index.php?data=${hash}&do=getVideo`;
    const form = new URLSearchParams();
    form.append('hash', hash);
    form.append('r', refererUrl);

    const res = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `https://play.zephyrix.org/video/${hash}`,
        Origin: 'https://play.zephyrix.org',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: form.toString(),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.videoSource || data.securedLink || null;
  } catch {
    return null;
  }
}

/**
 * Fetches and resolves streaming embed / direct link for an episode or movie
 */
export async function resolveIndianStream(params: {
  animeTitle?: string;
  englishTitle?: string;
  romajiTitle?: string;
  synonyms?: string[];
  episodeNumber?: number;
  seasonNumber?: number;
  format?: string;
  language?: string;
  serverName?: string;
  anilistId?: number | string;
}): Promise<ResolveIndianStreamResult> {
  const epNum = Number(params.episodeNumber) || 1;
  const reqLang = String(params.language || 'HIN').toUpperCase();
  const titleStr = params.englishTitle || params.animeTitle || params.romajiTitle || 'Anime';

  const isMovie = (params.format || '').toUpperCase() === 'MOVIE' || 
                  cleanTitle(titleStr).includes('movie') ||
                  cleanTitle(titleStr).includes('film') ||
                  cleanTitle(titleStr).includes('infinity castle') ||
                  cleanTitle(titleStr).includes('mugen train movie');

  const targetSeason = detectSeason(titleStr, params.seasonNumber);

  const searchTitles = [
    params.englishTitle,
    params.animeTitle,
    params.romajiTitle,
    ...(params.synonyms || []),
  ].filter(Boolean) as string[];

  const queries = getBaseSearchQueries(searchTitles, isMovie);
  let allResults: IndianAnimeSearchResult[] = [];

  for (const q of queries) {
    const res = await searchIndianAnime(q);
    for (const r of res) {
      if (!allResults.some(existing => existing.url === r.url)) {
        allResults.push(r);
      }
    }
    if (allResults.length >= 3) break;
  }

  if (allResults.length === 0) {
    return {
      success: false,
      status: 404,
      error: `No Indian regional streams found for "${titleStr}".`,
    };
  }

  // Base title for matching
  const baseTitle = cleanTitle(
    titleStr.split(/[:\-\–\—\;]/)[0]
      .replace(/\s*season\s*\d+/gi, '')
      .replace(/\s*arc\b/gi, '')
      .replace(/\s*movie\b/gi, '')
      .trim()
  );

  let bestItem: IndianAnimeSearchResult | null = null;
  let bestScore = -999;

  for (const item of allResults) {
    const s = scoreCandidate(item, baseTitle, isMovie);
    if (s > bestScore) {
      bestScore = s;
      bestItem = item;
    }
  }

  if (!bestItem || bestScore < 0) {
    bestItem = isMovie ? (allResults.find(r => r.type === 'movie') || allResults[0])
                       : (allResults.find(r => r.type === 'series') || allResults[0]);
  }

  const slug = bestItem.url.split('/').filter(Boolean).pop();
  let epPageUrl = bestItem.url;
  let epHtml = '';

  try {
    // 1. IF MOVIE: Fetch the movie page directly
    if (bestItem.type === 'movie' || isMovie) {
      const movieRes = await fetch(bestItem.url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
      if (movieRes.ok) {
        epHtml = await movieRes.text();
        epPageUrl = bestItem.url;
      }
    } else if (slug) {
      // 2. IF TV SERIES: Build prioritized candidate episode URLs
      const candidateUrls: string[] = [];
      for (const base of SEARCH_DOMAINS) {
        candidateUrls.push(`${base}/episode/${slug}-${targetSeason}x${epNum}/`);
        candidateUrls.push(`${base}/episode/${slug}-${targetSeason}x0${epNum}/`);
        candidateUrls.push(`${base}/episode/${slug}-season-${targetSeason}-episode-${epNum}/`);
        candidateUrls.push(`${base}/episode/${slug}-s${targetSeason}-e${epNum}/`);
        if (targetSeason === 1) {
          candidateUrls.push(`${base}/episode/${slug}-episode-${epNum}/`);
          candidateUrls.push(`${base}/episode/${slug}-${epNum}/`);
          candidateUrls.push(`${base}/episode/${slug}-1x${epNum}/`);
        }
      }

      for (const cand of candidateUrls) {
        try {
          const candRes = await fetch(cand, { headers: HEADERS, signal: AbortSignal.timeout(4000) });
          if (candRes.ok) {
            const text = await candRes.text();
            if (text.includes('zephyrix') || text.includes('player') || text.includes('iframe') || text.includes('video')) {
              epPageUrl = cand;
              epHtml = text;
              break;
            }
          }
        } catch {
          // Try next candidate
        }
      }

      // Fallback: If direct candidate URL did not hit, fetch series page and inspect links
      if (!epHtml) {
        const seriesRes = await fetch(bestItem.url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
        if (seriesRes.ok) {
          const sHtml = await seriesRes.text();
          const epLinkRegex = new RegExp(`href=["'](https?:\\/\\/[^"']*\\/episode\\/[^"']*(?:${targetSeason}x|episode[-_]|[-_])0*${epNum}\\/?)[ "']`, 'i');
          const m = sHtml.match(epLinkRegex);
          if (m && m[1]) {
            epPageUrl = m[1];
            const epRes = await fetch(epPageUrl, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
            if (epRes.ok) epHtml = await epRes.text();
          }
        }
      }
    }

    if (!epHtml) {
      return {
        success: false,
        status: 404,
        error: `Could not find Season ${targetSeason} Episode ${epNum} on AnimeWorld India for "${titleStr}".`,
      };
    }

    // 1. Check for Zephyrix player iframe
    const zepMatch = epHtml.match(/<iframe[^>]+src=["'](https?:\/\/play\.zephyrix\.org\/video\/([a-zA-Z0-9]+))["']/i);
    let directM3u8: string | null = null;
    let zephyrixHash: string | null = null;
    let zephyrixEmbedUrl: string | null = null;

    if (zepMatch) {
      zephyrixEmbedUrl = zepMatch[1];
      zephyrixHash = zepMatch[2];
      directM3u8 = await resolveZephyrixVideo(zephyrixHash, epPageUrl);
    }

    // 2. Check for player1.php?data= base64 payload (with multi-language links)
    const dataMatch = epHtml.match(/[?&]data=([A-Za-z0-9+/=]+)/);
    let multiLangLinks: Array<{ language: string; link: string }> = [];
    if (dataMatch) {
      try {
        const decoded = Buffer.from(dataMatch[1], 'base64').toString('utf-8');
        multiLangLinks = JSON.parse(decoded);
      } catch {
        // Ignored
      }
    }

    // 3. Extract any other player iframes
    const iframeRegex = /<iframe\s+[^>]*(?:src|data-src)=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
    const allIframes: string[] = [];
    let ifrM;
    while ((ifrM = iframeRegex.exec(epHtml)) !== null) {
      const src = ifrM[1];
      if (!src.includes('google') && !src.includes('facebook') && !src.includes('disqus') && !allIframes.includes(src)) {
        allIframes.push(src);
      }
    }

    // Build available servers list
    const serverOptions: Array<{ name: string; type: string; linkId: string }> = [];

    if (zephyrixEmbedUrl) {
      serverOptions.push({
        name: `Zephyrix Player (${reqLang} Multi-Audio)`,
        type: reqLang,
        linkId: zephyrixEmbedUrl,
      });
    }

    if (directM3u8) {
      serverOptions.push({
        name: `AnimeWorld Direct HLS (1080p)`,
        type: reqLang,
        linkId: directM3u8,
      });
    }

    // Add multi-language options if found
    for (const item of multiLangLinks) {
      const code = item.language.toUpperCase().startsWith('HIN') ? 'HIN'
        : item.language.toUpperCase().startsWith('TAM') ? 'TAM'
        : item.language.toUpperCase().startsWith('TEL') ? 'TEL'
        : item.language.toUpperCase().startsWith('MAL') ? 'MAL'
        : item.language.toUpperCase().startsWith('BEN') ? 'BEN'
        : item.language.toUpperCase().startsWith('ENG') ? 'DUB'
        : 'SUB';
      serverOptions.push({
        name: `AnimeWorld ${item.language} Mirror`,
        type: code,
        linkId: item.link,
      });
    }

    // Add any remaining iframes
    allIframes.forEach((src, idx) => {
      if (!serverOptions.some(s => s.linkId === src)) {
        let label = `AnimeWorld Edge ${idx + 1} (${reqLang})`;
        if (src.includes('streamtape')) label = 'StreamTape Multi';
        else if (src.includes('filemoon')) label = 'FileMoon HLS';
        serverOptions.push({
          name: label,
          type: reqLang,
          linkId: src,
        });
      }
    });

    if (serverOptions.length === 0 && !zephyrixEmbedUrl && !directM3u8) {
      return {
        success: false,
        status: 404,
        error: `Found anime listing but could not extract episode stream.`,
      };
    }

    // Select active server
    let chosenServer = serverOptions[0];
    if (params.serverName) {
      const matched = serverOptions.find(s => s.name.toLowerCase().includes(params.serverName!.toLowerCase()));
      if (matched) chosenServer = matched;
    }

    // For webview playback, zephyrixEmbedUrl has built-in Hindi/Multi-Audio tracks
    const activeStreamUrl = zephyrixEmbedUrl || directM3u8 || chosenServer.linkId;

    return {
      success: true,
      streamUrl: activeStreamUrl,
      directStreamUrl: directM3u8 || null,
      embedUrl: zephyrixEmbedUrl || chosenServer.linkId,
      subtitleUrl: null,
      isDirectVideo: false,
      availableServers: serverOptions,
      availableLanguages: ['HIN', 'TAM', 'TEL', 'MAL', 'BEN', 'DUB', 'SUB'],
      selectedServer: chosenServer.name,
      language: reqLang,
      requestedLanguage: reqLang,
      actualLanguage: reqLang,
      provider: 'animeworld-india',
    };
  } catch (err: any) {
    return {
      success: false,
      status: 500,
      error: err.message || 'Failed to resolve Indian anime stream',
    };
  }
}
