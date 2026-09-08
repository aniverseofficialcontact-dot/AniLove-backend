import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Trophy,
  Flame,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Coins,
  ChevronRight,
  Sparkles,
  Zap,
  Eye,
  Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { soundEffects } from '../services/soundEffects';
import {
  getDailyGameRecord,
  recordGameAttempt,
  getStoredArcadeCoins,
} from '../services/storage';
import {
  ICONIC_CHARACTERS_POOL,
  AnimeCharacterProfile,
  getSafeCharacterImage,
  getFallbackAvatarSvg,
} from '../services/characterPool';

interface AnimeShadowGuesserProps {
  onOpenCharacterDossier?: (character: AnimeCharacterProfile) => void;
}

export const AnimeShadowGuesser: React.FC<AnimeShadowGuesserProps> = ({
  onOpenCharacterDossier,
}) => {
  const [characterPool, setCharacterPool] = useState<AnimeCharacterProfile[]>([]);
  const [targetChar, setTargetChar] = useState<AnimeCharacterProfile | null>(null);
  const [options, setOptions] = useState<AnimeCharacterProfile[]>([]);
  const [selectedOption, setSelectedOption] = useState<AnimeCharacterProfile | null>(null);
  const [revealedClues, setRevealedClues] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [dailyRecord, setDailyRecord] = useState(() => getDailyGameRecord('shadow'));
  const [coins, setCoins] = useState<number>(() => getStoredArcadeCoins());
  const [rewardNotice, setRewardNotice] = useState<string | null>(null);

  // Setup round
  const setupRound = (pool: AnimeCharacterProfile[]) => {
    if (pool.length < 4) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const target = shuffled[0];
    const choices = [target, shuffled[1], shuffled[2], shuffled[3]].sort(
      () => Math.random() - 0.5
    );

    setTargetChar(target);
    setOptions(choices);
    setSelectedOption(null);
    setRevealedClues(0);
    setRewardNotice(null);
  };

  useEffect(() => {
    const verified = ICONIC_CHARACTERS_POOL.filter(c => c.image && c.image.startsWith('http'));
    setCharacterPool(verified);
    setupRound(verified);
  }, []);

  const handleSelect = (choice: AnimeCharacterProfile) => {
    if (selectedOption !== null || !targetChar) return;
    setSelectedOption(choice);

    const isCorrect = choice.id === targetChar.id || choice.name.toLowerCase() === targetChar.name.toLowerCase();

    if (isCorrect) {
      soundEffects.playSuccess();
      const nextStreak = streak + 1;
      setStreak(nextStreak);

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#ec4899', '#f59e0b', '#3b82f6'],
      });

      if (dailyRecord.remaining > 0) {
        const res = recordGameAttempt('shadow', true);
        setDailyRecord(res.newRecord);
        setCoins(getStoredArcadeCoins());

        if (res.bonusJustUnlocked) {
          setRewardNotice('+2 Coins! (Daily 5-Win Bonus Unlocked!)');
        } else if (res.coinsAwarded > 0) {
          setRewardNotice('+1 Arcade Coin Earned!');
        }
      }
    } else {
      soundEffects.playError();
      setStreak(0);
      if (dailyRecord.remaining > 0) {
        const res = recordGameAttempt('shadow', false);
        setDailyRecord(res.newRecord);
      }
    }
  };

  const handleNext = () => {
    soundEffects.playClick();
    setupRound(characterPool);
  };

  if (!targetChar) return null;

  const isAnswered = selectedOption !== null;
  const isCorrect = isAnswered && (selectedOption.id === targetChar.id || selectedOption.name.toLowerCase() === targetChar.name.toLowerCase());

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header & Streak */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-slate-900/90 border border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-purple-500/20">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span>Shadow Silhouette Detective</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                Streak: {streak} 🔥
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Can you identify the legendary anime character from their mystery shadow?
            </p>
          </div>
        </div>

        {/* Currency status */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-white">{coins} Coins</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-300 font-bold">
            Daily Reward Games: {dailyRecord.remaining}/{dailyRecord.maxAllowed}
          </div>
        </div>
      </div>

      {/* Main Silhouette Arena */}
      <div className="relative rounded-3xl bg-slate-900/90 border border-white/15 p-6 sm:p-8 shadow-2xl space-y-6 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Silhouette Center Card */}
        <div className="relative w-52 sm:w-60 aspect-[3/4] mx-auto rounded-3xl overflow-hidden p-2 bg-slate-950 border-2 border-purple-500/30 shadow-2xl flex items-center justify-center">
          {/* Mystery aura behind silhouette */}
          <div className="absolute inset-0 bg-gradient-to-t from-purple-950 via-slate-950 to-slate-900" />

          <motion.img
            key={targetChar.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={getSafeCharacterImage(
              targetChar.name,
              targetChar.image,
              targetChar.nativeName
            )}
            alt="Mystery Character"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = getFallbackAvatarSvg(
                targetChar.name,
                targetChar.nativeName
              );
            }}
            className={`w-full h-full object-cover rounded-2xl transition-all duration-700 ${
              isAnswered
                ? 'filter-none'
                : 'brightness-0 contrast-200 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]'
            }`}
          />

          {!isAnswered && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-slate-950/80 border border-purple-500/40 text-[10px] font-black text-purple-300 backdrop-blur-md">
              ? Mystery Silhouette
            </div>
          )}
        </div>

        {/* Clue Unlock Section */}
        <div className="space-y-2 max-w-xl mx-auto">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-400">Detective Clues:</span>
            {!isAnswered && revealedClues < 2 && (
              <button
                onClick={() => {
                  soundEffects.playClick();
                  setRevealedClues(prev => prev + 1);
                }}
                className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer transition"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Reveal Clue ({2 - revealedClues} available)</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {revealedClues >= 1 || isAnswered ? (
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-purple-200">
                🎭 <strong>Role:</strong> {targetChar.role || 'Main Protagonist'}
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-950/50 border border-white/5 text-slate-500 text-center">
                🔒 Clue 1 Locked
              </div>
            )}

            {revealedClues >= 2 || isAnswered ? (
              <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200">
                🎙️ <strong>VA / Origin:</strong> {targetChar.voiceActor || 'Iconic Legend'}
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-950/50 border border-white/5 text-slate-500 text-center">
                🔒 Clue 2 Locked
              </div>
            )}
          </div>
        </div>

        {/* 4 Character Choice Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {options.map((opt) => {
            const isChosen = selectedOption?.id === opt.id;
            const isOptCorrect = opt.id === targetChar.id || opt.name.toLowerCase() === targetChar.name.toLowerCase();

            let cardStyle = 'bg-slate-950 hover:bg-slate-800 border-white/10 hover:border-purple-500/50';
            if (isAnswered) {
              if (isOptCorrect) {
                cardStyle = 'bg-emerald-900/60 border-emerald-500 text-emerald-100 font-black shadow-lg shadow-emerald-500/25';
              } else if (isChosen && !isOptCorrect) {
                cardStyle = 'bg-rose-900/60 border-rose-500 text-rose-100 font-bold';
              } else {
                cardStyle = 'bg-slate-950/40 border-white/5 opacity-50';
              }
            }

            return (
              <motion.button
                key={opt.id}
                whileHover={!isAnswered ? { scale: 1.03, y: -2 } : {}}
                whileTap={!isAnswered ? { scale: 0.97 } : {}}
                onClick={() => handleSelect(opt)}
                disabled={isAnswered}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 cursor-pointer shadow-md ${cardStyle}`}
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-white/10 shrink-0">
                  <img
                    src={getSafeCharacterImage(opt.name, opt.image, opt.nativeName)}
                    alt={opt.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-0.5 min-w-0 w-full">
                  <h5 className="text-xs font-black text-white truncate">
                    {opt.name}
                  </h5>
                  <p className="text-[10px] text-slate-400 truncate">
                    {opt.animeTitle}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Answer Reveal Bar */}
        <AnimatePresence>
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="p-5 rounded-3xl bg-slate-950/90 border border-white/15 space-y-4 shadow-xl"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className={`text-xs font-black uppercase tracking-wider block ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isCorrect ? '✨ Target Identified! Correct!' : '❌ Incorrect Detective Guess!'}
                  </span>
                  <h4 className="text-base font-black text-white">
                    {targetChar.name} — <span className="text-purple-300 font-medium">{targetChar.animeTitle}</span>
                  </h4>
                  {targetChar.quote && (
                    <p className="text-xs text-slate-400 italic">
                      "{targetChar.quote}"
                    </p>
                  )}
                  {rewardNotice && (
                    <p className="text-xs font-bold text-amber-300 animate-pulse pt-1">
                      {rewardNotice}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNext}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-purple-500/25 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Next Shadow</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
