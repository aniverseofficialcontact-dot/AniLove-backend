import { Anime, StreamServerId } from '../types';
import { apiFetch } from './apiClient';

export type StreamLanguage = 'SUB' | 'DUB';
export type StreamResolution = 'auto' | '1080p' | '720p' | '480p';

export interface LanguageOption {
  code: StreamLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
  short: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'SUB', label: 'Japanese (Sub)', nativeLabel: '日本語', flag: '🇯🇵', short: 'JAP/SUB' },
  { code: 'DUB', label: 'English Dub', nativeLabel: 'English', flag: '🇺🇸', short: 'ENG/DUB' },
];

export interface StreamProvider {
  id: StreamServerId;
  label: string;
  category: 'anikoto' | 'anify' | 'tatakai' | 'miruro' | 'renime' | 'official';
  description: string;
  supportedLanguages: StreamLanguage[];
  tag?: string;
  serverMatch?: string;
  apiEndpoint?: string;
}

export interface SkipData {
  intro: [number, number]; // [startSec, endSec]
  outro: [number, number]; // [startSec, endSec]
}

export interface AvailableServerOption {
  name: string;
  type: string; // SUB, DUB
  linkId: string;
  providerId?: StreamServerId;
}

export interface StreamSource {
  provider: StreamProvider;
  url: string;
  language: StreamLanguage;
  resolution: StreamResolution;
  isEmbeddable: boolean;
  external: boolean;
  skipData?: SkipData;
  availableServers?: AvailableServerOption[];
  availableLanguages?: StreamLanguage[];
  selectedServerName?: string;
  isDubAvailable?: boolean;
  isFallback?: boolean;
  fallbackReason?: string;
  requestedLanguage?: StreamLanguage;
  actualLanguage?: StreamLanguage;
}

export type StreamSourceStatus = 'available' | 'unavailable' | 'error';

export interface ResolveEpisodeSourceInput {
  anime: Anime;
  episodeNumber: number;
  providerId?: StreamServerId | string;
  language?: StreamLanguage;
  resolution?: StreamResolution;
  serverName?: string;
}

export interface ResolveEpisodeSourceResult {
  status: StreamSourceStatus;
  source?: StreamSource;
  message?: string;
}

// 1. Anikoto HD Servers (1080p Master & Bufferless CDN)
const ANIKOTO_HD1: StreamProvider = {
  id: 'anikoto-hd1',
  label: 'Anikoto HD-1',
  category: 'anikoto',
  description: 'Primary 1080p high bitrate server from Anikoto (Eng Dub & Jap Sub).',
  supportedLanguages: ['SUB', 'DUB'],
  tag: '1080p Master',
  serverMatch: 'HD-1',
};

const ANIKOTO_VIDSTREAM: StreamProvider = {
  id: 'anikoto-vidstream',
  label: 'Anikoto Vidstream',
  category: 'anikoto',
  description: 'Fast bufferless CDN stream with auto intro/outro skip.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Fast CDN',
  serverMatch: 'Vidstream',
};

const ANIKOTO_VIDPLAY: StreamProvider = {
  id: 'anikoto-vidplay',
  label: 'Anikoto VidPlay',
  category: 'anikoto',
  description: 'High-speed video player with dual sub & dub tracks.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Dual Audio',
  serverMatch: 'VidPlay',
};

const ANIKOTO_HD2: StreamProvider = {
  id: 'anikoto-hd2',
  label: 'Anikoto HD-2',
  category: 'anikoto',
  description: 'Secondary high-definition server mirror.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Backup Mirror',
  serverMatch: 'HD-2',
};

const ANIKOTO_ULTRA: StreamProvider = {
  id: 'anikoto',
  label: 'Anikoto Ultra HD',
  category: 'anikoto',
  description: 'Smart load-balanced master stream node.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Ultra Master',
};

