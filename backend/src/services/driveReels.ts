// Google Drive Reels Scraper, RAM Caching & High-Performance Media Streaming Service
import fs from 'fs';
import path from 'path';

export interface ReelItem {
  id: string;
  name: string;
  title: string;
  cleanTitle: string;
  size: string;
  date: string;
  folderId: string;
  folderName: string;
  mimeType: string;
  url: string;
  streamProxyUrl: string;
  downloadProxyUrl: string;
  thumbnailUrl: string;
}

export const GOOGLE_DRIVE_SUBFOLDERS_MAP: Record<string, string> = {
  '1Y1J6d2G9w2qV8x_gK3z_M0Q4l1O8s7t9': 'Master Anime Reels (1)',
  '1b4kK5jL7m8N9p0Q1r2S3t4U5v6W7x8y9': 'Trending Reels (2)',
  '1Z2x3C4v5B6n7M8k9J0h1G2f3D4s5A6q7': 'Action Highlights (3)',
  '1q2W3e4R5t6Y7u8I9o0P1a2S3d4F5g6h7': 'Source 4 (204)',
  '1N_0NqjWcZkmPZlhX_s92B_Tq9P3u6S3N': 'Source 5 (300)',
  '1cKXGh1RbIjquhH9H7oJezmT7cWVlVK8d': 'Source 6 (13)',
  '1DD0QrWz_LM0Xms6LV-7FiGlTC28BC9_v': 'Source 7 (281)',
  '1kD1pVXecL_B7-xMtGaC8RF_S1LYz4JH8': 'Source 8 (46)',
  '1mnjgBkUx7p5rUK53fkfVIqmFNqjybjbV': 'Source 9 (249)',
  '1SviP9Cw69ByTpoTRLf_-5slFC04Hd68i': 'Source 10 (212)',
  '1muWWvBwNHF83qyYSDCsMCEanY-_Dmkic': 'Source 11',
  '1ym4e97f2pB9iCssdLBtexPBZKKaH7Yes': 'Source 12',
  '1-2wAWpeCl1KZbTjokzqw8jor4K-C7Dc-': 'Source 13',
  '1t86VBDJrcCIFrmjiU8IAODZdhNowx2QV': 'Source 14',
  '11qS6DaZ5pSAni8na1_9P58lV-ARNIyr7': 'Source 15',
  '1pyeY4LcqIJW8RjtkWcrzrhBGZIgXMYrI': 'Source 16',
  '1BI7PDi8UZ18hq43i37tzqC2-BK7it2tW': 'Source 17',
  '1EeyAd8mjFOVi7Z0iwGY-b68zrUF1ElUh': 'Source 18',
  '11UlX-yfYXtX5DOsZbddOLRUWsXncXdM8': 'Source 19',
  '1tu2ntZcT2dCMndPHdIRUdM8FIunNex9I': 'Source 20',
};

export let inMemoryReels: ReelItem[] = [];

// Initialize bundled reels dataset
export function initInMemoryReels(): void {
  const candidatePaths = [
    path.join(process.cwd(), 'src/data/animeReels.json'),
    path.join(process.cwd(), 'public/data/animeReels.json'),
    path.join(process.cwd(), 'data/animeReels.json'),
  ];

  for (const reelsPath of candidatePaths) {
    try {
      if (fs.existsSync(reelsPath)) {
        const raw = fs.readFileSync(reelsPath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          inMemoryReels = data;
          console.log(`[Reels Engine] Successfully loaded ${inMemoryReels.length} reels from ${reelsPath}`);
          return;
        }
      }
    } catch (err: any) {
      console.warn(`[Reels Engine] Note reading ${reelsPath}:`, err?.message || err);
    }
  }

  console.info('[Reels Engine] Initialized with empty reels dataset. Will scrape or load on demand.');
}

// Memory RAM Caches for instant video playback & thumbnails
export const reelsBufferCache = new Map<string, { buffer: Buffer; contentType: string; length: number; lastAccessed: number }>();
export const reelsThumbnailCache = new Map<string, { buffer: Buffer; contentType: string; lastAccessed: number }>();
const inFlightReelFetches = new Map<string, Promise<{ buffer: Buffer; contentType: string; length: number } | null>>();

