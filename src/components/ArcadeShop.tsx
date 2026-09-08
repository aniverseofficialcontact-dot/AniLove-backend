import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Coins,
  Sparkles,
  Lock,
  CheckCircle2,
  Search,
  Layers,
  Crown,
  Flame,
  Star,
  Info,
  Tv,
  X,
  Plus,
  ArrowRight,
  BookOpen,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Anime, GachaCard, UserMediaListItem, CharacterShopItem } from '../types';
import {
  getStoredLibrary,
  getStoredGachaVault,
  saveStoredGachaCards,
  getStoredArcadeCoins,
  spendArcadeCoins,
  addArcadeCoins,
} from '../services/storage';
import { soundEffects } from '../services/soundEffects';
import {
  ICONIC_CHARACTERS_POOL,
  fetchCharactersForAnime,
  calculateCharacterPrice,
  getSafeCharacterImage,
  getFallbackAvatarSvg,
  createCharacterCardFromProfile,
  AnimeCharacterProfile,
} from '../services/characterPool';
import { searchAnimeAdvanced } from '../services/anilist';
import { CharacterCardModal } from './CharacterCardModal';

interface ArcadeShopProps {
  onOpenDetails?: (anime: Anime) => void;
  onNavigateToGame?: (gameTab: string) => void;
}