// 2. Anify API (Eltik Meta-Engine)
const ANIFY_CLOUD: StreamProvider = {
  id: 'anify-cloud',
  label: 'Anify Media Cloud',
  category: 'anify',
  description: 'Eltik multi-scraper engine with AniList mapping & multi-source mirrors.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Anify API',
  apiEndpoint: '/api/anify/resolve',
};

const ANIFY_FAST: StreamProvider = {
  id: 'anify-fast',
  label: 'Anify Fast Mirror',
  category: 'anify',
  description: 'High-bandwidth edge CDN powered by Anify provider mapping.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Edge CDN',
  apiEndpoint: '/api/anify/resolve',
};

// 3. Tatakai API (Snozxyx Engine)
const TATAKAI_MULTI: StreamProvider = {
  id: 'tatakai-multi',
  label: 'Tatakai Multi-Audio Engine',
  category: 'tatakai',
  description: 'Unified Tatakai scraper with English Dub and Japanese Sub tracks.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Tatakai HD',
  apiEndpoint: '/api/tatakai/resolve',
};

const TATAKAI_PAHE: StreamProvider = {
  id: 'tatakai-pahe',
  label: 'Tatakai Pahe CDN',
  category: 'tatakai',
  description: 'Compact high-efficiency video stream node from Tatakai.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Fast H.265',
  apiEndpoint: '/api/tatakai/resolve',
};

// 4. Miruro API
const MIRURO_STREAM: StreamProvider = {
  id: 'miruro-stream',
  label: 'Miruro Ultra HLS',
  category: 'miruro',
  description: 'Decrypted Miruro master stream with AniList sync and multi-sub tracks.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Miruro HD',
  apiEndpoint: '/api/miruro/resolve',
};

const MIRURO_PRO: StreamProvider = {
  id: 'miruro-pro',
  label: 'Miruro Pro Multi-Mirror',
  category: 'miruro',
  description: 'Multi-provider fallback (Zoro/HiAnime/Pahe) via Miruro native bridge.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Multi-Mirror',
  apiEndpoint: '/api/miruro/resolve',
};

const MIRURO_PAHE: StreamProvider = {
  id: 'miruro-pahe',
  label: 'Miruro Pahe Mirror',
  category: 'miruro',
  description: 'Compact high-efficiency H.265 mirror powered by Miruro.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Low-Data',
  apiEndpoint: '/api/miruro/resolve',
};

// 5. Renime API
const RENIME_DUB: StreamProvider = {
  id: 'renime-dub',
  label: 'Renime Global Master',
  category: 'renime',
  description: 'Fast decrypted stream node with English Dub & Japanese Sub.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Fast HLS',
  apiEndpoint: '/api/renime/resolve',
};

export const STREAM_PROVIDERS: StreamProvider[] = [
  // 1. Anikoto Vidstream (Fast Bufferless CDN - Default Primary)
  ANIKOTO_VIDSTREAM,
  // 2. Miruro Ultra HLS (Master HLS Stream - Primary Mirror)
  MIRURO_STREAM,
  // 3. Anikoto HD-1 (1080p Master)
  ANIKOTO_HD1,
  // 4. Tatakai Multi-Audio Engine
  TATAKAI_MULTI,
  // 5. Anify Media Cloud
  ANIFY_CLOUD,
  // 6. Anikoto VidPlay (Dual Sub/Dub)
  ANIKOTO_VIDPLAY,
  // 7. Miruro Pro Multi-Mirror
  MIRURO_PRO,
  // 8. Renime Global Master
  RENIME_DUB,
  // 9. Anikoto HD-2 (Backup Mirror)
  ANIKOTO_HD2,
  // 10. Tatakai Pahe CDN
  TATAKAI_PAHE,
  // 11. Anify Fast Mirror
  ANIFY_FAST,
  // 12. Miruro Pahe Mirror
  MIRURO_PAHE,
  // 13. Anikoto Ultra HD
  ANIKOTO_ULTRA,
];

export const DEFAULT_STREAM_PROVIDER_ID: StreamServerId = 'anikoto-vidstream';

