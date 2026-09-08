import React, { useEffect, useState } from 'react';
import { Anime, AnimeDetail, FranchiseWatchOrder, WatchOrderItem } from '../types';
import { fetchFranchiseWatchOrder } from '../services/watchOrderService';
import {
  Compass,
  Film,
  Tv,
  CheckCircle2,
  Circle,
  Play,
  ArrowRight,
  Info,
  Calendar,
  Layers,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  List,
  Sparkles,
  Search,
  Eye,
  Video,
} from 'lucide-react';

interface AnimeWatchOrderTabProps {
  currentAnime: Anime;
  details?: AnimeDetail | null;
  onNavigateToAnime: (anime: Anime) => void;
  onPlayStream?: (anime: Anime, episodeNumber: number, serverIndex?: number) => void;
  onOpenEpisodesTab?: (anime: Anime, episodeNumber?: number) => void;
}

export const AnimeWatchOrderTab: React.FC<AnimeWatchOrderTabProps> = ({
  currentAnime,
  details,
  onNavigateToAnime,
  onPlayStream,
  onOpenEpisodesTab,
}) => {
  const [orderData, setOrderData] = useState<FranchiseWatchOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'series' | 'essential' | 'movies' | 'ovas'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedEpisodeItems, setExpandedEpisodeItems] = useState<Record<number, boolean>>({});
  const [expandedCardIds, setExpandedCardIds] = useState<Record<number, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`anilove_watch_order_progress_${currentAnime.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const isCardExpanded = (itemId?: number, isCurrentAnime?: boolean): boolean => {
    const key = itemId || 0;
    if (expandedCardIds[key] !== undefined) {
      return expandedCardIds[key];
    }
    // By default, expand the current anime card; keep others clean & compact
    return Boolean(isCurrentAnime);
  };

  const toggleCardExpanded = (itemId: number, isCurrentAnime: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCardIds(prev => {
      const currentlyExpanded = prev[itemId] !== undefined ? prev[itemId] : isCurrentAnime;
      return {
        ...prev,
        [itemId]: !currentlyExpanded,
      };
    });
  };

  const toggleAllCards = (expand: boolean) => {
    const newMap: Record<number, boolean> = {};
    const list = getActiveList();
    list.forEach((item, index) => {
      const key = item.id || (index + 1);
      newMap[key] = expand;
    });
    setExpandedCardIds(newMap);
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchFranchiseWatchOrder(currentAnime, details)
      .then(data => {
        if (isMounted) {
          setOrderData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to load watch order:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentAnime.id, details]);

  const toggleCompleted = (stepKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletedSteps(prev => {
      const updated = { ...prev, [stepKey]: !prev[stepKey] };
      try {
        localStorage.setItem(`anilove_watch_order_progress_${currentAnime.id}`, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const toggleExpandEpisodes = (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedEpisodeItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handlePlayEpisodeDirectly = (targetAnime: Anime, epNum: number) => {
    if (onPlayStream) {
      onPlayStream(targetAnime, epNum);
    } else if (onOpenEpisodesTab) {
      onOpenEpisodesTab(targetAnime, epNum);
    } else {
      onNavigateToAnime(targetAnime);
    }
  };

  const handleBrowseEpisodes = (targetAnime: Anime) => {
    if (onOpenEpisodesTab) {
      onOpenEpisodesTab(targetAnime, 1);
    } else {
      onNavigateToAnime(targetAnime);
    }
  };

  const rawList = orderData?.releaseOrder?.length
    ? orderData.releaseOrder
    : orderData?.recommendedOrder || [];

  const seriesCount = rawList.filter(item => {
    const format = (item.format || '').toUpperCase();
    if (format === 'MOVIE') return false;
    if (format === 'SPECIAL' || format === 'MUSIC') return false;
    return format === 'TV' || format === 'TV_SHORT' || (item.importance === 'essential' && format !== 'MOVIE');
  }).length;

  const moviesCount = rawList.filter(item => item.format === 'MOVIE').length;
  const ovasCount = rawList.filter(item => item.format === 'OVA' || item.format === 'SPECIAL' || item.format === 'ONA').length;

  const getActiveList = (): WatchOrderItem[] => {
    if (!orderData) return [];
    let list: WatchOrderItem[] = rawList;

    if (filterType === 'series') {
      list = list.filter(item => {
        const format = (item.format || '').toUpperCase();
        if (format === 'MOVIE') return false;
        if (format === 'SPECIAL' || format === 'MUSIC') return false;
        return format === 'TV' || format === 'TV_SHORT' || (item.importance === 'essential' && format !== 'MOVIE');
      });
    } else if (filterType === 'essential') {
      list = list.filter(item => item.importance === 'essential' || item.importance === 'recommended');
    } else if (filterType === 'movies') {
      list = list.filter(item => item.format === 'MOVIE');
    } else if (filterType === 'ovas') {
      list = list.filter(item => item.format === 'OVA' || item.format === 'SPECIAL' || item.format === 'ONA');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => 
        item.title.toLowerCase().includes(q) ||
        (item.romajiTitle && item.romajiTitle.toLowerCase().includes(q)) ||
        (item.releaseYear && String(item.releaseYear).includes(q))
      );
    }

    return list;
  };

  const currentList = getActiveList();
  const totalInList = currentList.length;
  const completedCount = currentList.filter(item => completedSteps[item.title] || (item.id && completedSteps[String(item.id)])).length;
  const percentComplete = totalInList > 0 ? Math.round((completedCount / totalInList) * 100) : 0;
  const allExpanded =
    currentList.length > 0 &&
    currentList.every((item, index) =>
      isCardExpanded(item.id || (index + 1), item.id === currentAnime.id)
    );

  const currentTitle =
    currentAnime.title?.english ||
    currentAnime.title?.romaji ||
    currentAnime.title?.userPreferred ||
    'Anime';

  return (
    <div className="space-y-5 sm:space-y-6 text-left animate-in fade-in duration-200 w-full min-w-0">
      {/* Header Banner */}
      <div className="relative rounded-2xl bg-gradient-to-br from-[#12172b] via-[#101424] to-[#0c0f1d] border border-indigo-500/20 p-4 sm:p-6 overflow-hidden shadow-xl w-full min-w-0">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0 mt-0.5 sm:mt-0">
                <Compass className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-xl font-black text-white tracking-tight">
                    Franchise Watch Order
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 whitespace-nowrap">
                    <Calendar className="w-3 h-3 text-indigo-400" />
                    Chronological Timeline
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 sm:line-clamp-none">
                  Official sequential release order with instant episode stream launchers for all seasons and movies
                </p>
              </div>
            </div>

            {/* Quick stats badge */}
            {orderData && (
              <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 shrink-0 self-start sm:self-auto">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold text-white">{orderData.totalEntries}</span> Releases
                </div>
                {orderData.totalEstimatedEpisodes && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600">•</span>
                    <Tv className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-semibold text-white">{orderData.totalEstimatedEpisodes}</span> Eps
                  </div>
                )}
                {orderData.totalEstimatedHours && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600">•</span>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{orderData.totalEstimatedHours}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Franchise Summary Description */}
          {orderData?.summary && (
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-4xl break-words">
              {orderData.summary}
            </p>
          )}

          {/* Progress Tracker Bar */}
          {totalInList > 1 && (
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Your Franchise Progress</span>
                <span className="font-bold text-indigo-400">
                  {completedCount} of {totalInList} watched ({percentComplete}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Bar: Filter Chips & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 w-full min-w-0">
        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:flex-1 min-w-0 max-w-full">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            All Releases ({rawList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('series')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
              filterType === 'series'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Series ({seriesCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('essential')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
              filterType === 'essential'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Main Story Only
          </button>
          <button
            type="button"
            onClick={() => setFilterType('movies')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
              filterType === 'movies'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Movies ({moviesCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('ovas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
              filterType === 'ovas'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Specials & OVAs ({ovasCount})
          </button>
        </div>

        {/* Quick Search & Expand/Collapse All */}
        <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
          <div className="relative flex-1 sm:w-60 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search seasons or arcs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={() => toggleAllCards(!allExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition shrink-0 cursor-pointer"
            title={allExpanded ? 'Collapse all cards to compact view' : 'Expand all cards with full details'}
          >
            {allExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden min-[420px]:inline">Collapse All</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden min-[420px]:inline">Expand All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 animate-pulse flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-800 shrink-0" />
              <div className="w-24 aspect-[2/3] rounded-lg bg-slate-800 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-slate-800 rounded" />
                <div className="h-3 w-1/4 bg-slate-800 rounded" />
                <div className="h-3 w-3/4 bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && currentList.length === 0 && (
        <div className="p-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
          <Info className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="font-semibold text-slate-300">No entries match the selected filter.</p>
          <p className="text-xs text-slate-500">Switch back to "All Releases" to view the complete franchise timeline.</p>
        </div>
      )}

      {/* Timeline Watch Order List */}
      {!loading && currentList.length > 0 && (
        <div className="relative space-y-4">
          {/* Vertical Connecting Guide Line */}
          <div className="absolute left-[26px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-indigo-500/40 via-indigo-500/20 to-transparent hidden sm:block pointer-events-none" />

          {currentList.map((item, index) => {
            const stepKey = String(item.id || item.title);
            const isCompleted = Boolean(completedSteps[stepKey] || (item.id && completedSteps[String(item.id)]));
            const isCurrent = item.id === currentAnime.id || item.title.toLowerCase() === currentTitle.toLowerCase();

            // Color scheme for importance
            const isEssential = item.importance === 'essential';
            const isMovie = item.format === 'MOVIE';
            const isOVA = item.format === 'OVA' || item.format === 'SPECIAL' || item.format === 'ONA';

            // Episode calculation
            let parsedEpisodeCount = 1;
            if (typeof item.episodesCount === 'number') {
              parsedEpisodeCount = item.episodesCount;
            } else if (typeof item.episodesCount === 'string') {
              const match = item.episodesCount.match(/(\d+)/);
              if (match) parsedEpisodeCount = parseInt(match[1], 10);
            }
            if (item.animeObj?.episodes) {
              parsedEpisodeCount = item.animeObj.episodes;
            }
            if (isMovie && parsedEpisodeCount <= 0) parsedEpisodeCount = 1;

            const cardId = item.id || (index + 1);
            const cardExpanded = isCardExpanded(cardId, isCurrent);
            const isEpisodesExpanded = Boolean(item.id && expandedEpisodeItems[item.id]);

            return (
              <div
                key={item.id || index}
                className={`relative group flex flex-col items-stretch p-3.5 sm:p-4 rounded-2xl transition-all duration-200 border w-full max-w-full min-w-0 overflow-hidden ${
                  isCurrent
                    ? 'bg-[#151c38] border-indigo-500/70 shadow-lg shadow-indigo-500/10'
                    : isCompleted
                    ? 'bg-[#0f1322]/80 border-slate-800/80 opacity-95'
                    : 'bg-[#101424] hover:bg-[#14192e] border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Mobile Top Header Bar: Step Badge + Badges + Mark Watched */}
                <div className="flex sm:hidden items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/70 w-full min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 shadow-sm ${
                        isCurrent
                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white ring-1 ring-indigo-400'
                          : isCompleted
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60'
                          : isEssential
                          ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/50'
                          : isMovie
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {index + 1 < 10 ? `0${index + 1}` : index + 1}
                    </div>

                    {isCurrent && (
                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-500 text-white text-[9px] font-black tracking-wider uppercase">
                        Current
                      </span>
                    )}

                    {item.releaseYear && (
                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black">
                        {item.releaseYear}
                      </span>
                    )}

                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${
                        isEssential
                          ? 'bg-indigo-950/90 text-indigo-300 border border-indigo-700/50'
                          : isMovie
                          ? 'bg-amber-950/90 text-amber-300 border border-amber-700/50'
                          : isOVA
                          ? 'bg-purple-950/90 text-purple-300 border border-purple-700/50'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {item.importanceLabel || (isEssential ? 'Main Story' : isMovie ? 'Movie' : 'Canon Entry')}
                    </span>

                    {item.episodesCount && (
                      <span className="text-[10px] text-indigo-300 font-bold bg-indigo-950/40 border border-indigo-500/30 px-1.5 py-0.5 rounded-md">
                        {item.episodesCount}
                      </span>
                    )}
                  </div>

                  {/* Mark Watched Button on Mobile */}
                  <button
                    type="button"
                    onClick={e => toggleCompleted(stepKey, e)}
                    className={`p-1 rounded-lg transition shrink-0 cursor-pointer ${
                      isCompleted
                        ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-950/50'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                    title={isCompleted ? 'Mark as unwatched' : 'Mark as watched'}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 fill-emerald-500/20 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500" />
                    )}
                  </button>
                </div>

                {/* Main Card Content Row: Poster & Information side-by-side */}
                <div className="flex items-start gap-3 sm:gap-4 w-full min-w-0">
                  {/* Desktop-only Left Step Badge & Checkmark Column */}
                  <div className="hidden sm:flex flex-col items-center justify-start gap-2 shrink-0 w-12">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-transform shadow-md ${
                        isCurrent
                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#101424]'
                          : isCompleted
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60'
                          : isEssential
                          ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/50'
                          : isMovie
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {index + 1 < 10 ? `0${index + 1}` : index + 1}
                    </div>

                    <button
                      type="button"
                      onClick={e => toggleCompleted(stepKey, e)}
                      className={`p-1.5 rounded-xl transition cursor-pointer ${
                        isCompleted
                          ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-950/40'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                      title={isCompleted ? 'Mark as unwatched' : 'Mark as watched'}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 fill-emerald-500/20 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-500" />
                      )}
                    </button>
                  </div>

                  {/* Poster Artwork with Quick Hover Play Overlay */}
                  {item.coverImage && (
                    <div
                      onClick={() => item.animeObj && handlePlayEpisodeDirectly(item.animeObj, 1)}
                      className="relative w-16 min-[380px]:w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-800 shadow-md cursor-pointer hover:border-indigo-400 transition group/poster self-start"
                      title={`Play ${item.title}`}
                    >
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover/poster:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[8px] min-[380px]:text-[9px] font-black text-white tracking-wider uppercase">
                        {item.format || 'ANIME'}
                      </div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/50">
                          <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Content Block */}
                  <div className="flex-1 min-w-0 space-y-2 sm:space-y-2.5">
                    {/* Desktop badges row */}
                    <div className="hidden sm:flex flex-wrap items-center gap-2">
                      {isCurrent && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500 text-white text-[10px] font-black tracking-wider uppercase shadow-sm">
                          Current Anime
                        </span>
                      )}

                      {item.releaseYear && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-black tracking-wide">
                          {item.releaseYear}
                        </span>
                      )}

                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wide uppercase ${
                          isEssential
                            ? 'bg-indigo-950/90 text-indigo-300 border border-indigo-700/50'
                            : isMovie
                            ? 'bg-amber-950/90 text-amber-300 border border-amber-700/50'
                            : isOVA
                            ? 'bg-purple-950/90 text-purple-300 border border-purple-700/50'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {item.importanceLabel || (isEssential ? 'Main Story (TV)' : 'Canon Entry')}
                      </span>

                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-800/80 text-slate-300 text-[10px] font-medium border border-slate-700/60">
                        {item.typeBadge || item.format}
                      </span>

                      {item.episodesCount && (
                        <span className="text-xs text-indigo-300 font-bold bg-indigo-950/40 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                          {item.episodesCount}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div className="min-w-0">
                      <h4
                        onClick={() => item.animeObj && handlePlayEpisodeDirectly(item.animeObj, 1)}
                        className="font-bold text-sm sm:text-base text-slate-100 group-hover:text-indigo-300 transition leading-snug cursor-pointer break-words"
                      >
                        {item.title}
                      </h4>
                    </div>

                    {/* Primary Actions Row (Always Visible) */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5 w-full min-w-0">
                      {/* Primary Play Button */}
                      {item.animeObj && (
                        <button
                          type="button"
                          onClick={() => handlePlayEpisodeDirectly(item.animeObj!, 1)}
                          className="flowable-watch-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold transition hover:scale-105 active:scale-95 cursor-pointer shadow-sm shrink-0"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>{isMovie ? 'Watch Movie' : 'Watch Ep 1'}</span>
                        </button>
                      )}

                      {/* View More / View Less Toggle Button */}
                      <button
                        type="button"
                        onClick={e => toggleCardExpanded(cardId, isCurrent, e)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer shrink-0 ${
                          cardExpanded
                            ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300 shadow-sm'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-indigo-300'
                        }`}
                        title={cardExpanded ? 'Collapse card details' : 'View more details and guide'}
                      >
                        <span>{cardExpanded ? 'View Less' : 'View More'}</span>
                        {cardExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                    </div>

                    {/* Expandable Details Section (Shown when cardExpanded is true) */}
                    {cardExpanded && (
                      <div className="space-y-2.5 pt-1.5 animate-in fade-in slide-in-from-top-1 duration-150 w-full min-w-0">
                        {/* Romaji Title */}
                        {item.romajiTitle && item.romajiTitle !== item.title && (
                          <p className="text-[11px] text-slate-400 italic truncate">
                            {item.romajiTitle}
                          </p>
                        )}

                        {/* Order Guide Box */}
                        {item.orderGuide && (
                          <div className="flex items-start gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-[11px] sm:text-xs text-slate-300 min-w-0 break-words">
                            <Compass className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <strong className="text-indigo-300 font-semibold">Where to watch: </strong>
                              <span className="break-words">{item.orderGuide}</span>
                            </div>
                          </div>
                        )}

                        {/* Note Description */}
                        {item.note && (
                          <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 break-words">
                            {item.note}
                          </p>
                        )}

                        {/* Secondary Actions Row */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5 w-full min-w-0">
                          {/* Expandable Episodes Accordion Button */}
                          {item.id && parsedEpisodeCount > 1 && (
                            <button
                              type="button"
                              onClick={e => toggleExpandEpisodes(item.id!, e)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer shrink-0 ${
                                isEpisodesExpanded
                                  ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300 shadow-sm'
                                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                              }`}
                            >
                              <List className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Episodes ({parsedEpisodeCount})</span>
                              {isEpisodesExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>
                          )}

                          {/* Browse All Episodes in Full Modal Tab */}
                          {item.animeObj && (
                            <button
                              type="button"
                              onClick={() => handleBrowseEpisodes(item.animeObj!)}
                              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer shrink-0"
                              title="Open full Episodes browser"
                            >
                              <Video className="w-3.5 h-3.5 text-slate-400" />
                              <span className="hidden min-[380px]:inline">Browse Episodes</span>
                              <span className="min-[380px]:hidden">Episodes Tab</span>
                            </button>
                          )}

                          {/* Desktop-only Mark Completed Step Button */}
                          <button
                            type="button"
                            onClick={e => toggleCompleted(stepKey, e)}
                            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border cursor-pointer shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-950'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            {isCompleted ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Completed</span>
                              </>
                            ) : (
                              <>
                                <Circle className="w-3.5 h-3.5 text-slate-500" />
                                <span>Mark Completed</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Expandable Episode Quick-Launcher Drawer (when episodes accordion is toggled inside expanded card) */}
                {cardExpanded && isEpisodesExpanded && item.animeObj && (
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-800/80 space-y-2.5 sm:space-y-3 animate-in fade-in duration-150 w-full min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Play className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Select Episode to Watch
                        </span>
                        <span className="text-[11px] font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                          {parsedEpisodeCount} eps
                        </span>
                      </div>
                    </div>

                    {/* Grid of Episode Buttons */}
                    <div className="grid grid-cols-3 min-[360px]:grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                      {Array.from({ length: parsedEpisodeCount }, (_, i) => i + 1).map(epNum => (
                        <button
                          key={epNum}
                          type="button"
                          onClick={() => handlePlayEpisodeDirectly(item.animeObj!, epNum)}
                          className="group/ep flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-slate-900/90 hover:bg-indigo-600 border border-slate-800 hover:border-indigo-500 text-slate-200 hover:text-white text-xs font-bold transition shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
                          title={`Play Episode ${epNum} of ${item.title}`}
                        >
                          <Play className="w-2.5 h-2.5 opacity-60 group-hover/ep:opacity-100 fill-current" />
                          <span>{epNum}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
