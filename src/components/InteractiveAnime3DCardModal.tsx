import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  Rotate3d,
  RefreshCw,
  Sparkles,
  Star,
  Share2,
  Check,
  Shield,
  Layers,
  Award,
  Flame,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Anime, UserMediaListItem } from '../types';
import { soundEffects } from '../services/soundEffects';

interface InteractiveAnime3DCardModalProps {
  anime: Anime | null;
  isOpen: boolean;
  userLibrary?: UserMediaListItem[];
  userItem?: UserMediaListItem;
  onClose: () => void;
  onOpenDetails: (anime: Anime) => void;
  onPlayStream?: (anime: Anime, episodeNumber?: number, startTime?: number) => void;
  onOpenTrailer?: (trailer: any, title: string) => void;
  onUpdateStatus?: (anime: Anime, status: any) => void;
}

export interface AnimeCardTierConfig {
  id: 'secret' | 'master' | 'rare' | 'holo';
  tierName: string;
  badge: string;
  stars: string;
  scoreThreshold: number;
  glowClass: string;
  borderClass: string;
  borderGradient: string;
  badgeBg: string;
  textColor: string;
  bgGradient: string;
  accentColor: string;
}

export const getAnimeCardTier = (anime: Anime | null): AnimeCardTierConfig => {
  if (!anime) {
    return {
      id: 'holo',
      tierName: 'Holo',
      badge: '★ Holo Tier',
      stars: '★',
      scoreThreshold: 0,
      glowClass: 'shadow-[0_0_30px_rgba(56,189,248,0.35)]',
      borderClass: 'border-cyan-400/60',
      borderGradient: 'from-cyan-400 via-blue-500 to-indigo-600',
      badgeBg: 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white',
      textColor: 'text-cyan-300',
      bgGradient: 'from-slate-900 via-[#0b101f] to-slate-950',
      accentColor: '#38bdf8',
    };
  }

  const rawScore = anime.averageScore
    ? anime.averageScore / 10
    : anime.meanScore
    ? anime.meanScore / 10
    : 0;

  // Rule 1: score >= 8.5 -> Secret Tier
  if (rawScore >= 8.5) {
    return {
      id: 'secret',
      tierName: 'Secret Glow',
      badge: '★★★★ Secret',
      stars: '★★★★',
      scoreThreshold: 8.5,
      glowClass: 'shadow-[0_0_45px_rgba(244,114,182,0.65)] ring-2 ring-pink-400/80',
      borderClass: 'border-pink-400/90',
      borderGradient: 'from-pink-500 via-purple-400 to-cyan-300',
      badgeBg: 'bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white shadow-lg shadow-pink-500/50',
      textColor: 'text-pink-300',
      bgGradient: 'from-[#1c0826] via-[#0e0a1f] to-[#080d1e]',
      accentColor: '#f472b6',
    };
  }

  // Rule 2: score >= 7.5 -> Master Tier
  if (rawScore >= 7.5) {
    return {
      id: 'master',
      tierName: 'Master Glow',
      badge: '★★★ Master',
      stars: '★★★',
      scoreThreshold: 7.5,
      glowClass: 'shadow-[0_0_38px_rgba(245,158,11,0.55)] ring-2 ring-amber-400/70',
      borderClass: 'border-amber-400/80',
      borderGradient: 'from-amber-400 via-yellow-300 to-orange-500',
      badgeBg: 'bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/40',
      textColor: 'text-amber-300',
      bgGradient: 'from-[#1e1405] via-[#100d08] to-[#0c0d14]',
      accentColor: '#fbbf24',
    };
  }

  // Rule 3: score >= 6.5 -> Rare Tier
  if (rawScore >= 6.5) {
    return {
      id: 'rare',
      tierName: 'Rare Glow',
      badge: '★★ Rare',
      stars: '★★',
      scoreThreshold: 6.5,
      glowClass: 'shadow-[0_0_32px_rgba(168,85,247,0.45)] ring-1 ring-purple-400/60',
      borderClass: 'border-purple-400/70',
      borderGradient: 'from-purple-500 via-indigo-400 to-pink-500',
      badgeBg: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30',
      textColor: 'text-purple-300',
      bgGradient: 'from-[#130924] via-[#0c0b1a] to-[#090b14]',
      accentColor: '#c084fc',
    };
  }

  // Rule 4: score < 6.5 -> Holo Tier
  return {
    id: 'holo',
    tierName: 'Holo Appearance',
    badge: '★ Holo',
    stars: '★',
    scoreThreshold: 0,
    glowClass: 'shadow-[0_0_28px_rgba(56,189,248,0.35)] ring-1 ring-cyan-400/50',
    borderClass: 'border-cyan-400/60',
    borderGradient: 'from-cyan-400 via-blue-500 to-slate-400',
    badgeBg: 'bg-gradient-to-r from-slate-800 to-cyan-800 text-cyan-200 shadow-sm',
    textColor: 'text-cyan-300',
    bgGradient: 'from-[#081321] via-[#090d16] to-[#060a12]',
    accentColor: '#38bdf8',
  };
};

