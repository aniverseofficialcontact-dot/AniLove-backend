import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, Play, Star, Plus, Minus, Check, Bookmark, Tv, Film,
  Calendar, Clock, Building2, Sparkles, Share2, Send, ExternalLink,
  ChevronLeft, ChevronRight, Users, MessageSquare, AlertCircle, RefreshCw, Layers,
  MoreVertical, Music, Headphones, Info, Eye, EyeOff, Search,
  LayoutGrid, List, Download, ChevronDown, ChevronUp, FastForward,
  CheckCircle2, Volume2, Sparkle, Compass
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Anime, AnimeDetail, UserMediaListItem, MediaListStatus, AnimeTrailer, ThumbnailAppearance } from '../types';
import { fetchAnimeDetails, sanitizeDescription } from '../services/anilist';
import { apiFetch } from '../services/apiClient';
import { ProVideoPlayer } from './ProVideoPlayer';
import { AnimeWatchOrderTab } from './AnimeWatchOrderTab';
import { computeTotalEpisodes, generateEpisodeRanges } from '../services/episodeHelper';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';
import {
  checkIsFillerEpisode,
  getArcOrFormattedTitle,
  fetchExtendedEpisodesFromJikanOrKitsu,
  getCanonicalEpisodeArtwork,
  ExtendedEpisodeInfo,
} from '../services/episodeMetadataService';

export interface ResolvedThemeTrack {
  id?: number;
  type: 'OP' | 'ED';
  slug?: string;
  sequence?: number;
  songTitle: string;
  artists?: string;
  audioUrl?: string;
  videoUrl?: string;
  rawAudioUrl?: string;
  rawVideoUrl?: string;
  animeName?: string;
  episodes?: string;
}

interface AnimeDetailModalProps {
  anime: Anime | null;
  isOpen: boolean;
  onClose: () => void;
  userItem?: UserMediaListItem;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onUpdateProgress: (anime: Anime, newProgress: number) => void;
  onUpdateScore: (anime: Anime, newScore: number) => void;
  onOpenTrailer: (trailer: AnimeTrailer, title: string) => void;
  onNavigateToAnime: (anime: Anime) => void;
  onSelectGenre?: (genre: string) => void;
  onSelectStudio?: (studio: string) => void;
  isTwoWaySyncActive: boolean;
  initialEpisode?: number;
  initialTime?: number;
  startInWatchMode?: boolean;
  onPlayStream?: (anime: Anime, episodeNumber?: number, startTime?: number) => void;
  onPlayThemeTrack?: (
    trackTitle: string,
    previewUrl?: string,
    videoUrl?: string,
    themeType?: 'OP' | 'ED',
    themeSlug?: string,
    artists?: string,
    animeName?: string
  ) => void;
  onShareToDm?: (anime: Anime) => void;
}

type DetailTab = 'overview' | 'episodes' | 'watch_order' | 'relations' | 'characters' | 'music';

