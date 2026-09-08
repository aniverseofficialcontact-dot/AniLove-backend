import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Anime, UserMediaListItem, UserSettings, MediaListStatus, AnimeTrailer, AppNotification, ChatUserProfile, AnimeReel } from './types';
import {
  fetchHomeFeed,
  fetchTrendingAnime,
  fetchPopularAnime,
  fetchTopRatedAnime,
  fetchNewestAnime,
  fetchUpcomingAnime,
  fetchTopMoviesAnime,
  fetchGenreAnime,
  fetchRomComAnime,
  fetchAnimeDetails,
  parseOAuthTokenFromHash,
  fetchAuthenticatedViewer,
  fetchUserMediaList,
  saveMediaListEntry
} from './services/anilist';
import {
  getUserLibrary,
  saveUserLibrary,
  getUserSettings,
  saveUserSettings,
  updateLibraryItem,
  exportLibraryAsJSON,
  importLibraryFromJSON,
  getStoredNotifications,
  saveStoredNotifications,
  getStoredWatchHistory,
  saveStoredWatchHistory,
  syncUserDataWithAniList,
} from './services/storage';

import { Navbar, TabType } from './components/Navbar';
import { HeroSpotlight } from './components/HeroSpotlight';
import { AnimeCard } from './components/AnimeCard';
import { HorizontalAnimeRow } from './components/HorizontalAnimeRow';
import { ContinueWatchingSection } from './components/ContinueWatchingSection';
import { SearchView } from './components/SearchView';
import { ReelsView } from './components/ReelsView';
import { AnimeDetailModal } from './components/AnimeDetailModal';
import { TrailerModal } from './components/TrailerModal';
import { ScheduleView } from './components/ScheduleView';
import { MyLibraryView } from './components/MyLibraryView';
import { AccountView } from './components/AccountView';
import { WatchView } from './components/WatchView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ArcadeView } from './components/ArcadeView';
import { AnimeGachaModal } from './components/AnimeGachaModal';
import { AiAnimeSenseiModal } from './components/AiAnimeSenseiModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { InteractiveAnime3DCardModal } from './components/InteractiveAnime3DCardModal';
import { CardInventoryView } from './components/CardInventoryView';
import { PinUnlockModal } from './components/PinUnlockModal';
import { QuoteOfTheDay } from './components/QuoteOfTheDay';
import { AniListSyncBar } from './components/AniListSyncBar';
import { AppIntroSplash } from './components/AppIntroSplash';
import GlobalThemePlayer, { ThemeSongPayload } from './components/GlobalThemePlayer';
import AmbientParticles from './components/AmbientParticles';
import { soundEffects } from './services/soundEffects';
import { mapMediaListStatusToMAL } from './services/myanimelist';
import { prewarmInitialReelsOnAppStart } from './services/reelsService';
import { apiFetch } from './services/apiClient';
import { MessagesView } from './components/MessagesView';
import { UsernameOnboardingModal } from './components/UsernameOnboardingModal';
import { ShareToDmModal } from './components/ShareToDmModal';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getChatProfile, subscribeToConversations, getCrossDeviceUserId } from './services/chatService';
import { Sparkles, Keyboard, Lock, Unlock, ShieldAlert } from 'lucide-react';

// Synchronously parses URL for tab and reel query parameters to avoid blank or random-feed mount flashes
function parseInitialReelNavigation(): {
  initialTab: TabType;
  initialReelId: string | null;
  initialFilterMode: 'all' | 'saved' | null;
} {
  if (typeof window === 'undefined') {
    return { initialTab: 'home', initialReelId: null, initialFilterMode: null };
  }
  try {
    const searchParams = new URLSearchParams(window.location.search);
    let reelParam = searchParams.get('reel') || searchParams.get('reelId') || searchParams.get('id');
    const tabParam = searchParams.get('tab');
    const modeParam = searchParams.get('mode');

    // Support direct clean route format: /reel/:id
    if (!reelParam && window.location.pathname.startsWith('/reel/')) {
      const parts = window.location.pathname.split('/');
      if (parts[2]) {
        reelParam = decodeURIComponent(parts[2]).trim();
      }
    }

    // Also support hash parameter formats: #reel=... or #?reel=...
    if (!reelParam && window.location.hash) {
      const hashStr = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
      const qIdx = hashStr.indexOf('?');
      const hashQuery = qIdx >= 0 ? hashStr.slice(qIdx + 1) : hashStr;
      const hashParams = new URLSearchParams(hashQuery);
      reelParam = hashParams.get('reel') || hashParams.get('reelId') || hashParams.get('id');
    }

    if (reelParam) {
      const cleanReel = decodeURIComponent(reelParam).trim();
      return {
        initialTab: 'reels',
        initialReelId: cleanReel,
        initialFilterMode: modeParam === 'saved' ? 'saved' : 'all',
      };
    }

    if (tabParam && ['home', 'discover', 'reels', 'arcade', 'schedule', 'library', 'cards', 'account', 'messages'].includes(tabParam)) {
      return {
        initialTab: tabParam as TabType,
        initialReelId: null,
        initialFilterMode: modeParam === 'saved' ? 'saved' : null,
      };
    }
  } catch (e) {
    console.warn('URL parsing error:', e);
  }
  return { initialTab: 'home', initialReelId: null, initialFilterMode: null };
}

