import { extractDirectStreamFromEmbed } from './directVideoResolver';

export interface RenimeStreamResult {
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

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * TRUE RENIME RESOLVER
 * Specialized in Indian regional multi-audio extraction (Hindi, Tamil, Telugu).
 * Targets AnimeSalt and WatchAnimeWorld using dedicated extraction logic.
 */
export async function resolveRenimeStream(params: {
  animeTitle?: string;
  englishTitle?: string;
  romajiTitle?: string;
  episodeNumber?: number;
  language?: string;
  serverName?: string;
}): Promise<RenimeStreamResult> {
  const epNum = Number(params.episodeNumber) || 1;
  const reqLang = String(params.language || 'HIN').toUpperCase();
  const searchTitle = params.englishTitle || params.animeTitle || 'Anime';

  // Renime-specific search domains (targeting AnimeSalt sources)
  const RENIME_DOMAINS = [
    'https://animesalt.link',
    'https://watchanimeworld.top',
  ];

  const slug = searchTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Renime Engine: Resolves multi-audio links directly from its catalog
  const availableServers = [
    {
      name: 'Renime Ultra (Multi-Audio)',
      type: reqLang,
      linkId: `https://play.zephyrix.org/video/${slug}-episode-${epNum}`
    },
    {
      name: 'Renime Edge (Hindi Mirror)',
      type: reqLang,
      linkId: `https://watchanimeworld.top/episode/${slug}-episode-${epNum}`
    }
  ];

  let chosenServer = availableServers[0];
  if (params.serverName) {
    const matched = availableServers.find(s => s.name.toLowerCase().includes(params.serverName!.toLowerCase()));
    if (matched) chosenServer = matched;
  }

  try {
    // 1. Perform search to find the correct entry first
    const searchUrl = `https://watchanimeworld.top/?s=${encodeURIComponent(searchTitle)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT, Referer: 'https://watchanimeworld.top/' },
      signal: AbortSignal.timeout(5000),
    });

    const candidates = [
       `https://watchanimeworld.top/episode/${slug}-episode-${epNum}`,
       `https://watchanimeworld.top/episode/${slug}-1x${epNum}`,
       `https://watchanimeworld.top/episode/${slug}-s${getSeasonNumber(searchTitle)}-e${epNum}`
    ];

    if (searchRes.ok) {
       const html = await searchRes.text();
       const linkMatch = html.match(/<a\s+[^>]*href=["'](https?:\/\/watchanimeworld\.top\/(?:series|anime)\/[^"']*)["']/i);
       if (linkMatch) {
         const baseSeriesUrl = linkMatch[1];
         const seriesSlug = baseSeriesUrl.split('/').filter(Boolean).pop();
         candidates.unshift(`https://watchanimeworld.top/episode/${seriesSlug}-episode-${epNum}`);
       }
    }

    // Try each candidate until one works
    let extracted = null;
    for (const url of candidates) {
       try {
          extracted = await extractDirectStreamFromEmbed(url);
          if (extracted?.streamUrl) break;
       } catch { continue; }
    }

    if (!extracted?.streamUrl) throw new Error('All Renime URL candidates failed');

    return {
      success: true,
      streamUrl: extracted.streamUrl,
      directStreamUrl: extracted.streamUrl,
      embedUrl: candidates[0],
      isDirectVideo: true,
      availableServers: [{ name: 'Renime Direct', type: reqLang, linkId: extracted.streamUrl }],
      availableLanguages: ['HIN', 'DUB', 'SUB'],
      selectedServer: 'Renime Direct',
      language: reqLang,
      provider: 'renime'
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Renime engine failed to extract regional stream',
      status: 500
    };
  }
}

function getSeasonNumber(title: string): number {
  const t = title.toLowerCase();
  const m = t.match(/season\s*(\d+)/i) || t.match(/s(\d+)/i);
  return m ? parseInt(m[1]) : 1;
}
