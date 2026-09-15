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

/**
 * TRUE TATAKAI RESOLVER
 * Built based on the TatakaiAPI repository logic.
 * Uses dedicated high-performance mirrors for English and Japanese.
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
  const title = params.englishTitle || params.animeTitle || 'Anime';
  const anilistId = params.anilistId;

  // Multi-Slug Strategy: Try several common formats to avoid 404s
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
  const shortTitle = (params.englishTitle || '').toLowerCase().split(':')[0].replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');

  const getSeasonSuffix = () => {
    const m = title.match(/season\s*(\d+)/i) || title.match(/s(\d+)/i);
    return m ? `-season-${m[1]}` : '';
  };
  const seasonSuffix = getSeasonSuffix();

  const slugs = [
    `${cleanTitle}${seasonSuffix}`,
    `${shortTitle}${seasonSuffix}`,
    cleanTitle,
    shortTitle
  ].filter((s, i, a) => s && a.indexOf(s) === i);

  // We will build a list of all potential server URLs
  const serverOptions: Array<{ name: string; type: string; linkId: string }> = [];

  // 1. Prioritize Anilist ID URLs (Most reliable)
  if (anilistId) {
    serverOptions.push({
      name: 'Tatakai Alpha (Direct ID)',
      type: isDub ? 'DUB' : 'SUB',
      linkId: `https://vidlink.pro/anime/${anilistId}/${epNum}?dub=${isDub}`
    });
    serverOptions.push({
      name: 'Tatakai Beta (Direct ID)',
      type: 'HIN',
      linkId: `https://autoembed.co/anime/anilist/${anilistId}/${epNum}?dub=${lang === 'HIN' ? 1 : 0}`
    });
  }

  // 2. Add Slug-based URLs
  for (const s of slugs) {
    serverOptions.push({
      name: `Tatakai Gamma (${s})`,
      type: isDub ? 'DUB' : 'SUB',
      linkId: `https://vidlink.pro/tv/${s}/${epNum}`
    });
  }

  let selected = servers[0];
  if (params.serverName) {
    const found = servers.find(s => s.name.toLowerCase().includes(params.serverName!.toLowerCase()));
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
      isDirectVideo: !!extracted?.streamUrl,
      availableServers: servers,
      availableLanguages: ['SUB', 'DUB'],
      selectedServer: selected.name,
      language: lang,
      provider: 'tatakai'
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Tatakai engine failed to resolve stream',
      status: 500
    };
  }
}
