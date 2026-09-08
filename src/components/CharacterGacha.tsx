import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Dice5,
  Layers,
  Search,
  BookOpen,
  CheckCircle2,
  Tv,
  X,
  Volume2,
  Quote,
  Flame,
  Award,
  RefreshCw,
  Lock,
  Coins,
  ChevronDown,
  ShoppingBag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { GachaCard, UserMediaListItem, Anime } from '../types';
import {
  getStoredLibrary,
  getStoredGachaVault,
  saveStoredGachaCards,
  getStoredGachaSpinsUsed,
  incrementGachaSpinsUsed,
  getStoredArcadeCoins,
  spendArcadeCoins,
  getCardAwakeningLevel,
} from '../services/storage';
import { soundEffects } from '../services/soundEffects';
import {
  ICONIC_CHARACTERS_POOL,
  fetchCharactersForAnime,
  createCharacterCardFromProfile,
  getSafeCharacterImage,
  getFallbackAvatarSvg,
  AnimeCharacterProfile,
} from '../services/characterPool';
import { CharacterCardModal } from './CharacterCardModal';

interface CharacterGachaProps {
  onOpenDetails?: (anime: Anime) => void;
  onNavigateToLibrary?: () => void;
  onNavigateToShop?: () => void;
  onNavigateToCards?: () => void;
}

const STARTER_FREE_SPINS = 3;
const COIN_SPIN_COST = 15;

