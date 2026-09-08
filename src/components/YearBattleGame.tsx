import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Sparkles,
  Trophy,
  Flame,
  ChevronRight,
  ExternalLink,
  Coins,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
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

interface YearBattleGameProps {
  animePool: Anime[];
  onOpenDetails?: (anime: Anime) => void;
  onNavigateToShop?: () => void;
  onRefreshPool?: () => void;
}

export const YearBattleGame: React.FC<YearBattleGameProps> = ({
  animePool,
  onOpenDetails,
  onNavigateToShop,
  onRefreshPool,
}) => {
  const [leftAnime, setLeftAnime] = useState<Anime | null>(null);
  const [rightAnime, setRightAnime] = useState<Anime | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [selectedSide, setSelectedSide] = useState<'left' | 'right' | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [highStreak, setHighStreak] = useState<number>(() => {
    return parseInt(localStorage.getItem('anilove_year_battle_high_streak') || '0', 10);
  });

  // Daily attempts & Economy
  const [dailyRecord, setDailyRecord] = useState(() => getDailyGameRecord('year_battle'));
  const [coins, setCoins] = useState<number>(() => getStoredArcadeCoins());
  const [justEarnedCoins, setJustEarnedCoins] = useState<number | null>(null);
  const [showBonusCelebration, setShowBonusCelebration] = useState<boolean>(false);
  const [sessionSeenIds, setSessionSeenIds] = useState<number[]>([]);

  // Sync state
  useEffect(() => {
    const handleStorage = () => {
      setDailyRecord(getDailyGameRecord('year_battle'));
      setCoins(getStoredArcadeCoins());
    };
    const handleCoinUpdate = (e: CustomEvent<number>) => {
      setCoins(e.detail);
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('arcade_coins_updated' as any, handleCoinUpdate as any);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('arcade_coins_updated' as any, handleCoinUpdate as any);
    };
  }, []);

  const getAnimeYear = (anime?: Anime | null): number => {
    if (!anime) return 0;
    return anime.startDate?.year || anime.seasonYear || 0;
  };

  const getTitle = (anime?: Anime | null): string => {
    if (!anime) return 'Unknown Title';
    return anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Unknown Anime';
  };

  // Pick a random anime from pool with valid release year
  const pickRandomAnime = useCallback(
    (excludeIds: number[]): Anime | null => {
      const yearAnime = animePool.filter(a => a && getAnimeYear(a) > 1960);
      if (yearAnime.length === 0) return null;

      const { freshItems } = filterFreshItems<Anime>(yearAnime, 'year_battle', 2);
      let valid: Anime[] = freshItems.filter(
        a => !excludeIds.includes(Number(a.id)) && !sessionSeenIds.includes(Number(a.id))
      );

      if (valid.length === 0) {
        valid = freshItems.filter(a => !excludeIds.includes(Number(a.id)));
      }
      if (valid.length === 0) {
        valid = yearAnime.filter(a => !excludeIds.includes(Number(a.id)));
      }
      if (valid.length === 0) return null;
      return valid[Math.floor(Math.random() * valid.length)];
    },
    [animePool, sessionSeenIds]
  );

  // Start fresh game round
  const startNewDuel = useCallback(() => {
    if (!animePool || animePool.length < 2) return;

    const first = pickRandomAnime([]);
    if (!first) return;

    // Pick second anime ensuring distinct years for a definitive answer
    let second = pickRandomAnime([first.id]);
    let attempts = 0;
    while (second && getAnimeYear(second) === getAnimeYear(first) && attempts < 10) {
      second = pickRandomAnime([first.id]);
      attempts++;
    }

    if (!second) return;

    // Record into persistent LRU history
    recordPersistentSeenId('year_battle', first.id);
    recordPersistentSeenId('year_battle', second.id);
    setSessionSeenIds(prev => [...prev, first.id, second.id]);

    setLeftAnime(first);
    setRightAnime(second);
    setIsRevealed(false);
    setSelectedSide(null);
    setIsCorrect(null);
    setJustEarnedCoins(null);

    if (sessionSeenIds.length > 20) {
      onRefreshPool?.();
    }
  }, [animePool, pickRandomAnime, sessionSeenIds.length, onRefreshPool]);

  // Initial load
  useEffect(() => {
    if (animePool.length > 0 && !leftAnime) {
      startNewDuel();
    }
  }, [animePool, leftAnime, startNewDuel]);

  // Handle Player Guess ("Which Came First?")
  const handleChoice = (side: 'left' | 'right') => {
    if (isRevealed || !leftAnime || !rightAnime || dailyRecord.remaining <= 0) return;

    setSelectedSide(side);
    setIsRevealed(true);

    const leftYear = getAnimeYear(leftAnime);
    const rightYear = getAnimeYear(rightAnime);

    // Correct if chosen anime was released in an earlier (or equal) year
    const correct = side === 'left' ? leftYear <= rightYear : rightYear <= leftYear;
    setIsCorrect(correct);

    // Process daily attempt & economy
    const attemptResult = recordGameAttempt('year_battle', correct);
    setDailyRecord(attemptResult.newRecord);
    setCoins(getStoredArcadeCoins());

    if (correct) {
      soundEffects.playQuizCorrect();
      setJustEarnedCoins(attemptResult.coinsAwarded);

      if (attemptResult.bonusJustUnlocked) {
        setShowBonusCelebration(true);
        confetti({
          particleCount: 100,
          spread: 85,
          origin: { y: 0.5 },
          colors: ['#6366f1', '#06b6d4', '#f59e0b', '#10b981'],
        });
      }

      setStreak(prev => {
        const next = prev + 1;
        if (next > highStreak) {
          setHighStreak(next);
          try {
            localStorage.setItem('anilove_year_battle_high_streak', next.toString());
          } catch {
            // ignore
          }
        }
        return next;
      });
    } else {
      soundEffects.playQuizWrong();
      setStreak(0);
    }
  };

  const isDailyLimitReached = dailyRecord.remaining <= 0;

  return (
    <div className="space-y-6">
      {/* Top Game Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Release Year Battle</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Which Came First?
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              5 daily games • Earn <strong className="text-amber-300">+1 Coin</strong> per win • Score 5/5 to get <strong className="text-amber-300">6 Coins total (+1 Bonus Coin)</strong> + a 6th Game!
            </p>
          </div>
        </div>

        {/* Stats & Economy */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Daily Tracker */}
          <div
            className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
              dailyRecord.bonusUnlocked
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-300'
            }`}
          >
            <Gift className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-400">Daily Games:</span>
            <span className="font-extrabold text-white">
              {dailyRecord.remaining} / {dailyRecord.maxAllowed}
            </span>
            {dailyRecord.bonusUnlocked && (
              <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-black">
                +1 Bonus Game!
              </span>
            )}
          </div>

          {/* Arcade Coins */}
          <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Coins:</span>
            <span className="font-extrabold text-amber-300">{coins}</span>
          </div>

          {/* Current Streak */}
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2 text-xs">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="font-extrabold text-amber-300">{streak}</span>
          </div>

          {/* High Streak */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-slate-400">Best:</span>
            <span className="font-bold text-yellow-400">{highStreak}</span>
          </div>
        </div>
      </div>

      {/* Bonus Celebration Banner */}
      <AnimatePresence>
        {showBonusCelebration && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-purple-500/20 border border-amber-500/40 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <h4 className="text-sm font-extrabold text-white">
                  Perfect 5/5 Bonus Unlocked!
                </h4>
                <p className="text-xs text-amber-200">
                  You scored 5/5 correct answers! You received a <strong>Bonus Coin (6 Coins total)</strong> and unlocked a <strong>6th Bonus Game</strong> today!
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowBonusCelebration(false)}
              className="px-3 py-1 rounded-xl bg-white/10 text-xs font-bold text-white hover:bg-white/20 transition cursor-pointer"
            >
              Awesome!
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily limit reached notice banner */}
      {isDailyLimitReached && !isRevealed && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-extrabold text-white">
                Daily Limit Reached ({dailyRecord.maxAllowed}/{dailyRecord.maxAllowed} games played)
              </h4>
              <p className="text-xs text-slate-400">
                You scored <strong className="text-emerald-400">{dailyRecord.correct}</strong> correct answers today! Daily allowance resets at midnight.
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

      {/* Dual Arena Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
        {/* VS Badge in Center */}
        <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-slate-950 border-2 border-indigo-500/60 shadow-xl items-center justify-center font-black text-xs text-indigo-300">
          VS
        </div>

        {/* LEFT ANIME */}
        <div
          onClick={() => !isRevealed && !isDailyLimitReached && handleChoice('left')}
          className={`relative rounded-3xl overflow-hidden border p-5 transition-all duration-300 flex flex-col justify-between group ${
            !isRevealed
              ? !isDailyLimitReached
                ? 'bg-slate-900/90 border-white/10 hover:border-indigo-500/60 hover:scale-[1.01] cursor-pointer shadow-xl'
                : 'bg-slate-900/90 border-white/10 opacity-75 cursor-default'
              : selectedSide === 'left'
              ? isCorrect
                ? 'bg-emerald-950/40 border-emerald-500/80 ring-2 ring-emerald-500/40 shadow-emerald-950/50 shadow-2xl'
                : 'bg-rose-950/40 border-rose-500/80 ring-2 ring-rose-500/40 shadow-rose-950/50 shadow-2xl'
              : 'bg-slate-900/80 border-white/10'
          }`}
        >
          {/* Top Info */}
          <div className="flex gap-4">
            <div className="w-24 sm:w-28 h-36 sm:h-40 rounded-2xl overflow-hidden shrink-0 border border-white/10 bg-slate-950 shadow-md">
              {(leftAnime?.coverImage?.large || leftAnime?.coverImage?.medium) && (
                <img
                  src={leftAnime?.coverImage?.large || leftAnime?.coverImage?.medium}
                  alt={getTitle(leftAnime)}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Option A
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white line-clamp-2">
                {getTitle(leftAnime)}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-2">
                {leftAnime?.genres?.slice(0, 3).join(' • ') || 'Anime'}
              </p>
              {onOpenDetails && leftAnime && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(leftAnime);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1 cursor-pointer"
                >
                  <span>View Details</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Year Display / Selection Button */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
            {isRevealed ? (
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-slate-950/80 border border-white/10">
                  <span className="text-xs text-slate-400 block">Premiered</span>
                  <span className="text-xl font-extrabold text-indigo-300">
                    {getAnimeYear(leftAnime) || 'Unknown'}
                  </span>
                </div>
                {selectedSide === 'left' && (
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {isCorrect ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Correct Choice!
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Not earlier
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                disabled={isDailyLimitReached}
                onClick={(e) => {
                  e.stopPropagation();
                  handleChoice('left');
                }}
                className={`w-full py-3 rounded-2xl font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 ${
                  !isDailyLimitReached
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>Aired Earlier</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* RIGHT ANIME */}
        <div
          onClick={() => !isRevealed && !isDailyLimitReached && handleChoice('right')}
          className={`relative rounded-3xl overflow-hidden border p-5 transition-all duration-300 flex flex-col justify-between group ${
            !isRevealed
              ? !isDailyLimitReached
                ? 'bg-slate-900/90 border-white/10 hover:border-cyan-500/60 hover:scale-[1.01] cursor-pointer shadow-xl'
                : 'bg-slate-900/90 border-white/10 opacity-75 cursor-default'
              : selectedSide === 'right'
              ? isCorrect
                ? 'bg-emerald-950/40 border-emerald-500/80 ring-2 ring-emerald-500/40 shadow-emerald-950/50 shadow-2xl'
                : 'bg-rose-950/40 border-rose-500/80 ring-2 ring-rose-500/40 shadow-rose-950/50 shadow-2xl'
              : 'bg-slate-900/80 border-white/10'
          }`}
        >
          {/* Top Info */}
          <div className="flex gap-4">
            <div className="w-24 sm:w-28 h-36 sm:h-40 rounded-2xl overflow-hidden shrink-0 border border-white/10 bg-slate-950 shadow-md">
              {(rightAnime?.coverImage?.large || rightAnime?.coverImage?.medium) && (
                <img
                  src={rightAnime?.coverImage?.large || rightAnime?.coverImage?.medium}
                  alt={getTitle(rightAnime)}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Option B
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white line-clamp-2">
                {getTitle(rightAnime)}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-2">
                {rightAnime?.genres?.slice(0, 3).join(' • ') || 'Anime'}
              </p>
              {onOpenDetails && rightAnime && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(rightAnime);
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-1 cursor-pointer"
                >
                  <span>View Details</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Year Display / Selection Button */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
            {isRevealed ? (
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-slate-950/80 border border-white/10">
                  <span className="text-xs text-slate-400 block">Premiered</span>
                  <span className="text-xl font-extrabold text-cyan-300">
                    {getAnimeYear(rightAnime) || 'Unknown'}
                  </span>
                </div>
                {selectedSide === 'right' && (
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {isCorrect ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Correct Choice!
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Not earlier
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                disabled={isDailyLimitReached}
                onClick={(e) => {
                  e.stopPropagation();
                  handleChoice('right');
                }}
                className={`w-full py-3 rounded-2xl font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 ${
                  !isDailyLimitReached
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>Aired Earlier</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Post-Round Actions & Rewards Banner */}
      {isRevealed && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl animate-fadeIn">
          <div className="flex items-center gap-3 text-sm">
            {justEarnedCoins !== null && justEarnedCoins > 0 ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                <Coins className="w-4 h-4 text-amber-400 animate-spin" />
                <span>+{justEarnedCoins} Coins Earned!</span>
              </div>
            ) : (
              <span className="text-slate-400">
                {isCorrect ? 'Well played! Keep your streak alive!' : 'Nice try! Study your release timeline!'}
              </span>
            )}
          </div>

          <button
            onClick={() => {
              soundEffects.playClick();
              startNewDuel();
            }}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Next Duel</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
