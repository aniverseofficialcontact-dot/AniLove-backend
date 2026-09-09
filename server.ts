import path from 'path';
import fs from 'fs';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createBackendApp } from './backend/src/app';
import { inMemoryReels, resolveReelFileId } from './backend/src/services/driveReels';

declare global {
  interface String {
    contains(searchString: string, position?: number): boolean;
  }
}

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
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://anikototv.to/',
    };

    const response = await fetch(embedUrl, { headers, signal: AbortSignal.timeout(5000) });
    const html = await response.text();

    // 1. Look for M3U8 (HLS) or MP4 links directly in the HTML
    const videoRegex = /["'](https?:\/\/[^"']+\.(m3u8|mp4|mpd|m4s)[^"']*)["']/gi;
    const matches = [...html.matchAll(videoRegex)];

    for (const match of matches) {
      const url = match[1];
      // Ignore ads and tracking links
      if (!url.contains('google') && !url.contains('analytics') && !url.contains('ads')) {
        return url;
      }
    }

    // 2. Look for Base64 encoded sources (common in megaplay/vidstream)
    const base64Regex = /file\s*:\s*["'](https?:\/\/[^"']+)["']/gi;
    const b64Match = base64Regex.exec(html);
    if (b64Match) return b64Match[1];

    // If nothing found, return original as fallback
    return embedUrl;
  } catch (err) {
    console.error('Link Extraction Failed:', err);
    return embedUrl;
  }
}

const PORT = 3000;

function escapeHtmlAttr(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectOpenGraphTags(html: string, og: {
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  pageUrl: string;
  isVideo?: boolean;
}): string {
  let res = html;
  res = res.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttr(og.title)}</title>`);
  if (/<meta\s+name="description"/i.test(res)) {
    res = res.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${escapeHtmlAttr(og.description)}" />`);
  }
  res = res.replace(/<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/?>\s*/gi, '');
  res = res.replace(/<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/?>\s*/gi, '');

  const dynamicTags = [
    `<!-- Dynamic Social Banner Cards (Open Graph & Twitter Card) -->`,
    `<meta property="og:site_name" content="AniLove" />`,
    `<meta property="og:type" content="${og.isVideo ? 'video.other' : 'website'}" />`,
    `<meta property="og:title" content="${escapeHtmlAttr(og.title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(og.description)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(og.pageUrl)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(og.imageUrl)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtmlAttr(og.imageUrl)}" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:width" content="1280" />`,
    `<meta property="og:image:height" content="720" />`,
    `<meta property="og:image:alt" content="${escapeHtmlAttr(og.title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:site" content="@AniLove" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(og.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(og.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(og.imageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtmlAttr(og.title)}" />`,
  ].filter(Boolean).join('\n    ');

  if (res.includes('</head>')) {
    res = res.replace('</head>', `    ${dynamicTags}\n  </head>`);
  } else {
    res = `${dynamicTags}\n${res}`;
  }

  return res;
}

async function startServer() {
  // Create Express app with all modular backend routes, scrapers, resolvers, and streaming
  const app = createBackendApp();

  const handleHtmlResponseWithOG = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
    vite?: any
  ) => {
    if (req.method !== 'GET') return next();

    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/@') ||
      req.path.startsWith('/src/') ||
      req.path.startsWith('/node_modules/')
    ) {
      return next();
    }
    if (/\.(js|ts|tsx|css|svg|png|jpg|jpeg|webp|ico|json|map|woff|woff2|ttf|mp4|webm)$/i.test(req.path)) {
      return next();
    }

    try {
      let targetReelId: string | null = null;
      if (req.path.startsWith('/reel/')) {
        const parts = req.path.split('/');
        if (parts[2]) {
          targetReelId = decodeURIComponent(parts[2]).trim();
        }
      }
      if (!targetReelId) {
        const qReel = (req.query.reel as string) || (req.query.reelId as string) || (req.query.id as string);
        if (qReel) {
          targetReelId = decodeURIComponent(qReel).trim();
        }
      }

      const rawProto = req.get('x-forwarded-proto') || req.protocol || 'https';
      const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
      const proto = host.includes('localhost') ? rawProto : 'https';
      const origin = `${proto}://${host}`;

      let title = 'AniLove - Anime Tracker, Streaming & Edits';
      let description = 'Discover trending anime, stream episodes, and watch HD anime edits on AniLove. Your ultimate anime companion.';
      let imageUrl = `${origin}/og-banner.jpg`;
      let videoUrl: string | undefined = undefined;
      let pageUrl = `${origin}${req.originalUrl}`;
      let isVideo = false;

      if (targetReelId) {
        const fileId = resolveReelFileId(targetReelId);
        let matchedReel = inMemoryReels.find(r => r.id === fileId);
        if (!matchedReel) {
          const lower = targetReelId.toLowerCase();
          matchedReel = inMemoryReels.find(r =>
            r.id.toLowerCase() === lower ||
            (r.cleanTitle && r.cleanTitle.toLowerCase().includes(lower)) ||
            (r.title && r.title.toLowerCase().includes(lower))
          );
        }

        const effectiveId = matchedReel?.id || fileId || targetReelId;
        const cleanName = matchedReel?.cleanTitle || matchedReel?.title || `Anime Reel ${effectiveId.slice(0, 6)}`;
        title = `${cleanName} - AniLove Reels`;
        description = `Watch "${cleanName}" in HD on AniLove. Tap to play anime edit!`;
        imageUrl = `${origin}/api/reels/thumbnail/${encodeURIComponent(effectiveId)}`;
        pageUrl = `${origin}/reel/${encodeURIComponent(effectiveId)}`;
        isVideo = false;
      }

      let rawHtml = '';
      if (vite) {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        rawHtml = fs.readFileSync(indexPath, 'utf-8');
        rawHtml = await vite.transformIndexHtml(req.originalUrl, rawHtml);
      } else {
        const distIndexPath = path.join(process.cwd(), 'dist/index.html');
        rawHtml = fs.readFileSync(distIndexPath, 'utf-8');
      }

      const finalHtml = injectOpenGraphTags(rawHtml, {
        title,
        description,
        imageUrl,
        videoUrl,
        pageUrl,
        isVideo,
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(finalHtml);
    } catch (err) {
      console.warn('[SSR OpenGraph Error]:', err);
      return next();
    }
  };

  // Static file serving for public folder assets
  app.use(express.static(path.join(process.cwd(), 'public'), {
    maxAge: '7d',
    immutable: false,
  }));

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use((req, res, next) => {
      const acceptsHtml = req.headers.accept?.includes('text/html') || !req.headers.accept || req.path === '/' || req.path.startsWith('/reel/');
      if (acceptsHtml && req.method === 'GET' && !req.path.startsWith('/api/')) {
        return handleHtmlResponseWithOG(req, res, next, vite);
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res, next) => {
      handleHtmlResponseWithOG(req, res, next);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AniLove full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
