import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Anime, ThumbnailAppearance, StreamServerId, UserSettings } from '../types';
import { recordWatchProgress, getStoredSettings } from '../services/storage';
import {
  STREAM_PROVIDERS,
  DEFAULT_STREAM_PROVIDER_ID,
  isStreamProviderId,
  resolveEpisodeSource,
  StreamLanguage,
  StreamResolution,
  StreamSource,
  SUPPORTED_LANGUAGES,
} from '../services/streamingProviders';

interface EpisodeItem {
  number: number;
  title: string;
  thumbnail: string;
  synopsis?: string;
  duration?: string;
  filler?: boolean;
}

interface ProVideoPlayerProps {
  anime: Anime;
  episodeNumber: number;
  episodeTitle?: string;
  seasonTitle?: string;
  episodesList?: EpisodeItem[];
  initialTime?: number;
  currentServer?: StreamServerId;
  onServerChange?: (server: StreamServerId) => void;
  currentAudioLanguage?: StreamLanguage;
  onAudioLanguageChange?: (lang: StreamLanguage) => void;
  onEpisodeChange?: (episodeNumber: number) => void;
  onClosePlayer?: () => void;
  onThumbnailStyleChange?: (style: ThumbnailAppearance) => void;
  initialThumbnailStyle?: ThumbnailAppearance;
  settings?: UserSettings;
}

