/**
 * Direct Video Resolver — Server-side CDN stream extractor
 *
 * Extracts real .m3u8 / .mp4 URLs from embed pages, server-side.
 * Handles: MegaCloud (AES-CBC decrypted), RapidCloud, StreamTape, FileMoon, generic HTML.
 *
 * Used by /api/anikoto/resolve and /api/stream/extract-direct so Android downloads
 * get a direct stream URL without needing VideoSniffer (headless WebView).
 */

import crypto from 'crypto';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Decrypt AES-256-CBC encrypted MegaCloud/RapidCloud sources.
 * Key from publicly maintained enimax-anime repo.
 * Format: OpenSSL "Salted__" + 8-byte salt + ciphertext (base64).
 */
async function decryptMegaCloudSources(encrypted: string): Promise<any[] | null> {
  try {
    let keyStr = '';
    try {
      const keyRes = await fetch('https://raw.githubusercontent.com/enimax-anime/key/e6/key.txt', {
        signal: AbortSignal.timeout(4000),
        headers: { 'User-Agent': BROWSER_UA },
      });
      if (keyRes.ok) keyStr = (await keyRes.text()).trim();
    } catch {
      keyStr = 'c!i&t9rEfHGj8^m6';
    }
    if (!keyStr) return null;

    const encryptedBytes = Buffer.from(encrypted, 'base64');
    let saltBuf: Buffer | null = null;
    let cipherText: Buffer;

    if (encryptedBytes.slice(0, 8).toString('ascii') === 'Salted__') {
      saltBuf = encryptedBytes.slice(8, 16);
      cipherText = encryptedBytes.slice(16);
    } else {
      cipherText = encryptedBytes;
    }

    const keyBytes = Buffer.from(keyStr, 'utf8');
    let derived = Buffer.alloc(0);
    let prev = Buffer.alloc(0);
    while (derived.length < 48) {
      const input = saltBuf
        ? Buffer.concat([prev, keyBytes, saltBuf])
        : Buffer.concat([prev, keyBytes]);
      prev = crypto.createHash('md5').update(input).digest();
      derived = Buffer.concat([derived, prev]);
    }
    const aesKey = derived.slice(0, 32);
    const iv = derived.slice(32, 48);
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (e) {
    console.warn('[Decrypt] AES decryption failed:', String(e));
    return null;
  }
}

function pickSubtitle(tracks: any[]): string {
  if (!Array.isArray(tracks)) return '';
  return tracks.find((t: any) => t.kind === 'captions' || t.kind === 'subtitles')?.file || '';
}

/**
 * Extracts a direct .m3u8/.mp4 URL from a CDN embed page, entirely server-side.
 * Returns { streamUrl, subtitleUrl } or null if extraction failed.
 */
export async function extractDirectStreamFromEmbed(
  embedUrl: string,
  anikotoReferer = 'https://anikototv.to/'
): Promise<{ streamUrl: string; subtitleUrl?: string } | null> {
  if (!embedUrl || !embedUrl.startsWith('http')) return null;

  // Already a direct stream
  if (/\.(m3u8|mp4|m4s|mpd)(\?|$)/i.test(embedUrl)) return { streamUrl: embedUrl };

  try {
    const u = new URL(embedUrl);
    const host = u.hostname;
    const pathname = u.pathname;

    // ── 1. MegaCloud ─────────────────────────────────────────────────────────
    if (host.includes('megacloud')) {
      const idMatch = pathname.match(/\/embed-2\/e-1\/([A-Za-z0-9]+)/);
      if (idMatch) {
        try {
          const apiRes = await fetch(
            `https://megacloud.tv/embed-2/ajax/e-1/getSources?id=${idMatch[1]}`,
            {
              headers: {
                'User-Agent': BROWSER_UA,
                Accept: 'application/json, text/plain, */*',
                Referer: 'https://megacloud.tv/',
                'X-Requested-With': 'XMLHttpRequest',
                Origin: 'https://megacloud.tv',
              },
              signal: AbortSignal.timeout(8000),
            }
          );
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (Array.isArray(data.sources) && data.sources[0]?.file) {
              console.log('[Extractor] MegaCloud unencrypted ✓');
              return { streamUrl: data.sources[0].file, subtitleUrl: pickSubtitle(data.tracks) };
            }
            if (typeof data.sources === 'string' && data.sources.length > 10) {
              const dec = await decryptMegaCloudSources(data.sources);
              if (dec?.[0]?.file) {
                console.log('[Extractor] MegaCloud decrypted ✓');
                return { streamUrl: dec[0].file, subtitleUrl: pickSubtitle(data.tracks) };
              }
            }
          }
        } catch (e) { console.warn('[Extractor] MegaCloud:', String(e)); }
      }
    }

    // ── 2. RapidCloud ────────────────────────────────────────────────────────
    if (host.includes('rapid-cloud')) {
      const idMatch = pathname.match(/\/embed-6\/datael\/([A-Za-z0-9]+)/);
      if (idMatch) {
        try {
          const apiRes = await fetch(
            `https://rapid-cloud.co/ajax/embed-6-v2/getSources?id=${idMatch[1]}`,
            {
              headers: {
                'User-Agent': BROWSER_UA,
                Accept: 'application/json, text/plain, */*',
                Referer: 'https://rapid-cloud.co/',
                'X-Requested-With': 'XMLHttpRequest',
                Origin: 'https://rapid-cloud.co',
              },
              signal: AbortSignal.timeout(8000),
            }
          );
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (Array.isArray(data.sources) && data.sources[0]?.file) {
              console.log('[Extractor] RapidCloud unencrypted ✓');
              return { streamUrl: data.sources[0].file, subtitleUrl: pickSubtitle(data.tracks) };
            }
            if (typeof data.sources === 'string' && data.sources.length > 10) {
              const dec = await decryptMegaCloudSources(data.sources);
              if (dec?.[0]?.file) {
                console.log('[Extractor] RapidCloud decrypted ✓');
                return { streamUrl: dec[0].file, subtitleUrl: pickSubtitle(data.tracks) };
              }
            }
          }
        } catch (e) { console.warn('[Extractor] RapidCloud:', String(e)); }
      }
    }

    // ── 3. StreamTape ────────────────────────────────────────────────────────
    if (host.includes('streamtape')) {
      try {
        const pageRes = await fetch(embedUrl, {
          headers: { 'User-Agent': BROWSER_UA, Referer: anikotoReferer },
          signal: AbortSignal.timeout(8000),
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const directMatch = html.match(/"(\/\/streamtape\.com\/get_video[^"&]+)/);
          const robotMatch = html.match(/robotlink\)\.innerHTML\s*=\s*["']([^"']+)["']/);
          let videoUrl = '';
          if (directMatch) videoUrl = 'https:' + directMatch[1];
          else if (robotMatch) videoUrl = robotMatch[1].startsWith('//') ? 'https:' + robotMatch[1] : robotMatch[1];
          if (videoUrl) { console.log('[Extractor] StreamTape ✓'); return { streamUrl: videoUrl }; }
        }
      } catch (e) { console.warn('[Extractor] StreamTape:', String(e)); }
    }

    // ── 4. FileMoon ──────────────────────────────────────────────────────────
    if (host.includes('filemoon') || host.includes('moon.to')) {
      try {
        const pageRes = await fetch(embedUrl, {
          headers: { 'User-Agent': BROWSER_UA, Referer: anikotoReferer },
          signal: AbortSignal.timeout(8000),
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const m3u8 = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/);
          if (m3u8) { console.log('[Extractor] FileMoon direct ✓'); return { streamUrl: m3u8[1] }; }
          const evalMatch = html.match(/eval\(atob\("([^"]+)"\)\)/);
          if (evalMatch) {
            const decoded = Buffer.from(evalMatch[1], 'base64').toString('utf8');
            const urlMatch = decoded.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/);
            if (urlMatch) { console.log('[Extractor] FileMoon decoded ✓'); return { streamUrl: urlMatch[1] }; }
          }
        }
      } catch (e) { console.warn('[Extractor] FileMoon:', String(e)); }
    }

    // ── 5. Generic HTML scrape ───────────────────────────────────────────────
    try {
      const pageRes = await fetch(embedUrl, {
        headers: { 'User-Agent': BROWSER_UA, Referer: anikotoReferer },
        signal: AbortSignal.timeout(8000),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const videoRegex = /["'](https?:\/\/[^"']+\.(m3u8|mp4|mpd|m4s)[^"']*)['"]/gi;
        for (const match of html.matchAll(videoRegex)) {
          const url = match[1].replace(/\\\//g, '/');
          if (!url.includes('google') && !url.includes('analytics') && !url.includes('ads')) {
            console.log('[Extractor] Generic scrape ✓');
            return { streamUrl: url };
          }
        }
        const fileMatch = html.match(/file\s*:\s*["'](https?:\/\/[^"']+)["']/i);
        if (fileMatch) return { streamUrl: fileMatch[1].replace(/\\\//g, '/') };
      }
    } catch { /* ignore */ }

    return null;
  } catch (e) {
    console.warn('[Extractor] error:', String(e));
    return null;
  }
}

/**
 * Legacy wrapper — kept for backward compatibility with existing route imports.
 */
export async function resolveDirectVideoLink(embedUrl: string): Promise<string> {
  if (!embedUrl || typeof embedUrl !== 'string') return embedUrl;
  try {
    const result = await extractDirectStreamFromEmbed(embedUrl);
    return result?.streamUrl || embedUrl;
  } catch {
    return embedUrl;
  }
}


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
