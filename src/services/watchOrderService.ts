import { Anime, AnimeDetail, FranchiseWatchOrder, WatchOrderItem } from '../types';
import { executeQuery } from './anilist';

// In-memory cache for fast tab switches
const watchOrderCache = new Map<number, FranchiseWatchOrder>();

// Non-video media types that must strictly be excluded (as requested: no manga, novel, etc.)
const NON_VIDEO_FORMATS = new Set([
  'MANGA',
  'NOVEL',
  'ONE_SHOT',
  'DOUJINSHI',
  'LIGHT_NOVEL',
  'WEB_NOVEL',
  'VISUAL_NOVEL',
  'MUSIC',
]);

// Ignored relation types that cause cross-franchise leaks
const IGNORED_RELATION_TYPES = new Set([
  'OTHER',
]);

/**
 * Filter and extract valid watchable video anime entries
 */
export function isWatchableVideoFormat(format?: string): boolean {
  if (!format) return true;
  const upper = format.toUpperCase().trim();
  return !NON_VIDEO_FORMATS.has(upper);
}

/**
 * Helper to extract key tokens from anime title for franchise matching
 */
function extractFranchiseTokens(anime: Anime): string[] {
  const titles = [
    anime.title?.english,
    anime.title?.romaji,
    anime.title?.userPreferred,
  ].filter(Boolean) as string[];

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
    'season', 'part', 'movie', 'film', 'special', 'tv', 'ova', 'ona', 'the', 'animation',
    'act', 'arc', 'final', 'first', 'second', 'third', '2nd', '3rd', '4th', '5th',
    'no', 'wa', 'ga', 'wo', 'ni', 'de', 'to', 'kara', 'made', 'hen', 'shou'
  ]);

  const tokens = new Set<string>();

  titles.forEach(t => {
    // Add normalized full base title
    const clean = t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    if (clean.length >= 3) {
      tokens.add(clean);
    }

    // Add significant individual words
    const words = clean.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
    words.forEach(w => tokens.add(w));

    // Add multi-word phrases (e.g. "one piece", "dragon ball", "demon slayer", "attack on titan")
    if (words.length >= 2) {
      tokens.add(`${words[0]} ${words[1]}`);
    }
  });

  return Array.from(tokens);
}

/**
 * Checks if a candidate media node genuinely belongs to the same franchise
 */
function isMatchingFranchise(rootTokens: string[], candidateNode: any, isRoot: boolean): boolean {
  if (isRoot) return true;
  if (!candidateNode) return false;

  const candidateTitles = [
    candidateNode.title?.english,
    candidateNode.title?.romaji,
    candidateNode.title?.userPreferred,
    candidateNode.title?.native,
  ].filter(Boolean).map((t: string) => t.toLowerCase());

  if (candidateTitles.length === 0) return true;

  // Check if candidate matches any of the root franchise tokens
  for (const token of rootTokens) {
    if (candidateTitles.some(t => t.includes(token))) {
      return true;
    }
  }

  return false;
}

/**
 * Detects if a title is a multi-franchise crossover (e.g. Toriko x One Piece x Dragon Ball)
 * Crossovers should be kept as leaves and never traversed further to avoid leaking into foreign franchises.
 */
function isCrossoverMedia(title?: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  if (lower.includes(' x ') || lower.includes(' & ') || lower.includes(' collaboration ') || lower.includes(' crossover ')) {
    if (
      (lower.includes('one piece') && (lower.includes('dragon ball') || lower.includes('toriko'))) ||
      (lower.includes('dragon ball') && lower.includes('toriko')) ||
      (lower.includes('lupin') && lower.includes('conan')) ||
      (lower.includes('isekai quartet'))
    ) {
      return true;
    }
  }
  return false;
}

const MEDIA_RELATIONS_FRAGMENT = `
  id
  idMal
  title {
    romaji
    english
    native
    userPreferred
  }
  coverImage {
    extraLarge
    large
    medium
  }
  bannerImage
  format
  episodes
  duration
  status
  season
  seasonYear
  averageScore
  description
  startDate {
    year
    month
    day
  }
  relations {
    edges {
      relationType
      node {
        id
        idMal
        title {
          romaji
          english
          native
          userPreferred
        }
        format
        episodes
        duration
        seasonYear
        startDate {
          year
          month
          day
        }
        coverImage {
          large
          medium
        }
        bannerImage
        type
      }
    }
  }
`;

/**
 * Fetch batch anime media with relations from AniList GraphQL
 */
async function fetchMediaBatchWithRelations(ids: number[]): Promise<any[]> {
  if (!ids || ids.length === 0) return [];
  const query = `
    query ($ids: [Int]) {
      Page (page: 1, perPage: 50) {
        media (id_in: $ids, type: ANIME, isAdult: false) {
          ${MEDIA_RELATIONS_FRAGMENT}
        }
      }
    }
  `;
  try {
    const data = await executeQuery<{ Page: { media: any[] } }>(query, { ids });
    return data?.Page?.media || [];
  } catch (err) {
    console.warn('Error batch fetching relations for watch order graph:', err);
    return [];
  }
}

