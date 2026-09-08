import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bookmark,
  Play,
  Pause,
  Shuffle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Share2,
  Maximize2,
  Minimize2,
  Film,
  RotateCw,
  Download,
  Check,
  Crop,
  Heart,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnimeReel } from '../types';
import {
  fetchAllReels,
  fetchReelById,
  getBundledReels,
  getStoredSavedReels,
  toggleSaveReel,
  syncReelsFromGoogleDrive,
  preloadReels,
  getStartingReelsFeed,
  saveStoredReelsSession,
  clearReelsSession
} from '../services/reelsService';
import { reelMediaCache } from '../services/reelMediaCache';
import { reelDeckManager, recordReelAsWatched } from '../services/reelRandomizer';

interface ReelsViewProps {
  onBack?: () => void;
  onNavigateToAccount?: () => void;
  onShowToast: (type: 'success' | 'info' | 'error' | 'sync', message: string, title?: string) => void;
  initialReelId?: string;
  initialFilterMode?: 'all' | 'saved';
  refreshTrigger?: number;
  onShareToDm?: (reel: AnimeReel) => void;
}

// Set to track already preloaded thumbnail images
const preloadedThumbnailCache = new Set<string>();

export const ReelsView: React.FC<ReelsViewProps> = ({
  onBack,
  onNavigateToAccount,
  onShowToast,
  initialReelId,
  initialFilterMode,
  refreshTrigger,
  onShareToDm,
}) => {
  const [allReels, setAllReels] = useState<AnimeReel[]>(() => getBundledReels(false));
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>(() => {
    const saved = getStoredSavedReels();
    const map: Record<string, boolean> = {};
    saved.forEach(r => { if (r?.id) map[r.id] = true; });
    return map;
  });
  const [filterMode, setFilterMode] = useState<'all' | 'saved'>(() => {
    if (initialFilterMode) return initialFilterMode;
    const session = getStartingReelsFeed(initialReelId, initialFilterMode);
    return session.filterMode || 'all';
  });
  const [feedHistory, setFeedHistory] = useState<AnimeReel[]>(() => {
    const session = getStartingReelsFeed(initialReelId, initialFilterMode);
    return session.feed;
  });
  const [historyIndex, setHistoryIndex] = useState<number>(() => {
    const session = getStartingReelsFeed(initialReelId, initialFilterMode);
    return session.index;
  });
  const [slideDirection, setSlideDirection] = useState<number>(1); // 1 = slide down (next), -1 = slide up (prev)
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayPauseFeedback, setShowPlayPauseFeedback] = useState<'play' | 'pause' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFrameRendered, setIsFrameRendered] = useState(false);

  // Landscape vs Portrait Detection & Fit Mode ('contain' | 'cover')
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(9 / 16);
  const [aspectFitMode, setAspectFitMode] = useState<'contain' | 'cover'>('contain');

  // Drag Gesture Physics State for real-time tracking
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Helper to reliably get the active video element across slide transitions
  const getActiveVideo = useCallback((): HTMLVideoElement | null => {
    if (videoRef.current && typeof videoRef.current.play === 'function') {
      return videoRef.current;
    }
    const el = document.getElementById('active-reel-video') as HTMLVideoElement | null;
    if (el) {
      videoRef.current = el;
      return el;
    }
    return null;
  }, []);

  // Preloader element reference
  const preloaderRef = useRef<HTMLVideoElement>(null);

  // Tap & Gesture references
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTouchTimeRef = useRef<number>(0);
  const lastWheelTimeRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const hasMovedSignificantRef = useRef<boolean>(false);
  const isManuallyPausedRef = useRef<boolean>(false);
  const hasUnlockedAudioRef = useRef<boolean>(false);

  // Synchronize Saved Status from localStorage
  const refreshSavedMap = useCallback(() => {
    const saved = getStoredSavedReels();
    const map: Record<string, boolean> = {};
    saved.forEach(r => {
      if (r && r.id) map[r.id] = true;
    });
    setSavedStatus(map);
  }, []);

  useEffect(() => {
    refreshSavedMap();
    window.addEventListener('anilove-saved-reels-updated', refreshSavedMap);
    return () => window.removeEventListener('anilove-saved-reels-updated', refreshSavedMap);
  }, [refreshSavedMap]);

  // Helper: Pick a truly balanced, non-repeating reel using multi-drive stratified distribution
  const pickRandomReel = useCallback((pool: AnimeReel[], excludeIds: string[] = []): AnimeReel | null => {
    if (!pool || pool.length === 0) return null;
    if (filterMode === 'saved') {
      const candidates = pool.filter(r => !excludeIds.includes(r.id));
      const selectionPool = candidates.length > 0 ? candidates : pool;
      const randIdx = Math.floor(Math.random() * selectionPool.length);
      return selectionPool[randIdx];
    }
    return reelDeckManager.pickNextReel(pool, excludeIds);
  }, [filterMode]);

  // Filter pool by saved mode
  const currentPool = React.useMemo(() => {
    if (filterMode === 'saved') {
      return getStoredSavedReels();
    }
    return allReels;
  }, [allReels, filterMode, savedStatus]);

  // Initialize or reset feed history with pre-queued upcoming reels for instant playback
  const initializeFeed = useCallback((pool: AnimeReel[], startReelId?: string, mode?: 'all' | 'saved') => {
    const effectiveMode = mode || filterMode;
    if (!pool || pool.length === 0) {
      setFeedHistory([]);
      setHistoryIndex(0);
      return;
    }

    if (effectiveMode === 'saved') {
      let targetIdx = 0;
      if (startReelId) {
        const found = pool.findIndex(r => r.id === startReelId);
        if (found >= 0) targetIdx = found;
      }
      setFeedHistory(pool);
      setHistoryIndex(targetIdx);
      const active = pool[targetIdx];
      if (active) {
        reelMediaCache.preloadReel(active.id);
        preloadReels(pool.map(r => r.id));
      }
      return;
    }

    let initialReel: AnimeReel | null = null;
    if (startReelId) {
      initialReel = pool.find(r => r.id === startReelId) || null;
    }
    if (!initialReel) {
      initialReel = reelDeckManager.pickNextReel(pool, []);
    }

    if (initialReel) {
      // Build an initial queue with current reel + next 3 stratified reels
      const queue: AnimeReel[] = [initialReel];
      const upcoming = reelDeckManager.drawNextReels(pool, 3, [initialReel.id]);
      queue.push(...upcoming);

      setFeedHistory(queue);
      setHistoryIndex(0);

      // Immediately preload starting reel
      reelMediaCache.preloadReel(initialReel.id);

      // Pre-warm server buffer cache and download upcoming reels in background
      const toWarm = queue.map(r => r.id);
      preloadReels(toWarm);
    }
  }, [filterMode]);

  // Initial Load on mount (Update from API in background while instantly displaying bundled reels)
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        // If an explicit initialReelId was requested, enrich it from server in parallel
        if (initialReelId) {
          fetchReelById(initialReelId).then(reel => {
            if (reel && isMounted) {
              setFeedHistory(prev => prev.map(item => {
                if (item.id === reel.id || item.id.toLowerCase() === reel.id.toLowerCase()) {
                  return { ...item, ...reel };
                }
                return item;
              }));
            }
          }).catch(() => {});
        }

        const data = await fetchAllReels(true);
        if (!isMounted) return;

        if (data && data.length > 0) {
          setAllReels(data);
          // If in all mode and feed history is currently empty, initialize it now
          if (filterMode === 'all') {
            setFeedHistory(prev => {
              if (prev.length === 0) {
                const q = data.slice(0, 4);
                preloadReels(q.map(r => r.id));
                return q;
              }
              return prev;
            });
          }
        }
      } catch {
        // silent fallback to bundled
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [initialReelId, filterMode]);

  // Keep latest history and index in refs so we can safely persist on unmount
  const feedHistoryRef = useRef(feedHistory);
  const historyIndexRef = useRef(historyIndex);
  const filterModeRef = useRef(filterMode);

  useEffect(() => {
    feedHistoryRef.current = feedHistory;
    historyIndexRef.current = historyIndex;
    filterModeRef.current = filterMode;
  }, [feedHistory, historyIndex, filterMode]);

  // Save active session (feed sequence, current index, and filter mode)
  useEffect(() => {
    if (feedHistory.length > 0) {
      saveStoredReelsSession({
        feedHistory,
        historyIndex,
        lastWatchedReelId: feedHistory[historyIndex]?.id,
        filterMode,
      });
    }
  }, [feedHistory, historyIndex, filterMode]);

  // Guarantee session is saved when unmounting (e.g. user navigated to another tab)
  useEffect(() => {
    return () => {
      if (feedHistoryRef.current.length > 0) {
        const idx = Math.max(0, Math.min(historyIndexRef.current, feedHistoryRef.current.length - 1));
        const currentItem = feedHistoryRef.current[idx];
        saveStoredReelsSession({
          feedHistory: feedHistoryRef.current,
          historyIndex: idx,
          lastWatchedReelId: currentItem?.id,
          filterMode: filterModeRef.current,
        });
      }
    };
  }, []);

  // Handle explicit initialReelId or initialFilterMode prop changes smoothly
  const prevInitialReelIdRef = useRef<string | undefined>(initialReelId);
  const prevInitialFilterModeRef = useRef<'all' | 'saved' | undefined>(initialFilterMode);

  useEffect(() => {
    const reelChanged = initialReelId !== undefined && initialReelId !== prevInitialReelIdRef.current;
    const modeChanged = initialFilterMode !== undefined && initialFilterMode !== prevInitialFilterModeRef.current;

    if (reelChanged || modeChanged) {
      prevInitialReelIdRef.current = initialReelId;
      prevInitialFilterModeRef.current = initialFilterMode;
      const targetMode = initialFilterMode || (initialReelId ? 'all' : undefined);
      const session = getStartingReelsFeed(initialReelId, targetMode);
      if (targetMode) setFilterMode(targetMode);
      setFeedHistory(session.feed);
      setHistoryIndex(session.index);
    }
  }, [initialReelId, initialFilterMode]);

  // Maintain upcoming preloaded reels ahead of the current position in All mode
  useEffect(() => {
    if (filterMode === 'saved' || currentPool.length === 0) return;
    const remainingAhead = feedHistory.length - 1 - historyIndex;
    if (remainingAhead < 3) {
      const needed = 3 - remainingAhead;
      const excludeIds = feedHistory.map(r => r.id);
      const newItems = reelDeckManager.drawNextReels(currentPool, needed, excludeIds);
      if (newItems.length > 0) {
        setFeedHistory(prev => [...prev, ...newItems]);
      }
    }
  }, [historyIndex, feedHistory.length, currentPool, filterMode]);

  // Current active reel & upcoming preloaded reels in the pipeline
  const currentReel = feedHistory[historyIndex] || null;
  const nextReel1 = feedHistory[historyIndex + 1] || null;
  const nextReel2 = feedHistory[historyIndex + 2] || null;
  const nextReel3 = feedHistory[historyIndex + 3] || null;

  // Proactively record active reel in persistent watched history
  useEffect(() => {
    if (currentReel?.id) {
      recordReelAsWatched(currentReel.id);
    }
  }, [currentReel?.id]);

  // Proactively warm in-memory media cache for active reel
  useEffect(() => {
    if (!currentReel?.id) return;
    reelMediaCache.preloadReel(currentReel.id, 'high');
  }, [currentReel?.id]);

  // Keep browser address bar in sync with current active reel (/reel/:id)
  useEffect(() => {
    if (currentReel?.id && typeof window !== 'undefined') {
      try {
        const cleanPath = `/reel/${encodeURIComponent(currentReel.id)}`;
        if (window.location.pathname !== cleanPath) {
          window.history.replaceState(null, '', cleanPath);
        }
      } catch {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'reels');
          url.searchParams.set('reel', currentReel.id);
          window.history.replaceState(null, '', url.toString());
        } catch {}
      }
    }
  }, [currentReel?.id]);

  // Proactively warm and buffer the active reel and the NEXT 2-3 reels in the background
  useEffect(() => {
    if (!currentReel) return;
    const idsToPreload = [
      currentReel.id,
      nextReel1?.id,
      nextReel2?.id,
      nextReel3?.id
    ].filter(Boolean) as string[];

    preloadReels(idsToPreload);

    // Proactively preload thumbnail poster images once for zero-black-screen instant display
    for (const id of idsToPreload) {
      if (!preloadedThumbnailCache.has(id)) {
        preloadedThumbnailCache.add(id);
        const img = new Image();
        img.src = `/api/reels/thumbnail/${id}`;
      }
    }
  }, [historyIndex, currentReel?.id, nextReel1?.id, nextReel2?.id, nextReel3?.id]);

  // Reset frame rendered flag on reel change to show poster instantly
  useEffect(() => {
    setIsFrameRendered(false);
  }, [currentReel?.id, historyIndex]);

  // Auto-play and reset video whenever historyIndex or currentReel changes (Sound is ALWAYS ON - never muted)
  useEffect(() => {
    isManuallyPausedRef.current = false;
    const video = getActiveVideo();
    if (!video || !currentReel) return;

    // Sound is ALWAYS active and unmuted
    video.muted = false;
    video.volume = 1.0;
    video.currentTime = 0;
    setProgress(0);
    setCurrentTime(0);

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch(() => {
          // If browser policy holds unmuted playback pending first user gesture,
          // pause and wait for user's tap with full sound - NEVER mute!
          setIsPlaying(false);
          setIsBuffering(false);
        });
    }
  }, [historyIndex, currentReel, getActiveVideo]);

  // One-time user gesture listener to unlock unmuted audio if browser policy held initial autoplay
  useEffect(() => {
    const unlockAudio = () => {
      hasUnlockedAudioRef.current = true;
      const v = getActiveVideo();
      if (v) {
        v.muted = false;
        v.volume = 1.0;
        // Only trigger play if user hasn't explicitly paused the video!
        if (v.paused && !isManuallyPausedRef.current) {
          v.play()
            .then(() => {
              setIsPlaying(true);
            })
            .catch(() => {});
        }
      }
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('touchend', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { passive: true, once: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
    window.addEventListener('touchend', unlockAudio, { passive: true, once: true });
    window.addEventListener('pointerdown', unlockAudio, { passive: true, once: true });
    window.addEventListener('keydown', unlockAudio, { passive: true, once: true });

    return cleanup;
  }, [getActiveVideo]);

  // Navigation: Go to NEXT reel
  const goToNext = useCallback(() => {
    if (currentPool.length === 0) return;
    isManuallyPausedRef.current = false;
    setSlideDirection(1);
    setDragOffsetY(0);
    setIsDragging(false);

    if (filterMode === 'saved') {
      if (historyIndex < feedHistory.length - 1) {
        setHistoryIndex(prev => prev + 1);
      } else if (feedHistory.length > 1) {
        // Reached end of saved list: loop back to beginning of saved reels!
        setHistoryIndex(0);
      }
      return;
    }

    if (historyIndex < feedHistory.length - 1) {
      // User previously went back, so step forward in the existing historical sequence!
      setHistoryIndex(prev => prev + 1);
    } else {
      // At the tip of history: pick a fresh random reel from the pool!
      const exclude = feedHistory.slice(-20).map(r => r.id);
      const nextRandom = pickRandomReel(currentPool, exclude);
      if (nextRandom) {
        setFeedHistory(prev => [...prev, nextRandom]);
        setHistoryIndex(prev => prev + 1);
      }
    }
  }, [currentPool, feedHistory, historyIndex, filterMode, pickRandomReel]);

  // Navigation: Go to PREVIOUS reel
  const goToPrev = useCallback(() => {
    isManuallyPausedRef.current = false;
    if (filterMode === 'saved') {
      if (historyIndex > 0) {
        setSlideDirection(-1);
        setDragOffsetY(0);
        setIsDragging(false);
        setHistoryIndex(prev => prev - 1);
      } else if (feedHistory.length > 1) {
        // At top of saved list: wrap to the end of saved reels
        setSlideDirection(-1);
        setDragOffsetY(0);
        setIsDragging(false);
        setHistoryIndex(feedHistory.length - 1);
      } else {
        setDragOffsetY(0);
        setIsDragging(false);
      }
      return;
    }

    if (historyIndex > 0) {
      setSlideDirection(-1);
      setDragOffsetY(0);
      setIsDragging(false);
      setHistoryIndex(prev => prev - 1);
    } else {
      // Reached top of session history
      setDragOffsetY(0);
      setIsDragging(false);
    }
  }, [historyIndex, filterMode, feedHistory.length]);

  // Shuffle / Reset Session to a fresh random reel
  const shuffleReel = useCallback(() => {
    if (currentPool.length <= 1) return;
    isManuallyPausedRef.current = false;
    setSlideDirection(1);
    if (filterMode === 'saved') {
      const otherIndices = feedHistory.map((_, i) => i).filter(i => i !== historyIndex);
      if (otherIndices.length > 0) {
        const nextIdx = otherIndices[Math.floor(Math.random() * otherIndices.length)];
        setHistoryIndex(nextIdx);
        saveStoredReelsSession({
          feedHistory,
          historyIndex: nextIdx,
          lastWatchedReelId: feedHistory[nextIdx]?.id,
          filterMode: 'saved',
        });
      }
      return;
    }
    // Reshuffle the deck across all drives and draw 4 fresh, non-repeating reels
    reelDeckManager.ensureDeck(currentPool, true);
    const newQueue = reelDeckManager.drawNextReels(currentPool, 4, [currentReel?.id || '']);
    if (newQueue.length > 0) {
      setFeedHistory(newQueue);
      setHistoryIndex(0);
      setDragOffsetY(0);
      setIsPlaying(true);
      preloadReels(newQueue.map(r => r.id));
      reelMediaCache.preloadReel(newQueue[0].id, 'high');
      saveStoredReelsSession({
        feedHistory: newQueue,
        historyIndex: 0,
        lastWatchedReelId: newQueue[0].id,
        filterMode: 'all',
      });
    }
  }, [currentPool, currentReel?.id, filterMode, feedHistory, historyIndex]);

  // Handle external refresh trigger (e.g. user tapped Reels tab while already on Reels)
  const prevRefreshTriggerRef = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger !== undefined && prevRefreshTriggerRef.current !== undefined && refreshTrigger !== prevRefreshTriggerRef.current) {
      prevRefreshTriggerRef.current = refreshTrigger;
      shuffleReel();
    } else if (refreshTrigger !== undefined) {
      prevRefreshTriggerRef.current = refreshTrigger;
    }
  }, [refreshTrigger, shuffleReel]);

  // Play / Pause Toggle (Single Tap anywhere on canvas)
  const togglePlay = useCallback(() => {
    const video = getActiveVideo();
    if (!video) return;

    // Sound is ALWAYS active and unmuted
    video.muted = false;
    video.volume = 1.0;

    if (video.paused || isManuallyPausedRef.current) {
      isManuallyPausedRef.current = false;
      const p = video.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlaying(true);
          setShowPlayPauseFeedback('play');
          setTimeout(() => setShowPlayPauseFeedback(null), 650);
        }).catch(() => {});
      } else {
        setIsPlaying(true);
        setShowPlayPauseFeedback('play');
        setTimeout(() => setShowPlayPauseFeedback(null), 650);
      }
    } else {
      isManuallyPausedRef.current = true;
      video.pause();
      setIsPlaying(false);
      setShowPlayPauseFeedback('pause');
      setTimeout(() => setShowPlayPauseFeedback(null), 650);
    }
  }, [getActiveVideo]);

  // Save / Bookmark Toggle (Both Single Tap on Bookmark button or Double Tap on Video canvas)
  const handleToggleSave = useCallback((targetReel?: AnimeReel) => {
    const target = targetReel || currentReel;
    if (!target || !target.id) return;

    const isCurrentlySaved = Boolean(savedStatus[target.id]);
    const isNowSaved = !isCurrentlySaved;

    // Immediately update local state map
    setSavedStatus(prev => {
      const nextMap = { ...prev };
      if (isNowSaved) {
        nextMap[target.id] = true;
      } else {
        delete nextMap[target.id];
      }
      return nextMap;
    });

    // Persist to storage
    toggleSaveReel(target);

    // Visual feedback (heart burst on double tap without popup toast notifications)
    if (isNowSaved) {
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 900);
    }
  }, [currentReel, savedStatus]);

  // Robust Tap vs Double Tap Handler
  const handleCanvasInteraction = useCallback(() => {
    const video = getActiveVideo();
    if (video) {
      video.muted = false;
      video.volume = 1.0;
    }

    const now = Date.now();
    const DOUBLE_TAP_GAP = 280;

    if (tapTimerRef.current && (now - lastTapTimeRef.current < DOUBLE_TAP_GAP)) {
      // Double Tap detected -> Clear single tap timer & trigger Save / Heart pop!
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      lastTapTimeRef.current = 0;
      handleToggleSave();
    } else {
      // First Tap -> Set timer for Single Tap (Play/Pause)
      lastTapTimeRef.current = now;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        lastTapTimeRef.current = 0;
        togglePlay();
      }, DOUBLE_TAP_GAP);
    }
  }, [handleToggleSave, togglePlay, getActiveVideo]);

  // Touch Drag Gestures for Fluid Instagram-Style Physics
  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    if ((e.target as HTMLElement).closest('button, a, input, [data-interactive]')) return;
    const touch = e.touches[0];
    touchStartYRef.current = touch.clientY;
    touchStartXRef.current = touch.clientX;
    touchStartTimeRef.current = Date.now();
    hasMovedSignificantRef.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    if (touchStartYRef.current === null) return;
    const touch = e.touches[0];
    const diffY = touch.clientY - touchStartYRef.current;
    const diffX = touch.clientX - (touchStartXRef.current || touch.clientX);

    // Only flag significant movement if movement exceeds 20px
    if (Math.abs(diffY) > 20 || Math.abs(diffX) > 20) {
      hasMovedSignificantRef.current = true;
    }

    if (Math.abs(diffY) > 12) {
      // Dampen upward drag when at the very top of history
      if (historyIndex === 0 && diffY > 0) {
        setDragOffsetY(diffY * 0.3);
      } else {
        setDragOffsetY(diffY);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    setIsDragging(false);
    if (touchStartYRef.current === null) return;

    const diffY = e.changedTouches[0].clientY - touchStartYRef.current;
    const diffX = e.changedTouches[0].clientX - (touchStartXRef.current || e.changedTouches[0].clientX);
    const timeDiff = Date.now() - touchStartTimeRef.current;
    const totalDistance = Math.hypot(diffX, diffY);

    touchStartYRef.current = null;
    touchStartXRef.current = null;

    const DRAG_THRESHOLD = 50;
    const isQuickFlick = timeDiff < 280 && Math.abs(diffY) > 30;

    if (diffY < -DRAG_THRESHOLD || (isQuickFlick && diffY < 0)) {
      goToNext();
    } else if (diffY > DRAG_THRESHOLD || (isQuickFlick && diffY > 0)) {
      goToPrev();
    } else {
      setDragOffsetY(0);
      if (!hasMovedSignificantRef.current || totalDistance < 25) {
        handleCanvasInteraction();
      }
    }
  };

  // Desktop Mouse Drag Gestures (Safeguarded against synthetic mobile events)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchTimeRef.current < 800) return;
    if ((e.target as HTMLElement).closest('button, a, input, [data-interactive]')) return;
    touchStartYRef.current = e.clientY;
    touchStartXRef.current = e.clientX;
    touchStartTimeRef.current = Date.now();
    hasMovedSignificantRef.current = false;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchTimeRef.current < 800) return;
    if (touchStartYRef.current === null) return;
    const diffY = e.clientY - touchStartYRef.current;
    const diffX = e.clientX - (touchStartXRef.current || e.clientX);

    if (Math.abs(diffY) > 20 || Math.abs(diffX) > 20) {
      hasMovedSignificantRef.current = true;
    }

    if (Math.abs(diffY) > 10) {
      if (historyIndex === 0 && diffY > 0) {
        setDragOffsetY(diffY * 0.3);
      } else {
        setDragOffsetY(diffY);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchTimeRef.current < 800) return;
    setIsDragging(false);
    if (touchStartYRef.current === null) return;

    const diffY = e.clientY - touchStartYRef.current;
    const diffX = e.clientX - (touchStartXRef.current || e.clientX);
    const timeDiff = Date.now() - touchStartTimeRef.current;
    const totalDistance = Math.hypot(diffX, diffY);

    touchStartYRef.current = null;
    touchStartXRef.current = null;

    const DRAG_THRESHOLD = 50;
    const isQuickFlick = timeDiff < 280 && Math.abs(diffY) > 30;

    if (diffY < -DRAG_THRESHOLD || (isQuickFlick && diffY < 0)) {
      goToNext();
    } else if (diffY > DRAG_THRESHOLD || (isQuickFlick && diffY > 0)) {
      goToPrev();
    } else {
      setDragOffsetY(0);
      if (!hasMovedSignificantRef.current || totalDistance < 25) {
        handleCanvasInteraction();
      }
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragOffsetY(0);
      touchStartYRef.current = null;
    }
  };

  // Wheel / Trackpad Vertical Scroll Gestures
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    const WHEEL_COOLDOWN = 380;
    if (now - lastWheelTimeRef.current < WHEEL_COOLDOWN) return;

    if (Math.abs(e.deltaY) > 25) {
      lastWheelTimeRef.current = now;
      if (e.deltaY > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleToggleSave();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        shuffleReel();
      } else if (e.key === 'Escape' && onBack) {
        e.preventDefault();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, togglePlay, handleToggleSave, shuffleReel, onBack]);

  // Sync latest anime edits
  const handleSyncDrive = async () => {
    setIsSyncing(true);
    onShowToast('sync', 'Checking for new anime edits...', 'Updating Reels');
    try {
      const fresh = await syncReelsFromGoogleDrive();
      if (fresh && fresh.length > 0) {
        setAllReels(fresh);
        onShowToast('success', `Updated with ${fresh.length} anime reels!`, 'Update Complete');
      }
    } catch {
      onShowToast('info', 'Reels catalog is up to date.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Direct native share without intermediate modal; shares ONLY the reel URL so chat apps create clean link cards
  const handleShare = async () => {
    if (!currentReel) return;
    // Clean URL: /reel/:id triggers server Open Graph banner previews in chat apps
    const shareUrl = `${window.location.origin}/reel/${encodeURIComponent(currentReel.id)}`;

    if (navigator.share) {
      try {
        // Pass ONLY the URL so apps like WhatsApp, Instagram, Telegram insert only the link
        await navigator.share({
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled share sheet
      }
    }

    // Fallback if browser doesn't support navigator.share or user shares to clipboard
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      } catch {
        // fallback to textarea copy below
      }
    }
    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {
        // silent
      }
    }

    if (copied) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      onShowToast('info', 'Reel link copied to clipboard!', 'Link Copied');
    } else {
      onShowToast('info', shareUrl, 'Share Link');
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Format dynamic duration
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isLandscape = videoAspectRatio > 1.15;
  const activeVideoUrl = useMemo(() => {
    if (!currentReel?.id) return '';
    const syncUrl = reelMediaCache.getSynchronousObjectUrl(currentReel.id);
    return syncUrl || `/api/reels/stream/${currentReel.id}`;
  }, [currentReel?.id]);

  // Ultra-fluid Instagram/TikTok vertical swipe variants (GPU compositor-accelerated)
  const slideVariants = {
    enter: (direction: number) => ({
      y: direction > 0 ? '100%' : '-100%',
    }),
    center: {
      y: 0,
      transition: {
        y: { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.28 },
      }
    },
    exit: (direction: number) => ({
      y: direction > 0 ? '-100%' : '100%',
      transition: {
        y: { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.28 },
      }
    })
  };

  return (
    <div
      ref={containerRef}
      id="anime-reels-container"
      onWheel={handleWheel}
      className="fixed inset-0 z-40 w-full h-[100dvh] bg-black text-white flex flex-col items-center justify-center select-none overflow-hidden touch-none"
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-pink-600/10 via-purple-600/10 to-indigo-600/10 rounded-full blur-[160px]" />
      </div>

      {/* Floating Top Header Bar (Full Screen Dedicated Overlay) */}
      <div className="absolute top-2 lg:top-18 inset-x-0 z-40 px-3 sm:px-6 py-2 flex items-center justify-between pointer-events-none">
        {/* Left: Back / Exit Reels Button & Title */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Back Button */}
          {onBack && (
            <button
              onClick={onBack}
              title={filterMode === 'saved' ? 'Return to Library' : 'Return to AniLove Home'}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/15 text-slate-200 hover:text-white font-bold text-xs shadow-2xl transition active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-pink-400" />
              <span className="hidden sm:inline">{filterMode === 'saved' ? 'Library' : 'Back'}</span>
            </button>
          )}
        </div>

        {/* Center: In Saved Mode, show non-interactive indicator badge */}
        {filterMode === 'saved' ? (
          <div className="pointer-events-none flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/15 text-xs font-bold text-pink-300 shadow-2xl">
            <Bookmark className="w-3.5 h-3.5 fill-current text-pink-400" />
            <span>Saved Reels ({historyIndex + 1}/{feedHistory.length || Object.keys(savedStatus).length})</span>
          </div>
        ) : (
          <div />
        )}

        {/* Right: Live Sync, Fullscreen */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Refresh / Check for new reels */}
          <button
            onClick={handleSyncDrive}
            disabled={isSyncing}
            title="Check for new anime reels"
            className="p-2 text-white/80 hover:text-white transition active:scale-90 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          >
            <RotateCw className={`w-5 h-5 ${isSyncing ? 'animate-spin text-pink-400' : ''}`} />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="p-2 text-white/80 hover:text-white transition active:scale-90 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] hidden sm:flex"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Full-Screen Player Viewport with Animated Slide Transitions */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full h-full max-w-lg md:max-w-xl mx-auto flex items-center justify-center overflow-hidden select-none cursor-grab active:cursor-grabbing pb-16 lg:pb-0 pt-0 lg:pt-16"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-3 text-slate-400">
            <div className="w-12 h-12 rounded-full border-3 border-pink-500 border-t-transparent animate-spin" />
            <p className="text-sm font-bold text-slate-300">Loading Anime Reels...</p>
          </div>
        ) : !currentReel ? (
          <div className="text-center p-8 space-y-4 max-w-sm">
            <Film className="w-14 h-14 text-slate-600 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Reels Found</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {filterMode === 'saved'
                ? 'You have not saved any reels yet. Double-tap any video or tap the bookmark button to save.'
                : 'Tap the refresh button above or explore all reels.'}
            </p>
            {filterMode === 'saved' && (
              <button
                onClick={() => {
                  if (onBack) onBack();
                }}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-pink-500/25"
              >
                Return to Library
              </button>
            )}
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* AnimatePresence for Instagram-Style Page Slide Animation */}
            <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
              <motion.div
                key={`${currentReel.id}-${historyIndex}`}
                custom={slideDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{
                  y: dragOffsetY,
                }}
                className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden will-change-transform"
              >
                {/* Instant Zero-Latency Poster Layer (Completely covers any black flash before video frames start) */}
                <div
                  className={`absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none transition-opacity duration-200 z-10 ${
                    isFrameRendered ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  <div className="absolute inset-0 bg-slate-950/90" />
                  {/* Crisp Sharp Poster Image */}
                  <img
                    src={`/api/reels/thumbnail/${currentReel.id}`}
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      if (!target.src.includes('lh3.googleusercontent.com')) {
                        target.src = `https://lh3.googleusercontent.com/d/${currentReel.id}`;
                      }
                    }}
                    alt={currentReel.cleanTitle || 'Anime Reel'}
                    loading="eager"
                    decoding="sync"
                    // @ts-ignore
                    fetchPriority="high"
                    className={`relative z-10 w-full h-full max-w-[420px] max-h-[88vh] ${
                      aspectFitMode === 'cover' ? 'object-cover' : 'object-contain'
                    }`}
                  />
                </div>

                {/* Landscape Ambient Image Backdrop (Zero duplicate stream overhead) */}
                {isLandscape && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                    <img
                      src={`/api/reels/thumbnail/${currentReel.id}`}
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        if (!target.src.includes('lh3.googleusercontent.com')) {
                          target.src = `https://lh3.googleusercontent.com/d/${currentReel.id}`;
                        }
                      }}
                      alt=""
                      className="w-full h-full object-cover blur-3xl scale-125 opacity-40 brightness-75 transition-opacity duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                  </div>
                )}

                {/* Primary Active Video Element */}
                <video
                  id="active-reel-video"
                  key={currentReel.id}
                  ref={(el) => {
                    if (el) {
                      videoRef.current = el;
                      el.muted = false;
                      el.volume = 1.0;
                    }
                  }}
                  src={activeVideoUrl}
                  poster={`/api/reels/thumbnail/${currentReel.id}`}
                  autoPlay
                  playsInline
                  loop
                  muted={false}
                  preload="auto"
                  onPlay={(e) => {
                    e.currentTarget.muted = false;
                    e.currentTarget.volume = 1.0;
                    setIsPlaying(true);
                    setIsBuffering(false);
                  }}
                  onPause={() => {
                    setIsPlaying(false);
                  }}
                  onCanPlay={(e) => {
                    e.currentTarget.muted = false;
                    e.currentTarget.volume = 1.0;
                    setIsBuffering(false);
                    if (isPlaying && !isManuallyPausedRef.current) {
                      e.currentTarget.play().catch(() => {});
                    }
                  }}
                  onLoadedData={(e) => {
                    e.currentTarget.muted = false;
                    e.currentTarget.volume = 1.0;
                    setIsBuffering(false);
                    setIsFrameRendered(true);
                    if (isPlaying && !isManuallyPausedRef.current) {
                      e.currentTarget.play().catch(() => {});
                    }
                  }}
                  onCanPlayThrough={(e) => {
                    e.currentTarget.muted = false;
                    e.currentTarget.volume = 1.0;
                    setIsBuffering(false);
                  }}
                  onLoadedMetadata={e => {
                    const target = e.currentTarget;
                    setDuration(target.duration || 0);
                    if (target.videoWidth && target.videoHeight) {
                      setVideoAspectRatio(target.videoWidth / target.videoHeight);
                    }
                    target.muted = false;
                    target.volume = 1.0;
                    setIsBuffering(false);
                    if (isPlaying && !isManuallyPausedRef.current) {
                      target.play().catch(() => {});
                    }
                  }}
                  onTimeUpdate={e => {
                    const v = e.currentTarget;
                    if (v && v.duration) {
                      if (!isFrameRendered && v.currentTime > 0) {
                        setIsFrameRendered(true);
                      }
                      setCurrentTime(v.currentTime);
                      setProgress((v.currentTime / v.duration) * 100);
                      setDuration(v.duration);
                    }
                  }}
                  onWaiting={() => setIsBuffering(true)}
                  onPlaying={() => {
                    setIsPlaying(true);
                    setIsBuffering(false);
                    setIsFrameRendered(true);
                  }}
                  onStalled={() => {
                    const v = getActiveVideo();
                    if (v && v.readyState >= 3) {
                      setIsBuffering(false);
                    }
                  }}
                  onError={(e) => {
                    setIsBuffering(false);
                    const v = e.currentTarget;
                    const directUrl = `https://drive.usercontent.google.com/download?id=${currentReel.id}&export=download`;
                    if (v.src !== directUrl && !v.src.includes('usercontent.google.com')) {
                      console.warn('[Reel Stream Fallback to Direct Drive]', currentReel.id);
                      v.src = directUrl;
                      v.load();
                      v.play().catch(() => {});
                    }
                  }}
                  onEnded={e => {
                    const v = e.currentTarget;
                    if (v) {
                      v.currentTime = 0;
                      v.play().catch(() => {});
                    }
                  }}
                  className={`w-full h-full ${
                    isLandscape
                      ? aspectFitMode === 'contain'
                        ? 'object-contain'
                        : 'object-cover'
                      : 'object-cover'
                  } bg-transparent`}
                />
              </motion.div>
            </AnimatePresence>

            {/* Gradient Overlays for Readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85 pointer-events-none z-10" />

            {/* Large Pause / Play Feedback Badge */}
            <AnimatePresence>
              {showPlayPauseFeedback && (
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1.1, opacity: 1 }}
                  exit={{ scale: 1.4, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                >
                  <div className="w-18 h-18 rounded-full bg-black/75 backdrop-blur-xl text-white flex items-center justify-center border border-white/25 shadow-2xl">
                    {showPlayPauseFeedback === 'play' ? (
                      <Play className="w-9 h-9 ml-1 fill-white" />
                    ) : (
                      <Pause className="w-9 h-9 fill-white" />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Persistent Paused Indicator if manually paused */}
            {!isPlaying && !isBuffering && !showPlayPauseFeedback && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="w-16 h-16 rounded-full bg-black/70 backdrop-blur-xl text-white flex items-center justify-center border border-white/25 shadow-2xl scale-110">
                  <Play className="w-8 h-8 ml-1 fill-white" />
                </div>
              </div>
            )}

            {/* Double Tap Heart Pop Animation */}
            <AnimatePresence>
              {showHeartBurst && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1.35, opacity: 1 }}
                  exit={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                >
                  <div className="p-6 rounded-full bg-pink-500/90 text-white shadow-2xl shadow-pink-500/60 backdrop-blur-md">
                    <Heart className="w-18 h-18 fill-white text-white animate-pulse" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Right Action Rail - Minimalist Instagram Style (Clean white borderless icons, no text labels) */}
            <div className="absolute right-3 sm:right-4 bottom-28 lg:bottom-24 flex flex-col items-center gap-5 sm:gap-6 z-20 pointer-events-auto">

              {/* Share Button (Instagram paper plane style) */}
              <button
                data-interactive="true"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onShareToDm) {
                    onShareToDm(currentReel);
                  } else {
                    handleShare();
                  }
                }}
                title="Share Reel in Chat or Copy Link"
                className="p-1.5 text-white/90 hover:text-white transition-all duration-200 active:scale-75 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              >
                {copiedLink ? (
                  <Check className="w-7 h-7 text-emerald-400 stroke-[2.2]" />
                ) : (
                  <Send className="w-7 h-7 stroke-[2.2] -rotate-12" />
                )}
              </button>

              {/* Bookmark / Save Button */}
              <button
                data-interactive="true"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSave();
                }}
                title={savedStatus[currentReel.id] ? 'Bookmarked (Tap to Unsave)' : 'Save Reel (S)'}
                className="p-1.5 text-white/90 hover:text-white transition-all duration-200 active:scale-75 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              >
                <Bookmark
                  className={`w-7 h-7 stroke-[2.2] ${
                    savedStatus[currentReel.id] ? 'fill-white text-white' : ''
                  }`}
                />
              </button>

              {/* Secure Download Proxy Button */}
              <a
                data-interactive="true"
                href={`/api/reels/download/${currentReel.id}`}
                download={`${currentReel.cleanTitle || 'AnimeReel'}.mp4`}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                title="Download MP4 Video"
                className="p-1.5 text-white/90 hover:text-white transition-all duration-200 active:scale-75 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              >
                <Download className="w-7 h-7 stroke-[2.2]" />
              </a>

              {/* Landscape Aspect Ratio Toggle (Fit vs Fill) */}
              {isLandscape && (
                <button
                  data-interactive="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAspectFitMode(prev => (prev === 'contain' ? 'cover' : 'contain'));
                  }}
                  title={aspectFitMode === 'contain' ? 'Switch to Full Fill' : 'Switch to Aspect Fit'}
                  className="p-1.5 text-white/90 hover:text-white transition-all duration-200 active:scale-75 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                >
                  <Crop className="w-7 h-7 stroke-[2.2]" />
                </button>
              )}

              {/* Up/Down Navigation Arrows */}
              <div className="flex flex-col gap-3 pt-2">
                <button
                  data-interactive="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrev();
                  }}
                  disabled={historyIndex === 0}
                  title="Previous Reel (Up Arrow / Scroll Up)"
                  className={`p-1.5 transition-all duration-200 active:scale-75 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] ${
                    historyIndex === 0
                      ? 'opacity-20 cursor-not-allowed text-white/30'
                      : 'text-white/80 hover:text-white cursor-pointer'
                  }`}
                >
                  <ChevronUp className="w-7 h-7 stroke-[2.5]" />
                </button>
                <button
                  data-interactive="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  title="Next Reel (Down Arrow / Scroll Down / Swipe Up)"
                  className="p-1.5 text-white/80 hover:text-white transition-all duration-200 active:scale-75 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                >
                  <ChevronDown className="w-7 h-7 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Bottom Metadata & Scrubber Progress Bar */}
            <div className="absolute bottom-16 lg:bottom-4 inset-x-4 sm:inset-x-6 z-20 space-y-2 pointer-events-auto">
              <div className="pr-16 space-y-1">
                <h2 className="text-sm sm:text-base font-bold text-white line-clamp-2 drop-shadow-md">
                  {currentReel.cleanTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-300">
                  <span className="px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-md border border-white/10 text-slate-200">
                    {currentReel.size || 'HD Video'}
                  </span>
                  <span className="text-slate-300 font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Video Progress Scrubber Bar */}
              <div
                data-interactive="true"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const newPct = Math.max(0, Math.min(1, clickX / rect.width));
                  const v = getActiveVideo();
                  if (v && duration) {
                    v.currentTime = newPct * duration;
                    setCurrentTime(v.currentTime);
                    setProgress(newPct * 100);
                  }
                }}
                className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all relative"
              >
                <div
                  className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
