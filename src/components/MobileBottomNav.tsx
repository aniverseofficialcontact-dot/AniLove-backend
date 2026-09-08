import React from 'react';
import { Home, Search, Calendar, Bookmark, User, Rotate3d, Lock, Film, Send } from 'lucide-react';
import { UserSettings } from '../types';
import { TabType } from './Navbar';

interface MobileBottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  settings: UserSettings;
  libraryCount: number;
  unreadMessagesCount?: number;
  onOpenAiSensei?: () => void;
  isPinLocked?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  settings,
  libraryCount,
  unreadMessagesCount = 0,
  onOpenAiSensei,
  isPinLocked = false,
}) => {
  const isTwoWayConnected = Boolean(settings.twoWaySyncEnabled && settings.anilistToken);
  const isPinConfigured = Boolean(settings.profilePinEnabled && settings.profilePin);

  return (
    <div
      id="mobile-bottom-navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-2xl border-t border-white/10 px-2 py-2 flex items-center justify-around shadow-2xl"
    >
      <button
        onClick={() => onSelectTab('home')}
        className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer ${
          currentTab === 'home'
            ? 'text-pink-400 font-bold bg-white/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Home className="w-4 h-4" />
        <span className="text-[10px]">Home</span>
      </button>

      <button
        onClick={() => onSelectTab('discover')}
        className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition cursor-pointer ${
          currentTab === 'discover'
            ? 'text-pink-400 font-bold bg-white/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Search className="w-4 h-4" />
        <span className="text-[10px]">Search</span>
      </button>

      {/* Reels Tab */}
      <button
        onClick={() => onSelectTab('reels')}
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition cursor-pointer ${
          currentTab === 'reels'
            ? 'text-pink-400 font-bold bg-white/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Film className="w-4 h-4" />
        <span className="text-[10px]">Reels</span>
      </button>

      <button
        onClick={() => onSelectTab('schedule')}
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl relative transition cursor-pointer ${
          currentTab === 'schedule'
            ? 'text-pink-400 font-bold bg-white/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Calendar className="w-4 h-4" />
        <span className="text-[10px]">Schedule</span>
      </button>

      <button
        onClick={() => onSelectTab('library')}
        className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl relative transition cursor-pointer ${
          currentTab === 'library'
            ? 'text-pink-400 font-bold bg-white/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {isPinConfigured && isPinLocked ? (
          <Lock className="w-4 h-4 text-amber-400" />
        ) : (
          <Bookmark className="w-4 h-4" />
        )}
        <span className="text-[10px]">
          {isPinConfigured && isPinLocked ? 'Locked' : 'Library'}
        </span>
        {libraryCount > 0 && !isPinLocked && (
          <span className="absolute top-0.5 right-0.5 px-1.5 py-0.2 rounded-full bg-pink-500 text-white text-[8px] font-black">
            {libraryCount}
          </span>
        )}
      </button>

      {/* Cards Collectible Tab */}
      <button
        onClick={() => onSelectTab('cards')}
        className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl relative transition cursor-pointer ${
          currentTab === 'cards'
            ? 'text-pink-400 font-bold bg-white/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {isPinConfigured && isPinLocked ? (
          <Lock className="w-4 h-4 text-amber-400" />
        ) : (
          <Rotate3d className="w-4 h-4" />
        )}
        <span className="text-[10px]">
          {isPinConfigured && isPinLocked ? 'Cards 🔒' : 'Cards'}
        </span>
      </button>

      {/* Direct Messages Tab */}
      <button
        onClick={() => onSelectTab('messages')}
        className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl relative transition cursor-pointer ${
          currentTab === 'messages'
            ? 'text-pink-400 font-bold bg-white/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Send className="w-4 h-4 -rotate-12" />
        <span className="text-[10px]">Chat</span>
        {unreadMessagesCount > 0 && (
          <span className="absolute top-0.5 right-0.5 px-1.5 py-0.2 rounded-full bg-pink-500 text-white text-[8px] font-black animate-pulse">
            {unreadMessagesCount}
          </span>
        )}
      </button>

      <button
        onClick={() => onSelectTab('account')}
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl relative transition cursor-pointer ${
          currentTab === 'account'
            ? 'text-pink-400 font-bold bg-white/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <User className="w-4 h-4" />
        <span className="text-[10px]">Account</span>
        {isTwoWayConnected && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
        )}
      </button>
    </div>
  );
};