export const isStreamProviderId = (providerId: string): providerId is StreamServerId =>
  STREAM_PROVIDERS.some(provider => provider.id === providerId);

export function createDirectStreamSource(
  anime: Anime,
  episodeNumber: number,
  provider: StreamProvider,
  language: StreamLanguage = 'DUB',
  resolution: StreamResolution = '1080p',
  serverName?: string
): StreamSource {
  const anilistId = anime.id || 1;
  const isDub = language === 'DUB';
  const displayTitle = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
  const cleanSlug = displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const availableServers: AvailableServerOption[] = [
    { name: 'VidLink Ultra HD', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidlink.pro/anime/${anilistId}/${episodeNumber}?dub=${isDub ? 'true' : 'false'}` },
    { name: 'AutoEmbed Multi-Source', type: isDub ? 'DUB' : 'SUB', linkId: `https://autoembed.co/anime/anilist/${anilistId}/${episodeNumber}?dub=${isDub ? 1 : 0}` },
    { name: 'VidSrc Fast Mirror', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidsrc.cc/v2/embed/anime/${anilistId}/${episodeNumber}?dub=${isDub ? 'true' : 'false'}` },
    { name: 'SmashyStream Engine', type: 'SUB', linkId: `https://player.smashystream.com/anime/${anilistId}/${episodeNumber}` },
    { name: '2Embed CDN', type: isDub ? 'DUB' : 'SUB', linkId: `https://www.2embed.cc/embedanime/${encodeURIComponent(cleanSlug)}-episode-${episodeNumber}` },
  ];

  let selectedUrl = availableServers[0].linkId;
  let selectedServerName = availableServers[0].name;

  if (serverName) {
    const matched = availableServers.find(s => s.name.toLowerCase().includes(serverName.toLowerCase()));
    if (matched) {
      selectedUrl = matched.linkId;
      selectedServerName = matched.name;
    }
  }

  return {
    provider,
    url: selectedUrl,
    language,
    resolution,
    isEmbeddable: true,
    external: false,
    skipData: { intro: [0, 0], outro: [0, 0] },
    availableServers,
    availableLanguages: ['SUB', 'DUB'],
    selectedServerName,
    isDubAvailable: true,
    isFallback: true,
    requestedLanguage: language,
    actualLanguage: language,
  };
}

/**
 * Universal episode stream resolver supporting Anikoto, Anify, Tatakai, Miruro, and Multi-Engine CDNs
 */
export async function resolveEpisodeSource({
  anime,
  episodeNumber,
  providerId = DEFAULT_STREAM_PROVIDER_ID,
  language = 'DUB',
  resolution = '1080p',
  serverName,
}: ResolveEpisodeSourceInput): Promise<ResolveEpisodeSourceResult> {
  const targetProviderId = (providerId as StreamServerId) || DEFAULT_STREAM_PROVIDER_ID;
  const provider = STREAM_PROVIDERS.find(item => item.id === targetProviderId) || TATAKAI_MULTI;

  const englishTitle = anime.title?.english || '';
  const romajiTitle = anime.title?.romaji || '';
  const userTitle = anime.title?.userPreferred || '';
  const nativeTitle = anime.title?.native || '';
  const synonyms = (anime as any).synonyms || [];
  const animeTitle = englishTitle || romajiTitle || userTitle || 'Anime';
  const anilistId = anime.id;

  // Immediate guard: Do not attempt to resolve unreleased seasons (e.g. Oshi no Ko Season 3/4)
  const isUnreleasedAnime =
    anime.status === 'NOT_YET_RELEASED' ||
    (/\b(season\s*[3-9]|3rd\s*season|4th\s*season|5th\s*season)\b/i.test(animeTitle) && /oshi\s*no\s*ko/i.test(animeTitle));

  if (isUnreleasedAnime) {
    return {
      status: 'error',
      message: `"${animeTitle}" has not been released yet. Streaming will become available once the season begins broadcast.`,
    };
  }

  let desiredServerName = serverName;
  if (!desiredServerName && provider.serverMatch) {
    desiredServerName = provider.serverMatch;
  }

  // Determine endpoint to hit based on provider
  let endpoint = '/api/stream/resolve';
  if (provider.apiEndpoint) {
    endpoint = provider.apiEndpoint;
  } else if (provider.category === 'anikoto') {
    endpoint = '/api/anikoto/resolve';
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    let res: Response;
    try {
      res = await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          anilistId,
          providerId: provider.id,
          category: provider.category,
          animeTitle,
          romajiTitle,
          englishTitle,
          nativeTitle,
          synonyms,
          episodeNumber,
          language,
          serverName: desiredServerName,
          format: anime.format || 'TV',
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok) {
      const data = await res.json();
      if (data.unreleased) {
        return {
          status: 'error',
          message: data.message || `"${animeTitle}" has not been released yet.`,
        };
      }
      if (data.success && data.streamUrl) {
        return {
          status: 'available',
          source: {
            provider,
            url: data.streamUrl,
            language: (data.language as StreamLanguage) || language,
            resolution,
            isEmbeddable: true,
            external: false,
            skipData: data.skipData,
            availableServers: data.availableServers,
            availableLanguages: (data.availableLanguages as StreamLanguage[]) || ['SUB', 'DUB'],
            selectedServerName: data.selectedServer || desiredServerName,
            isDubAvailable: Boolean(
              data.isDubAvailable ??
                data.availableServers?.some((s: any) =>
                  ['DUB', 'ENG', 'ENGLISH', 'DUAL'].includes(s.type?.toUpperCase())
                )
            ),
            isFallback: Boolean(data.isFallback),
            fallbackReason: data.fallbackReason,
            requestedLanguage: data.requestedLanguage || language,
            actualLanguage: data.actualLanguage || data.language || language,
          },
        };
      }
    }

    // If specific provider endpoint returned non-ok, attempt universal fallback endpoint with short timeout
    if (endpoint !== '/api/stream/resolve') {
      try {
        const fbController = new AbortController();
        const fbTimeoutId = setTimeout(() => fbController.abort(), 3500);
        const fallbackRes = await apiFetch('/api/stream/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anilistId,
            providerId: 'universal',
            category: 'universal',
            animeTitle,
            romajiTitle,
            englishTitle,
            nativeTitle,
            synonyms,
            episodeNumber,
            language,
            serverName: desiredServerName,
            format: anime.format || 'TV',
          }),
          signal: fbController.signal,
        }).finally(() => clearTimeout(fbTimeoutId));

        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          if (fbData.success && fbData.streamUrl) {
            return {
              status: 'available',
              source: {
                provider,
                url: fbData.streamUrl,
                language: (fbData.language as StreamLanguage) || language,
                resolution,
                isEmbeddable: true,
                external: false,
                skipData: fbData.skipData,
                availableServers: fbData.availableServers,
                availableLanguages: (fbData.availableLanguages as StreamLanguage[]) || ['SUB', 'DUB'],
                selectedServerName: fbData.selectedServer || desiredServerName,
                isDubAvailable: Boolean(fbData.isDubAvailable),
                isFallback: Boolean(fbData.isFallback),
                fallbackReason: fbData.fallbackReason,
                requestedLanguage: fbData.requestedLanguage || language,
                actualLanguage: fbData.actualLanguage || fbData.language || language,
              },
            };
          }
        }
      } catch {
        // Fallback to direct client stream below
      }
    }

    // Fall back to direct resilient multi-source embed stream
    const directSource = createDirectStreamSource(anime, episodeNumber, provider, language, resolution, desiredServerName);
    return {
      status: 'available',
      source: directSource,
    };
  } catch (_err: any) {
    // Return resilient direct stream source on any network or fetch failure
    const directSource = createDirectStreamSource(anime, episodeNumber, provider, language, resolution, desiredServerName);
    return {
      status: 'available',
      source: directSource,
    };
  }
}
