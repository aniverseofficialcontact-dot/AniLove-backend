/**
 * Direct Video Resolver for Native Android Video Player (ExoPlayer) & Web
 *
 * Super Resolver: Peeks inside embed websites to find the raw video file (.m3u8, .mp4, .mpd, .m4s)
 */

declare global {
  interface String {
    contains(searchString: string, position?: number): boolean;
  }
}

// Polyfill String.prototype.contains for full compatibility with Java/Kotlin conventions
if (!('contains' in String.prototype)) {
  Object.defineProperty(String.prototype, 'contains', {
    value: function (this: string, str: string) {
      return this.includes(str);
    },
    writable: true,
    configurable: true,
  });
}

/**
 * Super Resolver: Peeks inside embed websites to find the raw video file
 */
export async function resolveDirectVideoLink(embedUrl: string): Promise<string> {
  if (!embedUrl || typeof embedUrl !== 'string') {
    return embedUrl;
  }

  // If already a direct media URL, return immediately
  if (/\.(m3u8|mp4|mpd|m4s)(\?|$)/i.test(embedUrl.trim())) {
    return embedUrl.trim();
  }

  try {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://anikototv.to/',
    };

    const response = await fetch(embedUrl, { headers, signal: AbortSignal.timeout(5000) });
    const html = await response.text();

    // 1. Look for M3U8 (HLS) or MP4 links directly in the HTML
    const videoRegex = /["'](https?:\/\/[^"']+\.(m3u8|mp4|mpd|m4s)[^"']*)["']/gi;
    const matches = [...html.matchAll(videoRegex)];

    for (const match of matches) {
      const url = match[1].replace(/\\\//g, '/');
      // Ignore ads and tracking links
      if (!url.contains('google') && !url.contains('analytics') && !url.contains('ads')) {
        return url;
      }
    }

    // 2. Look for Base64 encoded sources (common in megaplay/vidstream)
    const base64Regex = /file\s*:\s*["'](https?:\/\/[^"']+)["']/gi;
    const b64Match = base64Regex.exec(html);
    if (b64Match) {
      return b64Match[1].replace(/\\\//g, '/');
    }

    // If nothing found, return original as fallback
    return embedUrl;
  } catch (err) {
    console.error('Link Extraction Failed:', err);
    return embedUrl;
  }
}
