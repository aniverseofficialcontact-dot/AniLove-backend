import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import {
  inMemoryReels,
  resolveReelFileId,
  fetchAndCacheReelVideo,
  fetchAndCacheReelThumbnail,
  reelsBufferCache,
  performFullDriveSync,
  ReelItem,
} from '../services/driveReels';

const router = Router();

// List all Reels
router.get('/reels', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    success: true,
    total: inMemoryReels.length,
    reels: inMemoryReels,
  });
});

// Single Reel Metadata Lookup Endpoint
router.get('/reels/item/:id', (req, res) => {
  const rawId = req.params.id;
  const fileId = resolveReelFileId(rawId);
  let reel = inMemoryReels.find(r => r.id === fileId);
  if (!reel && rawId) {
    const lower = rawId.toLowerCase().trim();
    reel = inMemoryReels.find(r =>
      r.id.toLowerCase() === lower ||
      (r.cleanTitle && r.cleanTitle.toLowerCase().includes(lower)) ||
      (r.title && r.title.toLowerCase().includes(lower))
    );
  }
  if (reel) {
    res.json({ success: true, reel });
    return;
  }
  if (fileId && fileId.length >= 15) {
    const synthetic: ReelItem = {
      id: fileId,
      name: `Anime Reel ${fileId.slice(0, 6)}`,
      title: `Anime Reel ${fileId.slice(0, 6)}`,
      cleanTitle: 'Anime Reel',
      size: 'HD Video',
      date: 'Recent',
      folderId: '',
      folderName: 'Anime Edits',
      mimeType: 'video/mp4',
      url: `/api/reels/stream/${fileId}`,
      streamProxyUrl: `/api/reels/stream/${fileId}`,
      downloadProxyUrl: `/api/reels/download/${fileId}`,
      thumbnailUrl: `/api/reels/thumbnail/${fileId}`,
    };
    res.json({ success: true, reel: synthetic });
    return;
  }
  res.status(404).json({ success: false, error: 'Reel not found' });
});

// Video Streaming Endpoint with JSON-mode, 302 redirects, HEAD support & optional proxy
const handleStreamRequest = async (req: Request, res: Response) => {
  const fileId = resolveReelFileId(req.params.id);
  if (!fileId || fileId.length < 15) {
    res.status(400).json({ error: 'Invalid file id' });
    return;
  }

  const targetUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;

  // Common media headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Content-Length,Accept-Ranges,Content-Disposition,Location');
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

  // Detect JSON-mode
  const wantsJson =
    (req.headers.accept || '').includes('application/json') ||
    (req.headers['x-requested-with'] || '').toString().toLowerCase() === 'xmlhttprequest' ||
    req.query.json === '1' ||
    req.query.format === 'json';

  // Explicit proxy mode (only if client explicitly requests ?proxy=1)
  if (req.query.proxy === '1') {
    const cached = reelsBufferCache.get(fileId);
    if (cached) {
      cached.lastAccessed = Date.now();
      const length = cached.length;
      const contentType = cached.contentType;
      const range = req.headers.range;

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', contentType);

      if (req.method === 'HEAD') {
        res.setHeader('Content-Length', length);
        res.status(200).end();
        return;
      }

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : length - 1;

        if (start >= length || end >= length || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${length}`).end();
          return;
        }

        const chunk = cached.buffer.subarray(start, end + 1);
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${length}`);
        res.setHeader('Content-Length', chunk.length);
        res.end(chunk);
        return;
      } else {
        res.status(200);
        res.setHeader('Content-Length', length);
        res.end(cached.buffer);
        return;
      }
    }

    // Forward proxy if requested
    try {
      const forwardHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://drive.google.com/',
      };
      if (req.headers.range) forwardHeaders['Range'] = req.headers.range as string;

      let remoteRes = await fetch(targetUrl, { headers: forwardHeaders, redirect: 'follow' });
      if (!remoteRes.ok && remoteRes.status !== 206) {
        remoteRes = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, {
          headers: forwardHeaders,
          redirect: 'follow',
        });
      }

      if (remoteRes.ok || remoteRes.status === 206) {
        res.status(remoteRes.status);
        res.setHeader('Content-Type', remoteRes.headers.get('content-type') || 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        const cr = remoteRes.headers.get('content-range');
        if (cr) res.setHeader('Content-Range', cr);
        const cl = remoteRes.headers.get('content-length');
        if (cl) res.setHeader('Content-Length', cl);

        if (req.method === 'HEAD') {
          res.end();
          return;
        }

        if (remoteRes.body) {
          const stream = await import('stream');
          const nodeStream = stream.Readable.fromWeb(remoteRes.body as any);
          nodeStream.pipe(res);
          return;
        }
      }
    } catch {
      // Fall through to redirect
    }
  }

  // If JSON-mode requested (mobile APK / fetch client)
  if (wantsJson) {
    console.info(`[Media Redirect JSON] stream fileId=${fileId} -> ${targetUrl}`);
    if (req.method === 'HEAD') {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).end();
      return;
    }
    res.json({
      success: true,
      fileId,
      streamUrl: targetUrl,
      supportsRange: true,
    });
    return;
  }

  // Standard redirect mode (for browser <video src> elements)
  console.info(`[Media Redirect 302] stream fileId=${fileId} -> ${targetUrl}`);
  res.setHeader('Location', targetUrl);
  if (req.method === 'HEAD') {
    res.status(302).end();
    return;
  }
  res.redirect(302, targetUrl);
};