export const AnimeDetailModal: React.FC<AnimeDetailModalProps> = ({
  anime,
  isOpen,
  onClose,
  userItem,
  onUpdateStatus,
  onUpdateProgress,
  onUpdateScore,
  onOpenTrailer,
  onNavigateToAnime,
  onSelectGenre,
  onSelectStudio,
  isTwoWaySyncActive,
  initialEpisode,
  initialTime,
  startInWatchMode,
  onPlayStream,
  onPlayThemeTrack,
  onShareToDm,
}) => {
  const [details, setDetails] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [themesData, setThemesData] = useState<{
    openings: string[];
    endings: string[];
    resolvedTracks: ResolvedThemeTrack[];
  }>({ openings: [], endings: [], resolvedTracks: [] });
  const [themeLoading, setThemeLoading] = useState<string | null>(null);
  
  // Streaming & Episode UI State
  const [playingEpisode, setPlayingEpisode] = useState<number | null>(null);
  const [episodeSearchQuery, setEpisodeSearchQuery] = useState<string>('');
  const [episodeViewMode, setEpisodeViewMode] = useState<'list' | 'grid'>('list');
  const [showFullSynopsis, setShowFullSynopsis] = useState<boolean>(false);
  const [audioMode, setAudioMode] = useState<'SUB' | 'DUB'>('SUB');

  const recommendationsScroll = useHorizontalScroll({ step: 320 });
  const modalTabsScroll = useHorizontalScroll({ step: 200 });

  const playerRef = useRef<HTMLDivElement>(null);

  // Close kebab menu on outside click
  useEffect(() => {
    const handleDocumentClick = () => {
      setActiveMenuId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const prevIsOpenRef = useRef(false);

  // Load detailed anime relations & recommendations
  useEffect(() => {
    if (!isOpen || !anime) {
      setDetails(null);
      prevIsOpenRef.current = false;
      return;
    }

    const isInitialOpen = !prevIsOpenRef.current;
    prevIsOpenRef.current = true;

    let isMounted = true;
    setLoading(true);

    if (startInWatchMode || initialEpisode) {
      setActiveTab('episodes');
      setPlayingEpisode(initialEpisode || (userItem?.progress ? userItem.progress : null));
    } else if (isInitialOpen) {
      setActiveTab('overview');
      setPlayingEpisode(null);
    } else {
      // If modal was already open (e.g. user selected another season while on episodes tab), keep the active tab
      setPlayingEpisode(null);
    }

    setEpisodeSearchQuery('');
    setSelectedEpisodeRange('all');
    setShowFullSynopsis(false);

    fetchAnimeDetails(anime.id)
      .then(data => {
        if (isMounted) {
          setDetails(data);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Error fetching anime details:', err);
        if (isMounted) {
          setLoading(false);
        }
      });

    // Fetch theme song tracks & pre-resolve stream URLs concurrently
    const displayTitle = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || '';
    const romTitle = anime.title?.romaji || '';
    const engTitle = anime.title?.english || '';
    if (displayTitle) {
      apiFetch(`/api/anime-themes?title=${encodeURIComponent(displayTitle)}&romaji=${encodeURIComponent(romTitle)}&english=${encodeURIComponent(engTitle)}`)
        .then(res => res.json())
        .then(data => {
          if (isMounted && data) {
            setThemesData({
              openings: data.openings || [],
              endings: data.endings || [],
              resolvedTracks: data.resolvedTracks || [],
            });
          }
        })
        .catch(err => console.error('Failed to load anime themes:', err));
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, anime?.id, startInWatchMode, initialEpisode]);

  // Handle ESC key to return to main catalog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is active to prevent scroll chaining
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const currentAnime = details || anime;
  const title = currentAnime?.title?.english || currentAnime?.title?.romaji || currentAnime?.title?.userPreferred || 'Unknown Title';
  const nativeTitle = currentAnime?.title?.native;
  const romajiTitle = currentAnime?.title?.romaji;
  const coverUrl = currentAnime?.coverImage?.extraLarge || currentAnime?.coverImage?.large || currentAnime?.coverImage?.medium || undefined;
  const bannerUrl = currentAnime?.bannerImage || coverUrl;
  const score = currentAnime?.averageScore ? (currentAnime.averageScore / 10).toFixed(1) : null;
  const episodesTotal = typeof currentAnime?.episodes === 'number' ? currentAnime.episodes : null;
  const cleanDescription = sanitizeDescription(currentAnime?.description);

  const currentProgress = userItem?.progress ?? 0;
  const currentStatus = userItem?.status;
  const currentScore = userItem?.score ?? 0;

  const [episodesInputValue, setEpisodesInputValue] = useState<string>('0');

  useEffect(() => {
    setEpisodesInputValue(String(currentProgress));
  }, [currentProgress]);

  const primaryStudio = currentAnime?.studios?.nodes?.[0]?.name;

  const handleStepProgress = (delta: number) => {
    if (!currentAnime) return;
    const max = episodesTotal || 9999;
    const nextVal = Math.max(0, Math.min(max, currentProgress + delta));
    if (nextVal !== currentProgress) {
      if (episodesTotal && nextVal >= episodesTotal) {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        onUpdateStatus(currentAnime, 'COMPLETED');
      } else if (nextVal > 0 && (!currentStatus || currentStatus === 'PLANNING' || currentStatus === 'COMPLETED')) {
        onUpdateStatus(currentAnime, 'CURRENT');
      }
      onUpdateProgress(currentAnime, nextVal);
      setEpisodesInputValue(String(nextVal));
    }
  };

  const handleDirectProgressChange = (valStr: string) => {
    if (!currentAnime) return;
    setEpisodesInputValue(valStr);
    if (valStr === '') return;
    const num = parseInt(valStr, 10);
    if (isNaN(num)) return;

    const max = episodesTotal || 9999;
    const clamped = Math.max(0, Math.min(max, num));

    if (clamped !== currentProgress) {
      if (episodesTotal && clamped >= episodesTotal) {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        onUpdateStatus(currentAnime, 'COMPLETED');
      } else if (clamped > 0 && (!currentStatus || currentStatus === 'PLANNING' || currentStatus === 'COMPLETED')) {
        onUpdateStatus(currentAnime, 'CURRENT');
      }
      onUpdateProgress(currentAnime, clamped);
    }
  };

  const handleCommitEpisodeInput = () => {
    if (!currentAnime) return;
    if (episodesInputValue === '') {
      setEpisodesInputValue(String(currentProgress));
      return;
    }
    const num = parseInt(episodesInputValue, 10);
    const max = episodesTotal || 9999;
    const clamped = isNaN(num) ? currentProgress : Math.max(0, Math.min(max, num));
    setEpisodesInputValue(String(clamped));

    if (clamped !== currentProgress) {
      if (episodesTotal && clamped >= episodesTotal) {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        onUpdateStatus(currentAnime, 'COMPLETED');
      } else if (clamped > 0 && (!currentStatus || currentStatus === 'PLANNING' || currentStatus === 'COMPLETED')) {
        onUpdateStatus(currentAnime, 'CURRENT');
      }
      onUpdateProgress(currentAnime, clamped);
    }
  };

  const handleStudioClick = (studioName: string) => {
    if (onSelectStudio) {
      onSelectStudio(studioName);
      onClose();
    }
  };

  const handleGenreClick = (genreName: string) => {
    if (onSelectGenre) {
      onSelectGenre(genreName);
      onClose();
    }
  };

  const handleTriggerOP = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!onPlayThemeTrack) return;

    // Check if OP is already pre-resolved in memory -> Instant 0ms playback!
    const matched = themesData.resolvedTracks.find(t => t.type === 'OP') || themesData.resolvedTracks[0];
    if (matched && (matched.rawAudioUrl || matched.audioUrl || matched.videoUrl)) {
      const streamUrl = matched.rawAudioUrl || matched.audioUrl;
      const vidUrl = matched.rawVideoUrl || matched.videoUrl;
      const songName = matched.artists ? `${matched.songTitle} - ${matched.artists}` : matched.songTitle;
      onPlayThemeTrack(songName, streamUrl, vidUrl, 'OP', matched.slug, matched.artists, matched.animeName || title);
      return;
    }

    const opSong = themesData.openings[0] || `${title} Opening Theme`;
    setThemeLoading('op_side_toggle');
    try {
      const fullRes = await apiFetch(`/api/theme-full-track?query=${encodeURIComponent(romajiTitle || title + ' ' + (themesData.openings[0] || 'opening theme'))}`);
      const fullData = await fullRes.json();
      if (fullData.audioUrl || fullData.rawAudioUrl || fullData.videoUrl) {
        onPlayThemeTrack(
          fullData.title ? `${title} - ${fullData.title}` : opSong,
          fullData.rawAudioUrl || fullData.audioUrl,
          fullData.rawVideoUrl || fullData.videoUrl,
          'OP',
          fullData.themeSlug,
          fullData.artists,
          fullData.animeName || title
        );
        return;
      }
      const res = await apiFetch(`/api/theme-preview?query=${encodeURIComponent(title + ' ' + (themesData.openings[0] || 'opening'))}`);
      const data = await res.json();
      if (data.previewUrl || data.rawAudioUrl || data.videoUrl) {
        onPlayThemeTrack(
          data.trackName ? `${title} - ${data.trackName}` : opSong,
          data.rawAudioUrl || data.previewUrl,
          data.rawVideoUrl || data.videoUrl,
          'OP',
          undefined,
          data.artistName,
          title
        );
      } else {
        onPlayThemeTrack(opSong);
      }
    } catch {
      onPlayThemeTrack(opSong);
    } finally {
      setThemeLoading(null);
    }
  };

  const handleTriggerED = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!onPlayThemeTrack) return;

    // Check if ED is already pre-resolved in memory -> Instant 0ms playback!
    const matched = themesData.resolvedTracks.find(t => t.type === 'ED');
    if (matched && (matched.rawAudioUrl || matched.audioUrl || matched.videoUrl)) {
      const streamUrl = matched.rawAudioUrl || matched.audioUrl;
      const vidUrl = matched.rawVideoUrl || matched.videoUrl;
      const songName = matched.artists ? `${matched.songTitle} - ${matched.artists}` : matched.songTitle;
      onPlayThemeTrack(songName, streamUrl, vidUrl, 'ED', matched.slug, matched.artists, matched.animeName || title);
      return;
    }

    const edSong = themesData.endings[0] || `${title} Ending Theme`;
    setThemeLoading('ed_side_toggle');
    try {
      const fullRes = await apiFetch(`/api/theme-full-track?query=${encodeURIComponent(romajiTitle || title + ' ' + (themesData.endings[0] || 'ending theme'))}`);
      const fullData = await fullRes.json();
      if (fullData.audioUrl || fullData.rawAudioUrl || fullData.videoUrl) {
        onPlayThemeTrack(
          fullData.title ? `${title} - ${fullData.title}` : edSong,
          fullData.rawAudioUrl || fullData.audioUrl,
          fullData.rawVideoUrl || fullData.videoUrl,
          'ED',
          fullData.themeSlug,
          fullData.artists,
          fullData.animeName || title
        );
        return;
      }
      const res = await apiFetch(`/api/theme-preview?query=${encodeURIComponent(title + ' ' + (themesData.endings[0] || 'ending'))}`);
      const data = await res.json();
      if (data.previewUrl || data.rawAudioUrl || data.videoUrl) {
        onPlayThemeTrack(
          data.trackName ? `${title} - ${data.trackName}` : edSong,
          data.rawAudioUrl || data.previewUrl,
          data.rawVideoUrl || data.videoUrl,
          'ED',
          undefined,
          data.artistName,
          title
        );
      } else {
        onPlayThemeTrack(edSong);
      }
    } catch {
      onPlayThemeTrack(edSong);
    } finally {
      setThemeLoading(null);
    }
  };

  const handleCopyLink = () => {
    const shareText = `${title} — Watch & Track on AniLove\n${window.location.origin}`;
    navigator.clipboard.writeText(shareText).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Episode pagination chunk range
  const [selectedEpisodeRange, setSelectedEpisodeRange] = useState<string>('all');
  const [extraEpisodeData, setExtraEpisodeData] = useState<Record<number, ExtendedEpisodeInfo>>({});

  // Background fetcher for extended metadata for long anime
  useEffect(() => {
    if (!currentAnime) return;
    let isMounted = true;
    const targetEp = playingEpisode || currentProgress || 1;
    const page = Math.floor((targetEp - 1) / 25) + 1;

    fetchExtendedEpisodesFromJikanOrKitsu(currentAnime, page).then(data => {
      if (isMounted && data && Object.keys(data).length > 0) {
        setExtraEpisodeData(prev => ({ ...prev, ...data }));
      }
    });

    if (page !== 1) {
      fetchExtendedEpisodesFromJikanOrKitsu(currentAnime, 1).then(data => {
        if (isMounted && data && Object.keys(data).length > 0) {
          setExtraEpisodeData(prev => ({ ...prev, ...data }));
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [currentAnime?.id, currentAnime?.idMal, playingEpisode, selectedEpisodeRange]);

  // Generate complete episodes catalog synchronized with AniList (with franchise sequel offset detection)
  const episodeList = useMemo(() => {
    if (!currentAnime) return [];

    const rawStreaming = details?.streamingEpisodes || (currentAnime as any).streamingEpisodes || [];
    const total = computeTotalEpisodes(currentAnime, details);
    const banner = currentAnime.bannerImage || currentAnime.coverImage?.extraLarge || bannerUrl || coverUrl;

    const titleLower = (title || '').toLowerCase();
    const isSequel =
      titleLower.includes('season 2') ||
      titleLower.includes('2nd season') ||
      titleLower.includes('season 3') ||
      titleLower.includes('3rd season') ||
      titleLower.includes('season 4') ||
      titleLower.includes('final season') ||
      titleLower.includes('part 2') ||
      (total < rawStreaming.length && rawStreaming.length >= total + 10);

    const offset = isSequel && rawStreaming.length > total ? rawStreaming.length - total : 0;
    const seasonStreaming = isSequel && offset > 0 ? rawStreaming.slice(offset) : rawStreaming;

    // Quick lookup map for rawStreaming by title/number to avoid O(N^2) scans
    const streamMap = new Map<number, any>();
    if (rawStreaming && rawStreaming.length > 0) {
      rawStreaming.forEach((s: any) => {
        if (s?.title) {
          const match = s.title.match(/(?:episode|ep|ep\.)\s*(\d+)/i) || s.title.match(/^(\d+)[\.\s]/);
          if (match) {
            const parsed = parseInt(match[1], 10);
            if (!isNaN(parsed) && !streamMap.has(parsed)) {
              streamMap.set(parsed, s);
            }
          }
        }
      });
    }

    return Array.from({ length: Math.max(1, total) }, (_, i) => {
      const epNum = i + 1;
      const absoluteEpNum = epNum + offset;

      // 1. Direct index in slice or map lookup
      let streamInfo = seasonStreaming[i] || streamMap.get(epNum) || streamMap.get(absoluteEpNum);
      const extra = extraEpisodeData[epNum];

      // Check if matched stream is from Season 1 while this is Season 2
      let rawTitle = streamInfo?.title;
      if (rawTitle) {
        // Clean title prefixes
        rawTitle = rawTitle
          .replace(/^Episode\s*\d+\s*[-:]\s*/i, '')
          .replace(/^EP\s*\d+\s*[-:]\s*/i, '')
          .replace(/^\d+\.\s*/i, '')
          .trim();
      }

      const epTitle = extra?.title || getArcOrFormattedTitle(title, epNum, rawTitle);
      const epThumb = extra?.thumbnail || streamInfo?.thumbnail || getCanonicalEpisodeArtwork(title, epNum, currentAnime) || banner || coverUrl;
      const isFiller = extra?.filler !== undefined ? extra.filler : checkIsFillerEpisode(title, epNum);

      return {
        number: epNum,
        title: epTitle,
        thumbnail: epThumb,
        url: streamInfo?.url,
        duration: `${currentAnime.duration || 24}m`,
        synopsis: extra?.synopsis || cleanDescription || `Episode ${epNum} of ${title}.`,
        filler: isFiller,
      };
    });
  }, [currentAnime, details, bannerUrl, coverUrl, title, cleanDescription, extraEpisodeData]);

  // Episode chunk ranges for long anime (e.g. Naruto, Bleach, Black Clover, One Piece)
  const episodeRanges = useMemo(() => {
    const total = episodeList.length;
    if (total <= 50) return [];
    const chunkSize = 50;
    const ranges: Array<{ label: string; start: number; end: number }> = [];
    for (let i = 0; i < total; i += chunkSize) {
      const start = i + 1;
      const end = Math.min(i + chunkSize, total);
      ranges.push({ label: `${start}–${end}`, start, end });
    }
    return ranges;
  }, [episodeList.length]);

  // Auto-reset range filter if invalid for current anime (e.g. anime has <= 50 episodes or range exceeds total)
  useEffect(() => {
    if (selectedEpisodeRange !== 'all') {
      const isValid = episodeRanges.some(r => r.label === selectedEpisodeRange);
      if (!isValid) {
        setSelectedEpisodeRange('all');
      }
    }
  }, [selectedEpisodeRange, episodeRanges]);

  // Filtered episodes based on search query and active range
  const filteredEpisodes = useMemo(() => {
    let list = episodeList;

    // Apply Range Filter ONLY if current anime actually has range chunks (>50 episodes) and no active text search
    if (selectedEpisodeRange !== 'all' && episodeRanges.length > 0 && !episodeSearchQuery.trim()) {
      const parts = selectedEpisodeRange.split(/[–\-]/).map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const [start, end] = parts;
        const ranged = list.filter(ep => ep.number >= start && ep.number <= end);
        if (ranged.length > 0) {
          list = ranged;
        }
      }
    }

    if (!episodeSearchQuery.trim()) return list;

    const q = episodeSearchQuery.toLowerCase().trim();
    const cleanNum = q.replace(/^(?:episode|ep|#)\s*/i, '').trim();

    return episodeList.filter(ep => {
      const epNumStr = ep.number.toString();
      if (epNumStr === q || epNumStr === cleanNum) return true;
      if (`episode ${ep.number}`.toLowerCase().includes(q)) return true;
      if (`ep ${ep.number}`.toLowerCase().includes(q)) return true;
      if (ep.title && ep.title.toLowerCase().includes(q)) return true;
      if (ep.synopsis && ep.synopsis.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [episodeList, episodeSearchQuery, selectedEpisodeRange, episodeRanges]);



  if (!isOpen || !anime || !currentAnime) return null;

  return (
    <AnimatePresence>
      <motion.div
        id="anime-detail-page-view"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed inset-0 z-[90] bg-[#090b14] overflow-y-auto overflow-x-hidden text-slate-100 overscroll-contain"
      >
        {/* Sticky Page Navigation Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-3 sm:px-8 py-3 bg-slate-900/80 backdrop-blur-2xl border-b border-white/10 shadow-lg w-full max-w-full min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              id="detail-back-to-catalog-btn"
              onClick={onClose}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white text-xs sm:text-sm font-bold border border-white/10 transition active:scale-95 shrink-0 shadow-sm backdrop-blur-md cursor-pointer"
              title="Return to Discover"
            >
              <ArrowLeft className="w-4 h-4 text-pink-400" />
              <span>Back</span>
            </button>

            {/* Breadcrumb Trail */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 truncate">
              <span className="hover:text-slate-200 cursor-pointer" onClick={onClose}>Discover</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              {currentAnime.genres && currentAnime.genres[0] && (
                <>
                  <button
                    onClick={() => handleGenreClick(currentAnime.genres![0])}
                    className="hover:text-pink-400 font-medium text-slate-300 transition"
                  >
                    {currentAnime.genres[0]}
                  </button>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                </>
              )}
              <span className="font-semibold text-slate-200 truncate">{title}</span>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {onShareToDm && (
              <button
                onClick={() => onShareToDm(currentAnime)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 hover:text-pink-200 text-xs font-semibold border border-pink-500/30 transition backdrop-blur-md cursor-pointer shrink-0"
                title="Send Anime in Direct Message"
              >
                <Send className="w-3.5 h-3.5 -rotate-12 text-pink-400" />
                <span className="hidden sm:inline">Send to DM</span>
              </button>
            )}

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition backdrop-blur-md cursor-pointer shrink-0"
              title="Share Anime"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-pink-400" />
                  <span>Share</span>
                </>
              )}
            </button>

            {currentAnime.siteUrl && (
              <a
                href={currentAnime.siteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-pink-300 hover:text-pink-200 text-xs font-semibold transition backdrop-blur-md shrink-0"
                title="View on AniList.co"
              >
                <span>AniList</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-400 hover:text-white transition backdrop-blur-md cursor-pointer shrink-0"
              title="Close View"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Hero Panorama Banner Backdrop */}
        <div className="relative w-full h-56 sm:h-80 lg:h-96 bg-slate-950 overflow-hidden shrink-0">
          {bannerUrl && (
            <img
              src={bannerUrl}
              alt={title}
              className="w-full h-full object-cover object-center filter brightness-[0.55] scale-105"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090b14] via-[#090b14]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#090b14]/80 via-transparent to-transparent" />
        </div>

        {/* Main Content Area */}
        <div className="relative max-w-7xl w-full mx-auto px-3 sm:px-8 pb-20 -mt-28 sm:-mt-36 z-10 min-w-0">
          {/* Header Card Profile */}
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left w-full min-w-0">
            {/* Large Poster Image */}
            <div className="relative w-40 sm:w-52 lg:w-60 aspect-[3/4] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-700/80 bg-slate-900 shrink-0 ring-4 ring-black/40">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white font-bold text-sm p-4 text-center">
                  {title}
                </div>
              )}
              {score && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/85 backdrop-blur-md text-amber-300 text-xs sm:text-sm font-extrabold border border-amber-500/40 shadow-lg pointer-events-none">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{score}</span>
                </div>
              )}
            </div>

            {/* Title, Studio & Key Metas */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
                {currentAnime.format && (
                  <span className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider">
                    {currentAnime.format.replace('_', ' ')}
                  </span>
                )}
                {currentAnime.status && (
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                    {currentAnime.status}
                  </span>
                )}
                {currentAnime.seasonYear && (
                  <span className="text-xs text-slate-400 font-medium">
                    {currentAnime.season || ''} {currentAnime.seasonYear}
                  </span>
                )}
                {currentAnime.duration && (
                  <span className="text-xs text-slate-400 font-medium">
                    • {currentAnime.duration} mins/ep
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                {title}
              </h1>

              {(romajiTitle || nativeTitle) && (
                <p className="text-xs sm:text-sm text-slate-400">
                  {romajiTitle !== title ? romajiTitle : ''} {nativeTitle && `• ${nativeTitle}`}
                </p>
              )}

              {/* Studio and Genre Badges */}
              <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start pt-1">
                {/* Static Studio Tag */}
                {primaryStudio && (
                  <span
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/90 text-indigo-300 text-xs font-semibold border border-slate-700/70 select-none shadow-sm"
                  >
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Studio: {primaryStudio}</span>
                  </span>
                )}

                {/* Clickable Genre Tags */}
                {currentAnime.genres && currentAnime.genres.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => handleGenreClick(g)}
                    className="px-3 py-1 rounded-lg bg-slate-800/85 hover:bg-slate-700 text-slate-200 hover:text-indigo-300 text-xs font-medium border border-slate-700/70 hover:border-indigo-500/50 hover:scale-105 active:scale-95 transition cursor-pointer"
                    title={`Click to filter by genre: ${g}`}
                  >
                    #{g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Bar & Library Status Dashboard */}
          <div className="mt-8 p-4 sm:p-6 rounded-2xl bg-[#111424] border border-slate-800/90 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-5">
            {/* Left Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto justify-center md:justify-start">
              <button
                id="detail-watch-stream-btn"
                onClick={() => {
                  setActiveTab('episodes');
                  setPlayingEpisode(null);
                  setTimeout(() => {
                    const episodesTarget = document.getElementById('modal-episodes-section-title') || document.getElementById('modal-tab-nav');
                    if (episodesTarget) {
                      episodesTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 80);
                }}
                className="flowable-watch-btn flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm transition active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Watch Episodes</span>
              </button>

              {currentAnime.trailer && currentAnime.trailer.id && (
                <button
                  id="detail-watch-trailer-btn"
                  onClick={() => onOpenTrailer(currentAnime.trailer!, title)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-sm border border-slate-700 transition"
                >
                  <Film className="w-4 h-4 text-red-400" />
                  <span>Trailer</span>
                </button>
              )}

              {/* Status Dropdown */}
              <div className="relative">
                <select
                  id="detail-status-select"
                  value={currentStatus || ''}
                  onChange={e => onUpdateStatus(currentAnime, e.target.value as MediaListStatus)}
                  className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold outline-none cursor-pointer hover:bg-slate-700 transition shadow-inner"
                >
                  <option value="">+ Add to Library</option>
                  <option value="CURRENT">Watching</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PLANNING">Planning</option>
                  <option value="PAUSED">Paused</option>
                  <option value="DROPPED">Dropped</option>
                </select>
              </div>
            </div>

            {/* Right Tracking Controls: Episode Counter & Score Rating */}
            <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end w-full lg:w-auto">
              {/* Episode Stepper & Direct Editable Number Box */}
              <div className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
                <div className="flex flex-col text-left pl-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Episodes</span>
                  {episodesTotal && (
                    <span className="text-[9px] text-indigo-400 font-bold">Max: {episodesTotal} eps</span>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    disabled={currentProgress <= 0}
                    onClick={() => handleStepProgress(-1)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition active:scale-95 cursor-pointer"
                    title="Decrease episode (-1)"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  {/* Direct Number Input */}
                  <div className="flex items-center gap-1 px-1">
                    <input
                      type="number"
                      min={0}
                      max={episodesTotal || 9999}
                      value={episodesInputValue}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setEpisodesInputValue('');
                          return;
                        }
                        const parsed = parseInt(raw, 10);
                        const max = episodesTotal || 9999;
                        if (!isNaN(parsed) && parsed > max) {
                          setEpisodesInputValue(String(max));
                          handleDirectProgressChange(String(max));
                        } else {
                          setEpisodesInputValue(raw);
                          handleDirectProgressChange(raw);
                        }
                      }}
                      onBlur={handleCommitEpisodeInput}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleCommitEpisodeInput();
                        }
                      }}
                      title={episodesTotal ? `Type episode number directly (Limit: ${episodesTotal})` : 'Type episode number directly'}
                      className="w-12 sm:w-14 px-1 py-0.5 text-center font-black text-xs sm:text-sm text-indigo-300 bg-slate-900 border border-indigo-500/60 focus:border-indigo-400 rounded outline-none shadow-inner"
                    />
                    <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                      / {episodesTotal ? `${episodesTotal}` : '?'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={episodesTotal !== null && currentProgress >= episodesTotal}
                    onClick={() => handleStepProgress(1)}
                    className={`w-6 h-6 flex items-center justify-center rounded text-white font-bold transition active:scale-95 cursor-pointer ${
                      episodesTotal !== null && currentProgress >= episodesTotal
                        ? 'bg-emerald-600/40 text-emerald-300 cursor-not-allowed opacity-40'
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-600/30'
                    }`}
                    title={episodesTotal !== null && currentProgress >= episodesTotal ? `Completed all ${episodesTotal} episodes!` : 'Increase episode (+1)'}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Score Rating with OP and ED side triggers */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                {/* OP Side Trigger */}
                <button
                  type="button"
                  onClick={handleTriggerOP}
                  disabled={themeLoading === 'op_side_toggle'}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500 text-orange-400 hover:text-white text-xs font-black border border-orange-500/30 transition active:scale-95 cursor-pointer"
                  title="Activate Opening Theme (OP)"
                >
                  <Music className={`w-3 h-3 ${themeLoading === 'op_side_toggle' ? 'animate-spin' : ''}`} />
                  <span>{themeLoading === 'op_side_toggle' ? '...' : 'OP'}</span>
                </button>

                {/* Score Selector */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/80 rounded-lg border border-slate-800">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <select
                    value={currentScore}
                    onChange={e => onUpdateScore(currentAnime, Number(e.target.value))}
                    className="bg-transparent text-xs font-bold text-amber-300 outline-none cursor-pointer"
                  >
                    <option value="0">Score: --</option>
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => (
                      <option key={n} value={n} className="bg-slate-900 text-slate-100">
                        {n} / 10
                      </option>
                    ))}
                  </select>
                </div>

                {/* ED Side Trigger */}
                <button
                  type="button"
                  onClick={handleTriggerED}
                  disabled={themeLoading === 'ed_side_toggle'}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500 text-indigo-400 hover:text-white text-xs font-black border border-indigo-500/30 transition active:scale-95 cursor-pointer"
                  title="Activate Ending Theme (ED)"
                >
                  <Headphones className={`w-3 h-3 ${themeLoading === 'ed_side_toggle' ? 'animate-spin' : ''}`} />
                  <span>{themeLoading === 'ed_side_toggle' ? '...' : 'ED'}</span>
                </button>
              </div>

              {/* 2-Way Sync Status Pulse */}
              {isTwoWaySyncActive && (
                <div
                  title="Two-Way Cloud Sync Active with AniList"
                  className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>AniList Linked</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div
            id="modal-tab-nav"
            ref={modalTabsScroll.containerRef}
            {...modalTabsScroll.scrollHandlers}
            className="flex items-center gap-2 sm:gap-6 mt-8 border-b border-slate-800/90 overflow-x-auto pb-0 scrollbar-none w-full max-w-full min-w-0 select-none cursor-grab active:cursor-grabbing"
          >
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'episodes', label: 'Episodes' },
              { id: 'watch_order', label: 'Watch Order' },
              { id: 'relations', label: 'Relations' },
              { id: 'characters', label: 'Cast' },
              { id: 'music', label: 'Featured Music' },
            ].map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as DetailTab);
                    if (tab.id === 'episodes' && playingEpisode === null && userItem?.progress) {
                      // Keep in browser mode initially or open last watched if requested
                    }
                  }}
                  className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-bold transition relative whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    active
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  {active && (
                    <motion.div
                      layoutId="detailTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Contents */}
          <div className="py-6 sm:py-8 w-full min-w-0">
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left 2 Cols: Synopsis, Production Info & Swipable Recommendations */}
                <div className="lg:col-span-2 space-y-6 text-left">
                  {/* Synopsis with View More / View Less */}
                  <div className="space-y-3">
                    <h3 className="text-base font-bold uppercase tracking-wider text-slate-300">
                      Synopsis
                    </h3>
                    <div className="relative">
                      <p
                        className={`text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line transition-all duration-300 ${
                          !showFullSynopsis ? 'line-clamp-3 overflow-hidden' : ''
                        }`}
                      >
                        {cleanDescription}
                      </p>
                      {cleanDescription && cleanDescription.length > 180 && (
                        <div className="mt-2 flex items-center">
                          <button
                            type="button"
                            onClick={() => setShowFullSynopsis(prev => !prev)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/70 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer shadow-sm"
                          >
                            <span>{showFullSynopsis ? 'View Less' : 'View More'}</span>
                            {showFullSynopsis ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Studio & Production Metadata Grid */}
                  <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                    <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                      Anime Information & Studio Production
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      {/* Studios List */}
                      <div className="col-span-2 sm:col-span-1">
                        <div className="text-slate-400 font-medium">Studios</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {currentAnime.studios?.nodes && currentAnime.studios.nodes.length > 0 ? (
                            currentAnime.studios.nodes.map(st => (
                              <span
                                key={st.name}
                                className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-semibold text-[11px] border border-slate-700/60"
                              >
                                {st.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-300">Unknown</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-400 font-medium">Duration</div>
                        <div className="font-semibold text-slate-200 mt-1">
                          {currentAnime.duration ? `${currentAnime.duration} mins/ep` : 'Standard'}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-400 font-medium">Source Material</div>
                        <div className="font-semibold text-slate-200 mt-1">
                          {currentAnime.source ? currentAnime.source.replace('_', ' ') : 'Original'}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-400 font-medium">Total Episodes</div>
                        <div className="font-semibold text-slate-200 mt-1">
                          {episodesTotal || 'Ongoing / Unknown'}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-400 font-medium">Community Mean Score</div>
                        <div className="font-semibold text-amber-300 mt-1 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{currentAnime.meanScore ? `${currentAnime.meanScore}%` : 'N/A'}</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-400 font-medium">Popularity Ranking</div>
                        <div className="font-semibold text-slate-200 mt-1">
                          #{currentAnime.popularity || '--'}
                        </div>
                      </div>
                    </div>

                    {/* Genres clickable row */}
                    <div className="pt-3 border-t border-slate-800">
                      <div className="text-slate-400 font-medium text-xs mb-2">Genres (Click to browse)</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {currentAnime.genres && currentAnime.genres.map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleGenreClick(g)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600/80 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition hover:scale-105 active:scale-95"
                            title={`Filter by genre: ${g}`}
                          >
                            #{g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right 1 Col: "More Like This" (Horizontal Left-to-Right Swipable) ABOVE "Official Links & Media" */}
                <div className="space-y-6 text-left">
                  {/* Shifted "More Like This" Recommendations Carousel */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-orange-400" />
                        <span>More Like This</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        {details?.recommendations?.nodes && details.recommendations.nodes.length > 0 && (
                          <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
                            Swipe ↔
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => recommendationsScroll.scrollLeft()}
                            disabled={!recommendationsScroll.canScrollLeft}
                            className="p-1 rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer"
                            title="Scroll left"
                            aria-label="Scroll recommendations left"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => recommendationsScroll.scrollRight()}
                            disabled={!recommendationsScroll.canScrollRight}
                            className="p-1 rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer"
                            title="Scroll right"
                            aria-label="Scroll recommendations right"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {loading ? (
                      <div className="flex gap-3 overflow-x-hidden py-1">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-28 sm:w-32 shrink-0 space-y-2">
                            <div className="aspect-[2/3] w-full bg-slate-900 animate-pulse rounded-none" />
                            <div className="h-3 w-3/4 bg-slate-900 animate-pulse rounded-none" />
                          </div>
                        ))}
                      </div>
                    ) : details?.recommendations?.nodes && details.recommendations.nodes.filter(r => r.mediaRecommendation).length > 0 ? (
                      <div
                        ref={recommendationsScroll.containerRef}
                        {...recommendationsScroll.scrollHandlers}
                        tabIndex={0}
                        aria-label="More Like This recommendations carousel"
                        className="flex items-start gap-3.5 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent focus:outline-none select-none cursor-grab active:cursor-grabbing"
                      >
                        {details.recommendations.nodes
                          .filter(rec => rec.mediaRecommendation)
                          .map(rec => {
                            const recAnime = rec.mediaRecommendation!;
                            const recTitle = recAnime.title?.english || recAnime.title?.romaji || recAnime.title?.userPreferred || 'Anime';
                            const recCover = recAnime.coverImage?.large || recAnime.coverImage?.extraLarge || recAnime.coverImage?.medium;
                            const isMenuOpen = activeMenuId === recAnime.id;

                            return (
                              <div
                                key={rec.id}
                                className="group flex flex-col select-none cursor-pointer w-28 sm:w-32 shrink-0"
                                onClick={() => onNavigateToAnime(recAnime)}
                              >
                                {/* Sharp Rectangle Poster */}
                                <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-900 rounded-none shadow-md border border-slate-800/80 group-hover:border-orange-500/60 transition duration-200">
                                  {recCover ? (
                                    <img
                                      src={recCover}
                                      alt={recTitle}
                                      className="w-full h-full object-cover rounded-none group-hover:scale-105 transition-transform duration-300"
                                      referrerPolicy="no-referrer"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 p-2 text-center">
                                      {recTitle}
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>

                                {/* Anime Title */}
                                <h4
                                  className="font-bold text-xs text-white truncate mt-1.5 leading-snug group-hover:text-orange-400 transition"
                                  title={recTitle}
                                >
                                  {recTitle}
                                </h4>

                                {/* Subtitle row with Dub | Sub & kebab */}
                                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                                  <span className="font-normal truncate">
                                    {recAnime.format === 'MOVIE' ? 'Movie' : 'Dub|Sub'}
                                  </span>

                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setActiveMenuId(isMenuOpen ? null : recAnime.id);
                                      }}
                                      className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                                      title="More options"
                                    >
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Kebab dropdown menu */}
                                    {isMenuOpen && (
                                      <div
                                        className="absolute right-0 bottom-full mb-1.5 z-40 w-44 rounded-xl bg-[#141829] border border-slate-700 shadow-2xl p-1.5 text-xs text-slate-200 space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <button
                                          onClick={() => {
                                            setActiveMenuId(null);
                                            onNavigateToAnime(recAnime);
                                          }}
                                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-left text-slate-200 hover:text-white font-medium"
                                        >
                                          <Info className="w-3.5 h-3.5 text-indigo-400" />
                                          <span>View Details</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            setActiveMenuId(null);
                                            onUpdateStatus(recAnime, 'PLANNING');
                                          }}
                                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-left text-slate-200 hover:text-white font-medium"
                                        >
                                          <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                                          <span>Add to Planning</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            setActiveMenuId(null);
                                            onUpdateStatus(recAnime, 'CURRENT');
                                          }}
                                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-left text-slate-200 hover:text-white font-medium"
                                        >
                                          <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                                          <span>Start Watching</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center text-slate-400 text-xs">
                        No community recommendations recorded yet for this title.
                      </div>
                    )}
                  </div>

                  {/* Official Links & Media Card */}
                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    <h3 className="text-base font-bold uppercase tracking-wider text-slate-300">
                      Official Links & Media
                    </h3>
                    <div className="space-y-2.5">
                      {currentAnime.siteUrl && (
                        <a
                          href={currentAnime.siteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-sky-300 hover:text-sky-200 transition shadow-sm"
                        >
                          <div className="flex items-center gap-2">
                            <ExternalLink className="w-4 h-4 text-sky-400" />
                            <span>AniList Database Entry</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </a>
                      )}

                      {details?.externalLinks && details.externalLinks.map(link => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 text-xs font-medium text-slate-300 hover:text-white transition"
                        >
                          <span className="truncate">{link.site}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EPISODES & STREAMING */}
            {activeTab === 'episodes' && (
              <div className="space-y-6 text-left">
                {/* State 1: Active Episode Video Player (Pro Video Player) */}
                {playingEpisode !== null ? (
                  <div ref={playerRef} className="space-y-6">
                    {/* Feature-Packed Crunchyroll-Inspired Video Player */}
                    <ProVideoPlayer
                      anime={currentAnime}
                      episodeNumber={playingEpisode}
                      episodeTitle={episodeList.find(e => e.number === playingEpisode)?.title}
                      episodesList={episodeList}
                      initialTime={initialTime || 0}
                      onEpisodeChange={ep => {
                        setPlayingEpisode(ep);
                        onUpdateProgress(currentAnime, ep);
                      }}
                      onClosePlayer={() => setPlayingEpisode(null)}
                    />

                    {/* Episodes List in Active Playing View */}
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                          <span>Episodes</span>
                          <span className="text-xs font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                            {episodeList.length}
                          </span>
                        </h3>

                        <button
                          type="button"
                          onClick={() => setPlayingEpisode(null)}
                          className="text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          Close Player
                        </button>
                      </div>

                      {/* Filter Search Bar */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Filter episodes..."
                            value={episodeSearchQuery}
                            onChange={e => setEpisodeSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-8 py-2 rounded-xl bg-[#121628] border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                          />
                          {episodeSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setEpisodeSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 bg-[#121628] border border-slate-800 p-1 rounded-xl shrink-0">
                          <button
                            type="button"
                            onClick={() => setEpisodeViewMode('list')}
                            className={`p-1.5 rounded-lg transition ${
                              episodeViewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <List className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEpisodeViewMode('grid')}
                            className={`p-1.5 rounded-lg transition ${
                              episodeViewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <LayoutGrid className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Episode List Rows with Highlighted Active Item */}
                      <div className="space-y-3">
                        {filteredEpisodes.map(ep => {
                          const isCurrentPlaying = playingEpisode === ep.number;
                          const isWatched = ep.number <= currentProgress;

                          return (
                            <div
                              key={ep.number}
                              onClick={() => {
                                if (onPlayStream) {
                                  onClose();
                                  onPlayStream(currentAnime, ep.number, 0);
                                } else {
                                  setPlayingEpisode(ep.number);
                                  playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                              }}
                              className={`group flex items-center justify-between gap-4 p-3 rounded-2xl border transition cursor-pointer select-none ${
                                isCurrentPlaying
                                  ? 'bg-[#171b30] border-2 border-indigo-500/80 shadow-lg shadow-indigo-600/10'
                                  : 'bg-[#101424] hover:bg-[#151a30] border-slate-800/80 hover:border-slate-700'
                              }`}
                            >
                              {/* Thumbnail with EP badge */}
                              <div className="relative w-36 sm:w-44 aspect-video rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-800/80">
                                {ep.thumbnail ? (
                                  <img
                                    src={ep.thumbnail}
                                    alt={ep.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    referrerPolicy="no-referrer"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-900">
                                    <Film className="w-6 h-6" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[10px] sm:text-xs font-bold text-white tracking-tight">
                                  EP {ep.number}
                                </div>
                              </div>

                              {/* Titles */}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-indigo-300 transition line-clamp-1 leading-snug">
                                  {ep.title}
                                </h4>
                                <p className={`text-xs mt-1 font-semibold ${isCurrentPlaying ? 'text-indigo-400' : 'text-slate-400'}`}>
                                  {isCurrentPlaying ? 'Now playing' : `Episode ${ep.number}`}
                                </p>
                              </div>

                              {/* Watched Action */}
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  const nextProgress = isWatched ? ep.number - 1 : ep.number;
                                  onUpdateProgress(currentAnime, nextProgress);
                                }}
                                className={`p-2 rounded-xl transition ${
                                  isWatched
                                    ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                }`}
                                title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                              >
                                <Eye className={`w-5 h-5 ${isWatched ? 'text-indigo-400 fill-indigo-400/20' : ''}`} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* State 2: Episodes Browser */
                  <div className="space-y-6">
                    {/* Header and Filter Episodes Search Bar & List/Grid toggle (Screenshot 1 & 2) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 id="modal-episodes-section-title" className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                          <Play className="w-4 h-4 text-orange-400 fill-orange-400" />
                          <span>Episodes</span>
                          <span className="text-xs font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-2.5 py-0.5 rounded-full ml-1 normal-case tracking-normal">
                            {episodeList.length} total
                          </span>
                        </h3>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder={`Filter ${episodeList.length} episodes by name or #...`}
                            value={episodeSearchQuery}
                            onChange={e => setEpisodeSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-[#121628] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                          />
                          {episodeSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setEpisodeSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* List vs Grid Switcher */}
                        <div className="flex items-center gap-1 bg-[#121628] border border-slate-800 p-1 rounded-xl shrink-0">
                          <button
                            type="button"
                            onClick={() => setEpisodeViewMode('list')}
                            className={`p-1.5 rounded-lg transition ${
                              episodeViewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                            }`}
                            title="List View"
                          >
                            <List className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEpisodeViewMode('grid')}
                            className={`p-1.5 rounded-lg transition ${
                              episodeViewMode === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                            }`}
                            title="Grid View"
                          >
                            <LayoutGrid className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Episode Range Filter Bar for Anime with >50 Episodes */}
                      {episodeRanges.length > 0 && !episodeSearchQuery && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedEpisodeRange('all')}
                            className={`px-3 py-1 rounded-lg font-bold transition shrink-0 ${
                              selectedEpisodeRange === 'all'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            All ({episodeList.length})
                          </button>
                          {episodeRanges.map(r => (
                            <button
                              key={r.label}
                              type="button"
                              onClick={() => setSelectedEpisodeRange(r.label)}
                              className={`px-3 py-1 rounded-lg font-bold transition shrink-0 ${
                                selectedEpisodeRange === r.label
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                              }`}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Episode Items Rendering (List & Grid Layouts) */}
                    {filteredEpisodes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl bg-[#101424]/70 border border-slate-800/80">
                        <Film className="w-10 h-10 text-slate-500 mb-3 opacity-60" />
                        <p className="text-sm font-semibold text-slate-200">No episodes found</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm">
                          {episodeSearchQuery ? `No episodes match "${episodeSearchQuery}".` : 'No episodes match the selected filter.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEpisodeSearchQuery('');
                            setSelectedEpisodeRange('all');
                          }}
                          className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md cursor-pointer"
                        >
                          Show All Episodes ({episodeList.length})
                        </button>
                      </div>
                    ) : episodeViewMode === 'grid' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                        {filteredEpisodes.map(ep => {
                          const isWatched = ep.number <= currentProgress;

                          return (
                            <div
                              key={ep.number}
                              onClick={() => {
                                if (onPlayStream) {
                                  onClose();
                                  onPlayStream(currentAnime, ep.number, 0);
                                } else {
                                  setPlayingEpisode(ep.number);
                                  setTimeout(() => {
                                    playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }, 100);
                                }
                              }}
                              className="group relative flex flex-col bg-[#101424] hover:bg-[#151a30] rounded-2xl border border-slate-800/80 hover:border-indigo-500/50 overflow-hidden transition-all duration-200 cursor-pointer shadow-md"
                            >
                              {/* 16:9 Thumbnail with Overlay badges */}
                              <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                                {ep.thumbnail ? (
                                  <img
                                    src={ep.thumbnail}
                                    alt={ep.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    referrerPolicy="no-referrer"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-900">
                                    <Film className="w-6 h-6" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                                
                                {/* Hover Play Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-600/40 transform group-hover:scale-110 transition-transform">
                                    <Play className="w-4 h-4 fill-current ml-0.5" />
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 absolute top-2 left-2">
                                  <div className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[10px] font-black text-indigo-300 border border-indigo-500/20">
                                    EP {ep.number}
                                  </div>
                                  {ep.filler && (
                                    <div className="px-1.5 py-0.5 rounded-md bg-amber-500/90 text-black text-[9px] font-black tracking-wider uppercase shadow-sm">
                                      FILLER
                                    </div>
                                  )}
                                </div>

                                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-semibold text-slate-300">
                                  {ep.duration}
                                </div>

                                {isWatched && (
                                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-600/90 text-white flex items-center justify-center">
                                    <Check className="w-3 h-3" />
                                  </div>
                                )}
                              </div>

                              {/* Content */}
                              <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                                <div>
                                  <h4 className="font-bold text-xs text-slate-200 group-hover:text-indigo-300 transition line-clamp-2 leading-snug">
                                    {ep.title}
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-1 font-medium">
                                    Episode {ep.number}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 mt-auto">
                                  <span className="text-[10px] text-slate-500">
                                    {isWatched ? 'Completed' : 'Unwatched'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      const nextProgress = isWatched ? ep.number - 1 : ep.number;
                                      onUpdateProgress(currentAnime, nextProgress);
                                    }}
                                    className={`p-1.5 rounded-lg transition ${
                                      isWatched
                                        ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                    }`}
                                    title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                                  >
                                    <Eye className={`w-4 h-4 ${isWatched ? 'text-indigo-400 fill-indigo-400/20' : ''}`} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredEpisodes.map(ep => {
                          const isWatched = ep.number <= currentProgress;

                          return (
                            <div
                              key={ep.number}
                              onClick={() => {
                                if (onPlayStream) {
                                  onClose();
                                  onPlayStream(currentAnime, ep.number, 0);
                                } else {
                                  setPlayingEpisode(ep.number);
                                  setTimeout(() => {
                                    playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }, 100);
                                }
                              }}
                              className="group flex items-center justify-between gap-4 p-3 rounded-2xl bg-[#101424] hover:bg-[#151a30] border border-slate-800/80 hover:border-slate-700 transition cursor-pointer select-none"
                            >
                              {/* Left: Thumbnail with EP Badge */}
                              <div className="relative w-36 sm:w-44 aspect-video rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-800/80">
                                {ep.thumbnail ? (
                                  <img
                                    src={ep.thumbnail}
                                    alt={ep.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    referrerPolicy="no-referrer"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-900">
                                    <Film className="w-6 h-6" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 text-[10px] sm:text-xs font-bold text-white tracking-tight">
                                  EP {ep.number}
                                </div>
                              </div>

                              {/* Middle: Title & Episode Number Subtitle */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-indigo-300 transition line-clamp-1 leading-snug">
                                    {ep.title}
                                  </h4>
                                  {ep.filler && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/90 text-black text-[9px] font-black tracking-wider uppercase shrink-0">
                                      FILLER
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                  Episode {ep.number}
                                </p>
                              </div>

                              {/* Right: Eye Icon for Watched Progress */}
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  const nextProgress = isWatched ? ep.number - 1 : ep.number;
                                  onUpdateProgress(currentAnime, nextProgress);
                                }}
                                className={`p-2 rounded-xl transition ${
                                  isWatched
                                    ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                }`}
                                title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                              >
                                <Eye className={`w-5 h-5 ${isWatched ? 'text-indigo-400 fill-indigo-400/20' : ''}`} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: FRANCHISE WATCH ORDER (3rd Tab beside Episodes) */}
            {activeTab === 'watch_order' && (
              <AnimeWatchOrderTab
                currentAnime={currentAnime}
                details={details}
                onNavigateToAnime={onNavigateToAnime}
                onPlayStream={onPlayStream}
                onOpenEpisodesTab={(targetAnime, targetEp) => {
                  if (targetAnime.id !== currentAnime.id) {
                    onNavigateToAnime(targetAnime);
                  }
                  setSelectedEpisodeRange('all');
                  setEpisodeSearchQuery('');
                  setActiveTab('episodes');
                  if (targetEp) {
                    setPlayingEpisode(targetEp);
                  }
                }}
              />
            )}

            {/* TAB: FEATURED MUSIC */}
            {activeTab === 'music' && (
              <div className="space-y-6 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Music className="w-4 h-4 text-[#ff2a85]" />
                    <span>Original Soundtracks & Theme Jukebox</span>
                  </h3>
                  {themesData.resolvedTracks.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Instant Stream Active ({themesData.resolvedTracks.length} tracks)
                    </span>
                  )}
                </div>

                {/* Openings & Endings Jukebox Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Opening Themes */}
                  <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
                        <Headphones className="w-4 h-4" />
                        <span>Opening Themes ({themesData.openings.length || themesData.resolvedTracks.filter(t => t.type === 'OP').length || 'OP'})</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-bold">
                        Full Audio & Video
                      </span>
                    </div>

                    {themesData.openings.length > 0 || themesData.resolvedTracks.filter(t => t.type === 'OP').length > 0 ? (
                      <div className="space-y-2">
                        {(themesData.openings.length > 0 
                          ? themesData.openings 
                          : themesData.resolvedTracks.filter(t => t.type === 'OP').map(t => t.artists ? `${t.songTitle} - ${t.artists}` : t.songTitle)
                        ).map((op, idx) => {
                          const resolved = themesData.resolvedTracks.find(t => t.type === 'OP' && t.sequence === idx + 1) || themesData.resolvedTracks.find(t => t.type === 'OP');
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition border border-slate-700/50"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">{resolved?.songTitle || op}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-400">Opening {idx + 1}</span>
                                  {resolved?.artists && (
                                    <span className="text-[10px] text-orange-300/80 truncate max-w-[160px]">• {resolved.artists}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  if (!onPlayThemeTrack) return;
                                  if (resolved && (resolved.rawAudioUrl || resolved.audioUrl || resolved.videoUrl)) {
                                    const streamUrl = resolved.rawAudioUrl || resolved.audioUrl;
                                    const vidUrl = resolved.rawVideoUrl || resolved.videoUrl;
                                    const songName = resolved.artists ? `${resolved.songTitle} - ${resolved.artists}` : resolved.songTitle;
                                    onPlayThemeTrack(songName, streamUrl, vidUrl, 'OP', resolved.slug, resolved.artists, resolved.animeName || title);
                                    return;
                                  }
                                  setThemeLoading(op);
                                  try {
                                    const fullRes = await apiFetch(`/api/theme-full-track?query=${encodeURIComponent(romajiTitle || title + ' ' + op)}`);
                                    const fullData = await fullRes.json();
                                    if (fullData.audioUrl || fullData.rawAudioUrl || fullData.videoUrl) {
                                      onPlayThemeTrack(
                                        fullData.title ? `${title} - ${fullData.title}` : op,
                                        fullData.rawAudioUrl || fullData.audioUrl,
                                        fullData.rawVideoUrl || fullData.videoUrl,
                                        'OP',
                                        fullData.themeSlug,
                                        fullData.artists,
                                        fullData.animeName || title
                                      );
                                      return;
                                    }
                                    const res = await apiFetch(`/api/theme-preview?query=${encodeURIComponent(title + ' ' + op)}`);
                                    const data = await res.json();
                                    if (data.previewUrl || data.rawAudioUrl || data.videoUrl) {
                                      onPlayThemeTrack(
                                        data.trackName ? `${title} - ${data.trackName}` : op,
                                        data.rawAudioUrl || data.previewUrl,
                                        data.rawVideoUrl || data.videoUrl,
                                        'OP',
                                        undefined,
                                        data.artistName,
                                        title
                                      );
                                    } else {
                                      onPlayThemeTrack(op);
                                    }
                                  } catch {
                                    onPlayThemeTrack(op);
                                  } finally {
                                    setThemeLoading(null);
                                  }
                                }}
                                disabled={themeLoading === op}
                                className="px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500 text-orange-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>{themeLoading === op ? 'Loading...' : 'Play'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-300">
                          Listen to official opening theme songs and soundtrack tracks for <strong className="text-white">{title}</strong>.
                        </p>
                        <button
                          onClick={() => handleTriggerOP()}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600/90 hover:bg-orange-600 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{themeLoading === 'op_side_toggle' ? 'Buffering Track...' : 'Play Opening Theme'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Ending Themes */}
                  <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        <Music className="w-4 h-4" />
                        <span>Ending Themes ({themesData.endings.length || themesData.resolvedTracks.filter(t => t.type === 'ED').length || 'ED'})</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold">
                        Full Audio & Video
                      </span>
                    </div>

                    {themesData.endings.length > 0 || themesData.resolvedTracks.filter(t => t.type === 'ED').length > 0 ? (
                      <div className="space-y-2">
                        {(themesData.endings.length > 0 
                          ? themesData.endings 
                          : themesData.resolvedTracks.filter(t => t.type === 'ED').map(t => t.artists ? `${t.songTitle} - ${t.artists}` : t.songTitle)
                        ).map((ed, idx) => {
                          const resolved = themesData.resolvedTracks.find(t => t.type === 'ED' && t.sequence === idx + 1) || themesData.resolvedTracks.find(t => t.type === 'ED');
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition border border-slate-700/50"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">{resolved?.songTitle || ed}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-400">Ending {idx + 1}</span>
                                  {resolved?.artists && (
                                    <span className="text-[10px] text-indigo-300/80 truncate max-w-[160px]">• {resolved.artists}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  if (!onPlayThemeTrack) return;
                                  if (resolved && (resolved.rawAudioUrl || resolved.audioUrl || resolved.videoUrl)) {
                                    const streamUrl = resolved.rawAudioUrl || resolved.audioUrl;
                                    const vidUrl = resolved.rawVideoUrl || resolved.videoUrl;
                                    const songName = resolved.artists ? `${resolved.songTitle} - ${resolved.artists}` : resolved.songTitle;
                                    onPlayThemeTrack(songName, streamUrl, vidUrl, 'ED', resolved.slug, resolved.artists, resolved.animeName || title);
                                    return;
                                  }
                                  setThemeLoading(ed);
                                  try {
                                    const fullRes = await apiFetch(`/api/theme-full-track?query=${encodeURIComponent(romajiTitle || title + ' ' + ed)}`);
                                    const fullData = await fullRes.json();
                                    if (fullData.audioUrl || fullData.rawAudioUrl || fullData.videoUrl) {
                                      onPlayThemeTrack(
                                        fullData.title ? `${title} - ${fullData.title}` : ed,
                                        fullData.rawAudioUrl || fullData.audioUrl,
                                        fullData.rawVideoUrl || fullData.videoUrl,
                                        'ED',
                                        fullData.themeSlug,
                                        fullData.artists,
                                        fullData.animeName || title
                                      );
                                      return;
                                    }
                                    const res = await apiFetch(`/api/theme-preview?query=${encodeURIComponent(title + ' ' + ed)}`);
                                    const data = await res.json();
                                    if (data.previewUrl || data.rawAudioUrl || data.videoUrl) {
                                      onPlayThemeTrack(
                                        data.trackName ? `${title} - ${data.trackName}` : ed,
                                        data.rawAudioUrl || data.previewUrl,
                                        data.rawVideoUrl || data.videoUrl,
                                        'ED',
                                        undefined,
                                        data.artistName,
                                        title
                                      );
                                    } else {
                                      onPlayThemeTrack(ed);
                                    }
                                  } catch {
                                    onPlayThemeTrack(ed);
                                  } finally {
                                    setThemeLoading(null);
                                  }
                                }}
                                disabled={themeLoading === ed}
                                className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>{themeLoading === ed ? 'Loading...' : 'Play'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-300">
                          Listen to ending tracks and melodic soundtrack pieces for <strong className="text-white">{title}</strong>.
                        </p>
                        <button
                          onClick={() => handleTriggerED()}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{themeLoading === 'ed_side_toggle' ? 'Buffering Track...' : 'Play Ending Theme'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: RELATIONS & FRANCHISE */}
            {activeTab === 'relations' && (
              <div className="space-y-4 text-left">
                <h3 className="text-base font-bold uppercase tracking-wider text-slate-300">
                  Franchise Watch Order & Related Series
                </h3>

                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="aspect-[2/3] rounded-none bg-slate-900 animate-pulse" />
                    ))}
                  </div>
                ) : details?.relations?.edges && details.relations.edges.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-x-3.5 sm:gap-x-5 gap-y-6">
                    {details.relations.edges.map((rel, idx) => {
                      const relNode = rel.node;
                      const relTitle = relNode.title?.english || relNode.title?.romaji || 'Related Anime';
                      const relCover = relNode.coverImage?.large || relNode.coverImage?.medium;

                      return (
                        <div
                          key={idx}
                          onClick={() => onNavigateToAnime(relNode)}
                          className="group flex flex-col select-none cursor-pointer"
                        >
                          <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-900 rounded-none shadow-md border border-slate-800 hover:border-orange-500/60 transition">
                            {relCover ? (
                              <img
                                src={relCover}
                                alt={relTitle}
                                className="w-full h-full object-cover rounded-none group-hover:scale-105 transition duration-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs p-2 text-center">
                                {relTitle}
                              </div>
                            )}
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-none bg-indigo-600 text-white text-[10px] font-bold uppercase shadow-sm">
                              {rel.relationType.replace('_', ' ')}
                            </div>
                          </div>
                          <h5 className="font-bold text-xs sm:text-sm text-slate-200 group-hover:text-orange-400 truncate mt-2">
                            {relTitle}
                          </h5>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {relNode.format || 'Anime'} {relNode.seasonYear ? `• ${relNode.seasonYear}` : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-16 text-center text-slate-500 text-sm">
                    No official franchise relations recorded for this series.
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: CHARACTERS & CAST */}
            {activeTab === 'characters' && (
              <div className="space-y-4 text-left">
                <h3 className="text-base font-bold uppercase tracking-wider text-slate-300">
                  Characters & Voice Cast
                </h3>

                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-20 rounded-2xl bg-slate-900 animate-pulse" />
                    ))}
                  </div>
                ) : details?.characters?.edges && details.characters.edges.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {details.characters.edges.map((edge, idx) => {
                      const charNode = edge.node;
                      const vaNode = edge.voiceActors?.[0];

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-slate-800/80 text-xs"
                        >
                          {/* Character */}
                          <div className="flex items-center gap-3 min-w-0">
                            {(charNode.image?.medium || charNode.image?.large) ? (
                              <img
                                src={charNode.image?.medium || charNode.image?.large}
                                alt={charNode.name.full}
                                className="w-12 h-16 object-cover rounded-xl bg-slate-800 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-12 h-16 rounded-xl bg-slate-800 shrink-0 flex items-center justify-center text-xs text-slate-500 font-bold">
                                {charNode.name.full.charAt(0)}
                              </div>
                            )}
                            <div className="truncate">
                              <div className="font-bold text-slate-200 truncate">{charNode.name.full}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{edge.role}</div>
                            </div>
                          </div>

                          {/* Voice Actor */}
                          {vaNode && (
                            <div className="flex items-center gap-3 text-right min-w-0 pl-2">
                              <div className="truncate">
                                <div className="font-semibold text-slate-300 truncate">{vaNode.name.full}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">Japanese</div>
                              </div>
                              {(vaNode.image?.medium || vaNode.image?.large) ? (
                                <img
                                  src={vaNode.image?.medium || vaNode.image?.large}
                                  alt={vaNode.name.full}
                                  className="w-12 h-16 object-cover rounded-xl bg-slate-800 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-12 h-16 rounded-xl bg-slate-800 shrink-0 flex items-center justify-center text-xs text-slate-500 font-bold">
                                  {vaNode.name.full.charAt(0)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 text-sm">
                    No character or voice actor records found.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
