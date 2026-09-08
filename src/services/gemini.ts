/**
 * Fully Automated AniAI Sensei Intelligence Engine
 * 100% automated & deterministic responses powered directly by AniList GraphQL,
 * franchise relation graphs, and community recommendations — no external AI API required.
 */
import { Anime, AnimeDetail } from '../types';
import {
  searchAnimeAdvanced,
  fetchAnimeDetails,
  fetchGenreAnime,
  searchAnime,
  sanitizeDescription,
} from './anilist';
import { fetchFranchiseWatchOrder } from './watchOrderService';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  suggestedAnime?: Anime[];
  isFallback?: boolean;
  isLoadingAnime?: boolean;
  showOptionButtons?: boolean;
  showGenrePills?: boolean;
  quickReplies?: Array<{ label: string; action: () => void }>;
}

export interface AiContext {
  currentAnime?: string;
  genres?: string[];
  libraryCount?: number;
}

export type SenseiMode =
  | 'initial'
  | 'general'
  | 'recommendations'
  | 'watch_order'
  | 'lore'
  | 'seasonal'
  | 'about'
  | 'vibe'
  | 'recap';

// Known Anime Genres on AniList and common aliases
export const RECOGNIZED_GENRES: { [key: string]: string } = {
  action: 'Action',
  adventure: 'Adventure',
  comedy: 'Comedy',
  drama: 'Drama',
  ecchi: 'Ecchi',
  fantasy: 'Fantasy',
  horror: 'Horror',
  'mahou shoujo': 'Mahou Shoujo',
  'magical girl': 'Mahou Shoujo',
  mecha: 'Mecha',
  music: 'Music',
  mystery: 'Mystery',
  psychological: 'Psychological',
  romance: 'Romance',
  'sci-fi': 'Sci-Fi',
  'sci fi': 'Sci-Fi',
  scifi: 'Sci-Fi',
  'science fiction': 'Sci-Fi',
  'slice of life': 'Slice of Life',
  'slice-of-life': 'Slice of Life',
  sports: 'Sports',
  supernatural: 'Supernatural',
  thriller: 'Thriller',
  isekai: 'Fantasy',
  shonen: 'Action',
  shounen: 'Action',
  seinen: 'Psychological',
  shojo: 'Romance',
  shoujo: 'Romance',
  josei: 'Drama',
  cyberpunk: 'Sci-Fi',
  'dark fantasy': 'Fantasy',
  romcom: 'Romance',
  'romantic comedy': 'Romance',
};

