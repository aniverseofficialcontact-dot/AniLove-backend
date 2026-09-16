import { resolveDirectVideoLink } from './directVideoResolver';
import { fetchJustAnimeSource } from './tatakaiScraper';

export const ANIKOTO_BASE = 'https://anikototv.to';
export const ANIKOTO_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'X-Requested-With': 'XMLHttpRequest',
};

export function parseAnikotoSearchResults(html: string) {
  const itemRegex = /<div class="item\s*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  const items: Array<{
    id: string;
    url: string;
    poster: string;
    title: string;
    sub: number;
    dub: number;
    type: string;
  }> = [];

  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(html)) !== null) {
    const block = m[1];
    const tipM = block.match(/data-tip="([^"]+)"/);
    const linkM = block.match(/href="([^"]*\/watch\/[^"]+)"/);
    const imgM = block.match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/);
    const subM = block.match(/class="ep-status sub"[^>]*><span>\s*(\d+)/);
    const dubM = block.match(/class="ep-status dub"[^>]*><span>\s*(\d+)/);
    const typeM = block.match(/class="right">([^<]+)<\/div>/);

    if (tipM && linkM) {
      items.push({
        id: tipM[1].trim(),
        url: linkM[1].startsWith('http') ? linkM[1] : `https://anikototv.to${linkM[1]}`,
        poster: imgM ? imgM[1] : '',
        title: imgM ? imgM[2] : '',
        sub: subM ? parseInt(subM[1], 10) : 0,
        dub: dubM ? parseInt(dubM[1], 10) : 0,
        type: typeM ? typeM[1].trim() : 'TV',
      });
    }
  }

  return items;
}

export function parseAnikotoEpisodes(html: string) {
  const epTagRegex = /<a\s+([^>]+)>/gi;
  const episodes: Array<{
    id: string;
    num: number;
    slug: string;
    sub: boolean;
    dub: boolean;
    ids: string;
  }> = [];

  let m: RegExpExecArray | null;
  while ((m = epTagRegex.exec(html)) !== null) {
    const attrs = m[1];
    const idM = attrs.match(/data-id="([^"]+)"/);
    const numM = attrs.match(/data-num="([^"]+)"/);
    const slugM = attrs.match(/data-slug="([^"]+)"/);
    const subM = attrs.match(/data-sub="([^"]+)"/);
    const dubM = attrs.match(/data-dub="([^"]+)"/);
    const idsM = attrs.match(/data-ids="([^"]+)"/);

    if (idM && numM && idsM) {
      episodes.push({
        id: idM[1].trim(),
        num: parseInt(numM[1], 10),
        slug: slugM ? slugM[1].trim() : numM[1].trim(),
        sub: subM ? subM[1] === '1' : true,
        dub: dubM ? dubM[1] === '1' : false,
        ids: idsM[1].trim(),
      });
    }
  }

  return episodes;
}

export function parseAnikotoServers(html: string) {
  const serverSections = [...html.matchAll(/<div class="type"\s+data-type="([^"]+)">([\s\S]*?)<\/ul>/gi)];
  const serversByLang: Record<
    string,
    Array<{
      name: string;
      epId: string;
      svId: string;
      linkId: string;
    }>
  > = {
    SUB: [],
    DUB: [],
  };

  for (const sSec of serverSections) {
    const rawSecLang = sSec[1].toUpperCase().trim();
    const secHtml = sSec[2];
    const liRegex = /<li\s+([^>]+)>([^<]+)<\/li>/gi;
    let liMatch: RegExpExecArray | null;

    let secLang = 'SUB';
    if (['DUB', 'ENGLISH', 'ENG', 'MULTI', 'DUAL', 'MULTI-AUDIO'].includes(rawSecLang)) {
      secLang = 'DUB';
    } else {
      secLang = 'SUB';
    }

    if (!serversByLang[secLang]) {
      serversByLang[secLang] = [];
    }

    while ((liMatch = liRegex.exec(secHtml)) !== null) {
      const liAttrs = liMatch[1];
      const name = liMatch[2].trim();
      const epIdM = liAttrs.match(/data-ep-id="([^"]+)"/);
      const svIdM = liAttrs.match(/data-sv-id="([^"]+)"/);
      const linkIdM = liAttrs.match(/data-link-id="([^"]+)"/);

      if (linkIdM) {
        const item = {
          name,
          epId: epIdM ? epIdM[1].trim() : '',
          svId: svIdM ? svIdM[1].trim() : '',
          linkId: linkIdM[1].trim(),
        };

        serversByLang[secLang].push(item);
      }
    }
  }

  Object.keys(serversByLang).forEach(k => {
    if (serversByLang[k].length === 0 && !['SUB', 'DUB'].includes(k)) {
      delete serversByLang[k];
    }
  });

  return serversByLang;
}

