import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, MessageSquare, X, Heart, Star, Flame, Trophy, Move } from 'lucide-react';
import confetti from 'canvas-confetti';
import { GachaCard } from '../types';
import { getStoredActiveCompanion, getCardAwakeningLevel } from '../services/storage';
import { getSafeCharacterImage, getFallbackAvatarSvg } from '../services/characterPool';
import { soundEffects } from '../services/soundEffects';

const COMPANION_CHEERS = [
  "Ganbatte! Keep exploring amazing anime today! ✨",
  "Your anime journey is just beginning! Ready for the next adventure?",
  "I'm cheering for you! Let's win some coins in the Arcade! 🎮",
  "Did you know? Every quest gives you summon coins!",
  "Believe in the me that believes in you! 🌟",
  "Stay awesome and enjoy every single episode!",
  "Power level is over 9000 today! 🔥",
  "Whatever happens, happens... but we'll enjoy the ride!"
];

export const ChibiCompanionWidget: React.FC = () => {
  const [companion, setCompanion] = useState<GachaCard | null>(() => getStoredActiveCompanion());
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [clickCount, setClickCount] = useState(0);

  // Listen for storage / custom event when companion is changed in Card Modal
  useEffect(() => {
    const handleCompanionUpdate = () => {
      setCompanion(getStoredActiveCompanion());
    };

    window.addEventListener('companion-updated', handleCompanionUpdate);
    window.addEventListener('storage', handleCompanionUpdate);

    return () => {
      window.removeEventListener('companion-updated', handleCompanionUpdate);
      window.removeEventListener('storage', handleCompanionUpdate);
    };
  }, []);

  if (!companion) return null;

  const awakeningLevel = getCardAwakeningLevel(companion.id);

  const handleCompanionClick = () => {
    soundEffects.playClick();
    const nextCount = clickCount + 1;
    setClickCount(nextCount);

    if (nextCount % 5 === 0) {
      soundEffects.playQuizCorrect();
      confetti({ particleCount: 40, spread: 50, origin: { x: 0.9, y: 0.85 } });
    }

    const randomCheer = companion.quote && Math.random() > 0.4
      ? `"${companion.quote}"`
      : COMPANION_CHEERS[Math.floor(Math.random() * COMPANION_CHEERS.length)];
    
    setSpeechBubble(randomCheer);

    // Auto-clear speech bubble after 5 seconds
    setTimeout(() => {
      setSpeechBubble(null);
    }, 5000);
  };

  const getAuraClass = () => {
    switch (awakeningLevel) {
      case 2:
        return 'ring-2 ring-purple-400 shadow-purple-500/40 shadow-lg';
      case 3:
        return 'ring-2 ring-amber-400 shadow-amber-500/50 shadow-xl';
      case 4:
        return 'ring-3 ring-pink-400 shadow-pink-500/60 shadow-2xl animate-pulse';
      default:
        return 'ring-1 ring-white/20 shadow-lg';
    }
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.1}
      whileDrag={{ scale: 1.12, cursor: 'grabbing' }}
      className="fixed bottom-28 sm:bottom-24 right-4 sm:right-6 z-40 flex flex-col items-end cursor-grab touch-none pointer-events-auto"
    >
      {/* Speech Bubble */}
      <AnimatePresence>
        {speechBubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            className="mb-2 max-w-[220px] p-3 rounded-2xl bg-slate-900/95 border border-purple-500/40 backdrop-blur-xl text-slate-100 text-xs shadow-2xl relative"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSpeechBubble(null);
              }}
              className="absolute top-1.5 right-1.5 p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="font-extrabold text-[10px] text-purple-300 pb-0.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{companion.characterName}</span>
            </div>
            <p className="text-[11px] leading-snug italic text-slate-200">{speechBubble}</p>
            {/* Arrow */}
            <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-slate-900 border-r border-b border-purple-500/40 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Companion Avatar Button */}
      <motion.div
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.92 }}
        className="relative group"
        onClick={handleCompanionClick}
      >
        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-slate-950 p-0.5 transition-all ${getAuraClass()}`}>
          <img
            src={getSafeCharacterImage(
              companion.characterName,
              companion.characterImage || companion.imageUrl,
              companion.characterNativeName
            )}
            alt={companion.characterName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = getFallbackAvatarSvg(
                companion.characterName,
                companion.characterNativeName
              );
            }}
            className="w-full h-full object-cover rounded-full pointer-events-none select-none"
          />
        </div>

        {/* Awakening Tier Badge */}
        {awakeningLevel > 1 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-[9px] flex items-center justify-center shadow-md">
            ★{awakeningLevel}
          </div>
        )}

        {/* Move Handle Icon */}
        <div className="absolute -bottom-1 -left-1 p-1 rounded-full bg-slate-900/90 border border-white/20 text-slate-400 opacity-60 group-hover:opacity-100 transition shadow">
          <Move className="w-2.5 h-2.5" />
        </div>
      </motion.div>
    </motion.div>
  );
};
