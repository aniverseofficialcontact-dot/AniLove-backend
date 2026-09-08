import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Dices, RotateCcw, Play, Bookmark, Star, Film, Tv, X, ExternalLink, Flame, Trophy, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Anime, UserMediaListItem, MediaListStatus, AnimeTrailer } from '../types';
import { fetchTrendingAnime, fetchTopRatedAnime, fetchGenreAnime } from '../services/anilist';
import { soundEffects } from '../services/soundEffects';

interface AnimeGachaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  userLibrary: UserMediaListItem[];
}

const GACHA_GENRES = [
  'All Genres',
  'Action',
  'Adventure',
  'Comedy',
  'Fantasy',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Supernatural',
  'Thriller',
];

export const AnimeGachaModal: React.FC<AnimeGachaModalProps> = ({
  isOpen,
  onClose,
  onOpenDetails,
  onPlayStream,
  onUpdateStatus,
  userLibrary,
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('All Genres');
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [candidatePool, setCandidatePool] = useState<Anime[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [rollCount, setRollCount] = useState<number>(0);
  const [rollAnimationIndex, setRollAnimationIndex] = useState<number>(0);

  // Load pool of anime based on genre
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadPool = async () => {
      try {
        let list: Anime[] = [];
        if (selectedGenre === 'All Genres') {
          const [top, trending] = await Promise.all([
            fetchTopRatedAnime(1, 30),
            fetchTrendingAnime(1, 30),
          ]);
          list = [...top, ...trending];
        } else {
          list = await fetchGenreAnime(selectedGenre, 'POPULARITY_DESC', 1, 40);
        }

        // Deduplicate pool
        const unique = Array.from(new Map(list.map(item => [item.id, item])).values());
        if (isMounted) {
          setCandidatePool(unique);
        }
      } catch (err) {
        console.error('Error fetching gacha pool:', err);
      }
    };

    loadPool();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedGenre]);

  const triggerGachaRoll = () => {
    if (candidatePool.length === 0 || isRolling) return;

    soundEffects.playGachaRoll();
    setIsRolling(true);
    setSelectedAnime(null);
    setRollCount(prev => prev + 1);

    // Fast cycling visual animation
    let cycles = 0;
    const maxCycles = 18;
    const interval = setInterval(() => {
      cycles++;
      const randomIdx = Math.floor(Math.random() * candidatePool.length);
      setRollAnimationIndex(randomIdx);

      if (cycles >= maxCycles) {
        clearInterval(interval);
        const finalAnime = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        setSelectedAnime(finalAnime);
        setIsRolling(false);

        // Rarity based sounds & confetti
        const score = finalAnime.averageScore || finalAnime.meanScore || 75;
        if (score >= 85) {
          soundEffects.playLegendaryReveal();
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#fbbf24', '#f59e0b', '#ec4899', '#6366f1'],
          });
        } else if (score >= 80) {
          soundEffects.playSuccess();
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#ec4899', '#eab308', '#06b6d4'],
          });
        } else {
          soundEffects.playClick();
        }
      }
    }, 90);
  };

  const getRarityBadge = (anime: Anime) => {
    const score = anime.averageScore || anime.meanScore || 70;
    if (score >= 85) {
      return {
        label: 'UR (Ultra Rare)',
        color: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/20',
        glow: 'from-amber-500/20 to-orange-500/20',
        starIcon: '🌟🌟🌟',
      };
    }
    if (score >= 80) {
      return {
        label: 'SSR (Super Special)',
        color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-indigo-500/20',
        glow: 'from-indigo-500/20 to-purple-500/20',
        starIcon: '⭐⭐⭐',
      };
    }
    if (score >= 72) {
      return {
        label: 'SR (Special Rare)',
        color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/20',
        glow: 'from-emerald-500/20 to-teal-500/20',
        starIcon: '⭐⭐',
      };
    }
    return {
      label: 'R (Rare)',
      color: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
      glow: 'from-slate-800 to-slate-900',
      starIcon: '⭐',
    };
  };

  const userLibraryEntry = selectedAnime
    ? userLibrary.find(item => item.mediaId === selectedAnime.id)
    : null;

  if (!isOpen) return null;

  const currentPreviewAnime = isRolling
    ? candidatePool[rollAnimationIndex] || candidatePool[0]
    : selectedAnime;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Dices className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>Anime Gacha & Randomizer</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    🎲 LUCKY ROLL
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Can't decide what to watch? Let destiny choose your next masterpiece!</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Genre Filter Pills */}
          <div className="px-5 pt-4 pb-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Filter Pool By Genre
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {GACHA_GENRES.map(genre => (
                <button
                  key={genre}
                  disabled={isRolling}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedGenre === genre
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 border border-slate-700/40'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Stage Area */}
          <div className="p-5 flex flex-col items-center">
            {currentPreviewAnime ? (
              <div className="w-full max-w-md bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center relative overflow-hidden group">
                {/* Background Glow */}
                <div
                  className={`absolute inset-0 bg-gradient-to-b ${
                    selectedAnime ? getRarityBadge(selectedAnime).glow : 'from-indigo-600/10 to-transparent'
                  } pointer-events-none opacity-50`}
                />

                {/* Cover Image with 3D Pop */}
                <div className="relative w-40 h-56 rounded-xl overflow-hidden shadow-2xl border border-slate-700/80 mb-4 bg-slate-900">
                  {currentPreviewAnime.coverImage?.extraLarge ||
                  currentPreviewAnime.coverImage?.large ||
                  currentPreviewAnime.coverImage?.medium ? (
                    <img
                      src={
                        currentPreviewAnime.coverImage?.extraLarge ||
                        currentPreviewAnime.coverImage?.large ||
                        currentPreviewAnime.coverImage?.medium
                      }
                      alt={currentPreviewAnime.title?.english || currentPreviewAnime.title?.romaji || 'Anime'}
                      className={`w-full h-full object-cover transition-transform duration-500 ${
                        isRolling ? 'scale-105 blur-[1px]' : 'group-hover:scale-105'
                      }`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                      Anime
                    </div>
                  )}
                  {selectedAnime && (
                    <div className="absolute top-2 right-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-black border backdrop-blur-md shadow-lg ${
                          getRarityBadge(selectedAnime).color
                        }`}
                      >
                        {getRarityBadge(selectedAnime).label.split(' ')[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="relative z-10 w-full">
                  {selectedAnime && (
                    <div className="mb-1.5 flex items-center justify-center gap-1 text-xs text-amber-400 font-bold">
                      <span>{getRarityBadge(selectedAnime).starIcon}</span>
                      <span className="text-slate-300 text-[11px]">
                        Rating: {selectedAnime.averageScore || selectedAnime.meanScore || '--'}%
                      </span>
                    </div>
                  )}

                  <h3 className="text-base font-bold text-white line-clamp-1">
                    {currentPreviewAnime.title?.english ||
                      currentPreviewAnime.title?.romaji ||
                      currentPreviewAnime.title?.userPreferred ||
                      'Selecting anime...'}
                  </h3>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                    {currentPreviewAnime.format && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {currentPreviewAnime.format}
                      </span>
                    )}
                    {currentPreviewAnime.episodes && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {currentPreviewAnime.episodes} eps
                      </span>
                    )}
                    {(currentPreviewAnime.genres || []).slice(0, 2).map(g => (
                      <span
                        key={g}
                        className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      >
                        {g}
                      </span>
                    ))}
                  </div>

                  {/* Actions when Rolled */}
                  {selectedAnime && !isRolling && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-2 w-full">
                      <button
                        onClick={() => {
                          onPlayStream(selectedAnime);
                          onClose();
                        }}
                        className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Watch Episode 1</span>
                      </button>

                      <button
                        onClick={() => {
                          onOpenDetails(selectedAnime);
                          onClose();
                        }}
                        className="flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>

                      <button
                        onClick={() =>
                          onUpdateStatus(
                            selectedAnime,
                            userLibraryEntry?.status === 'PLANNING' ? 'CURRENT' : 'PLANNING'
                          )
                        }
                        className={`flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          userLibraryEntry
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>{userLibraryEntry ? userLibraryEntry.status : '+ Plan to Watch'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md py-12 px-4 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-center">
                <Dices className="w-12 h-12 text-indigo-400 mb-3 animate-bounce" />
                <h4 className="text-sm font-bold text-white mb-1">Ready for the Gacha Roll?</h4>
                <p className="text-xs text-slate-400 max-w-xs">
                  Click the button below to randomly pull a critically-acclaimed anime from our database!
                </p>
              </div>
            )}

            {/* Roll Trigger Button */}
            <div className="w-full mt-5 flex items-center gap-3">
              <button
                disabled={isRolling || candidatePool.length === 0}
                onClick={triggerGachaRoll}
                className="flex-1 py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:opacity-95 text-white font-black text-sm tracking-wide shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Dices className={`w-5 h-5 ${isRolling ? 'animate-spin' : ''}`} />
                <span>
                  {isRolling
                    ? 'ROLLING DESTINY...'
                    : selectedAnime
                    ? 'REROLL AGAIN 🎲'
                    : 'SPIN ANIME GACHA 🎲'}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
