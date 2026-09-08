import { Router } from 'express';
import { queryAnimeThemesFast } from '../services/themes';

const router = Router();

// Media Proxy for AnimeThemes audio & video streams (range header support)
router.get('/animethemes-media', async (req, res) => {
  try {
    const rawUrl = (req.query.url as string) || '';
    if (!rawUrl || (!rawUrl.startsWith('https://a.animethemes.moe/') && !rawUrl.startsWith('https://v.animethemes.moe/'))) {
      res.status(400).send('Invalid or untrusted media url');
      return;
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://animethemes.moe/',
      'Accept': '*/*',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range as string;
    }

    const remoteRes = await fetch(rawUrl, { headers });

    res.status(remoteRes.status);

    const contentType = remoteRes.headers.get('content-type') || (rawUrl.endsWith('.ogg') ? 'audio/ogg' : 'video/webm');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

    const contentRange = remoteRes.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);

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
    console.error('AnimeThemes media proxy error:', err);
    if (!res.headersSent) {
      res.status(500).send('Media stream proxy error');
    }
  }
});

// AnimeThemes query
router.get('/animethemes-query', async (req, res) => {
  try {
    const title = (req.query.title as string) || '';
    const romaji = (req.query.romaji as string) || '';
    const english = (req.query.english as string) || '';
    const query = (req.query.query as string) || title || romaji || english;

    if (!query) {
      res.status(400).json({ error: 'Missing title query' });
      return;
    }

    const candidates = [romaji, title, english, query];
    const foundAnime = await queryAnimeThemesFast(candidates);

    if (foundAnime) {
      const themes = (foundAnime.animethemes || []).map((t: any) => {
        const entry = t.animethemeentries?.[0];
        const video = entry?.videos?.[0];
        const audio = video?.audio;
        const audioLink = audio?.link;
        const videoLink = video?.link;

        return {
          id: t.id,
          type: t.type as 'OP' | 'ED',
          slug: t.slug || `${t.type}${t.sequence || 1}`,
          sequence: t.sequence || 1,
          songTitle: t.song?.title || `${foundAnime.name} ${t.slug || t.type}`,
          artists: (t.song?.artists || []).map((a: any) => a.name).join(', ') || undefined,
          audioUrl: audioLink ? `/api/animethemes-media?url=${encodeURIComponent(audioLink)}` : undefined,
          videoUrl: videoLink ? `/api/animethemes-media?url=${encodeURIComponent(videoLink)}` : undefined,
          rawAudioUrl: audioLink,
          rawVideoUrl: videoLink,
          animeName: foundAnime.name,
          episodes: entry?.episodes || undefined,
        };
      });

      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.json({
        success: true,
        animeName: foundAnime.name,
        themes,
      });
      return;
    }

    res.json({ success: false, animeName: null, themes: [] });
  } catch (err: any) {
    console.error('AnimeThemes query error:', err);
    res.status(500).json({ error: 'AnimeThemes query failed', details: err.message });
  }
});

// Full Track endpoint pointing to AnimeThemes
router.get('/theme-full-track', async (req, res) => {
  try {
    const query = (req.query.query as string) || '';
    if (!query) {
      res.status(400).json({ error: 'Missing query' });
      return;
    }

    const cleaned = query.replace(/full song|opening|ending|theme|anime|OP\d*|ED\d*/gi, '').trim();
    const candidates = [cleaned, query].filter(Boolean);
    const isED = /ending|ED/i.test(query);

    const foundAnime = await queryAnimeThemesFast(candidates);

    if (foundAnime && foundAnime.animethemes && foundAnime.animethemes.length > 0) {
      const matchedTheme = foundAnime.animethemes.find((t: any) => isED ? t.type === 'ED' : t.type === 'OP') || foundAnime.animethemes[0];

      if (matchedTheme) {
        const entry = matchedTheme.animethemeentries?.[0];
        const video = entry?.videos?.[0];
        const audio = video?.audio;
        const audioLink = audio?.link;
        const videoLink = video?.link;

        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.json({
          title: matchedTheme.song?.title ? `${matchedTheme.slug || matchedTheme.type}: ${matchedTheme.song.title}` : `${foundAnime.name} ${matchedTheme.slug || matchedTheme.type}`,
          artists: (matchedTheme.song?.artists || []).map((a: any) => a.name).join(', '),
          audioUrl: audioLink ? `/api/animethemes-media?url=${encodeURIComponent(audioLink)}` : undefined,
          videoUrl: videoLink ? `/api/animethemes-media?url=${encodeURIComponent(videoLink)}` : undefined,
          rawAudioUrl: audioLink,
          rawVideoUrl: videoLink,
          fullTrack: true,
          animeName: foundAnime.name,
          themeSlug: matchedTheme.slug,
        });
        return;
      }
    }

    res.json({ fullTrack: false, audioUrl: null, videoUrl: null });
  } catch (err: any) {
    console.error('AnimeThemes full track error:', err);
    res.status(500).json({ error: 'AnimeThemes full track failed', details: err.message });
  }
});