const MAX_CACHED_REELS = 25;
const MAX_CACHED_THUMBNAILS = 500;

export function resolveReelFileId(paramId?: string): string {
  if (!paramId) return '';
  const clean = String(paramId).trim();
  if (clean.length >= 25) {
    const exact = inMemoryReels.find(r => r.id === clean);
    if (exact) return exact.id;
  }
  const cleanLower = clean.toLowerCase();

  // 1. Exact or case-insensitive match
  const directMatch = inMemoryReels.find(r =>
    r.id === clean ||
    r.id.toLowerCase() === cleanLower
  );
  if (directMatch) return directMatch.id;

  // 2. Strong prefix match (Drive video IDs are 28-35 chars)
  if (clean.length >= 15) {
    const prefix20 = cleanLower.slice(0, 20);
    const prefix15 = cleanLower.slice(0, 15);
    const prefixMatch = inMemoryReels.find(r => {
      const rLower = r.id.toLowerCase();
      return rLower.startsWith(prefix20) || rLower.startsWith(prefix15);
    });
    if (prefixMatch) return prefixMatch.id;
  }

  // 3. Typo/OCR-tolerant match
  if (clean.length >= 25) {
    const norm = (s: string) => s.toLowerCase().replace(/[il1|]/g, '1').replace(/[o0]/g, '0');
    const cleanNorm = norm(clean);
    const fuzzyMatch = inMemoryReels.find(r => norm(r.id) === cleanNorm);
    if (fuzzyMatch) return fuzzyMatch.id;
  }

  // 4. Substring or title match
  const titleMatch = inMemoryReels.find(r =>
    (clean.length >= 5 && r.id.toLowerCase().startsWith(cleanLower)) ||
    (r.title && r.title.toLowerCase().includes(cleanLower)) ||
    (r.cleanTitle && r.cleanTitle.toLowerCase().includes(cleanLower))
  );
  return titleMatch ? titleMatch.id : clean;
}

export async function fetchAndCacheReelVideo(fileId: string): Promise<{ buffer: Buffer; contentType: string; length: number } | null> {
  if (reelsBufferCache.has(fileId)) {
    const cached = reelsBufferCache.get(fileId)!;
    cached.lastAccessed = Date.now();
    return cached;
  }

  if (inFlightReelFetches.has(fileId)) {
    return inFlightReelFetches.get(fileId)!;
  }

  const fetchPromise = (async () => {
    try {
      const targetUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
      const forwardHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://drive.google.com/',
      };

      let remoteRes = await fetch(targetUrl, {
        headers: forwardHeaders,
        redirect: 'follow',
        signal: AbortSignal.timeout(18000),
      });

      if (!remoteRes.ok) {
        remoteRes = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, {
          headers: forwardHeaders,
          redirect: 'follow',
          signal: AbortSignal.timeout(18000),
        });
      }

      if (!remoteRes.ok || !remoteRes.body) return null;

      const contentType = remoteRes.headers.get('content-type') || 'video/mp4';
      const arrayBuf = await remoteRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      if (buffer.length < 1000) return null;

      const entry = {
        buffer,
        contentType,
        length: buffer.length,
        lastAccessed: Date.now(),
      };

      if (reelsBufferCache.size >= MAX_CACHED_REELS) {
        let oldestKey = '';
        let oldestTime = Infinity;
        for (const [k, v] of reelsBufferCache.entries()) {
          if (v.lastAccessed < oldestTime) {
            oldestTime = v.lastAccessed;
            oldestKey = k;
          }
        }
        if (oldestKey) reelsBufferCache.delete(oldestKey);
      }

      reelsBufferCache.set(fileId, entry);
      return entry;
    } catch {
      return null;
    } finally {
      inFlightReelFetches.delete(fileId);
    }
  })();

  inFlightReelFetches.set(fileId, fetchPromise);
  return fetchPromise;
}

