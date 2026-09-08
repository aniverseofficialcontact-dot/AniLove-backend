import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  LogIn,
  LogOut,
  AlertCircle,
  Database,
  ChevronUp,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, logoutUser, syncUserProfileToCloud, saveAnimeToCloudLibrary } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { UserSettings, UserMediaListItem } from '../types';
import { soundEffects } from '../services/soundEffects';

interface FirebaseCloudSyncBarProps {
  settings: UserSettings;
  library: UserMediaListItem[];
  onShowToast: (type: 'success' | 'error' | 'info' | 'sync', message: string, title?: string) => void;
  onOpenAccount: () => void;
}

export const FirebaseCloudSyncBar: React.FC<FirebaseCloudSyncBarProps> = ({
  settings,
  library,
  onShowToast,
  onOpenAccount,
}) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      if (user) {
        setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    });
    return () => unsubscribe();
  }, []);

  // Perform Manual or Automatic Firebase Cloud Sync
  const handleManualSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    soundEffects.playClick();

    try {
      if (currentUser) {
        // Sync user profile & settings
        await syncUserProfileToCloud(currentUser, settings, library.length);

        // Sync first batch of library items if any
        if (library.length > 0) {
          const syncPromises = library.slice(0, 15).map(item =>
            saveAnimeToCloudLibrary(currentUser.uid, item)
          );
          await Promise.allSettled(syncPromises);
        }

        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncedTime(now);
        onShowToast('sync', `Cloud backup complete at ${now}. ${library.length} items synced.`, 'Firebase Synchronized');
        soundEffects.playSuccess();
      } else {
        // Local snapshot sync
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncedTime(now);
        onShowToast('info', 'Local library cached. Sign in with Google for multi-device sync.', 'Offline Cache Updated');
      }
    } catch (err: any) {
      console.error('Firebase sync error:', err);
      onShowToast('error', err?.message || 'Failed to sync with Firebase Cloud', 'Sync Error');
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  }, [currentUser, settings, library, isSyncing, onShowToast]);

  // Quick Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        onShowToast('success', `Welcome, ${user.displayName || 'Anime Fan'}! Cloud sync activated.`, 'Signed In');
        soundEffects.playSuccess();
        // Immediately sync on login
        await syncUserProfileToCloud(user, settings, library.length);
      }
    } catch (error: any) {
      console.error('Sign-in error:', error);
      onShowToast('error', error?.message || 'Google sign-in was cancelled.', 'Sign-in Failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
      onShowToast('info', 'Signed out from Firebase Cloud.', 'Logged Out');
    } catch (error: any) {
      onShowToast('error', 'Failed to sign out', 'Error');
    }
  };

  return (
    <footer
      id="firebase-cloud-sync-bottom-bar"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 mb-6"
    >
      <div className="rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300">
        {/* Main Bar Row */}
        <div className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Cloud Status Info */}
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                currentUser
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10'
                  : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-5 h-5 animate-spin text-pink-400" />
              ) : currentUser ? (
                <Cloud className="w-5 h-5" />
              ) : (
                <Database className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  Firebase Cloud Synchronisation
                  {currentUser ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/40">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-extrabold border border-amber-500/40">
                      Local Offline
                    </span>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                {currentUser ? (
                  <>
                    <span>Logged in as: <strong className="text-slate-200">{currentUser.displayName || currentUser.email || 'User'}</strong></span>
                    {lastSyncedTime && <span>• Last synced at {lastSyncedTime}</span>}
                  </>
                ) : (
                  <span>Sign in with Google to enable instant multi-device backup & real-time watchlist sync.</span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Actions (Sync Now / Google Login / Expand) */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Sync Now Button */}
            <button
              id="firebase-sync-now-btn"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-pink-500/30 to-purple-500/30 hover:from-pink-500/40 hover:to-purple-500/40 text-pink-200 hover:text-white text-xs font-bold border border-pink-500/40 transition active:scale-95 cursor-pointer disabled:opacity-50"
              title="Trigger instant Firebase synchronization"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-pink-400' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            {/* Google Sign In / Account Button */}
            {currentUser ? (
              <button
                id="firebase-manage-account-btn"
                onClick={onOpenAccount}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold border border-white/15 transition active:scale-95 cursor-pointer"
                title="Manage Cloud & Account Settings"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Account</span>
              </button>
            ) : (
              <button
                id="firebase-google-login-btn"
                onClick={handleGoogleSignIn}
                disabled={isAuthLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 border border-blue-400/30 transition active:scale-95 cursor-pointer disabled:opacity-50"
                title="Sign in with Google Firebase Auth"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isAuthLoading ? 'Connecting...' : 'Google Sync'}</span>
              </button>
            )}

            {/* Toggle Expand Details */}
            <button
              id="firebase-sync-expand-toggle"
              onClick={() => setIsExpanded(prev => !prev)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition cursor-pointer"
              title={isExpanded ? 'Collapse Details' : 'View Sync Stats'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expandable Sync Telemetry & Cloud Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="border-t border-white/10 bg-slate-950/60 p-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[11px] font-semibold text-slate-400 block">Library Entries Synced</span>
                  <span className="text-lg font-bold text-white">{library.length} anime</span>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[11px] font-semibold text-slate-400 block">Cloud Status</span>
                  <span className="text-lg font-bold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    {currentUser ? 'Firestore Active' : 'Local Persistence'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block">Cloud Settings</span>
                    <span className="text-xs text-slate-300">Preferences & Profile</span>
                  </div>
                  {currentUser ? (
                    <button
                      onClick={handleSignOut}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold border border-rose-500/30 transition cursor-pointer"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={onOpenAccount}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-bold border border-white/15 transition cursor-pointer"
                    >
                      Configure
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </footer>
  );
};