export function generateSearchQueries(rawTitles: string[]): string[] {
  const queries = new Set<string>();

  for (const raw of rawTitles) {
    if (!raw || typeof raw !== 'string') continue;
    const clean = raw.replace(/\s+/g, ' ').trim();
    if (clean.length < 2) continue;

    queries.add(clean);

    // 1. Remove bracketed text like (TV), [Official], (2024), etc.
    const withoutBrackets = clean.replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    if (withoutBrackets.length >= 2) queries.add(withoutBrackets);

    // 2. Remove subtitle after colon, dash, or semicolon
    const mainTitle = clean.split(/[:\-\–\—\;]/)[0].trim();
    if (mainTitle.length >= 3 && mainTitle !== clean) {
      queries.add(mainTitle);
    }

    // 3. Remove Season / Part / Cour suffixes ONLY if not an explicit sequel request
    const hasExplicitSeason = /\b(season\s*[2-9]|2nd\s*season|3rd\s*season|4th\s*season|\d+(nd|rd|th)\s*season|season\s*[ivx]+)\b/i.test(clean);
    if (!hasExplicitSeason) {
      const withoutSeason = clean
        .replace(/\b(season\s*\d+|2nd\s*season|3rd\s*season|4th\s*season|\d+(st|nd|rd|th)\s*season|season\s*[ivx]+|part\s*\d+|cour\s*\d+|the\s*final\s*season)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (withoutSeason.length >= 3) {
        queries.add(withoutSeason);
      }
    }

    // 4. Roman numerals vs standard numbers conversion
    if (/\bseason\s*2\b/i.test(clean)) {
      queries.add(clean.replace(/\bseason\s*2\b/i, '2nd Season'));
      queries.add(clean.replace(/\bseason\s*2\b/i, 'Season II'));
      queries.add(clean.replace(/\bseason\s*2\b/i, '2'));
    } else if (/\b2nd\s*season\b/i.test(clean)) {
      queries.add(clean.replace(/\b2nd\s*season\b/i, 'Season 2'));
      queries.add(clean.replace(/\b2nd\s*season\b/i, 'Season II'));
    } else if (/\bseason\s*3\b/i.test(clean)) {
      queries.add(clean.replace(/\bseason\s*3\b/i, '3rd Season'));
      queries.add(clean.replace(/\bseason\s*3\b/i, 'Season III'));
      queries.add(clean.replace(/\bseason\s*3\b/i, 'S3'));
    } else if (/\b3rd\s*season\b/i.test(clean)) {
      queries.add(clean.replace(/\b3rd\s*season\b/i, 'Season 3'));
      queries.add(clean.replace(/\b3rd\s*season\b/i, 'Season III'));
    } else if (/\bseason\s*4\b/i.test(clean)) {
      queries.add(clean.replace(/\bseason\s*4\b/i, '4th Season'));
      queries.add(clean.replace(/\bseason\s*4\b/i, 'Season IV'));
      queries.add(clean.replace(/\bseason\s*4\b/i, 'S4'));
    } else if (/\b4th\s*season\b/i.test(clean)) {
      queries.add(clean.replace(/\b4th\s*season\b/i, 'Season 4'));
      queries.add(clean.replace(/\b4th\s*season\b/i, 'Season IV'));
    }

    // 5. Clean punctuation query
    const noPunctuation = clean.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (noPunctuation.length >= 3) {
      queries.add(noPunctuation);
    }
  }

  return Array.from(queries);
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'for', 'with', 'on', 'at', 'by',
  'from', 'no', 'na', 'ni', 'wa', 'ga', 'o', 'wo', 'mo', 'de', 'tv', 'season', 'part', 'cour', 'act'
]);