router.get('/reels/stream/:id', handleStreamRequest);
router.head('/reels/stream/:id', handleStreamRequest);

// Download Reel with JSON-mode & 302 redirect
const handleDownloadRequest = async (req: Request, res: Response) => {
  const fileId = resolveReelFileId(req.params.id);
  if (!fileId || fileId.length < 15) {
    res.status(400).json({ error: 'Invalid file id' });
    return;
  }

  const matched = inMemoryReels.find(r => r.id === fileId);
  const cleanTitle = matched?.cleanTitle || matched?.title || `Anime_Reel_${fileId.slice(0, 6)}`;
  const filename = `${cleanTitle.replace(/[^a-zA-Z0-9_\-]/g, '_')}.mp4`;
  const targetUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Content-Length,Accept-Ranges,Content-Disposition,Location');
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

  // Detect JSON-mode
  const wantsJson =
    (req.headers.accept || '').includes('application/json') ||
    (req.headers['x-requested-with'] || '').toString().toLowerCase() === 'xmlhttprequest' ||
    req.query.json === '1' ||
    req.query.format === 'json';

  if (wantsJson) {
    console.info(`[Media Redirect JSON] download fileId=${fileId} -> ${targetUrl}`);
    if (req.method === 'HEAD') {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).end();
      return;
    }
    res.json({
      success: true,
      fileId,
      filename,
      downloadUrl: targetUrl,
      supportsRange: true,
    });
    return;
  }

  console.info(`[Media Redirect 302] download fileId=${fileId} -> ${targetUrl}`);
  res.setHeader('Location', targetUrl);
  if (req.method === 'HEAD') {
    res.status(302).end();
    return;
  }
  res.redirect(302, targetUrl);
};

router.get('/reels/download/:id', handleDownloadRequest);
router.head('/reels/download/:id', handleDownloadRequest);

// Secure Thumbnail with JSON-mode & 302 redirect
const handleThumbnailRequest = async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const fileId = resolveReelFileId(rawId) || rawId;

  if (!fileId || fileId.length < 10) {
    res.status(400).json({ error: 'Invalid file id' });
    return;
  }

  const targetUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Content-Length,Accept-Ranges,Content-Disposition,Location');
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

  // Detect JSON-mode
  const wantsJson =
    (req.headers.accept || '').includes('application/json') ||
    (req.headers['x-requested-with'] || '').toString().toLowerCase() === 'xmlhttprequest' ||
    req.query.json === '1' ||
    req.query.format === 'json';

  if (wantsJson) {
    console.info(`[Media Redirect JSON] thumbnail fileId=${fileId} -> ${targetUrl}`);
    if (req.method === 'HEAD') {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).end();
      return;
    }
    res.json({
      success: true,
      fileId,
      thumbnailUrl: targetUrl,
    });
    return;
  }

  // If local RAM cached thumbnail is available and proxy is explicitly requested
  if (req.query.proxy === '1') {
    try {
      const cached = await fetchAndCacheReelThumbnail(fileId);
      if (cached && cached.buffer) {
        res.setHeader('Content-Type', cached.contentType || 'image/jpeg');
        res.setHeader('Content-Length', cached.buffer.length);
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        res.end(cached.buffer);
        return;
      }
    } catch {}
  }

  console.info(`[Media Redirect 302] thumbnail fileId=${fileId} -> ${targetUrl}`);
  res.setHeader('Location', targetUrl);
  if (req.method === 'HEAD') {
    res.status(302).end();
    return;
  }
  res.redirect(302, targetUrl);
};

router.get('/reels/thumbnail/:id', handleThumbnailRequest);
router.head('/reels/thumbnail/:id', handleThumbnailRequest);

// Preload and buffer upcoming reels & thumbnails
router.post('/reels/preload', (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : (req.body?.id ? [req.body.id] : []);
  const validIds = ids.filter(id => id && typeof id === 'string' && id.length > 15).slice(0, 6);

  for (const id of validIds) {
    fetchAndCacheReelThumbnail(id).catch(() => {});
    fetchAndCacheReelVideo(id).catch(() => {});
  }

  res.json({ success: true, preloading: validIds });
});

// Trigger Drive Sync
router.post('/reels/sync', async (_req, res) => {
  try {
    performFullDriveSync().catch(e => console.error('[Reels Sync Background Error]:', e));
    res.json({ success: true, message: 'Drive scan initiated in background.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to trigger drive sync' });
  }
});

export default router;
