import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  MoreVertical,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Anime, WatchHistoryEntry, MediaListStatus } from '../types';
import {
  getStoredWatchHistory,
  removeWatchHistoryItem,
  clearWatchHistory,
} from '../services/storage';

interface ContinueWatchingSectionProps {
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime, episodeNumber?: number, startTime?: number) => void;
  onUpdateStatus?: (anime: Anime, status: MediaListStatus) => void;
  onExploreTrending?: () => void;
}

export const ContinueWatchingSection: React.FC<ContinueWatchingSectionProps> = ({
  onOpenDetails,
  onPlayStream,
  onUpdateStatus,
  onExploreTrending,
}) => {
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [selectedActionItem, setSelectedActionItem] = useState<WatchHistoryEntry | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);

  // Load live watch history
  const reloadHistory = () => {
    const data = getStoredWatchHistory();
    setHistory(data);
  };

  useEffect(() => {
    reloadHistory();
    const interval = setInterval(reloadHistory, 2500);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTouchStart = (item: WatchHistoryEntry) => {
    isLongPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setSelectedActionItem(item);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCardClick = (item: WatchHistoryEntry) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    // Resume directly from exact timestamp
    onPlayStream(item.anime, item.episodeNumber, item.currentTime);
  };

  const handleRemoveItem = (item: WatchHistoryEntry) => {
    const updated = removeWatchHistoryItem(item.animeId);
    setHistory(updated);
    setSelectedActionItem(null);
  };

  const handleMarkAnimeCompleted = (item: WatchHistoryEntry) => {
    if (onUpdateStatus) {
      onUpdateStatus(item.anime, 'COMPLETED');
    }
    const updated = removeWatchHistoryItem(item.animeId);
    setHistory(updated);
    setSelectedActionItem(null);
  };

  const handleClearAll = () => {
    clearWatchHistory();
    setHistory([]);
    setSelectedActionItem(null);
  };

  // If user has not watched any anime yet, render empty state
  if (history.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3.5">
      {/* Category Row Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            Continue Watching
          </h3>
          <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-slate-300 text-[11px] font-bold backdrop-blur-sm">
            {history.length}
          </span>
        </div>

        <button
          onClick={handleClearAll}
          className="text-xs font-semibold text-slate-400 hover:text-pink-400 transition cursor-pointer"
          title="Clear all watch history"
        >
          Clear History
        </button>
      </div>

      {/* Horizontal Swipeable Row */}
      <div
        ref={scrollContainerRef}
        className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto pb-4 pt-1 px-0.5 scrollbar-none snap-x select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {history.map(item => {
          const title = item.anime.title?.english || item.anime.title?.romaji || 'Anime';
          const coverImage =
            item.anime.coverImage?.extraLarge ||
            item.anime.coverImage?.large ||
            item.anime.coverImage?.medium ||
            item.anime.bannerImage;

          const progressPercent = item.duration > 0 ? (item.currentTime / item.duration) * 100 : 0;

          return (
            <div
              key={`${item.animeId}-${item.episodeNumber}`}
              className="w-[145px] sm:w-[165px] md:w-[180px] lg:w-[192px] xl:w-[200px] shrink-0 snap-start flex flex-col justify-between group"
            >
              {/* Poster Card */}
              <div
                onContextMenu={e => {
                  e.preventDefault();
                  setSelectedActionItem(item);
                }}
                onTouchStart={() => handleTouchStart(item)}
                onTouchMove={handleTouchEnd}
                onTouchEnd={handleTouchEnd}
                onClick={() => handleCardClick(item)}
                className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 backdrop-blur-md transition-all duration-300 shadow-lg group-hover:shadow-pink-500/10 cursor-pointer"
              >
                {coverImage ? (
                  <img
                    src={coverImage}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-xs text-slate-400 p-2 text-center">
                    {title}
                  </div>
                )}

                {/* Frosted Vignette Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/95 via-transparent to-black/30 opacity-80 group-hover:opacity-90 transition-opacity" />

                {/* Episode Badge top-left */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-white/15 text-[10px] font-black text-pink-400">
                  EP {item.episodeNumber}
                </div>

                {/* Options button top-right */}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedActionItem(item);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/70 text-slate-300 hover:text-white hover:bg-slate-800 border border-white/10 backdrop-blur-md transition opacity-0 group-hover:opacity-100"
                  title="Options"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-4 h-4 fill-slate-900 translate-x-0.5" />
                  </div>
                </div>

                {/* Remaining / timestamp tag */}
                <div className="absolute bottom-2.5 right-2 px-1.5 py-0.5 rounded bg-slate-900/80 backdrop-blur-md text-[9px] font-mono text-slate-200 font-bold border border-white/15">
                  {formatTime(item.currentTime)}
                </div>

                {/* Progress Bar at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800/80">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-violet-500 shadow-sm shadow-pink-500/50 transition-all duration-300"
                    style={{ width: `${Math.max(6, Math.min(100, progressPercent))}%` }}
                  />
                </div>
              </div>

              {/* Title & Info Below Card */}
              <div className="pt-2 text-left space-y-0.5">
                <h4
                  onClick={() => onOpenDetails(item.anime)}
                  className="font-bold text-xs sm:text-sm text-slate-200 hover:text-pink-400 truncate cursor-pointer transition"
                  title={title}
                >
                  {title}
                </h4>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">
                    Ep {item.episodeNumber}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {Math.round(progressPercent)}% done
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Drawer / Modal for Selected Item */}
      {selectedActionItem && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedActionItem(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#0f121d] border border-neutral-800 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-base text-white truncate">
                  {selectedActionItem.anime.title?.english || selectedActionItem.anime.title?.romaji}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Episode {selectedActionItem.episodeNumber} • Resumes at {formatTime(selectedActionItem.currentTime)}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <button
                onClick={() => {
                  onPlayStream(
                    selectedActionItem.anime,
                    selectedActionItem.episodeNumber,
                    selectedActionItem.currentTime
                  );
                  setSelectedActionItem(null);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Resume Episode {selectedActionItem.episodeNumber}</span>
              </button>

              <button
                onClick={() => {
                  onOpenDetails(selectedActionItem.anime);
                  setSelectedActionItem(null);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold border border-neutral-800 transition cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-neutral-400" />
                <span>View Anime Details</span>
              </button>

              <button
                onClick={() => handleMarkAnimeCompleted(selectedActionItem)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-300 text-xs font-semibold border border-emerald-800/40 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Mark Anime as Completed</span>
              </button>

              <button
                onClick={() => handleRemoveItem(selectedActionItem)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold border border-rose-900/40 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Remove from Continue Watching</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