export function scoreAnimeCandidate(
  item: { id: string; title: string; type: string; sub: number; dub: number },
  query: string,
  preferredFormat: string = 'TV',
  requestedEp: number = 1,
  allCandidates: string[] = []
): number {
  const norm = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const qNorm = norm(query);
  const qTokens = qNorm.split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));
  const candidateNorms = allCandidates.map(c => norm(c)).filter(Boolean);

  const asksForMovie = candidateNorms.some(c => c.includes('movie') || c.includes('film') || c.includes('gekioban') || c.includes('the movie')) || qNorm.includes('movie') || qNorm.includes('film');
  const asksForZero = candidateNorms.some(c => /\b(0|zero)\b/.test(c)) || /\b(0|zero)\b/.test(qNorm);
  const asksForSeason2 = candidateNorms.some(c => /\b(2|2nd|ii|season 2|2nd season|s2)\b/.test(c)) || /\b(2|2nd|ii|season 2|2nd season)\b/.test(qNorm);
  const asksForSeason3 = candidateNorms.some(c => /\b(3|3rd|iii|season 3|3rd season|s3)\b/.test(c)) || /\b(3|3rd|iii|season 3|3rd season)\b/.test(qNorm);
  const asksForSeason4 = candidateNorms.some(c => /\b(4|4th|iv|season 4|4th season|final)\b/.test(c)) || /\b(4|4th|iv|season 4|4th season|final)\b/.test(qNorm);

  let score = 0;
  const titleNorm = norm(item.title);
  const titleTokens = titleNorm.split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));
  const isItemMovie = item.type?.toLowerCase() === 'movie' || titleNorm.includes('movie') || titleNorm.includes('film');
  const isItemZero = /\b(0|zero)\b/.test(titleNorm);
  const isItemSeason2 = /\b(2nd season|season 2|season ii|\b2\b|s2)\b/.test(titleNorm);
  const isItemSeason3 = /\b(3rd season|season 3|season iii|\b3\b|s3)\b/.test(titleNorm);
  const isItemSeason4 = /\b(4th season|season 4|final season|\b4\b)\b/.test(titleNorm);

  // 1. Strict Movie / Zero checks
  if (isItemMovie || isItemZero) {
    if (!asksForMovie && !asksForZero) {
      score -= 300;
    } else {
      score += 80;
    }
  }

  // 2. Strict Season checks
  if (asksForSeason2) {
    if (isItemSeason2) score += 180;
    else return -999;
  } else if (asksForSeason3) {
    if (isItemSeason3) score += 180;
    else return -999;
  } else if (asksForSeason4) {
    if (isItemSeason4) score += 180;
    else return -999;
  } else {
    if (isItemSeason2 || isItemSeason3 || isItemSeason4) {
      return -999;
    }
  }

  // 3. Exact matches against query or candidate titles
  if (titleNorm === qNorm || candidateNorms.includes(titleNorm)) {
    score += 250;
  } else if (titleNorm.startsWith(qNorm) || qNorm.startsWith(titleNorm)) {
    score += 100;
  } else if (candidateNorms.some(c => c && (titleNorm.startsWith(c) || c.startsWith(titleNorm)))) {
    score += 90;
  } else if (titleNorm.includes(qNorm) || qNorm.includes(titleNorm)) {
    score += 60;
  }

  // 4. Token overlap of significant words
  let matchCount = 0;
  for (const t of qTokens) {
    if (titleTokens.includes(t)) {
      matchCount++;
    } else if (titleTokens.some(it => it.includes(t) || t.includes(it))) {
      matchCount += 0.7;
    }
  }

  // Cross-check with candidate titles
  for (const c of candidateNorms) {
    const cTokens = c.split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));
    let cMatch = 0;
    for (const t of cTokens) {
      if (titleTokens.includes(t)) cMatch++;
    }
    if (cTokens.length > 0 && cMatch / cTokens.length >= 0.8) {
      score += 100;
    }
  }

  const extraWords = titleTokens.filter(t => !qTokens.includes(t) && !candidateNorms.some(c => c.includes(t)));
  if (extraWords.length > 0) {
    score -= extraWords.length * 15;
  }

  if (qTokens.length > 0) {
    const matchRatio = matchCount / qTokens.length;
    if (matchRatio < 0.6 && !candidateNorms.some(c => titleNorm.includes(c) || c.includes(titleNorm))) {
      return -999;
    }
    score += matchRatio * 80;
  }

  // 5. Format and episode count preference
  if (preferredFormat && item.type?.toLowerCase() === preferredFormat.toLowerCase()) {
    score += 20;
  }

  const totalAvailable = Math.max(item.sub || 0, item.dub || 0);
  if (requestedEp > 1) {
    if (totalAvailable >= requestedEp) {
      score += 25;
    } else if (totalAvailable === 1) {
      score -= 80;
    }
  } else if (preferredFormat === 'TV' && totalAvailable > 1) {
    score += 25;
  }

  // 6. Specials & recap penalty
  if (
    (titleNorm.includes('mini') || titleNorm.includes('special') || titleNorm.includes('chibi') || titleNorm.includes('recap')) &&
    !qNorm.includes('mini') &&
    !qNorm.includes('special') &&
    !qNorm.includes('chibi') &&
    !qNorm.includes('recap')
  ) {
    score -= 50;
  }

  return score;
}