export function App() {
  // Parse initial navigation synchronously so shared reel deep links immediately mount Reels tab
  const initialNav = useMemo(() => parseInitialReelNavigation(), []);

  // Navigation State: 'home' | 'discover' | 'seasonal' | 'schedule' | 'library' | 'settings'
  const [currentTab, setCurrentTab] = useState<TabType>(initialNav.initialTab);
  const [isGachaModalOpen, setIsGachaModalOpen] = useState(false);

  // Active Standalone Watch Page State
  const [activeWatchEpisode, setActiveWatchEpisode] = useState<{
    anime: Anime;
    episodeNumber: number;
    startTime?: number;
  } | null>(null);

  // Persistence State
  const [library, setLibrary] = useState<UserMediaListItem[]>(() => getUserLibrary());
  const [settings, setSettings] = useState<UserSettings>(() => getUserSettings());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getStoredNotifications());

  // Profile PIN Lock State
  const [isPinUnlocked, setIsPinUnlocked] = useState<boolean>(() => {
    const s = getUserSettings();
    return !s.profilePinEnabled || !s.profilePin;
  });
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pendingUnlockTab, setPendingUnlockTab] = useState<TabType | null>(null);

  // Reels Navigation State
  const [targetReelId, setTargetReelId] = useState<string | null>(initialNav.initialReelId);
  const [targetReelFilterMode, setTargetReelFilterMode] = useState<'all' | 'saved' | null>(initialNav.initialFilterMode);
  const [reelsRefreshTrigger, setReelsRefreshTrigger] = useState<number>(0);

  // Direct Messages & User Chat Profile State
  const [currentUserProfile, setCurrentUserProfile] = useState<ChatUserProfile | null>(() => {
    try {
      const stored = localStorage.getItem('anilove_chat_profile');
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });
  const [currentFirebaseUser, setCurrentFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [shareToDmReel, setShareToDmReel] = useState<AnimeReel | null>(null);
  const [shareToDmAnime, setShareToDmAnime] = useState<Anime | null>(null);
  const [isShareToDmOpen, setIsShareToDmOpen] = useState(false);
  const [targetDmChatId, setTargetDmChatId] = useState<string | null>(null);
  const [targetDmUser, setTargetDmUser] = useState<ChatUserProfile | null>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  // Home Catalog Data
  const [trendingAnime, setTrendingAnime] = useState<Anime[]>([]);
  const [popularAnime, setPopularAnime] = useState<Anime[]>([]);
  const [topRatedAnime, setTopRatedAnime] = useState<Anime[]>([]);
  const [newestAnime, setNewestAnime] = useState<Anime[]>([]);
  const [upcomingAnime, setUpcomingAnime] = useState<Anime[]>([]);
  const [moviesAnime, setMoviesAnime] = useState<Anime[]>([]);
  const [actionAnime, setActionAnime] = useState<Anime[]>([]);
  const [fantasyAnime, setFantasyAnime] = useState<Anime[]>([]);
  const [romComAnime, setRomComAnime] = useState<Anime[]>([]);
  const [isMainLoading, setIsMainLoading] = useState(true);

  // Selected Studio/Genre for Search Navigation
  const [selectedStudioForSearch, setSelectedStudioForSearch] = useState<string | null>(null);

  // Modals
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAnimeFor3D, setSelectedAnimeFor3D] = useState<Anime | null>(null);
  const [is3DCardModalOpen, setIs3DCardModalOpen] = useState(false);
  const [streamInitialEpisode, setStreamInitialEpisode] = useState<number | undefined>(undefined);
  const [streamInitialTime, setStreamInitialTime] = useState<number | undefined>(undefined);
  const [startInWatchMode, setStartInWatchMode] = useState<boolean>(false);
  const [trailerData, setTrailerData] = useState<{ trailer: AnimeTrailer; title: string } | null>(null);
  
  // AI Sensei & Keyboard Shortcuts Modal States
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [aiContextAnime, setAiContextAnime] = useState<Anime | null>(null);

  // Global Anime Theme Song Jukebox Player State (Full Song Track or Audio Preview)
  const [activeThemeSong, setActiveThemeSong] = useState<ThemeSongPayload | null>(null);

  // Crunchyroll-Style App Opening Splash Animation State
  const [showIntroSplash, setShowIntroSplash] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const s = getUserSettings();
    if (s.appIntroAnimationEnabled === false) return false;
    // Don't show splash if deep linking directly to a specific reel or watch page via URL query/path
    const search = window.location.search || '';
    if (search.includes('reel=') || search.includes('reelId=') || window.location.pathname.startsWith('/reel/')) {
      return false;
    }
    // Check if splash was already shown in the current browser session
    try {
      const sessionViewed = sessionStorage.getItem('anilove_app_intro_viewed');
      return !sessionViewed;
    } catch {
      return true;
    }
  });

  const handleFinishIntro = useCallback(() => {
    setShowIntroSplash(false);
    try {
      sessionStorage.setItem('anilove_app_intro_viewed', 'true');
    } catch {}
  }, []);

  const handleReplayIntro = useCallback(() => {
    setShowIntroSplash(true);
  }, []);

  // Notifications / Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Synchronize dynamic theme classes & sound settings
  useEffect(() => {
    const theme = settings.theme || 'midnight';
    const themeList = ['theme-midnight', 'theme-cyber', 'theme-sakura', 'theme-slate', 'theme-light', 'theme-ghibli', 'theme-amoled', 'theme-solar'];
    themeList.forEach(t => document.documentElement.classList.remove(t));
    document.documentElement.classList.add(`theme-${theme}`);

    soundEffects.setEnabled(settings.soundEffectsEnabled ?? true);
    soundEffects.setVolume(settings.soundVolume ?? 0.8);
  }, [settings.theme, settings.soundEffectsEnabled, settings.soundVolume]);

  // Persist notifications on change
  useEffect(() => {
    saveStoredNotifications(notifications);
  }, [notifications]);

  // Listen for Firebase Auth changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentFirebaseUser(user);
    });
    return () => unsub();
  }, []);

  // Sync chat profile from active cross-device user identity (Google or AniList)
  useEffect(() => {
    const identity = getCrossDeviceUserId(currentFirebaseUser, settings);
    if (!identity) return;

    let isMounted = true;
    (async () => {
      try {
        const profile = await getChatProfile(identity.uid);
        if (profile && isMounted) {
          setCurrentUserProfile(profile);
          try {
            localStorage.setItem('anilove_chat_profile', JSON.stringify(profile));
          } catch {}
          if (!settings.uniqueUsername || settings.uniqueUsername !== profile.username) {
            const updated = {
              ...settings,
              uniqueUsername: profile.username,
              customDisplayName: profile.displayName,
              customAvatar: profile.avatar,
              userBio: profile.bio,
            };
            setSettings(updated);
            saveUserSettings(updated);
          }
        }
      } catch (e) {
        console.warn('Could not fetch chat profile for cross-device identity:', e);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentFirebaseUser, settings.anilistToken, settings.anilistUser?.id, settings.anilistUser?.name]);

  // Subscribe to unread messages count across all conversations
  useEffect(() => {
    if (!currentUserProfile?.userId) {
      setUnreadMessagesCount(0);
      return;
    }
    const unsub = subscribeToConversations(currentUserProfile.userId, (list) => {
      let totalUnread = 0;
      for (const c of list) {
        totalUnread += (c.unreadCounts?.[currentUserProfile.userId] || 0);
      }
      setUnreadMessagesCount(totalUnread);
    });
    return () => unsub();
  }, [currentUserProfile?.userId]);

  const showToast = useCallback((type: 'success' | 'error' | 'info' | 'sync', message: string, title?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message, title }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Dispatch App Notification Helper
  const triggerNotification = useCallback((
    type: 'airing' | 'sync' | 'library' | 'system',
    title: string,
    message: string,
    anime?: Anime,
    episode?: number
  ) => {
    if (!settings.notificationsEnabled) return;
    if (type === 'airing' && !settings.notifyAiringEpisodes) return;
    if (type === 'sync' && !settings.notifySyncUpdates) return;

    const newNotification: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      anime,
      episode,
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]);

    // Native Browser Push Notification
    if (settings.browserPushEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: anime?.coverImage?.medium || '/favicon.ico',
        });
      } catch (err) {
        console.error('Error firing push notification:', err);
      }
    }
  }, [settings]);

  // 1. Check for AniList OAuth Implicit Token in URL Hash
  useEffect(() => {
    const token = parseOAuthTokenFromHash();
    if (token) {
      // Clear hash from URL cleanly
      window.history.replaceState(null, '', window.location.pathname + window.location.search);

      fetchAuthenticatedViewer(token)
        .then(async user => {
          if (user) {
            // Sync character cards, awakenings, coins, and companions with AniList User ID store
            const cardSyncResult = await syncUserDataWithAniList(token).catch(e => {
              console.warn('Initial AniList card sync warning:', e);
              return { cardsCount: 0, coins: 0 };
            });

            // Fetch user's AniList watchlist
            const userList = await fetchUserMediaList(user.name).catch(() => []);
            if (userList && userList.length > 0) {
              setLibrary(prev => {
                const map = new Map<number, UserMediaListItem>();
                prev.forEach(i => map.set(i.mediaId, i));
                userList.forEach(i => map.set(i.mediaId, i));
                const merged = Array.from(map.values());
                saveUserLibrary(merged);
                return merged;
              });
            }

            const updated: UserSettings = {
              ...settings,
              anilistToken: token,
              importUsername: user.name,
              anilistUser: user,
              customDisplayName: user.name,
              customAvatar: user.avatar?.large || settings.customAvatar,
              twoWaySyncEnabled: true,
              lastSyncTimestamp: Date.now(),
            };
            setSettings(updated);
            saveUserSettings(updated);
            showToast(
              'sync',
              `Welcome ${user.name}! AniList 2-Way Sync active (${userList.length} anime, ${cardSyncResult.cardsCount} cards, ${cardSyncResult.coins} coins).`,
              'AniList Connected'
            );
            triggerNotification(
              'sync',
              'AniList Account Linked',
              `Logged in as ${user.name}. Two-way cloud synchronization is now enabled.`,
            );
          }
        })
        .catch(err => {
          console.error('OAuth token verification failed:', err);
          showToast('error', 'Failed to authenticate AniList token.', 'Auth Error');
        });
    }
  }, [settings, showToast, triggerNotification]);

  // Initial URL tab and reel query parameter check & browser navigation listener
  useEffect(() => {
    // Proactively pre-buffer initial reels into client memory on site entry
    prewarmInitialReelsOnAppStart();

    const handlePopState = () => {
      const nav = parseInitialReelNavigation();
      if (nav.initialReelId) {
        setTargetReelId(nav.initialReelId);
        setTargetReelFilterMode(nav.initialFilterMode);
        setCurrentTab('reels');
      } else if (nav.initialTab) {
        setCurrentTab(nav.initialTab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 2. Fetch Initial Catalog from AniList GraphQL (Live AniList Sync)
  const loadHomeContent = useCallback(async () => {
    setIsMainLoading(true);
    try {
      const feed = await fetchHomeFeed(24);
      setTrendingAnime(feed.trending);
      setPopularAnime(feed.popular);
      setTopRatedAnime(feed.topRated);
      setNewestAnime(feed.newest);
      setUpcomingAnime(feed.upcoming);
      setMoviesAnime(feed.movies);
      setActionAnime(feed.action);
      setFantasyAnime(feed.fantasy);
      setRomComAnime(feed.romcom);
    } catch (err: any) {
      console.error('Error loading home content:', err);
      // Only notify if we don't already have catalog in state
      if (trendingAnime.length === 0) {
        showToast('error', 'AniList rate limit or network issue. Serving cached catalog.', 'Catalog Notice');
      }
    } finally {
      setIsMainLoading(false);
    }
  }, [showToast, trendingAnime.length]);

  useEffect(() => {
    loadHomeContent();
  }, [loadHomeContent]);

  // Two-Way Sync Dispatcher (AniList + MyAnimeList)
  const performAniListSync = async (anime: Anime, updates: { status?: MediaListStatus; progress?: number; score?: number }) => {
    // 1. AniList Sync
    if (settings.twoWaySyncEnabled && settings.anilistToken) {
      try {
        await saveMediaListEntry(settings.anilistToken, {
          mediaId: anime.id,
          status: settings.syncWatchStatus ? updates.status : undefined,
          progress: settings.syncEpisodeProgress ? updates.progress : undefined,
          score: settings.syncScores && updates.score !== undefined ? updates.score * 10 : undefined,
        });

        const title = anime.title?.english || anime.title?.romaji || 'Anime';
        triggerNotification(
          'sync',
          'AniList Cloud Synced',
          `Synced updates for "${title}" to your AniList profile.`,
          anime,
          updates.progress
        );
      } catch (err) {
        console.error('AniList 2-way sync error:', err);
      }
    }

    // 2. MyAnimeList Sync
    if (settings.malSyncEnabled && (settings.malToken || settings.malUsername)) {
      try {
        const malStatus = updates.status ? mapMediaListStatusToMAL(updates.status) : undefined;
        const malAnimeId = anime.idMal || anime.id;
        await apiFetch('/api/mal/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(settings.malToken ? { 'Authorization': `Bearer ${settings.malToken}` } : {}),
          },
          body: JSON.stringify({
            animeId: malAnimeId,
            status: malStatus,
            numWatchedEpisodes: updates.progress,
            score: updates.score,
          }),
        });
      } catch (malErr) {
        console.warn('MyAnimeList sync notice:', malErr);
      }
    }
  };

  // User Library Handlers
  const handleUpdateStatus = (anime: Anime, status: MediaListStatus) => {
    const updated = updateLibraryItem(library, anime, { status });
    setLibrary(updated);
    saveUserLibrary(updated);

    const title = anime.title?.english || anime.title?.romaji || 'Anime';
    showToast('success', `Moved "${title}" to ${status.toLowerCase()} list.`, 'Library Updated');
    performAniListSync(anime, { status });
  };

  const handleUpdateProgress = (anime: Anime, progress: number) => {
    const totalEps = typeof anime.episodes === 'number' && anime.episodes > 0 ? anime.episodes : null;
    const max = totalEps !== null ? totalEps : 9999;
    const clampedProgress = Math.max(0, Math.min(max, Math.floor(progress)));

    const existingItem = library.find(item => item.mediaId === anime.id);
    const isCompleted = totalEps !== null && clampedProgress >= totalEps;

    let nextStatus: MediaListStatus | undefined = undefined;
    if (isCompleted) {
      nextStatus = 'COMPLETED';
    } else if (clampedProgress > 0 && (!existingItem || existingItem.status === 'PLANNING' || existingItem.status === 'COMPLETED')) {
      nextStatus = 'CURRENT';
    }

    const updates: Partial<UserMediaListItem> = {
      progress: clampedProgress,
      ...(nextStatus ? { status: nextStatus } : {}),
    };

    const updated = updateLibraryItem(library, anime, updates);
    setLibrary(updated);
    saveUserLibrary(updated);

    const title = anime.title?.english || anime.title?.romaji || 'Anime';
    if (isCompleted) {
      showToast('success', `Completed "${title}" (${clampedProgress}/${totalEps} eps)! 🎉`, 'Completed');
    } else {
      showToast('info', `Updated "${title}" progress to Episode ${clampedProgress}.`, 'Progress Saved');
    }
    performAniListSync(anime, { progress: clampedProgress, status: nextStatus || existingItem?.status });
  };

  const handleUpdateScore = (anime: Anime, score: number) => {
    const updated = updateLibraryItem(library, anime, { score });
    setLibrary(updated);
    saveUserLibrary(updated);

    const title = anime.title?.english || anime.title?.romaji || 'Anime';
    showToast('info', `Rated "${title}" ${score}/10.`, 'Score Saved');
    performAniListSync(anime, { score });
  };

  // Quick Add from Card
  const handleQuickAdd = (anime: Anime, status: MediaListStatus = 'CURRENT') => {
    handleUpdateStatus(anime, status);
  };

  // Open Details Modal
  const handleOpenDetails = (anime: Anime) => {
    setSelectedAnime(anime);
    setStreamInitialEpisode(undefined);
    setStreamInitialTime(undefined);
    setStartInWatchMode(false);
    setIsDetailModalOpen(true);
  };

  // Open 360° 3D Anime Card Modal (or bypass to details if disabled in settings)
  const handleInspect3DCard = (anime: Anime) => {
    if (settings.enable3DCardPreview === false) {
      handleOpenDetails(anime);
      return;
    }
    setSelectedAnimeFor3D(anime);
    setIs3DCardModalOpen(true);
    soundEffects.playCardFlip();
  };

  // Open Direct Stream / Watch with Live Resume on dedicated Watch page
  const handlePlayStream = (anime: Anime, episodeNumber?: number, startTime?: number) => {
    setIsDetailModalOpen(false);
    setIs3DCardModalOpen(false);
    setActiveWatchEpisode({
      anime,
      episodeNumber: episodeNumber || 1,
      startTime: startTime || 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Trailer Modal
  const handleOpenTrailer = (trailer: AnimeTrailer, title: string) => {
    setTrailerData({ trailer, title });
  };

  // Genre & Studio Filters Navigation -> Switch to Discover/Search Tab
  const handleSelectGenre = (_genre: string) => {
    setCurrentTab('discover');
  };

  const handleSelectStudio = (studio: string) => {
    setSelectedStudioForSearch(studio);
    setCurrentTab('discover');
  };

  // Profile PIN Protected Tab Interceptor
  const handleSelectTab = (tab: TabType) => {
    setActiveWatchEpisode(null);
    if (tab === 'reels') {
      if (activeThemeSong) {
        setActiveThemeSong(null);
      }
      if (currentTab === 'reels') {
        // Tapped Reels tab while already on Reels: REFRESH FEED!
        setReelsRefreshTrigger(prev => prev + 1);
        soundEffects.playClick();
        showToast('info', 'Loaded fresh anime reels for you!', 'Reels Refreshed');
        return;
      }
      setTargetReelId(null);
      setTargetReelFilterMode('all');
    } else {
      setTargetReelId(null);
      setTargetReelFilterMode(null);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        url.searchParams.delete('reel');
        url.searchParams.delete('mode');
        window.history.replaceState(null, '', url.toString());
      } catch {
        // silent
      }
    }
    const isProtected = tab === 'library' || tab === 'cards';
    const isLocked = Boolean(settings.profilePinEnabled && settings.profilePin && !isPinUnlocked);

    if (isProtected && isLocked) {
      setPendingUnlockTab(tab);
      setIsPinModalOpen(true);
      soundEffects.playClick();
      return;
    }

    setCurrentTab(tab);
  };

  // PIN Unlock Verification Callback
  const handlePinUnlockSuccess = () => {
    setIsPinUnlocked(true);
    const target = pendingUnlockTab || 'library';
    setCurrentTab(target);
    setPendingUnlockTab(null);
    setIsPinModalOpen(false);
    showToast('success', `${target === 'cards' ? 'Cards Binder' : 'My Library'} unlocked successfully.`, 'Access Granted');
  };

  // Reset PIN when user successfully verifies backup security question
  const handleResetPinFromRecovery = () => {
    const newSettings: UserSettings = {
      ...settings,
      profilePin: null,
      profilePinEnabled: false,
      profilePinBackupAnswer: null,
    };
    handleSaveSettings(newSettings);
    setIsPinUnlocked(true);
    showToast('info', 'Profile PIN has been reset via backup question. You now have full access.', 'PIN Reset');
  };

  // Lock Current PIN Protected Session
  const handleLockSession = () => {
    if (!settings.profilePinEnabled || !settings.profilePin) return;
    setIsPinUnlocked(false);
    if (currentTab === 'library' || currentTab === 'cards') {
      setCurrentTab('home');
    }
    soundEffects.playClick();
    showToast('info', 'Library and Cards Binder are now locked with PIN.', 'Session Locked');
  };

  // Unlock Session Trigger
  const handleUnlockSession = () => {
    if (!settings.profilePinEnabled || !settings.profilePin) return;
    setPendingUnlockTab(currentTab === 'library' || currentTab === 'cards' ? currentTab : 'library');
    setIsPinModalOpen(true);
  };

  // Save Settings
  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    saveUserSettings(newSettings);
    if (!newSettings.profilePinEnabled || !newSettings.profilePin) {
      setIsPinUnlocked(true);
    }
  };

  // Import Playlist (Option 1)
  const handleImportPlaylist = (importedItems: UserMediaListItem[], username: string) => {
    const map = new Map<number, UserMediaListItem>();
    library.forEach(i => map.set(i.mediaId, i));
    importedItems.forEach(i => map.set(i.mediaId, i));
    const merged = Array.from(map.values());

    setLibrary(merged);
    saveUserLibrary(merged);
    triggerNotification(
      'library',
      'AniList Import Finished',
      `Imported ${importedItems.length} entries from ${username}'s public playlist.`,
    );
  };

  // Export / Import Backup Files
  const handleExportBackup = () => {
    exportLibraryAsJSON(library, settings);
    showToast('success', 'Downloaded library backup JSON file.', 'Export Complete');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    importLibraryFromJSON(
      file,
      (importedLib, importedSettings) => {
        const map = new Map<number, UserMediaListItem>();
        library.forEach(i => map.set(i.mediaId, i));
        importedLib.forEach(i => map.set(i.mediaId, i));
        const merged = Array.from(map.values());

        setLibrary(merged);
        saveUserLibrary(merged);

        if (importedSettings) {
          const mergedSettings: UserSettings = { ...settings, ...importedSettings };
          setSettings(mergedSettings);
          saveUserSettings(mergedSettings);
        }

        showToast('success', `Restored ${importedLib.length} anime entries from backup!`, 'Backup Restored');
      },
      errorMsg => {
        showToast('error', errorMsg, 'Restore Failed');
      }
    );
  };

  // Send Test Notification
  const handleSendTestNotification = () => {
    const sample = trendingAnime[0] || popularAnime[0];
    const sampleTitle = sample?.title?.english || sample?.title?.romaji || 'Solo Leveling Season 2';
    
    triggerNotification(
      'airing',
      `Episode Airing: ${sampleTitle}`,
      `Episode 8 of ${sampleTitle} has just broadcasted and is now available to stream in HD.`,
      sample,
      8
    );
    showToast('success', `Test notification dispatched: "${sampleTitle}"! Check the Bell icon.`, 'Notification Sent');
  };

  // Notification Center Handlers
  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast('info', 'All notifications marked as read.', 'Cleared');
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    showToast('info', 'Notification history cleared.', 'Notifications Cleared');
  };

  // Play Complete Anime Theme Song or Audio Preview in Global Jukebox (Instant Play)
  const handlePlayThemeSong = async (anime: Anime) => {
    const title = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
    const romaji = anime.title?.romaji || '';
    const english = anime.title?.english || '';

    try {
      // 1. Try fast cached AnimeThemes query with parallel resolution
      const fullRes = await apiFetch(`/api/theme-full-track?query=${encodeURIComponent(romaji || title || english)}`);
      const fullData = await fullRes.json();

      if (fullData.audioUrl || fullData.rawAudioUrl || fullData.videoUrl) {
        const streamUrl = fullData.rawAudioUrl || fullData.audioUrl;
        const vidUrl = fullData.rawVideoUrl || fullData.videoUrl;
        setActiveThemeSong({
          title: fullData.title || `${title} Opening Theme`,
          url: streamUrl,
          videoUrl: vidUrl,
          artists: fullData.artists,
          themeType: 'OP',
          themeSlug: fullData.themeSlug || 'OP1',
          animeName: fullData.animeName || title,
          fullTrack: true,
        });
        showToast('success', `Now Playing: ${fullData.title || title}`, 'Theme Player');
        return;
      }

      // 2. Fallback to audio preview
      const res = await apiFetch(`/api/theme-preview?query=${encodeURIComponent(title + ' opening')}`);
      const data = await res.json();
      if (data.previewUrl || data.rawAudioUrl || data.videoUrl) {
        setActiveThemeSong({
          title: data.trackName ? `${title} - ${data.trackName}` : `${title} OP Preview`,
          url: data.rawAudioUrl || data.previewUrl,
          videoUrl: data.rawVideoUrl || data.videoUrl,
          artists: data.artistName,
          themeType: 'OP',
          animeName: title,
          fullTrack: false,
        });
        showToast('success', `Now Playing: ${data.trackName || title}`, 'Theme Player');
      } else {
        showToast('error', `No audio track found for ${title}`, 'Theme Player');
      }
    } catch (err) {
      showToast('error', `Failed to load theme track for ${title}`, 'Theme Player');
    }
  };

  const handlePlayThemeTrack = (
    trackTitle: string,
    streamUrl?: string,
    videoUrl?: string,
    themeType?: 'OP' | 'ED',
    themeSlug?: string,
    artists?: string,
    animeName?: string
  ) => {
    if (streamUrl || videoUrl) {
      // Instant 0ms playback
      setActiveThemeSong({
        title: trackTitle,
        url: streamUrl,
        videoUrl: videoUrl,
        themeType,
        themeSlug,
        artists,
        animeName,
        fullTrack: true,
      });
      showToast('success', `Now Playing: ${trackTitle}`, 'Theme Player');
    } else {
      // Direct track title lookup with fast cache
      apiFetch(`/api/theme-full-track?query=${encodeURIComponent(trackTitle)}`)
        .then(res => res.json())
        .then(data => {
          if (data.audioUrl || data.rawAudioUrl || data.videoUrl) {
            setActiveThemeSong({
              title: data.title ? `${trackTitle} - ${data.title}` : trackTitle,
              url: data.rawAudioUrl || data.audioUrl,
              videoUrl: data.rawVideoUrl || data.videoUrl,
              themeType: themeType || (data.themeSlug?.startsWith('ED') ? 'ED' : 'OP'),
              themeSlug: data.themeSlug || themeSlug,
              artists: data.artists || artists,
              animeName: data.animeName || animeName,
              fullTrack: true,
            });
            showToast('success', `Now Playing: ${trackTitle}`, 'Theme Player');
          } else {
            showToast('error', `Could not find track for ${trackTitle}`, 'Theme Player');
          }
        })
        .catch(() => {
          showToast('error', `Could not load track for ${trackTitle}`, 'Theme Player');
        });
    }
  };

  // Selected anime user tracking item
  const selectedAnimeUserItem = selectedAnime ? library.find(item => item.mediaId === selectedAnime.id) : undefined;

  // Global shortcut listener for '?' to open Keyboard Shortcuts modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;
      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const isReelsActive = currentTab === 'reels';

  return (
    <div className={`min-h-screen bg-[#0f172a] text-slate-100 flex flex-col font-sans selection:bg-pink-500 selection:text-white ${isReelsActive ? 'pb-0 overflow-hidden' : 'pb-20 md:pb-10 overflow-x-clip'} relative`}>
      {/* Dynamic Ambient Particle Overlay (Snow, Sakura, Fireflies) based on User Settings */}
      {!isReelsActive && (
        <AmbientParticles
          enabled={Boolean(settings.ambientParticlesEnabled)}
          style={settings.ambientParticleStyle || 'sakura'}
        />
      )}

      {/* Subtle Bottom Ambient Lighting Only (Keeps top header clean without blue tint) */}
      {!isReelsActive && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute bottom-[-10%] right-[5%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[140px]" />
          <div className="absolute bottom-[20%] left-[10%] w-[30%] h-[30%] bg-indigo-900/10 rounded-full blur-[140px]" />
        </div>
      )}

      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Persistent App Header (Visible on desktop so user can navigate/refresh tabs; hidden on mobile during Reels for edge-to-edge view) */}
      <div className={isReelsActive ? 'hidden lg:block' : 'block'}>
        <Navbar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          settings={settings}
          libraryCount={library.length}
          notifications={notifications}
          isPlaying={Boolean(activeWatchEpisode)}
          isPinLocked={Boolean(settings.profilePinEnabled && settings.profilePin && !isPinUnlocked)}
          onLockSession={handleLockSession}
          onMarkAsRead={handleMarkNotificationAsRead}
          onMarkAllAsRead={handleMarkAllNotificationsAsRead}
          onClearAll={handleClearAllNotifications}
          onOpenDetails={handleOpenDetails}
          onPlayStream={handlePlayStream}
          onOpenGacha={() => {
            soundEffects.playClick();
            setIsGachaModalOpen(true);
          }}
          unreadMessagesCount={unreadMessagesCount}
        />
      </div>

      {/* Main View Container */}
      <main className={`flex-1 relative z-10 ${currentTab === 'home' || activeWatchEpisode || isReelsActive ? '' : 'pt-16'}`}>
        {/* VIEW 0: DEDICATED FULL-PAGE WATCH VIEW */}
        {activeWatchEpisode ? (
          <WatchView
            anime={activeWatchEpisode.anime}
            episodeNumber={activeWatchEpisode.episodeNumber}
            initialTime={activeWatchEpisode.startTime || 0}
            onBack={() => setActiveWatchEpisode(null)}
            onEpisodeChange={ep => {
              setActiveWatchEpisode(prev => (prev ? { ...prev, episodeNumber: ep, startTime: 0 } : null));
            }}
            onNavigateToAnime={targetAnime => {
              setActiveWatchEpisode({ anime: targetAnime, episodeNumber: 1, startTime: 0 });
            }}
            onUpdateStatus={handleUpdateStatus}
            onUpdateProgress={handleUpdateProgress}
            onOpenDetails={anime => handleOpenDetails(anime)}
            userItem={library.find(item => item.mediaId === activeWatchEpisode.anime.id)}
            isTwoWaySyncActive={Boolean(settings.twoWaySyncEnabled && settings.anilistToken)}
            settings={settings}
          />
        ) : (
          <>
            {/* VIEW 1: HOME (Hero Spotlight, Continue Watching, Categories: Trending, Popular, Top Rated, Newest) */}
            {currentTab === 'home' && (
              <div className="space-y-8 pb-12 -mt-16">
                {/* Hero Carousel Spotlight */}
                {trendingAnime.length > 0 && (
                  <HeroSpotlight
                    animeList={trendingAnime.slice(0, 5)}
                    onOpenDetails={handleOpenDetails}
                    onPlayStream={handlePlayStream}
                    onQuickTrack={handleQuickAdd}
                    onInspect3DCard={handleInspect3DCard}
                    onPlayThemeSong={handlePlayThemeSong}
                    userLibrary={library}
                  />
                )}

                {/* Home Content Container */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                  {/* Quote of the Day Section */}
                  <QuoteOfTheDay
                    onOpenAnimeDetails={handleOpenDetails}
                  />

                  {/* 1. Continue Watching / Watch History Section */}
                  <ContinueWatchingSection
                    onOpenDetails={handleOpenDetails}
                    onPlayStream={handlePlayStream}
                    onUpdateStatus={handleUpdateStatus}
                    onExploreTrending={() => {
                      window.scrollTo({ top: 450, behavior: 'smooth' });
                    }}
                  />

                  {/* Horizontal Category Rows */}
                  <div className="space-y-8 pt-2">
                    {/* Trending Now */}
                    {trendingAnime.length > 0 && (
                      <HorizontalAnimeRow
                        title="Trending Now"
                        category="trending"
                        animeList={trendingAnime}
                        userLibrary={library}
                        isLoading={isMainLoading}
                        onOpenDetails={handleOpenDetails}
                        onPlayStream={handlePlayStream}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateProgress={handleUpdateProgress}
                        onSelectGenre={handleSelectGenre}
                        onSelectStudio={handleSelectStudio}
                        onInspect3DCard={handleInspect3DCard}
                      />
                    )}

                    {/* Most Popular */}
                    {popularAnime.length > 0 && (
                      <HorizontalAnimeRow
                        title="Most Popular Anime"
                        category="popular"
                        animeList={popularAnime}
                        userLibrary={library}
                        isLoading={isMainLoading}
                        onOpenDetails={handleOpenDetails}
                        onPlayStream={handlePlayStream}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateProgress={handleUpdateProgress}
                        onSelectGenre={handleSelectGenre}
                        onSelectStudio={handleSelectStudio}
                        onInspect3DCard={handleInspect3DCard}
                      />
                    )}

                    {/* Top Rated All-Time */}
                    {topRatedAnime.length > 0 && (
                      <HorizontalAnimeRow
                        title="Top Rated of All Time"
                        category="topRated"
                        animeList={topRatedAnime}
                        userLibrary={library}
                        isLoading={isMainLoading}
                        onOpenDetails={handleOpenDetails}
                        onPlayStream={handlePlayStream}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateProgress={handleUpdateProgress}
                        onSelectGenre={handleSelectGenre}
                        onSelectStudio={handleSelectStudio}
                        onInspect3DCard={handleInspect3DCard}
                      />
                    )}

                    {/* Newest Releases & Episodes */}
                    {newestAnime.length > 0 && (
                      <HorizontalAnimeRow
                        title="Newest Releases & Episodes"
                        category="newest"
                        animeList={newestAnime}
                        userLibrary={library}
                        isLoading={isMainLoading}
                        onOpenDetails={handleOpenDetails}
                        onPlayStream={handlePlayStream}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateProgress={handleUpdateProgress}
                        onSelectGenre={handleSelectGenre}
                        onSelectStudio={handleSelectStudio}
                        onInspect3DCard={handleInspect3DCard}
                      />
                    )}

                    {/* Highly Anticipated & Upcoming */}
                    {upcomingAnime.length > 0 && (
                      <HorizontalAnimeRow
                        title="Upcoming & Most Anticipated"
                        category="upcoming"
                        animeList={upcomingAnime}
                        userLibrary={library}
                        isLoading={isMainLoading}
                        onOpenDetails={handleOpenDetails}
                        onPlayStream={handlePlayStream}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateProgress={handleUpdateProgress}
                        onSelectGenre={handleSelectGenre}
                        onSelectStudio={handleSelectStudio}
                        onInspect3DCard={handleInspect3DCard}
                      />
                    )}

                    {/* Anime Movies & Feature Films */}
                    {moviesAnime.length > 0 && (
                      <HorizontalAnimeRow
                        title="Anime Movies & Films"
                        category="movies"
                        animeList={moviesAnime}
                        userLibrary={library}
                        isLoading={isMainLoading}
                        onOpenDetails={handleOpenDetails}
                        onPlayStream={handlePlayStream}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateProgress={handleUpdateProgress}
                        onSelectGenre={handleSelectGenre}
                        onSelectStudio={handleSelectStudio}
                        onInspect3DCard={handleInspect3DCard}
                      />
                    )}

                    {/* Top Action & Battle Shonen */}
                    {actionAnime.length > 0 && (
                      <HorizontalAnimeRow
                        title="Top Action & Battle Anime"
                        category="action"
                        animeList={actionAnime}
                        userLibrary={library}
                        isLoading={isMainLoading}
                        onOpenDetails={handleOpenDetails}
                        onPlayStream={handlePlayStream}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateProgress={handleUpdateProgress}
                        onSelectGenre={handleSelectGenre}
                        onSelectStudio={handleSelectStudio}
                        onInspect3DCard={handleInspect3DCard}
                      />
                    )}

                    {/* Top Fantasy & Supernatural */}
                    {fantasyAnime.length > 0 && (
                      <HorizontalAnimeRow
                        title="Top Fantasy & Magic"
                        category="fantasy"
                        animeList={fantasyAnime}
                        userLibrary={library}
                        isLoading={isMainLoading}
                        onOpenDetails={handleOpenDetails}
                        onPlayStream={handlePlayStream}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateProgress={handleUpdateProgress}
                        onSelectGenre={handleSelectGenre}
                        onSelectStudio={handleSelectStudio}
                        onInspect3DCard={handleInspect3DCard}
                      />
                    )}

                    {/* Top Rom-Com & Romantic Comedy */}
                    {romComAnime.length > 0 && (
                      <HorizontalAnimeRow
                        title="Top Rom-Com & Romantic Comedy"
                        category="romcom"
                        animeList={romComAnime}
                        userLibrary={library}
                        isLoading={isMainLoading}
                        onOpenDetails={handleOpenDetails}
                        onPlayStream={handlePlayStream}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateProgress={handleUpdateProgress}
                        onSelectGenre={handleSelectGenre}
                        onSelectStudio={handleSelectStudio}
                        onInspect3DCard={handleInspect3DCard}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: DEDICATED SEARCH & MULTI-CATEGORY DISCOVERY */}
            {currentTab === 'discover' && (
              <SearchView
                initialStudio={selectedStudioForSearch}
                onClearStudio={() => setSelectedStudioForSearch(null)}
                userLibrary={library}
                onOpenDetails={handleOpenDetails}
                onPlayStream={handlePlayStream}
                onUpdateStatus={handleUpdateStatus}
                onUpdateProgress={handleUpdateProgress}
                onSelectGenre={handleSelectGenre}
                onSelectStudio={handleSelectStudio}
                onInspect3DCard={handleInspect3DCard}
              />
            )}

            {/* VIEW 2.5: INSTAGRAM-STYLE ANIME EDIT REELS */}
            {currentTab === 'reels' && (
              <ReelsView
                onBack={() => {
                  if (targetReelFilterMode === 'saved') {
                    handleSelectTab('library');
                  } else {
                    handleSelectTab('home');
                  }
                  setTargetReelId(null);
                  setTargetReelFilterMode(null);
                }}
                onNavigateToAccount={() => handleSelectTab('account')}
                onShowToast={showToast}
                initialReelId={targetReelId || undefined}
                initialFilterMode={targetReelFilterMode || 'all'}
                refreshTrigger={reelsRefreshTrigger}
                onShareToDm={(reel) => {
                  setShareToDmReel(reel);
                  setShareToDmAnime(null);
                  setIsShareToDmOpen(true);
                }}
              />
            )}

            {/* VIEW 3: ARCADE MINI-GAMES & CHARACTER GACHA */}
            {currentTab === 'arcade' && (
              <ArcadeView
                onOpenDetails={handleOpenDetails}
                onNavigateToLibrary={() => handleSelectTab('library')}
                onNavigateToCards={() => handleSelectTab('cards')}
              />
            )}

            {/* VIEW 4: SCHEDULE AIRING CALENDAR */}
            {currentTab === 'schedule' && (
              <ScheduleView
                onOpenDetails={handleOpenDetails}
                onPlayStream={handlePlayStream}
                userLibrary={library}
                onQuickTrack={handleQuickAdd}
              />
            )}

            {/* VIEW 5: MY WATCHLIST & LIBRARY (PIN-PROTECTED) */}
            {currentTab === 'library' && (
              Boolean(settings.profilePinEnabled && settings.profilePin && !isPinUnlocked) ? (
                <div className="max-w-md mx-auto my-24 px-6 py-10 rounded-3xl bg-slate-900/90 border border-pink-500/30 backdrop-blur-2xl text-center space-y-6 shadow-2xl shadow-pink-500/10">
                  <div className="w-16 h-16 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center mx-auto border border-pink-500/30 shadow-lg shadow-pink-500/20">
                    <Lock className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white tracking-tight">Library is Locked</h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Your personalized anime tracking watchlist and private notes are protected by your 4-digit Profile PIN.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <button
                      onClick={() => {
                        setPendingUnlockTab('library');
                        setIsPinModalOpen(true);
                      }}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white font-bold text-xs shadow-lg shadow-pink-500/25 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>Enter PIN to Unlock</span>
                    </button>
                    <button
                      onClick={() => handleSelectTab('home')}
                      className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition cursor-pointer"
                    >
                      Return to Home
                    </button>
                  </div>
                </div>
              ) : (
                <MyLibraryView
                  library={library}
                  onOpenDetails={handleOpenDetails}
                  onPlayStream={handlePlayStream}
                  onUpdateStatus={handleUpdateStatus}
                  onUpdateProgress={handleUpdateProgress}
                  onGoToDiscover={() => handleSelectTab('home')}
                  onSelectGenre={handleSelectGenre}
                  onSelectStudio={handleSelectStudio}
                  onInspect3DCard={handleInspect3DCard}
                  isTwoWaySyncActive={Boolean(settings.twoWaySyncEnabled && (settings.anilistToken || settings.importUsername))}
                  onOpenSavedReel={(reel) => {
                    setTargetReelId(reel.id);
                    setTargetReelFilterMode('saved');
                    setCurrentTab('reels');
                  }}
                />
              )
            )}

            {/* VIEW 6: CARDS & CHARACTER BINDER INVENTORY (PIN-PROTECTED) */}
            {currentTab === 'cards' && (
              Boolean(settings.profilePinEnabled && settings.profilePin && !isPinUnlocked) ? (
                <div className="max-w-md mx-auto my-24 px-6 py-10 rounded-3xl bg-slate-900/90 border border-purple-500/30 backdrop-blur-2xl text-center space-y-6 shadow-2xl shadow-purple-500/10">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/30 shadow-lg shadow-purple-500/20">
                    <Lock className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white tracking-tight">Cards Binder Locked</h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Your holographic cards and character binder collections are protected with your 4-digit Profile PIN.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <button
                      onClick={() => {
                        setPendingUnlockTab('cards');
                        setIsPinModalOpen(true);
                      }}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>Enter PIN to Unlock</span>
                    </button>
                    <button
                      onClick={() => handleSelectTab('home')}
                      className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition cursor-pointer"
                    >
                      Return to Home
                    </button>
                  </div>
                </div>
              ) : (
                <CardInventoryView
                  library={library}
                  onOpenDetails={handleOpenDetails}
                  onInspect3DCard={handleInspect3DCard}
                  onNavigateToArcade={() => handleSelectTab('arcade')}
                  onNavigateToLibrary={() => handleSelectTab('library')}
                />
              )
            )}

            {/* VIEW 7: ACCOUNT & SETTINGS PERSISTENCE */}
            {(currentTab === 'account' || (currentTab as string) === 'settings') && (
              <AccountView
                settings={settings}
                onSaveSettings={handleSaveSettings}
                onImportList={handleImportPlaylist}
                onShowToast={showToast}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
                libraryCount={library.length}
                isPinUnlocked={isPinUnlocked}
                onLockSession={handleLockSession}
                onUnlockSession={handleUnlockSession}
                onNavigateToReels={(reelId) => {
                  if (reelId) setTargetReelId(reelId);
                  handleSelectTab('reels');
                }}
                onReplayIntro={handleReplayIntro}
                onOpenUsernameModal={() => setIsUsernameModalOpen(true)}
                onNavigateToMessages={() => handleSelectTab('messages')}
              />
            )}

            {/* VIEW 8: DIRECT MESSAGES (CHAT) & DISAPPEARING CONVERSATIONS */}
            {currentTab === 'messages' && (
              <MessagesView
                currentUserProfile={currentUserProfile}
                settings={settings}
                onOpenOnboarding={() => setIsUsernameModalOpen(true)}
                onNavigateToReel={(reelId) => {
                  setTargetReelId(reelId);
                  handleSelectTab('reels');
                }}
                onOpenAnimeDetail={(animeId) => {
                  fetchAnimeDetails(animeId).then(anime => {
                    if (anime) handleOpenDetails(anime as unknown as Anime);
                  }).catch((err) => {
                    console.warn('Could not load anime details:', err);
                  });
                }}
                onShowToast={showToast}
                initialChatId={targetDmChatId}
                initialTargetUser={targetDmUser}
              />
            )}
          </>
        )}
      </main>

      {/* Floating Action Bar: AI Sensei & Shortcuts (Hidden in Reels) */}
      {!isReelsActive && (
        <div className="fixed bottom-16 lg:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-2">
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className="hidden sm:flex p-3 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/70 backdrop-blur-xl shadow-xl transition active:scale-95 cursor-pointer"
            title="Keyboard Shortcuts Guide (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setAiContextAnime(null);
              setIsAiModalOpen(true);
            }}
            className="group relative flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-xs shadow-xl shadow-indigo-600/40 hover:shadow-indigo-500/60 border border-indigo-400/40 hover:scale-105 transition active:scale-95 cursor-pointer"
            title="Open AniAI Sensei Chatbot"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
            <span className="hidden sm:inline">Ask Sensei</span>
          </button>
        </div>
      )}

      {/* Mobile Bottom Bar (Always available on mobile for smooth navigation and tab refresh) */}
      <MobileBottomNav
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        settings={settings}
        libraryCount={library.length}
        isPinLocked={Boolean(settings.profilePinEnabled && settings.profilePin && !isPinUnlocked)}
        unreadMessagesCount={unreadMessagesCount}
        onOpenAiSensei={() => {
          setAiContextAnime(null);
          setIsAiModalOpen(true);
        }}
      />

      {/* 360° Interactive 3D Holographic Anime Card Showcase Modal */}
      <InteractiveAnime3DCardModal
        anime={selectedAnimeFor3D}
        isOpen={is3DCardModalOpen}
        onClose={() => setIs3DCardModalOpen(false)}
        onOpenDetails={anime => {
          setIs3DCardModalOpen(false);
          handleOpenDetails(anime);
        }}
        onPlayStream={(anime, ep, time) => {
          setIs3DCardModalOpen(false);
          handlePlayStream(anime, ep, time);
        }}
        onOpenTrailer={handleOpenTrailer}
        onUpdateStatus={handleUpdateStatus}
        userLibrary={library}
      />

      {/* Detailed Anime Modal / Page View */}
      <AnimeDetailModal
        anime={selectedAnime}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        userItem={selectedAnimeUserItem}
        onUpdateStatus={handleUpdateStatus}
        onUpdateProgress={handleUpdateProgress}
        onUpdateScore={handleUpdateScore}
        onOpenTrailer={handleOpenTrailer}
        onNavigateToAnime={anime => {
          setSelectedAnime(anime);
        }}
        onSelectGenre={handleSelectGenre}
        onSelectStudio={handleSelectStudio}
        isTwoWaySyncActive={Boolean(settings.twoWaySyncEnabled && settings.anilistToken)}
        initialEpisode={streamInitialEpisode}
        initialTime={streamInitialTime}
        startInWatchMode={startInWatchMode}
        onPlayStream={handlePlayStream}
        onPlayThemeTrack={handlePlayThemeTrack}
        onShareToDm={(anime) => {
          setShareToDmAnime(anime);
          setShareToDmReel(null);
          setIsShareToDmOpen(true);
        }}
      />

      {/* Trailer Player Modal */}
      {trailerData && (
        <TrailerModal
          trailer={trailerData.trailer}
          animeTitle={trailerData.title}
          isOpen={Boolean(trailerData)}
          onClose={() => setTrailerData(null)}
        />
      )}

      {/* AniAI Anime Sensei AI Chat Assistant Modal */}
      <AiAnimeSenseiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        currentAnime={aiContextAnime || selectedAnime}
        userLibrary={library}
        onOpenDetails={handleOpenDetails}
        onPlayStream={handlePlayStream}
      />

      {/* Anime Gacha & Rarity Summon Modal */}
      <AnimeGachaModal
        isOpen={isGachaModalOpen}
        onClose={() => setIsGachaModalOpen(false)}
        onOpenDetails={handleOpenDetails}
        onPlayStream={handlePlayStream}
        onUpdateStatus={handleUpdateStatus}
        userLibrary={library}
      />

      {/* Profile PIN Unlock Modal */}
      <PinUnlockModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingUnlockTab(null);
        }}
        onSuccess={handlePinUnlockSuccess}
        targetSectionName={pendingUnlockTab === 'cards' ? 'Cards Binder' : 'My Library'}
        correctPin={settings.profilePin}
        backupQuestion={settings.profilePinBackupQuestion}
        backupAnswer={settings.profilePinBackupAnswer}
        onResetPin={handleResetPinFromRecovery}
        onNavigateToAccount={() => {
          setIsPinModalOpen(false);
          setPendingUnlockTab(null);
          setCurrentTab('account');
        }}
      />

      {/* Keyboard Shortcuts Guide Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Global Anime Theme Song Jukebox Player */}
      {activeThemeSong && (
        <GlobalThemePlayer
          track={activeThemeSong}
          onClose={() => setActiveThemeSong(null)}
        />
      )}

      {/* AniLove 6–7 Second Cinematic Logo Opening Animation */}
      {showIntroSplash && (
        <AppIntroSplash
          isDataReady={!isMainLoading && trendingAnime.length > 0}
          onFinish={handleFinishIntro}
          soundEnabled={settings.soundEffectsEnabled ?? true}
          minDuration={7000}
        />
      )}

      {/* Unique Username & Chat Profile Onboarding Modal */}
      <UsernameOnboardingModal
        isOpen={isUsernameModalOpen}
        onClose={() => setIsUsernameModalOpen(false)}
        currentUser={currentFirebaseUser}
        userId={currentFirebaseUser?.uid}
        settings={settings}
        currentSettings={settings}
        onProfileCreated={(profile) => {
          setCurrentUserProfile(profile);
          try {
            localStorage.setItem('anilove_chat_profile', JSON.stringify(profile));
          } catch {}
          handleSaveSettings({
            ...settings,
            uniqueUsername: profile.username,
            customDisplayName: profile.displayName,
            customAvatar: profile.avatar,
            userBio: profile.bio,
          });
          showToast('success', `Welcome @${profile.username}! Your handle is registered.`, 'Username Claimed');
        }}
        onShowToast={showToast}
        onSaveSettings={handleSaveSettings}
      />

      {/* Share Reel or Anime to DM Modal */}
      <ShareToDmModal
        isOpen={isShareToDmOpen}
        onClose={() => {
          setIsShareToDmOpen(false);
          setShareToDmReel(null);
          setShareToDmAnime(null);
        }}
        currentUserProfile={currentUserProfile}
        reelToShare={shareToDmReel}
        animeToShare={shareToDmAnime}
        onOpenLoginOrUsername={() => {
          setIsShareToDmOpen(false);
          if (!currentUserProfile) {
            setIsUsernameModalOpen(true);
          } else {
            handleSelectTab('account');
          }
        }}
        onShowToast={showToast}
      />
    </div>
  );
}

export default App;
