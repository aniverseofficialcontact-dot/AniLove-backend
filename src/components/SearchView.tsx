import React, { useState, useEffect, useTransition } from 'react';
import { Search, Filter, X, Sparkles, RefreshCw, Layers, SlidersHorizontal, Check } from 'lucide-react';
import { Anime, UserMediaListItem, MediaListStatus } from '../types';
import { AnimeCard } from './AnimeCard';
import { searchAnimeAdvanced, fetchAnimeByStudio } from '../services/anilist';

interface SearchViewProps {
  initialStudio?: string | null;
  onClearStudio?: () => void;
  userLibrary: UserMediaListItem[];
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onUpdateProgress: (anime: Anime, progress: number) => void;
  onSelectGenre: (genre: string) => void;
  onSelectStudio: (studio: string) => void;
  onInspect3DCard?: (anime: Anime) => void;
}

const ALL_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

export const SearchView: React.FC<SearchViewProps> = ({
  initialStudio,
  onClearStudio,
  userLibrary,
  onOpenDetails,
  onPlayStream,
  onUpdateStatus,
  onUpdateProgress,
  onSelectGenre,
  onSelectStudio,
  onInspect3DCard,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedSort, setSelectedSort] = useState<string>('POPULARITY_DESC');
  const [activeStudio, setActiveStudio] = useState<string | null>(initialStudio || null);

  const [results, setResults] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(true);

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: currentYear - 1970 + 2 }, (_, i) => currentYear + 1 - i);

  // Sync external studio selection
  useEffect(() => {
    if (initialStudio !== undefined) {
      setActiveStudio(initialStudio);
    }
  }, [initialStudio]);

  // Toggle single genre in multi-select array
  const handleToggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleClearAllGenres = () => {
    setSelectedGenres([]);
  };

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSelectedGenres([]);
    setSelectedStatus('All');
    setSelectedFormat('All');
    setSelectedYear('All');
    setSelectedSort('POPULARITY_DESC');
    setActiveStudio(null);
    if (onClearStudio) onClearStudio();
  };

  // Perform debounced search
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        if (activeStudio) {
          const studioResults = await fetchAnimeByStudio(activeStudio, 1, 40);
          let filtered = studioResults;

          if (selectedGenres.length > 0) {
            filtered = filtered.filter(a =>
              selectedGenres.every(g => a.genres?.includes(g))
            );
          }
          if (selectedStatus !== 'All') {
            filtered = filtered.filter(a => a.status === selectedStatus);
          }
          if (selectedFormat !== 'All') {
            filtered = filtered.filter(a => a.format === selectedFormat);
          }
          if (selectedYear !== 'All') {
            const yr = Number(selectedYear);
            filtered = filtered.filter(a => a.seasonYear === yr || a.startDate?.year === yr);
          }
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(a => {
              const eng = a.title?.english?.toLowerCase() || '';
              const rom = a.title?.romaji?.toLowerCase() || '';
              return eng.includes(q) || rom.includes(q);
            });
          }

          // Rank by highest IMDb / AniList score descending by default
          if (selectedSort === 'POPULARITY_DESC' || selectedSort === 'SCORE_DESC') {
            filtered.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
          } else if (selectedSort === 'START_DATE_DESC') {
            filtered.sort((a, b) => (b.startDate?.year || b.seasonYear || 0) - (a.startDate?.year || a.seasonYear || 0));
          } else if (selectedSort === 'TITLE_ENGLISH') {
            filtered.sort((a, b) => (a.title?.english || a.title?.romaji || '').localeCompare(b.title?.english || b.title?.romaji || ''));
          }

          if (!isCancelled) {
            setResults(filtered);
          }
        } else {
          const searchData = await searchAnimeAdvanced({
            search: searchQuery.trim() || undefined,
            genres: selectedGenres.length > 0 ? selectedGenres : undefined,
            status: selectedStatus !== 'All' ? selectedStatus : undefined,
            format: selectedFormat !== 'All' ? selectedFormat : undefined,
            seasonYear: selectedYear !== 'All' ? Number(selectedYear) : undefined,
            sort: selectedSort,
            page: 1,
            perPage: 36,
          });

          if (!isCancelled) {
            setResults(searchData);
          }
        }
      } catch (err) {
        console.error('Error fetching search results:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, 280);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedGenres, selectedStatus, selectedFormat, selectedYear, selectedSort, activeStudio]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Search Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
          <Search className="w-6 h-6 text-pink-400" />
          <span>Anime Search & Discovery</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Find anime by keywords, filter across multiple categories, formats, studios, and release statuses.
        </p>
      </div>

      {/* Primary Search Bar Container */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeStudio ? `Search anime produced by ${activeStudio}...` : "Search by title, character, or keyword..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-slate-900/60 border border-white/10 text-sm sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-pink-500 transition shadow-inner backdrop-blur-md"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl text-xs sm:text-sm font-bold border transition shrink-0 backdrop-blur-md ${
              showFiltersPanel
                ? 'bg-gradient-to-r from-pink-500 to-violet-600 border-pink-400/50 text-white shadow-lg shadow-pink-500/25'
                : 'bg-white/10 border-white/15 text-slate-200 hover:text-white hover:bg-white/15'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {selectedGenres.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-slate-900 text-[11px] font-black flex items-center justify-center">
                {selectedGenres.length}
              </span>
            )}
          </button>
        </div>

        {/* Active Studio Filter Pill */}
        {activeStudio && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white text-xs font-bold shadow-md shadow-pink-500/20">
              <span>Studio: {activeStudio}</span>
              <button
                type="button"
                onClick={() => {
                  setActiveStudio(null);
                  if (onClearStudio) onClearStudio();
                }}
                className="p-0.5 hover:bg-white/20 rounded transition"
                title="Remove studio filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Expandable Advanced Filters Panel */}
        {showFiltersPanel && (
          <div className="pt-4 border-t border-white/10 space-y-5">
            {/* Multiple Categories / Genres Multi-Select */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Categories / Genres
                  </span>
                  {selectedGenres.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-pink-500/20 border border-pink-500/30 text-pink-300 text-[11px] font-bold">
                      {selectedGenres.length} selected
                    </span>
                  )}
                </div>

                {selectedGenres.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllGenres}
                    className="text-xs font-semibold text-pink-400 hover:text-pink-300 transition"
                  >
                    Clear Selected Categories
                  </button>
                )}
              </div>

              {/* Multi-Select Category Badges Grid */}
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {ALL_GENRES.map(genre => {
                  const isSelected = selectedGenres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => handleToggleGenre(genre)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer backdrop-blur-md ${
                        isSelected
                          ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-md shadow-pink-500/30 border border-pink-400/50'
                          : 'bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                      <span>{genre}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dropdown Selectors: Status, Format, Year, Sort */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {/* Release Status */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/15 text-xs font-semibold text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer backdrop-blur-md"
                >
                  <option value="All">All Statuses</option>
                  <option value="RELEASING">Airing Now</option>
                  <option value="FINISHED">Completed</option>
                  <option value="NOT_YET_RELEASED">Upcoming</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Format */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Format
                </label>
                <select
                  value={selectedFormat}
                  onChange={e => setSelectedFormat(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/15 text-xs font-semibold text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer backdrop-blur-md"
                >
                  <option value="All">All Formats</option>
                  <option value="TV">TV Series</option>
                  <option value="MOVIE">Movie</option>
                  <option value="OVA">OVA</option>
                  <option value="ONA">ONA</option>
                  <option value="SPECIAL">Special</option>
                </select>
              </div>

              {/* Year */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/15 text-xs font-semibold text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer backdrop-blur-md"
                >
                  <option value="All">All Years</option>
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Order */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Sort By
                </label>
                <select
                  value={selectedSort}
                  onChange={e => setSelectedSort(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/15 text-xs font-semibold text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer backdrop-blur-md"
                >
                  <option value="POPULARITY_DESC">Most Popular</option>
                  <option value="SCORE_DESC">Highest Rated</option>
                  <option value="TRENDING_DESC">Trending</option>
                  <option value="START_DATE_DESC">Newest / Release Date</option>
                  <option value="FAVOURITES_DESC">Most Favorited</option>
                </select>
              </div>
            </div>

            {/* Quick Reset All Action */}
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="text-xs font-bold text-slate-400 hover:text-white transition"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Header & Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>Results</span>
            <span className="text-xs font-semibold text-pink-400 bg-pink-500/20 border border-pink-500/30 px-2 py-0.5 rounded-full">
              {results.length} titles
            </span>
          </h2>
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-pink-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Updating...</span>
            </div>
          )}
        </div>

        {/* Cards Grid */}
        {isLoading && results.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-3">
            <p className="text-base font-bold text-slate-200">No matching anime found</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Try deselecting some categories, clearing the search keyword, or adjusting the status and format filters.
            </p>
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white text-xs font-bold transition shadow-lg shadow-pink-500/25"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.map(anime => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                userItem={userLibrary.find(i => i.mediaId === anime.id)}
                onOpenDetails={onOpenDetails}
                onPlayStream={onPlayStream}
                onUpdateStatus={onUpdateStatus}
                onUpdateProgress={onUpdateProgress}
                onSelectGenre={genre => {
                  if (!selectedGenres.includes(genre)) {
                    setSelectedGenres(prev => [...prev, genre]);
                  }
                }}
                onSelectStudio={studio => {
                  setActiveStudio(studio);
                  if (onSelectStudio) onSelectStudio(studio);
                }}
                onInspect3DCard={onInspect3DCard}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
