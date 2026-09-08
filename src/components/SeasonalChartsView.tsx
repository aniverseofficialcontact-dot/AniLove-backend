import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Calendar, Filter, Sparkles, Star, Play, Plus, Check, ChevronDown, RefreshCw } from 'lucide-react';
import { Anime, UserMediaListItem, MediaListStatus } from '../types';
import { fetchSeasonalAnime } from '../services/anilist';
import { AnimeCard } from './AnimeCard';

interface SeasonalChartsViewProps {
  userLibrary: UserMediaListItem[];
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onUpdateProgress: (anime: Anime, progress: number) => void;
  onSelectGenre?: (genre: string) => void;
  onSelectStudio?: (studio: string) => void;
}

type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export const SeasonalChartsView: React.FC<SeasonalChartsViewProps> = ({
  userLibrary,
  onOpenDetails,
  onPlayStream,
  onUpdateStatus,
  onUpdateProgress,
  onSelectGenre,
  onSelectStudio,
}) => {
  // Determine current season and year dynamically
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const initialYear = now.getFullYear();
  let initialSeason: Season = 'WINTER';
  if (currentMonth >= 2 && currentMonth <= 4) initialSeason = 'SPRING';
  else if (currentMonth >= 5 && currentMonth <= 7) initialSeason = 'SUMMER';
  else if (currentMonth >= 8 && currentMonth <= 10) initialSeason = 'FALL';
  else initialSeason = 'WINTER';

  const [selectedSeason, setSelectedSeason] = useState<Season>(initialSeason);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const [selectedSort, setSelectedSort] = useState<string>('POPULARITY_DESC');
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const years = Array.from({ length: 15 }, (_, i) => initialYear + 1 - i);

  const loadSeasonData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSeasonalAnime(
        selectedSeason,
        selectedYear,
        selectedFormat === 'All' ? undefined : selectedFormat,
        selectedSort,
        1,
        48
      );
      setAnimeList(data);
    } catch (err: any) {
      console.error('Error fetching seasonal anime:', err);
      setError('Could not load seasonal chart. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSeason, selectedYear, selectedFormat, selectedSort]);

  useEffect(() => {
    loadSeasonData();
  }, [loadSeasonData]);

  const seasonsConfig: { id: Season; label: string; icon: string }[] = [
    { id: 'WINTER', label: 'Winter', icon: '❄️' },
    { id: 'SPRING', label: 'Spring', icon: '🌸' },
    { id: 'SUMMER', label: 'Summer', icon: '☀️' },
    { id: 'FALL', label: 'Fall', icon: '🍂' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Calendar className="w-4 h-4" />
            <span>Seasonal Anime Archive & Charts</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {selectedSeason.charAt(0) + selectedSeason.slice(1).toLowerCase()} {selectedYear} Anime Chart
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-xl">
            Explore broadcast seasons, discover new releases, and track every premiere of {selectedYear}.
          </p>
        </div>

        {/* Season Tabs Selector */}
        <div className="relative z-10 flex flex-wrap items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
          {seasonsConfig.map(s => {
            const isActive = selectedSeason === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSeason(s.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md ${
                  isActive
                    ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-md shadow-pink-500/25 border border-pink-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          {/* Year Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Year:</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-slate-900/80 text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/15 focus:outline-none focus:border-pink-500 cursor-pointer backdrop-blur-md"
            >
              {years.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Format Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Format:</label>
            <select
              value={selectedFormat}
              onChange={e => setSelectedFormat(e.target.value)}
              className="bg-slate-900/80 text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/15 focus:outline-none focus:border-pink-500 cursor-pointer backdrop-blur-md"
            >
              <option value="All">All Formats</option>
              <option value="TV">TV Series</option>
              <option value="TV_SHORT">TV Short</option>
              <option value="MOVIE">Movie</option>
              <option value="SPECIAL">Special</option>
              <option value="OVA">OVA</option>
              <option value="ONA">ONA</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Sort:</label>
            <select
              value={selectedSort}
              onChange={e => setSelectedSort(e.target.value)}
              className="bg-slate-900/80 text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/15 focus:outline-none focus:border-pink-500 cursor-pointer backdrop-blur-md"
            >
              <option value="POPULARITY_DESC">Most Popular</option>
              <option value="SCORE_DESC">Highest Rated</option>
              <option value="START_DATE_DESC">Premiere Date</option>
              <option value="EPISODES_DESC">Episode Count</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <span>{animeList.length} Anime Loaded</span>
          <button
            onClick={loadSeasonData}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 transition backdrop-blur-md"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-800/50 animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
          <p className="text-rose-400 font-bold">{error}</p>
          <button
            onClick={loadSeasonData}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
          >
            Retry Loading
          </button>
        </div>
      ) : animeList.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 text-slate-400">
          No anime found matching this season and filter combination.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
          {animeList.map(anime => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              userItem={userLibrary.find(i => i.mediaId === anime.id)}
              onOpenDetails={onOpenDetails}
              onPlayStream={onPlayStream}
              onUpdateStatus={onUpdateStatus}
              onUpdateProgress={onUpdateProgress}
              onSelectGenre={onSelectGenre}
              onSelectStudio={onSelectStudio}
            />
          ))}
        </div>
      )}
    </div>
  );
};