/**
 * Deterministic Franchise Watch Order Generator (Purely API / Graph Traversal, No AI)
 * Recursively crawls AniList relation graph to discover the entire franchise
 * (e.g. if user is on Season 3 of 5, crawls prequels & sequels to include Season 1, 2, 3, 4, 5, Movies & OVAs).
 */
export async function fetchFranchiseWatchOrder(
  anime: Anime,
  details?: AnimeDetail | null
): Promise<FranchiseWatchOrder> {
  const currentAnime = details || anime;
  const animeId = currentAnime.id;

  if (watchOrderCache.has(animeId)) {
    return watchOrderCache.get(animeId)!;
  }

  const title =
    currentAnime.title?.english ||
    currentAnime.title?.romaji ||
    currentAnime.title?.userPreferred ||
    'Anime';

  // Extract franchise tokens from the root anime for strict affinity filtering
  const franchiseTokens = extractFranchiseTokens(currentAnime);

  // Map to store all discovered anime nodes in the franchise graph
  const nodesMap = new Map<number, any>();
  const visitedForRelations = new Set<number>();
  const queueToFetch: number[] = [];

  // 1. Seed with current anime
  nodesMap.set(currentAnime.id, currentAnime);

  // 2. Add direct relations from already loaded details if available
  if (details?.relations?.edges) {
    visitedForRelations.add(currentAnime.id);
    for (const edge of details.relations.edges) {
      const relType = edge?.relationType;
      if (relType && IGNORED_RELATION_TYPES.has(relType)) continue;

      const node = edge?.node;
      if (node && isWatchableVideoFormat(node.format)) {
        const isMatch = isMatchingFranchise(franchiseTokens, node, false);
        const nodeTitle = node.title?.english || node.title?.romaji || node.title?.userPreferred || '';
        const isCrossover = isCrossoverMedia(nodeTitle);

        // Include if matches franchise or is a crossover featuring this anime
        if (isMatch || isCrossover) {
          if (!nodesMap.has(node.id)) {
            nodesMap.set(node.id, node);
          }
          // Do NOT enqueue crossover specials to prevent foreign franchise leaks (e.g. DBZ / Toriko into One Piece)
          if (!isCrossover && isMatch && !visitedForRelations.has(node.id)) {
            queueToFetch.push(node.id);
          }
        }
      }
    }
  } else {
    queueToFetch.push(currentAnime.id);
  }

  // 3. Multi-hop graph traversal (up to 8 hops / batch queries) to discover entire franchise
  let hops = 0;
  const MAX_HOPS = 8;

  while (queueToFetch.length > 0 && hops < MAX_HOPS) {
    hops++;
    const batchIds = queueToFetch.splice(0, 30); // Process in batches
    batchIds.forEach(id => visitedForRelations.add(id));

    const mediaList = await fetchMediaBatchWithRelations(batchIds);

    for (const media of mediaList) {
      if (media && isWatchableVideoFormat(media.format)) {
        const mediaTitle = media.title?.english || media.title?.romaji || media.title?.userPreferred || '';
        const isMatch = isMatchingFranchise(franchiseTokens, media, media.id === currentAnime.id);
        const isCrossover = isCrossoverMedia(mediaTitle);

        if (isMatch || isCrossover) {
          nodesMap.set(media.id, media);
        }

        // Never crawl outward from crossovers or unmatched nodes
        if (!isMatch || isCrossover) continue;

        // Check media's relations to discover further prequels/sequels/side stories
        if (media.relations?.edges) {
          for (const edge of media.relations.edges) {
            const relType = edge?.relationType;
            if (relType && IGNORED_RELATION_TYPES.has(relType)) continue;

            const relNode = edge?.node;
            if (relNode && isWatchableVideoFormat(relNode.format)) {
              const relNodeTitle = relNode.title?.english || relNode.title?.romaji || relNode.title?.userPreferred || '';
              const relMatch = isMatchingFranchise(franchiseTokens, relNode, false);
              const relCrossover = isCrossoverMedia(relNodeTitle);

              if (relMatch || relCrossover) {
                if (!nodesMap.has(relNode.id)) {
                  nodesMap.set(relNode.id, relNode);
                }
                if (relMatch && !relCrossover && !visitedForRelations.has(relNode.id) && !queueToFetch.includes(relNode.id)) {
                  queueToFetch.push(relNode.id);
                }
              }
            }
          }
        }
      }
    }
  }

  // 4. Ensure current anime is present in nodesMap
  if (!nodesMap.has(currentAnime.id)) {
    nodesMap.set(currentAnime.id, currentAnime);
  }

  // 5. Convert nodes map into an array of WatchOrderItem
  const allNodes = Array.from(nodesMap.values());

  // Sort function: Chronological release date / year ascending
  const getStartDateScore = (node: any): number => {
    const startYear = node.startDate?.year || node.seasonYear || 0;
    const startMonth = node.startDate?.month || 1;
    const startDay = node.startDate?.day || 1;
    if (startYear === 0) return 99999999;
    return startYear * 10000 + startMonth * 100 + startDay;
  };

  // Sort strictly by release timeline
  allNodes.sort((a, b) => {
    const scoreA = getStartDateScore(a);
    const scoreB = getStartDateScore(b);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return (a.id || 0) - (b.id || 0);
  });

  // 6. Build the items with clean Release Year badges and format info
  const items: WatchOrderItem[] = allNodes.map((node) => {
    const nodeTitle =
      node.title?.english ||
      node.title?.romaji ||
      node.title?.userPreferred ||
      'Anime';

    const year = node.startDate?.year || node.seasonYear;
    const format = node.format || 'TV';
    const isCurrent = node.id === currentAnime.id;

    let importance: WatchOrderItem['importance'] = 'recommended';
    let importanceLabel = 'Canon Entry';
    let typeBadge = format.replace('_', ' ');

    if (format === 'TV' || format === 'TV_SHORT') {
      importance = 'essential';
      importanceLabel = 'Main Story (TV)';
      typeBadge = year ? `TV Series (${year})` : 'TV Series';
    } else if (format === 'MOVIE') {
      importance = 'recommended';
      importanceLabel = 'Canon Movie';
      typeBadge = year ? `Movie (${year})` : 'Feature Movie';
    } else if (format === 'OVA' || format === 'ONA') {
      importance = 'optional';
      importanceLabel = 'OVA / ONA Special';
      typeBadge = year ? `${format} (${year})` : format;
    } else if (format === 'SPECIAL') {
      importance = 'optional';
      importanceLabel = 'Special Episode';
      typeBadge = year ? `Special (${year})` : 'Special';
    }

    const epCountStr = node.episodes
      ? `${node.episodes} eps`
      : format === 'MOVIE'
      ? '1 Movie'
      : 'Special';

    const orderGuide = year
      ? `Released in ${year} • Recommended in release sequence.`
      : 'Follow along in standard release order.';

    const coverImg = node.coverImage?.extraLarge || node.coverImage?.large || node.coverImage?.medium || '';
    const bannerImg = node.bannerImage || coverImg;
    const parsedEps = node.episodes || (format === 'MOVIE' ? 1 : 12);

    const completeAnimeObj: Anime = {
      id: node.id,
      idMal: node.idMal,
      title: {
        romaji: node.title?.romaji || nodeTitle,
        english: node.title?.english || nodeTitle,
        native: node.title?.native,
        userPreferred: node.title?.userPreferred || nodeTitle,
      },
      coverImage: {
        extraLarge: coverImg,
        large: node.coverImage?.large || coverImg,
        medium: node.coverImage?.medium || coverImg,
        color: node.coverImage?.color || '#6366f1',
      },
      bannerImage: bannerImg,
      format,
      episodes: parsedEps,
      duration: node.duration || (format === 'MOVIE' ? 117 : 24),
      status: node.status || 'FINISHED',
      seasonYear: year,
      startDate: node.startDate || { year },
      description: node.description || '',
      genres: node.genres || ['Action', 'Fantasy', 'Shounen'],
      averageScore: node.averageScore || 86,
      popularity: node.popularity || 100000,
    };

    return {
      id: node.id,
      idMal: node.idMal,
      stepNumber: 0, // Assigned below
      title: nodeTitle,
      romajiTitle: node.title?.romaji,
      nativeTitle: node.title?.native,
      format,
      typeBadge,
      episodesCount: epCountStr,
      duration: node.duration ? `${node.duration}m` : undefined,
      releaseYear: year,
      importance,
      importanceLabel,
      orderGuide,
      note: node.description
        ? node.description.replace(/<[^>]*>/g, '').slice(0, 140) + '...'
        : `Official entry in the ${title} franchise.`,
      coverImage: coverImg,
      bannerImage: bannerImg,
      animeObj: completeAnimeObj,
      relationType: isCurrent ? 'CURRENT' : undefined,
    };
  });

  // Assign Step Numbers (1, 2, 3, 4, 5...)
  items.forEach((item, index) => {
    item.stepNumber = index + 1;
  });

  // Total episode calculations
  const totalEps = items.reduce((acc, item) => {
    const num = typeof item.episodesCount === 'string' ? parseInt(item.episodesCount, 10) || 1 : 1;
    return acc + num;
  }, 0);

  const totalHours = Math.round((totalEps * 24) / 60);

  const result: FranchiseWatchOrder = {
    animeId,
    franchiseTitle: title,
    summary: `Complete official franchise watch order for ${title} comprising ${items.length} animated releases (TV seasons, movies, OVAs, and specials) ordered chronologically by release year.`,
    totalEntries: items.length,
    totalEstimatedEpisodes: totalEps,
    totalEstimatedHours: totalHours > 0 ? `~${totalHours} hours` : undefined,
    recommendedOrder: items,
    chronologicalOrder: items,
    releaseOrder: items,
    isAiGenerated: false,
  };

  watchOrderCache.set(animeId, result);
  return result;
}
