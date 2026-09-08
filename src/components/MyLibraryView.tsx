import React, { useState, useMemo, useEffect } from 'react';
import {
  Bookmark,
  Star,
  Clock,
  CheckCircle2,
  Play,
  Plus,
  Minus,
  Search,
  Layers,
  TrendingUp,
  Sparkles,
  Filter,
  BarChart3,
  PieChart,
  Film,
  Tv,
  Download,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Anime, AnimeReel, UserMediaListItem, MediaListStatus } from '../types';
import { AnimeCard } from './AnimeCard';
import { exportLibraryAsJSON } from '../services/storage';
import { SavedReelsGallery } from './SavedReelsGallery';
import { getStoredSavedReels } from '../services/reelsService';

interface MyLibraryViewProps {
  library: UserMediaListItem[];
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onUpdateProgress: (anime: Anime, newProgress: number) => void;
  onGoToDiscover: () => void;
  onSelectGenre?: (genre: string) => void;
  onSelectStudio?: (studio: string) => void;
  onInspect3DCard?: (anime: Anime) => void;
  isTwoWaySyncActive: boolean;
  onOpenSavedReel?: (reel: AnimeReel) => void;
}

export const MyLibraryView: React.FC<MyLibraryViewProps> = ({
  library,
  onOpenDetails,
  onPlayStream,
  onUpdateStatus,
  onUpdateProgress,
  onGoToDiscover,
  onSelectGenre,
  onSelectStudio,
  onInspect3DCard,
  isTwoWaySyncActive,
  onOpenSavedReel,
}) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | MediaListStatus>('ALL');
  const [selectedFormat, setSelectedFormat] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'score' | 'title' | 'progress'>('updated');
  const [showStatsDrawer, setShowStatsDrawer] = useState<boolean>(false);
  const [showSavedReelsView, setShowSavedReelsView] = useState<boolean>(false);
  const [savedReelsCount, setSavedReelsCount] = useState<number>(() => getStoredSavedReels().length);

  // Keep saved reels count synchronized
  useEffect(() => {
    const updateCount = () => setSavedReelsCount(getStoredSavedReels().length);
    window.addEventListener('anilove-saved-reels-updated', updateCount);
    return () => window.removeEventListener('anilove-saved-reels-updated', updateCount);
  }, []);

  // Compute overall user statistics
  const stats = useMemo(() => {
    let totalEpisodes = 0;
    let scoredItems = 0;
    let scoreSum = 0;
    let totalMinutes = 0;
    const genreMap: Record<string, number> = {};
    const scoreDistribution: Record<number, number> = {
      10: 0, 9: 0, 8: 0, 7: 0, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
    };

    library.forEach(item => {
      const ep = item.progress || 0;
      totalEpisodes += ep;
      const duration = item.media.duration || 24;
      totalMinutes += ep * duration;

      if (item.score > 0) {
        scoredItems++;
        scoreSum += item.score;
        const roundedScore = Math.min(10, Math.max(1, Math.round(item.score)));
        scoreDistribution[roundedScore] = (scoreDistribution[roundedScore] || 0) + 1;
      }

      (item.media.genres || []).forEach(g => {
        genreMap[g] = (genreMap[g] || 0) + 1;
      });
    });

    const meanScore = scoredItems > 0 ? (scoreSum / scoredItems).toFixed(1) : '--';
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = (totalHours / 24).toFixed(1);

    const topGenres = Object.entries(genreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return {
      totalAnime: library.length,
      totalEpisodes,
      meanScore,
      hoursWatched: totalHours,
      daysWatched: totalDays,
      topGenres,
      scoreDistribution,
    };
  }, [library]);

  // Counts by status
  const counts = useMemo(() => {
    const res: Record<string, number> = {
      ALL: library.length,
      CURRENT: 0,
      COMPLETED: 0,
      PLANNING: 0,
      PAUSED: 0,
      DROPPED: 0,
    };
    library.forEach(item => {
      if (res[item.status] !== undefined) {
        res[item.status]++;
      }
    });
    return res;
  }, [library]);

  // Filtered & Sorted items
  const displayedItems = useMemo(() => {
    let list = library;
    if (activeFilter !== 'ALL') {
      list = list.filter(item => item.status === activeFilter);
    }
    if (selectedFormat !== 'ALL') {
      list = list.filter(item => item.media.format === selectedFormat);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => {
        const title = (
          item.media.title?.english ||
          item.media.title?.romaji ||
          item.media.title?.userPreferred ||
          ''
        ).toLowerCase();
        return title.includes(q);
      });
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortBy === 'score') return (b.score || 0) - (a.score || 0);
      if (sortBy === 'title') {
        const tA = (a.media.title?.english || a.media.title?.romaji || '').toLowerCase();
        const tB = (b.media.title?.english || b.media.title?.romaji || '').toLowerCase();
        return tA.localeCompare(tB);
      }
      if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }, [library, activeFilter, selectedFormat, searchQuery, sortBy]);

  const handleExportBackup = () => {
    exportLibraryAsJSON(library);
  };

  return (
    <div id="my-library-view" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Stats Banner */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 mb-2">
              <Bookmark className="w-3.5 h-3.5" />
              <span>Personal Watchlist & Library</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              My Anime Collection
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Track episodes, scores, and watching progress with real-time cloud sync.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Saved Reels Gallery Trigger Button */}
            <button
              onClick={() => setShowSavedReelsView(!showSavedReelsView)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer shadow-lg ${
                showSavedReelsView
                  ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white border-pink-400 shadow-pink-500/25 scale-105'
                  : 'bg-slate-900 hover:bg-pink-500/10 text-pink-300 hover:text-pink-200 border-pink-500/30'
              }`}
              title="View all saved and bookmarked anime reels"
            >
              <Bookmark className={`w-4 h-4 ${showSavedReelsView ? 'fill-white text-white' : 'fill-pink-400 text-pink-400'}`} />
              <span>Saved Reels ({savedReelsCount})</span>
            </button>

            <button
              onClick={() => setShowStatsDrawer(!showStatsDrawer)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                showStatsDrawer
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <span>{showStatsDrawer ? 'Hide Analytics' : 'View Analytics'}</span>
            </button>

            <button
              onClick={handleExportBackup}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800 transition cursor-pointer"
              title="Download JSON backup of your anime library"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Backup</span>
            </button>

            {isTwoWaySyncActive && (
              <div className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-lg shadow-emerald-950/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>AniList Synced</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 rounded-2xl bg-[#121626] border border-slate-800 shadow-xl">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Total Anime</span>
            </div>
            <div className="text-2xl font-black text-white mt-1">{stats.totalAnime}</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Episodes Watched</span>
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{stats.totalEpisodes}</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Time Watched</span>
            </div>
            <div className="text-2xl font-black text-sky-300 mt-1">
              {stats.hoursWatched}h <span className="text-xs font-normal text-slate-400">({stats.daysWatched}d)</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <Star className="w-4 h-4 text-amber-400" />
              <span>Mean Score</span>
            </div>
            <div className="text-2xl font-black text-amber-300 mt-1">{stats.meanScore}</div>
          </div>
        </div>

        {/* Detailed Analytics Drawer */}
        {showStatsDrawer && (
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            {/* Top Genres Breakdown */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-indigo-400" />
                <span>Favorite Genres</span>
              </h3>
              <div className="space-y-2">
                {stats.topGenres.map(([genre, count]) => {
                  const percent = Math.round((count / Math.max(1, library.length)) * 100);
                  return (
                    <div key={genre} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">{genre}</span>
                        <span className="text-slate-400">{count} titles ({percent}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Score Distribution Chart */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span>Score Distribution (1-10)</span>
              </h3>
              <div className="flex items-end gap-1.5 h-32 pt-4 px-2 bg-slate-900/50 rounded-xl border border-slate-800">
                {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(score => {
                  const count = stats.scoreDistribution[score] || 0;
                  const distributionValues = Object.values(stats.scoreDistribution) as number[];
                  const maxCount = Math.max(1, ...distributionValues);
                  const heightPercent = Math.round((count / maxCount) * 100);

                  return (
                    <div key={score} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                      <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">
                        {count}
                      </span>
                      <div
                        className="w-full bg-amber-500/80 hover:bg-amber-400 rounded-t transition-all duration-300 min-h-[4px]"
                        style={{ height: `${Math.max(4, heightPercent)}%` }}
                      />
                      <span className="text-[10px] font-bold text-slate-300">{score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conditionally Render Saved Reels View OR Standard Anime Library */}
      {showSavedReelsView ? (
        <SavedReelsGallery
          onOpenReel={(reel) => {
            if (onOpenSavedReel) {
              onOpenSavedReel(reel);
            }
          }}
          onClose={() => setShowSavedReelsView(false)}
        />
      ) : (
        <>
          {/* Filter Tabs & Search Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-2">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'CURRENT', label: 'Watching' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'PLANNING', label: 'Planning' },
            { id: 'PAUSED', label: 'Paused' },
            { id: 'DROPPED', label: 'Dropped' },
          ].map(tab => {
            const active = activeFilter === tab.id;
            const count = counts[tab.id] || 0;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    active ? 'bg-indigo-800 text-white' : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Sort & Format Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search library..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={selectedFormat}
            onChange={e => setSelectedFormat(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 outline-none cursor-pointer"
          >
            <option value="ALL">All Formats</option>
            <option value="TV">TV Series</option>
            <option value="MOVIE">Movie</option>
            <option value="OVA">OVA</option>
            <option value="ONA">ONA</option>
            <option value="SPECIAL">Special</option>
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 outline-none cursor-pointer"
          >
            <option value="updated">Recently Updated</option>
            <option value="score">Highest Score</option>
            <option value="progress">Most Episodes</option>
            <option value="title">Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Library Grid */}
      {displayedItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {displayedItems.map(item => (
            <AnimeCard
              key={item.mediaId}
              anime={item.media}
              userItem={item}
              showEpisodeStepper={true}
              onOpenDetails={onOpenDetails}
              onPlayStream={onPlayStream}
              onUpdateStatus={onUpdateStatus}
              onUpdateProgress={onUpdateProgress}
              onSelectGenre={onSelectGenre}
              onSelectStudio={onSelectStudio}
              onInspect3DCard={onInspect3DCard}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 sm:p-16 text-center text-slate-400 rounded-3xl bg-[#121626] border border-slate-800 space-y-4">
          <Bookmark className="w-12 h-12 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-200">
              {searchQuery ? `No matches for "${searchQuery}" in your list` : 'Your Watchlist is Empty'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? 'Try searching with a different keyword or filter.'
                : 'Start tracking anime from the Discover section or spin the Anime Gacha!'}
            </p>
          </div>

          {!searchQuery && (
            <button
              onClick={onGoToDiscover}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              Explore Trending Anime
            </button>
          )}
        </div>
      )}
    </>
  )}
</div>
  );
};