export function findBestAnimeMatch(
  items: Array<{ id: string; title: string; type: string; sub: number; dub: number }>,
  query: string,
  preferredFormat: string = 'TV',
  requestedEp: number = 1,
  allCandidates: string[] = []
): (typeof items)[number] | null {
  let best: (typeof items)[number] | null = null;
  let bestScore = 35;

  for (const item of items) {
    const score = scoreAnimeCandidate(item, query, preferredFormat, requestedEp, allCandidates);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return best;
}

export async function generateUniversalFallbackStream(input: {
  anilistId?: number | string;
  animeTitle?: string;
  romajiTitle?: string;
  englishTitle?: string;
  episodeNumber?: number;
  language?: string;
  serverName?: string;
}) {
  const {
    anilistId = 1,
    animeTitle = 'Anime',
    romajiTitle = '',
    englishTitle = '',
    episodeNumber = 1,
    language = 'DUB',
    serverName = 'VidLink Ultra HD',
  } = input;

  const epNum = Number(episodeNumber) || 1;
  const isDub = String(language || 'DUB').toUpperCase() === 'DUB';
  const displayTitle = englishTitle || animeTitle || romajiTitle || 'Anime';
  const slug = displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (/\b(season\s*[3-9]|3rd\s*season|4th\s*season|5th\s*season)\b/i.test(displayTitle) && /oshi\s*no\s*ko/i.test(displayTitle)) {
    return {
      success: false,
      unreleased: true,
      message: `${displayTitle} has not been released yet and has not aired any episodes.`,
    };
  }

  const availableServers = [
    { name: 'VidLink Ultra HD', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidlink.pro/anime/${anilistId}/${epNum}?dub=${isDub ? 'true' : 'false'}` },
    { name: 'AutoEmbed Multi-Source', type: isDub ? 'DUB' : 'SUB', linkId: `https://autoembed.co/anime/anilist/${anilistId}/${epNum}?dub=${isDub ? 1 : 0}` },
    { name: 'VidSrc Fast Mirror', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidsrc.cc/v2/embed/anime/${anilistId}/${epNum}?dub=${isDub ? 'true' : 'false'}` },
    { name: 'SmashyStream Engine', type: 'SUB', linkId: `https://player.smashystream.com/anime/${anilistId}/${epNum}` },
    { name: '2Embed High Speed', type: isDub ? 'DUB' : 'SUB', linkId: `https://www.2embed.cc/embedanime/${encodeURIComponent(slug)}-episode-${epNum}` },
  ];

  let selected = availableServers[0];
  if (serverName) {
    const found = availableServers.find(s => s.name.toLowerCase().includes(serverName.toLowerCase()));
    if (found) selected = found;
  }

  const rawEmbedUrl = selected.linkId;
  const directStreamUrl = await resolveDirectVideoLink(rawEmbedUrl);
  const isDirectVideo = Boolean(directStreamUrl && /\.(m3u8|mp4)(\?|$)/i.test(directStreamUrl));

  return {
    success: true,
    streamUrl: directStreamUrl,
    embedUrl: rawEmbedUrl,
    isDirectVideo,
    skipData: { intro: [0, 0], outro: [0, 0] },
    animeMatch: {
      id: String(anilistId),
      title: displayTitle,
      url: `https://anilist.co/anime/${anilistId}`,
      poster: '',
      sub: epNum,
      dub: epNum,
      type: 'TV',
    },
    episode: {
      id: `ep-${epNum}`,
      num: epNum,
      slug: String(epNum),
      sub: true,
      dub: true,
    },
    availableServers,
    selectedServer: selected.name,
    language: isDub ? 'DUB' : 'SUB',
    requestedLanguage: isDub ? 'DUB' : 'SUB',
    actualLanguage: isDub ? 'DUB' : 'SUB',
    isFallback: true,
    isDubAvailable: true,
    totalEpisodes: 1000,
  };
}

export async function resolveAnikotoInternal(input: {
  anilistId?: number | string;
  animeTitle?: string;
  romajiTitle?: string;
  englishTitle?: string;
  nativeTitle?: string;
  synonyms?: string[];
  episodeNumber?: number;
  language?: string;
  serverName?: string;
  format?: string;
}): Promise<any> {
  const {
    anilistId = 1,
    animeTitle = '',
    romajiTitle = '',
    englishTitle = '',
    nativeTitle = '',
    synonyms = [],
    episodeNumber = 1,
    language = 'SUB',
    serverName,
    format = 'TV',
  } = input;

  const epNum = Number(episodeNumber) || 1;
  const lang = String(language || 'SUB').toUpperCase();

  const rawTitles = [
    englishTitle,
    animeTitle,
    romajiTitle,
    nativeTitle,
    ...(Array.isArray(synonyms) ? synonyms : []),
  ].filter((t): t is string => Boolean(t && typeof t === 'string' && t.trim().length > 1));

  const queries = generateSearchQueries(rawTitles);

  if (queries.length === 0) {
    return await generateUniversalFallbackStream({
      anilistId,
      animeTitle,
      romajiTitle,
      englishTitle,
      episodeNumber: epNum,
      language: lang,
      serverName,
    });
  }

  let bestItem: any = null;
  let bestGlobalScore = 40;

  for (const q of queries) {
    const searchUrl = `${ANIKOTO_BASE}/filter?keyword=${encodeURIComponent(q)}`;
    try {
      const searchRes = await fetch(searchUrl, {
        headers: ANIKOTO_HEADERS,
        signal: AbortSignal.timeout(2500),
      });
      if (searchRes.ok) {
        const searchHtml = await searchRes.text();
        const items = parseAnikotoSearchResults(searchHtml);
        if (items.length > 0) {
          for (const item of items) {
            const score = scoreAnimeCandidate(item, q, format, epNum, rawTitles);
            if (score > bestGlobalScore) {
              bestGlobalScore = score;
              bestItem = item;
            }
          }
          if (bestGlobalScore >= 250) {
            break;
          }
        }
      }
    } catch (e: any) {
      console.warn(`[Resolver Log] Anikoto search query "${q}" failed:`, e?.message || e);
    }
  }

  if (!bestItem) {
    const isUnreleasedSequel = rawTitles.some(t => /\b(season\s*[3-9]|3rd\s*season|4th\s*season|5th\s*season)\b/i.test(t));
    if (isUnreleasedSequel && rawTitles.some(t => /oshi\s*no\s*ko/i.test(t))) {
      return {
        success: false,
        unreleased: true,
        message: `This season (${englishTitle || animeTitle}) has not been released yet and has no aired episodes.`,
      };
    }

    console.info(`[Resolver Log] No direct Anikoto match for "${englishTitle || animeTitle}" EP ${epNum}. Falling back to universal multi-source stream.`);
    return await generateUniversalFallbackStream({
      anilistId,
      animeTitle,
      romajiTitle,
      englishTitle,
      episodeNumber: epNum,
      language: lang,
      serverName,
    });
  }

  try {
    // Fetch Episode List
    const epListUrl = `${ANIKOTO_BASE}/ajax/episode/list/${bestItem.id}`;
    const epRes = await fetch(epListUrl, {
      headers: { ...ANIKOTO_HEADERS, Referer: bestItem.url || `${ANIKOTO_BASE}/` },
      signal: AbortSignal.timeout(2500),
    });
    const epJson = await epRes.json();

    if (epJson.status !== 200 || !epJson.result) {
      console.warn(`[Resolver Log] Could not retrieve episode list from Anikoto for ${bestItem.id}`);
      return await generateUniversalFallbackStream({
        anilistId,
        animeTitle,
        romajiTitle,
        englishTitle,
        episodeNumber: epNum,
        language: lang,
        serverName,
      });
    }

    const episodes = parseAnikotoEpisodes(epJson.result);
    if (episodes.length === 0) {
      return await generateUniversalFallbackStream({
        anilistId,
        animeTitle,
        romajiTitle,
        englishTitle,
        episodeNumber: epNum,
        language: lang,
        serverName,
      });
    }

    const targetEp = episodes.find(e => e.num === epNum) || episodes[0];

    // Fetch Servers List
    const serverListUrl = `${ANIKOTO_BASE}/ajax/server/list?servers=${encodeURIComponent(targetEp.ids)}`;
    const sRes = await fetch(serverListUrl, {
      headers: { ...ANIKOTO_HEADERS, Referer: bestItem.url || `${ANIKOTO_BASE}/` },
      signal: AbortSignal.timeout(2500),
    });
    const sJson = await sRes.json();

    if (sJson.status !== 200 || !sJson.result) {
      return await generateUniversalFallbackStream({
        anilistId,
        animeTitle,
        romajiTitle,
        englishTitle,
        episodeNumber: epNum,
        language: lang,
        serverName,
      });
    }

    const serverGroups = parseAnikotoServers(sJson.result);
    const isDubAvailable = Boolean(serverGroups['DUB'] && serverGroups['DUB'].length > 0);

    let targetGroupKey = 'SUB';
    let isTargetLangAvailable = false;

    if (['DUB', 'ENGLISH', 'ENG'].includes(lang) && isDubAvailable) {
      targetGroupKey = 'DUB';
      isTargetLangAvailable = true;
    } else if (serverGroups['SUB'] && serverGroups['SUB'].length > 0) {
      targetGroupKey = 'SUB';
      isTargetLangAvailable = lang === 'SUB';
    } else if (isDubAvailable) {
      targetGroupKey = 'DUB';
      isTargetLangAvailable = false;
    } else {
      targetGroupKey = Object.keys(serverGroups)[0] || 'SUB';
      isTargetLangAvailable = false;
    }

    const isFallback = !isTargetLangAvailable && lang !== targetGroupKey;
    const fallbackReason = isFallback
      ? `${lang === 'DUB' ? 'English Dub' : 'Japanese Sub'} is not available for this episode. Playing ${targetGroupKey === 'DUB' ? 'English Dub' : 'Japanese Sub'} instead.`
      : undefined;

    const availableInLang = serverGroups[targetGroupKey] || serverGroups['SUB'] || Object.values(serverGroups)[0] || [];

    if (availableInLang.length === 0) {
      return await generateUniversalFallbackStream({
        anilistId,
        animeTitle,
        romajiTitle,
        englishTitle,
        episodeNumber: epNum,
        language: lang,
        serverName,
      });
    }

    let chosenServer = availableInLang[0];
    if (serverName) {
      const matched = availableInLang.find(s =>
        s.name.toLowerCase().includes(String(serverName).toLowerCase())
      );
      if (matched) {
        chosenServer = matched;
      } else {
        const allFlat = Object.values(serverGroups).flat();
        const matchedAny = allFlat.find(s => s.name.toLowerCase().includes(String(serverName).toLowerCase()));
        if (matchedAny) chosenServer = matchedAny;
      }
    }

    // Fetch Direct Stream Embed URL
    const streamUrl = `${ANIKOTO_BASE}/ajax/server?get=${encodeURIComponent(chosenServer.linkId)}`;
    const streamRes = await fetch(streamUrl, {
      headers: { ...ANIKOTO_HEADERS, Referer: bestItem.url || `${ANIKOTO_BASE}/` },
      signal: AbortSignal.timeout(2500),
    });
    const streamJson = await streamRes.json();

    if (streamJson.status !== 200 || !streamJson.result?.url) {
      return await generateUniversalFallbackStream({
        anilistId,
        animeTitle,
        romajiTitle,
        englishTitle,
        episodeNumber: epNum,
        language: lang,
        serverName,
      });
    }

    const flatServersList: Array<{ name: string; type: string; linkId: string }> = [];
    Object.keys(serverGroups).forEach(groupLang => {
      serverGroups[groupLang].forEach(s => {
        flatServersList.push({
          name: s.name,
          type: groupLang,
          linkId: s.linkId,
        });
      });
    });

    const rawEmbedUrl = streamJson.result.url;
    // Resolve direct video link (.m3u8 or .mp4) for Android ExoPlayer / native video playback
    let directStreamUrl = await resolveDirectVideoLink(rawEmbedUrl);
    let subtitleUrl: string | null = null;

    if ((!directStreamUrl || directStreamUrl === rawEmbedUrl) && anilistId) {
      try {
        const justAnime = await fetchJustAnimeSource(anilistId, epNum, targetGroupKey === 'DUB');
        if (justAnime?.streamUrl) {
          directStreamUrl = justAnime.streamUrl;
          subtitleUrl = justAnime.subtitleUrl || null;
        }
      } catch {}
    }

    const isDirectVideo = Boolean(directStreamUrl && /\.(m3u8|mp4)(\?|$)/i.test(directStreamUrl));

    return {
      success: true,
      streamUrl: directStreamUrl || rawEmbedUrl,
      directStreamUrl: directStreamUrl || null,
      embedUrl: rawEmbedUrl,
      subtitleUrl,
      isDirectVideo,
      skipData: streamJson.result.skip_data || { intro: [0, 0], outro: [0, 0] },
      animeMatch: {
        id: bestItem.id,
        title: bestItem.title,
        url: bestItem.url,
        poster: bestItem.poster,
        sub: bestItem.sub,
        dub: bestItem.dub,
        type: bestItem.type,
      },
      episode: {
        id: targetEp.id,
        num: targetEp.num,
        slug: targetEp.slug,
        sub: targetEp.sub,
        dub: targetEp.dub,
      },
      availableServers: flatServersList,
      selectedServer: chosenServer.name,
      language: targetGroupKey,
      requestedLanguage: lang,
      actualLanguage: targetGroupKey,
      isFallback,
      fallbackReason,
      isDubAvailable,
      totalEpisodes: episodes.length,
    };
  } catch (err: any) {
    console.warn(`[Resolver Log] Unexpected Anikoto resolution error:`, err?.message || err);
    return await generateUniversalFallbackStream({
      anilistId,
      animeTitle,
      romajiTitle,
      englishTitle,
      episodeNumber: epNum,
      language: lang,
      serverName,
    });
  }
}
