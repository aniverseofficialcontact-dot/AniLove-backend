import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  LogIn,
  LogOut,
  ChevronUp,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Zap,
  Rotate3d,
  Coins,
  Bookmark,
  ExternalLink,
  CheckCircle2,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserSettings, UserMediaListItem, GachaCard } from '../types';
import { soundEffects } from '../services/soundEffects';
import { getStoredArcadeCoins, getStoredGachaVault, syncUserDataWithCloud } from '../services/storage';
import { getAniListAuthUrl } from '../services/anilist';
import { getMALAuthUrl } from '../services/myanimelist';

interface AniListSyncBarProps {
  settings: UserSettings;
  library: UserMediaListItem[];
  onShowToast: (type: 'success' | 'error' | 'info' | 'sync', message: string, title?: string) => void;
  onOpenAccount: () => void;
  onSyncAll?: () => Promise<void>;
  onDisconnect?: () => void;
}

export const AniListSyncBar: React.FC<AniListSyncBarProps> = ({
  settings,
  library,
  onShowToast,
  onOpenAccount,
  onSyncAll,
  onDisconnect,
}) => {
  const isAniListConnected = Boolean(settings.anilistToken && settings.anilistUser);
  const isMALConnected = Boolean(settings.malToken || settings.malUsername);
  const isConnected = isAniListConnected || isMALConnected;

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(() => {
    return settings.lastSyncTimestamp
      ? new Date(settings.lastSyncTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [coins, setCoins] = useState<number>(() => getStoredArcadeCoins());
  const [cardsCount, setCardsCount] = useState<number>(() => getStoredGachaVault().length);

  useEffect(() => {
    const handleStorageUpdate = () => {
      setCoins(getStoredArcadeCoins());
      setCardsCount(getStoredGachaVault().length);
    };
    window.addEventListener('arcade_coins_updated', handleStorageUpdate);
    window.addEventListener('vault_updated', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener('arcade_coins_updated', handleStorageUpdate);
      window.removeEventListener('vault_updated', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  const handleManualSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    soundEffects.playClick();

    try {
      if (isAniListConnected || isMALConnected) {
        // Sync Character Cards, Awakenings, Coins, and Companion
        const cardSyncResult = await syncUserDataWithCloud(settings);
        setCoins(cardSyncResult.coins);
        setCardsCount(cardSyncResult.cardsCount);

        // Sync full library if custom handler provided
        if (onSyncAll) {
          await onSyncAll();
        }

        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncedTime(now);
        onShowToast(
          'sync',
          `Tracker synchronized! ${library.length} anime, ${cardSyncResult.cardsCount} character cards, and ${cardSyncResult.coins} coins active.`,
          'Sync Complete'
        );
        soundEffects.playSuccess();
      } else {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncedTime(now);
        onShowToast('info', 'Sign in with AniList or MyAnimeList to enable live two-way cloud sync and character card backup.', 'Sign In Required');
      }
    } catch (err: any) {
      console.error('Manual sync error:', err);
      onShowToast('error', err?.message || 'Failed to sync with Tracker Cloud', 'Sync Error');
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  }, [isAniListConnected, isMALConnected, settings, library.length, onSyncAll, onShowToast, isSyncing]);

  const handleConnectAniList = () => {
    soundEffects.playClick();
    window.location.href = getAniListAuthUrl();
  };

  const handleConnectMAL = () => {
    soundEffects.playClick();
    window.open(getMALAuthUrl(), '_blank');
  };

  return (
    <footer
      id="anilist-cloud-sync-bottom-bar"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 mb-6"
    >
      <div className="rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300">
        {/* Main Bar Row */}
        <div className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Tracker Status Info */}
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                isConnected
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-400 shadow-lg shadow-sky-500/10'
                  : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-5 h-5 animate-spin text-pink-400" />
              ) : isAniListConnected && settings.anilistUser?.avatar?.medium ? (
                <img
                  src={settings.anilistUser.avatar.medium}
                  alt={settings.anilistUser.name}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : isMALConnected && settings.malUser?.picture ? (
                <img
                  src={settings.malUser.picture}
                  alt={settings.malUsername || ''}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <Zap className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black tracking-wider uppercase text-white">
                  Cloud Watchlist & Vault Sync
                </span>
                {isAniListConnected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    AniList: {settings.anilistUser?.name}
                  </span>
                )}
                {isMALConnected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    MAL: {settings.malUsername || settings.malUser?.name}
                  </span>
                )}
                {!isConnected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-slate-400 border border-white/10">
                    Not Logged In
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <Bookmark className="w-3 h-3 text-pink-400" /> {library.length} Anime
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-amber-300 font-medium">
                  <Coins className="w-3 h-3" /> {coins} Coins
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-purple-300 font-medium">
                  <Rotate3d className="w-3 h-3" /> {cardsCount} Cards
                </span>
                {lastSyncedTime && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline text-slate-400">
                      Synced {lastSyncedTime}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sync Now Button */}
            <button
              id="anilist-sync-now-btn"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold border border-white/15 backdrop-blur-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Trigger instant cloud synchronization"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-pink-400' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            {/* Account View Shortcut or Sign-In Trigger */}
            {isConnected ? (
              <button
                id="anilist-manage-account-btn"
                onClick={onOpenAccount}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-bold border border-sky-500/40 transition active:scale-95 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Account</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  id="anilist-login-direct-btn"
                  onClick={handleConnectAniList}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold shadow-lg shadow-sky-500/25 border border-sky-400/40 transition active:scale-95 cursor-pointer"
                  title="Sign in with AniList OAuth"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>AniList</span>
                </button>
                <button
                  id="mal-login-direct-btn"
                  onClick={handleConnectMAL}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 border border-blue-400/40 transition active:scale-95 cursor-pointer"
                  title="Sign in with MyAnimeList"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>MyAnimeList</span>
                </button>
              </div>
            )}

            {/* Expand / Collapse Details Drawer */}
            <button
              id="anilist-sync-expand-toggle"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              aria-label={isExpanded ? 'Collapse sync drawer' : 'Expand sync drawer'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expandable Sync Status & Features Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/10 bg-slate-950/60 p-4 sm:p-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Feature 1: Two-Way Library Sync */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">AniList & MAL Watchlist Sync</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Watched episodes, status changes (Watching, Completed), and ratings are instantly synchronized to your AniList or MyAnimeList profile.
                    </p>
                  </div>
                </div>

                {/* Feature 2: Character Cards & Awakenings Cloud Sync */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="p-2 rounded-lg bg-pink-500/20 text-pink-400 shrink-0">
                    <Rotate3d className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Character Cards & Companions</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      All your gacha card unlocks, star awakenings, and active chibi companions are linked to your tracker ID.
                    </p>
                  </div>
                </div>

                {/* Feature 3: Arcade Coins & Game Limit Persistence */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Arcade Coins Economy</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Earn coins across minigames and quizzes on mobile or desktop without ever losing your wallet balance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Controls */}
              <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Supports AniList OAuth 2.0 and MyAnimeList OAuth 2.0</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onOpenAccount}
                    className="text-pink-400 hover:text-pink-300 font-bold text-[11px] underline underline-offset-4 cursor-pointer"
                  >
                    Open Account & Sync Settings →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </footer>
  );
};
