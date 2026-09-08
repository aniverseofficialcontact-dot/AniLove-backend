export type MediaListStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';

export interface AnimeTitle {
  romaji?: string;
  english?: string;
  native?: string;
  userPreferred?: string;
}

export interface AnimeCover {
  extraLarge?: string;
  large?: string;
  medium?: string;
  color?: string;
}

export interface FuzzyDate {
  year?: number;
  month?: number;
  day?: number;
}

export interface AiringScheduleNode {
  id?: number;
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
}

export interface AnimeTrailer {
  id?: string;
  site?: string;
  thumbnail?: string;
}

export interface StudioNode {
  id: number;
  name: string;
  isAnimationStudio?: boolean;
}

export interface VoiceActor {
  id: number;
  name: {
    full: string;
    native?: string;
  };
  image?: {
    medium?: string;
    large?: string;
  };
  language?: string;
}

export interface CharacterItem {
  id: number;
  name: {
    full: string;
    native?: string;
  };
  image?: {
    medium?: string;
    large?: string;
  };
  role: string;
  voiceActors?: VoiceActor[];
}

export interface RelationEdge {
  relationType: string;
  node: Anime;
}

export interface RecommendationNode {
  id: number;
  rating?: number;
  mediaRecommendation?: Anime;
}

export interface ExternalLink {
  id: number;
  url: string;
  site: string;
  icon?: string;
  color?: string;
}

export interface StreamingEpisode {
  title?: string;
  thumbnail?: string;
  url?: string;
  site?: string;
}

export interface Anime {
  id: number;
  idMal?: number;
  title: AnimeTitle;
  coverImage: AnimeCover;
  bannerImage?: string;
  format?: string;
  episodes?: number;
  duration?: number;
  status?: string;
  season?: string;
  seasonYear?: number;
  averageScore?: number;
  meanScore?: number;
  popularity?: number;
  genres: string[];
  description?: string;
  source?: string;
  studios?: {
    nodes: StudioNode[];
  };
  nextAiringEpisode?: AiringScheduleNode;
  trailer?: AnimeTrailer;
  isAdult?: boolean;
  siteUrl?: string;
  startDate?: FuzzyDate;
  endDate?: FuzzyDate;
}

export interface AnimeDetail extends Anime {
  relations?: {
    edges: RelationEdge[];
  };
  recommendations?: {
    nodes: RecommendationNode[];
  };
  characters?: {
    edges: {
      role: string;
      node: {
        id: number;
        name: { full: string; native?: string };
        image?: { large?: string; medium?: string };
      };
      voiceActors?: VoiceActor[];
    }[];
  };
  externalLinks?: ExternalLink[];
  streamingEpisodes?: StreamingEpisode[];
}

export interface WatchOrderItem {
  id?: number; // AniList media id
  idMal?: number;
  stepNumber: number;
  title: string;
  romajiTitle?: string;
  nativeTitle?: string;
  format: 'TV' | 'MOVIE' | 'OVA' | 'ONA' | 'SPECIAL' | 'TV_SHORT' | string;
  typeBadge: string; // e.g. "Main Season", "Prequel", "Canon Movie", "Side Story OVA", "Final Season"
  episodesCount?: number | string;
  duration?: string;
  releaseYear?: number | string;
  importance: 'essential' | 'recommended' | 'optional' | 'alternative';
  importanceLabel: string; // "Must Watch (Main Story)", "Canon Story", "Optional OVA", "Alternate Timeline"
  orderGuide: string; // e.g. "Start here. Season 1 covers chapters 1-33.", "Watch immediately after Season 1"
  note?: string;
  synopsisSnippet?: string;
  coverImage?: string;
  bannerImage?: string;
  animeObj?: Anime;
  relationType?: string;
}

export interface FranchiseWatchOrder {
  animeId: number;
  franchiseTitle: string;
  summary: string;
  totalEntries: number;
  totalEstimatedEpisodes?: number;
  totalEstimatedHours?: string;
  recommendedOrder: WatchOrderItem[];
  chronologicalOrder?: WatchOrderItem[];
  releaseOrder?: WatchOrderItem[];
  isAiGenerated?: boolean;
}

export interface AiringScheduleItem {
  id: number;
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
  media: Anime;
}