export const ProVideoPlayer: React.FC<ProVideoPlayerProps> = ({
  anime,
  episodeNumber,
  episodeTitle,
  seasonTitle,
  episodesList = [],
  initialTime = 0,
  currentServer,
  onServerChange,
  currentAudioLanguage,
  onAudioLanguageChange,
  onEpisodeChange,
  onThumbnailStyleChange,
  initialThumbnailStyle = 'snapshot',
}) => {
  // Player state
  const [currentTime, setCurrentTime] = useState<number>(initialTime);
  const [duration, setDuration] = useState<number>((anime.duration || 24) * 60);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeServer, setActiveServer] = useState<StreamServerId>(currentServer || DEFAULT_STREAM_PROVIDER_ID);
  const [selectedSubServerName, setSelectedSubServerName] = useState<string | undefined>(undefined);
  const [audioMode, setAudioMode] = useState<StreamLanguage>(currentAudioLanguage || 'DUB');
  const [quality] = useState<StreamResolution>('1080p');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Stream connection state
  const [streamSource, setStreamSource] = useState<StreamSource | null>(null);
  const [streamStatus, setStreamStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [streamMessage, setStreamMessage] = useState<string>('Connecting to stream...');
  const [thumbnailStyle] = useState<ThumbnailAppearance>(initialThumbnailStyle);

  // Refs
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Synchronize incoming props
  useEffect(() => {
    if (currentServer && currentServer !== activeServer) {
      setActiveServer(currentServer);
      setSelectedSubServerName(undefined);
    }
  }, [currentServer]);

  useEffect(() => {
    if (currentAudioLanguage && currentAudioLanguage !== audioMode) {
      setAudioMode(currentAudioLanguage);
    }
  }, [currentAudioLanguage]);

  // Synchronize preferences on mount
  useEffect(() => {
    try {
      const s = getStoredSettings();
      if (!currentServer) {
        const preferredServer = s.preferredServers?.[0];
        if (preferredServer && isStreamProviderId(preferredServer)) {
          setActiveServer(preferredServer);
        }
      }
      if (!currentAudioLanguage) {
        if (s.preferredLanguages && s.preferredLanguages.length > 0) {
          const pref = s.preferredLanguages[0];
          if (pref === 'SUB') setAudioMode('SUB');
          else setAudioMode('DUB');
        } else if (s.preferredAudio) {
          setAudioMode(s.preferredAudio === 'sub' ? 'SUB' : 'DUB');
        }
      }
    } catch (err) {
      console.error('Error syncing player preferences:', err);
    }
  }, []);

  // Sync fullscreen change events to document
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      setIsFullscreen(isNowFullscreen);
      if (!isNowFullscreen) {
        try {
          if (window.screen?.orientation && 'unlock' in window.screen.orientation) {
            (window.screen.orientation as any).unlock();
          }
        } catch {}
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Periodic watch progress recorder
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentTime > 5 && streamStatus === 'ready') {
        recordWatchProgress({
          anime,
          episodeNumber,
          episodeTitle,
          seasonTitle,
          currentTime,
          duration,
          thumbnailStyle,
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [anime, episodeNumber, episodeTitle, seasonTitle, currentTime, duration, thumbnailStyle, streamStatus]);

  // PostMessage command sender to iframe player (Universal Cross-Server Protocol)
  const sendIframeCommand = useCallback((command: string, value?: any) => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const targetWindow = iframeRef.current.contentWindow;

        const rawObjects: any[] = [
          { event: command, value, command, time: value },
          { event: 'command', func: command, args: [value] },
          { type: command, value, time: value },
          { method: command, arg: value, args: [value] },
          { action: command, seek: value, time: value },
          { api: 'player', func: command, args: [value] },
        ];

        if (command === 'seek' || command === 'seekTo' || command === 'currentTime') {
          const numTime = Number(value) || 0;
          rawObjects.push(
            { event: 'seek', time: numTime },
            { event: 'seekTo', time: numTime },
            { event: 'currentTime', currentTime: numTime },
            { type: 'seek', value: numTime },
            { type: 'currentTime', value: numTime },
            { action: 'seek', value: numTime, time: numTime },
            { target: 'video', command: 'seek', value: numTime },
            { method: 'setCurrentTime', value: numTime }
          );
        }

        rawObjects.forEach(obj => {
          try {
            targetWindow.postMessage(obj, '*');
            targetWindow.postMessage(JSON.stringify(obj), '*');
          } catch {}
        });

        try {
          const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
          if (doc) {
            const videos = doc.querySelectorAll('video');
            videos.forEach(v => {
              if (['seek', 'seekTo', 'currentTime'].includes(command)) {
                v.currentTime = Number(value) || 0;
              } else if (command === 'play') {
                v.play().catch(() => {});
              } else if (command === 'pause') {
                v.pause();
              }
            });
          }
        } catch {}
      }
    } catch {
      // Safe catch for cross-origin boundaries
    }
  }, []);

  // Skip time helper for keyboard shortcuts
  const seekDelta = (amount: number) => {
    const newTime = amount > 0 ? Math.min(duration, currentTime + amount) : Math.max(0, currentTime + amount);
    setCurrentTime(newTime);
    sendIframeCommand('seek', newTime);
    sendIframeCommand('seekTo', newTime);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        seekDelta(-10);
      } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        seekDelta(10);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration]);

  // Sync real video progress via iframe postMessage events
  useEffect(() => {
    const handlePlayerMessage = (e: MessageEvent) => {
      try {
        let data = e.data;
        if (!data) return;

        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }

        if (typeof data !== 'object') return;

        if (
          data.type === 'vidlink_timeupdate' ||
          data.event === 'timeupdate' ||
          data.type === 'PLAYER_EVENT' ||
          data.event === 'PLAYER_TIMEUPDATE' ||
          data.event === 'time_update'
        ) {
          const t = Number(data.currentTime || data.data?.currentTime || data.time || data.currentTimeSeconds);
          const d = Number(data.duration || data.data?.duration || data.durationSeconds);
          if (!isNaN(t) && t >= 0) {
            setCurrentTime(t);
            setStreamStatus('ready');
          }
          if (!isNaN(d) && d > 30) {
            setDuration(d);
          }
        } else if (data.event === 'play' || data.type === 'play' || data.event === 'PLAYER_PLAY') {
          setStreamStatus('ready');
        } else if (data.event === 'ended' || data.type === 'ended' || data.event === 'PLAYER_ENDED') {
          if (episodesList.length > 0 && onEpisodeChange && episodeNumber < episodesList.length) {
            const settings = getStoredSettings();
            if (settings.autoPlayNextEpisode) {
              onEpisodeChange(episodeNumber + 1);
            }
          }
        }
      } catch {
        // Ignore cross-origin non-JSON messages
      }
    };

    window.addEventListener('message', handlePlayerMessage);
    return () => window.removeEventListener('message', handlePlayerMessage);
  }, [episodesList, episodeNumber, onEpisodeChange]);

  // Non-blocking, instant fullscreen toggle
  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    const isCurrentlyFull = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);

    if (!isCurrentlyFull) {
      if (playerContainerRef.current.requestFullscreen) {
        playerContainerRef.current.requestFullscreen().catch(() => {});
      } else if ((playerContainerRef.current as any).webkitRequestFullscreen) {
        (playerContainerRef.current as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
      try {
        if (window.screen?.orientation && 'lock' in window.screen.orientation) {
          (window.screen.orientation as any).lock('landscape').catch(() => {});
        }
      } catch {}
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
      try {
        if (window.screen?.orientation && 'unlock' in window.screen.orientation) {
          (window.screen.orientation as any).unlock();
        }
      } catch {}
    }
  };

  // Main stream resolution effect
  useEffect(() => {
    let cancelled = false;
    setStreamSource(null);
    setStreamStatus('loading');
    setStreamMessage(`Connecting to ${activeServer}...`);

    resolveEpisodeSource({
      anime,
      episodeNumber,
      providerId: activeServer,
      language: audioMode,
      resolution: quality,
      serverName: selectedSubServerName,
    })
      .then(result => {
        if (cancelled) return;

        if (result.status === 'available' && result.source) {
          setStreamSource(result.source);
          setStreamStatus('ready');
          setStreamMessage('');
          return;
        }

        setStreamSource(null);
        setStreamStatus('error');
        setStreamMessage(result.message || 'Server connection timed out. Please select another server or language.');
      })
      .catch(() => {
        if (cancelled) return;
        setStreamStatus('error');
        setStreamMessage('Failed to connect to streaming server. Try switching server.');
      });

    return () => {
      cancelled = true;
    };
  }, [anime, episodeNumber, activeServer, audioMode, quality, selectedSubServerName]);

  // Next Server Failover Helper
  const handleSwitchToNextServer = () => {
    const currentIndex = STREAM_PROVIDERS.findIndex(p => p.id === activeServer);
    const nextIndex = (currentIndex + 1) % STREAM_PROVIDERS.length;
    const nextServer = STREAM_PROVIDERS[nextIndex];
    setActiveServer(nextServer.id);
    setSelectedSubServerName(undefined);
    if (onServerChange) onServerChange(nextServer.id);
  };

  // Reload current stream
  const handleReloadStream = () => {
    setStreamStatus('loading');
    setStreamMessage(`Refreshing current server stream...`);
    setRefreshKey(prev => prev + 1);
    resolveEpisodeSource({
      anime,
      episodeNumber,
      providerId: activeServer,
      language: audioMode,
      resolution: quality,
      serverName: selectedSubServerName,
    }).then(res => {
      if (res.source) {
        setStreamSource(res.source);
        setStreamStatus('ready');
      } else {
        setStreamStatus('error');
        setStreamMessage(res.message || 'Stream refresh failed. Please try switching servers.');
      }
    });
  };

  const displayTitle = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
  const coverUrl = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium || undefined;
  const userCount = anime.popularity || (anime.favourites ? anime.favourites * 10 : 0) || 0;
  const formattedUsers = userCount >= 1_000_000
    ? `${(userCount / 1_000_000).toFixed(1)}M users`
    : userCount >= 1_000
    ? `${(userCount / 1_000).toFixed(1)}K users`
    : userCount > 0
    ? `${userCount} users`
    : 'Anime Stream';

  return (
    <div
      ref={playerContainerRef}
      className={`relative select-none overflow-hidden bg-black font-sans text-white ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen m-0 p-0 border-0 rounded-none bg-black flex flex-col'
          : 'w-full rounded-2xl sm:rounded-3xl border border-slate-800/80 shadow-2xl flex flex-col'
      }`}
    >
      {/* 1. Unobstructed Video Player Stream Frame */}
      <div
        className={`relative w-full bg-black overflow-hidden touch-manipulation flex-1 ${
          isFullscreen ? 'h-full flex items-center justify-center' : 'aspect-video'
        }`}
      >
        {streamSource?.isEmbeddable && streamStatus !== 'error' ? (
          <iframe
            key={`${streamSource.url}-${refreshKey}`}
            ref={iframeRef}
            src={streamSource.url}
            title={`${displayTitle} - Episode ${episodeNumber}`}
            className="w-full h-full border-0 pointer-events-auto block"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            onLoad={() => {
              setStreamStatus('ready');
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 p-4 text-center">
            {streamStatus === 'loading' ? (
              <>
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-3" />
                <div className="text-sm font-bold text-white mb-1">Loading Episode Stream...</div>
                <div className="text-xs text-neutral-400">Connecting to {activeServer}...</div>
              </>
            ) : (
              <div className="p-6 max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">Stream Not Available</h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  {streamMessage || `Streaming is not yet available for Episode ${episodeNumber} in ${audioMode}. Please switch server or audio language.`}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleReloadStream();
                    }}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleSwitchToNextServer();
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Switch Server</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Minimal Fullscreen Floating Exit Button */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition cursor-pointer"
            title="Exit Fullscreen"
          >
            <span className="text-xs font-bold">✕ Exit</span>
          </button>
        )}
      </div>

      {/* 2. Responsive Bottom External Control Deck (Anime Details on Left, Refresh on Complete Right) */}
      {!isFullscreen && (
        <div className="px-3.5 py-3 sm:px-4 sm:py-3.5 bg-[#0a0a0e] border-t border-neutral-800/80 flex items-center justify-between gap-3">
          {/* Left: Playing Anime Thumbnail avatar & Title & User count */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 border border-neutral-700/80 bg-neutral-900 shadow-md">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-xs font-bold text-white">
                  {displayTitle.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <h4 className="font-bold text-xs sm:text-sm text-white truncate leading-tight">
                {displayTitle}
              </h4>
              <p className="text-[11px] sm:text-xs text-neutral-400 font-medium mt-0.5">
                {formattedUsers}
              </p>
            </div>
          </div>

          {/* Right: Only Refresh Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReloadStream}
              className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/80 transition active:scale-95 cursor-pointer shadow-md flex items-center justify-center"
              title="Refresh Current Server"
            >
              <RefreshCw className={`w-4 h-4 ${streamStatus === 'loading' ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

