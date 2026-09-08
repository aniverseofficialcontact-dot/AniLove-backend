import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Info, Plus, Minus, Check, Clock, Star, Bookmark, X, Sparkles, Rotate3d, Edit3 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Anime, UserMediaListItem, MediaListStatus } from '../types';

interface AnimeCardProps {
  anime: Anime;
  userItem?: UserMediaListItem;
  showEpisodeStepper?: boolean;
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onUpdateProgress: (anime: Anime, newProgress: number) => void;
  onSelectGenre?: (genre: string) => void;
  onSelectStudio?: (studio: string) => void;
  onInspect3DCard?: (anime: Anime) => void;
}

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  userItem,
  showEpisodeStepper = false,
  onOpenDetails,
  onPlayStream,
  onUpdateStatus,
  onUpdateProgress,
  onSelectGenre,
  onSelectStudio,
  onInspect3DCard,
}) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [isEditingProgress, setIsEditingProgress] = useState(false);
  const [inlineProgressInput, setInlineProgressInput] = useState<string>('0');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mouseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isLongPressTriggeredRef = useRef(false);

  const currentProgress = userItem?.progress ?? 0;
  const currentStatus = userItem?.status;

  useEffect(() => {
    setInlineProgressInput(String(currentProgress));
  }, [currentProgress]);

  // Global coordination: Ensure ONLY ONE preview card is active/lifted at a time across the entire application
  useEffect(() => {
    const handleOtherCardPreview = (e: Event) => {
      const customEvent = e as CustomEvent<{ cardId: number }>;
      if (customEvent.detail && customEvent.detail.cardId !== anime.id) {
        setIsHeld(false);
        setShowStatusMenu(false);
      }
    };

    const handleOutsideInteraction = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsHeld(false);
        setShowStatusMenu(false);
      }
    };

    window.addEventListener('anilove:active_preview_card', handleOtherCardPreview);
    document.addEventListener('touchstart', handleOutsideInteraction, { passive: true });
    document.addEventListener('mousedown', handleOutsideInteraction);

    return () => {
      window.removeEventListener('anilove:active_preview_card', handleOtherCardPreview);
      document.removeEventListener('touchstart', handleOutsideInteraction);
      document.removeEventListener('mousedown', handleOutsideInteraction);
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
    };
  }, [anime.id]);

  const title = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Unknown Title';
  const coverUrl = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium || undefined;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const episodesTotal = typeof anime.episodes === 'number' ? anime.episodes : '?';

  // Clean description string for the hover & hold preview snippet
  const synopsisSnippet = useMemo(() => {
    if (!anime.description) return 'No synopsis available for this title.';
    const clean = anime.description.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    return clean.length > 130 ? `${clean.slice(0, 130)}...` : clean;
  }, [anime.description]);

  const studioName = anime.studios?.nodes?.[0]?.name;

  // Touch and hold detection for mobile / touch devices (preventing browser callout menu)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressTriggeredRef.current = false;

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);

    // Start 260ms hold timer to activate preview overlay without triggering browser contextmenu
    touchTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setIsHeld(true);
      window.dispatchEvent(new CustomEvent('anilove:active_preview_card', { detail: { cardId: anime.id } }));
      // Gentle haptic feedback if supported
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(30);
        }
      } catch (_) {}
    }, 260);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchTimerRef.current) return;
    const touch = e.touches[0];
    const diffX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const diffY = Math.abs(touch.clientY - touchStartPosRef.current.y);

    // Cancel if finger moved more than 16px (user is scrolling)
    if (diffX > 16 || diffY > 16) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchCancel = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  // Mouse hold detection for desktop click-and-hold preview
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
    mouseTimerRef.current = setTimeout(() => {
      setIsHeld(true);
      isLongPressTriggeredRef.current = true;
      window.dispatchEvent(new CustomEvent('anilove:active_preview_card', { detail: { cardId: anime.id } }));
    }, 320);
  };

  const handleMouseUp = () => {
    if (mouseTimerRef.current) {
      clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = null;
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If long-press just triggered or editing inline, prevent immediate navigation
    if (isLongPressTriggeredRef.current || isEditingProgress) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    // Clicking card opens the 3D showcase modal or details
    if (onInspect3DCard) {
      onInspect3DCard(anime);
    } else {
      onOpenDetails(anime);
    }
  };

  const handleStepProgress = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    e.preventDefault();
    const max = typeof anime.episodes === 'number' && anime.episodes > 0 ? anime.episodes : 9999;
    const nextVal = Math.max(0, Math.min(max, currentProgress + delta));
    
    if (nextVal !== currentProgress) {
      if (typeof anime.episodes === 'number' && nextVal >= anime.episodes) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
        onUpdateStatus(anime, 'COMPLETED');
      } else if (nextVal > 0 && (!currentStatus || currentStatus === 'PLANNING' || currentStatus === 'COMPLETED')) {
        onUpdateStatus(anime, 'CURRENT');
      }
      onUpdateProgress(anime, nextVal);
    }
  };

  const handleCommitDirectProgress = (valStr: string) => {
    setIsEditingProgress(false);
    const parsed = parseInt(valStr, 10);
    if (isNaN(parsed)) {
      setInlineProgressInput(String(currentProgress));
      return;
    }
    const max = typeof anime.episodes === 'number' && anime.episodes > 0 ? anime.episodes : 9999;
    const clamped = Math.max(0, Math.min(max, parsed));
    
    if (clamped !== currentProgress) {
      if (typeof anime.episodes === 'number' && clamped >= anime.episodes) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
        onUpdateStatus(anime, 'COMPLETED');
      } else if (clamped > 0 && (!currentStatus || currentStatus === 'PLANNING' || currentStatus === 'COMPLETED')) {
        onUpdateStatus(anime, 'CURRENT');
      }
      onUpdateProgress(anime, clamped);
    }
    setInlineProgressInput(String(clamped));
  };

  const handleStatusSelect = (e: React.MouseEvent, status: MediaListStatus) => {
    e.stopPropagation();
    setShowStatusMenu(false);
    onUpdateStatus(anime, status);
  };

  const handleToggleStatusMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !showStatusMenu;
    if (nextState) {
      window.dispatchEvent(new CustomEvent('anilove:active_preview_card', { detail: { cardId: anime.id } }));
    }
    setShowStatusMenu(nextState);
  };

  // Status color pill
  const getStatusBadge = () => {
    if (!currentStatus) return null;
    switch (currentStatus) {
      case 'CURRENT':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600/90 text-white shadow-sm">WATCHING</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600/90 text-white shadow-sm">COMPLETED</span>;
      case 'PLANNING':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-600/90 text-white shadow-sm">PLANNING</span>;
      case 'PAUSED':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-600/90 text-white shadow-sm">PAUSED</span>;
      case 'DROPPED':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-600/90 text-white shadow-sm">DROPPED</span>;
      default:
        return null;
    }
  };

  const isFullyCompleted = typeof anime.episodes === 'number' && anime.episodes > 0 && currentProgress >= anime.episodes;
  const progressPercent = typeof anime.episodes === 'number' && anime.episodes > 0
    ? Math.min(100, Math.round((currentProgress / anime.episodes) * 100))
    : currentProgress > 0 ? 100 : 0;

  return (
    <div
      ref={cardRef}
      id={`anime-card-${anime.id}`}
      draggable={false}
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ perspective: '1000px' }}
      className={`anime-card group relative flex flex-col transition-all duration-300 ease-out select-none cursor-pointer will-change-transform no-callout ${
        isHeld
          ? '-translate-y-2 scale-[1.025] [transform:perspective(1000px)_rotateX(-2.5deg)_translateY(-4px)] shadow-2xl z-30'
          : 'hover:-translate-y-2 hover:scale-[1.025] hover:[transform:perspective(1000px)_rotateX(-2.5deg)_translateY(-4px)] z-10 hover:z-30 hover:shadow-2xl'
      }`}
      onClick={handleCardClick}
      onMouseEnter={() => {
        window.dispatchEvent(new CustomEvent('anilove:active_preview_card', { detail: { cardId: anime.id } }));
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {/* Poster Image Container */}
      <div
        draggable={false}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-white/5 border border-white/10 shadow-lg group-hover:shadow-2xl group-hover:border-white/30 transition-all duration-300 backdrop-blur-md select-none pointer-events-auto [transform-style:preserve-3d]"
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            loading="lazy"
            draggable={false}
            referrerPolicy="no-referrer"
            onContextMenu={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={`h-full w-full object-cover transition-transform duration-500 pointer-events-none select-none no-callout ${
              isHeld ? 'scale-105' : 'group-hover:scale-105'
            }`}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-white/5 text-slate-400 font-bold text-sm p-4 text-center select-none">
            {title}
          </div>
        )}

        {/* Ambient Top Shadow Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-black/20 opacity-40 group-hover:opacity-20 transition-opacity pointer-events-none" />

        {/* Top-Left Score Badge */}
        {score && (
          <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/85 backdrop-blur-md text-white text-xs font-bold border border-white/15 shadow-md pointer-events-none">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>{score}</span>
          </div>
        )}

        {/* Live Mouse-Hover & Touch-Hold Preview Overlay */}
        <div
          onContextMenu={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`absolute inset-0 bg-gradient-to-t from-[#090d16]/95 via-[#0b1120]/80 to-transparent backdrop-blur-[2px] transition-all duration-250 flex flex-col justify-between p-3 z-20 ${
            isHeld
              ? 'opacity-100 pointer-events-auto shadow-2xl'
              : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'
          }`}
        >
          {/* Top Bar: bookmark status button & Close preview button (if held) */}
          <div className="flex items-center justify-end gap-1.5 pt-0.5">
              {/* 3D 360° Rotate Card Showcase */}
              <button
                type="button"
                title="360° 3D Anime Card"
                onClick={e => {
                  e.stopPropagation();
                  setIsHeld(false);
                  if (onInspect3DCard) onInspect3DCard(anime);
                  else onOpenDetails(anime);
                }}
                className="p-1.5 rounded-lg bg-pink-500/30 hover:bg-pink-500/60 text-pink-200 hover:text-white border border-pink-500/40 backdrop-blur-md transition cursor-pointer"
              >
                <Rotate3d className="w-3.5 h-3.5" />
              </button>

              {/* Bookmark status button */}
              <button
                type="button"
                title="Bookmark / Change Status"
                onClick={handleToggleStatusMenu}
                className={`p-1.5 rounded-lg transition backdrop-blur-md cursor-pointer ${
                  currentStatus
                    ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-md shadow-pink-500/40'
                    : 'bg-white/15 text-slate-200 hover:text-white hover:bg-white/25 border border-white/20'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>

              {/* Close Preview Button when held on mobile/touch */}
              {isHeld && (
                <button
                  type="button"
                  title="Close Preview"
                  onClick={e => {
                    e.stopPropagation();
                    setIsHeld(false);
                    setShowStatusMenu(false);
                  }}
                  className="p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-slate-300 hover:text-white border border-white/20 backdrop-blur-md transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
          </div>

          {/* Center Details & Synopsis */}
          <div className="space-y-2 my-auto text-left">
            {/* 3D Card and Details Action Pill Buttons */}
            <div className="flex items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setIsHeld(false);
                  if (onInspect3DCard) onInspect3DCard(anime);
                  else onOpenDetails(anime);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-bold shadow-md shadow-indigo-600/30 active:scale-95 transition cursor-pointer border border-indigo-400/30"
              >
                <Rotate3d className="w-3 h-3 text-pink-300" />
                <span>3D Card</span>
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onOpenDetails(anime);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white text-[11px] font-bold shadow-lg shadow-pink-500/30 active:scale-95 transition cursor-pointer"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Details</span>
              </button>
            </div>

            {/* Uppercase Genres */}
            {anime.genres && anime.genres.length > 0 && (
              <div className="text-[10px] font-black uppercase tracking-wider text-pink-400 text-center truncate">
                {anime.genres.slice(0, 2).join(' • ')}
              </div>
            )}

            {/* Synopsis Preview Snippet */}
            <p className="text-[11px] text-slate-200 line-clamp-3 leading-relaxed font-medium text-left">
              {synopsisSnippet}
            </p>
          </div>

          {/* Bottom Episode Stats & Watch Action */}
          <div className="space-y-1.5 pt-1 border-t border-white/10">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>{typeof anime.episodes === 'number' ? `${anime.episodes} eps` : 'Ongoing'}</span>
              <span>•</span>
              <span className="capitalize">{anime.status ? anime.status.toLowerCase().replace('_', ' ') : 'releasing'}</span>
            </div>

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setIsHeld(false);
                onPlayStream(anime);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 backdrop-blur-md shadow-md transition active:scale-95 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>Watch Now</span>
            </button>
          </div>
        </div>

        {/* Quick Status Dropdown Menu on Card */}
        {showStatusMenu && (
          <div
            className="absolute top-10 right-2.5 z-40 w-36 rounded-2xl bg-[#0f172a]/95 border border-white/15 shadow-2xl p-1.5 text-xs text-slate-200 space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {(['CURRENT', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED'] as MediaListStatus[]).map(st => {
              const active = currentStatus === st;
              const labels: Record<MediaListStatus, string> = {
                CURRENT: 'Watching',
                PLANNING: 'Planning',
                COMPLETED: 'Completed',
                PAUSED: 'Paused',
                DROPPED: 'Dropped',
                REPEATING: 'Rewatching',
              };
              return (
                <button
                  key={st}
                  type="button"
                  onClick={e => handleStatusSelect(e, st)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition cursor-pointer ${
                    active ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold' : 'hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <span>{labels[st]}</span>
                  {active && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content Bottom Title & Metadata */}
      <div className="pt-2 px-0.5 space-y-1 text-left">
        {/* Title */}
        <h4
          className="font-bold text-xs sm:text-sm text-slate-100 line-clamp-1 leading-snug group-hover:text-pink-400 transition"
          title={title}
        >
          {title}
        </h4>

        {/* Format and Year & Status Badge */}
        <div className="text-[11px] sm:text-xs text-slate-400 font-medium flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 truncate">
            <span>{anime.format?.replace('_', ' ') || 'TV'}</span>
            <span>·</span>
            <span>{anime.seasonYear || anime.startDate?.year || '2026'}</span>
          </div>
          {getStatusBadge()}
        </div>

        {/* Episode Progress & Quick Step Bar (Only visible in My Library view) */}
        {userItem && showEpisodeStepper && (
          <div
            className="mt-1.5 pt-1.5 border-t border-white/10 flex flex-col gap-1"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-1 text-[11px]">
              {/* Minus button */}
              <button
                type="button"
                disabled={currentProgress <= 0}
                onClick={e => handleStepProgress(e, -1)}
                title="Decrease Episode (-1)"
                className="w-5 h-5 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer shrink-0 active:scale-90"
              >
                <Minus className="w-3 h-3" />
              </button>

              {/* Episode Display / Inline Number Editor */}
              {isEditingProgress ? (
                <div className="flex items-center justify-center gap-1 flex-1 min-w-0">
                  <span className="text-[10px] text-slate-400 font-semibold">Ep:</span>
                  <input
                    ref={inlineInputRef}
                    type="number"
                    min={0}
                    max={typeof anime.episodes === 'number' ? anime.episodes : 9999}
                    value={inlineProgressInput}
                    autoFocus
                    onChange={e => {
                      const val = e.target.value;
                      const num = parseInt(val, 10);
                      const max = typeof anime.episodes === 'number' ? anime.episodes : 9999;
                      if (!isNaN(num) && num > max) {
                        setInlineProgressInput(String(max));
                      } else {
                        setInlineProgressInput(val);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleCommitDirectProgress(inlineProgressInput);
                      } else if (e.key === 'Escape') {
                        setIsEditingProgress(false);
                        setInlineProgressInput(String(currentProgress));
                      }
                    }}
                    onBlur={() => handleCommitDirectProgress(inlineProgressInput)}
                    onClick={e => e.stopPropagation()}
                    className="w-12 px-1 py-0.5 rounded bg-slate-900 border border-indigo-500 text-indigo-300 font-black text-center text-xs outline-none shadow-inner"
                  />
                  <span className="text-[10px] text-slate-400 truncate">/ {episodesTotal}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setIsEditingProgress(true);
                    setTimeout(() => inlineInputRef.current?.select(), 50);
                  }}
                  title={typeof anime.episodes === 'number' ? `Click to write episode (Limit: ${anime.episodes})` : 'Click to write episode'}
                  className="group/ep flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-white/10 transition cursor-pointer flex-1 min-w-0"
                >
                  <span className="font-bold text-slate-300 group-hover/ep:text-indigo-400 truncate text-[11px]">
                    Ep {currentProgress} <span className="text-slate-500 font-normal">/ {episodesTotal}</span>
                  </span>
                  {isFullyCompleted ? (
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Edit3 className="w-2.5 h-2.5 text-slate-500 opacity-0 group-hover/ep:opacity-100 transition shrink-0" />
                  )}
                </button>
              )}

              {/* Plus button */}
              <button
                type="button"
                disabled={typeof anime.episodes === 'number' && anime.episodes > 0 && currentProgress >= anime.episodes}
                onClick={e => handleStepProgress(e, 1)}
                title={
                  typeof anime.episodes === 'number' && anime.episodes > 0 && currentProgress >= anime.episodes
                    ? `Completed all ${anime.episodes} episodes!`
                    : 'Increase Episode (+1)'
                }
                className={`w-5 h-5 flex items-center justify-center rounded-md text-white transition cursor-pointer shrink-0 active:scale-90 ${
                  typeof anime.episodes === 'number' && anime.episodes > 0 && currentProgress >= anime.episodes
                    ? 'bg-emerald-600/40 opacity-40 cursor-not-allowed text-emerald-300'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-600/30'
                }`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isFullyCompleted
                    ? 'bg-emerald-400'
                    : 'bg-gradient-to-r from-indigo-500 to-pink-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