export async function fetchAndCacheReelThumbnail(fileId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const resolvedId = resolveReelFileId(fileId) || fileId;

  if (reelsThumbnailCache.has(resolvedId)) {
    const cached = reelsThumbnailCache.get(resolvedId)!;
    cached.lastAccessed = Date.now();
    return cached;
  }

  const candidateUrls = [
    `https://lh3.googleusercontent.com/d/${resolvedId}`,
    `https://drive.google.com/thumbnail?id=${resolvedId}&sz=w1200`,
    `https://drive.google.com/thumbnail?id=${resolvedId}&sz=w800`,
    `https://drive.google.com/thumbnail?id=${resolvedId}&sz=w600`,
    `https://drive.google.com/thumbnail?id=${resolvedId}&sz=w400`,
  ];

  for (const targetUrl of candidateUrls) {
    try {
      const remoteRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (remoteRes.ok && remoteRes.body) {
        const contentType = remoteRes.headers.get('content-type') || 'image/jpeg';
        if (contentType.startsWith('image/')) {
          const arrayBuf = await remoteRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          if (buffer.length > 500) {
            const entry = { buffer, contentType, lastAccessed: Date.now() };

            if (reelsThumbnailCache.size >= MAX_CACHED_THUMBNAILS) {
              let oldestKey: string | null = null;
              let oldestTime = Infinity;
              for (const [key, val] of reelsThumbnailCache.entries()) {
                if (val.lastAccessed < oldestTime) {
                  oldestTime = val.lastAccessed;
                  oldestKey = key;
                }
              }
              if (oldestKey) reelsThumbnailCache.delete(oldestKey);
            }

            reelsThumbnailCache.set(resolvedId, entry);
            if (resolvedId !== fileId) {
              reelsThumbnailCache.set(fileId, entry);
            }
            return entry;
          }
        }
      }
    } catch {
      // Continue to next candidate URL
    }
  }

  // High-resolution fallback banner
  try {
    const fallbackPath = path.join(process.cwd(), 'public/og-banner.jpg');
    if (fs.existsSync(fallbackPath)) {
      const buffer = fs.readFileSync(fallbackPath);
      const fallbackEntry = { buffer, contentType: 'image/jpeg', lastAccessed: Date.now() };
      reelsThumbnailCache.set(resolvedId, fallbackEntry);
      return fallbackEntry;
    }
  } catch (e) {
    console.warn('[Thumbnail Fallback Error]:', e);
  }

  return null;
}