export const ArcadeShop: React.FC<ArcadeShopProps> = ({
  onOpenDetails,
  onNavigateToGame,
}) => {
  const [coins, setCoins] = useState<number>(() => getStoredArcadeCoins());
  const [library, setLibrary] = useState<UserMediaListItem[]>(() => getStoredLibrary());
  const [vaultCards, setVaultCards] = useState<GachaCard[]>(() => getStoredGachaVault());
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string>('ALL');
  const [purchasedCardModal, setPurchasedCardModal] = useState<GachaCard | null>(null);
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<AnimeCharacterProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extraAnimeChars, setExtraAnimeChars] = useState<Record<number, AnimeCharacterProfile[]>>({});
  const [loadingAnimeId, setLoadingAnimeId] = useState<number | null>(null);

  // Anime Name Search States
  const [animeSearchQuery, setAnimeSearchQuery] = useState<string>('');
  const [isSearchingAnime, setIsSearchingAnime] = useState<boolean>(false);
  const [searchedAnimeFeedback, setSearchedAnimeFeedback] = useState<{
    animeTitle: string;
    isCompleted: boolean;
    characterCount: number;
    episodesWatched?: number;
    totalEpisodes?: number;
    animeObj?: Anime;
  } | null>(null);

  // Sync state on events
  useEffect(() => {
    const handleStorage = () => {
      setCoins(getStoredArcadeCoins());
      setLibrary(getStoredLibrary());
      setVaultCards(getStoredGachaVault());
    };

    const handleCoinEvent = (e: CustomEvent<number>) => {
      setCoins(e.detail);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('arcade_coins_updated' as any, handleCoinEvent as any);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('arcade_coins_updated' as any, handleCoinEvent as any);
    };
  }, []);

  // Completed anime from library
  const completedAnimeList = useMemo(() => {
    return library.filter(item => item.status === 'COMPLETED');
  }, [library]);

  const completedAnimeIds = useMemo(() => {
    return new Set(completedAnimeList.map(a => a.mediaId));
  }, [completedAnimeList]);

  // Owned character names in vault
  const ownedCharacterKeys = useMemo(() => {
    const set = new Set<string>();
    vaultCards.forEach(c => {
      set.add(`${c.characterName.toLowerCase()}-${c.animeId}`);
    });
    return set;
  }, [vaultCards]);

  // Auto-fetch characters for any completed anime not in the default pool
  useEffect(() => {
    const unindexedCompleted = completedAnimeList.filter(
      item =>
        !ICONIC_CHARACTERS_POOL.some(c => c.animeId === item.mediaId) &&
        !extraAnimeChars[item.mediaId]
    );

    if (unindexedCompleted.length > 0) {
      const target = unindexedCompleted[0];
      setLoadingAnimeId(target.mediaId);
      fetchCharactersForAnime(target.mediaId).then(chars => {
        if (chars && chars.length > 0) {
          setExtraAnimeChars(prev => ({ ...prev, [target.mediaId]: chars }));
        }
        setLoadingAnimeId(null);
      });
    }
  }, [completedAnimeList, extraAnimeChars]);

  // Combined character catalog
  const fullCatalog: AnimeCharacterProfile[] = useMemo(() => {
    const list: AnimeCharacterProfile[] = [...ICONIC_CHARACTERS_POOL];
    (Object.values(extraAnimeChars) as AnimeCharacterProfile[][]).forEach(chars => {
      chars.forEach(c => {
        if (!list.some(existing => existing.id === c.id)) {
          list.push(c);
        }
      });
    });
    return list;
  }, [extraAnimeChars]);

  // Available anime series in catalog
  const availableSeries = useMemo(() => {
    const titles = new Set<string>();
    fullCatalog.forEach(c => {
      if (c.animeTitle) titles.add(c.animeTitle);
    });
    return Array.from(titles).sort();
  }, [fullCatalog]);

  // Filter catalog items
  const filteredCatalog = useMemo(() => {
    return fullCatalog.filter(item => {
      const matchesSearch =
        !searchFilter.trim() ||
        item.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.animeTitle.toLowerCase().includes(searchFilter.toLowerCase());

      const matchesSeries =
        selectedSeriesFilter === 'ALL' || item.animeTitle === selectedSeriesFilter;

      return matchesSearch && matchesSeries;
    });
  }, [fullCatalog, searchFilter, selectedSeriesFilter]);

  // Handle Anime Search Submit
  const handleAnimeSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = animeSearchQuery.trim();
    if (!query) return;

    setIsSearchingAnime(true);
    setSearchedAnimeFeedback(null);

    try {
      // 1. Check local catalog first
      const localMatchedChar = fullCatalog.find(
        c => c.animeTitle.toLowerCase().includes(query.toLowerCase())
      );

      if (localMatchedChar) {
        const animeId = localMatchedChar.animeId;
        const libraryEntry = library.find(item => item.mediaId === animeId);
        const isCompleted = libraryEntry?.status === 'COMPLETED' || completedAnimeIds.has(animeId);

        setSelectedSeriesFilter(localMatchedChar.animeTitle);
        setSearchFilter('');
        setSearchedAnimeFeedback({
          animeTitle: localMatchedChar.animeTitle,
          isCompleted,
          characterCount: fullCatalog.filter(c => c.animeId === animeId).length,
          episodesWatched: libraryEntry?.progress || 0,
          totalEpisodes: libraryEntry?.media?.episodes || 0,
          animeObj: libraryEntry?.media,
        });
        setIsSearchingAnime(false);
        return;
      }

      // 2. Search AniList API for anime title
      const searchResults = await searchAnimeAdvanced({ search: query, perPage: 6 });
      if (searchResults && searchResults.length > 0) {
        const topResult = searchResults[0];
        const animeId = topResult.id;
        const title = topResult.title.english || topResult.title.userPreferred || topResult.title.romaji || query;

        // Check completion status in library
        const libraryEntry = library.find(item => item.mediaId === animeId);
        const isCompleted = libraryEntry?.status === 'COMPLETED' || completedAnimeIds.has(animeId);

        // Fetch characters for this anime if not already loaded
        let chars = extraAnimeChars[animeId];
        if (!chars) {
          chars = await fetchCharactersForAnime(animeId);
          if (chars && chars.length > 0) {
            setExtraAnimeChars(prev => ({ ...prev, [animeId]: chars }));
          }
        }

        setSelectedSeriesFilter(title);
        setSearchFilter('');
        setSearchedAnimeFeedback({
          animeTitle: title,
          isCompleted,
          characterCount: chars ? chars.length : 0,
          episodesWatched: libraryEntry?.progress || 0,
          totalEpisodes: topResult.episodes || libraryEntry?.media?.episodes || 0,
          animeObj: topResult,
        });
      } else {
        setSearchedAnimeFeedback({
          animeTitle: query,
          isCompleted: false,
          characterCount: 0,
        });
      }
    } catch (err) {
      console.warn('Anime search in shop failed:', err);
    } finally {
      setIsSearchingAnime(false);
    }
  };

  // Purchase Character Card
  const handlePurchase = (item: AnimeCharacterProfile) => {
    const isCompleted = completedAnimeIds.has(item.animeId);
    if (!isCompleted) return;

    const itemPrice = item.price || 20;
    if (coins < itemPrice || isProcessing) return;

    setIsProcessing(true);
    const success = spendArcadeCoins(itemPrice);

    if (success) {
      soundEffects.playPurchase();
      const newCard = createCharacterCardFromProfile(item);
      const updatedVault = [newCard, ...vaultCards];
      setVaultCards(updatedVault);
      saveStoredGachaCards(updatedVault);
      setCoins(getStoredArcadeCoins());

      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981'],
      });

      setPurchasedCardModal(newCard);
      setIsProcessing(false);
    } else {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Shop Banner & Wallet Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/20 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-20 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center lg:text-left max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-extrabold">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Arcade Card Shop</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Buy Specific Cards from your Watched Anime
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Earn coins by playing <strong className="text-pink-300">Guess the Anime</strong> and{' '}
              <strong className="text-amber-300">Higher or Lower</strong> (1 coin per win + daily 5/5 perfect bonus coin). Use your coins to purchase your favorite character cards directly for your binder!
            </p>

            {/* Rule note */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-xl bg-slate-950/70 border border-white/10 text-[11px] text-slate-300">
                🛡️ Side Characters: <strong className="text-slate-100">10-15 Coins</strong>
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-950/70 border border-white/10 text-[11px] text-slate-300">
                ⚔️ Main Characters: <strong className="text-amber-300">20-25 Coins</strong>
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-950/70 border border-white/10 text-[11px] text-slate-300">
                👑 Legendary Icons: <strong className="text-yellow-400">30 Coins</strong>
              </span>
            </div>
          </div>

          {/* Wallet Card */}
          <div className="flex flex-col items-center gap-3 bg-slate-950/85 p-6 rounded-3xl border border-amber-500/30 shadow-2xl backdrop-blur-xl w-full sm:w-auto min-w-[260px]">
            <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-widest">
              Your Coin Balance
            </span>

            <div className="flex items-center justify-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/30">
                <Coins className="w-6 h-6" />
              </div>
              <span className="text-4xl font-black text-white tracking-tight">
                {coins}
              </span>
              <span className="text-xs font-bold text-amber-400 self-end pb-1">Coins</span>
            </div>

            {onNavigateToGame && (
              <div className="flex items-center gap-2 w-full pt-1">
                <button
                  onClick={() => onNavigateToGame('blur')}
                  className="flex-1 py-2 px-3 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 font-bold text-xs transition cursor-pointer text-center"
                >
                  Earn Coins ➜
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ANIME NAME SEARCH BAR WITH DEDICATED SEARCH BUTTON */}
      <div className="rounded-3xl bg-slate-900/90 border border-amber-500/20 p-5 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-400" />
              <span>Search Anime for Character Cards</span>
            </h3>
            <p className="text-xs text-slate-400">
              Type the name of any anime to view its character cards. <span className="text-amber-300 font-bold">Requirement:</span> You must have completed the anime in your library to purchase its cards!
            </p>
          </div>

          {/* Quick Count Badge */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{completedAnimeList.length} Completed in Library</span>
            </span>
          </div>
        </div>

        {/* Search Anime Form with Button */}
        <form onSubmit={handleAnimeSearch} className="flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={animeSearchQuery}
              onChange={e => setAnimeSearchQuery(e.target.value)}
              placeholder="Search anime title (e.g. Attack on Titan, Jujutsu Kaisen, Naruto, Frieren, Bleach)..."
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-950 border border-white/15 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition"
            />
            {animeSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setAnimeSearchQuery('');
                  setSearchedAnimeFeedback(null);
                  setSelectedSeriesFilter('ALL');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={!animeSearchQuery.trim() || isSearchingAnime}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
              animeSearchQuery.trim() && !isSearchingAnime
                ? 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 shadow-amber-500/25 active:scale-95'
                : 'bg-white/10 text-slate-500 cursor-not-allowed border border-white/5'
            }`}
          >
            {isSearchingAnime ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Searching Anime...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 stroke-[2.5]" />
                <span>Search Anime</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Clickable Pills for User's Completed Anime */}
        {completedAnimeList.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-white/10">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>Quick Select Your Completed Anime:</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => {
                  setSelectedSeriesFilter('ALL');
                  setSearchedAnimeFeedback(null);
                  setSearchFilter('');
                }}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  selectedSeriesFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 border border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <span>⭐ All Catalog ({fullCatalog.length})</span>
              </button>
              {completedAnimeList.map(item => {
                const itemTitle =
                  item.media.title.english ||
                  item.media.title.userPreferred ||
                  item.media.title.romaji ||
                  'Anime';
                const isSelected = selectedSeriesFilter === itemTitle;
                return (
                  <button
                    key={item.mediaId}
                    type="button"
                    onClick={() => {
                      setSelectedSeriesFilter(itemTitle);
                      setSearchFilter('');
                      setSearchedAnimeFeedback({
                        animeTitle: itemTitle,
                        isCompleted: true,
                        characterCount: fullCatalog.filter(c => c.animeId === item.mediaId).length,
                        episodesWatched: item.progress,
                        totalEpisodes: item.media.episodes,
                        animeObj: item.media,
                      });
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                        : 'bg-slate-950 border border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[140px]">{itemTitle}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Search Feedback & Completion Status Card */}
        {searchedAnimeFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              searchedAnimeFeedback.isCompleted
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  searchedAnimeFeedback.isCompleted
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {searchedAnimeFeedback.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm sm:text-base font-black text-white leading-tight">
                    {searchedAnimeFeedback.animeTitle}
                  </h4>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                      searchedAnimeFeedback.isCompleted
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {searchedAnimeFeedback.isCompleted ? '✓ Completed' : '🔒 Not Completed'}
                  </span>
                </div>
                <p className="text-xs opacity-90">
                  {searchedAnimeFeedback.isCompleted ? (
                    <span>
                      You have completed this anime in your library! Character cards are{' '}
                      <strong className="text-emerald-300 font-extrabold">UNLOCKED</strong> for purchase.
                    </span>
                  ) : (
                    <span>
                      Condition: You must complete this anime first in your library to unlock card purchases. (Progress: {searchedAnimeFeedback.episodesWatched || 0}/{searchedAnimeFeedback.totalEpisodes || '?'} Ep)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {searchedAnimeFeedback.animeObj && onOpenDetails && (
              <button
                type="button"
                onClick={() => onOpenDetails(searchedAnimeFeedback.animeObj!)}
                className="shrink-0 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/20 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Tv className="w-3.5 h-3.5 text-blue-400" />
                <span>{searchedAnimeFeedback.isCompleted ? 'View Anime Details' : 'Watch Anime / Update Progress'}</span>
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Catalog Search & Series Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Character Catalog</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                {filteredCatalog.length} Cards
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Only anime you have completed in your library are unlocked for card purchases
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Series Filter */}
          <select
            value={selectedSeriesFilter}
            onChange={e => {
              setSelectedSeriesFilter(e.target.value);
              setSearchedAnimeFeedback(null);
            }}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-500/60 cursor-pointer"
          >
            <option value="ALL">All Anime Series ({availableSeries.length})</option>
            {availableSeries.map(series => (
              <option key={series} value={series}>
                {series}
              </option>
            ))}
          </select>

          {/* Search Character Input */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Search by character name..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500/60"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards Catalog Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredCatalog.map(item => {
          const isCompleted = completedAnimeIds.has(item.animeId);
          const isOwned = ownedCharacterKeys.has(`${item.name.toLowerCase()}-${item.animeId}`);
          const itemPrice = item.price || 20;
          const canAfford = coins >= itemPrice;

          return (
            <motion.div
              key={`${item.id}-${item.animeId}`}
              whileHover={{ y: -3 }}
              className={`group relative rounded-2xl overflow-hidden p-3 border transition-all flex flex-col justify-between shadow-xl ${
                isCompleted
                  ? item.isLegendary
                    ? 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border-amber-500/40 hover:border-amber-400'
                    : 'bg-slate-900/90 border-white/10 hover:border-white/25'
                  : 'bg-slate-950/70 border-white/5 opacity-75'
              }`}
            >
              {/* Top Character Image & Badges */}
              <div 
                className="space-y-3 cursor-pointer"
                onClick={() => setSelectedPreviewItem(item)}
              >
                <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-slate-950">
                  <img
                    src={getSafeCharacterImage(item.name, item.image, item.nativeName)}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = getFallbackAvatarSvg(item.name, item.nativeName);
                    }}
                    className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                      !isCompleted ? 'grayscale contrast-125' : ''
                    }`}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-85" />

                  {/* Legendary / Role Badge */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {item.isLegendary ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-lg">
                        <Crown className="w-3 h-3" />
                        <span>Legend</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-pink-300 font-bold text-[9px] border border-pink-500/30">
                        {item.role}
                      </span>
                    )}
                  </div>

                  {/* Owned Marker */}
                  {isOwned && (
                    <div className="absolute top-2 right-2">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/90 text-slate-950 font-black text-[9px] shadow-lg">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>In Binder</span>
                      </span>
                    </div>
                  )}

                  {/* Lock Overlay if anime not completed */}
                  {!isCompleted && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 text-center space-y-1.5">
                      <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg">
                        <Lock className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-black text-white leading-tight">
                        Locked
                      </span>
                      <p className="text-[10px] text-slate-300 line-clamp-2 px-1">
                        Complete "{item.animeTitle}" in Library to unlock!
                      </p>
                    </div>
                  )}
                </div>

                {/* Character Name & Origin */}
                <div className="space-y-0.5 min-w-0">
                  <h4 className="text-sm font-black text-white truncate leading-tight group-hover:text-amber-300 transition">
                    {item.name}
                  </h4>
                  {item.nativeName && (
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      {item.nativeName}
                    </p>
                  )}
                  <p className="text-[11px] text-amber-300/80 truncate pt-0.5">
                    {item.animeTitle}
                  </p>
                </div>
              </div>

              {/* Bottom Price & Purchase Button */}
              <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Price
                  </span>
                  <div className="flex items-center gap-1 font-black text-amber-300 text-sm">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>{itemPrice}</span>
                  </div>
                </div>

                {isCompleted ? (
                  <button
                    disabled={!canAfford || isProcessing}
                    onClick={() => handlePurchase(item)}
                    className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg ${
                      canAfford
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black shadow-amber-500/20 active:scale-95'
                        : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {canAfford ? (
                      <>
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Buy Card ({itemPrice}c)</span>
                      </>
                    ) : (
                      <span>Need {itemPrice - coins} More Coins</span>
                    )}
                  </button>
                ) : (
                  <div className="py-2 px-3 rounded-xl bg-slate-950/60 border border-white/5 text-center text-[10px] text-slate-500 font-bold">
                    🔒 Complete Anime to Unlock
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* CHARACTER DOSSIER PREVIEW MODAL */}
      <AnimatePresence>
        {selectedPreviewItem && (
          <CharacterCardModal
            card={createCharacterCardFromProfile(selectedPreviewItem)}
            onClose={() => setSelectedPreviewItem(null)}
            onOpenAnimeDetails={onOpenDetails}
          />
        )}
      </AnimatePresence>

      {/* PURCHASE SUCCESS MODAL */}
      <AnimatePresence>
        {purchasedCardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-amber-500/40 p-6 shadow-2xl text-center space-y-4 text-slate-100 overflow-hidden"
            >
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-amber-500/25 rounded-full blur-2xl pointer-events-none" />

              <button
                onClick={() => setPurchasedCardModal(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-400 hover:text-white transition cursor-pointer z-20"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1 pt-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-amber-400">
                  🎉 Card Purchased!
                </span>
                <h3 className="text-xl font-black text-white leading-tight">
                  {purchasedCardModal.characterName}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {purchasedCardModal.animeTitle}
                </p>
              </div>

              {/* Character Portrait */}
              <div className="relative w-44 h-56 mx-auto rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-xl bg-slate-950">
                <img
                  src={purchasedCardModal.characterImage || purchasedCardModal.imageUrl}
                  alt={purchasedCardModal.characterName}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = getFallbackAvatarSvg(
                      purchasedCardModal.characterName,
                      purchasedCardModal.characterNativeName
                    );
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-2 left-2 right-2 text-center">
                  <span className="text-[10px] font-bold text-amber-300 px-2 py-0.5 rounded-full bg-slate-950/80 border border-amber-500/30">
                    {purchasedCardModal.characterRole || 'Character'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 px-2">
                Card has been safely added to your <strong className="text-purple-300">Character Binder</strong>!
              </p>

              <button
                onClick={() => setPurchasedCardModal(null)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-extrabold text-xs shadow-lg cursor-pointer transition"
              >
                Back to Shop
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
