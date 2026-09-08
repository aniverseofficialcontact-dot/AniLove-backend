import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Play, Star, Bookmark, Film, Tv, Clock,
  Calendar, Info, ExternalLink, Sparkles, Building2, Check
} from 'lucide-react';
import { Anime, UserMediaListItem, MediaListStatus, AnimeTrailer } from '../types';
import { sanitizeDescription } from '../services/anilist';

interface AnimePreviewModalProps {
  anime: Anime | null;
  isOpen: boolean;
  onClose: () => void;
  userItem?: UserMediaListItem;
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onOpenTrailer?: (trailer: AnimeTrailer, title: string) => void;
}

export const AnimePreviewModal: React.FC<AnimePreviewModalProps> = ({
  anime,
  isOpen,
  onClose,
  userItem,
  onOpenDetails,
  onPlayStream,
  onUpdateStatus,
  onOpenTrailer,
}) => {
  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !anime) return null;

  const title = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Title';
  const subTitle = anime.title?.romaji !== title ? anime.title?.romaji : anime.title?.native;
  const cover = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium || undefined;
  const banner = anime.bannerImage || cover;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const studio = anime.studios?.nodes?.[0]?.name;
  const cleanDesc = sanitizeDescription(anime.description);
  const currentStatus = userItem?.status;

  return (
    <AnimatePresence>
      <div
        id="anime-preview-backdrop"
        className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full sm:max-w-xl max-h-[85vh] bg-[#0e1222] border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header Banner with Lifted Poster */}
          <div className="relative h-44 sm:h-48 w-full bg-slate-900 overflow-hidden shrink-0">
            {banner && (
              <img
                src={banner}
                alt={title}
                className="w-full h-full object-cover opacity-60"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e1222] via-[#0e1222]/60 to-transparent" />

            {/* Top Controls */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold backdrop-blur-md">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Quick Preview</span>
              </span>

              <button
                id="close-preview-modal-btn"
                onClick={onClose}
                className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white backdrop-blur-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overlapping Poster & Badges */}
            <div className="absolute bottom-3 left-4 right-4 flex items-end gap-3.5 z-10">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative w-20 sm:w-24 aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border-2 border-indigo-500/40 bg-slate-900 shrink-0"
              >
                {cover ? (
                  <img
                    src={cover}
                    alt={title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-xs text-slate-400 text-center p-1">
                    {title}
                  </div>
                )}
              </motion.div>

              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  {anime.format && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 text-[10px] font-bold uppercase border border-slate-700">
                      {anime.format.replace('_', ' ')}
                    </span>
                  )}
                  {score && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{score} / 10</span>
                    </span>
                  )}
                  {anime.status && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
                      {anime.status.replace('_', ' ')}
                    </span>
                  )}
                </div>

                <h3 className="font-extrabold text-base sm:text-lg text-white truncate drop-shadow-md">
                  {title}
                </h3>
                {subTitle && (
                  <p className="text-xs text-slate-400 truncate">
                    {subTitle}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* Quick Metadata Highlights */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-slate-400 block text-[10px]">Episodes</span>
                <span className="font-bold text-slate-200">
                  {typeof anime.episodes === 'number' ? `${anime.episodes} eps` : 'Ongoing'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-slate-400 block text-[10px]">Season</span>
                <span className="font-bold text-slate-200 capitalize">
                  {anime.season ? `${anime.season.toLowerCase()} ` : ''}{anime.seasonYear || '—'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-slate-400 block text-[10px]">Studio</span>
                <span className="font-bold text-slate-200 truncate block" title={studio}>
                  {studio || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Next Episode Airing Timer */}
            {anime.nextAiringEpisode && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <span className="font-semibold">
                    Episode {anime.nextAiringEpisode.episode} Airing Broadcast
                  </span>
                </div>
                <span className="font-bold text-indigo-300">
                  {Math.ceil(anime.nextAiringEpisode.timeUntilAiring / 3600)} hrs
                </span>
              </div>
            )}

            {/* Synopsis */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>Synopsis</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed max-h-28 overflow-y-auto pr-1">
                {cleanDesc}
              </p>
            </div>

            {/* Genres */}
            {anime.genres && anime.genres.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {anime.genres.map(g => (
                  <span
                    key={g}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Interactive Actions Bar */}
          <div className="p-4 bg-[#0a0d18] border-t border-slate-800/80 flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Stream Player Button */}
            <button
              onClick={() => {
                onClose();
                onPlayStream(anime);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-900/30 transition active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Watch Now</span>
            </button>

            {/* Trailer Preview Button */}
            {anime.trailer && anime.trailer.id && onOpenTrailer && (
              <button
                onClick={() => {
                  onClose();
                  onOpenTrailer(anime.trailer!, title);
                }}
                className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
              >
                <Film className="w-4 h-4 text-red-400" />
                <span className="hidden sm:inline">Trailer</span>
              </button>
            )}

            {/* Watchlist Quick Toggle */}
            <button
              onClick={() => {
                const nextStatus: MediaListStatus = currentStatus ? (currentStatus === 'CURRENT' ? 'COMPLETED' : 'CURRENT') : 'CURRENT';
                onUpdateStatus(anime, nextStatus);
              }}
              className={`py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                currentStatus
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {currentStatus ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              <span>{currentStatus ? currentStatus : 'Add'}</span>
            </button>

            {/* Full Details Modal */}
            <button
              onClick={() => {
                onClose();
                onOpenDetails(anime);
              }}
              className="py-2.5 px-3.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition"
            >
              <span>Full Details</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
