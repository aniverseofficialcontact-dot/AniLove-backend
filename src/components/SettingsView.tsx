import React, { useState } from 'react';
import {
  Settings, Bell, RefreshCw, Download, Upload, ShieldCheck,
  CheckCircle2, AlertCircle, LogOut, ArrowRight, UserCheck,
  FileJson, Sparkles, ExternalLink, Play, Volume2, Database,
  Sliders, Smartphone, Check, Moon, Sun, Info, BellRing,
  Trash2, Send
} from 'lucide-react';
import { UserSettings, UserMediaListItem, MediaListStatus, StreamServerId, MALUser } from '../types';
import { getAniListAuthUrl, fetchUserMediaList, fetchAuthenticatedViewer, extractAniListToken, ANILIST_CLIENT_ID } from '../services/anilist';
import { fetchMALUserAnimelist, fetchMALUserProfile, getMALAuthUrl } from '../services/myanimelist';
import { STREAM_PROVIDERS, SUPPORTED_LANGUAGES } from '../services/streamingProviders';

interface SettingsViewProps {
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings) => void;
  onImportList: (items: UserMediaListItem[], username: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'sync', message: string, title?: string) => void;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSendTestNotification: () => void;
  libraryCount: number;
}

type SettingsSection = 'anilist' | 'mal' | 'notifications' | 'player' | 'backup' | 'about';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onImportList,
  onShowToast,
  onExportBackup,
  onImportBackup,
  onSendTestNotification,
  libraryCount,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('anilist');

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

  // Option 2: Two-Way Sync manual token state
  const [manualToken, setManualToken] = useState('');
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  // MyAnimeList state
  const [malUsernameInput, setMalUsernameInput] = useState(settings.malUsername || '');
  const [malTokenInput, setMalTokenInput] = useState(settings.malToken || '');
  const [isSyncingMAL, setIsSyncingMAL] = useState(false);
  const [showMALTokenInput, setShowMALTokenInput] = useState(false);

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

  // HANDLER: Import Public Playlist
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

      const filtered = items.filter(item => selectedImportTypes[item.status as keyof typeof selectedImportTypes]);
      onImportList(filtered, username);

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

  // HANDLER: Connect AniList OAuth
  const handleConnectOAuth = () => {
    const authUrl = getAniListAuthUrl();
    window.location.href = authUrl;
  };

  // HANDLER: Save Manual OAuth Token
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
    onShowToast('info', 'Disconnected from AniList account.', 'Logged Out');
  };

  // HANDLER: Request Browser Notification Permission
  const handleRequestPushPermission = async () => {
    if (!('Notification' in window)) {
      onShowToast('error', 'Browser notifications are not supported in this browser.', 'Not Supported');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        onSaveSettings({
          ...settings,
          browserPushEnabled: true,
          notificationsEnabled: true,
        });
        onShowToast('success', 'Browser push notifications enabled successfully!', 'Permission Granted');
      } else {
        onSaveSettings({
          ...settings,
          browserPushEnabled: false,
        });
        onShowToast('info', 'Notification permission was denied in browser settings.', 'Denied');
      }
    } catch (e) {
      console.error('Push error:', e);
    }
  };

  const isConnected = Boolean(settings.anilistToken && settings.anilistUser);

  return (
    <div id="settings-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 mb-2">
            <Settings className="w-3.5 h-3.5" />
            <span>Preferences & Integration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Settings & Account
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your AniList cloud synchronization, notification alerts, playback preferences, and data backups.
          </p>
        </div>

        {/* Quick Connection Status Badge */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>AniList Connected ({settings.anilistUser?.name})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>AniList Offline (Local Mode)</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Sidebar Tabs Navigation + Content Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Category Navigation (Tabs) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="bg-[#121626] border border-slate-800/80 rounded-2xl p-2 shadow-xl space-y-1">
            <button
              onClick={() => setActiveSection('anilist')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm transition text-left ${
                activeSection === 'anilist'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${activeSection === 'anilist' ? 'text-white' : 'text-indigo-400'}`} />
              <div className="flex-1">
                <div>AniList Integration</div>
                <div className="text-[10px] font-normal opacity-80">Two-way sync & playlist import</div>
              </div>
              {isConnected && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
            </button>

            <button
              onClick={() => setActiveSection('mal')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm transition text-left ${
                activeSection === 'mal'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Database className={`w-4 h-4 ${activeSection === 'mal' ? 'text-white' : 'text-blue-400'}`} />
              <div className="flex-1">
                <div>MyAnimeList (MAL)</div>
                <div className="text-[10px] font-normal opacity-80">MAL sync & watchlist import</div>
              </div>
              {Boolean(settings.malUsername) && <span className="w-2 h-2 rounded-full bg-blue-400" />}
            </button>

            <button
              onClick={() => setActiveSection('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm transition text-left ${
                activeSection === 'notifications'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Bell className={`w-4 h-4 ${activeSection === 'notifications' ? 'text-white' : 'text-amber-400'}`} />
              <div className="flex-1">
                <div>Notifications & Alerts</div>
                <div className="text-[10px] font-normal opacity-80">Airing reminders & push alerts</div>
              </div>
              {settings.notificationsEnabled && <span className="w-2 h-2 rounded-full bg-amber-400" />}
            </button>

            <button
              onClick={() => setActiveSection('player')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm transition text-left ${
                activeSection === 'player'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Play className={`w-4 h-4 ${activeSection === 'player' ? 'text-white' : 'text-emerald-400'}`} />
              <div className="flex-1">
                <div>Player & Streaming</div>
                <div className="text-[10px] font-normal opacity-80">Sub/Dub audio & autoplay</div>
              </div>
            </button>

            <button
              onClick={() => setActiveSection('backup')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm transition text-left ${
                activeSection === 'backup'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Database className={`w-4 h-4 ${activeSection === 'backup' ? 'text-white' : 'text-cyan-400'}`} />
              <div className="flex-1">
                <div>Data, Backup & Cache</div>
                <div className="text-[10px] font-normal opacity-80">Export JSON & storage tools</div>
              </div>
            </button>

            <button
              onClick={() => setActiveSection('about')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm transition text-left ${
                activeSection === 'about'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Info className={`w-4 h-4 ${activeSection === 'about' ? 'text-white' : 'text-purple-400'}`} />
              <div className="flex-1">
                <div>About & System Info</div>
                <div className="text-[10px] font-normal opacity-80">Version 2.4.0 & API status</div>
              </div>
            </button>
          </div>

          {/* Quick Library Stats Box */}
          <div className="bg-[#121626] border border-slate-800/80 rounded-2xl p-4 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Local Library Status
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-lg font-black text-indigo-400">{libraryCount}</div>
                <div className="text-[10px] text-slate-400">Tracked Anime</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-lg font-black text-emerald-400">
                  {isConnected ? 'Active' : 'Offline'}
                </div>
                <div className="text-[10px] text-slate-400">Cloud Sync</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section Content */}
        <div className="lg:col-span-8 bg-[#121626] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* SECTION 1: ANILIST INTEGRATION */}
          {activeSection === 'anilist' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-indigo-400" />
                  <span>AniList Synchronization</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Sync watch progress, episode milestones, and status bidirectionally with your official AniList profile.
                </p>
              </div>

              {/* Connected Account Card if logged in */}
              {isConnected ? (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-500/40 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3.5">
                      {settings.anilistUser?.avatar?.large ? (
                        <img
                          src={settings.anilistUser.avatar.large}
                          alt={settings.anilistUser.name}
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-indigo-500 shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-lg text-white">
                          {settings.anilistUser?.name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-white">
                            {settings.anilistUser?.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            Connected
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {settings.anilistUser?.statistics?.anime?.count ?? 0} Anime in profile • Mean score:{' '}
                          {settings.anilistUser?.statistics?.anime?.meanScore ?? 'N/A'}%
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleDisconnect}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 font-semibold text-xs transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </div>

                  {/* Sync Settings Switches */}
                  <div className="pt-4 border-t border-indigo-500/20 space-y-3">
                    <h5 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      Two-Way Sync Rules
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/30 border border-indigo-500/20 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.syncEpisodeProgress}
                          onChange={e => onSaveSettings({ ...settings, syncEpisodeProgress: e.target.checked })}
                          className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
                        />
                        <span className="text-xs text-slate-300 font-medium">Episode Progress</span>
                      </label>

                      <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/30 border border-indigo-500/20 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.syncWatchStatus}
                          onChange={e => onSaveSettings({ ...settings, syncWatchStatus: e.target.checked })}
                          className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
                        />
                        <span className="text-xs text-slate-300 font-medium">Watch Status</span>
                      </label>

                      <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/30 border border-indigo-500/20 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.syncScores}
                          onChange={e => onSaveSettings({ ...settings, syncScores: e.target.checked })}
                          className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
                        />
                        <span className="text-xs text-slate-300 font-medium">User Ratings</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                /* Connect Options */
                <div className="space-y-6">
                  {/* OAuth Button */}
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-purple-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-base flex items-center gap-2">
                        <span>One-Click AniList OAuth Login</span>
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      </h4>
                      <p className="text-xs text-slate-400">
                        Authorize AniLove to read and update your anime watch lists in real time.
                      </p>
                    </div>
                    <button
                      onClick={handleConnectOAuth}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition shrink-0"
                    >
                      <span>Authorize with AniList</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Manual OAuth Token Alternative */}
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <h4 className="font-bold text-slate-200 text-sm">
                      Manual Token Authorization (Alternative)
                    </h4>
                    <p className="text-xs text-slate-400">
                      If popups are restricted in your browser, generate a Personal Access Token on AniList and paste it below:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="password"
                        placeholder="Paste AniList Bearer Access Token..."
                        value={manualToken}
                        onChange={e => setManualToken(e.target.value)}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-[#0b0e1b] border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={handleSaveManualToken}
                        disabled={isValidatingToken || !manualToken.trim()}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition shrink-0"
                      >
                        {isValidatingToken ? 'Verifying...' : 'Connect Token'}
                      </button>
                    </div>
                  </div>

                  {/* Public Playlist Import (No login required) */}
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                    <div>
                      <h4 className="font-bold text-slate-200 text-sm">
                        Import Public Playlist (No Login Required)
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Download a snapshot copy of any public AniList username's anime list into your local library.
                      </p>
                    </div>

                    <form onSubmit={handleImportPlaylist} className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="text"
                          placeholder="e.g. your_anilist_username"
                          value={importUsername}
                          onChange={e => setImportUsername(e.target.value)}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-[#0b0e1b] border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={isImporting || !importUsername.trim()}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition shrink-0 flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isImporting ? 'Importing...' : 'Import List'}</span>
                        </button>
                      </div>

                      {/* Filter checkboxes */}
                      <div className="flex items-center gap-3 flex-wrap pt-1 text-xs text-slate-400">
                        <span className="font-semibold text-slate-300">Import:</span>
                        {(['CURRENT', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED'] as const).map(type => (
                          <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedImportTypes[type]}
                              onChange={e => setSelectedImportTypes(prev => ({ ...prev, [type]: e.target.checked }))}
                              className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-900 border-slate-700"
                            />
                            <span className="capitalize">{String(type).toLowerCase()}</span>
                          </label>
                        ))}
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 1B: MYANIMELIST (MAL) */}
          {activeSection === 'mal' && (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" />
                  <span>MyAnimeList (MAL) Integration</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Import your public MyAnimeList watchlist in 1-click or link your MAL account for two-way synchronization.
                </p>
              </div>

              {/* Status Banner */}
              <div className={`p-5 rounded-2xl border ${
                settings.malUsername
                  ? 'bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border-blue-500/30'
                  : 'bg-slate-900/80 border-slate-800'
              }`}>
                {settings.malUsername ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      {settings.malUser?.picture ? (
                        <img
                          src={settings.malUser.picture}
                          alt={settings.malUsername}
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-blue-400/50 shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold">
                          MAL
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white">{settings.malUsername}</h4>
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                            {settings.malToken ? '2-Way Live Sync Active' : 'Watchlist Tracked'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {settings.malToken
                            ? 'Watch status and episode changes automatically sync to MyAnimeList'
                            : 'Public watchlist imported. Connect MAL token below for 2-way sync.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        disabled={isSyncingMAL}
                        onClick={handleImportMALWatchlist}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/40 border border-blue-500/40 text-blue-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMAL ? 'animate-spin' : ''}`} />
                        <span>Resync Watchlist</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectMAL}
                        className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Disconnect</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 text-sm">No MyAnimeList Account Linked</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Import your public list below or connect your MAL token for full two-way synchronization.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Option 1: 1-Click MAL Username Import */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div>
                  <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <Download className="w-4 h-4 text-blue-400" />
                    <span>Option 1: 1-Click Public MAL Username Import</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Import your entire watching, completed, and plan-to-watch anime list directly from MyAnimeList.
                  </p>
                </div>

                <form onSubmit={handleImportMALWatchlist} className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <input
                    type="text"
                    placeholder="Enter MyAnimeList username (e.g. AnimeFan99)"
                    value={malUsernameInput}
                    onChange={e => setMalUsernameInput(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#0b0e1b] border border-slate-800 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSyncingMAL || !malUsernameInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSyncingMAL ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>{isSyncingMAL ? 'Importing...' : 'Import MAL List'}</span>
                  </button>
                </form>
              </div>

              {/* Option 2: Live Two-Way Sync / Token Connection */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div>
                  <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                    <span>Option 2: Live Two-Way MAL Sync</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Connect an official MyAnimeList OAuth token to automatically push episode progress and score updates.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={getMALAuthUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 text-center"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Authorize with MyAnimeList</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setShowMALTokenInput(!showMALTokenInput)}
                    className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition text-center cursor-pointer"
                  >
                    {showMALTokenInput ? 'Hide Token Form' : 'Paste MAL Access Token'}
                  </button>
                </div>

                {showMALTokenInput && (
                  <div className="p-4 rounded-xl bg-[#0b0e1b] border border-blue-500/30 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-300">MyAnimeList Access Token</span>
                      <a
                        href="https://myanimelist.net/apiconfig"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1"
                      >
                        MAL API Settings &rarr;
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Paste MAL token here..."
                        value={malTokenInput}
                        onChange={e => setMalTokenInput(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleConnectMALToken}
                        disabled={isSyncingMAL || !malTokenInput.trim()}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                      >
                        {isSyncingMAL ? 'Connecting...' : 'Connect'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 2: NOTIFICATIONS & ALERTS */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-400" />
                  <span>Notification Center & Alerts</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Configure broadcast schedule notifications, airing alerts for your watchlist, and push notifications.
                </p>
              </div>

              {/* Master Notification Switch */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-200 text-sm">
                    In-App Notification System
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enable notification badges, airing alerts, and toast banners.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notificationsEnabled}
                    onChange={e => onSaveSettings({ ...settings, notificationsEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Specific Notification Preferences */}
              <div className={`space-y-3 transition-opacity ${settings.notificationsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-200">
                      Watchlist Airing Episode Alerts
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Notify me when a new episode of an anime in my library broadcasts.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyAiringEpisodes}
                    onChange={e => onSaveSettings({ ...settings, notifyAiringEpisodes: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-200">
                      AniList Two-Way Sync Alerts
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Show in-app toasts when progress or status updates sync to AniList.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifySyncUpdates}
                    onChange={e => onSaveSettings({ ...settings, notifySyncUpdates: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-200">
                      Native Browser Push Notifications
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Receive desktop or mobile notifications even when the tab is backgrounded.
                    </div>
                  </div>
                  <button
                    onClick={handleRequestPushPermission}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      settings.browserPushEnabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {settings.browserPushEnabled ? 'Enabled' : 'Request Permission'}
                  </button>
                </div>
              </div>

              {/* Test Notification Button */}
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between gap-4">
                <div>
                  <h5 className="text-xs font-bold text-indigo-200">
                    Test Notification Dispatch
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Trigger a sample airing alert to test notification popup banners and browser permissions.
                  </p>
                </div>
                <button
                  onClick={onSendTestNotification}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition shrink-0 shadow-md shadow-indigo-600/30"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Alert</span>
                </button>
              </div>
            </div>
          )}

          {/* SECTION 3: PLAYER & STREAMING PREFERENCES */}
          {activeSection === 'player' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Play className="w-5 h-5 text-emerald-400" />
                  <span>Player & Streaming Preferences</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Customize your default audio language, video player options, and server configurations.
                </p>
              </div>

              {/* Preferred Audio Language Ranking (1st and 2nd Priority - Default English Dub) */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-indigo-400" />
                      <span>Preferred Audio Language (Priority Order)</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Defaulting to English Voice Dubbing with automatic failover to Japanese Subtitles (or vice versa).
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-[11px] font-bold text-indigo-300">
                    Auto-Synced with Player
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Priority 1 (Default: English Dub) */}
                  <div className="p-3.5 rounded-xl bg-[#0b0e1b] border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span className="text-amber-400">1st Preference (Primary):</span>
                      <span className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-500/40 text-[10px] text-amber-300 font-black">Rank 1</span>
                    </div>
                    <select
                      value={String(settings.preferredLanguages?.[0] || settings.preferredAudio || 'DUB').toUpperCase()}
                      onChange={e => {
                        const first = e.target.value as any;
                        const second = String(settings.preferredLanguages?.[1] || (first === 'DUB' ? 'SUB' : 'DUB')).toUpperCase();
                        onSaveSettings({
                          ...settings,
                          preferredAudio: (first === 'SUB' ? 'sub' : 'dub') as 'sub' | 'dub',
                          preferredLanguages: [first, second],
                        });
                        onShowToast('success', `Primary audio set to ${first.toUpperCase()}.`, 'Audio Updated');
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="DUB">🇺🇸 English Voice Dubbing (DUB) — Default</option>
                      <option value="SUB">🇯🇵 Japanese Audio with English Subtitles (SUB)</option>
                    </select>
                  </div>

                  {/* Priority 2 (Default: Japanese Sub) */}
                  <div className="p-3.5 rounded-xl bg-[#0b0e1b] border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span className="text-indigo-400">2nd Preference (Fallback):</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-950/70 border border-indigo-500/40 text-[10px] text-indigo-300 font-black">Rank 2</span>
                    </div>
                    <select
                      value={String(settings.preferredLanguages?.[1] || (settings.preferredLanguages?.[0] === 'DUB' ? 'SUB' : 'DUB')).toUpperCase()}
                      onChange={e => {
                        const second = e.target.value as any;
                        const first = String(settings.preferredLanguages?.[0] || 'DUB').toUpperCase();
                        onSaveSettings({
                          ...settings,
                          preferredLanguages: [first, second],
                        });
                        onShowToast('success', `Secondary fallback audio set to ${second.toUpperCase()}.`, 'Audio Updated');
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="SUB">🇯🇵 Japanese Audio with English Subtitles (SUB)</option>
                      <option value="DUB">🇺🇸 English Voice Dubbing (DUB)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 12 Streaming Scraper Servers with 3-Level Prioritization Failover */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-orange-400" />
                      <span>Streaming Scraper Servers (Prioritize Top 3)</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Prioritize up to 3 scraper servers. The video player connects in this exact priority sequence with instant failover.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSaveSettings({
                        ...settings,
                        preferredServers: ['tatakai-multi', 'anify-cloud', 'anikoto-hd1'],
                        defaultStreamServer: 'tatakai-multi',
                      });
                      onShowToast('success', 'Reset servers to Default (1. Tatakai Multi-Dub, 2. Anify Media Cloud, 3. Anikoto HD-1).', 'Defaults Restored');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-[11px] font-bold text-indigo-300 transition cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>

                {/* 3 Priority Slots */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Priority 1 */}
                  <div className="p-3.5 rounded-xl bg-[#0b0e1b] border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-amber-400 flex items-center gap-1">
                        <span>#1</span>
                        <span>Primary Server:</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black">
                        Priority 1
                      </span>
                    </div>
                    <select
                      value={settings.preferredServers?.[0] || 'tatakai-multi'}
                      onChange={e => {
                        const newFirst = e.target.value as StreamServerId;
                        const p2 = settings.preferredServers?.[1] || 'anify-cloud';
                        const p3 = settings.preferredServers?.[2] || 'anikoto-hd1';
                        onSaveSettings({
                          ...settings,
                          preferredServers: [newFirst, p2, p3],
                          defaultStreamServer: newFirst,
                        });
                        onShowToast('success', `Priority 1 set to ${newFirst}.`, 'Server Updated');
                      }}
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {STREAM_PROVIDERS.map(prov => (
                        <option key={`p1-${prov.id}`} value={prov.id}>
                          {prov.label} {prov.tag ? `[${prov.tag}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority 2 */}
                  <div className="p-3.5 rounded-xl bg-[#0b0e1b] border border-indigo-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-indigo-400 flex items-center gap-1">
                        <span>#2</span>
                        <span>Secondary Failover:</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-black">
                        Priority 2
                      </span>
                    </div>
                    <select
                      value={settings.preferredServers?.[1] || 'anify-cloud'}
                      onChange={e => {
                        const newSecond = e.target.value as StreamServerId;
                        const p1 = settings.preferredServers?.[0] || 'tatakai-multi';
                        const p3 = settings.preferredServers?.[2] || 'anikoto-hd1';
                        onSaveSettings({
                          ...settings,
                          preferredServers: [p1, newSecond, p3],
                        });
                        onShowToast('success', `Priority 2 set to ${newSecond}.`, 'Server Updated');
                      }}
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {STREAM_PROVIDERS.map(prov => (
                        <option key={`p2-${prov.id}`} value={prov.id}>
                          {prov.label} {prov.tag ? `[${prov.tag}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority 3 */}
                  <div className="p-3.5 rounded-xl bg-[#0b0e1b] border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-cyan-400 flex items-center gap-1">
                        <span>#3</span>
                        <span>Tertiary Failover:</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-black">
                        Priority 3
                      </span>
                    </div>
                    <select
                      value={settings.preferredServers?.[2] || 'anikoto-hd1'}
                      onChange={e => {
                        const newThird = e.target.value as StreamServerId;
                        const p1 = settings.preferredServers?.[0] || 'tatakai-multi';
                        const p2 = settings.preferredServers?.[1] || 'anify-cloud';
                        onSaveSettings({
                          ...settings,
                          preferredServers: [p1, p2, newThird],
                        });
                        onShowToast('success', `Priority 3 set to ${newThird}.`, 'Server Updated');
                      }}
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      {STREAM_PROVIDERS.map(prov => (
                        <option key={`p3-${prov.id}`} value={prov.id}>
                          {prov.label} {prov.tag ? `[${prov.tag}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Auto-Skip Opening Themes / Intro */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Auto-Skip Opening Themes (Intro)</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Automatically skips opening theme songs using Anikoto timestamp markers.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.autoSkipIntro)}
                  onChange={e => onSaveSettings({ ...settings, autoSkipIntro: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 cursor-pointer"
                />
              </div>

              {/* Autoplay Next Episode */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-200">
                    Auto-Play Next Episode
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Automatically advance and track the next episode when playback completes.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoPlayNextEpisode}
                  onChange={e => onSaveSettings({ ...settings, autoPlayNextEpisode: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 cursor-pointer"
                />
              </div>

              {/* Ambient Glow */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-200">
                    Ambient Player Glow
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Dynamic backlight glow matching the video player theme.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.ambientGlowEnabled !== false}
                  onChange={e => onSaveSettings({ ...settings, ambientGlowEnabled: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 cursor-pointer"
                />
              </div>

              {/* 3D Anime Card Pop-up Preview Option */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    <span>3D Anime Card Pop-up Preview</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Show 360° holographic 3D collectible card pop-up when clicking an anime card before entering full details.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enable3DCardPreview !== false}
                  onChange={e => onSaveSettings({ ...settings, enable3DCardPreview: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded bg-slate-900 border-slate-700 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* SECTION 4: DATA, BACKUP & CACHE */}
          {activeSection === 'backup' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  <span>Data, Backups & Local Cache</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Export your watch history, import backups across devices, or manage local browser storage.
                </p>
              </div>

              {/* Export / Import Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Export Library Backup</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Download a complete `.json` file containing your tracked anime, episode progress, and custom status.
                    </p>
                  </div>
                  <button
                    onClick={onExportBackup}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                      <Upload className="w-4 h-4 text-indigo-400" />
                      <span>Restore Library Backup</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Load and merge an existing `.json` library backup file from your device.
                    </p>
                  </div>
                  <label className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select Backup File</span>
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
          )}

          {/* SECTION 5: ABOUT */}
          {activeSection === 'about' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-purple-400" />
                  <span>About AniLove PRO</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  High-performance Anime Tracker & Streaming Platform powered by AniList GraphQL.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 text-xs text-slate-300 leading-relaxed">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="font-semibold text-slate-400">Application Version</span>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                    v2.4.0 (Latest Release)
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="font-semibold text-slate-400">AniList GraphQL API</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Operational
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="font-semibold text-slate-400">Streaming Engine</span>
                  <span className="text-indigo-300 font-medium">Multi-Source HD Mirrors</span>
                </div>

                <p className="text-[11px] text-slate-500 pt-2">
                  Disclaimer: AniLove does not host or store any media files on its servers. All content is retrieved from third-party streaming services and official AniList metadata feeds.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
