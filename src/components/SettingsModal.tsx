import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Settings, Download, RefreshCw, Key, ShieldCheck,
  CheckCircle2, AlertCircle, LogOut, ArrowRight, UserCheck,
  FileJson, Upload, ToggleLeft, ToggleRight, Sparkles, ExternalLink,
  Database, Snowflake, Palette, Layers
} from 'lucide-react';
import { UserSettings, UserMediaListItem } from '../types';
import { getAniListAuthUrl, fetchUserMediaList, fetchAuthenticatedViewer, extractAniListToken, ANILIST_CLIENT_ID } from '../services/anilist';
import { fetchMALUserAnimelist, fetchMALUserProfile, getMALAuthUrl } from '../services/myanimelist';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings) => void;
  onImportList: (items: UserMediaListItem[], username: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'sync', message: string, title?: string) => void;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onImportList,
  onShowToast,
  onExportBackup,
  onImportBackup,
}) => {
  // Option 1: Import Playlist state
  const [importUsername, setImportUsername] = useState(settings.importUsername || '');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImportTypes, setSelectedImportTypes] = useState({
    CURRENT: true,
    COMPLETED: true,
    PLANNING: true,
    PAUSED: true,
    DROPPED: true,
  });

  // Option 2: Two-Way Sync state
  const [twoWaySyncEnabled, setTwoWaySyncEnabled] = useState(settings.twoWaySyncEnabled);
  const [manualToken, setManualToken] = useState('');
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [syncProgress, setSyncProgress] = useState(settings.syncEpisodeProgress);
  const [syncStatus, setSyncStatus] = useState(settings.syncWatchStatus);
  const [syncScores, setSyncScores] = useState(settings.syncScores);

  // MyAnimeList state
  const [malUsernameInput, setMalUsernameInput] = useState(settings.malUsername || '');
  const [malTokenInput, setMalTokenInput] = useState(settings.malToken || '');
  const [isSyncingMAL, setIsSyncingMAL] = useState(false);
  const [showMALTokenInput, setShowMALTokenInput] = useState(false);

  if (!isOpen) return null;

  // HANDLER: Import MyAnimeList Watchlist
  const handleImportMALWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = malUsernameInput.trim();
    if (!username) {
      onShowToast('error', 'Please enter a valid MyAnimeList username.', 'Username Required');
      return;
    }

    setIsSyncingMAL(true);
    try {
      const items = await fetchMALUserAnimelist(username);
      if (!items || items.length === 0) {
        onShowToast('info', `No anime lists found for MyAnimeList user "${username}". Make sure the profile is public.`, 'No Records');
        setIsSyncingMAL(false);
        return;
      }

      let malUser = null;
      try {
        malUser = await fetchMALUserProfile(username);
      } catch (e) {
        console.warn('Could not fetch MAL profile:', e);
      }

      onImportList(items, username);
      onSaveSettings({
        ...settings,
        malUsername: username,
        malUser: malUser || { name: username },
        malSyncEnabled: true,
      });

      onShowToast(
        'success',
        `Successfully imported ${items.length} anime entries from ${username}'s MyAnimeList!`,
        'MAL Imported'
      );
    } catch (err: any) {
      console.error('MAL import error:', err);
      onShowToast('error', err.message || 'Failed to fetch MyAnimeList watchlist.', 'Import Failed');
    } finally {
      setIsSyncingMAL(false);
    }
  };

  // HANDLER: Connect MAL Access Token
  const handleConnectMALToken = async () => {
    const token = malTokenInput.trim();
    if (!token) {
      onShowToast('error', 'Please enter a valid MyAnimeList token.', 'Token Required');
      return;
    }

    setIsSyncingMAL(true);
    try {
      const username = malUsernameInput.trim() || settings.malUsername || 'MAL User';
      let malUser = null;
      try {
        malUser = await fetchMALUserProfile(username);
      } catch (e) {
        console.warn('Could not fetch MAL user profile:', e);
      }

      onSaveSettings({
        ...settings,
        malToken: token,
        malUsername: username,
        malUser: malUser || { name: username },
        malSyncEnabled: true,
      });
      setShowMALTokenInput(false);
      onShowToast('success', `Linked MyAnimeList account for "${username}"!`, 'MAL Connected');
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to link MyAnimeList token.', 'Connection Failed');
    } finally {
      setIsSyncingMAL(false);
    }
  };

  // HANDLER: Disconnect MAL
  const handleDisconnectMAL = () => {
    onSaveSettings({
      ...settings,
      malUsername: null,
      malToken: null,
      malUser: null,
      malSyncEnabled: false,
    });
    setMalUsernameInput('');
    setMalTokenInput('');
    onShowToast('info', 'MyAnimeList account disconnected.', 'Disconnected');
  };

  // HANDLER: Option 1 - Import Public Playlist (Static Copy)
  const handleImportPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = importUsername.trim();
    if (!username) {
      onShowToast('error', 'Please enter a valid AniList username.', 'Username Required');
      return;
    }

    setIsImporting(true);
    try {
      const items = await fetchUserMediaList(username);
      if (!items || items.length === 0) {
        onShowToast('info', `No anime lists found for user "${username}". Make sure the profile is public.`, 'No Records');
        setIsImporting(false);
        return;
      }

      // Filter by selected types
      const filtered = items.filter(item => selectedImportTypes[item.status as keyof typeof selectedImportTypes]);

      onImportList(filtered, username);

      // Save imported username
      onSaveSettings({
        ...settings,
        importUsername: username,
      });

      onShowToast(
        'success',
        `Successfully imported ${filtered.length} anime entries from ${username}'s AniList!`,
        'Playlist Imported'
      );
    } catch (err: any) {
      console.error('Import error:', err);
      onShowToast('error', err.message || 'Failed to fetch AniList playlist.', 'Import Failed');
    } finally {
      setIsImporting(false);
    }
  };

  // HANDLER: Option 2 - Connect AniList OAuth
  const handleConnectOAuth = () => {
    const authUrl = getAniListAuthUrl();
    window.location.href = authUrl;
  };

  // HANDLER: Option 2 - Verify & Save Manual Token
  const handleSaveManualToken = async () => {
    const token = extractAniListToken(manualToken);
    if (!token) {
      onShowToast('error', 'Please enter an OAuth Access Token.', 'Token Missing');
      return;
    }

    setIsValidatingToken(true);
    try {
      const user = await fetchAuthenticatedViewer(token);
      if (!user) {
        throw new Error('Invalid token or AniList server error.');
      }

      onSaveSettings({
        ...settings,
        anilistToken: token,
        anilistUser: user,
        twoWaySyncEnabled: true,
        lastSyncTimestamp: Date.now(),
      });

      setTwoWaySyncEnabled(true);
      setManualToken('');
      onShowToast(
        'sync',
        `Connected to AniList account "${user.name}". Two-way cloud sync is now active!`,
        'Account Connected'
      );
    } catch (err: any) {
      console.error('Token validation error:', err);
      onShowToast('error', err.message || 'Could not authenticate with this token.', 'Auth Error');
    } finally {
      setIsValidatingToken(false);
    }
  };

  // HANDLER: Disconnect AniList
  const handleDisconnect = () => {
    onSaveSettings({
      ...settings,
      anilistToken: null,
      anilistUser: null,
      twoWaySyncEnabled: false,
    });
    setTwoWaySyncEnabled(false);
    onShowToast('info', 'Disconnected from AniList account.', 'Logged Out');
  };

  // HANDLER: Toggle Two-Way Sync
  const handleToggleTwoWaySync = (enabled: boolean) => {
    setTwoWaySyncEnabled(enabled);
    onSaveSettings({
      ...settings,
      twoWaySyncEnabled: enabled,
      syncEpisodeProgress: syncProgress,
      syncWatchStatus: syncStatus,
      syncScores: syncScores,
    });
  };

  const handleSubSyncToggle = (key: 'progress' | 'status' | 'scores', val: boolean) => {
    let p = syncProgress;
    let s = syncStatus;
    let sc = syncScores;
    if (key === 'progress') {
      setSyncProgress(val);
      p = val;
    } else if (key === 'status') {
      setSyncStatus(val);
      s = val;
    } else if (key === 'scores') {
      setSyncScores(val);
      sc = val;
    }
    onSaveSettings({
      ...settings,
      syncEpisodeProgress: p,
      syncWatchStatus: s,
      syncScores: sc,
    });
  };

  return (
    <AnimatePresence>
      <div
        id="settings-modal-backdrop"
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-3xl my-auto bg-[#0e1224] border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#090c19]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-white">
                  AniList Integration & App Settings
                </h3>
                <p className="text-xs text-slate-400">
                  Manage playlist imports, two-way sync, and data backups
                </p>
              </div>
            </div>

            <button
              id="close-settings-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1 text-left">
            {/* OPTION 1: IMPORT PLAYLIST / TRACK FROM ANILIST */}
            <div className="p-5 rounded-2xl bg-[#12172f] border border-slate-700/70 shadow-lg space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                    Option 1
                  </div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-sky-400" />
                    <span>Import Anime Playlist (One-Time Copy)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Instantly copy a public anime list from any AniList user without signing in. Creates an isolated local library copy.
                  </p>
                </div>
              </div>

              {/* Username Form */}
              <form onSubmit={handleImportPlaylist} className="space-y-3 pt-1">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={importUsername}
                    onChange={e => setImportUsername(e.target.value)}
                    placeholder="Enter AniList username (e.g. kompoti121, sanyam4581)..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-sky-500 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={isImporting}
                    className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Fetching List...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Import Playlist</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Filter Checkboxes */}
                <div className="flex items-center gap-3 flex-wrap text-xs text-slate-300 pt-1">
                  <span className="text-slate-400 font-semibold text-[11px]">Include:</span>
                  {(['CURRENT', 'COMPLETED', 'PLANNING', 'PAUSED', 'DROPPED'] as const).map(type => {
                    const checked = selectedImportTypes[type];
                    const labels: Record<string, string> = {
                      CURRENT: 'Watching',
                      COMPLETED: 'Completed',
                      PLANNING: 'Planning',
                      PAUSED: 'Paused',
                      DROPPED: 'Dropped',
                    };

                    return (
                      <label key={type} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e =>
                            setSelectedImportTypes(prev => ({ ...prev, [type]: e.target.checked }))
                          }
                          className="rounded text-sky-600 focus:ring-0 bg-slate-900 border-slate-700 w-3.5 h-3.5"
                        />
                        <span>{labels[type]}</span>
                      </label>
                    );
                  })}
                </div>
              </form>
            </div>

            {/* OPTION 2: TWO-WAY CLOUD SYNC WITH ANILIST ACCOUNT */}
            <div className="p-5 rounded-2xl bg-[#12172f] border border-slate-700/70 shadow-lg space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                    Option 2
                  </div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                    <span>Two-Way Cloud Sync (Full Account Integration)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Connect your official AniList account. Whenever you watch an episode, change status, or rate anime, it will update AniList in real-time.
                  </p>
                </div>
              </div>

              {/* Connected State vs Not Connected */}
              {settings.anilistToken && settings.anilistUser ? (
                <div className="space-y-4 pt-1">
                  {/* Account Badge */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/40">
                    <div className="flex items-center gap-3">
                      {settings.anilistUser.avatar?.medium ? (
                        <img
                          src={settings.anilistUser.avatar.medium}
                          alt={settings.anilistUser.name}
                          className="w-10 h-10 rounded-full border border-emerald-400 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-white">
                          {settings.anilistUser.name.slice(0, 1)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white">{settings.anilistUser.name}</span>
                          <UserCheck className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="text-[11px] text-emerald-400 font-medium">
                          AniList Account Authenticated
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleDisconnect}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 text-xs font-semibold transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </div>

                  {/* Two-Way Master Switch */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div>
                      <div className="text-xs font-bold text-slate-200">Enable Two-Way Live Sync</div>
                      <div className="text-[11px] text-slate-400">Push episode & status changes to AniList automatically</div>
                    </div>
                    <button
                      onClick={() => handleToggleTwoWaySync(!twoWaySyncEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        twoWaySyncEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          twoWaySyncEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Granular Sync Controls */}
                  {twoWaySyncEnabled && (
                    <div className="space-y-2 pl-2 border-l-2 border-emerald-500/40 text-xs">
                      <label className="flex items-center justify-between cursor-pointer py-1">
                        <span className="text-slate-300">Sync Episode Progress (+1 / -1 stepper)</span>
                        <input
                          type="checkbox"
                          checked={syncProgress}
                          onChange={e => handleSubSyncToggle('progress', e.target.checked)}
                          className="rounded text-emerald-600 bg-slate-900 border-slate-700"
                        />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer py-1">
                        <span className="text-slate-300">Sync Watchlist Status (Watching / Completed)</span>
                        <input
                          type="checkbox"
                          checked={syncStatus}
                          onChange={e => handleSubSyncToggle('status', e.target.checked)}
                          className="rounded text-emerald-600 bg-slate-900 border-slate-700"
                        />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer py-1">
                        <span className="text-slate-300">Sync Anime Rating Scores</span>
                        <input
                          type="checkbox"
                          checked={syncScores}
                          onChange={e => handleSubSyncToggle('scores', e.target.checked)}
                          className="rounded text-emerald-600 bg-slate-900 border-slate-700"
                        />
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {/* OAuth Connect Button */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      id="connect-anilist-oauth-btn"
                      onClick={handleConnectOAuth}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-emerald-950/40 transition active:scale-95"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Connect Official AniList Account (OAuth)</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </button>
                  </div>

                  {/* Alternative: Manual Token Input */}
                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        <span>Or Paste Access Token Manually:</span>
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={manualToken}
                        onChange={e => setManualToken(e.target.value)}
                        placeholder="Paste AniList Bearer Access Token..."
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={handleSaveManualToken}
                        disabled={isValidatingToken || !manualToken.trim()}
                        className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition disabled:opacity-40 shrink-0"
                      >
                        {isValidatingToken ? 'Checking...' : 'Save Token'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* OPTION 3: MYANIMELIST (MAL) INTEGRATION */}
            <div className="p-5 rounded-2xl bg-[#12172f] border border-blue-500/30 shadow-lg space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                    MyAnimeList
                  </div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span>MyAnimeList (MAL) Watchlist & 2-Way Sync</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Import your public MAL watchlist with one click or link your MyAnimeList account for live automatic synchronization.
                  </p>
                </div>
              </div>

              {settings.malUsername ? (
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-blue-500/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {settings.malUser?.picture ? (
                      <img
                        src={settings.malUser.picture}
                        alt={settings.malUsername}
                        className="w-10 h-10 rounded-full border border-blue-400 object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                        MAL
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-white">{settings.malUsername}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {settings.malToken ? '2-Way Live Sync' : 'Watchlist Tracked'}
                        </span>
                      </div>
                      <div className="text-[11px] text-blue-300">
                        {settings.malToken ? 'Live changes update MyAnimeList automatically' : 'Public Watchlist Connected'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSyncingMAL}
                      onClick={handleImportMALWatchlist}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingMAL ? 'animate-spin' : ''}`} />
                      <span>Resync</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectMAL}
                      className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <form onSubmit={handleImportMALWatchlist} className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={malUsernameInput}
                      onChange={e => setMalUsernameInput(e.target.value)}
                      placeholder="Enter MyAnimeList username..."
                      className="flex-1 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-blue-500 text-xs text-slate-100 placeholder-slate-500 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isSyncingMAL || !malUsernameInput.trim()}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {isSyncingMAL ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Import MAL List</span>
                    </button>
                  </form>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <a
                      href={getMALAuthUrl()}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold text-xs transition text-center"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Authorize MAL Account (OAuth)</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowMALTokenInput(!showMALTokenInput)}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                    >
                      {showMALTokenInput ? 'Hide' : 'Paste MAL Token'}
                    </button>
                  </div>

                  {showMALTokenInput && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="password"
                        value={malTokenInput}
                        onChange={e => setMalTokenInput(e.target.value)}
                        placeholder="Paste MAL Access Token..."
                        className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:border-blue-500 outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleConnectMALToken}
                        disabled={isSyncingMAL || !malTokenInput.trim()}
                        className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* THEME / UI CUSTOMIZATION SECTION */}
            <div className="p-5 rounded-2xl bg-[#12172f] border border-pink-500/30 shadow-lg space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-pink-500/20 text-pink-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                    Visual Styling
                  </div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-pink-400" />
                    <span>Theme/Ui</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Customize ambient particle atmospheres and 3D pop-up card preview options.
                  </p>
                </div>
              </div>

              {/* 1. Ambient Particle Overlay (Snow, Sakura, Fireflies) */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Snowflake className="w-4 h-4 text-cyan-400" />
                    <div>
                      <h5 className="text-xs font-bold text-white">Atmosphere & Ambient Particles</h5>
                      <p className="text-[11px] text-slate-400">Live overlay drifting across your screen</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !settings.ambientParticlesEnabled;
                      onSaveSettings({ ...settings, ambientParticlesEnabled: nextVal });
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    {settings.ambientParticlesEnabled ? (
                      <ToggleRight className="w-6 h-6 text-cyan-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-500" />
                    )}
                    <span>{settings.ambientParticlesEnabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>

                {settings.ambientParticlesEnabled && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      {
                        id: 'snow' as const,
                        label: 'Snow Theme',
                        desc: 'Crystal flakes & winter snow',
                        icon: '❄️',
                        activeColor: 'border-cyan-500 bg-cyan-500/20 text-cyan-200',
                      },
                      {
                        id: 'sakura' as const,
                        label: 'Sakura Petals',
                        desc: '3D drifting cherry blossoms',
                        icon: '🌸',
                        activeColor: 'border-pink-500 bg-pink-500/20 text-pink-200',
                      },
                      {
                        id: 'fireflies' as const,
                        label: 'Fireflies',
                        desc: 'Pulsing bioluminescent sparks',
                        icon: '✨',
                        activeColor: 'border-amber-500 bg-amber-500/20 text-amber-200',
                      },
                    ].map(opt => {
                      const isSelected = (settings.ambientParticleStyle || 'sakura') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            onSaveSettings({
                              ...settings,
                              ambientParticleStyle: opt.id,
                              ambientParticlesEnabled: true,
                            });
                          }}
                          className={`p-2 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                            isSelected
                              ? `${opt.activeColor} ring-1 ring-white/30 shadow-md`
                              : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-base">{opt.icon}</span>
                          <span className="text-xs font-bold leading-tight">{opt.label}</span>
                          <span className="text-[10px] text-slate-400">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. 3D Pop-Up Card Preview Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">3D Pop-up Card Option</h5>
                    <p className="text-[11px] text-slate-400">
                      Show interactive 360° 3D card popup modal when clicking anime posters before opening full details
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextVal = settings.enable3DCardPreview === false ? true : false;
                    onSaveSettings({ ...settings, enable3DCardPreview: nextVal });
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-pink-400 hover:text-pink-300 cursor-pointer shrink-0"
                >
                  {settings.enable3DCardPreview !== false ? (
                    <ToggleRight className="w-6 h-6 text-pink-400" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-500" />
                  )}
                  <span>{settings.enable3DCardPreview !== false ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>
            </div>

            {/* DATA BACKUP & RESTORE */}
            <div className="p-4 rounded-2xl bg-[#12172f] border border-slate-700/70 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileJson className="w-4 h-4 text-purple-400" />
                <span>Backup & Export Collection</span>
              </h4>
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <button
                  onClick={onExportBackup}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                  <span>Download JSON Backup</span>
                </button>

                <label className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-purple-400" />
                  <span>Restore from JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={onImportBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-800 bg-[#090c19] flex items-center justify-between text-xs text-slate-500">
            <span>Powered by AniList GraphQL API (Client ID: {ANILIST_CLIENT_ID})</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold transition"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