export const CharacterGacha: React.FC<CharacterGachaProps> = ({
  onOpenDetails,
  onNavigateToLibrary,
  onNavigateToShop,
  onNavigateToCards,
}) => {
  const [library, setLibrary] = useState<UserMediaListItem[]>(() => getStoredLibrary());
  const [vaultCards, setVaultCards] = useState<GachaCard[]>(() => getStoredGachaVault());
  const [spinsUsed, setSpinsUsed] = useState<number>(() => getStoredGachaSpinsUsed());
  const [coins, setCoins] = useState<number>(() => getStoredArcadeCoins());
  const [isSummoning, setIsSummoning] = useState<boolean>(false);
  const [lastPulledCard, setLastPulledCard] = useState<GachaCard | null>(null);
  const [selectedVaultCard, setSelectedVaultCard] = useState<GachaCard | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedAnimeFilter, setSelectedAnimeFilter] = useState<string>('ALL');

  // Specific anime summon target selector
  const [selectedSummonAnimeId, setSelectedSummonAnimeId] = useState<number | 'RANDOM'>('RANDOM');

  // Refresh library & spins on mount or storage updates
  const [awakeningVersion, setAwakeningVersion] = useState<number>(0);

  useEffect(() => {
    const handleStorageUpdate = () => {
      setLibrary(getStoredLibrary());
      setVaultCards(getStoredGachaVault());
      setSpinsUsed(getStoredGachaSpinsUsed());
      setCoins(getStoredArcadeCoins());
    };
    const handleCoinEvent = (e: CustomEvent<number>) => {
      setCoins(e.detail);
    };
    const handleAwakenedEvent = () => {
      setVaultCards(getStoredGachaVault());
      setCoins(getStoredArcadeCoins());
      setAwakeningVersion(v => v + 1);
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('character_awakened', handleAwakenedEvent);
    window.addEventListener('companion-updated', handleAwakenedEvent);
    window.addEventListener('arcade_coins_updated' as any, handleCoinEvent as any);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('character_awakened', handleAwakenedEvent);
      window.removeEventListener('companion-updated', handleAwakenedEvent);
      window.removeEventListener('arcade_coins_updated' as any, handleCoinEvent as any);
    };
  }, []);

  // Completed anime from user library
  const completedAnimeList = useMemo(() => {
    return library.filter(item => item.status === 'COMPLETED');
  }, [library]);

  const completedCount = completedAnimeList.length;
  const totalEarnedSpins = completedCount + STARTER_FREE_SPINS;
  const availableSpins = Math.max(0, totalEarnedSpins - spinsUsed);
  const canSummonWithCoins = coins >= COIN_SPIN_COST;
  const canSummon = availableSpins > 0 || canSummonWithCoins;

  // Extract unique anime titles in collection for filtering
  const collectionAnimeTitles = useMemo(() => {
    const set = new Set<string>();
    vaultCards.forEach(c => {
      if (c.animeTitle) set.add(c.animeTitle);
    });
    return Array.from(set);
  }, [vaultCards]);

  // Filtered vault cards (sorted by awakening level descending by default)
  const filteredCards = useMemo(() => {
    return vaultCards
      .filter(card => {
        const matchesSearch =
          !searchFilter.trim() ||
          card.characterName.toLowerCase().includes(searchFilter.toLowerCase()) ||
          card.animeTitle.toLowerCase().includes(searchFilter.toLowerCase());

        const matchesAnime =
          selectedAnimeFilter === 'ALL' || card.animeTitle === selectedAnimeFilter;

        return matchesSearch && matchesAnime;
      })
      .sort((a, b) => {
        const levelA = getCardAwakeningLevel(a.id);
        const levelB = getCardAwakeningLevel(b.id);
        if (levelB !== levelA) {
          return levelB - levelA; // More awakened cards on top!
        }
        // Secondary sort: rarity
        const rarityMap: Record<string, number> = { SSR: 4, SR: 3, R: 2, N: 1 };
        const rDiff = (rarityMap[b.rarity] || 1) - (rarityMap[a.rarity] || 1);
        if (rDiff !== 0) return rDiff;
        // Tertiary sort: unlocked timestamp descending
        return (b.unlockedAt || 0) - (a.unlockedAt || 0);
      });
  }, [vaultCards, searchFilter, selectedAnimeFilter, awakeningVersion]);

  // Execute Summon Action
  const handleSummon = async (useCoins: boolean = false) => {
    if (isSummoning) return;
    if (useCoins) {
      if (coins < COIN_SPIN_COST) return;
    } else {
      if (availableSpins <= 0) return;
    }

    setIsSummoning(true);
    soundEffects.playGachaRoll();

    try {
      let candidateProfile: AnimeCharacterProfile | null = null;

      // 1. Identify which anime to summon from
      let targetAnime: UserMediaListItem | null = null;

      if (completedAnimeList.length > 0) {
        if (selectedSummonAnimeId !== 'RANDOM') {
          targetAnime = completedAnimeList.find(a => a.mediaId === selectedSummonAnimeId) || null;
        }
        if (!targetAnime) {
          targetAnime =
            completedAnimeList[Math.floor(Math.random() * completedAnimeList.length)];
        }
      }

      if (targetAnime) {
        const animeId = targetAnime.mediaId;
        const animeTitle =
          targetAnime.media?.title?.english ||
          targetAnime.media?.title?.userPreferred ||
          targetAnime.media?.title?.romaji ||
          'Anime';

        // Check if we have pre-indexed characters for this anime
        const matchingLocal = ICONIC_CHARACTERS_POOL.filter(
          c =>
            c.animeId === animeId ||
            c.animeTitle.toLowerCase() === animeTitle.toLowerCase()
        );

        if (matchingLocal.length > 0) {
          candidateProfile = matchingLocal[Math.floor(Math.random() * matchingLocal.length)];
        } else {
          // Fetch characters via live GraphQL
          const onlineChars = await fetchCharactersForAnime(animeId);
          if (onlineChars.length > 0) {
            candidateProfile = onlineChars[Math.floor(Math.random() * onlineChars.length)];
          }
        }
      }

      // 2. Fallback to iconic pool if no candidate found
      if (!candidateProfile) {
        candidateProfile =
          ICONIC_CHARACTERS_POOL[Math.floor(Math.random() * ICONIC_CHARACTERS_POOL.length)];
      }

      // Create new character card
      const newCard = createCharacterCardFromProfile(candidateProfile);

      // Decrement spin or spend coins
      if (useCoins) {
        spendArcadeCoins(COIN_SPIN_COST);
        setCoins(getStoredArcadeCoins());
      } else {
        incrementGachaSpinsUsed(1);
        setSpinsUsed(prev => prev + 1);
      }

      const updatedVault = [newCard, ...vaultCards];
      setVaultCards(updatedVault);
      saveStoredGachaCards(updatedVault);

      setTimeout(() => {
        setLastPulledCard(newCard);
        setIsSummoning(false);
        soundEffects.playSuccess();
        confetti({
          particleCount: 80,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981'],
        });
      }, 1000);
    } catch (err) {
      console.error('Error during character summon:', err);
      setIsSummoning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Summon Machine Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-950 border border-white/10 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-20 w-80 h-80 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center lg:text-left max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-extrabold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Random Character Summoner</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black">
                <span>🎁 3 Starter Free Spins Included!</span>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Summon Characters from your Watched Anime
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Every completed anime grants +1 Free Spin (plus your 3 starter free spins)! The gacha will randomly pull a character card from that anime's cast into your binder. Prefer choosing a specific character? Visit the <button onClick={onNavigateToShop} className="text-amber-300 font-bold underline hover:text-amber-200 cursor-pointer">Card Shop</button>.
            </p>

            {/* Anime Selector Dropdown for Summon */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2">
              <label className="block text-[11px] font-extrabold text-purple-300 uppercase tracking-wider">
                🎯 Choose Anime to Summon From:
              </label>
              {completedAnimeList.length > 0 ? (
                <div className="relative">
                  <select
                    value={selectedSummonAnimeId}
                    onChange={e =>
                      setSelectedSummonAnimeId(
                        e.target.value === 'RANDOM' ? 'RANDOM' : parseInt(e.target.value, 10)
                      )
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-purple-500/30 text-xs font-bold text-white focus:outline-none focus:border-purple-400 cursor-pointer pr-9"
                  >
                    <option value="RANDOM">🎲 Any Completed Anime (Completely Random)</option>
                    {completedAnimeList.map(item => {
                      const title =
                        item.media?.title?.english ||
                        item.media?.title?.userPreferred ||
                        item.media?.title?.romaji ||
                        'Anime';
                      return (
                        <option key={item.mediaId} value={item.mediaId}>
                          📺 {title}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
                  <span>Complete anime in your library to unlock targeted anime summoning! Defaulting to Iconic Collection.</span>
                </div>
              )}
            </div>
          </div>

          {/* Ticket Counter & Summon Button */}
          <div className="flex flex-col items-center gap-3 bg-slate-950/80 p-6 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl w-full sm:w-auto min-w-[280px]">
            <div className="text-center space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Summon Spins
              </span>
              <div className="flex items-center justify-center gap-2">
                <Dice5 className="w-7 h-7 text-purple-400" />
                <span className="text-4xl font-black text-white tracking-tight">
                  {availableSpins}
                </span>
                <span className="text-xs font-bold text-slate-400 self-end pb-1">
                  / {totalEarnedSpins} free
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Completed: <strong className="text-emerald-400">{completedCount}</strong> anime • Coins:{' '}
                <strong className="text-amber-400">{coins}</strong>
              </p>
            </div>

            {/* Free Spin Button */}
            <button
              disabled={availableSpins <= 0 || isSummoning}
              onClick={() => handleSummon(false)}
              className={`w-full py-3.5 px-6 rounded-2xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xl cursor-pointer ${
                availableSpins > 0 && !isSummoning
                  ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white shadow-purple-600/30 hover:scale-105 active:scale-95'
                  : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isSummoning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-300" />
                  <span>Summoning Character...</span>
                </>
              ) : availableSpins > 0 ? (
                <>
                  <Sparkles className="w-4 h-4 text-pink-300" />
                  <span>Summon (1 Free Spin)</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>No Free Spins Left</span>
                </>
              )}
            </button>

            {/* Coin Summon Button */}
            <button
              disabled={!canSummonWithCoins || isSummoning}
              onClick={() => handleSummon(true)}
              className={`w-full py-2.5 px-4 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                canSummonWithCoins && !isSummoning
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 hover:scale-105 active:scale-95'
                  : 'bg-white/5 border border-white/5 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Summon with {COIN_SPIN_COST} Coins</span>
            </button>
          </div>
        </div>
      </div>

      {/* RECENT PULL REVEAL MODAL */}
      <AnimatePresence>
        {lastPulledCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-purple-500/40 p-6 shadow-2xl text-center space-y-4 text-slate-100 overflow-hidden"
            >
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-purple-500/25 rounded-full blur-2xl pointer-events-none" />

              <button
                onClick={() => setLastPulledCard(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-400 hover:text-white transition cursor-pointer z-20"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1 pt-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-purple-400">
                  New Character Unlocked!
                </span>
                <h3 className="text-xl font-black text-white leading-tight">
                  {lastPulledCard.characterName}
                </h3>
                {lastPulledCard.characterNativeName && (
                  <p className="text-xs text-slate-400 font-medium">
                    {lastPulledCard.characterNativeName}
                  </p>
                )}
              </div>

              {/* Character Portrait */}
              <div className="relative w-44 h-56 mx-auto rounded-2xl overflow-hidden border-2 border-purple-500/40 shadow-xl bg-slate-950">
                <img
                  src={getSafeCharacterImage(
                    lastPulledCard.characterName,
                    lastPulledCard.characterImage || lastPulledCard.imageUrl,
                    lastPulledCard.characterNativeName
                  )}
                  alt={lastPulledCard.characterName}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = getFallbackAvatarSvg(
                      lastPulledCard.characterName,
                      lastPulledCard.characterNativeName
                    );
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-2 left-2 right-2 text-center">
                  <span className="text-[10px] font-bold text-pink-300 px-2 py-0.5 rounded-full bg-slate-950/80 border border-pink-500/30">
                    {lastPulledCard.characterRole || 'Character'}
                  </span>
                </div>
              </div>

              {/* Anime Origin */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 text-xs space-y-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  From Series:
                </span>
                <span className="font-extrabold text-purple-300 block truncate">
                  {lastPulledCard.animeTitle}
                </span>
                {lastPulledCard.voiceActor && (
                  <span className="text-[11px] text-slate-400 block">
                    VA: {lastPulledCard.voiceActor}
                  </span>
                )}
              </div>

              {lastPulledCard.quote && (
                <p className="text-xs italic text-slate-300 line-clamp-2 px-2">
                  "{lastPulledCard.quote}"
                </p>
              )}

              <button
                onClick={() => setLastPulledCard(null)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-extrabold text-xs shadow-lg cursor-pointer transition"
              >
                Add to Character Binder
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHARACTER BINDER / COLLECTION */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Character Binder</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  {vaultCards.length} Collected
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Browse every character card you have unlocked or purchased
              </p>
            </div>
            {onNavigateToCards && (
              <button
                type="button"
                onClick={onNavigateToCards}
                className="hidden sm:flex items-center gap-1.5 ml-3 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open Cards Tab</span>
              </button>
            )}
          </div>

          {/* Search & Anime Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Anime Filter Dropdown */}
            {collectionAnimeTitles.length > 0 && (
              <select
                value={selectedAnimeFilter}
                onChange={e => setSelectedAnimeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-purple-500/60 cursor-pointer"
              >
                <option value="ALL">All Series ({collectionAnimeTitles.length})</option>
                {collectionAnimeTitles.map(title => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            )}

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search character..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500/60"
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

        {/* Character Card Grid */}
        {filteredCards.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredCards.map((card, idx) => {
              const awakenLevel = getCardAwakeningLevel(card.id);
              const isHolo = awakenLevel === 2;
              const isGold = awakenLevel === 3;
              const isAurora = awakenLevel === 4;

              const cardFoilClass = isAurora
                ? 'border-2 border-pink-400 shadow-pink-500/40 shadow-xl bg-gradient-to-b from-pink-950/40 via-purple-950/30 to-slate-900 ring-1 ring-pink-400/50'
                : isGold
                ? 'border-2 border-amber-400 shadow-amber-500/40 shadow-xl bg-gradient-to-b from-amber-950/40 to-slate-900 ring-1 ring-amber-400/40'
                : isHolo
                ? 'border-2 border-purple-400 shadow-purple-500/30 shadow-lg bg-gradient-to-b from-purple-950/40 to-slate-900'
                : 'border border-white/10 hover:border-purple-500/50 bg-slate-900/80 shadow-md';

              return (
                <motion.div
                  key={card.id || idx}
                  whileHover={{ scale: 1.03, y: -3 }}
                  onClick={() => setSelectedVaultCard(card)}
                  className={`group relative rounded-2xl overflow-hidden p-2.5 transition-all cursor-pointer flex flex-col ${cardFoilClass}`}
                >
                  {/* Awakening Tier Badge on top right */}
                  {awakenLevel > 1 && (
                    <div className="absolute top-2 right-2 z-20">
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-md ${
                          isAurora
                            ? 'bg-gradient-to-r from-pink-500 to-cyan-400 text-slate-950 ring-1 ring-white/50'
                            : isGold
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950'
                            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        }`}
                      >
                        {isAurora ? '★ Lv.4 Aurora' : isGold ? '★ Lv.3 Gold' : '★ Lv.2 Holo'}
                      </span>
                    </div>
                  )}

                  {/* Character Portrait Image */}
                  <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-slate-950">
                    <img
                      src={getSafeCharacterImage(
                        card.characterName,
                        card.characterImage || card.imageUrl,
                        card.characterNativeName
                      )}
                      alt={card.characterName}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = getFallbackAvatarSvg(
                          card.characterName,
                          card.characterNativeName
                        );
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                    {/* Role Pill */}
                    <div className="absolute bottom-2 left-2 right-2">
                      <span className="text-[9px] font-extrabold text-pink-300 px-1.5 py-0.5 rounded-md bg-slate-950/85 border border-white/10 block truncate text-center">
                        {card.characterRole || 'Character'}
                      </span>
                    </div>
                  </div>

                  {/* Character Meta */}
                  <div className="pt-2.5 space-y-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-black text-white truncate leading-tight group-hover:text-purple-300 transition">
                        {card.characterName}
                      </h4>
                      {awakenLevel > 1 && (
                        <span className="text-[10px] text-amber-400 font-bold shrink-0">
                          {awakenLevel === 4 ? 'MAX' : `Lv.${awakenLevel}`}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {card.animeTitle}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center rounded-3xl bg-slate-900/50 border border-white/10 space-y-3">
            <Dice5 className="w-10 h-10 text-purple-400 mx-auto opacity-60" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">No Character Cards Found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchFilter || selectedAnimeFilter !== 'ALL'
                  ? 'Try changing your search keywords or series filter.'
                  : 'Hit the Summon button above using your completed anime spins or visit the Card Shop to unlock character cards!'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* INTERACTIVE 3D CHARACTER CARD DOSSIER MODAL */}
      <AnimatePresence>
        {selectedVaultCard && (
          <CharacterCardModal
            card={selectedVaultCard}
            onClose={() => setSelectedVaultCard(null)}
            onOpenAnimeDetails={onOpenDetails}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
