import { extractDirectStreamFromEmbed } from './directVideoResolver';
import { resolveIndianStream } from './animeworldIndiaScraper';
import { resolveAnikotoInternal } from './anikotoScraper';

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
  skipData?: { intro: [number, number]; outro: [number, number] };
  error?: string;
  status?: number;
}

const JUSTANIME_BASE = 'https://core.justanime.to';
const JUSTANIME_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.5',
  'Origin': 'https://justanime.to',
  'Referer': 'https://justanime.to/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

/**
 * Fetch from Tatakai's JustAnime Core API (direct 1080p HLS / MP4 CDN)
 */
export async function fetchJustAnimeSource(anilistId: number | string, episode: number, isDub: boolean): Promise<{
  streamUrl: string;
  isHls: boolean;
  subtitleUrl?: string;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
} | null> {
  const servers = ['megaplay', 'animegg'];
  for (const sv of servers) {
    try {
      const url = `${JUSTANIME_BASE}/api/watch/${anilistId}/episode/${episode}/${sv}`;
      const res = await fetch(url, {
        headers: JUSTANIME_HEADERS,
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = await res.json() as any;
      const streamObj = isDub ? (data.dub || data.sub) : (data.sub || data.dub);
      if (streamObj && Array.isArray(streamObj.sources) && streamObj.sources.length > 0) {
        const hls = streamObj.sources.find((s: any) => s.isM3U8 && s.url);
        const best = hls || streamObj.sources[0];
        if (best?.url) {
          const subTracks = Array.isArray(streamObj.subtitles) ? streamObj.subtitles : [];
          const engSub = subTracks.find((s: any) => s.default === true || s.label?.toLowerCase().includes('english') || s.label?.toLowerCase().includes('eng'))?.file
            || subTracks.find((s: any) => s.file?.toLowerCase().includes('eng'))?.file
            || subTracks[0]?.file;
          return {
            streamUrl: best.url,
            isHls: Boolean(best.isM3U8 || best.url.includes('.m3u8')),
            subtitleUrl: engSub,
            intro: streamObj.intro,
            outro: streamObj.outro,
          };
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * TRUE TATAKAI RESOLVER
 * Integrated with TatakaiAPI engine (JustAnime Core + VidLink + AutoEmbed + Indian Regional Engine).
 * Supports English Sub, English Dub, Hindi, Tamil, Telugu in real-time.
 */
export async function resolveTatakaiStream(params: {
  animeTitle?: string;
  englishTitle?: string;
  romajiTitle?: string;
  anilistId?: number | string;
  episodeNumber?: number;
  language?: string;
  serverName?: string;
  format?: string;
}): Promise<TatakaiStreamResult> {
  const epNum = Number(params.episodeNumber) || 1;
  const lang = String(params.language || 'SUB').toUpperCase();
  const isDub = lang === 'DUB';
  const isIndian = ['HIN', 'TAM', 'TEL', 'MAL', 'BEN'].includes(lang);
  const title = params.englishTitle || params.animeTitle || params.romajiTitle || 'Anime';
  const anilistId = params.anilistId ? Number(params.anilistId) : null;

  // 1. IF INDIAN LANGUAGE REQUESTED ON TATAKAI (HINDI / TAMIL / TELUGU)
  if (isIndian) {
    try {
      const indianRes = await resolveIndianStream({
        anilistId: anilistId || undefined,
        animeTitle: title,
        englishTitle: params.englishTitle,
        romajiTitle: params.romajiTitle,
        episodeNumber: epNum,
        language: lang,
        serverName: params.serverName,
        format: params.format,
      });

      if (indianRes.success && indianRes.streamUrl) {
        return {
          ...indianRes,
          provider: 'tatakai',
          availableLanguages: ['SUB', 'DUB', 'HIN', 'TAM', 'TEL'],
        };
      }
    } catch {}
  }

  // 2. TATAKAI JUSTANIME CORE CDN RESOLUTION (SUB & DUB)
  if (anilistId) {
    const justAnime = await fetchJustAnimeSource(anilistId, epNum, isDub);
    if (justAnime) {
      return {
        success: true,
        streamUrl: justAnime.streamUrl,
        directStreamUrl: justAnime.streamUrl,
        embedUrl: justAnime.streamUrl,
        subtitleUrl: justAnime.subtitleUrl || null,
        isDirectVideo: justAnime.isHls,
        availableServers: [
          { name: `Tatakai Direct HLS (${isDub ? 'DUB' : 'SUB'})`, type: isDub ? 'DUB' : 'SUB', linkId: justAnime.streamUrl },
          { name: 'Tatakai VidLink Node', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidlink.pro/anime/${anilistId}/${epNum}?dub=${isDub}` },
          { name: 'Tatakai AutoEmbed Node', type: 'HIN', linkId: `https://autoembed.co/anime/anilist/${anilistId}/${epNum}?dub=1` },
        ],
        availableLanguages: ['SUB', 'DUB', 'HIN', 'TAM', 'TEL'],
        selectedServer: `Tatakai Direct HLS (${isDub ? 'DUB' : 'SUB'})`,
        language: lang,
        provider: 'tatakai',
        skipData: justAnime.intro
          ? { intro: [justAnime.intro.start || 0, justAnime.intro.end || 0], outro: [justAnime.outro?.start || 0, justAnime.outro?.end || 0] }
          : undefined,
      };
    }
  }

  // 3. TATAKAI EMBED RESOLVER (Vidlink / Autoembed / SmashyStream)
  const serverOptions: Array<{ name: string; type: string; linkId: string }> = [];

  if (anilistId) {
    serverOptions.push({
      name: 'Tatakai Alpha (VidLink)',
      type: isDub ? 'DUB' : 'SUB',
      linkId: `https://vidlink.pro/anime/${anilistId}/${epNum}?dub=${isDub}`,
    });
    serverOptions.push({
      name: 'Tatakai Beta (AutoEmbed)',
      type: isIndian ? lang : (isDub ? 'DUB' : 'SUB'),
      linkId: `https://autoembed.co/anime/anilist/${anilistId}/${epNum}?dub=${isDub || isIndian ? 1 : 0}`,
    });
    serverOptions.push({
      name: 'Tatakai Gamma (SmashyStream)',
      type: isDub ? 'DUB' : 'SUB',
      linkId: `https://player.smashystream.com/anime/${anilistId}/${epNum}`,
    });
  }

  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
  serverOptions.push({
    name: 'Tatakai Delta (Direct Embed)',
    type: isDub ? 'DUB' : 'SUB',
    linkId: `https://vidlink.pro/tv/${cleanTitle}/${epNum}`,
  });

  let selected = serverOptions[0];
  if (params.serverName) {
    const found = serverOptions.find(s => s.name.toLowerCase().includes(params.serverName!.toLowerCase()));
    if (found) selected = found;
  }

  try {
    const rawUrl = selected.linkId;
    const extracted = await extractDirectStreamFromEmbed(rawUrl);

    return {
      success: true,
      streamUrl: extracted?.streamUrl || rawUrl,
      directStreamUrl: extracted?.streamUrl || null,
      embedUrl: rawUrl,
      subtitleUrl: extracted?.subtitleUrl || null,
      isDirectVideo: Boolean(extracted?.streamUrl),
      availableServers: serverOptions,
      availableLanguages: ['SUB', 'DUB', 'HIN', 'TAM', 'TEL'],
      selectedServer: selected.name,
      language: lang,
      provider: 'tatakai',
    };
  } catch (err: any) {
    try {
      const anikotoFallback = await resolveAnikotoInternal({
        anilistId: anilistId || undefined,
        animeTitle: title,
        englishTitle: params.englishTitle,
        romajiTitle: params.romajiTitle,
        episodeNumber: epNum,
        language: isDub ? 'DUB' : 'SUB',
        serverName: params.serverName,
        format: params.format,
      });
      if (anikotoFallback.success && anikotoFallback.streamUrl) {
        return {
          ...anikotoFallback,
          provider: 'tatakai',
          availableLanguages: ['SUB', 'DUB', 'HIN', 'TAM', 'TEL'],
        };
      }
    } catch {}

    return {
      success: false,
      error: err.message || 'Tatakai engine failed to resolve stream',
      status: 500,
    };
  }
}