export const InteractiveAnime3DCardModal: React.FC<InteractiveAnime3DCardModalProps> = ({
  anime,
  isOpen,
  userLibrary,
  userItem: explicitUserItem,
  onClose,
  onOpenDetails,
  onPlayStream,
}) => {
  // 3D 360° Globe Rotation state
  const [rotateX, setRotateX] = useState<number>(0);
  const [rotateY, setRotateY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStartRot, setDragStartRot] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [autoSpin, setAutoSpin] = useState<boolean>(false);
  const [sheenPos, setSheenPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-Spin 360° animation loop
  useEffect(() => {
    if (!autoSpin || isDragging || !isOpen || !anime) return;
    let animId: number;
    const spinLoop = () => {
      setRotateY(prev => (prev + 0.6) % 360);
      animId = requestAnimationFrame(spinLoop);
    };
    animId = requestAnimationFrame(spinLoop);
    return () => cancelAnimationFrame(animId);
  }, [autoSpin, isDragging, isOpen, anime]);

  // Clean description
  const cleanDescription = useMemo(() => {
    if (!anime?.description) return 'No description available for this anime.';
    return anime.description
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .trim();
  }, [anime?.description]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Find user list item from library if not directly passed
  const userItem = useMemo(() => {
    if (explicitUserItem) return explicitUserItem;
    if (anime && userLibrary) {
      return userLibrary.find(item => item.mediaId === anime.id || item.media?.id === anime.id);
    }
    return undefined;
  }, [explicitUserItem, anime, userLibrary]);

  if (!isOpen || !anime) return null;

  const tier = getAnimeCardTier(anime);
  const title = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime Card';
  const nativeTitle = anime.title?.native;
  const coverUrl = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : anime.meanScore ? (anime.meanScore / 10).toFixed(1) : null;
  const studioName = anime.studios?.nodes?.[0]?.name;

  // 3D 360° Globe Drag Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    setAutoSpin(false);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragStartRot({ x: rotateX, y: rotateY });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartPos.x;
    const deltaY = e.clientY - dragStartPos.y;

    const nextRotY = dragStartRot.y + deltaX * 0.85;
    const nextRotX = dragStartRot.x - deltaY * 0.85;

    setRotateX(nextRotX);
    setRotateY(nextRotY);

    const normX = (((nextRotY % 360) + 360) % 360) / 360 * 100;
    const normY = (((nextRotX % 360) + 360) % 360) / 360 * 100;
    setSheenPos({ x: normX, y: normY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
  };

  const handleResetRotation = () => {
    soundEffects.playClick();
    setAutoSpin(false);
    setRotateX(0);
    setRotateY(0);
    setSheenPos({ x: 50, y: 50 });
  };

  const handleFlipCard = () => {
    soundEffects.playClick();
    setAutoSpin(false);
    setRotateX(0);
    setRotateY(prev => Math.round(prev / 180) * 180 + 180);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.6 },
      colors: ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981'],
    });
  };

  const toggleAutoSpin = () => {
    soundEffects.playClick();
    setAutoSpin(prev => !prev);
  };

  const handleShare = () => {
    soundEffects.playClick();
    const url = window.location.origin;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${url} - Check out "${title}" on AniLove2!`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Touching Watch Now opens the anime details modal/page
  const handleWatchNowClick = () => {
    onClose();
    onOpenDetails(anime);
  };

  const modalContent = (
    <AnimatePresence>
      <div
        id="interactive-anime-3d-card-modal"
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/95 sm:bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-200"
        onClick={e => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Floating Pop-up Container - Direct 3D Collectible */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="relative flex flex-col items-center justify-center z-20 max-w-lg w-full pointer-events-auto my-auto py-2 px-1"
          onClick={e => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Floating Top Controls Header Pill */}
          <div className="flex items-center justify-between w-full max-w-xs sm:max-w-sm px-4 py-2 mb-3 rounded-full bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-xl text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${tier.badgeBg}`}>
                {tier.badge}
              </span>
              <span className="text-xs font-black tracking-wide truncate max-w-[120px] sm:max-w-[150px]">
                {title}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleShare}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition cursor-pointer"
                title="Share Anime Card"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/10 hover:bg-rose-500/30 text-slate-200 hover:text-rose-300 transition cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3D Rotating Canvas Viewport (Directly floating) */}
          <div
            className="relative flex items-center justify-center py-2 select-none"
            style={{ perspective: 1400 }}
          >
            {/* Card Container with Dynamic 3D Transform */}
            <div
              ref={cardRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`relative w-72 sm:w-80 h-[440px] sm:h-[480px] select-none touch-none cursor-grab active:cursor-grabbing ${
                isDragging ? '' : 'transition-transform duration-300 ease-out'
              }`}
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
              }}
            >
              {/* 🌟 FRONT FACE (0 deg) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg)',
                }}
                className={`rounded-3xl p-3.5 bg-[#0a0d16] bg-gradient-to-br ${tier.bgGradient} ${tier.borderClass} border-2 ${tier.glowClass} shadow-2xl flex flex-col justify-between overflow-hidden select-none`}
              >
                {/* Dynamic Holographic Prismatic Sheen Highlight */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-3xl opacity-40 mix-blend-color-dodge transition-opacity duration-300"
                  style={{
                    background: `radial-gradient(circle at ${sheenPos.x}% ${sheenPos.y}%, rgba(255,255,255,0.9) 0%, rgba(244,114,182,0.4) 30%, rgba(139,92,246,0.3) 50%, transparent 75%)`,
                  }}
                />

                {/* Card Front Top Header */}
                <div className="relative z-10 flex items-center justify-between pointer-events-none">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-950/90 text-[10px] font-black text-pink-300 uppercase tracking-wider border border-white/15 shadow">
                    {anime.format || 'ANIME'} • {anime.seasonYear || anime.startDate?.year || 'PREMIER'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${tier.badgeBg}`}>
                      {tier.badge}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black shadow-md flex items-center gap-1">
                      <Star className="w-3 h-3 fill-slate-950" />
                      {score ? `${score}/10` : 'TOP PICK'}
                    </span>
                  </div>
                </div>

                {/* Main Anime Poster Portrait Frame */}
                <div className="relative z-10 w-full flex-1 my-2.5 rounded-2xl overflow-hidden bg-slate-950 border border-white/20 shadow-inner pointer-events-none">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white font-bold text-sm">
                      {title}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-transparent pointer-events-none" />

                  {/* Quick Info Overlays on Poster */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 text-center pointer-events-none">
                    <h4 className="text-sm sm:text-base font-black text-white drop-shadow-md truncate">
                      {title}
                    </h4>
                    {nativeTitle && (
                      <p className="text-[10px] text-pink-300 font-medium drop-shadow truncate">
                        {nativeTitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Front Bottom Meta & Genres */}
                <div className="relative z-10 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium px-1">
                    <span className="truncate max-w-[130px] text-indigo-300 font-bold">
                      {studioName || 'Studio Master'}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {anime.episodes ? `${anime.episodes} EPISODES` : anime.status || 'RELEASED'}
                    </span>
                  </div>

                  {/* Genre Tags */}
                  {anime.genres && anime.genres.length > 0 && (
                    <div className="flex items-center gap-1 overflow-hidden pointer-events-none">
                      {anime.genres.slice(0, 3).map(g => (
                        <span
                          key={g}
                          className="px-2 py-0.5 rounded-md bg-white/10 text-white/90 text-[9px] font-semibold tracking-wide border border-white/10"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 🌟 BACK FACE (180 deg) - Completely Opaque Custom Collectible Lore Art */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
                className={`rounded-3xl p-4 bg-[#0a0d18] bg-gradient-to-br ${tier.bgGradient} ${tier.borderClass} border-2 ${tier.glowClass} shadow-2xl flex flex-col justify-between overflow-hidden select-none`}
              >
                {/* Glowing Sacred Alchemy Emblem Background */}
                <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 rounded-full border-2 border-dashed border-amber-400/60 animate-spin [animation-duration:35s]" />
                  <div className="absolute w-44 h-44 rounded-full border border-purple-400/50" />
                  <div className="absolute w-32 h-32 rotate-45 border border-pink-400/50" />
                </div>

                {/* Holographic Sheen on Back */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-3xl opacity-35 mix-blend-color-dodge"
                  style={{
                    background: `radial-gradient(circle at ${100 - sheenPos.x}% ${100 - sheenPos.y}%, rgba(255,255,255,0.85) 0%, rgba(180,150,255,0.3) 40%, transparent 70%)`,
                  }}
                />

                {/* Back Top Header */}
                <div className="relative z-10 flex items-center justify-between pointer-events-none">
                  <span className="px-2.5 py-1 rounded-md bg-slate-950/90 text-[9px] font-mono text-purple-300 font-black tracking-widest border border-purple-500/30">
                    #ANI-{anime.id}
                  </span>
                  <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${tier.badgeBg}`}>
                    {tier.badge}
                  </span>
                </div>

                {/* Back Card Title Banner */}
                <div className="relative z-10 text-center mt-1 pointer-events-none">
                  <h3 className="text-sm font-black text-white truncate px-2">
                    {title}
                  </h3>
                  {nativeTitle && (
                    <p className="text-[10px] text-pink-300 font-medium drop-shadow truncate">
                      {nativeTitle}
                    </p>
                  )}
                </div>

                {/* Center Synopsis Lore Box */}
                <div className="relative z-10 my-2 flex-1 flex flex-col bg-slate-950/90 border border-white/15 rounded-2xl p-3 overflow-hidden backdrop-blur-md shadow-inner">
                  <div className="flex items-center gap-1.5 text-pink-400 text-[11px] font-black uppercase tracking-wider mb-1 pointer-events-none">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Story Lore & Synopsis</span>
                  </div>
                  <div className="flex-1 overflow-y-auto text-xs text-slate-300 leading-relaxed scrollbar-thin pr-1 text-left select-text">
                    {cleanDescription}
                  </div>
                </div>

                {/* Statistical Matrix */}
                <div className="relative z-10 grid grid-cols-3 gap-1.5 text-center my-1 pointer-events-none">
                  <div className="p-1.5 rounded-xl bg-slate-950/90 border border-white/10">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Popularity</p>
                    <p className="text-xs font-black text-amber-300">
                      {anime.popularity ? `#${anime.popularity}` : 'Top 100'}
                    </p>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-950/90 border border-white/10">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Rating</p>
                    <p className="text-xs font-black text-pink-300">{score ? `${score}/10` : 'N/A'}</p>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-950/90 border border-white/10">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Status</p>
                    <p className="text-xs font-black text-emerald-300 truncate">
                      {anime.status || 'Finished'}
                    </p>
                  </div>
                </div>

                {/* Back Bottom Brand */}
                <div className="relative z-10 flex items-center justify-between text-[9px] text-slate-400 font-mono px-1 border-t border-white/10 pt-1.5 pointer-events-none">
                  <span>ANILOVE OFFICIAL COLLECTIBLE</span>
                  <span className="text-purple-300 font-bold">{tier.stars} {tier.tierName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Floating 3D Rotation Controls Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {/* Flip Button */}
            <button
              type="button"
              onClick={handleFlipCard}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 border border-purple-400/40 backdrop-blur-md transition active:scale-95 cursor-pointer"
              title="Flip Card 180°"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Flip Card</span>
            </button>

            {/* Auto Spin Toggle */}
            <button
              type="button"
              onClick={toggleAutoSpin}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md transition active:scale-95 cursor-pointer ${
                autoSpin
                  ? 'bg-pink-600/90 text-white border-pink-400 shadow-lg shadow-pink-600/30 animate-pulse'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-white/20 shadow-md'
              }`}
              title="Toggle 360° Auto-Spin"
            >
              <Sparkles className="w-3 h-3 text-pink-300" />
              <span>{autoSpin ? 'Spinning...' : '360° Auto-Spin'}</span>
            </button>

            {/* Reset Angle */}
            <button
              type="button"
              onClick={handleResetRotation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs border border-white/20 backdrop-blur-md shadow-md transition active:scale-95 cursor-pointer"
              title="Reset Rotation"
            >
              <Rotate3d className="w-3 h-3" />
              <span>Reset View</span>
            </button>
          </div>

          {/* Floating Action Controls Bar - Prominent Watch Now Button (Opens Details Page) */}
          <div className="flex items-center justify-center mt-3.5 w-full">
            <button
              type="button"
              onClick={handleWatchNowClick}
              className="flex items-center justify-center gap-2.5 px-8 py-2.5 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 text-white font-black text-sm shadow-xl shadow-pink-500/40 border border-pink-400/40 backdrop-blur-xl transition hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Watch Now</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
