import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  Disc,
  Maximize2,
  Minimize2,
  Video,
  Music,
  RotateCcw,
  Repeat
} from 'lucide-react';
import { soundEffects } from '../services/soundEffects';
import { apiUrl } from '../services/apiClient';

export interface ThemeSongPayload {
  title: string;
  url?: string; // Audio stream URL (e.g. /api/animethemes-media?url=...)
  videoUrl?: string; // Video stream URL (e.g. /api/animethemes-media?url=...)
  artists?: string;
  themeType?: 'OP' | 'ED';
  themeSlug?: string;
  animeName?: string;
  fullTrack?: boolean;
}

interface GlobalThemePlayerProps {
  track: ThemeSongPayload;
  onClose: () => void;
}

export default function GlobalThemePlayer({ track, onClose }: GlobalThemePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mediaMode, setMediaMode] = useState<'audio' | 'video'>(track.videoUrl ? 'video' : 'audio');
  const [isBuffering, setIsBuffering] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Determine active media stream
  const activeAudioSrc = track.url ? (track.url.startsWith('http') ? track.url : apiUrl(track.url)) : undefined;
  const activeVideoSrc = track.videoUrl ? (track.videoUrl.startsWith('http') ? track.videoUrl : apiUrl(track.videoUrl)) : undefined;

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsBuffering(true);
    setIsPlaying(true);

    if (mediaMode === 'audio' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else if (mediaMode === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [track.url, track.videoUrl, mediaMode]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const el = e.currentTarget;
    setCurrentTime(el.currentTime);
    if (el.duration && !isNaN(el.duration)) {
      setDuration(el.duration);
    }
    setIsBuffering(false);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const el = e.currentTarget;
    if (el.duration && !isNaN(el.duration)) {
      setDuration(el.duration);
    }
    setIsBuffering(false);
  };

  const togglePlay = () => {
    soundEffects.play('click');
    const media = mediaMode === 'video' ? videoRef.current : audioRef.current;
    if (media) {
      if (isPlaying) {
        media.pause();
        setIsPlaying(false);
      } else {
        media.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    soundEffects.play('click');
    const media = mediaMode === 'video' ? videoRef.current : audioRef.current;
    if (media) {
      media.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    const media = mediaMode === 'video' ? videoRef.current : audioRef.current;
    if (media) {
      media.volume = newVol;
      if (newVol > 0 && isMuted) {
        media.muted = false;
        setIsMuted(false);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * duration;

    const media = mediaMode === 'video' ? videoRef.current : audioRef.current;
    if (media) {
      media.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <aside
      id="global-theme-player"
      aria-label="AnimeThemes Audio & Video Player"
      className={`fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 transition-all duration-300 select-none ${
        isExpanded
          ? 'w-[calc(100vw-2rem)] sm:w-[420px] rounded-3xl bg-[#090d16]/95 backdrop-blur-2xl border border-pink-500/50 shadow-[0_20px_60px_rgba(244,63,94,0.35)] p-4 flex flex-col gap-3.5'
          : 'flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-[#0d121f]/92 backdrop-blur-xl border border-pink-500/40 shadow-[0_10px_35px_rgba(244,63,94,0.3)] max-w-sm sm:max-w-md'
      }`}
    >
      {/* Hidden Audio Element for Audio Mode */}
      {activeAudioSrc && (
        <audio
          ref={audioRef}
          src={activeAudioSrc}
          loop={isLooping}
          preload="auto"
          autoPlay
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onEnded={() => {
            if (!isLooping) {
              setIsPlaying(false);
              setCurrentTime(0);
            }
          }}
        />
      )}

      {/* Expanded Full Theme Player */}
      {isExpanded ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                {track.themeSlug || track.themeType || 'Theme'}
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
                {track.animeName && (
                  <p className="text-[10px] text-pink-300 truncate">{track.animeName}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Toggle Audio / Video Mode if video exists */}
              {activeVideoSrc && (
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.play('click');
                    setMediaMode(mediaMode === 'video' ? 'audio' : 'video');
                  }}
                  className={`p-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    mediaMode === 'video'
                      ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                      : 'hover:bg-white/10 text-slate-400 hover:text-white'
                  }`}
                  title={mediaMode === 'video' ? 'Switch to Audio-Only' : 'Watch Creditless Video'}
                >
                  {mediaMode === 'video' ? <Video className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
                  <span className="text-[10px] hidden sm:inline">{mediaMode === 'video' ? 'Video' : 'Audio'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"
                title="Minimize Player"
              >
                <Minimize2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEffects.play('click');
                  onClose();
                }}
                className="p-1.5 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Media Canvas / Video Player */}
          {mediaMode === 'video' && activeVideoSrc ? (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner">
              <video
                ref={videoRef}
                src={activeVideoSrc}
                loop={isLooping}
                playsInline
                autoPlay
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => {
                  setIsBuffering(false);
                  setIsPlaying(true);
                }}
                onEnded={() => {
                  if (!isLooping) {
                    setIsPlaying(false);
                    setCurrentTime(0);
                  }
                }}
                className="w-full h-full object-contain cursor-pointer"
                onClick={togglePlay}
              />
              {isBuffering && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center pointer-events-none">
                  <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            /* Audio Visualizer Stage */
            <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-white/5 to-white/2 rounded-2xl border border-white/10 gap-3 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 animate-pulse pointer-events-none" />

              <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gradient-to-tr from-[#12141a] to-[#2a1b2d] border-2 border-pink-500/50 flex items-center justify-center shadow-lg shadow-pink-500/20">
                <Disc
                  className={`w-12 h-12 text-pink-400 transition-all ${
                    isPlaying ? 'animate-spin-vinyl' : ''
                  }`}
                />
                <span className="absolute w-5 h-5 rounded-full bg-[#0b0c10] border border-pink-500 shadow-inner" />
              </div>

              <div className="relative z-10">
                <p className="text-sm font-bold text-white leading-tight">{track.title}</p>
                {track.artists && (
                  <p className="text-xs text-slate-400 mt-0.5">{track.artists}</p>
                )}
                <span className="inline-block mt-1 text-[10px] text-pink-400 font-bold px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20">
                  AnimeThemes Stream
                </span>
              </div>
            </div>
          )}

          {/* Seekable Progress Bar & Timestamps */}
          <div className="space-y-1.5 px-0.5">
            <div
              ref={progressBarRef}
              onClick={handleSeek}
              className="relative w-full h-2 bg-white/10 hover:h-3 rounded-full cursor-pointer transition-all overflow-hidden group"
            >
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-pink-500 to-rose-500 rounded-full transition-all duration-100 relative"
                style={{ width: `${progressPercent}%` }}
              >
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Playback Controls & Volume Bar */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="p-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white shadow-lg shadow-pink-500/30 transition transform hover:scale-105 active:scale-95"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEffects.play('click');
                  setIsLooping(!isLooping);
                }}
                className={`p-2 rounded-xl transition ${
                  isLooping
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title={isLooping ? 'Repeat On' : 'Repeat Off'}
              >
                <Repeat className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const media = mediaMode === 'video' ? videoRef.current : audioRef.current;
                  if (media) {
                    media.currentTime = 0;
                    setCurrentTime(0);
                  }
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
                title="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>
          </div>
        </>
      ) : (
        /* Minimized Compact Pill Mode */
        <>
          {/* Spinning Vinyl Cover */}
          <div
            onClick={() => setIsExpanded(true)}
            className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-[#12141a] to-[#2a1b2d] border border-pink-500/40 flex-shrink-0 flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition"
            title="Expand Full Theme Player"
          >
            <Disc
              className={`w-6 h-6 text-pink-400 ${
                isPlaying ? 'animate-spin-vinyl' : ''
              }`}
            />
            <span className="absolute w-2.5 h-2.5 rounded-full bg-[#0b0c10] border border-pink-500" />
          </div>

          {/* Info & Progress */}
          <div
            onClick={() => setIsExpanded(true)}
            className="flex-1 min-w-0 pr-1 cursor-pointer"
            title="Expand Full Theme Player"
          >
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 text-[9px] font-black uppercase tracking-wider">
                {track.themeSlug || track.themeType || 'OP/ED'}
              </span>
              <h4 className="text-xs font-bold text-white truncate">
                {track.title}
              </h4>
            </div>

            <div className="relative w-full h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 rounded-full transition-all duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Live Equalizer Animation */}
          {isPlaying && (
            <div className="hidden sm:flex items-end gap-0.5 h-4 px-1">
              <span className="w-1 bg-cyan-400 rounded-full animate-eq-1" />
              <span className="w-1 bg-pink-500 rounded-full animate-eq-2" />
              <span className="w-1 bg-amber-400 rounded-full animate-eq-3" />
              <span className="w-1 bg-cyan-400 rounded-full animate-eq-4" />
            </div>
          )}

          {/* Play/Pause & Close Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={togglePlay}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"
              title="Expand Player"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                soundEffects.play('click');
                onClose();
              }}
              className="p-1.5 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition ml-0.5"
              title="Dismiss Player"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