// Theme Preview
router.get('/theme-preview', async (req, res) => {
  try {
    const query = (req.query.query as string) || '';
    if (!query) {
      res.status(400).json({ error: 'Missing query' });
      return;
    }

    const cleaned = query.replace(/full song|opening|ending|theme|anime|OP\d*|ED\d*/gi, '').trim();
    const isED = /ending|ED/i.test(query);
    const foundAnime = await queryAnimeThemesFast([cleaned, query].filter(Boolean));

    if (foundAnime && foundAnime.animethemes && foundAnime.animethemes.length > 0) {
      const matchedTheme = foundAnime.animethemes.find((t: any) => isED ? t.type === 'ED' : t.type === 'OP') || foundAnime.animethemes[0];

      if (matchedTheme) {
        const entry = matchedTheme.animethemeentries?.[0];
        const audioLink = entry?.videos?.[0]?.audio?.link;
        const videoLink = entry?.videos?.[0]?.link;

        if (audioLink || videoLink) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.json({
            trackName: matchedTheme.song?.title || `${foundAnime.name} ${matchedTheme.slug || matchedTheme.type}`,
            artistName: (matchedTheme.song?.artists || []).map((a: any) => a.name).join(', '),
            previewUrl: audioLink ? `/api/animethemes-media?url=${encodeURIComponent(audioLink)}` : undefined,
            videoUrl: videoLink ? `/api/animethemes-media?url=${encodeURIComponent(videoLink)}` : undefined,
            rawAudioUrl: audioLink,
            rawVideoUrl: videoLink,
          });
          return;
        }
      }
    }

    // Fallback to iTunes search preview
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleaned || query)}&media=music&entity=song&limit=1`;
    const itunesRes = await fetch(itunesUrl);
    const itunesData = await itunesRes.json();

    if (itunesData.results && itunesData.results.length > 0) {
      const song = itunesData.results[0];
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.json({
        trackName: song.trackName,
        artistName: song.artistName,
        previewUrl: song.previewUrl,
        artworkUrl: song.artworkUrl100,
      });
      return;
    }

    res.json({ previewUrl: null });
  } catch (err: any) {
    console.error('Theme preview error:', err);
    res.status(500).json({ error: 'Theme preview fetch failed', details: err.message });
  }
});

// Jikan + AnimeThemes Combined themes endpoint
router.get('/anime-themes', async (req, res) => {
  try {
    const title = (req.query.title as string) || '';
    const romaji = (req.query.romaji as string) || '';
    const english = (req.query.english as string) || '';
    const query = title || romaji || english;

    if (!query) {
      res.status(400).json({ error: 'Title required' });
      return;
    }

    const [jikanResult, animeThemesResult] = await Promise.allSettled([
      (async () => {
        const jikanRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`);
        const jikanData = await jikanRes.json();
        if (jikanData.data && jikanData.data.length > 0) {
          const malId = jikanData.data[0].mal_id;
          const tRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}/themes`);
          const tData = await tRes.json();
          return {
            openings: (tData.data?.openings || jikanData.data[0].theme?.openings || []) as string[],
            endings: (tData.data?.endings || jikanData.data[0].theme?.endings || []) as string[],
          };
        }
        return { openings: [], endings: [] };
      })(),
      queryAnimeThemesFast([romaji, title, english, query]),
    ]);

    const jikan = jikanResult.status === 'fulfilled' ? jikanResult.value : { openings: [], endings: [] };
    const foundAnime = animeThemesResult.status === 'fulfilled' ? animeThemesResult.value : null;

    let resolvedTracks: any[] = [];
    if (foundAnime && foundAnime.animethemes) {
      resolvedTracks = foundAnime.animethemes.map((t: any) => {
        const entry = t.animethemeentries?.[0];
        const video = entry?.videos?.[0];
        const audio = video?.audio;
        const audioLink = audio?.link;
        const videoLink = video?.link;

        return {
          id: t.id,
          type: t.type as 'OP' | 'ED',
          slug: t.slug || `${t.type}${t.sequence || 1}`,
          sequence: t.sequence || 1,
          songTitle: t.song?.title || `${foundAnime.name} ${t.slug || t.type}`,
          artists: (t.song?.artists || []).map((a: any) => a.name).join(', ') || undefined,
          audioUrl: audioLink ? `/api/animethemes-media?url=${encodeURIComponent(audioLink)}` : undefined,
          videoUrl: videoLink ? `/api/animethemes-media?url=${encodeURIComponent(videoLink)}` : undefined,
          rawAudioUrl: audioLink,
          rawVideoUrl: videoLink,
          animeName: foundAnime.name,
        };
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({
      openings: jikan.openings,
      endings: jikan.endings,
      resolvedTracks,
    });
  } catch (err: any) {
    console.error('Anime themes error:', err);
    res.status(500).json({ error: 'Failed to fetch themes', details: err.message });
  }
});

export default router;
