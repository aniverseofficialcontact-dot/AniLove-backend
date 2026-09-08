import React, { useState, useEffect } from 'react';
import { Home, Search, Gamepad2, Calendar, Bookmark, User, Settings, RefreshCw, Heart, Bot, Compass, Dices, Sparkles, Rotate3d, Layers, Lock, Unlock, Film, Send, MessageCircle } from 'lucide-react';
import { UserSettings, AppNotification, Anime } from '../types';
import { NotificationCenter } from './NotificationCenter';
import { DynamicLogo } from './DynamicLogo';

export type TabType = 'home' | 'discover' | 'reels' | 'arcade' | 'schedule' | 'library' | 'cards' | 'account' | 'messages';

interface NavbarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  settings: UserSettings;
  libraryCount: number;
  unreadMessagesCount?: number;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onOpenGacha?: () => void;
  isPlaying?: boolean;
  isPinLocked?: boolean;
  onLockSession?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  settings,
  libraryCount,
  unreadMessagesCount = 0,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onOpenDetails,
  onPlayStream,
  onOpenGacha,
  isPlaying = false,
  isPinLocked = false,
  onLockSession,
}) => {
  const isTwoWayConnected = Boolean(settings.twoWaySyncEnabled && settings.anilistToken);
  const isPinConfigured = Boolean(settings.profilePinEnabled && settings.profilePin);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      id="main-app-header"
      className={`relative lg:sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? 'bg-slate-950/90 lg:backdrop-blur-xl border-b border-white/15 shadow-xl shadow-black/60 py-0.5'
          : 'bg-transparent border-b border-transparent shadow-none py-0'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Dynamic Brand Logo */}
        <DynamicLogo
          isTwoWayConnected={isTwoWayConnected}
          isPlaying={isPlaying}
          libraryCount={libraryCount}
          onClick={() => onSelectTab('home')}
        />

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/15 transition">
          <button
            id="nav-tab-home"
            onClick={() => onSelectTab('home')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              currentTab === 'home'
                ? 'bg-white/20 text-white border border-white/25 shadow-md backdrop-blur-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Home className="w-4 h-4 opacity-80" />
            <span>Home</span>
          </button>

          <button
            id="nav-tab-discover"
            onClick={() => onSelectTab('discover')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              currentTab === 'discover'
                ? 'bg-white/20 text-white border border-white/25 shadow-md backdrop-blur-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Search className="w-4 h-4 opacity-80" />
            <span>Search</span>
          </button>

          {/* Reels Tab (Anime Edit Videos) */}
          <button
            id="nav-tab-reels"
            onClick={() => onSelectTab('reels')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              currentTab === 'reels'
                ? 'bg-white/20 text-white border border-white/25 shadow-md backdrop-blur-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Film className="w-4 h-4 opacity-80" />
            <span>Reels</span>
          </button>

          <button
            id="nav-tab-schedule"
            onClick={() => onSelectTab('schedule')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              currentTab === 'schedule'
                ? 'bg-white/20 text-white border border-white/25 shadow-md backdrop-blur-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Calendar className="w-4 h-4 opacity-80" />
            <span>Schedule</span>
          </button>

          <button
            id="nav-tab-library"
            onClick={() => onSelectTab('library')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer relative ${
              currentTab === 'library'
                ? 'bg-white/20 text-white border border-white/25 shadow-md backdrop-blur-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            {isPinConfigured && isPinLocked ? (
              <Lock className="w-3.5 h-3.5 text-amber-400 opacity-90" />
            ) : (
              <Bookmark className="w-4 h-4 opacity-80" />
            )}
            <span>Library</span>
            {isPinConfigured && isPinLocked ? (
              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/30 text-amber-300 text-[9px] font-extrabold border border-amber-500/40">
                PIN
              </span>
            ) : libraryCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-pink-500/40 text-pink-300 text-[10px] font-bold border border-pink-500/50">
                {libraryCount}
              </span>
            ) : null}
          </button>

          {/* Cards / Collectible Inventory Tab */}
          <button
            id="nav-tab-cards"
            onClick={() => onSelectTab('cards')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer relative ${
              currentTab === 'cards'
                ? 'bg-gradient-to-r from-pink-500/30 via-purple-500/30 to-indigo-500/30 text-white border border-pink-500/40 shadow-md backdrop-blur-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            {isPinConfigured && isPinLocked ? (
              <Lock className="w-3.5 h-3.5 text-amber-400 opacity-90" />
            ) : (
              <Rotate3d className="w-4 h-4 text-pink-400 opacity-90" />
            )}
            <span>Cards</span>
            {isPinConfigured && isPinLocked && (
              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/30 text-amber-300 text-[9px] font-extrabold border border-amber-500/40">
                PIN
              </span>
            )}
          </button>

          <button
            id="nav-tab-account"
            onClick={() => onSelectTab('account')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              currentTab === 'account'
                ? 'bg-white/20 text-white border border-white/25 shadow-md backdrop-blur-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <User className="w-4 h-4 opacity-80" />
            <span>Account</span>
            {isTwoWayConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
            )}
          </button>
        </nav>

        {/* Right Section: Gacha + Arcade (in place of AniAI) + Cloud Sync + Session Lock + Notifications */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick Lock Session Button (when PIN is configured and currently unlocked) */}
          {isPinConfigured && !isPinLocked && onLockSession && (
            <button
              id="nav-lock-session-btn"
              onClick={onLockSession}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-bold border border-white/15 hover:border-rose-500/30 backdrop-blur-md transition active:scale-95 cursor-pointer"
              title="Lock Library & Cards with PIN Now"
            >
              <Lock className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-[11px]">Lock</span>
            </button>
          )}

          {/* Anime Gacha Button */}
          {onOpenGacha && (
            <button
              id="nav-gacha-btn"
              onClick={onOpenGacha}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 text-xs font-bold border border-white/15 backdrop-blur-md shadow-sm transition active:scale-95 cursor-pointer"
              title="Spin Anime Gacha / Randomizer"
            >
              <Dices className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Gacha</span>
            </button>
          )}

          {/* Arcade Toggle Button placed at top header in place of AniAI */}
          <button
            id="nav-arcade-btn"
            onClick={() => onSelectTab('arcade')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-lg ${
              currentTab === 'arcade'
                ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-pink-500/25 border border-pink-400/40'
                : 'bg-gradient-to-r from-pink-500/80 to-violet-600/80 hover:from-pink-500 hover:to-violet-600 text-white border border-pink-400/30 backdrop-blur-md'
            }`}
            title="Open Arcade Games & Gacha Shop"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-pink-200" />
            <span>Arcade</span>
          </button>

          {/* Cloud Sync State Chip */}
          <div
            onClick={() => onSelectTab('account')}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md cursor-pointer text-xs transition"
            title={
              isTwoWayConnected
                ? `AniList 2-Way Sync Active (${settings.anilistUser?.name || 'Connected'})`
                : 'AniList Account Not Linked'
            }
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isTwoWayConnected ? 'text-emerald-400' : 'text-slate-500'
              }`}
            />
            <span
              className={`font-semibold ${
                isTwoWayConnected ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {isTwoWayConnected ? 'Synced' : 'Offline'}
            </span>
          </div>

          {/* Direct Messages (Chat) Button */}
          <button
            id="nav-messages-btn"
            onClick={() => onSelectTab('messages')}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer backdrop-blur-md ${
              currentTab === 'messages'
                ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-lg shadow-pink-500/25 border border-pink-400/40'
                : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/15'
            }`}
            title="Direct Messages & Chat"
          >
            <Send className="w-3.5 h-3.5 -rotate-12 text-pink-400" />
            <span className="hidden xl:inline">Messages</span>
            {unreadMessagesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-pink-500 text-white text-[9px] font-black animate-pulse">
                {unreadMessagesCount}
              </span>
            )}
          </button>

          {/* Real-time Notification Center Bell */}
          <NotificationCenter
            notifications={notifications}
            onMarkAsRead={onMarkAsRead}
            onMarkAllAsRead={onMarkAllAsRead}
            onClearAll={onClearAll}
            onOpenDetails={onOpenDetails}
            onPlayStream={onPlayStream}
            onNavigateToSettings={() => onSelectTab('account')}
          />
        </div>
      </div>
    </header>
  );
};

