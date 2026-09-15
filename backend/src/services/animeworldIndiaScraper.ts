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
  'https://watchanimeworld.top',
  'https://watchanimeworld.one',
  'https://animeworld-india.me',
  'https://animesalt.top',
];

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
 * Extracts season number from a title string (e.g. "Season 2" -> 2)
 */
function getSeasonNumber(title: string): number {
  const t = title.toLowerCase();
  const match = t.match(/season\s*(\d+)/i) || t.match(/s(\d+)/i) || t.match(/(\d+)(?:st|nd|rd|th)\s*season/i);
  if (match) return parseInt(match[1]);
  // If it's a movie or has no season number, we treat it as 1 for base comparison
  return 1;
}

/**
 * Calculates a match score between the requested anime and a search result
 */
function calculateMatchScore(result: IndianAnimeSearchResult, targetTitle: string, isEpisodeRequest: boolean): number {
  let score = 0;
  const resTitle = result.title.toLowerCase();
  const target = targetTitle.toLowerCase();

  // 1. Season Matching (CRITICAL)
  const targetSeason = getSeasonNumber(target);
  const resultSeason = getSeasonNumber(resTitle);
  if (targetSeason === resultSeason) {
    score += 100;
  } else {
    // Large penalty for wrong season
    score -= 50;
  }

  // 2. Movie vs Series Logic
  const isMovieResult = resTitle.includes('movie') || result.url.includes('/movies/') || resTitle.includes('film');
  if (isEpisodeRequest && isMovieResult) {
    score -= 150; // Heavy penalty: we want a series, not a movie
  }
  if (!isEpisodeRequest && isMovieResult) {
    score += 100; // Bonus: we are looking for a movie and found one
  }

  // 3. Word Matching
  const targetWords = target.replace(/season\s*\d+/gi, '').split(/\s+/).filter(w => w.length > 2);
  let matchCount = 0;
  for (const word of targetWords) {
    if (resTitle.includes(word)) matchCount++;
  }
  score += (matchCount / (targetWords.length || 1)) * 50;

  // 4. Series URL Bonus
  if (result.url.includes('/series/')) score += 30;

  return score;
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
    langs.add('SUB');
    langs.add('DUB');
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
          const detected = detectLanguages(itemTitle + ' ' + itemUrl + ' Multi Audio Hindi Tamil Telugu');
          const type = itemUrl.includes('/series/') ? 'series' : itemUrl.includes('/movie') ? 'movie' : 'anime';
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
    return data.securedLink || data.videoSource || null;
  } catch {
    return null;
  }
}

/**
 * Fetches and resolves streaming embed / direct link for an episode
 */
export async function resolveIndianStream(params: {
  animeTitle?: string;
  englishTitle?: string;
  romajiTitle?: string;
  episodeNumber?: number;
  language?: string;
  serverName?: string;
}): Promise<ResolveIndianStreamResult> {
  const epNum = Number(params.episodeNumber) || 1;
  const reqLang = String(params.language || 'HIN').toUpperCase();
  const searchTitles = [
    params.englishTitle,
    params.animeTitle,
    params.romajiTitle,
  ].filter(Boolean) as string[];

  let searchResults: IndianAnimeSearchResult[] = [];

  for (const title of searchTitles) {
    searchResults = await searchIndianAnime(title);
    if (searchResults.length > 0) break;
  }

  if (searchResults.length === 0) {
    return {
      success: false,
      status: 404,
      error: `No Indian regional streams found for "${params.englishTitle || params.animeTitle || 'Anime'}".`,
    };
  }

  // Smart Selection: Score all results and pick the best one
  const primarySearchTitle = params.englishTitle || params.animeTitle || 'Anime';

  // Sort results by their match score (highest first)
  const scoredResults = searchResults.map(res => ({
    result: res,
    score: calculateMatchScore(res, primarySearchTitle, epNum > 0)
  })).sort((a, b) => b.score - a.score);

  const targetAnime = scoredResults[0].result;

  try {
    const pageRes = await fetch(targetAnime.url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!pageRes.ok) throw new Error(`Failed to load series page: ${pageRes.status}`);

    const html = await pageRes.text();
    let epPageUrl = targetAnime.url;
    let epHtml = html;

    // If it's a series, look for the episode link matching epNum
    if (targetAnime.url.includes('/series/')) {
      const epPatterns = [
        new RegExp(`href=["'](https?:\\/\\/[^"']*\\/episode\\/[^"']*(?:-|x)0*${epNum}\\/?)[ "']`, 'i'),
        new RegExp(`href=["'](https?:\\/\\/[^"']*\\/episode\\/[^"']*ep(?:isode)?[-_]?0*${epNum}\\/?)[ "']`, 'i'),
      ];

      let matchedEpUrl: string | null = null;
      for (const pat of epPatterns) {
        const m = html.match(pat);
        if (m && m[1]) {
          matchedEpUrl = m[1];
          break;
        }
      }

      if (matchedEpUrl) {
        epPageUrl = matchedEpUrl;
        try {
          const epRes = await fetch(epPageUrl, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
          if (epRes.ok) epHtml = await epRes.text();
        } catch {
          // Continue with series html
        }
      } else {
        // Try direct URL construction with slug
        const slug = targetAnime.url.split('/').filter(Boolean).pop();
        if (slug) {
          const candidateUrls = [
            `https://watchanimeworld.one/episode/${slug}-1x${epNum}/`,
            `https://watchanimeworld.one/episode/${slug}-1x0${epNum}/`,
            `https://watchanimeworld.one/episode/${slug}-2x${epNum}/`,
            `https://watchanimeworld.one/episode/${slug}-episode-${epNum}/`,
          ];
          for (const cand of candidateUrls) {
            try {
              const candRes = await fetch(cand, { headers: HEADERS, signal: AbortSignal.timeout(4000) });
              if (candRes.ok) {
                epPageUrl = cand;
                epHtml = await candRes.text();
                break;
              }
            } catch {
              // Try next
            }
          }
        }
      }
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
        error: `Found anime listing but could not extract episode ${epNum} stream.`,
      };
    }

    // Select active server
    let chosenServer = serverOptions[0];
    if (params.serverName) {
      const matched = serverOptions.find(s => s.name.toLowerCase().includes(params.serverName!.toLowerCase()));
      if (matched) chosenServer = matched;
    }

    // For webview playback, zephyrixEmbedUrl is rock solid with full FirePlayer multi-audio!
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
