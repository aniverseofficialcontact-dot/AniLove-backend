import { Anime } from '../types';

/**
 * Accurately calculate total episodes for any anime, resolving AniList ongoing anime,
 * franchise sequels, and long-running series like One Piece, Conan, Naruto, Bleach, etc.
 */
export function computeTotalEpisodes(anime?: Anime | null, details?: any): number {
  if (!anime && !details) return 0;

  // 0. Check for unreleased / upcoming media
  const status = (details?.status || anime?.status || '').toUpperCase();
  if (status === 'NOT_YET_RELEASED') {
    return 0;
  }

  // 1. Direct positive episodes from anime or details
  if (anime?.episodes && anime.episodes > 0) return anime.episodes;
  if (details?.episodes && details.episodes > 0) return details.episodes;

  // 2. Ongoing airing anime from nextAiringEpisode
  if (details?.nextAiringEpisode?.episode) {
    const aired = details.nextAiringEpisode.episode - 1;
    return Math.max(0, aired);
  }
  if ((anime as any)?.nextAiringEpisode?.episode) {
    const aired = (anime as any).nextAiringEpisode.episode - 1;
    return Math.max(0, aired);
  }

  // If status is not yet released or has 0 episodes explicitly
  if (anime?.episodes === 0 || details?.episodes === 0) {
    return 0;
  }

  // 3. Title analysis for major long-running franchises when AniList returns null/incomplete counts
  const title = (
    `${anime?.title?.english || ''} ${anime?.title?.romaji || ''} ${anime?.title?.userPreferred || ''} ${details?.title?.english || ''}`
  ).toLowerCase();

  if (title.includes('one piece')) return 1125;
  if (title.includes('detective conan') || title.includes('case closed')) return 1145;
  if (title.includes('naruto shippuden')) return 500;
  if (title.includes('boruto')) return 293;
  if (title.includes('naruto')) return 220;
  if (title.includes('bleach: thousand-year blood war') || title.includes('sennen kessen-hen')) return 26;
  if (title.includes('bleach')) return 366;
  if (title.includes('black clover')) return 170;
  if (title.includes('dragon ball super')) return 131;
  if (title.includes('dragon ball z')) return 291;
  if (title.includes('dragon ball gt')) return 64;
  if (title.includes('dragon ball')) return 153;
  if (title.includes('fairy tail')) return 328;
  if (title.includes('gintama')) return 367;
  if (title.includes('hunter x hunter') || title.includes('hunter hunter')) return 148;
  if (title.includes('yu yu hakusho')) return 112;
  if (title.includes('inuyasha')) return 167;
  if (title.includes('rurouni kenshin')) return 95;
  if (title.includes('sailor moon')) return 200;
  if (title.includes('pokemon') || title.includes('pokémon')) return 1200;
  if (title.includes('doraemon')) return 1000;
  if (title.includes('shin-chan') || title.includes('shinchan') || title.includes('crayon shin')) return 1100;
  if (title.includes('my hero academia') || title.includes('boku no hero academia')) return 159;

  // 4. Check raw streaming episodes from AniList
  const rawStreaming = details?.streamingEpisodes || (anime as any)?.streamingEpisodes || [];
  if (rawStreaming.length > 0) {
    return Math.max(rawStreaming.length, 24);
  }

  return 24;
}

/**
 * Generate 50-episode chunk ranges for long anime (e.g. 1-50, 51-100, 101-150)
 */
export function generateEpisodeRanges(totalEpisodes: number): Array<{ label: string; start: number; end: number }> {
  if (totalEpisodes <= 50) return [];
  const chunkSize = 50;
  const ranges: Array<{ label: string; start: number; end: number }> = [];
  for (let i = 0; i < totalEpisodes; i += chunkSize) {
    const start = i + 1;
    const end = Math.min(i + chunkSize, totalEpisodes);
    ranges.push({ label: `${start}–${end}`, start, end });
  }
  return ranges;
}