export type AppTheme = 'midnight' | 'cyber' | 'sakura' | 'slate' | 'light' | 'ghibli' | 'amoled' | 'solar';

export type EqualizerPreset = 'flat' | 'vocal' | 'bass' | 'cinema' | 'night';

export type GachaRarity = 'UR' | 'SSR' | 'SR' | 'R';
export type GachaElement = 'Flame' | 'Water' | 'Wind' | 'Lightning' | 'Void' | 'Light' | string;

export interface GachaCard {
  id: string;
  characterId?: number;
  animeId: number;
  animeTitle: string;
  characterName: string;
  characterNativeName?: string;
  characterImage?: string;
  imageUrl?: string;
  characterRole?: string;
  voiceActor?: string;
  quote?: string;
  rarity?: string;
  element?: string;
  stats?: {
    power: number;
    speed: number;
    intellect: number;
  };
  pulledAt?: number;
  obtainedAt?: number;
  starRating?: number;
  coinPrice?: number;
}

export interface DailyGameRecord {
  date: string; // YYYY-MM-DD
  played: number;
  correct: number;
  bonusUnlocked: boolean;
  maxAllowed: number;
}

export interface CharacterShopItem {
  id: number;
  name: string;
  nativeName?: string;
  image: string;
  animeId: number;
  animeTitle: string;
  role: string;
  voiceActor?: string;
  quote?: string;
  price: number;
  isLegendary?: boolean;
}

export type TierLevel = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type TierRank = TierLevel;

export interface TierListEntry {
  animeId: number;
  title?: string;
  image?: string;
  score?: number;
  tier?: TierLevel;
  rank?: TierRank;
  anime?: Anime;
  order?: number;
  note?: string;
  rankedAt?: number;
}

export interface EpisodeNote {
  id: string;
  animeId: number;
  episodeNumber: number;
  timestamp: number; // video seconds
  text: string;
  createdAt: number;
}

export interface UserMediaListItem {
  id?: number; // AniList list entry ID if synced
  mediaId: number;
  status: MediaListStatus;
  progress: number;
  score: number;
  updatedAt: number;
  media: Anime;
  customTags?: string[];
  rewatchCount?: number;
  notes?: string;
}

export interface AniListUser {
  id: number;
  name: string;
  avatar?: {
    large?: string;
    medium?: string;
  };
  bannerImage?: string;
  statistics?: {
    anime?: {
      count: number;
      meanScore: number;
      minutesWatched: number;
      episodesWatched: number;
    };
  };
}

export interface MALUser {
  id?: number;
  name: string;
  picture?: string;
  location?: string;
  joinedAt?: string;
  animeStats?: {
    daysWatched?: number;
    meanScore?: number;
    watching?: number;
    completed?: number;
    onHold?: number;
    dropped?: number;
    planToWatch?: number;
    totalEntries?: number;
    episodesWatched?: number;
  };
}

export interface AppNotification {
  id: string;
  type: 'airing' | 'sync' | 'library' | 'system';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  anime?: Anime;
  episode?: number;
}

export type StreamServerId =
  | 'anikoto'
  | 'anikoto-hd1'
  | 'anikoto-vidstream'
  | 'anikoto-vidplay'
  | 'anikoto-hd2'
  | 'anikoto-ultra'
  | 'anify-cloud'
  | 'anify-fast'
  | 'tatakai-multi'
  | 'tatakai-pahe'
  | 'renime-dub'
  | 'miruro-stream'
  | 'miruro-pro'
  | 'miruro-pahe'
  | 'official-link';
export type AudioLanguagePreference = 'SUB' | 'DUB';

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  pin?: string | null;
  isKids?: boolean;
  createdAt: number;
}

