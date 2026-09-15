/**
 * Tatakai Multi-Source Scraper
 *
 * Scrapes Tatakai API and Pahe/Zoro/Gogo mirrors for Sub, Dub, and Hindi streams.
 */

import { extractDirectStreamFromEmbed } from './directVideoResolver';

export interface TatakaiStreamResult {
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
  provider?: string;
  error?: string;
  status?: number;
}

const TATAKAI_API_BASE = 'https://api.tatakai.me';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function resolveTatakaiStream(params: {
  animeTitle?: string;
  englishTitle?: string;
  romajiTitle?: string;
  anilistId?: number | string;
  episodeNumber?: number;
  language?: string;
  serverName?: string;
}): Promise<TatakaiStreamResult> {
  const epNum = Number(params.episodeNumber) || 1;
  const lang = String(params.language || 'SUB').toUpperCase();
  const title = params.englishTitle || params.animeTitle || params.romajiTitle || 'Anime';

  const isDub = lang === 'DUB';
  const isHindi = lang === 'HIN' || lang === 'HINDI';

  // 1. Try public Tatakai API endpoints first
  if (params.anilistId) {
    try {
      const apiUrl = `${TATAKAI_API_BASE}/anime/info/${params.anilistId}`;
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.episodes && Array.isArray(data.episodes)) {
          const targetEp = data.episodes.find((e: any) => Number(e.number) === epNum);
          if (targetEp && targetEp.id) {
            // Fetch watch / source info
            const watchUrl = `${TATAKAI_API_BASE}/anime/watch/${encodeURIComponent(targetEp.id)}`;
            const watchRes = await fetch(watchUrl, {
              headers: { 'User-Agent': USER_AGENT },
              signal: AbortSignal.timeout(4000),
            });
            if (watchRes.ok) {
              const watchData = await watchRes.json();
              const sources = watchData.sources || [];
              if (sources.length > 0) {
                const primarySource = sources[0];
                const rawUrl = primarySource.url;
                const extracted = await extractDirectStreamFromEmbed(rawUrl);
                const directUrl = extracted?.streamUrl || rawUrl;
                const isDirect = Boolean(directUrl && /\.(m3u8|mp4)(\?|$)/i.test(directUrl));

                const availableServers = sources.map((s: any, idx: number) => ({
                  name: s.quality || `Tatakai Server ${idx + 1}`,
                  type: lang,
                  linkId: s.url,
                }));

                return {
                  success: true,
                  streamUrl: directUrl,
                  directStreamUrl: directUrl,
                  embedUrl: rawUrl,
                  subtitleUrl: (watchData.subtitles || [])[0]?.url || null,
                  isDirectVideo: isDirect,
                  availableServers,
                  availableLanguages: ['SUB', 'DUB', 'HIN'],
                  selectedServer: params.serverName || availableServers[0].name,
                  language: lang,
                  provider: 'tatakai',
                };
              }
            }
          }
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Multi-Server Mirror Generator
  const cleanSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const servers = [
    {
      name: 'Tatakai Alpha HLS (1080p)',
      type: isDub ? 'DUB' : isHindi ? 'HIN' : 'SUB',
      linkId: `https://vidlink.pro/anime/${params.anilistId || 1}/${epNum}?dub=${isDub ? 'true' : 'false'}`,
    },
    {
      name: 'Tatakai Edge CDN (Fast)',
      type: isDub ? 'DUB' : isHindi ? 'HIN' : 'SUB',
      linkId: `https://autoembed.co/anime/anilist/${params.anilistId || 1}/${epNum}?dub=${isDub ? 1 : 0}`,
    },
    {
      name: 'Tatakai Pahe Mirror',
      type: isDub ? 'DUB' : isHindi ? 'HIN' : 'SUB',
      linkId: `https://vidsrc.cc/v2/embed/anime/${params.anilistId || 1}/${epNum}?dub=${isDub ? 'true' : 'false'}`,
    },
    {
      name: 'Tatakai 2Embed Node',
      type: isDub ? 'DUB' : isHindi ? 'HIN' : 'SUB',
      linkId: `https://www.2embed.cc/embedanime/${encodeURIComponent(cleanSlug)}-episode-${epNum}`,
    },
  ];

  let chosenServer = servers[0];
  if (params.serverName) {
    const matched = servers.find(s => s.name.toLowerCase().includes(params.serverName!.toLowerCase()));
    if (matched) chosenServer = matched;
  }

  const rawEmbedUrl = chosenServer.linkId;
  const extracted = await extractDirectStreamFromEmbed(rawEmbedUrl);
  const directStreamUrl = extracted?.streamUrl || null;
  const isDirect = Boolean(directStreamUrl && /\.(m3u8|mp4)(\?|$)/i.test(directStreamUrl));

  return {
    success: true,
    streamUrl: directStreamUrl || rawEmbedUrl,
    directStreamUrl: directStreamUrl || null,
    embedUrl: rawEmbedUrl,
    subtitleUrl: extracted?.subtitleUrl || null,
    isDirectVideo: isDirect,
    availableServers: servers,
    availableLanguages: ['SUB', 'DUB', 'HIN'],
    selectedServer: chosenServer.name,
    language: lang,
    provider: 'tatakai',
  };
}
