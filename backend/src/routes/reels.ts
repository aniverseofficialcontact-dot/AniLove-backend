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

// Video Streaming Proxy for Google Drive Video Reels with Range Headers & HEAD support
const handleStreamRequest = async (req: Request, res: Response, isHeadOnly = false) => {
  const fileId = resolveReelFileId(req.params.id);
  if (!fileId || fileId.length < 15) {
    res.status(400).send('Invalid file id');
    return;
  }

  // 1. Check if video is already buffered in fast RAM cache
  const cached = reelsBufferCache.get(fileId);
  if (cached) {
    cached.lastAccessed = Date.now();
    const length = cached.length;
    const contentType = cached.contentType;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Content-Length,Accept-Ranges,Content-Disposition');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

    if (isHeadOnly) {
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

  // 2. Trigger asynchronous background caching into RAM for future requests
  fetchAndCacheReelVideo(fileId).catch(() => {});

  // 3. Fallback: Direct Streaming Proxy from Google Drive with immediate chunk piping
  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  try {
    const targetUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': 'https://drive.google.com/',
    };

    if (req.headers.range) {
      forwardHeaders['Range'] = req.headers.range as string;
    }

    let remoteRes = await fetch(targetUrl, {
      headers: forwardHeaders,
      redirect: 'follow',
      signal: abortController.signal,
    });

    if (!remoteRes.ok && remoteRes.status !== 206) {
      remoteRes = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, {
        headers: forwardHeaders,
        redirect: 'follow',
        signal: abortController.signal,
      });
    }

    if (!remoteRes.ok && remoteRes.status !== 206) {
      res.status(remoteRes.status || 404).send('Failed to stream video');
      return;
    }

    res.status(remoteRes.status);
    res.setHeader('Content-Type', remoteRes.headers.get('content-type') || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Content-Length,Accept-Ranges,Content-Disposition');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

    const contentRange = remoteRes.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);

    const contentLength = remoteRes.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    if (isHeadOnly) {
      res.end();
      return;
    }

    if (remoteRes.body) {
      const stream = await import('stream');
      const nodeStream = stream.Readable.fromWeb(remoteRes.body as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err: any) {
    if (err.name === 'AbortError' || err.code === 'ECONNRESET' || err.code === 'EPIPE') return;
    if (!res.headersSent) {
      res.status(500).send('Stream proxy failure');
    }
  }
};

router.get('/reels/stream/:id', (req, res) => handleStreamRequest(req, res, false));
router.head('/reels/stream/:id', (req, res) => handleStreamRequest(req, res, true));

// Download Reel with proper attachment headers
router.get('/reels/download/:id', async (req, res) => {
  const fileId = resolveReelFileId(req.params.id);
  if (!fileId || fileId.length < 15) {
    res.status(400).send('Invalid file id');
    return;
  }

  const matched = inMemoryReels.find(r => r.id === fileId);
  const cleanTitle = matched?.cleanTitle || matched?.title || `Anime_Reel_${fileId.slice(0, 6)}`;
  const filename = `${cleanTitle.replace(/[^a-zA-Z0-9_\-]/g, '_')}.mp4`;

  try {
    const targetUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': 'https://drive.google.com/',
    };

    let remoteRes = await fetch(targetUrl, { headers: forwardHeaders, redirect: 'follow' });
    if (!remoteRes.ok) {
      remoteRes = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, {
        headers: forwardHeaders,
        redirect: 'follow',
      });
    }

    if (!remoteRes.ok) {
      res.status(remoteRes.status || 404).send('Failed to fetch reel file for download');
      return;
    }

    res.status(remoteRes.status);
    res.setHeader('Content-Type', remoteRes.headers.get('content-type') || 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const contentLength = remoteRes.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    if (remoteRes.body) {
      const stream = await import('stream');
      const nodeStream = stream.Readable.fromWeb(remoteRes.body as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err: any) {
    console.warn(`[Reels Download Proxy] Download error for ${fileId}:`, err.message);
    if (!res.headersSent) {
      res.status(500).send('Download proxy failure');
    }
  }
});

// Secure Thumbnail Proxy with RAM Caching & Google Drive fallback
router.get('/reels/thumbnail/:id', async (req, res) => {
  const rawId = req.params.id;
  const fileId = resolveReelFileId(rawId) || rawId;

  try {
    if (fileId && fileId.length >= 10) {
      const cached = await fetchAndCacheReelThumbnail(fileId);
      if (cached && cached.buffer) {
        res.setHeader('Content-Type', cached.contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.setHeader('Content-Length', cached.buffer.length);
        res.end(cached.buffer);
        return;
      }
    }
  } catch (err: any) {
    console.warn(`[Reels Thumbnail] Error fetching ${fileId}:`, err.message);
  }

  // Fallback to og-banner if reel thumbnail is unavailable
  try {
    const fallbackPath = path.join(process.cwd(), 'public/og-banner.jpg');
    if (fs.existsSync(fallbackPath)) {
      const buf = fs.readFileSync(fallbackPath);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', buf.length);
      res.end(buf);
      return;
    }
  } catch {}

  if (!res.headersSent) res.status(404).send('Thumbnail not found');
});

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
