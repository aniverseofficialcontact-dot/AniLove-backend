import React, { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Trophy,
  Flame,
  CheckCircle2,
  XCircle,
  ArrowRight,
  HelpCircle,
  Tv,
  Zap,
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

interface BlurGuesserProps {
  animePool: Anime[];
  onOpenDetails?: (anime: Anime) => void;
  onNavigateToShop?: () => void;
  onRefreshPool?: () => void;
}

interface GuessRound {
  target: Anime;
  options: {
    anime: Anime;
    title: string;
    isCorrect: boolean;
  }[];
}

export const BlurGuesser: React.FC<BlurGuesserProps> = ({
  animePool,
  onOpenDetails,
  onNavigateToShop,
  onRefreshPool,
}) => {
  const [currentRound, setCurrentRound] = useState<GuessRound | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [hintUsed, setHintUsed] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('anilove_blur_best_streak') || '0', 10) || 0;
    } catch {
      return 0;
    }
  });

  // Daily Economy & Limits
  const [dailyRecord, setDailyRecord] = useState(() => getDailyGameRecord('blur'));
  const [coins, setCoins] = useState<number>(() => getStoredArcadeCoins());
  const [justEarnedCoins, setJustEarnedCoins] = useState<number | null>(null);
  const [showBonusCelebration, setShowBonusCelebration] = useState<boolean>(false);
  const [sessionSeenIds, setSessionSeenIds] = useState<number[]>([]);

  // Sync state
  useEffect(() => {
    const handleStorage = () => {
      setDailyRecord(getDailyGameRecord('blur'));
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

  // Helper to extract a display title
  const getTitle = (anime: Anime): string => {
    return (
      anime.title.english ||
      anime.title.userPreferred ||
      anime.title.romaji ||
      'Anime'
    );
  };

  // Generate a new round from the anime pool ensuring fresh unique anime
  const generateNewRound = useCallback(() => {
    if (!animePool || animePool.length < 4) return;

    // Filter anime pool using persistent game freshness service
    const { freshItems } = filterFreshItems<Anime>(animePool, 'blur', 4);
    
    // Also exclude items seen in the immediate session if possible
    let availablePool: Anime[] = freshItems.filter(a => !sessionSeenIds.includes(a.id));
    if (availablePool.length < 4) {
      availablePool = freshItems.length >= 4 ? freshItems : [...animePool];
      setSessionSeenIds([]);
      // Request background refresh if fresh pool is low
      onRefreshPool?.();
    }

    // Pick random target from fresh pool
    const targetIdx = Math.floor(Math.random() * availablePool.length);
    const target = availablePool[targetIdx];
    const targetTitle = getTitle(target);

    // Persist into anti-repetition LRU storage
    recordPersistentSeenId('blur', target.id);
    setSessionSeenIds(prev => [...prev, target.id]);

    // Pick 3 random distinct distractors from entire pool
    const distractors: Anime[] = [];
    const poolCopy = animePool.filter(a => a.id !== target.id);

    while (distractors.length < 3 && poolCopy.length > 0) {
      const randIdx = Math.floor(Math.random() * poolCopy.length);
      const chosen = poolCopy.splice(randIdx, 1)[0];
      // Ensure distinct title
      if (
        !distractors.some(d => getTitle(d) === getTitle(chosen)) &&
        getTitle(chosen) !== targetTitle
      ) {
        distractors.push(chosen);
      }
    }

    // Combine and shuffle options
    const allOptions = [
      { anime: target, title: targetTitle, isCorrect: true },
      ...distractors.map(d => ({ anime: d, title: getTitle(d), isCorrect: false })),
    ];

    // Fisher-Yates shuffle
    for (let i = allOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
    }

    setCurrentRound({
      target,
      options: allOptions,
    });
    setSelectedIndex(null);
    setIsAnswered(false);
    setHintUsed(false);
    setJustEarnedCoins(null);
  }, [animePool, sessionSeenIds, onRefreshPool]);

  // Initial load
  useEffect(() => {
    if (animePool && animePool.length >= 4 && !currentRound) {
      generateNewRound();
    }
  }, [animePool, currentRound, generateNewRound]);

  // Handle option click
  const handleSelectOption = (index: number) => {
    if (isAnswered || !currentRound || dailyRecord.remaining <= 0) return;

    setSelectedIndex(index);
    setIsAnswered(true);

    const isCorrect = currentRound.options[index].isCorrect;

    // Record attempt and award coins
    const result = recordGameAttempt('blur', isCorrect);
    setDailyRecord(result.newRecord);
    setCoins(getStoredArcadeCoins());

    if (isCorrect) {
      soundEffects.playQuizCorrect();
      setJustEarnedCoins(result.coinsAwarded);

      if (result.bonusJustUnlocked) {
        setShowBonusCelebration(true);
        confetti({
          particleCount: 100,
          spread: 85,
          origin: { y: 0.5 },
          colors: ['#ec4899', '#f59e0b', '#8b5cf6', '#10b981'],
        });
      }

      const nextScore = score + (hintUsed ? 1 : 2);
      setScore(nextScore);

      const nextStreak = streak + 1;
      setStreak(nextStreak);
      if (nextStreak > bestStreak) {
        setBestStreak(nextStreak);
        try {
          localStorage.setItem('anilove_blur_best_streak', nextStreak.toString());
        } catch {
          // ignore
        }
      }

      if (nextStreak % 3 === 0) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } else {
      soundEffects.playQuizWrong();
      setStreak(0);
    }
  };

  const handleNextRound = () => {
    soundEffects.playClick();
    generateNewRound();
  };

  const handleUseHint = () => {
    if (hintUsed || isAnswered) return;
    soundEffects.playClick();
    setHintUsed(true);
  };

  if (!currentRound) {
    return (
      <div className="py-20 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-pink-500 animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Loading anime image challenge...</p>
      </div>
    );
  }

  const { target, options } = currentRound;
  const imageSrc =
    target.bannerImage ||
    target.coverImage.extraLarge ||
    target.coverImage.large ||
    target.coverImage.medium;

  const isDailyLimitReached = dailyRecord.remaining <= 0;

  return (
    <div className="space-y-6">
      {/* Top Game Bar & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/25">
            <EyeOff className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>Guess the Anime</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Blurred Visual MCQ
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              5 daily games • Earn <strong className="text-amber-300">+1 Coin</strong> per win • Score 5/5 to get <strong className="text-amber-300">6 Coins total (+1 Bonus Coin)</strong> + a 6th Game!
            </p>
          </div>
        </div>

        {/* Daily Games Remaining & Coins Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Daily Tracker */}
          <div
            className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
              dailyRecord.bonusUnlocked
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-300'
            }`}
          >
            <Gift className="w-4 h-4 text-pink-400" />
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

          {/* Streak */}
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
            className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 border border-amber-500/40 flex items-center justify-between gap-4"
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
      {isDailyLimitReached && !isAnswered && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
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

      {/* Main Game Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Blurred Image Canvas */}
        <div className="lg:col-span-7 space-y-3">
          <div className="relative rounded-3xl overflow-hidden bg-slate-950 border border-white/15 aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center group shadow-2xl">
            {/* Background image with dynamic blur filter */}
            {imageSrc && (
              <motion.img
                key={target.id}
                src={imageSrc}
                alt="Blurred mystery anime"
                className="w-full h-full object-cover select-none transition-all duration-700 ease-out"
                style={{
                  filter: isAnswered
                    ? 'blur(0px) brightness(1)'
                    : hintUsed
                    ? 'blur(5px) brightness(0.92)'
                    : 'blur(12px) brightness(0.85)',
                  transform: isAnswered ? 'scale(1)' : 'scale(1.08)',
                }}
                draggable={false}
              />
            )}

            {/* Vignette Overlay */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />

            {/* Coins Floating Banner on correct reveal */}
            {justEarnedCoins !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs shadow-2xl shadow-amber-500/40 animate-bounce"
              >
                <Coins className="w-4 h-4" />
                <span>+{justEarnedCoins} {justEarnedCoins === 1 ? 'COIN' : 'COINS'}!</span>
              </motion.div>
            )}

            {/* Mystery Badge or Unblur Banner */}
            <div className="absolute top-4 left-4 z-10">
              <AnimatePresence mode="wait">
                {!isAnswered ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/20 text-xs font-bold text-slate-200 shadow-xl"
                  >
                    <EyeOff className="w-3.5 h-3.5 text-pink-400" />
                    <span>Can you recognize this?</span>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-md border text-xs font-extrabold shadow-xl ${
                      options[selectedIndex || 0]?.isCorrect
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                        : 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                    }`}
                  >
                    {options[selectedIndex || 0]?.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>CORRECT REVEAL (+1c)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>MISSED REVEAL</span>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Hint Trigger Button */}
            {!isAnswered && !isDailyLimitReached && (
              <div className="absolute bottom-4 right-4 z-10">
                <button
                  disabled={hintUsed}
                  onClick={handleUseHint}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md border shadow-lg ${
                    hintUsed
                      ? 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-950/80 hover:bg-slate-900 border-white/20 text-amber-300 hover:text-amber-200 hover:scale-105 active:scale-95'
                  }`}
                  title={hintUsed ? 'Hint already active' : 'Partially reduce blur'}
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>{hintUsed ? 'Hint Active (-50% Blur)' : 'Use Hint (Peek)'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Genre / Info after reveal */}
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-4"
            >
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider">
                  Featured Anime
                </span>
                <h3 className="text-base font-extrabold text-white truncate max-w-sm sm:max-w-md">
                  {getTitle(target)}
                </h3>
                <p className="text-xs text-slate-400">{target.genres.slice(0, 3).join(' • ')}</p>
              </div>

              {onOpenDetails && (
                <button
                  onClick={() => onOpenDetails(target)}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/15 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Tv className="w-3.5 h-3.5 text-pink-400" />
                  <span>Details</span>
                </button>
              )}
            </motion.div>
          )}
        </div>

        {/* 4 MCQ Answer Options */}
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>Select the matching Anime:</span>
            </h3>
            <p className="text-xs text-slate-400">
              Each correct answer awards <strong className="text-amber-300">10 Arcade Coins</strong> for the card shop!
            </p>
          </div>

          <div className="space-y-2.5">
            {options.map((option, idx) => {
              const isSelected = selectedIndex === idx;
              const isCorrect = option.isCorrect;

              let btnStyle =
                'bg-slate-900/80 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-pink-500/50 hover:text-white';

              if (isAnswered) {
                if (isCorrect) {
                  btnStyle =
                    'bg-emerald-500/20 border-emerald-500/70 text-emerald-200 font-extrabold shadow-lg shadow-emerald-500/20';
                } else if (isSelected && !isCorrect) {
                  btnStyle =
                    'bg-rose-500/20 border-rose-500/70 text-rose-200 font-extrabold shadow-lg shadow-rose-500/20';
                } else {
                  btnStyle = 'bg-slate-950/50 border-slate-900 text-slate-500 opacity-40';
                }
              } else if (isDailyLimitReached) {
                btnStyle = 'bg-slate-950/50 border-slate-900 text-slate-500 opacity-50 cursor-not-allowed';
              }

              return (
                <motion.button
                  key={idx}
                  whileHover={!isAnswered && !isDailyLimitReached ? { scale: 1.01 } : {}}
                  whileTap={!isAnswered && !isDailyLimitReached ? { scale: 0.99 } : {}}
                  disabled={isAnswered || isDailyLimitReached}
                  onClick={() => handleSelectOption(idx)}
                  className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm font-semibold transition flex items-center justify-between cursor-pointer ${btnStyle}`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <span className="w-7 h-7 rounded-xl bg-white/10 text-xs font-black flex items-center justify-center shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="truncate leading-snug">{option.title}</span>
                  </div>

                  {isAnswered && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                  {isAnswered && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Next Round Button */}
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-2"
            >
              {dailyRecord.remaining > 0 ? (
                <button
                  onClick={handleNextRound}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white font-extrabold text-sm shadow-xl shadow-pink-500/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
                >
                  <span>Next Anime Challenge ({dailyRecord.remaining} left today)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-center text-slate-400">
                    Daily games completed for today!
                  </p>
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
        </div>
      </div>
    </div>
  );
};

