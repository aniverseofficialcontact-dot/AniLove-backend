import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AnimeQuote,
  getTwelveHourQuote,
} from '../services/animeQuotes';
import { QUOTE_CHARACTER_IMAGES } from '../services/quoteCharacterImages';
import { getSafeCharacterImage, fetchDetailedCharacterInfo, ICONIC_CHARACTERS_POOL } from '../services/characterPool';
import { Anime } from '../types';

interface QuoteOfTheDayProps {
  onOpenAnimeDetails?: (anime: Anime) => void;
  onExploreAnimeTitle?: (title: string) => void;
}

// Guaranteed fallback portrait (Madara Uchiha high-res official portrait)
const DEFAULT_FALLBACK_IMAGE = 'https://s4.anilist.co/file/anilistcdn/character/large/b53901-HnRKSoHMG5Vg.png';

// Global memory cache for dynamically resolved character images
const resolvedCharImageCache = new Map<string, string>();

export const QuoteOfTheDay: React.FC<QuoteOfTheDayProps> = ({
  onOpenAnimeDetails,
  onExploreAnimeTitle,
}) => {
  // State driven by automatic 12-hour rotation
  const [data, setData] = useState(() => getTwelveHourQuote());
  const { quote } = data;

  const [characterImage, setCharacterImage] = useState<string>(() => {
    return (
      QUOTE_CHARACTER_IMAGES[quote.character] ||
      getSafeCharacterImage(quote.character) ||
      DEFAULT_FALLBACK_IMAGE
    );
  });

  const [hasImageError, setHasImageError] = useState<boolean>(false);

  // Check periodically for automatic 12-hour cycle rollover
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const fresh = getTwelveHourQuote();
      if (fresh.slotId !== data.slotId) {
        setData(fresh);
        setHasImageError(false);
      }
    }, 30000); // 30 seconds poll

    return () => clearInterval(checkInterval);
  }, [data.slotId]);

  // Synchronize portrait when quote changes or dynamically query AniList if needed
  useEffect(() => {
    let isMounted = true;
    setHasImageError(false);

    const resolveImage = async () => {
      const charName = quote.character;

      // 0. Use direct avatar if defined on quote
      if (quote.characterAvatar && quote.characterAvatar.startsWith('http')) {
        if (isMounted) setCharacterImage(quote.characterAvatar);
        return;
      }

      // 1. Direct match in verified 100% working CDN dictionary
      if (QUOTE_CHARACTER_IMAGES[charName]) {
        if (isMounted) setCharacterImage(QUOTE_CHARACTER_IMAGES[charName]);
        return;
      }

      // 2. Check in-memory cache
      if (resolvedCharImageCache.has(charName)) {
        if (isMounted) setCharacterImage(resolvedCharImageCache.get(charName)!);
        return;
      }

      // 3. Check iconic characters pool
      const poolMatch = ICONIC_CHARACTERS_POOL.find(
        c =>
          c.name.toLowerCase() === charName.toLowerCase() ||
          c.name.toLowerCase().includes(charName.toLowerCase()) ||
          charName.toLowerCase().includes(c.name.toLowerCase())
      );
      if (poolMatch && poolMatch.image && poolMatch.image.startsWith('http')) {
        resolvedCharImageCache.set(charName, poolMatch.image);
        if (isMounted) setCharacterImage(poolMatch.image);
        return;
      }

      // 4. Live GraphQL fetch fallback
      try {
        const details = await fetchDetailedCharacterInfo(charName);
        if (details?.image?.large || details?.image?.medium) {
          const imgUrl = details.image.large || details.image.medium || '';
          if (imgUrl) {
            resolvedCharImageCache.set(charName, imgUrl);
            if (isMounted) setCharacterImage(imgUrl);
            return;
          }
        }
      } catch (err) {
        console.warn(`Could not sync AniList photo for ${charName}:`, err);
      }

      // 5. Default fallback
      if (isMounted) {
        setCharacterImage(DEFAULT_FALLBACK_IMAGE);
      }
    };

    resolveImage();

    return () => {
      isMounted = false;
    };
  }, [quote.character, quote.id]);

  const handleClickAnime = () => {
    if (onExploreAnimeTitle) {
      onExploreAnimeTitle(quote.anime);
    }
  };

  return (
    <div
      onClick={handleClickAnime}
      className="relative w-full rounded-2xl md:rounded-3xl overflow-hidden bg-slate-900/80 hover:bg-slate-900/90 border border-purple-500/20 hover:border-purple-500/40 shadow-xl backdrop-blur-xl my-4 sm:my-6 transition-all duration-300 group cursor-pointer"
    >
      {/* Atmospheric ambient space gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-purple-950/40" />
      <div className="absolute -left-12 -top-12 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-80 h-80 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

      {/* Character Artwork Background Layer with smooth transparent gradient mask */}
      {!hasImageError && (
        <div className="absolute right-0 top-0 bottom-0 w-1/3 sm:w-1/4 max-w-[200px] pointer-events-none flex items-center justify-end overflow-hidden select-none z-10">
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-36 h-36 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
          <img
            src={characterImage}
            alt={quote.character}
            className="w-full h-full object-cover object-center filter brightness-105 contrast-105 saturate-110 transition-transform duration-700 group-hover:scale-105 pointer-events-none"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.4) 30%, black 85%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.4) 30%, black 85%)',
            }}
            referrerPolicy="no-referrer"
            onError={() => {
              if (characterImage !== DEFAULT_FALLBACK_IMAGE) {
                setCharacterImage(DEFAULT_FALLBACK_IMAGE);
              } else {
                setHasImageError(true);
              }
            }}
          />
        </div>
      )}

      {/* Top Stylized Center Title: ―――――― Quote of the day ―――――― */}
      <div className="relative z-20 flex items-center justify-center gap-3 sm:gap-4 pt-3.5 sm:pt-4 pb-1 sm:pb-2 px-4">
        <div className="h-[1px] w-12 sm:w-24 md:w-36 bg-gradient-to-r from-transparent via-purple-400/40 to-indigo-400/30" />
        <span className="text-[11px] sm:text-xs md:text-sm font-semibold tracking-widest text-indigo-200/90 font-sans">
          Quote of the day
        </span>
        <div className="h-[1px] w-12 sm:w-24 md:w-36 bg-gradient-to-l from-transparent via-purple-400/40 to-indigo-400/30" />
      </div>

      {/* Main Banner Foreground Content Area */}
      <div className="relative z-20 flex items-center px-4 sm:px-6 md:px-8 pb-4 sm:pb-5 pt-1 sm:pt-2 gap-3 sm:gap-6 min-h-[120px] sm:min-h-[140px]">
        {/* Left Glowing Neon Purple Double Quote */}
        <div className="relative flex items-center justify-center shrink-0 w-8 sm:w-12 self-center">
          <span className="relative text-3xl sm:text-4xl md:text-5xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-fuchsia-300 via-purple-400 to-indigo-400 select-none drop-shadow-[0_0_12px_rgba(192,132,252,0.6)] font-bold">
            “
          </span>
        </div>

        {/* Center Text Block: English Quote + Japanese Subtitle + Attribution Line */}
        <div className="flex-1 flex flex-col justify-center min-w-0 pr-2 sm:pr-8 md:pr-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={quote.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-1.5 sm:space-y-2"
            >
              {/* English Quote in elegant italic serif with drop shadow for crisp readability */}
              <p className="font-serif italic font-normal text-white text-sm sm:text-base md:text-lg leading-relaxed tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {quote.quote}
              </p>

              {/* Japanese Quote Subtitle */}
              {quote.japaneseQuote && (
                <p className="text-[11px] sm:text-xs md:text-sm text-indigo-200/70 tracking-widest font-sans drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {quote.japaneseQuote}
                </p>
              )}

              {/* Attribution on bottom right */}
              <div className="flex items-center justify-end gap-1.5 sm:gap-2 pt-1 sm:pt-1.5 text-[11px] sm:text-xs md:text-sm text-pink-400">
                <span className="text-pink-500/50 hidden sm:inline">――――――</span>
                <span>
                  By <strong className="text-pink-300 font-bold font-sans">"{quote.character}"</strong> from <strong className="text-purple-300 font-bold font-sans">"{quote.anime}"</strong>
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