// Function to extract bracketed anime titles: **[Title]** or [Title]
export function extractAnimeTitles(markdownText: string): string[] {
  const titles: string[] = [];
  const regex = /\[([A-Za-z0-9\s:;,\-–—'’!?&]+)\]/g;
  let match;
  while ((match = regex.exec(markdownText)) !== null) {
    const title = match[1].trim();
    if (title && !titles.includes(title) && title.length > 2 && title.length < 60) {
      titles.push(title);
    }
  }
  return titles;
}

/**
 * Detect if user is asking for "anime like [X]" or "similar to [X]"
 */
export function extractSimilarAnimeQuery(message: string): string | null {
  const cleanMsg = message.trim();

  const patterns = [
    /(?:anime|shows?|series|recommendations?)\s+(?:like|similar to|comparable to)\s+([A-Za-z0-9\s:;,\-–—'’!?&]+)/i,
    /(?:if i liked|loved|enjoyed|watching)\s+([A-Za-z0-9\s:;,\-–—'’!?&]+?)(?:,?\s*(?:what|give|recommend|any|suggest|anime).*|$)/i,
    /(?:something|anything|recommend me)\s+(?:like|similar to)\s+([A-Za-z0-9\s:;,\-–—'’!?&]+)/i,
    /^like\s+([A-Za-z0-9\s:;,\-–—'’!?&]+)$/i,
    /([A-Za-z0-9\s:;,\-–—'’!?&]+)\s+(?:recommendations|similar anime)/i,
    /^(?:recommend|suggest)\s+([A-Za-z0-9\s:;,\-–—'’!?&]+)$/i,
  ];

  for (const pattern of patterns) {
    const match = cleanMsg.match(pattern);
    if (match && match[1]) {
      const extracted = match[1]
        .replace(/(?:please|anime|suggestions?|recommendations?|\?|\.)$/gi, '')
        .trim();
      if (extracted.length > 1 && extracted.length < 60) {
        return extracted;
      }
    }
  }
  return null;
}

/**
 * Detect if user is asking for Watch Order
 */
export function extractWatchOrderQuery(message: string): string | null {
  const cleanMsg = message.trim();
  const patterns = [
    /(?:watch order|chronological order|order|timeline|how to watch)\s+(?:for|of)?\s*([A-Za-z0-9\s:;,\-–—'’!?&]+)/i,
    /([A-Za-z0-9\s:;,\-–—'’!?&]+)\s+(?:watch order|timeline|chronological order|order)/i,
    /^(?:order of|watch)\s+([A-Za-z0-9\s:;,\-–—'’!?&]+)$/i,
  ];

  for (const pattern of patterns) {
    const match = cleanMsg.match(pattern);
    if (match && match[1]) {
      const extracted = match[1]
        .replace(/(?:please|anime|franchise|series|\?|\.)$/gi, '')
        .trim();
      if (extracted.length > 1 && extracted.length < 60) {
        return extracted;
      }
    }
  }
  return null;
}

/**
 * Detect if user is asking for Lore
 */
export function extractLoreQuery(message: string): string | null {
  const cleanMsg = message.trim();
  const patterns = [
    /(?:lore|story|background|plot|summary|universe|world of|breakdown)\s+(?:for|of|about)?\s*([A-Za-z0-9\s:;,\-–—'’!?&]+)/i,
    /([A-Za-z0-9\s:;,\-–—'’!?&]+)\s+(?:lore|story|plot|universe|world)/i,
    /^(?:explain|tell me about)\s+([A-Za-z0-9\s:;,\-–—'’!?&]+)$/i,
  ];

  for (const pattern of patterns) {
    const match = cleanMsg.match(pattern);
    if (match && match[1]) {
      const extracted = match[1]
        .replace(/(?:please|anime|lore|story|\?|\.)$/gi, '')
        .trim();
      if (extracted.length > 1 && extracted.length < 60) {
        return extracted;
      }
    }
  }
  return null;
}

/**
 * Detect if user is asking for a genre recommendation or typed a genre name
 */
export function extractGenreQuery(message: string): string | null {
  const clean = message.trim().toLowerCase();
  if (!clean) return null;

  // Direct exact key match
  if (RECOGNIZED_GENRES[clean]) {
    return RECOGNIZED_GENRES[clean];
  }

  // Clean stripped punctuation
  const stripped = clean
    .replace(/[?!.,;:()[\]{}"'`~*#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (RECOGNIZED_GENRES[stripped]) {
    return RECOGNIZED_GENRES[stripped];
  }

  // Check matching phrases
  for (const [key, standardGenre] of Object.entries(RECOGNIZED_GENRES)) {
    if (
      stripped === key ||
      stripped === `${key} anime` ||
      stripped === `anime ${key}` ||
      stripped === `best ${key}` ||
      stripped === `top ${key}` ||
      stripped === `good ${key}` ||
      stripped === `recommend ${key}` ||
      stripped === `suggest ${key}` ||
      stripped === `i want ${key}` ||
      stripped === `give me ${key}` ||
      stripped === `show me ${key}` ||
      stripped === `looking for ${key}` ||
      stripped === `${key} shows` ||
      stripped === `${key} series`
    ) {
      return standardGenre;
    }

    const escaped = key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
    if (regex.test(stripped)) {
      return standardGenre;
    }
  }

  return null;
}

/**
 * Option 4: Returns Top 10 Seasonal / Trending Anime from AniList Sync
 */
export async function getSeasonalHighlights(): Promise<{ reply: string; suggestedAnime: Anime[] }> {
  try {
    const trending = await searchAnimeAdvanced({
      sort: 'TRENDING_DESC',
      perPage: 10,
    });

    if (trending && trending.length > 0) {
      const listText = trending
        .map((item, idx) => {
          const title = item.title?.english || item.title?.romaji || item.title?.userPreferred || 'Anime';
          const rating = item.averageScore ? `★ ${item.averageScore}%` : 'High Rated';
          const eps = item.episodes ? `${item.episodes} eps` : item.format || 'Series';
          const genreStr = item.genres?.slice(0, 3).join(', ') || 'Anime';
          return `${idx + 1}. **[${title}]** (${rating} • ${eps} • *${genreStr}*)`;
        })
        .join('\n');

      const reply = `### 🔥 **Top 10 Seasonal & Trending Anime Highlights**\n\nHere are the 10 most popular, highly discussed anime currently trending on AniLove (synced with AniList):\n\n${listText}\n\n*Click on any anime card below to start streaming immediately or view its complete details!*`;

      return {
        reply,
        suggestedAnime: trending,
      };
    }
  } catch (err) {
    console.warn('Error fetching seasonal highlights:', err);
  }

  return {
    reply: `### 🔥 **Seasonal Highlights**\n\n- **[Frieren: Beyond Journey's End]** (★ 93% • 28 eps)\n- **[Solo Leveling]** (★ 86% • 12 eps)\n- **[Jujutsu Kaisen]** (★ 88% • 24 eps)\n- **[Demon Slayer: Kimetsu no Yaiba]** (★ 85% • 26 eps)\n- **[Attack on Titan]** (★ 90% • 25 eps)`,
    suggestedAnime: [],
  };
}

/**
 * Option 5: Returns Complete AniLove Website Feature Guide (Automated Fixed Response)
 */
export function getWebsiteFeaturesGuide(): string {
  return `### 🌐 **Welcome to AniLove — Your Ultimate Anime Sanctuary!**

AniLove is a feature-rich anime destination with automated sync, free streaming, and gamified features:

🎬 **1. Free HD Streaming & Custom Anime Player**
- Watch thousands of anime series and movies in crystal clear high definition.
- Smart player equipped with **automatic Intro/Outro skip**, multi-server source switching, variable playback speeds (0.5x to 2x), subtitle options, and auto-resume.

🎮 **2. The Arcade Arena & Mini-Games**
- **Anime Shadow Guesser**: Test your anime visual memory by guessing characters from dynamic silhouette shadows.
- **Character Blur Guesser**: Race against the clock as blurred portraits gradually sharpen into focus.
- **Emoji Anime Cipher**: Decode iconic anime titles represented solely through emoji riddles.
- **Higher or Lower**: Compare AniList popularity and average rating stats in a fast-paced trivia face-off.
- **Anime Quotes Challenge**: Guess the character and anime from legendary quotes.

🪙 **3. Arcade Coin Economy**
- Earn **Arcade Coins** by playing mini-games, watching anime episodes, and logging in daily.
- Use your coins to summon new character cards and unlock dazzling holographic foil upgrades!

🎴 **4. Character Gacha, 3D Foil Awakenings & Turntable**
- Pull hundreds of iconic anime character cards across 4 tiers:
  - **★ Lv.1 Holo**
  - **★★ Lv.2 Rare**
  - **★★★ Lv.3 Master**
  - **★★★★ Lv.4 Secret**
- Inspect every card in **real-time 3D** with 360° touch-drag rotation and holographic sheen effects!

🧸 **5. 3D Interactive Chibi Floating Companions**
- Choose any collected character as your **Floating Mascot Companion** that travels with you throughout the app.
- Tap your chibi to trigger live action animations: Flying Kicks, Rapid Punches, High Jumps, Anime Dances, and Aura Charges!

🧭 **6. Franchise Watch Order Navigator**
- Never get lost in multi-season franchises. View complete chronological release sequences with TV seasons, canon movies, OVAs, and specials clearly badged with release years.

📚 **7. Library Tracking & Cloud Sync**
- Organize your personal watchlist into *Watching*, *Completed*, *Plan to Watch*, *Paused*, and *Dropped* with episode progress tracking and cloud backup.

*Have any questions? Pick any of the options above or enter an anime name to explore!*`;
}

/**
 * Option 2: Resolves Watch Order for a given anime franchise from AniList relations
 */
export async function getAnimeWatchOrderGuide(
  query: string
): Promise<{ reply: string; suggestedAnime: Anime[] }> {
  try {
    const searchResults = await searchAnimeAdvanced({ search: query, perPage: 1 });
    if (searchResults && searchResults.length > 0) {
      const anime = searchResults[0];
      const details = await fetchAnimeDetails(anime.id);
      const watchOrder = await fetchFranchiseWatchOrder(anime, details);

      const items = watchOrder.recommendedOrder || [];
      const franchiseTitle =
        watchOrder.franchiseTitle ||
        anime.title.english ||
        anime.title.romaji ||
        anime.title.userPreferred ||
        query;

      if (items.length > 0) {
        const orderListText = items
          .map((item) => {
            const yearStr = item.releaseYear ? ` (${item.releaseYear})` : '';
            const epStr = item.episodesCount ? ` • ${item.episodesCount}` : '';
            const badge = item.typeBadge || item.format;
            const canonBadge = item.importanceLabel || 'Canon';
            return `**Step ${item.stepNumber}:** **[${item.title}]**${yearStr}\n  - *${badge}${epStr}* — **${canonBadge}**\n  - ${item.orderGuide || 'Follow in release sequence.'}`;
          })
          .join('\n\n');

        const reply = `### 🧭 **Official Watch Order Guide for [${franchiseTitle}]**\n\nHere is the franchise release order comprising **${items.length} entries** (${watchOrder.totalEstimatedEpisodes || items.length} total episodes):\n\n${orderListText}\n\n*Click on any season card below to start watching or view full episode listings!*`;

        const suggested = items
          .map((it) => it.animeObj)
          .filter((a): a is Anime => Boolean(a))
          .slice(0, 8);

        return {
          reply,
          suggestedAnime: suggested.length > 0 ? suggested : [anime],
        };
      }
    }
  } catch (err) {
    console.warn('Error fetching watch order:', err);
  }

  return {
    reply: `### 🧭 **Watch Order Guide for [${query}]**\n\nRecommended standard franchise sequence:\n\n1. **Step 1:** **[${query}]** (Season 1 / Main Series) — *Canon Series*\n2. **Step 2:** Canon sequels, movies, and spin-off specials in release order.\n\n*Check the Watch Order tab on the anime details page for the dynamic franchise node graph!*`,
    suggestedAnime: [],
  };
}

/**
 * Option 3: Resolves Lore and Story breakdown directly from the anime details page (AniList)
 */
export async function getAnimeLoreGuide(
  query: string
): Promise<{ reply: string; suggestedAnime: Anime[] }> {
  try {
    const searchResults = await searchAnimeAdvanced({ search: query, perPage: 1 });
    if (searchResults && searchResults.length > 0) {
      const anime = searchResults[0];
      const details = await fetchAnimeDetails(anime.id);

      const title = anime.title.english || anime.title.romaji || anime.title.userPreferred || query;
      const cleanDesc = details?.description
        ? sanitizeDescription(details.description)
        : anime.description
        ? sanitizeDescription(anime.description)
        : 'An acclaimed animated series with captivating storytelling.';

      const genres = anime.genres?.join(', ') || 'Action, Drama';
      const year = anime.seasonYear || anime.startDate?.year || 'N/A';
      const score = anime.averageScore ? `★ ${anime.averageScore}%` : 'Masterpiece';
      const format = anime.format || 'TV Series';
      const epCount = anime.episodes ? `${anime.episodes} episodes` : 'Full Series';
      const studio = details?.studios?.nodes?.[0]?.name || 'Acclaimed Studio';

      // Key characters extraction
      let charSection = '';
      const characterEdges = details?.characters?.edges || [];
      if (characterEdges.length > 0) {
        const charNames = characterEdges
          .slice(0, 5)
          .map((e) => e.node?.name?.full || e.node?.name?.native)
          .filter(Boolean);
        if (charNames.length > 0) {
          charSection = `\n\n👥 **Key Characters & Cast:**\n- **${charNames.join('**, **')}**`;
        }
      }

      const reply = `### 📜 **Anime Lore & Story Dossier: [${title}]**\n\n📊 **Series Information:**\n- **Rating:** ${score} on AniList\n- **Release Year:** ${year}\n- **Studio:** ${studio}\n- **Genres:** ${genres}\n- **Format:** ${format} (${epCount})\n\n🏰 **Story Synopsis & Universe Lore:**\n${cleanDesc}${charSection}\n\n*Click the card below to start streaming immediately or view all episodes!*`;

      return {
        reply,
        suggestedAnime: [anime],
      };
    }
  } catch (err) {
    console.warn('Error fetching anime lore:', err);
  }

  return {
    reply: `### 📜 **Lore Dossier for [${query}]**\n\nCould not find specific details for "${query}". Try searching with the exact Japanese or English title!\n\n*Explore the Details page for full episode summaries and character bios!*`,
    suggestedAnime: [],
  };
}

/**
 * Option 1: Resolves similar anime recommendations ("More Like This" from Anime Details)
 */
export async function getAnimeRecommendationsGuide(
  query: string
): Promise<{ reply: string; suggestedAnime: Anime[] }> {
  try {
    const searchResults = await searchAnimeAdvanced({ search: query, perPage: 1 });
    if (searchResults && searchResults.length > 0) {
      const foundAnime = searchResults[0];
      const targetTitle =
        foundAnime.title?.english ||
        foundAnime.title?.romaji ||
        foundAnime.title?.userPreferred ||
        query;

      // Fetch full details to get "More Like This" community recommendations
      const details = await fetchAnimeDetails(foundAnime.id);
      const rawRecs = details?.recommendations?.nodes || [];

      // Extract valid recommended media
      const validRecAnime: Anime[] = [];
      const seenIds = new Set<number>([foundAnime.id]);

      for (const rec of rawRecs) {
        const med = rec?.mediaRecommendation;
        if (med && !seenIds.has(med.id) && !med.isAdult) {
          seenIds.add(med.id);
          validRecAnime.push(med);
          if (validRecAnime.length >= 6) break;
        }
      }

      // If no direct recommendations, query top anime in the same genre
      if (validRecAnime.length === 0 && foundAnime.genres && foundAnime.genres.length > 0) {
        const genreRecs = await searchAnimeAdvanced({
          genres: [foundAnime.genres[0]],
          sort: 'SCORE_DESC',
          perPage: 6,
        });
        genreRecs.forEach((g) => {
          if (!seenIds.has(g.id)) {
            seenIds.add(g.id);
            validRecAnime.push(g);
          }
        });
      }

      if (validRecAnime.length > 0) {
        const listText = validRecAnime
          .map((rec) => {
            const recTitle =
              rec.title?.english ||
              rec.title?.romaji ||
              rec.title?.userPreferred ||
              'Anime';
            const genreStr = rec.genres?.slice(0, 3).join(', ') || 'Anime';
            const rating = rec.averageScore ? `★ ${rec.averageScore}%` : 'High Rated';
            const eps = rec.episodes ? `${rec.episodes} eps` : rec.format || 'Series';
            const syn = rec.description
              ? sanitizeDescription(rec.description).slice(0, 130) + '...'
              : 'Fans of ' + targetTitle + ' strongly recommend this series!';
            return `- **[${recTitle}]** (${rating} • ${eps} • *${genreStr}*)\n  ${syn}`;
          })
          .join('\n\n');

        const reply = `### ✨ **Anime Like [${targetTitle}] (Personalized Recommendations)**\n\nIf you enjoyed **${targetTitle}**, here are top-rated community recommendations ("More Like This"):\n\n${listText}\n\n*Click on any title card below to view episodes or start watching!*`;

        return {
          reply,
          suggestedAnime: validRecAnime,
        };
      }
    }
  } catch (err) {
    console.warn('Error fetching recommendations:', err);
  }

  return {
    reply: `### ✨ **Recommendations based on [${query}]**\n\n- **[Frieren: Beyond Journey's End]** (★ 93% • Fantasy / Adventure)\n- **[Solo Leveling]** (★ 86% • Action / Fantasy)\n- **[Jujutsu Kaisen]** (★ 88% • Action / Supernatural)\n- **[Demon Slayer]** (★ 85% • Action / Historical)`,
    suggestedAnime: [],
  };
}

/**
 * Primary Automated AniAI Sensei Handler:
 * 100% automated — parses mode or query and fetches AniList data directly without calling external AI APIs.
 */
export async function askAnimeSensei(
  message: string,
  context?: AiContext,
  mode: SenseiMode = 'general'
): Promise<{ reply: string; isFallback: boolean; suggestedAnime: Anime[] }> {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // 1. Option 5: About AniLove / Platform guide
  if (
    mode === 'about' ||
    lower === 'about' ||
    lower.includes('about this website') ||
    lower.includes('about anilove') ||
    lower.includes('what is anilove') ||
    lower.includes('website features') ||
    lower.includes('how to earn coins') ||
    lower.includes('how to play games')
  ) {
    return {
      reply: getWebsiteFeaturesGuide(),
      isFallback: false,
      suggestedAnime: [],
    };
  }

  // 2. Option 4: Seasonal Highlights / Top 10 from AniList Sync
  if (
    mode === 'seasonal' ||
    lower === 'seasonal highlights' ||
    lower.includes('top 10') ||
    lower.includes('trending anime') ||
    lower.includes('seasonal anime') ||
    lower.includes('most popular anime') ||
    lower.includes('hottest anime')
  ) {
    const highlights = await getSeasonalHighlights();
    return {
      reply: highlights.reply,
      isFallback: false,
      suggestedAnime: highlights.suggestedAnime,
    };
  }

  // 3. Option 1 / Genre Query: (e.g. "Action", "Romance", "Fantasy")
  const genreTarget = extractGenreQuery(trimmed);
  if (genreTarget) {
    try {
      const genreResults = await searchAnimeAdvanced({
        genres: [genreTarget],
        sort: 'SCORE_DESC',
        perPage: 6,
      });

      if (genreResults && genreResults.length > 0) {
        const listText = genreResults
          .map((rec) => {
            const recTitle =
              rec.title?.english ||
              rec.title?.romaji ||
              rec.title?.userPreferred ||
              'Anime';
            const genreStr = rec.genres?.slice(0, 3).join(', ') || genreTarget;
            const rating = rec.averageScore ? `★ ${rec.averageScore}%` : 'Masterpiece';
            const eps = rec.episodes ? `${rec.episodes} eps` : rec.format || 'Series';
            const syn = rec.description
              ? sanitizeDescription(rec.description).slice(0, 140) + '...'
              : 'Top rated series in ' + genreTarget;
            return `- **[${recTitle}]** (${rating} • ${eps} • *${genreStr}*)\n  ${syn}`;
          })
          .join('\n\n');

        const reply = `### 🏆 **Top Acclaimed [${genreTarget}] Anime Recommendations**\n\nHere are the highest-rated and community-favorite **${genreTarget}** anime on AniLove:\n\n${listText}\n\n*Click on any anime card below to stream immediately or view full details!*`;

        return {
          reply,
          isFallback: false,
          suggestedAnime: genreResults,
        };
      }
    } catch (err) {
      console.warn('Error fetching genre anime recommendations:', err);
    }
  }

  // 4. Option 2: Watch Order Query
  const watchOrderTarget = extractWatchOrderQuery(trimmed);
  if (mode === 'watch_order' || watchOrderTarget) {
    const targetTitle = watchOrderTarget || trimmed;
    const orderResult = await getAnimeWatchOrderGuide(targetTitle);
    return {
      reply: orderResult.reply,
      isFallback: false,
      suggestedAnime: orderResult.suggestedAnime,
    };
  }

  // 5. Option 3: Lore & Story Dossier Query
  const loreTarget = extractLoreQuery(trimmed);
  if (mode === 'lore' || loreTarget) {
    const targetTitle = loreTarget || trimmed;
    const loreResult = await getAnimeLoreGuide(targetTitle);
    return {
      reply: loreResult.reply,
      isFallback: false,
      suggestedAnime: loreResult.suggestedAnime,
    };
  }

  // 6. Option 1: Similar Anime Recommendations ("Anime like [X]")
  const similarTarget = extractSimilarAnimeQuery(trimmed);
  if (mode === 'recommendations' || similarTarget) {
    const target = similarTarget || trimmed;
    const recsResult = await getAnimeRecommendationsGuide(target);
    return {
      reply: recsResult.reply,
      isFallback: false,
      suggestedAnime: recsResult.suggestedAnime,
    };
  }

  // 7. General search term or direct anime title: Search AniList directly and return details & cards
  try {
    const searchResults = await searchAnimeAdvanced({ search: trimmed, perPage: 4 });
    if (searchResults && searchResults.length > 0) {
      const topMatch = searchResults[0];
      const targetTitle = topMatch.title?.english || topMatch.title?.romaji || topMatch.title?.userPreferred || trimmed;
      const details = await fetchAnimeDetails(topMatch.id).catch(() => null);

      const cleanDesc = details?.description
        ? sanitizeDescription(details.description)
        : topMatch.description
        ? sanitizeDescription(topMatch.description)
        : 'A celebrated anime series.';

      const score = topMatch.averageScore ? `★ ${topMatch.averageScore}%` : 'High Rated';
      const genres = topMatch.genres?.join(', ') || 'Anime';
      const eps = topMatch.episodes ? `${topMatch.episodes} episodes` : topMatch.format || 'Series';

      const reply = `### 🎬 **[${targetTitle}]** (${score} • ${eps} • *${genres}*)\n\n${cleanDesc}\n\n*Click "Watch" on any card below to start streaming immediately, or "Details" for episodes, watch order, and cast!*`;

      return {
        reply,
        isFallback: false,
        suggestedAnime: searchResults,
      };
    }
  } catch (searchErr) {
    console.warn('Direct search error:', searchErr);
  }

  // 8. Default fallback using top trending titles
  try {
    const trending = await searchAnimeAdvanced({ sort: 'POPULARITY_DESC', perPage: 4 });
    const listText = trending
      .map((item) => {
        const title = item.title?.english || item.title?.romaji || item.title?.userPreferred || 'Anime';
        const rating = item.averageScore ? `★ ${item.averageScore}%` : 'High Rated';
        const genres = item.genres?.slice(0, 3).join(', ') || 'Action, Fantasy';
        return `- **[${title}]** (${rating} • *${genres}*)`;
      })
      .join('\n');

    return {
      reply: `### ✨ **AniAI Automated Guide**\n\nHere are some of the most acclaimed series currently trending in the anime world:\n\n${listText}\n\n*Select any option above or type an anime name/genre to explore!*`,
      isFallback: true,
      suggestedAnime: trending,
    };
  } catch {
    return {
      reply: `### ✨ **AniAI Guide**\n\n- **[Frieren: Beyond Journey's End]** — A breathtaking fantasy journey exploring time, legacy, and poignant relationships.\n- **[Solo Leveling]** — Peak modern dungeon hunter action with jaw-dropping fights and rapid progression.\n- **[Attack on Titan]** — Dark fantasy, high-stakes mystery, and relentless twists.\n\n*Select an option above to get started!*`,
      isFallback: true,
      suggestedAnime: [],
    };
  }
}

