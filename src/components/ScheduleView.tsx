import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, Bookmark, Play, Check, Filter,
  RefreshCw, Star, Search, ChevronLeft, ChevronRight, Eye, Sparkles
} from 'lucide-react';
import { AiringScheduleItem, Anime, UserMediaListItem } from '../types';
import { fetchAiringSchedule } from '../services/anilist';

interface ScheduleViewProps {
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  userLibrary: UserMediaListItem[];
  onQuickTrack: (anime: Anime) => void;
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  onOpenDetails,
  onPlayStream,
  userLibrary,
  onQuickTrack,
}) => {
  const [scheduleItems, setScheduleItems] = useState<AiringScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => new Date().getDay());
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = current week, 1 = next week, -1 = prev week
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState<number>(Math.floor(Date.now() / 1000));

  // Live second-by-second countdown clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute 7 days of the selected week based on weekOffset
  const weekDays = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sun, 1 = Mon...
    
    // Start of the week (Sunday 00:00:00) with weekOffset
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDay + (weekOffset * 7));
    startOfWeek.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      days.push({
        dayIndex: i,
        dayName: DAYS_OF_WEEK[i],
        date,
        dateString: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        isoDate: date.toISOString().slice(0, 10),
        isToday,
      });
    }
    return days;
  }, [weekOffset]);

  // Fetch full week airing schedule from AniList
  const loadWeekSchedule = async () => {
    setLoading(true);
    try {
      if (weekDays.length === 0) return;
      const startOfWeek = new Date(weekDays[0].date);
      startOfWeek.setHours(0, 0, 0, 0);
      const startTimestamp = Math.floor(startOfWeek.getTime() / 1000);

      // End of Saturday 23:59:59 (+ 24h buffer)
      const endOfWeek = new Date(weekDays[6].date);
      endOfWeek.setHours(23, 59, 59, 999);
      const endTimestamp = Math.floor(endOfWeek.getTime() / 1000) + (12 * 3600);

      const items = await fetchAiringSchedule(startTimestamp, endTimestamp);
      setScheduleItems(items);
    } catch (err) {
      console.error('Error fetching weekly schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeekSchedule();
  }, [weekOffset]);

  // Group items by Day of Week using local date calculations
  const itemsByDay = useMemo(() => {
    const map: Record<number, AiringScheduleItem[]> = {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    };

    scheduleItems.forEach(item => {
      const date = new Date(item.airingAt * 1000);
      const day = date.getDay();
      if (map[day]) {
        map[day].push(item);
      }
    });

    // Sort by air time within each day
    Object.keys(map).forEach(d => {
      map[Number(d)].sort((a, b) => a.airingAt - b.airingAt);
    });

    return map;
  }, [scheduleItems]);

  const currentDayList = useMemo(() => {
    let list = itemsByDay[selectedDayIndex] || [];
    
    // Watchlist filter
    if (onlyWatchlist) {
      const trackedMediaIds = new Set(userLibrary.map(u => u.mediaId));
      list = list.filter(item => trackedMediaIds.has(item.media.id));
    }

    // Search query filter
    if (scheduleSearch.trim()) {
      const q = scheduleSearch.toLowerCase().trim();
      list = list.filter(item => {
        const titleEng = item.media.title?.english?.toLowerCase() || '';
        const titleRom = item.media.title?.romaji?.toLowerCase() || '';
        const genres = item.media.genres?.map(g => g.toLowerCase()).join(' ') || '';
        return titleEng.includes(q) || titleRom.includes(q) || genres.includes(q);
      });
    }

    return list;
  }, [itemsByDay, selectedDayIndex, onlyWatchlist, scheduleSearch, userLibrary]);

  const todayIndex = new Date().getDay();

  // Helper to format countdown
  const formatCountdown = (airingAt: number) => {
    const diff = airingAt - nowTimestamp;
    if (diff <= 0) {
      const elapsed = Math.abs(diff);
      if (elapsed < 3600) return `Aired ${Math.floor(elapsed / 60)}m ago`;
      if (elapsed < 86400) return `Aired ${Math.floor(elapsed / 3600)}h ago`;
      return 'Already Aired';
    }

    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Airs in ${days}d ${hours % 24}h`;
    }
    return `Airs in ${hours}h ${mins}m ${secs}s`;
  };

  return (
    <div id="schedule-view-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 mb-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Weekly Broadcast Schedule</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Airing Anime Calendar
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Follow exact release times in your local timezone with live episode countdowns.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Week Selector Controls */}
          <div className="flex items-center bg-[#121626] border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setWeekOffset(0);
                setSelectedDayIndex(new Date().getDay());
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                weekOffset === 0 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Watchlist Filter Toggle */}
          <button
            onClick={() => setOnlyWatchlist(!onlyWatchlist)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
              onlyWatchlist
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Watchlist Only</span>
          </button>

          {/* Refresh Button */}
          <button
            title="Refresh Schedule"
            onClick={loadWeekSchedule}
            className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Schedule Search Filter Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Filter scheduled anime by title or genre..."
          value={scheduleSearch}
          onChange={e => setScheduleSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121626] border border-slate-800 focus:border-indigo-500 focus:outline-none text-xs sm:text-sm text-slate-200 placeholder-slate-500 shadow-inner"
        />
        {scheduleSearch && (
          <button
            onClick={() => setScheduleSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Days of Week Tabs with Date Labels & Episode Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {weekDays.map(item => {
          const isSelected = selectedDayIndex === item.dayIndex;
          const count = itemsByDay[item.dayIndex]?.length || 0;

          return (
            <button
              key={item.dayName}
              onClick={() => setSelectedDayIndex(item.dayIndex)}
              className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-1 ${
                isSelected
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/30 ring-2 ring-indigo-400/50'
                  : item.isToday
                  ? 'bg-indigo-950/50 border-indigo-500/50 text-indigo-200 hover:bg-indigo-900/50'
                  : 'bg-[#121626] border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold">{item.dayName.slice(0, 3)}</span>
                {item.isToday && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium opacity-75">{item.dateString}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 font-bold mt-0.5">
                {count} {count === 1 ? 'anime' : 'animes'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Airing Anime Grid with Physical Lift & Preview */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
            <div key={i} className="h-36 rounded-2xl animate-shimmer" />
          ))}
        </div>
      ) : currentDayList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentDayList.map(item => {
            const anime = item.media;
            const title = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Title';
            const cover = anime.coverImage?.large || anime.coverImage?.medium;
            const airDate = new Date(item.airingAt * 1000);
            const timeStr = airDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
            const isTracked = userLibrary.some(u => u.mediaId === anime.id);
            const diff = item.airingAt - nowTimestamp;
            const isLive = diff > 0 && diff <= 3600;

            return (
              <div
                key={item.id}
                onClick={() => onOpenDetails(anime)}
                className="group relative flex gap-3.5 p-3 rounded-2xl bg-[#121626] border border-slate-800 hover:border-indigo-500/60 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.01] shadow-lg hover:shadow-2xl hover:shadow-indigo-500/15 cursor-pointer overflow-hidden"
              >
                {/* Poster */}
                <div className="relative w-20 sm:w-24 aspect-[3/4] rounded-xl overflow-hidden bg-slate-900 shrink-0">
                  {cover ? (
                    <img
                      src={cover}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-108 transition duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-xs text-slate-400 p-2 text-center">
                      {title}
                    </div>
                  )}
                  {isLive && (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-extrabold animate-pulse shadow-md">
                      LIVE
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2">
                  <div>
                    {/* Air Time & Countdown */}
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <span className="font-bold text-indigo-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{timeStr}</span>
                      </span>

                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        diff <= 0
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-indigo-950 text-indigo-300 border border-indigo-500/30'
                      }`}>
                        {formatCountdown(item.airingAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="font-bold text-sm text-slate-100 group-hover:text-indigo-400 transition truncate mt-1">
                      {title}
                    </h4>

                    {/* Airing Episode Badge & Score */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                        Episode {item.episode}
                      </span>
                      {score && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-300 font-bold">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{score}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onPlayStream(anime);
                        }}
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-bold transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-emerald-400" />
                        <span>Stream</span>
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onOpenDetails(anime);
                        }}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 font-semibold transition"
                      >
                        <span>Details</span>
                      </button>
                    </div>

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onQuickTrack(anime);
                      }}
                      className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                        isTracked
                          ? 'bg-indigo-600/40 text-indigo-300 border border-indigo-500/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                      }`}
                      title={isTracked ? 'In Watchlist' : 'Add to Watchlist'}
                    >
                      {isTracked ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 rounded-2xl bg-[#121626] border border-slate-800 space-y-3">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">
            {onlyWatchlist
              ? `No tracked anime airing on ${DAYS_OF_WEEK[selectedDayIndex]}`
              : scheduleSearch
              ? `No schedule matches for "${scheduleSearch}" on ${DAYS_OF_WEEK[selectedDayIndex]}`
              : `No scheduled releases found for ${DAYS_OF_WEEK[selectedDayIndex]}`}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {onlyWatchlist
              ? 'Try turning off "Watchlist Only" to see all broadcasting anime for this day.'
              : scheduleSearch
              ? 'Try clearing your search keyword.'
              : 'Try checking other days or navigating to Next Week.'}
          </p>
        </div>
      )}
    </div>
  );
};

