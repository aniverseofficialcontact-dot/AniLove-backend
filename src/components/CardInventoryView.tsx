import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Star,
  Search,
  Rotate3d,
  Award,
  Crown,
  Flame,
  CheckCircle2,
  Tv,
  Gamepad2,
  ArrowRight,
  Filter,
  Shield,
  Zap,
  BookOpen,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Anime, UserMediaListItem, GachaCard } from '../types';
import { getStoredGachaVault, getCardAwakeningLevel, getStoredLibrary } from '../services/storage';
import { soundEffects } from '../services/soundEffects';
import { getSafeCharacterImage, getFallbackAvatarSvg } from '../services/characterPool';
import { getAnimeCardTier, AnimeCardTierConfig } from './InteractiveAnime3DCardModal';
import { CharacterCardModal } from './CharacterCardModal';

interface CardInventoryViewProps {
  library: UserMediaListItem[];
  onOpenDetails: (anime: Anime) => void;
  onInspect3DCard: (anime: Anime) => void;
  onNavigateToArcade?: () => void;
  onNavigateToLibrary?: () => void;
}

type MainInventoryTab = 'anime' | 'characters';
type TierFilter = 'ALL' | 'secret' | 'master' | 'rare' | 'holo';
type CharacterLevelFilter = 'ALL' | 4 | 3 | 2 | 1;

