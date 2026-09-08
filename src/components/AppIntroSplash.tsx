import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { soundEffects } from '../services/soundEffects';

interface AppIntroSplashProps {
  isDataReady?: boolean;
  onFinish: () => void;
  soundEnabled?: boolean;
  minDuration?: number;
}

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  maxAlpha: number;
  pulseSpeed: number;
  phase: number;
  isPetal?: boolean;
  rotation?: number;
  rotSpeed?: number;
}

export const AppIntroSplash: React.FC<AppIntroSplashProps> = ({
  onFinish,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const hasTriggeredSoundRef = useRef<boolean>(false);
  const isFinishedRef = useRef<boolean>(false);
  const phaseRef = useRef<number>(0);

  const [phase, setPhase] = useState<number>(0);

  const completeIntro = useCallback(() => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    soundEffects.stopAniLoveCinematicIntro();
    // Remove scroll lock
    document.body.style.overflow = '';
    onFinish();
  }, [onFinish]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      soundEffects.stopAniLoveCinematicIntro();
    };
  }, []);

  // Lock body scroll while splash is active
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Audio trigger on mount: SOUND IS ALWAYS AND UNCONDITIONALLY ON BY DEFAULT
  useEffect(() => {
    // Immediately play the cinematic intro from beginning
    if (!hasTriggeredSoundRef.current) {
      hasTriggeredSoundRef.current = true;
      soundEffects.playAniLoveCinematicIntro(0);
    }

    // Immediately attempt to resume the AudioContext (works immediately if browser allows unmuted autoplay)
    soundEffects.resumeAudio().catch(() => {});

    // Passive unlock listener: ANY click, tap, touch, key, or interaction anywhere on the screen ensures audio plays
    const unlockEvents = ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'];
    const unlockHandler = async () => {
      await soundEffects.resumeAudio();
      if (soundEffects.isAudioRunning()) {
        unlockEvents.forEach((evt) => {
          window.removeEventListener(evt, unlockHandler, true);
          document.removeEventListener(evt, unlockHandler, true);
        });
      }
    };

    unlockEvents.forEach((evt) => {
      window.addEventListener(evt, unlockHandler, { capture: true, passive: true });
      document.addEventListener(evt, unlockHandler, { capture: true, passive: true });
    });

    return () => {
      unlockEvents.forEach((evt) => {
        window.removeEventListener(evt, unlockHandler, true);
        document.removeEventListener(evt, unlockHandler, true);
      });
    };
  }, []);

  // Keyboard shortcut to skip (Escape or Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        completeIntro();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [completeIntro]);

  // Optimized Canvas for Smooth Ambient Particles & Sakura Petals (Zero frame-drop)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = ['#ff2a85', '#f43f5e', '#ec4899', '#c026d3', '#a855f7', '#818cf8'];

    // Pre-allocated particles array for zero GC thrashing (optimized count for 60-120fps)
    const particles: AmbientParticle[] = [];
    const count = 34;

    for (let i = 0; i < count; i++) {
      const isPetal = i % 4 === 0;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8 + (isPetal ? 0.3 : 0),
        vy: isPetal ? 0.6 + Math.random() * 0.9 : (Math.random() - 0.5) * 0.6,
        size: isPetal ? 4 + Math.random() * 5 : 1.2 + Math.random() * 2.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.1,
        maxAlpha: isPetal ? 0.55 + Math.random() * 0.35 : 0.4 + Math.random() * 0.4,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        phase: Math.random() * Math.PI * 2,
        isPetal,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04,
      });
    }

    startTimeRef.current = performance.now();

    const TOTAL_DURATION = 6.95; // seconds

    const render = (time: number) => {
      const elapsed = (time - startTimeRef.current) / 1000;
      const progress = Math.min(elapsed / TOTAL_DURATION, 1);

      // Directly update progress bar DOM transform - bypasses React re-render thrashing
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${progress})`;
      }

      // Determine animation phase
      let currentPhase = 0;
      if (elapsed < 0.8) currentPhase = 0;
      else if (elapsed < 1.7) currentPhase = 1;
      else if (elapsed < 2.3) currentPhase = 2;
      else if (elapsed < 3.7) currentPhase = 3;
      else if (elapsed < 4.5) currentPhase = 4;
      else if (elapsed < 5.4) currentPhase = 5;
      else if (elapsed < 6.3) currentPhase = 6;
      else currentPhase = 7;

      // Only trigger React state re-render when phase threshold actually changes (just 7 times total)
      if (phaseRef.current !== currentPhase) {
        phaseRef.current = currentPhase;
        setPhase(currentPhase);
      }

      // Clear canvas with deep dark purple tint
      ctx.clearRect(0, 0, width, height);

      // Render drifting particles and sakura petals
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Update positions
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around screen boundaries
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        p.phase += p.pulseSpeed;
        const pulse = (Math.sin(p.phase) + 1) / 2;
        const currentAlpha = p.alpha + pulse * (p.maxAlpha - p.alpha);

        // Petal shape or spherical light mote
        if (p.isPetal && p.rotation !== undefined && p.rotSpeed !== undefined) {
          p.rotation += p.rotSpeed;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = currentAlpha * (elapsed > 6.3 ? (7.0 - elapsed) / 0.7 : 1);

          // Draw delicate sakura petal ellipse
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = currentAlpha * (elapsed > 6.3 ? (7.0 - elapsed) / 0.7 : 1);
          ctx.fill();
        }
      }

      // Finish at 7.0 seconds
      if (elapsed >= TOTAL_DURATION) {
        completeIntro();
        return;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [completeIntro]);

  return (
    <div
      id="anilove-cinematic-intro-root"
      onPointerDown={() => {
        soundEffects.resumeAudio().catch(() => {});
      }}
      onClick={() => {
        soundEffects.resumeAudio().catch(() => {});
      }}
      className="fixed inset-0 w-screen h-screen min-h-[100dvh] z-[9999999] bg-[#020005] select-none overflow-hidden flex items-center justify-center pointer-events-auto"
    >
      {/* Background Volumetric Glow Nebulas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Central Ambient Halo (GPU native radial gradients for locked 60/120fps) */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[540px] md:w-[680px] h-[340px] sm:h-[540px] md:h-[680px] rounded-full transition-all duration-700 pointer-events-none will-change-transform ${
            phase >= 1 && phase <= 2
              ? 'bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.35)_0%,rgba(192,38,211,0.2)_45%,transparent_70%)] scale-110 opacity-90'
              : phase >= 3 && phase <= 4
              ? 'bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.25)_0%,rgba(147,51,234,0.2)_50%,transparent_70%)] scale-125 opacity-75'
              : phase >= 5 && phase <= 6
              ? 'bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.3)_0%,rgba(168,85,247,0.25)_45%,transparent_70%)] scale-100 opacity-85'
              : 'bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.15)_0%,transparent_60%)] scale-80 opacity-40'
          }`}
        />

        {/* Soft Vignette Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,#010004_100%)]" />
      </div>

      {/* Floating Canvas for Particles & Sakura Petals */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none z-10"
      />

      {/* Main Cinematic Viewport Stage (16:9 responsive frame with subtle cinematic camera push) */}
      <div className="relative w-full max-w-5xl h-full flex flex-col items-center justify-center z-20 px-4">
        {/* ====================================================================== */}
        {/* STAGE 1: Glowing Heart Formation (0.0s - 2.0s)                        */}
        {/* ====================================================================== */}
        <AnimatePresence>
          {(phase === 0 || phase === 1) && (
            <motion.div
              key="stage-heart-formation"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{
                opacity: phase === 0 ? 0.7 : 1,
                scale: phase === 1 ? 1.05 : 0.95,
              }}
              exit={{
                opacity: 0,
                scale: 0.45,
                transition: { duration: 0.35, ease: 'easeIn' },
              }}
              className="absolute flex flex-col items-center justify-center pointer-events-none will-change-transform"
            >
              {/* Swirling energy light streaks surrounding the heart */}
              <div className="relative w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center">
                {/* Outer Swirling Violet Energy Ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-full border border-pink-500/30 border-t-pink-400 border-r-purple-500 shadow-[0_0_18px_rgba(236,72,153,0.35)] will-change-transform"
                />

                {/* Counter Swirling Magenta Ring */}
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-3 rounded-full border border-purple-500/30 border-b-fuchsia-400 border-l-pink-500 shadow-[0_0_16px_rgba(168,85,247,0.25)] will-change-transform"
                />

                {/* Glowing SVG Heart Shape drawing itself in mid-air (Hardware-accelerated, zero feGaussianBlur stutter) */}
                <svg viewBox="0 0 200 200" className="w-44 h-44 sm:w-56 sm:h-56 filter drop-shadow-[0_0_20px_rgba(255,42,133,0.7)] will-change-transform">
                  <defs>
                    <linearGradient id="heart-stroke-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff2a85" />
                      <stop offset="35%" stopColor="#f43f5e" />
                      <stop offset="70%" stopColor="#c026d3" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>

                  {/* Faint Glowing Under-Path */}
                  <path
                    d="M 100 50 C 80 18, 32 25, 30 75 C 28 118, 72 152, 100 176 C 128 152, 172 118, 170 75 C 168 25, 120 18, 100 50 Z"
                    fill="none"
                    stroke="#ff2a85"
                    strokeWidth="10"
                    opacity="0.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Animated Drawing Path */}
                  <motion.path
                    d="M 100 50 C 80 18, 32 25, 30 75 C 28 118, 72 152, 100 176 C 128 152, 172 118, 170 75 C 168 25, 120 18, 100 50 Z"
                    fill="none"
                    stroke="url(#heart-stroke-grad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{
                      pathLength: phase === 1 ? 1 : 0.45,
                      opacity: 1,
                    }}
                    transition={{
                      pathLength: { duration: 1.4, ease: [0.16, 1, 0.3, 1] },
                      opacity: { duration: 0.5 },
                    }}
                  />

                  {/* Inner Heart Core Fill Pulse */}
                  {phase === 1 && (
                    <motion.path
                      d="M 100 50 C 80 18, 32 25, 30 75 C 28 118, 72 152, 100 176 C 128 152, 172 118, 170 75 C 168 25, 120 18, 100 50 Z"
                      fill="url(#heart-stroke-grad)"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 0.35, scale: 1 }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  )}
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====================================================================== */}
        {/* STAGE 2: Heart Collapses -> AniLove Logo Appears (1.7s - 2.5s)        */}
        {/* ====================================================================== */}
        <AnimatePresence>
          {phase === 2 && (
            <motion.div
              key="stage-logo-burst"
              initial={{ scale: 0.35, opacity: 0 }}
              animate={{
                scale: [0.35, 1.12, 1.0],
                opacity: 1,
              }}
              exit={{
                scale: 1.2,
                opacity: 0,
                transition: { duration: 0.45, ease: 'easeInOut' },
              }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="absolute flex flex-col items-center justify-center pointer-events-none will-change-transform"
            >
              {/* Radiating Shockwave Ring */}
              <motion.div
                initial={{ scale: 0.4, opacity: 1 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
                className="absolute w-56 h-56 rounded-[34%] border-2 border-pink-400 shadow-[0_0_40px_#ff2a85]"
              />

              {/* Swirling Light Streaks */}
              <motion.div
                animate={{ rotate: 180 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute -inset-10 rounded-full border border-pink-500/40 border-t-white shadow-[0_0_30px_#ec4899]"
              />

              {/* Exact AniLove Squircle Brandmark */}
              <div className="relative w-40 h-40 sm:w-48 sm:h-48 drop-shadow-[0_0_45px_rgba(255,42,133,0.7)]">
                <AniLoveLogoSvg />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====================================================================== */}
        {/* STAGE 3: Transition to Cinematic Anime Scene (2.3s - 3.7s)            */}
        {/* ====================================================================== */}
        <AnimatePresence>
          {(phase === 3 || phase === 4) && (
            <motion.div
              key="stage-anime-scene"
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{
                opacity: phase === 4 ? 0.35 : 1,
                scale: 1.0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                filter: 'blur(8px)',
                transition: { duration: 0.5, ease: 'easeInOut' },
              }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-2 sm:inset-6 md:inset-10 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(236,72,153,0.35)] border border-pink-500/30 flex items-center justify-center pointer-events-none"
            >
              {/* Anime Image with Parallax Pan / Zoom */}
              <motion.img
                src="/assets/anime_sunset_city.jpg"
                alt="AniLove Anime Cinematic Scene"
                initial={{ scale: 1.15, y: 15 }}
                animate={{ scale: 1.03, y: -10 }}
                transition={{ duration: 2.2, ease: 'easeOut' }}
                className="w-full h-full object-cover object-center"
              />

              {/* Volumetric Twilight Sunset Atmosphere Filter */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#020005] via-pink-950/20 to-indigo-950/30 mix-blend-multiply pointer-events-none" />

              {/* Anime Light Vignette & Edge Glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#020005_95%)] pointer-events-none" />

              {/* Floating Glowing Embers over Anime Scene */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute bottom-10 left-1/4 w-2 h-2 rounded-full bg-pink-400 blur-[1px] animate-pulse" />
                <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 rounded-full bg-amber-300 blur-[1px] animate-pulse" />
                <div className="absolute bottom-1/3 right-1/3 w-2 h-2 rounded-full bg-purple-300 blur-[1px] animate-pulse" />
              </div>

              {/* Mini Ghosted Logo in Sky (Matching Storyboard Panel 7) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 0.9, scale: 0.8 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 sm:w-36 sm:h-36 drop-shadow-[0_0_35px_rgba(255,42,133,0.85)] pointer-events-none"
              >
                <AniLoveLogoSvg />
              </motion.div>

              {/* Pink-Purple Sweeping Energy Trail Across Anime Scene (Phase 4: 3.7s - 4.5s) */}
              {phase === 4 && (
                <motion.div
                  initial={{ x: '-120%', opacity: 0 }}
                  animate={{ x: '160%', opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                  className="absolute inset-y-0 w-48 sm:w-72 bg-gradient-to-r from-transparent via-pink-500/80 to-purple-600/80 skew-x-[-25deg] blur-md shadow-[0_0_60px_#ff2a85] pointer-events-none"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====================================================================== */}
        {/* STAGE 4: Final Logo & Typography Assembly (4.5s - 7.0s)                */}
        {/* ====================================================================== */}
        <AnimatePresence>
          {phase >= 5 && (
            <motion.div
              key="stage-final-logo-reveal"
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{
                opacity: phase === 7 ? 0 : 1, // Gentle fade out to black in final 0.7s
                scale: phase === 6 ? [1.0, 1.03, 1.0] : 1.0, // Subtle glow pulse at 6.3s
                y: 0,
              }}
              transition={{
                opacity: { duration: phase === 7 ? 0.65 : 0.6, ease: 'easeInOut' },
                scale: { duration: 0.9, ease: 'easeInOut' },
                y: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
              }}
              className="flex flex-col items-center justify-center z-30 pointer-events-none"
            >
              {/* Completed AniLove Logo Squircle */}
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 drop-shadow-[0_0_50px_rgba(255,42,133,0.7)] flex items-center justify-center">
                {/* Soft Radiant Neon Rim Glow */}
                <div
                  className="absolute inset-0 rounded-[28%] pointer-events-none"
                  style={{
                    boxShadow:
                      '0 0 35px rgba(255, 42, 133, 0.7), 0 0 70px rgba(168, 85, 247, 0.45), inset 0 0 16px rgba(255, 255, 255, 0.25)',
                  }}
                />

                <AniLoveLogoSvg />
              </div>

              {/* "AniLove" Typography Reveal (4.5s - 5.4s) */}
              <motion.div
                initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="mt-5 sm:mt-6 flex items-baseline tracking-tight font-black"
              >
                {/* "Ani" - Crisp Clean White */}
                <span className="text-4xl sm:text-5xl md:text-6xl text-white font-extrabold tracking-tight drop-shadow-[0_2px_18px_rgba(255,255,255,0.4)]">
                  Ani
                </span>
                {/* "Love" - Pink-to-Purple Luminous Gradient */}
                <span
                  className="text-4xl sm:text-5xl md:text-6xl font-black bg-gradient-to-r from-[#ff2a85] via-[#ec4899] to-[#a855f7] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(236,72,153,0.6)]"
                  style={{ WebkitTextFillColor: 'transparent' }}
                >
                  Love
                </span>
              </motion.div>

              {/* Tagline: "Anime • Community • Love" (Storyboard Panel 8 & 10) */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.6, ease: 'easeOut' }}
                className="mt-2.5 sm:mt-3 flex items-center gap-2 text-xs sm:text-sm tracking-[0.25em] uppercase font-bold text-pink-200/80"
              >
                <span>Anime</span>
                <span className="text-pink-500 font-black">•</span>
                <span>Community</span>
                <span className="text-purple-500 font-black">•</span>
                <span>Love</span>
              </motion.div>

              {/* Glossy Floor Horizon Reflection (Matching Panels 10 & 11) */}
              <div className="relative w-48 sm:w-64 h-8 overflow-hidden pointer-events-none mt-3 opacity-30">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[1.5px] bg-gradient-to-r from-transparent via-pink-400 to-transparent shadow-[0_0_12px_#ff2a85]" />
                <div
                  className="w-full h-full scale-y-[-1] blur-[2px]"
                  style={{
                    maskImage: 'linear-gradient(to top, transparent, black)',
                    WebkitMaskImage: 'linear-gradient(to top, transparent, black)',
                  }}
                >
                  <div className="text-sm font-black text-center text-pink-400/50">AniLove</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Top Right Controls: Skip Button */}
      <div className="absolute top-5 right-5 z-40 flex items-center gap-2">
        {/* Modern Minimal Skip Button */}
        <button
          type="button"
          data-skip-intro="true"
          onClick={(e) => {
            e.stopPropagation();
            completeIntro();
          }}
          className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white text-xs font-semibold backdrop-blur-md border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
          title="Skip intro animation"
        >
          <span>Skip</span>
          <span className="text-[10px] text-white/50 hidden sm:inline">[Esc]</span>
        </button>
      </div>

      {/* Subtle Bottom Progress Indicator (Hardware-accelerated scaleX, zero layout reflows) */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 z-40 pointer-events-none">
        <div
          ref={progressBarRef}
          className="h-full w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 origin-left will-change-transform"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>
    </div>
  );
};

// Pure, exact AniLove Squircle Brandmark (Preserving exact colors, proportions & white heart)
const AniLoveLogoSvg: React.FC = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <defs>
      {/* Brand Gradient: Vibrant Top-Left Pink/Magenta to Bottom-Right Violet/Purple */}
      <linearGradient id="intro-anilove-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ff2a85" />
        <stop offset="26%" stopColor="#f43f5e" />
        <stop offset="55%" stopColor="#c026d3" />
        <stop offset="82%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>

      {/* Inner Specular Rim Highlight */}
      <linearGradient id="intro-anilove-rim-specular" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
        <stop offset="40%" stopColor="#ffffff" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
      </linearGradient>
    </defs>

    {/* Squircle (27% Corner Radius = rx="52" on 200x200) */}
    <rect
      x="10"
      y="10"
      width="180"
      height="180"
      rx="52"
      fill="url(#intro-anilove-logo-grad)"
    />

    {/* Top Rim Specular Highlight */}
    <rect
      x="11"
      y="11"
      width="178"
      height="178"
      rx="51"
      fill="none"
      stroke="url(#intro-anilove-rim-specular)"
      strokeWidth="2"
      className="opacity-80"
    />

    {/* Solid Pristine White Heart Symbol */}
    <path
      d="M 100,74 C 93,56 68,52 56,69 C 41,88 51,114 100,144 C 149,114 159,88 144,69 C 132,52 107,56 100,74 Z"
      fill="#ffffff"
      className="drop-shadow-[0_2px_12px_rgba(255,255,255,0.85)]"
    />
  </svg>
);
