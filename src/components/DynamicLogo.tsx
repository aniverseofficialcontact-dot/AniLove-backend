import React, { useState } from 'react';
import { Heart, Sparkles, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DynamicLogoProps {
  isTwoWayConnected?: boolean;
  isPlaying?: boolean;
  libraryCount?: number;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const DynamicLogo: React.FC<DynamicLogoProps> = ({
  isTwoWayConnected = false,
  isPlaying = false,
  onClick,
  size = 'md',
}) => {
  // Animation active by default on load, toggles on click/touch
  const [isAnimationActive, setIsAnimationActive] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const handleToggleOrClick = (e: React.MouseEvent) => {
    // Toggle animation on/off with each touch/click
    setIsAnimationActive(prev => !prev);
    if (onClick) onClick();
  };

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';
  const isCurrentlyActive = isAnimationActive || isPlaying;

  return (
    <div
      onClick={handleToggleOrClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center gap-3 cursor-pointer select-none group relative transition-transform active:scale-95"
      title={isCurrentlyActive ? 'AniLove2 Animation Active - Touch to Pause' : 'AniLove2 Animation Paused - Touch to Play'}
      aria-label="AniLove2 Logo"
    >
      {/* Interactive Outer Glow Ring */}
      <div className="relative">
        {/* Animated Conic Glow Layer */}
        <motion.div
          animate={
            isCurrentlyActive
              ? {
                  rotate: 360,
                  scale: isHovered ? 1.2 : [1, 1.1, 1],
                  opacity: isHovered || isPlaying ? 0.95 : 0.75,
                }
              : {
                  rotate: 0,
                  scale: 1,
                  opacity: 0.35,
                }
          }
          transition={
            isCurrentlyActive
              ? {
                  rotate: { duration: isPlaying ? 3 : 5, repeat: Infinity, ease: 'linear' },
                  scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
                  opacity: { duration: 0.3 },
                }
              : { duration: 0.4 }
          }
          className={`absolute -inset-1.5 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 blur-md ${
            isPlaying ? 'from-pink-500 via-rose-500 to-amber-400' : ''
          }`}
        />

        {/* Dynamic Logo Icon Container */}
        <motion.div
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          animate={
            isCurrentlyActive
              ? {
                  scale: isHovered ? 1.08 : [1, 1.04, 1],
                  boxShadow: [
                    '0 10px 25px -5px rgba(236, 72, 153, 0.4)',
                    '0 12px 30px -4px rgba(168, 85, 247, 0.5)',
                    '0 10px 25px -5px rgba(236, 72, 153, 0.4)',
                  ],
                }
              : {
                  scale: 1,
                  boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.3)',
                }
          }
          transition={
            isCurrentlyActive
              ? {
                  scale: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
                  boxShadow: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
                }
              : { duration: 0.4 }
          }
          className={`relative rounded-xl bg-gradient-to-br from-pink-500 via-rose-500 to-violet-600 flex items-center justify-center font-black text-white border border-white/30 overflow-hidden ${
            isSmall ? 'w-8 h-8' : isLarge ? 'w-11 h-11' : 'w-9 h-9'
          }`}
        >
          {/* Subtle Inner Glass Shimmer */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/30 pointer-events-none" />

          {/* Dynamic Heart with Animated Heartbeat */}
          <motion.div
            animate={
              isCurrentlyActive
                ? {
                    scale: [1, 1.25, 1.05, 1.18, 1],
                    rotate: [0, -3, 3, -1, 0],
                  }
                : {
                    scale: 1,
                    rotate: 0,
                  }
            }
            transition={
              isCurrentlyActive
                ? {
                    duration: isPlaying ? 0.8 : 1.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
                : { duration: 0.3 }
            }
          >
            <Heart
              className={`${
                isSmall ? 'w-4 h-4' : isLarge ? 'w-5 h-5' : 'w-4.5 h-4.5'
              } text-white fill-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] transition-all duration-300 ${
                isCurrentlyActive ? 'filter drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]' : ''
              }`}
            />
          </motion.div>

          {/* Floating Sparkle Dot */}
          <AnimatePresence>
            {isCurrentlyActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0.7, 1, 0.7],
                  scale: [0.8, 1.2, 0.8],
                  rotate: [0, 180, 360],
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute top-1 right-1 pointer-events-none"
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-200" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Live Status Indicator Pip */}
        {isTwoWayConnected && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 shadow-sm shadow-emerald-400"
            title="Cloud Two-Way Sync Active"
          />
        )}
      </div>

      {/* Typography & Dynamic Badge */}
      <div>
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-lg text-white tracking-tight leading-none group-hover:text-pink-200 transition-colors">
            AniLove
            <motion.span
              animate={
                isCurrentlyActive
                  ? {
                      color: ['#ec4899', '#f43f5e', '#a855f7', '#ec4899'],
                      scale: [1, 1.1, 1],
                    }
                  : { color: '#ec4899', scale: 1 }
              }
              transition={
                isCurrentlyActive
                  ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0.3 }
              }
              className="inline-block font-black ml-0.5"
            >
              2
            </motion.span>
          </span>

          {/* Dynamic Context Badge */}
          {isPlaying ? (
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/40 flex items-center gap-1 shadow-sm"
            >
              <Activity className="w-2.5 h-2.5 animate-pulse" />
              LIVE
            </motion.span>
          ) : isTwoWayConnected ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
              SYNC
            </span>
          ) : (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-extrabold border border-pink-500/30 group-hover:bg-pink-500/30 transition-colors">
              PRO
            </span>
          )}
        </div>

        {/* Dynamic Subtitle */}
        <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5 flex items-center gap-1">
          {isPlaying ? (
            <span className="text-amber-300/90 font-semibold">Now Playing</span>
          ) : (
            <span>Stream & Sync</span>
          )}
        </p>
      </div>
    </div>
  );
};
