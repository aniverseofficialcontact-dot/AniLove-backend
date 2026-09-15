/**
 * AnimeWorld India & Renime Indian Multi-Audio Scraper
 *
 * Scrapes AnimeWorld India, WatchAnimeWorld, and AnimeSalt for Hindi, Tamil, Telugu,
 * Malayalam, Bengali, Dual-Audio, and Sub/Dub streams.
 *
 * Integrates directly with extractDirectStreamFromEmbed for direct .m3u8/.mp4 stream links.
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

export interface IndianEpisodeItem {
  id: string;
  num: number;
  title?: string;
  url: string;
  languages?: string[];
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

// Base domains to search
const ANIMEWORLD_DOMAINS = [
  'https://animeworld-india.me',
  'https://watchanimeworld.top',
  'https://animesalt.link',
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
    langs.add('DUB');
  }

  if (langs.size === 0) {
    langs.add('HIN'); // default to Hindi for Indian anime portals
  }
  return Array.from(langs);
}

/**
 * Searches AnimeWorld India / AnimeSalt for matching anime
 */
export async function searchIndianAnime(query: string): Promise<IndianAnimeSearchResult[]> {
  const results: IndianAnimeSearchResult[] = [];
  const cleanQ = cleanTitle(query);
  if (!cleanQ) return results;

  for (const base of ANIMEWORLD_DOMAINS) {
    try {
      const searchUrl = `${base}/search?q=${encodeURIComponent(cleanQ)}&page=1`;
      const res = await fetch(searchUrl, {
        headers: { ...HEADERS, Referer: `${base}/` },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;
      const html = await res.text();

      // Extract links from HTML using regex (no external heavy cheerio dependency needed)
      // Matches article / post links like <a href="https://.../series/..." or <a href="https://.../movie/..."
      const linkRegex = /<a\s+[^>]*href=["']([^"']*(?:\/series\/|\/movie\/|\/anime\/|\/season\/)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const itemUrl = match[1];
        const innerContent = match[2];

        // Extract title
        const titleMatch = innerContent.match(/alt=["']([^"']+)["']/) ||
          innerContent.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) ||
          [null, innerContent.replace(/<[^>]+>/g, '').trim()];
        const itemTitle = (titleMatch[1] || '').trim();

        // Extract poster
        const posterMatch = innerContent.match(/(?:src|data-src)=["'](https?:\/\/[^"']+)["']/i);
        const poster = posterMatch ? posterMatch[1] : undefined;

        if (itemTitle && itemUrl && !results.some(r => r.url === itemUrl)) {
          const detected = detectLanguages(itemTitle + ' ' + itemUrl);
          results.push({
            id: itemUrl.split('/').filter(Boolean).pop() || itemUrl,
            title: itemTitle,
            url: itemUrl.startsWith('http') ? itemUrl : `${base}${itemUrl}`,
            poster,
            languages: detected,
          });
        }
      }

      if (results.length > 0) break; // Found results from this provider
    } catch {
      // Try next domain
    }
  }

  return results;
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
      error: `No Indian dubbed streams found for "${params.englishTitle || params.animeTitle || 'Anime'}".`,
    };
  }

  // Find best matching anime based on requested language
  let targetAnime = searchResults.find(a => a.languages.includes(reqLang)) || searchResults[0];

  try {
    const pageRes = await fetch(targetAnime.url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!pageRes.ok) throw new Error(`Failed to load page: ${pageRes.status}`);

    const html = await pageRes.text();

    // Look for episode link for requested episode number (e.g. Episode 1, Ep 1, ep-1)
    const epRegex = new RegExp(
      `<a\\s+[^>]*href=["']([^"']*(?:episode|ep)[^"']*)["'][^>]*>([\\s\\S]*?ep(?:isode)?\\s*0*${epNum}[^\\d][\\s\\S]*?)<\\/a>`,
      'i'
    );
    const epMatch = epRegex.exec(html);

    let epPageUrl = targetAnime.url;
    let epHtml = html;

    if (epMatch && epMatch[1]) {
      epPageUrl = epMatch[1].startsWith('http') ? epMatch[1] : new URL(epMatch[1], targetAnime.url).href;
      try {
        const epRes = await fetch(epPageUrl, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
        if (epRes.ok) epHtml = await epRes.text();
      } catch {
        // Continue with main page html
      }
    }

    // Extract all iframes and video player embeds from episode page
    const iframeRegex = /<iframe\s+[^>]*(?:src|data-src)=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
    const iframes: string[] = [];
    let iframeMatch;
    while ((iframeMatch = iframeRegex.exec(epHtml)) !== null) {
      const src = iframeMatch[1];
      if (!src.includes('google') && !src.includes('facebook') && !src.includes('disqus')) {
        iframes.push(src);
      }
    }

    // Also look for direct video links (.m3u8, .mp4, faststream, doodstream, toonstream, streamtape)
    const serverOptions: Array<{ name: string; type: string; linkId: string }> = [];

    iframes.forEach((src, idx) => {
      let serverLabel = `Server ${idx + 1}`;
      if (src.includes('streamtape')) serverLabel = 'StreamTape HD (Hindi)';
      else if (src.includes('filemoon') || src.includes('moon')) serverLabel = 'FileMoon HLS (Hindi)';
      else if (src.includes('toonstream')) serverLabel = 'ToonStream Multi (Hindi)';
      else if (src.includes('mp4upload')) serverLabel = 'Mp4Upload HD (Hindi)';
      else if (src.includes('dood')) serverLabel = 'DoodStream Fast (Hindi)';
      else if (src.includes('vidguard')) serverLabel = 'VidGuard Multi (Hindi)';
      else serverLabel = `AnimeWorld Edge ${idx + 1} (${reqLang})`;

      serverOptions.push({
        name: serverLabel,
        type: reqLang,
        linkId: src,
      });
    });

    if (serverOptions.length === 0) {
      // Look for a2z or archive links
      const archiveLinkMatch = epHtml.match(/href=["'](https?:\/\/[^"']*(?:stream|watch|play|player|drive|mega)[^"']*)["']/i);
      if (archiveLinkMatch) {
        serverOptions.push({
          name: `AnimeWorld Cloud Mirror (${reqLang})`,
          type: reqLang,
          linkId: archiveLinkMatch[1],
        });
      }
    }

    if (serverOptions.length === 0) {
      return {
        success: false,
        status: 404,
        error: `Found anime listing but could not extract episode ${epNum} stream.`,
      };
    }

    // Choose primary server
    let chosenServer = serverOptions[0];
    if (params.serverName) {
      const matched = serverOptions.find(s => s.name.toLowerCase().includes(params.serverName!.toLowerCase()));
      if (matched) chosenServer = matched;
    }

    const rawEmbedUrl = chosenServer.linkId;

    // Run server-side direct stream extraction
    let directStreamUrl: string | null = null;
    let subtitleUrl: string | null = null;
    try {
      const extracted = await extractDirectStreamFromEmbed(rawEmbedUrl, targetAnime.url);
      if (extracted?.streamUrl) {
        directStreamUrl = extracted.streamUrl;
        subtitleUrl = extracted.subtitleUrl || null;
      }
    } catch {
      // Fall back to embed
    }

    const isDirect = Boolean(directStreamUrl && /\.(m3u8|mp4)(\?|$)/i.test(directStreamUrl));

    return {
      success: true,
      streamUrl: directStreamUrl || rawEmbedUrl,
      directStreamUrl: directStreamUrl || null,
      embedUrl: rawEmbedUrl,
      subtitleUrl,
      isDirectVideo: isDirect,
      availableServers: serverOptions,
      availableLanguages: targetAnime.languages,
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
