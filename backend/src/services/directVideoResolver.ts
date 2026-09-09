/**
 * Direct Video Resolver for Native Android Video Player (ExoPlayer) & Web
 *
 * Resolves embed player URLs (e.g. MegaCloud, RapidCloud, VidLink, AutoEmbed, 2Embed, VidStreaming, etc.)
 * to raw direct stream URLs (.m3u8 HLS or .mp4 HTTP progressive files) by fetching the embed HTML
 * with spoofed desktop headers and extracting media sources via regular expressions.
 */

interface CacheEntry {
  directUrl: string;
  timestamp: number;
}

const directUrlCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Extracts direct video stream links (.m3u8 or .mp4) from an HTML or script string
 */
export function extractDirectVideoUrlsFromHtml(html: string, baseUrl?: string): string[] {
  if (!html || typeof html !== 'string') return [];

  const foundUrls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (raw: string) => {
    if (!raw) return;
    // Unescape common JSON escaped slashes and unicode
    let cleaned = raw
      .replace(/\\\//g, '/')
      .replace(/\\u0026/g, '&')
      .replace(/^['"]|['"]$/g, '')
      .trim();

    // If starts with //, add https:
    if (cleaned.startsWith('//')) {
      cleaned = `https:${cleaned}`;
    } else if (cleaned.startsWith('/') && baseUrl) {
      try {
        cleaned = new URL(cleaned, baseUrl).href;
      } catch {}
    }

    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) return;

    // Filter out obvious ad/placeholder tracks
    if (/ad_placeholder|sample\.mp4|blank\.mp4/i.test(cleaned)) return;

    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      foundUrls.push(cleaned);
    }
  };

  // 1. Direct regex matching https://...(.m3u8 or .mp4) with optional query parameters
  const directRegex = /https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mp4)(?:\?[^\s"'<>\\]*)?/gi;
  let match: RegExpExecArray | null;
  while ((match = directRegex.exec(html)) !== null) {
    addUrl(match[0]);
  }

  // 2. Escaped slash regex: https?:\/\/...
  const escapedRegex = /https?:\\\/\\\/[^\s"'<>\\]+?\.(?:m3u8|mp4)(?:\?[^\s"'<>\\]*)?/gi;
  while ((match = escapedRegex.exec(html)) !== null) {
    addUrl(match[0]);
  }

  // 3. Common JS player source patterns: file: "...", source: "...", src: "...", url: "..."
  const sourcePropertyRegex = /(?:file|source|src|url)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi;
  while ((match = sourcePropertyRegex.exec(html)) !== null) {
    addUrl(match[1]);
  }

  // 4. HTML5 video or source tags: <source src="..." or <video src="..."
  const htmlTagRegex = /<(?:source|video)[^>]+src=["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi;
  while ((match = htmlTagRegex.exec(html)) !== null) {
    addUrl(match[1]);
  }

  // Prioritize .m3u8 (adaptive HLS bitrate) over .mp4
  return foundUrls.sort((a, b) => {
    const aIsM3u8 = a.includes('.m3u8');
    const bIsM3u8 = b.includes('.m3u8');
    if (aIsM3u8 && !bIsM3u8) return -1;
    if (!aIsM3u8 && bIsM3u8) return 1;
    return 0;
  });
}

/**
 * Loads an embed page with spoofed desktop headers and resolves the direct video file URL (.m3u8 or .mp4)
 * @param embedUrl The embed website URL
 * @returns The resolved direct video URL if found, or the original embedUrl as fallback
 */
export async function resolveDirectVideoLink(embedUrl: string): Promise<string> {
  if (!embedUrl || typeof embedUrl !== 'string') {
    return embedUrl;
  }

  const trimmed = embedUrl.trim();

  // 1. If it's already a direct .m3u8 or .mp4 link, return it immediately
  if (/\.(m3u8|mp4)(\?|$)/i.test(trimmed)) {
    return trimmed;
  }

  // 2. If it's not a valid web URL, return as-is
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 3. Check memory cache
  const cached = directUrlCache.get(trimmed);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.directUrl;
  }

  try {
    let referer = 'https://google.com/';
    let origin = 'https://google.com';
    try {
      const parsedUrl = new URL(trimmed);
      origin = `${parsedUrl.protocol}//${parsedUrl.host}`;
      referer = `${origin}/`;
    } catch {}

    const headers: Record<string, string> = {
      'User-Agent': DESKTOP_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': referer,
      'Origin': origin,
      'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'iframe',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
    };

    const response = await fetch(trimmed, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(4500),
    });

    if (response.ok) {
      const html = await response.text();
      const directCandidates = extractDirectVideoUrlsFromHtml(html, trimmed);

      if (directCandidates.length > 0) {
        const directUrl = directCandidates[0];
        console.info(`[Direct Video Resolver] Successfully extracted direct video link: ${directUrl} from embed: ${trimmed}`);
        directUrlCache.set(trimmed, { directUrl, timestamp: Date.now() });
        return directUrl;
      }

      // Check for nested player iframe (e.g. wrapper embeds)
      const iframeMatch = /<iframe[^>]+src=["'](https?:\/\/[^"']+)["']/i.exec(html);
      if (iframeMatch && iframeMatch[1] && iframeMatch[1] !== trimmed) {
        const nestedUrl = iframeMatch[1];
        try {
          const nestedRes = await fetch(nestedUrl, {
            headers: {
              ...headers,
              'Referer': trimmed,
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(3500),
          });
          if (nestedRes.ok) {
            const nestedHtml = await nestedRes.text();
            const nestedCandidates = extractDirectVideoUrlsFromHtml(nestedHtml, nestedUrl);
            if (nestedCandidates.length > 0) {
              const directUrl = nestedCandidates[0];
              console.info(`[Direct Video Resolver] Extracted direct video link via nested iframe: ${directUrl}`);
              directUrlCache.set(trimmed, { directUrl, timestamp: Date.now() });
              return directUrl;
            }
          }
        } catch (nestedErr: any) {
          console.warn(`[Direct Video Resolver] Nested iframe resolution error:`, nestedErr?.message || nestedErr);
        }
      }
    }
  } catch (err: any) {
    console.warn(`[Direct Video Resolver] Error resolving direct video link for ${trimmed}:`, err?.message || err);
  }

  // Fallback: return original embed URL
  return trimmed;
}