export const CardInventoryView: React.FC<CardInventoryViewProps> = ({
  library,
  onOpenDetails,
  onInspect3DCard,
  onNavigateToArcade,
  onNavigateToLibrary,
}) => {
  const [mainTab, setMainTab] = useState<MainInventoryTab>('anime');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [characterLevelFilter, setCharacterLevelFilter] = useState<CharacterLevelFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'score' | 'title' | 'recent'>('score');
  
  // Character binder state
  const [vaultCards, setVaultCards] = useState<GachaCard[]>(() => getStoredGachaVault());
  const [selectedCharacterCard, setSelectedCharacterCard] = useState<GachaCard | null>(null);
  const [selectedAnimeCharacterFilter, setSelectedAnimeCharacterFilter] = useState<string>('ALL');

  useEffect(() => {
    const handleStorageUpdate = () => {
      setVaultCards(getStoredGachaVault());
    };
    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('character_awakened', handleStorageUpdate);
    window.addEventListener('companion-updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('character_awakened', handleStorageUpdate);
      window.removeEventListener('companion-updated', handleStorageUpdate);
    };
  }, []);

  // 1. Completed Anime Cards Collection
  const completedAnimeItems = useMemo(() => {
    return library.filter(item => item.status === 'COMPLETED' && item.media);
  }, [library]);

  // Anime cards with calculated tier & metadata
  const processedAnimeCards = useMemo(() => {
    return completedAnimeItems.map(item => {
      const anime = item.media;
      const tier = getAnimeCardTier(anime);
      const score = anime.averageScore
        ? anime.averageScore / 10
        : anime.meanScore
        ? anime.meanScore / 10
        : 0;
      return {
        item,
        anime,
        tier,
        score,
      };
    });
  }, [completedAnimeItems]);

  // Statistics counters
  const stats = useMemo(() => {
    let secretCount = 0;
    let masterCount = 0;
    let rareCount = 0;
    let holoCount = 0;

    processedAnimeCards.forEach(c => {
      if (c.tier.id === 'secret') secretCount++;
      else if (c.tier.id === 'master') masterCount++;
      else if (c.tier.id === 'rare') rareCount++;
      else holoCount++;
    });

    return {
      totalAnimeCards: processedAnimeCards.length,
      totalCharacterCards: vaultCards.length,
      secretCount,
      masterCount,
      rareCount,
      holoCount,
    };
  }, [processedAnimeCards, vaultCards]);

  // Filtered & Sorted Anime Cards
  const filteredAnimeCards = useMemo(() => {
    return processedAnimeCards
      .filter(c => {
        const title = (c.anime.title?.english || c.anime.title?.romaji || c.anime.title?.userPreferred || '').toLowerCase();
        const matchesSearch = !searchQuery.trim() || title.includes(searchQuery.toLowerCase());
        const matchesTier = tierFilter === 'ALL' || c.tier.id === tierFilter;
        return matchesSearch && matchesTier;
      })
      .sort((a, b) => {
        if (sortBy === 'score') return b.score - a.score;
        if (sortBy === 'title') {
          const titleA = (a.anime.title?.english || a.anime.title?.romaji || '').toLowerCase();
          const titleB = (b.anime.title?.english || b.anime.title?.romaji || '').toLowerCase();
          return titleA.localeCompare(titleB);
        }
        return (b.item.updatedAt || 0) - (a.item.updatedAt || 0);
      });
  }, [processedAnimeCards, searchQuery, tierFilter, sortBy]);

  // Character Unique Anime Titles for filter
  const characterAnimeTitles = useMemo(() => {
    const set = new Set<string>();
    vaultCards.forEach(c => {
      if (c.animeTitle) set.add(c.animeTitle);
    });
    return Array.from(set);
  }, [vaultCards]);

  // Filtered & Sorted Character Cards
  const filteredCharacterCards = useMemo(() => {
    return vaultCards
      .filter(card => {
        const matchesSearch =
          !searchQuery.trim() ||
          card.characterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          card.animeTitle.toLowerCase().includes(searchQuery.toLowerCase());

        const cardLevel = getCardAwakeningLevel(card.id);
        const matchesLevel =
          characterLevelFilter === 'ALL' || cardLevel === characterLevelFilter;

        const matchesAnime =
          selectedAnimeCharacterFilter === 'ALL' || card.animeTitle === selectedAnimeCharacterFilter;

        return matchesSearch && matchesLevel && matchesAnime;
      })
      .sort((a, b) => {
        const levelA = getCardAwakeningLevel(a.id);
        const levelB = getCardAwakeningLevel(b.id);
        if (levelB !== levelA) return levelB - levelA;

        return (b.obtainedAt || b.pulledAt || b.unlockedAt || 0) - (a.obtainedAt || a.pulledAt || a.unlockedAt || 0);
      });
  }, [vaultCards, searchQuery, characterLevelFilter, selectedAnimeCharacterFilter]);

  return (
    <div id="card-inventory-view" className="space-y-6 pb-24">
      {/* Top Banner Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border border-white/15 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-20 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-black uppercase tracking-wider shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>AniLove Collectible Vault</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Card Inventory & Binder
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Every completed anime unlocks its exclusive 360° holographic collectible card. Manage your complete anime cards showcase alongside your summoned character cards.
            </p>
          </div>

          {/* Quick Stat Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full md:w-auto">
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-pink-500/30 text-center shadow-lg shadow-pink-500/10 backdrop-blur-md">
              <div className="text-[10px] font-black text-pink-300 uppercase flex items-center justify-center gap-1">
                <Crown className="w-3 h-3 text-pink-400" />
                <span>Secret</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white mt-0.5">
                {stats.secretCount}
              </div>
              <div className="text-[9px] text-slate-400 font-bold">≥ 8.5 Score</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/80 border border-amber-500/30 text-center shadow-lg shadow-amber-500/10 backdrop-blur-md">
              <div className="text-[10px] font-black text-amber-300 uppercase flex items-center justify-center gap-1">
                <Star className="w-3 h-3 text-amber-400" />
                <span>Master</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white mt-0.5">
                {stats.masterCount}
              </div>
              <div className="text-[9px] text-slate-400 font-bold">≥ 7.5 Score</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/80 border border-purple-500/30 text-center shadow-lg shadow-purple-500/10 backdrop-blur-md">
              <div className="text-[10px] font-black text-purple-300 uppercase flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Rare</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white mt-0.5">
                {stats.rareCount}
              </div>
              <div className="text-[9px] text-slate-400 font-bold">≥ 6.5 Score</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/80 border border-cyan-500/30 text-center shadow-lg shadow-cyan-500/10 backdrop-blur-md">
              <div className="text-[10px] font-black text-cyan-300 uppercase flex items-center justify-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" />
                <span>Holo</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white mt-0.5">
                {stats.holoCount}
              </div>
              <div className="text-[9px] text-slate-400 font-bold">&lt; 6.5 Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Pill: Anime Cards vs Character Binder */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-lg">
        {/* Toggle Switch */}
        <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/10 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              soundEffects.playClick();
              setMainTab('anime');
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition cursor-pointer ${
              mainTab === 'anime'
                ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-lg shadow-pink-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Rotate3d className="w-4 h-4" />
            <span>Completed Anime Cards</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-bold">
              {stats.totalAnimeCards}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEffects.playClick();
              setMainTab('characters');
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition cursor-pointer ${
              mainTab === 'characters'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Character Binder</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-bold">
              {stats.totalCharacterCards}
            </span>
          </button>
        </div>

        {/* Search and Secondary Action */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={mainTab === 'anime' ? 'Search completed anime cards...' : 'Search characters or anime...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition"
            />
          </div>

          {mainTab === 'characters' && onNavigateToArcade && (
            <button
              type="button"
              onClick={onNavigateToArcade}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md transition active:scale-95 shrink-0 cursor-pointer"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Summon in Arcade</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🌟 TAB 1: COMPLETED ANIME CARDS SHOWCASE */}
      {/* ========================================================================= */}
      {mainTab === 'anime' && (
        <div className="space-y-6">
          {/* Sub-Filters: Rarity Tiers & Sorting */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/40 border border-white/10">
            {/* Rarity Tier Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>Tier:</span>
              </span>

              <button
                type="button"
                onClick={() => setTierFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  tierFilter === 'ALL'
                    ? 'bg-white text-slate-950 shadow'
                    : 'bg-black/30 text-slate-300 hover:text-white border border-white/10'
                }`}
              >
                All ({processedAnimeCards.length})
              </button>

              <button
                type="button"
                onClick={() => setTierFilter('secret')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  tierFilter === 'secret'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30'
                    : 'bg-black/30 text-pink-300 hover:text-white border border-pink-500/30'
                }`}
              >
                <Crown className="w-3 h-3" />
                <span>★★★★ Secret ({stats.secretCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setTierFilter('master')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  tierFilter === 'master'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                    : 'bg-black/30 text-amber-300 hover:text-white border border-amber-500/30'
                }`}
              >
                <Star className="w-3 h-3" />
                <span>★★★ Master ({stats.masterCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setTierFilter('rare')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  tierFilter === 'rare'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-black/30 text-purple-300 hover:text-white border border-purple-500/30'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>★★ Rare ({stats.rareCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setTierFilter('holo')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  tierFilter === 'holo'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white shadow-lg shadow-cyan-500/30'
                    : 'bg-black/30 text-cyan-300 hover:text-white border border-cyan-500/30'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>★ Holo ({stats.holoCount})</span>
              </button>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" />
                <span>Sort:</span>
              </span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white font-bold focus:outline-none focus:border-pink-500 cursor-pointer"
              >
                <option value="score">Highest IMDb/Score</option>
                <option value="recent">Recently Completed</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Cards Grid or Empty State */}
          {filteredAnimeCards.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {filteredAnimeCards.map(({ item, anime, tier, score }) => {
                const title = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
                const cover = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium;
                const studio = anime.studios?.nodes?.[0]?.name;

                return (
                  <motion.div
                    key={anime.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -6, scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                    className="group relative flex flex-col cursor-pointer"
                    onClick={() => {
                      soundEffects.playClick();
                      onInspect3DCard(anime);
                    }}
                  >
                    {/* Collectible Card Frame */}
                    <div className={`relative w-full aspect-[2/3] rounded-2xl overflow-hidden bg-slate-950 ${tier.borderClass} border-2 ${tier.glowClass} shadow-xl transition-all duration-300`}>
                      {/* Cover Poster */}
                      {cover ? (
                        <img
                          src={cover}
                          alt={title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white font-bold text-xs p-2 text-center">
                          {title}
                        </div>
                      )}

                      {/* Holographic Sheen Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none mix-blend-overlay" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />

                      {/* Top Rarity Badge & Rating */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10 pointer-events-none">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${tier.badgeBg}`}>
                          {tier.badge}
                        </span>

                        <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-md">
                          <Star className="w-3 h-3 fill-slate-950" />
                          {score > 0 ? `${score.toFixed(1)}` : 'N/A'}
                        </span>
                      </div>

                      {/* Center 3D Inspect Hover Action Pill */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
                        <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white font-bold text-xs border border-white/20 backdrop-blur-md shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
                          <Rotate3d className="w-3.5 h-3.5 text-pink-400" />
                          <span>Inspect 3D Card</span>
                        </div>
                      </div>

                      {/* Bottom Info Banner */}
                      <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none">
                        <h3 className="text-xs font-black text-white truncate drop-shadow-md">
                          {title}
                        </h3>
                        <div className="flex items-center justify-between text-[10px] text-slate-300 font-medium mt-0.5">
                          <span className="truncate max-w-[90px] text-indigo-300">
                            {studio || 'Studio'}
                          </span>
                          <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>COMPLETED</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-slate-900/40 border border-white/10 space-y-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500/20 to-violet-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-xl">
                <Rotate3d className="w-8 h-8 animate-spin" style={{ animationDuration: '8s' }} />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-lg font-black text-white">
                  {completedAnimeItems.length === 0
                    ? 'No Completed Anime Cards Yet'
                    : 'No Cards Match Selected Filter'}
                </h3>
                <p className="text-xs text-slate-400">
                  {completedAnimeItems.length === 0
                    ? 'Mark any anime as "Completed" in your watchlist or library, and its exclusive 360° collectible 3D card will automatically appear here!'
                    : 'Try clearing the search query or selecting "All" rarity tiers to see your cards.'}
                </p>
              </div>

              {completedAnimeItems.length === 0 && onNavigateToLibrary && (
                <button
                  type="button"
                  onClick={onNavigateToLibrary}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-pink-500/30 transition cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Go to My Watchlist / Library</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🎴 TAB 2: CHARACTER BINDER */}
      {/* ========================================================================= */}
      {mainTab === 'characters' && (
        <div className="space-y-6">
          {/* Sub-Filters: Level Tiers & Anime Origin */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/40 border border-white/10">
            {/* Level Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>Level:</span>
              </span>

              {([
                { id: 'ALL', label: `All (${vaultCards.length})` },
                { id: 4, label: '★★★★ Lv.4 Secret' },
                { id: 3, label: '★★★ Lv.3 Master' },
                { id: 2, label: '★★ Lv.2 Rare' },
                { id: 1, label: '★ Lv.1 Holo' },
              ] as const).map(lvl => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setCharacterLevelFilter(lvl.id as CharacterLevelFilter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    characterLevelFilter === lvl.id
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow'
                      : 'bg-black/30 text-slate-300 hover:text-white border border-white/10'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>

            {/* Anime Origin Filter */}
            {characterAnimeTitles.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                  <Tv className="w-3 h-3" />
                  <span>Anime:</span>
                </span>
                <select
                  value={selectedAnimeCharacterFilter}
                  onChange={e => setSelectedAnimeCharacterFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white font-bold focus:outline-none focus:border-purple-500 cursor-pointer max-w-[180px] sm:max-w-xs truncate"
                >
                  <option value="ALL">All Anime Series</option>
                  {characterAnimeTitles.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Character Cards Grid or Empty State */}
          {filteredCharacterCards.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredCharacterCards.map((card, idx) => {
                const awakenLevel = getCardAwakeningLevel(card.id);
                const isSecret = awakenLevel >= 4;
                const isMaster = awakenLevel === 3;
                const isRare = awakenLevel === 2;

                const cardFoilClass = isSecret
                  ? 'border-2 border-pink-400/90 shadow-pink-500/50 shadow-xl bg-gradient-to-b from-[#1c0826] via-[#0e0a1f] to-slate-900 ring-2 ring-pink-400/80'
                  : isMaster
                  ? 'border-2 border-amber-400/80 shadow-amber-500/50 shadow-xl bg-gradient-to-b from-[#1e1405] via-[#100d08] to-slate-900 ring-2 ring-amber-400/70'
                  : isRare
                  ? 'border-2 border-purple-400/70 shadow-purple-500/40 shadow-lg bg-gradient-to-b from-[#130924] via-[#0c0b1a] to-slate-900 ring-1 ring-purple-400/60'
                  : 'border-2 border-cyan-400/60 shadow-cyan-500/30 shadow-md bg-gradient-to-b from-[#081321] via-[#090d16] to-slate-900 ring-1 ring-cyan-400/50';

                const charImg = getSafeCharacterImage(
                  card.characterName,
                  card.characterImage || card.imageUrl,
                  card.characterNativeName
                );

                return (
                  <motion.div
                    key={card.id || idx}
                    whileHover={{ scale: 1.03, y: -3 }}
                    onClick={() => {
                      soundEffects.playClick();
                      setSelectedCharacterCard(card);
                    }}
                    className={`group relative rounded-2xl overflow-hidden p-2.5 transition-all cursor-pointer flex flex-col ${cardFoilClass}`}
                  >
                    {/* Awakening Tier Badge on top right */}
                    <div className="absolute top-2 right-2 z-20 pointer-events-none">
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-md ${
                          isSecret
                            ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white border border-pink-300 ring-1 ring-pink-400/60'
                            : isMaster
                            ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-slate-950 font-black border border-amber-300'
                            : isRare
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border border-purple-400/40'
                            : 'bg-gradient-to-r from-slate-900 to-cyan-900 text-cyan-200 border border-cyan-400/40'
                        }`}
                      >
                        {isSecret
                          ? '★★★★ Secret'
                          : isMaster
                          ? '★★★ Master'
                          : isRare
                          ? '★★ Rare'
                          : '★ Holo'}
                      </span>
                    </div>

                    {/* Character Portrait Image */}
                    <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-slate-950">
                      <img
                        src={charImg}
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
                      <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
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
                            {awakenLevel >= 4 ? 'MAX' : `Lv.${awakenLevel}`}
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
            /* Empty State */
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-slate-900/40 border border-white/10 space-y-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-xl">
                <Layers className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-lg font-black text-white">
                  {vaultCards.length === 0
                    ? 'No Character Cards Collected'
                    : 'No Character Cards Match Filter'}
                </h3>
                <p className="text-xs text-slate-400">
                  {vaultCards.length === 0
                    ? 'Visit the Arcade to summon iconic anime characters using your earned spins or arcade coins!'
                    : 'Try clearing the search query or selecting "All" levels to see your cards.'}
                </p>
              </div>

              {onNavigateToArcade && (
                <button
                  type="button"
                  onClick={onNavigateToArcade}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/30 transition cursor-pointer"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>Go to Character Gacha in Arcade</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3D Character Card Detailed Inspection Modal */}
      {selectedCharacterCard && (
        <CharacterCardModal
          card={selectedCharacterCard}
          onClose={() => setSelectedCharacterCard(null)}
          onOpenAnimeDetails={anime => {
            setSelectedCharacterCard(null);
            onOpenDetails(anime);
          }}
        />
      )}
    </div>
  );
};
