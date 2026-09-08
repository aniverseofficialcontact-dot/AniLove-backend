import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Flame,
  Trophy,
  Sparkles,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Star,
  Swords,
  Tv,
  Coins,
  Lock,
  Gift,
  ShoppingBag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Anime } from '../types';
import { soundEffects } from '../services/soundEffects';
import {
  getDailyGameRecord,
  recordGameAttempt,
  getStoredArcadeCoins,
} from '../services/storage';
import {
  recordPersistentSeenId,
  filterFreshItems,
} from '../services/gameFreshness';

interface HigherLowerGameProps {
  animePool: Anime[];
  onOpenDetails?: (anime: Anime) => void;
  onNavigateToShop?: () => void;
  onRefreshPool?: () => void;
}

export const HigherLowerGame: React.FC<HigherLowerGameProps> = ({
  animePool,
  onOpenDetails,
  onNavigateToShop,
  onRefreshPool,
}) => {
  const [leftAnime, setLeftAnime] = useState<Anime | null>(null);
  const [rightAnime, setRightAnime] = useState<Anime | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [userGuess, setUserGuess] = useState<'higher' | 'lower' | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('anilove_hl_best_streak') || '0', 10) || 0;
    } catch {
      return 0;
    }
  });

  // Daily Economy & Limits
  const [dailyRecord, setDailyRecord] = useState(() => getDailyGameRecord('higherlower'));
  const [coins, setCoins] = useState<number>(() => getStoredArcadeCoins());
  const [justEarnedCoins, setJustEarnedCoins] = useState<number | null>(null);
  const [showBonusCelebration, setShowBonusCelebration] = useState<boolean>(false);
  const [sessionSeenIds, setSessionSeenIds] = useState<number[]>([]);

  // Sync state
  useEffect(() => {
    const handleStorage = () => {
      setDailyRecord(getDailyGameRecord('higherlower'));
      setCoins(getStoredArcadeCoins());
    };
    const handleCoinEvent = (e: CustomEvent<number>) => {
      setCoins(e.detail);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('arcade_coins_updated' as any, handleCoinEvent as any);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('arcade_coins_updated' as any, handleCoinEvent as any);
    };
  }, []);

  // Helper to extract a score formatted out of 10
  const getRating = (anime: Anime): number => {
    if (anime.averageScore) {
      return parseFloat((anime.averageScore / 10).toFixed(1));
    }
    if (anime.meanScore) {
      return parseFloat((anime.meanScore / 10).toFixed(1));
    }
    return 7.5; // fallback
  };

  const getTitle = (anime: Anime): string => {
    return (
      anime.title.english ||
      anime.title.userPreferred ||
      anime.title.romaji ||
      'Anime'
    );
  };

  // Pick a random anime from pool with valid score, prioritizing unseen
  const pickRandomAnime = useCallback(
    (excludeIds: number[]): Anime | null => {
      const scoredAnime = animePool.filter(a => a && (a.averageScore || a.meanScore));
      if (scoredAnime.length === 0) return null;

      const { freshItems } = filterFreshItems<Anime>(scoredAnime, 'higherlower', 2);
      let valid: Anime[] = freshItems.filter(
        a => !excludeIds.includes(Number(a.id)) && !sessionSeenIds.includes(Number(a.id))
      );

      if (valid.length === 0) {
        valid = freshItems.filter(a => !excludeIds.includes(Number(a.id)));
      }
      if (valid.length === 0) {
        valid = scoredAnime.filter(a => !excludeIds.includes(Number(a.id)));
      }
      if (valid.length === 0) return null;
      return valid[Math.floor(Math.random() * valid.length)];
    },
    [animePool, sessionSeenIds]
  );

  // Start fresh game
  const startNewGame = useCallback(() => {
    if (!animePool || animePool.length < 2) return;

    const first = pickRandomAnime([]);
    if (!first) return;
    const second = pickRandomAnime([first.id]);
    if (!second) return;

    // Record into persistent LRU history
    recordPersistentSeenId('higherlower', first.id);
    recordPersistentSeenId('higherlower', second.id);
    setSessionSeenIds(prev => [...prev, first.id, second.id]);

    setLeftAnime(first);
    setRightAnime(second);
    setIsRevealed(false);
    setUserGuess(null);
    setIsCorrect(null);
    setJustEarnedCoins(null);

    // If pool is running low, trigger background reload
    if (sessionSeenIds.length > 20) {
      onRefreshPool?.();
    }
  }, [animePool, pickRandomAnime, sessionSeenIds.length, onRefreshPool]);

  // Initial load
  useEffect(() => {
    if (animePool && animePool.length >= 2 && !leftAnime && !rightAnime) {
      startNewGame();
    }
  }, [animePool, leftAnime, rightAnime, startNewGame]);

  // Handle guess
  const handleGuess = (guess: 'higher' | 'lower') => {
    if (isRevealed || !leftAnime || !rightAnime || dailyRecord.remaining <= 0) return;

    setUserGuess(guess);
    setIsRevealed(true);

    const leftRating = getRating(leftAnime);
    const rightRating = getRating(rightAnime);

    const win =
      (guess === 'higher' && rightRating >= leftRating) ||
      (guess === 'lower' && rightRating <= leftRating);

    setIsCorrect(win);

    // Record attempt and award coins
    const result = recordGameAttempt('higherlower', win);
    setDailyRecord(result.newRecord);
    setCoins(getStoredArcadeCoins());

    if (win) {
      soundEffects.playQuizCorrect();
      setJustEarnedCoins(result.coinsAwarded);

      if (result.bonusJustUnlocked) {
        setShowBonusCelebration(true);
        confetti({
          particleCount: 100,
          spread: 85,
          origin: { y: 0.5 },
          colors: ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981'],
        });
      }

      const nextStreak = streak + 1;
      setStreak(nextStreak);

      if (nextStreak > bestStreak) {
        setBestStreak(nextStreak);
        try {
          localStorage.setItem('anilove_hl_best_streak', nextStreak.toString());
        } catch {
          // ignore
        }
      }

      if (nextStreak % 3 === 0) {
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    } else {
      soundEffects.playQuizWrong();
    }
  };

  // Next Round (Right becomes new Left, fresh Right chosen)
  const handleNextRound = () => {
    soundEffects.playClick();
    if (!rightAnime) return;

    const nextRight = pickRandomAnime([rightAnime.id, leftAnime?.id || 0]);
    if (!nextRight) {
      startNewGame();
      return;
    }

    setLeftAnime(rightAnime);
    setRightAnime(nextRight);
    setIsRevealed(false);
    setUserGuess(null);
    setIsCorrect(null);
    setJustEarnedCoins(null);
  };

  // Reset Game
  const handleResetGame = () => {
    soundEffects.playClick();
    setStreak(0);
    startNewGame();
  };

  if (!leftAnime || !rightAnime) {
    return (
      <div className="py-20 text-center space-y-3">
        <Sparkles className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Loading Higher vs Lower match...</p>
      </div>
    );
  }

  const leftRating = getRating(leftAnime);
  const rightRating = getRating(rightAnime);
  const isDailyLimitReached = dailyRecord.remaining <= 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Streak Tracker */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/25">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>Higher or Lower?</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Rating Battle
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              5 daily games • Earn <strong className="text-amber-300">+1 Coin</strong> per win • Score 5/5 to get a <strong className="text-amber-300">6th Bonus Game!</strong>
            </p>
          </div>
        </div>

        {/* Daily limit & stats */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Daily Tracker */}
          <div
            className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
              dailyRecord.bonusUnlocked
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-300'
            }`}
          >
            <Gift className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Daily Battles:</span>
            <span className="font-extrabold text-white">
              {dailyRecord.remaining} / {dailyRecord.maxAllowed}
            </span>
            {dailyRecord.bonusUnlocked && (
              <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-black">
                +1 Bonus!
              </span>
            )}
          </div>

          {/* Arcade Coins */}
          <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Coins:</span>
            <span className="font-extrabold text-amber-300">{coins}</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2 text-xs">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="font-extrabold text-amber-300">{streak}</span>
          </div>
        </div>
      </div>

      {/* Bonus unlocked alert */}
      <AnimatePresence>
        {showBonusCelebration && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 border border-amber-500/40 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔥</span>
              <div>
                <h4 className="text-sm font-extrabold text-white">
                  Perfect 5/5 Bonus Unlocked!
                </h4>
                <p className="text-xs text-amber-200">
                  You got all 5 comparisons right! You've unlocked the 6th bonus game today!
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowBonusCelebration(false)}
              className="px-3 py-1 rounded-xl bg-white/10 text-xs font-bold text-white hover:bg-white/20 transition cursor-pointer"
            >
              Let's Go!
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily limit reached notice banner */}
      {isDailyLimitReached && !isRevealed && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-extrabold text-white">
                Daily Limit Reached ({dailyRecord.maxAllowed}/{dailyRecord.maxAllowed} games played)
              </h4>
              <p className="text-xs text-slate-400">
                You won <strong className="text-amber-400">{dailyRecord.correct}</strong> comparisons today! Resets at midnight.
              </p>
            </div>
          </div>

          {onNavigateToShop && (
            <button
              onClick={onNavigateToShop}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer transition active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Spend Coins in Shop</span>
            </button>
          )}
        </div>
      )}

      {/* Side-by-Side Arena */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative items-stretch">
        {/* Left Anime Card (Visible Score) */}
        <div className="relative rounded-3xl overflow-hidden bg-slate-900/90 border border-white/15 p-5 sm:p-6 flex flex-col justify-between shadow-2xl group">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-10 pointer-events-none" />

          {/* Background backdrop image */}
          {(leftAnime.bannerImage || leftAnime.coverImage?.large || leftAnime.coverImage?.medium) && (
            <img
              src={leftAnime.bannerImage || leftAnime.coverImage.large || leftAnime.coverImage.medium}
              alt={getTitle(leftAnime)}
              className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-700 pointer-events-none"
            />
          )}

          <div className="relative z-20 space-y-4">
            <div className="flex items-start gap-4">
              {(leftAnime.coverImage?.large || leftAnime.coverImage?.medium) && (
                <img
                  src={leftAnime.coverImage.large || leftAnime.coverImage.medium}
                  alt={getTitle(leftAnime)}
                  className="w-20 h-28 sm:w-24 sm:h-34 object-cover rounded-2xl border border-white/20 shadow-xl shrink-0"
                />
              )}
              <div className="space-y-1 min-w-0">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Reference Title
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-white leading-tight line-clamp-2">
                  {getTitle(leftAnime)}
                </h3>
                <p className="text-xs text-slate-300 line-clamp-1">
                  {leftAnime.genres.slice(0, 3).join(' • ')}
                </p>
                <div className="text-[11px] text-slate-400 pt-1">
                  <span>{leftAnime.seasonYear || leftAnime.startDate?.year || 'Anime'}</span>
                  {leftAnime.episodes && <span> • {leftAnime.episodes} eps</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Visible Rating Box */}
          <div className="relative z-20 mt-6 pt-5 border-t border-white/10 text-center space-y-1.5 bg-slate-950/60 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Community Score
            </span>
            <div className="flex items-center justify-center gap-2">
              <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
              <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight">
                {leftRating.toFixed(1)}
              </span>
              <span className="text-sm font-bold text-slate-400 self-end pb-1">/ 10</span>
            </div>
          </div>
        </div>

        {/* VS Floating Badge */}
        <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-slate-950 border-2 border-amber-500/80 items-center justify-center text-amber-400 font-black text-xs shadow-2xl shadow-amber-500/40">
          VS
        </div>

        {/* Right Anime Card */}
        <div className="relative rounded-3xl overflow-hidden bg-slate-900/90 border border-white/15 p-5 sm:p-6 flex flex-col justify-between shadow-2xl group">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-10 pointer-events-none" />

          {/* Background backdrop image */}
          {(rightAnime.bannerImage || rightAnime.coverImage?.large || rightAnime.coverImage?.medium) && (
            <img
              src={rightAnime.bannerImage || rightAnime.coverImage.large || rightAnime.coverImage.medium}
              alt={getTitle(rightAnime)}
              className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-700 pointer-events-none"
            />
          )}

          {/* Coins Floating Banner on correct reveal */}
          {justEarnedCoins !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute top-4 right-4 z-30 flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs shadow-2xl shadow-amber-500/40 animate-bounce"
            >
              <Coins className="w-4 h-4" />
              <span>+{justEarnedCoins} {justEarnedCoins === 1 ? 'COIN' : 'COINS'}!</span>
            </motion.div>
          )}

          <div className="relative z-20 space-y-4">
            <div className="flex items-start gap-4">
              {(rightAnime.coverImage?.large || rightAnime.coverImage?.medium) && (
                <img
                  src={rightAnime.coverImage.large || rightAnime.coverImage.medium}
                  alt={getTitle(rightAnime)}
                  className="w-20 h-28 sm:w-24 sm:h-34 object-cover rounded-2xl border border-white/20 shadow-xl shrink-0"
                />
              )}
              <div className="space-y-1 min-w-0">
                <span className="text-[11px] font-bold text-pink-400 uppercase tracking-wider">
                  Challenger Title
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-white leading-tight line-clamp-2">
                  {getTitle(rightAnime)}
                </h3>
                <p className="text-xs text-slate-300 line-clamp-1">
                  {rightAnime.genres.slice(0, 3).join(' • ')}
                </p>
                <div className="text-[11px] text-slate-400 pt-1">
                  <span>{rightAnime.seasonYear || rightAnime.startDate?.year || 'Anime'}</span>
                  {rightAnime.episodes && <span> • {rightAnime.episodes} eps</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Score Box & Guess Buttons */}
          <div className="relative z-20 mt-6 pt-5 border-t border-white/10 space-y-4">
            <AnimatePresence mode="wait">
              {!isRevealed ? (
                /* Higher / Lower Buttons */
                <motion.div
                  key="guess-controls"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <p className="text-center text-xs font-bold text-slate-300">
                    Does this have a <span className="text-emerald-400">HIGHER</span> or{' '}
                    <span className="text-rose-400">LOWER</span> score?
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Higher Button */}
                    <button
                      disabled={isDailyLimitReached}
                      onClick={() => handleGuess('higher')}
                      className={`p-3.5 sm:p-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition ${
                        !isDailyLimitReached
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 cursor-pointer hover:scale-105 active:scale-95'
                          : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <ArrowUp className="w-5 h-5 stroke-[3]" />
                      <span>Higher ▲</span>
                    </button>

                    {/* Lower Button */}
                    <button
                      disabled={isDailyLimitReached}
                      onClick={() => handleGuess('lower')}
                      className={`p-3.5 sm:p-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition ${
                        !isDailyLimitReached
                          ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30 cursor-pointer hover:scale-105 active:scale-95'
                          : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <ArrowDown className="w-5 h-5 stroke-[3]" />
                      <span>Lower ▼</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* Revealed Score & Match Result */
                <motion.div
                  key="result-view"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4 text-center"
                >
                  <div
                    className={`p-4 rounded-2xl border backdrop-blur-md space-y-1 ${
                      isCorrect
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                        : 'bg-rose-500/20 border-rose-500/60 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 font-black text-xs uppercase tracking-wider">
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Correct Guess! (+10 Coins)</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-rose-400" />
                          <span>Wrong Guess!</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-1">
                      <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                      <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        {rightRating.toFixed(1)}
                      </span>
                      <span className="text-sm font-bold text-slate-300 self-end pb-1">/ 10</span>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      {rightRating >= leftRating
                        ? `Higher by +${(rightRating - leftRating).toFixed(1)} pts`
                        : `Lower by -${(leftRating - rightRating).toFixed(1)} pts`}
                    </p>
                  </div>

                  {/* Action Button */}
                  {dailyRecord.remaining > 0 ? (
                    isCorrect ? (
                      <button
                        onClick={handleNextRound}
                        className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
                      >
                        <span>Continue Battle ({dailyRecord.remaining} left today)</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={handleResetGame}
                        className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-extrabold text-sm shadow-xl shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Next Match ({dailyRecord.remaining} left today)</span>
                      </button>
                    )
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">Daily limit reached for today!</p>
                      {onNavigateToShop && (
                        <button
                          onClick={onNavigateToShop}
                          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          <span>Go to Character Card Shop</span>
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

