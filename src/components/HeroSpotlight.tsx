import React, { useState, useEffect, useRef } from 'react';
import { Play, Info, ChevronLeft, ChevronRight, Rotate3d, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Anime, UserMediaListItem } from '../types';
import { sanitizeDescription } from '../services/anilist';

interface HeroSpotlightProps {
  animeList?: Anime[];
  featuredAnime?: Anime | null;
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onQuickTrack?: (anime: Anime) => void;
  onInspect3DCard?: (anime: Anime) => void;
  onPlayThemeSong?: (anime: Anime) => void;
  userLibrary?: UserMediaListItem[];
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({
  animeList = [],
  featuredAnime,
  onOpenDetails,
  onPlayStream,
  onQuickTrack,
  onInspect3DCard,
  onPlayThemeSong,
  userLibrary = [],
}) => {
  const list = animeList.length > 0 ? animeList : featuredAnime ? [featuredAnime] : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<number>(1);

  // Swipe detection refs
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  // Helper to change slide with direction tracking
  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex(prev => (prev + newDirection + list.length) % list.length);
  };

  // Auto-advance spotlight every 7.5 seconds
  useEffect(() => {
    if (list.length <= 1) return;
    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex(prev => (prev + 1) % list.length);
    }, 7500);
    return () => clearInterval(interval);
  }, [list.length]);

  if (list.length === 0) return null;

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    touchStartX.current = clientX;
    touchEndX.current = clientX;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    touchEndX.current = clientX;
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const deltaX = touchStartX.current - touchEndX.current;
    const swipeThreshold = 45; // min 45px swipe

    if (deltaX > swipeThreshold) {
      // Swiped Left -> Next
      paginate(1);
    } else if (deltaX < -swipeThreshold) {
      // Swiped Right -> Prev
      paginate(-1);
    }
  };

  const currentAnime = list[currentIndex] || list[0];
  const title = currentAnime.title?.english || currentAnime.title?.romaji || currentAnime.title?.userPreferred || 'Featured Anime';
  const banner = currentAnime.bannerImage || currentAnime.coverImage?.extraLarge || currentAnime.coverImage?.large;
  const desc = sanitizeDescription(currentAnime.description);

  return (
    <div
      className="relative w-full overflow-hidden bg-slate-950 select-none cursor-grab active:cursor-grabbing group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
    >
      {/* Featured Spotlight Panorama Container - Extends behind transparent top navbar */}
      <div className="relative w-full min-h-[560px] sm:min-h-[620px] lg:min-h-[680px] flex items-end justify-center pb-10 sm:pb-14 pt-28 sm:pt-32 px-4 sm:px-12">
        {/* Backdrop Image with AnimatePresence transition */}
        <AnimatePresence mode="popLayout" initial={false}>
          {banner && (
            <motion.div
              key={`bg-${currentAnime.id}`}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1.0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="absolute inset-0 z-0 overflow-hidden"
            >
              <img
                src={banner}
                alt={title}
                className="w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.05] pointer-events-none select-none no-callout"
                referrerPolicy="no-referrer"
              />
              {/* Soft Cinematic Overlays - Top allows full image bleed behind navbar, bottom blends seamlessly into dark theme */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a]/70 via-transparent to-[#0f172a]/70" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-[#0f172a]/90 pointer-events-none" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left Circular Glass Arrow Button */}
        {list.length > 1 && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              paginate(-1);
            }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center backdrop-blur-xl border border-white/20 transition duration-200 shadow-xl cursor-pointer hover:scale-110 active:scale-95"
            title="Previous Slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Right Circular Glass Arrow Button */}
        {list.length > 1 && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              paginate(1);
            }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center backdrop-blur-xl border border-white/20 transition duration-200 shadow-xl cursor-pointer hover:scale-110 active:scale-95"
            title="Next Slide"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Spotlight Centered Content */}
        <div className="relative z-10 w-full max-w-3xl mx-auto text-center space-y-3 sm:space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={`content-${currentAnime.id}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="space-y-3 sm:space-y-4"
            >
              {/* Seasonal Spotlight Pill */}
              <div className="inline-block">
                <span className="px-3.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-pink-500/25 border border-pink-400/30">
                  Featured Spotlight
                </span>
              </div>

              {/* Centered Anime Title */}
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight drop-shadow-md">
                {title}
              </h1>

              {/* Centered Italicized Synopsis */}
              <p className="italic text-slate-300 text-xs sm:text-sm line-clamp-3 max-w-2xl mx-auto leading-relaxed drop-shadow px-2">
                "{desc}"
              </p>

              {/* Centered Action Buttons */}
              <div
                className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 pt-1"
                onClick={e => e.stopPropagation()}
              >
                {/* Watch Now (Crisp White Button) */}
                <button
                  id="spotlight-watch-btn"
                  onClick={() => onPlayStream(currentAnime)}
                  className="flex items-center gap-2 px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs sm:text-sm shadow-xl shadow-black/40 transition transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-900 text-slate-900" />
                  <span>Watch Now</span>
                </button>

                {/* Theme Song Audio Preview */}
                {onPlayThemeSong && (
                  <button
                    id="spotlight-ost-btn"
                    onClick={() => onPlayThemeSong(currentAnime)}
                    className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-[#00f2fe]/20 to-[#4facfe]/20 hover:from-[#00f2fe]/40 hover:to-[#4facfe]/40 text-[#66fcf1] hover:text-white font-bold text-xs sm:text-sm backdrop-blur-xl border border-[#66fcf1]/40 shadow-lg shadow-[#66fcf1]/10 transition transform hover:scale-105 active:scale-95 cursor-pointer"
                    title="Play Opening Theme Song / OST Preview"
                  >
                    <Music className="w-4 h-4 text-[#66fcf1] animate-pulse" />
                    <span>OST Preview</span>
                  </button>
                )}

                {/* 3D Showcase Card (Holographic Button) */}
                {onInspect3DCard && (
                  <button
                    id="spotlight-3d-btn"
                    onClick={() => onInspect3DCard(currentAnime)}
                    className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-pink-500/80 to-violet-600/80 hover:from-pink-500 hover:to-violet-600 text-white font-extrabold text-xs sm:text-sm backdrop-blur-xl border border-pink-400/40 shadow-lg shadow-pink-500/25 transition transform hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Rotate3d className="w-4 h-4 text-pink-200" />
                    <span>3D Card</span>
                  </button>
                )}

                {/* More Info (Frosted Glass Button) */}
                <button
                  id="spotlight-info-btn"
                  onClick={() => onOpenDetails(currentAnime)}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm backdrop-blur-xl border border-white/20 transition transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Info className="w-4 h-4 text-slate-300" />
                  <span>More Info</span>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Centered Dashed/Pill Slide Indicators */}
          {list.length > 1 && (
            <div
              className="flex items-center justify-center gap-2 pt-2 sm:pt-4"
              onClick={e => e.stopPropagation()}
            >
              {list.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDirection(idx > currentIndex ? 1 : -1);
                    setCurrentIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    currentIndex === idx
                      ? 'w-6 sm:w-8 bg-gradient-to-r from-pink-500 to-violet-600 shadow-md shadow-pink-500/50'
                      : 'w-2 sm:w-2.5 bg-white/20 hover:bg-white/40'
                  }`}
                  title={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