export async function scrapeDriveFolder(folderId: string, folderName?: string): Promise<ReelItem[]> {
  const seen = new Map<string, ReelItem>();
  const mappedFolderName = folderName || GOOGLE_DRIVE_SUBFOLDERS_MAP[folderId] || 'Folder';

  try {
    const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}#list`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(14000),
    });
    const html = await res.text();
    const entryRegex = /<div class="flip-entry" id="entry-([A-Za-z0-9_\-]{20,40})"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    const entries = [...html.matchAll(entryRegex)];

    for (const entry of entries) {
      const fileId = entry[1];
      const innerHtml = entry[2];

      const titleMatch = innerHtml.match(/<div class="flip-entry-title">([^<]+)<\/div>/);
      const rawTitle = titleMatch ? titleMatch[1].trim() : `Anime Reel ${fileId.slice(0, 6)}`;

      const modMatch = innerHtml.match(/<div class="flip-entry-last-modified"><div>([^<]+)<\/div>/);
      const date = modMatch ? modMatch[1].trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '') : 'Recent';

      let cleanTitle = rawTitle.replace(/[\x00-\x1F\x7F-\x9F]/g, '').replace(/\.(mp4|mov|mkv|webm|avi|flv)$/i, '');
      cleanTitle = cleanTitle.replace(/Digiproducthub\.in\s*\(([0-9]+)\)/i, 'Anime Edit #$1');
      cleanTitle = cleanTitle.replace(/Digiproducthub\.in/gi, 'Anime AMV Edit');
      if (/^[0-9]+$/.test(cleanTitle)) {
        cleanTitle = `Anime Edit #${cleanTitle}`;
      }

      if (/^[A-Za-z0-9_\-]{20,50}$/.test(fileId) && !seen.has(fileId)) {
        const safeName = rawTitle.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim() || `Anime Reel ${fileId.slice(0, 6)}`;
        const safeCleanTitle = cleanTitle.trim() || `Anime Reel ${fileId.slice(0, 6)}`;
        seen.set(fileId, {
          id: fileId,
          name: safeName,
          title: safeName,
          cleanTitle: safeCleanTitle,
          size: 'HD Video',
          date: date,
          folderId,
          folderName: mappedFolderName,
          mimeType: 'video/mp4',
          url: `/api/reels/stream/${fileId}`,
          streamProxyUrl: `/api/reels/stream/${fileId}`,
          downloadProxyUrl: `/api/reels/download/${fileId}`,
          thumbnailUrl: `/api/reels/thumbnail/${fileId}`,
        });
      }
    }

    if (seen.size === 0) {
      const folderRes = await fetch(`https://drive.google.com/drive/folders/${folderId}?usp=sharing`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(14000),
      });
      const folderHtml = await folderRes.text();
      const itemRegex = /\[\"([A-Za-z0-9_\-]{28,35})\"(?:,[^,]+){0,3},\"([^\"]+\.(?:mp4|mkv|mov|webm|avi))\"/gi;
      const itemMatches = [...folderHtml.matchAll(itemRegex)];
      for (const match of itemMatches) {
        const fileId = match[1];
        const rawTitle = match[2];
        if (/^[A-Za-z0-9_\-]{20,50}$/.test(fileId) && !seen.has(fileId)) {
          let cleanTitle = rawTitle.replace(/[\x00-\x1F\x7F-\x9F]/g, '').replace(/\.(mp4|mov|mkv|webm|avi|flv)$/i, '');
          const safeName = rawTitle.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim() || `Anime Reel ${fileId.slice(0, 6)}`;
          const safeCleanTitle = cleanTitle.trim() || `Anime Reel ${fileId.slice(0, 6)}`;
          seen.set(fileId, {
            id: fileId,
            name: safeName,
            title: safeName,
            cleanTitle: safeCleanTitle,
            size: 'HD Video',
            date: 'Recent',
            folderId,
            folderName: mappedFolderName,
            mimeType: 'video/mp4',
            url: `/api/reels/stream/${fileId}`,
            streamProxyUrl: `/api/reels/stream/${fileId}`,
            downloadProxyUrl: `/api/reels/download/${fileId}`,
            thumbnailUrl: `/api/reels/thumbnail/${fileId}`,
          });
        }
      }
    }
  } catch (err: any) {
    console.warn(`[Reels Scraper] Warning scraping folder ${mappedFolderName} (${folderId}):`, err.message);
  }

  return Array.from(seen.values());
}

export async function performFullDriveSync(): Promise<ReelItem[]> {
  console.log('[Reels Auto-Sync] Starting background sync across all Drive folders...');
  const seen = new Map<string, ReelItem>();
  inMemoryReels.forEach(r => { if (r && r.id && /^[A-Za-z0-9_\-]{20,50}$/.test(r.id)) seen.set(r.id, r); });

  for (const [folderId, folderName] of Object.entries(GOOGLE_DRIVE_SUBFOLDERS_MAP)) {
    try {
      const folderReels = await scrapeDriveFolder(folderId, folderName);
      folderReels.forEach(r => {
        if (r && r.id && /^[A-Za-z0-9_\-]{20,50}$/.test(r.id)) {
          seen.set(r.id, r);
        }
      });
    } catch (err) {
      console.warn(`[Reels Auto-Sync] Warning scanning ${folderName}:`, err);
    }
  }

  inMemoryReels = Array.from(seen.values());
  console.log(`[Reels Auto-Sync] Sync complete! Total active reels: ${inMemoryReels.length}`);
  return inMemoryReels;
}
