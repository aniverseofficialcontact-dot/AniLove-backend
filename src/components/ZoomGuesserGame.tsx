import React, { useState, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  Sparkles,
  Trophy,
  Flame,
  ChevronRight,
  ExternalLink,
  Coins,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
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

const ZOOM_ORIGINS = [
  '25% 25%',
  '50% 20%',
  '75% 25%',
  '30% 50%',
  '50% 50%',
  '70% 50%',
  '35% 75%',
  '65% 75%',
];

interface ZoomGuesserGameProps {
  animePool: Anime[];
  onOpenDetails?: (anime: Anime) => void;
  onNavigateToShop?: () => void;
  onRefreshPool?: () => void;
}

interface ZoomRound {
  target: Anime;
  distractors: Anime[];
  options: { anime: Anime; isCorrect: boolean }[];
  zoomOrigin: string;
}

export const ZoomGuesserGame: React.FC<ZoomGuesserGameProps> = ({
  animePool,
  onOpenDetails,
  onNavigateToShop,
  onRefreshPool,
}) => {
  const [currentRound, setCurrentRound] = useState<ZoomRound | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(4); // 4x (fixed until answer reveal)
  const [streak, setStreak] = useState<number>(0);
  const [highStreak, setHighStreak] = useState<number>(() => {
    return parseInt(localStorage.getItem('anilove_zoom_guesser_high_streak') || '0', 10);
  });

  // Daily attempts & Economy
  const [dailyRecord, setDailyRecord] = useState(() => getDailyGameRecord('zoom_guesser'));
  const [coins, setCoins] = useState<number>(() => getStoredArcadeCoins());
  const [justEarnedCoins, setJustEarnedCoins] = useState<number | null>(null);
  const [showBonusCelebration, setShowBonusCelebration] = useState<boolean>(false);
  const [sessionSeenIds, setSessionSeenIds] = useState<number[]>([]);

  // Sync state
  useEffect(() => {
    const handleStorage = () => {
      setDailyRecord(getDailyGameRecord('zoom_guesser'));
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

  const getTitle = (anime?: Anime | null): string => {
    if (!anime) return 'Unknown Title';
    return anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Unknown Anime';
  };

  // Generate a new round
  const generateNewRound = useCallback(() => {
    if (!animePool || animePool.length < 4) return;

    // Filter using persistent anti-repetition engine
    const { freshItems } = filterFreshItems<Anime>(animePool, 'zoom_guesser', 4);
    let pool: Anime[] = freshItems.filter(a => !sessionSeenIds.includes(Number(a.id)));

    if (pool.length < 4) {
      pool = freshItems.length >= 4 ? freshItems : [...animePool];
      setSessionSeenIds([]);
      onRefreshPool?.();
    }

    const targetIdx = Math.floor(Math.random() * pool.length);
    const target = pool[targetIdx];

    // Persist seen target
    recordPersistentSeenId('zoom_guesser', target.id);
    setSessionSeenIds(prev => [...prev, target.id]);

    // Pick 3 random distractors
    const distractors: Anime[] = [];
    const poolWithoutTarget = animePool.filter(a => a.id !== target.id);
    const shuffled = [...poolWithoutTarget].sort(() => Math.random() - 0.5);

    for (const item of shuffled) {
      if (distractors.length >= 3) break;
      if (!distractors.some(d => d.id === item.id)) {
        distractors.push(item);
      }
    }

    const options = [
      { anime: target, isCorrect: true },
      ...distractors.map(d => ({ anime: d, isCorrect: false })),
    ].sort(() => Math.random() - 0.5);

    const randomOrigin = ZOOM_ORIGINS[Math.floor(Math.random() * ZOOM_ORIGINS.length)];

    setCurrentRound({
      target,
      distractors,
      options,
      zoomOrigin: randomOrigin,
    });
    setSelectedId(null);
    setIsAnswered(false);
    setIsCorrect(null);
    setZoomLevel(4);
    setJustEarnedCoins(null);
  }, [animePool, sessionSeenIds, onRefreshPool]);

  // Initial load
  useEffect(() => {
    if (animePool.length > 0 && !currentRound) {
      generateNewRound();
    }
  }, [animePool, currentRound, generateNewRound]);

  // Handle Option Click
  const handleSelectOption = (anime: Anime, isCorrectOption: boolean) => {
    if (isAnswered || !currentRound || dailyRecord.remaining <= 0) return;

    setSelectedId(anime.id);
    setIsAnswered(true);
    setIsCorrect(isCorrectOption);
    setZoomLevel(1); // Zoom fully out to reveal full cover

    // Process daily attempt & economy
    const attemptResult = recordGameAttempt('zoom_guesser', isCorrectOption);
    setDailyRecord(attemptResult.newRecord);
    setCoins(getStoredArcadeCoins());

    if (isCorrectOption) {
      soundEffects.playQuizCorrect();
      setJustEarnedCoins(attemptResult.coinsAwarded);

      if (attemptResult.bonusJustUnlocked) {
        setShowBonusCelebration(true);
        confetti({
          particleCount: 100,
          spread: 85,
          origin: { y: 0.5 },
          colors: ['#10b981', '#14b8a6', '#f59e0b', '#ec4899'],
        });
      }

      setStreak(prev => {
        const next = prev + 1;
        if (next > highStreak) {
          setHighStreak(next);
          try {
            localStorage.setItem('anilove_zoom_guesser_high_streak', next.toString());
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <ZoomIn className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Zoom Crop Guesser</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Pixel Texture Crop
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
            <Gift className="w-4 h-4 text-emerald-400" />
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
            className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-teal-500/20 border border-amber-500/40 flex items-center justify-between gap-4"
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
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
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

      {/* Arena Stage */}
      {currentRound && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Zoomed-in Canvas Box */}
          <div className="lg:col-span-5 rounded-3xl bg-slate-900/90 border border-white/10 p-6 backdrop-blur-xl flex flex-col items-center justify-center space-y-4 shadow-2xl">
            <div className="relative w-64 h-80 sm:w-72 sm:h-96 rounded-2xl overflow-hidden border-2 border-white/20 bg-slate-950 shadow-2xl">
              {(currentRound.target.coverImage?.extraLarge || currentRound.target.coverImage?.large) && (
                <img
                  src={currentRound.target.coverImage?.extraLarge || currentRound.target.coverImage?.large}
                  alt="Anime Fragment"
                  className="w-full h-full object-cover transition-transform duration-700 ease-out select-none"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: isAnswered ? 'center center' : currentRound.zoomOrigin,
                  }}
                  draggable={false}
                />
              )}
              {/* Zoom Scale Badge */}
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 border border-white/20 text-emerald-400 text-xs font-black backdrop-blur-md">
                {isAnswered ? 'Full Artwork' : '4x Zoom'}
              </div>
            </div>

            {isAnswered && onOpenDetails && (
              <button
                onClick={() => onOpenDetails(currentRound.target)}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
              >
                <span>View Anime Details</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Multiple Choice Options */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>Select the Matching Anime Title:</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {currentRound.options.map((opt, idx) => {
                const isSelected = selectedId === opt.anime.id;
                let btnStyle = 'bg-slate-900/80 border-white/10 hover:border-emerald-500/50 hover:bg-slate-900 text-white';

                if (isAnswered) {
                  if (opt.isCorrect) {
                    btnStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40 font-bold';
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-950/60 border-rose-500 text-rose-300 ring-2 ring-rose-500/40 font-bold';
                  } else {
                    btnStyle = 'bg-slate-950/40 border-white/5 text-slate-500 opacity-60';
                  }
                }

                return (
                  <button
                    key={`${opt.anime.id}-${idx}`}
                    disabled={isAnswered || isDailyLimitReached}
                    onClick={() => handleSelectOption(opt.anime, opt.isCorrect)}
                    className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between group ${btnStyle} ${
                      !isAnswered && !isDailyLimitReached ? 'cursor-pointer hover:scale-[1.01]' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-950/80 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-sm sm:text-base font-semibold truncate">
                        {getTitle(opt.anime)}
                      </span>
                    </div>

                    {isAnswered && opt.isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    )}
                    {isAnswered && isSelected && !opt.isCorrect && (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Post-Round Actions & Rewards Banner */}
            {isAnswered && (
              <div className="p-5 rounded-3xl bg-slate-900/90 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl animate-fadeIn">
                <div className="flex items-center gap-3 text-sm">
                  {justEarnedCoins !== null && justEarnedCoins > 0 ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                      <Coins className="w-4 h-4 text-amber-400 animate-spin" />
                      <span>+{justEarnedCoins} Coins!</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">
                      {isCorrect ? 'Eagle eyes! Keep your streak climbing!' : 'Tricky crop! Try the next one!'}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    soundEffects.playClick();
                    generateNewRound();
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Next Crop</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