export interface UserSettings {
  theme: AppTheme;
  twoWaySyncEnabled: boolean;
  syncEpisodeProgress: boolean;
  syncWatchStatus: boolean;
  syncScores: boolean;
  anilistToken?: string | null;
  anilistUser: AniListUser | null;
  importUsername: string | null;
  autoSyncAniList: boolean;
  lastSyncTimestamp: number | null;
  // MyAnimeList (MAL) Settings
  malUsername?: string | null;
  malToken?: string | null;
  malUser?: MALUser | null;
  malSyncEnabled?: boolean;
  autoSyncMAL?: boolean;
  primaryTracker?: 'anilist' | 'mal' | 'both';
  // User Profile & Account Settings
  currentProfileId: string;
  profiles: UserProfile[];
  profilePin: string | null;
  profilePinEnabled: boolean;
  profilePinBackupQuestion?: string;
  profilePinBackupAnswer?: string | null;
  customDisplayName?: string;
  uniqueUsername?: string;
  userBio?: string;
  customEmail?: string;
  customAvatar?: string;
  contentRestrictions: boolean; // Mature/Adult filter: default false
  // Notifications
  notificationsEnabled: boolean;
  notifyAiringEpisodes: boolean;
  notifySyncUpdates: boolean;
  notifyDailyDigest: boolean;
  browserPushEnabled: boolean;
  // Player & App Preferences
  preferredAudio: 'sub' | 'dub';
  preferredLanguages: AudioLanguagePreference[]; // e.g. ['SUB', 'DUB'] (Rank 1, Rank 2)
  preferredServers: StreamServerId[]; // ordered legal/official streaming providers
  autoPlayNextEpisode: boolean;
  defaultStreamServer: string;
  ambientGlowEnabled?: boolean;
  autoSkipIntro?: boolean;
  equalizerPreset?: EqualizerPreset;
  soundEffectsEnabled?: boolean;
  soundVolume?: number;
  sleepTimerMinutes?: number;
  enable3DCardPreview?: boolean;
  ambientParticlesEnabled?: boolean;
  ambientParticleStyle?: 'sakura' | 'snow' | 'fireflies' | 'none';
  appIntroAnimationEnabled?: boolean;
}

export type ThumbnailAppearance = 'snapshot' | 'banner' | 'poster';

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface AnimeQuizData {
  animeTitle: string;
  questions: QuizQuestion[];
  groundingSources?: GroundingSource[];
  isFallback?: boolean;
}

export interface AnimeFact {
  id: number;
  fact: string;
  category?: string;
}

export interface AnimeFactsData {
  animeTitle: string;
  facts: AnimeFact[];
  groundingSources?: GroundingSource[];
  isFallback?: boolean;
}

export interface AnimeReel {
  id: string;
  name?: string;
  title?: string;
  cleanTitle: string;
  size?: string;
  sizeBytes?: number;
  date?: string;
  folderId?: string;
  folderName?: string;
  mimeType?: string;
  url: string;
  directUrl?: string;
  fallbackUrl?: string;
  streamProxyUrl?: string;
  thumbnailUrl?: string;
  savedAt?: number;
}

export interface WatchHistoryEntry {
  animeId: number;
  anime: Anime;
  episodeNumber: number;
  episodeTitle?: string;
  seasonTitle?: string;
  currentTime: number; // in seconds
  duration: number; // in seconds
  lastWatchedAt: number; // timestamp ms
  thumbnailStyle?: ThumbnailAppearance;
  completed?: boolean;
}

// -------------------------------------------------------------
// Direct Messaging (Chat) Types
// -------------------------------------------------------------

export interface ChatUserProfile {
  userId: string;
  username: string; // Unique lowercase handle, e.g. "itachi_99"
  displayName: string;
  avatar: string;
  bio?: string;
  anilistUsername?: string;
  linkedProvider?: 'google' | 'anilist';
  linkedAccount?: string;
  createdAt: number;
  lastActive?: number;
}

export type ChatMessageType = 'text' | 'reel' | 'anime';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  text?: string;
  type: ChatMessageType;
  reelData?: {
    id: string;
    cleanTitle: string;
    url?: string;
    directUrl?: string;
    thumbnailUrl?: string;
    duration?: number;
  };
  animeData?: {
    id: number;
    title: string;
    coverImage?: string;
    score?: number;
    episodes?: number;
    format?: string;
  };
  timestamp: number; // ms
  expiresAt: number; // ms (timestamp + 5 * 86,400,000)
  read: boolean;
}

export interface ChatConversation {
  id: string; // [uid1, uid2].sort().join('_')
  participants: string[];
  participantProfiles: Record<string, {
    userId: string;
    username: string;
    displayName: string;
    avatar: string;
  }>;
  lastMessage?: {
    text: string;
    type: ChatMessageType;
    senderId: string;
    timestamp: number;
  };
  updatedAt: number;
  unreadCounts?: Record<string, number>;
}

