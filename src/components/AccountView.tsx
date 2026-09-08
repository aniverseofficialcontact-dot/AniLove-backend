import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  ShieldCheck,
  ShieldAlert,
  Bell,
  Sliders,
  ChevronRight,
  ChevronDown,
  LogOut,
  Sparkles,
  Lock,
  Unlock,
  Volume2,
  Subtitles,
  Database,
  Cloud,
  CheckCircle2,
  RefreshCw,
  Edit3,
  Mail,
  Smartphone,
  Flame,
  Award,
  Crown,
  KeyRound,
  Download,
  Upload,
  Globe,
  Check,
  Plus,
  Trash2,
  X,
  Eye,
  EyeOff,
  Radio,
  Image as ImageIcon,
  UserCheck,
  Snowflake,
  Palette,
  HelpCircle,
  RotateCcw,
  Film,
  BookmarkCheck,
  Bookmark,
  Play,
  Share2,
  Send,
  Copy,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserSettings, UserMediaListItem, UserProfile, GachaCard, StreamServerId, AnimeReel } from '../types';
import { auth, signInWithGoogle, logoutUser, syncUserProfileToCloud } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { fetchUserMediaList, fetchAniListUserProfile, fetchViewerProfile, getAniListAuthUrl, extractAniListToken } from '../services/anilist';
import { getStoredGachaVault, getCardAwakeningLevel } from '../services/storage';
import { getSafeCharacterImage, getFallbackAvatarSvg } from '../services/characterPool';
import { STREAM_PROVIDERS } from '../services/streamingProviders';
import { getStoredSavedReels, removeSavedReel, clearAllSavedReels, syncReelsFromGoogleDrive } from '../services/reelsService';

interface AccountViewProps {
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings) => void;
  onImportList: (items: UserMediaListItem[], username: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'sync', message: string, title?: string) => void;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  libraryCount: number;
  isPinUnlocked?: boolean;
  onLockSession?: () => void;
  onUnlockSession?: () => void;
  onNavigateToReels?: (reelId?: string) => void;
  onReplayIntro?: () => void;
  onOpenUsernameModal?: () => void;
  onNavigateToMessages?: () => void;
}

// Preset High-Resolution Anime Avatars
const PRESET_AVATARS = [
  {
    name: 'Tanjiro',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Gojo / Cyber',
    url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Sakura / Blade',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Shadow Sorcerer',
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Neon Shinobi',
    url: 'https://images.unsplash.com/photo-1569705460033-cfaa4bf9f822?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Aether Wanderer',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80',
  },
];

export const AccountView: React.FC<AccountViewProps> = ({
  settings,
  onSaveSettings,
  onImportList,
  onShowToast,
  onExportBackup,
  onImportBackup,
  libraryCount,
  isPinUnlocked = true,
  onLockSession,
  onUnlockSession,
  onNavigateToReels,
  onReplayIntro,
  onOpenUsernameModal,
  onNavigateToMessages,
}) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Saved Reels State
  const [savedReels, setSavedReels] = useState<AnimeReel[]>(() => getStoredSavedReels());
  const [previewReel, setPreviewReel] = useState<AnimeReel | null>(null);

  useEffect(() => {
    const handleReelsUpdate = () => {
      setSavedReels(getStoredSavedReels());
    };
    window.addEventListener('anilove-saved-reels-updated', handleReelsUpdate);
    return () => window.removeEventListener('anilove-saved-reels-updated', handleReelsUpdate);
  }, []);

  const handleRemoveSavedReel = (reelId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = removeSavedReel(reelId);
    setSavedReels(updated);
    if (previewReel?.id === reelId) setPreviewReel(null);
    onShowToast('info', 'Reel removed from your saved collection');
  };

  const handleClearAllSaved = () => {
    if (savedReels.length === 0) return;
    clearAllSavedReels();
    setSavedReels([]);
    setPreviewReel(null);
    onShowToast('info', 'All saved reels cleared');
  };

  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isSwitchProfileOpen, setIsSwitchProfileOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isNewProfileModalOpen, setIsNewProfileModalOpen] = useState(false);
  const [isShareWebsiteModalOpen, setIsShareWebsiteModalOpen] = useState(false);
  const [copiedWebsiteLink, setCopiedWebsiteLink] = useState(false);

  // Share Website Handlers
  const handleShareWebsite = async () => {
    const websiteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://anilove.app';
    const shareTitle = 'AniLove - Anime Tracker, Streaming & Edits';
    const shareText = 'Discover trending anime, stream episodes, and watch HD anime edits on AniLove. Your ultimate anime companion!';

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: websiteUrl,
        });
        onShowToast('success', 'Thank you for sharing AniLove!', 'Shared');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // Open dedicated visual share modal with card preview & social buttons
    setIsShareWebsiteModalOpen(true);
  };

  const handleCopyWebsiteLink = async () => {
    const websiteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://anilove.app';
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(websiteUrl);
        copied = true;
      } catch {}
    }
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = websiteUrl;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
    setCopiedWebsiteLink(true);
    setTimeout(() => setCopiedWebsiteLink(false), 2500);
    onShowToast('success', 'Website link copied to clipboard! Share it with your friends.', 'Link Copied');
  };

  // Owned Gacha Cards for profile avatars (sorted by awakening level descending)
  const [vaultCards, setVaultCards] = useState<GachaCard[]>(() => {
    const raw = getStoredGachaVault();
    return [...raw].sort((a, b) => getCardAwakeningLevel(b.id) - getCardAwakeningLevel(a.id));
  });
  const [avatarTab, setAvatarTab] = useState<'presets' | 'owned'>('presets');

  // Edit Profile Form State
  const [editName, setEditName] = useState(settings.customDisplayName || 'Anime Explorer');
  const [editAvatar, setEditAvatar] = useState(settings.customAvatar || PRESET_AVATARS[0].url);

  // Refresh vault cards when opening modal
  useEffect(() => {
    if (isEditProfileOpen || isNewProfileModalOpen) {
      const raw = getStoredGachaVault();
      setVaultCards([...raw].sort((a, b) => getCardAwakeningLevel(b.id) - getCardAwakeningLevel(a.id)));
    }
  }, [isEditProfileOpen, isNewProfileModalOpen]);

  // New Profile Form State
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileAvatar, setNewProfileAvatar] = useState(PRESET_AVATARS[1].url);

  // PIN Form State
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [pinBackupAnswerInput, setPinBackupAnswerInput] = useState('');
  const [pinRecoveryAnswerInput, setPinRecoveryAnswerInput] = useState('');
  const [pinStep, setPinStep] = useState<'create' | 'verify' | 'remove' | 'recovery'>('create');
  const [pinError, setPinError] = useState('');

  // AniList username & token sync state
  const [anilistUsernameInput, setAnilistUsernameInput] = useState(settings.importUsername || '');
  const [anilistTokenInput, setAnilistTokenInput] = useState(settings.anilistToken || '');
  const [isSyncingAniList, setIsSyncingAniList] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [isCloudResyncing, setIsCloudResyncing] = useState(false);

  // Accordion / Dropdown open section state (default: 'account_security')
  const [openSection, setOpenSection] = useState<string | null>('account_security');
  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  // Profiles list fallback
  const profiles: UserProfile[] = settings.profiles && settings.profiles.length > 0
    ? settings.profiles
    : [
        {
          id: 'profile-main',
          name: settings.customDisplayName || 'Anime Explorer',
          avatar: settings.customAvatar || PRESET_AVATARS[0].url,
          email: currentUser?.email || settings.customEmail || '',
          createdAt: Date.now(),
        },
      ];

  const currentProfile = profiles.find(p => p.id === settings.currentProfileId) || profiles[0];

  // Listen to Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      if (user) {
        syncUserProfileToCloud(user, settings, libraryCount);
      }
    });
    return () => unsubscribe();
  }, [settings, libraryCount]);

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        onShowToast(
          'success',
          `Welcome back, ${user.displayName || 'Anime Fan'}! Cloud sync active.`,
          'Signed In'
        );
        syncUserProfileToCloud(user, settings, libraryCount);
        // Automatically sync email & name from authenticated Google account
        if (user.displayName || user.email) {
          const updated: UserSettings = {
            ...settings,
            customDisplayName: user.displayName || settings.customDisplayName,
            customEmail: user.email || settings.customEmail || '',
            customAvatar: user.photoURL || settings.customAvatar,
          };
          onSaveSettings(updated);
        }
      }
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        onShowToast(
          'info',
          `Add "${host}" to Firebase Console -> Authentication -> Settings -> Authorized Domains to sign in. Your local and guest data remains safe!`,
          'Google Auth: Domain Authorization'
        );
      } else {
        console.error('Google Sign In failed:', err);
        onShowToast('error', err.message || 'Failed to sign in with Google.', 'Sign-In Failed');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Sign Out Handler
  const handleSignOut = async () => {
    try {
      await logoutUser();
      onShowToast('info', 'Signed out of cloud account. Switched to local profile.', 'Signed Out');
    } catch (err: any) {
      onShowToast('error', 'Error signing out.', 'Error');
    }
  };

  // Save Edited Profile (Name, Logo - Email is bound to Firebase/Google Account)
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = editName.trim() || 'Anime Explorer';
    const finalAvatar = editAvatar;
    const masterEmail = currentUser?.email || settings.customEmail || currentProfile.email || '';

    // Update active profile in profiles array
    const updatedProfiles = profiles.map(p => {
      if (p.id === currentProfile.id) {
        return {
          ...p,
          name: finalName,
          email: masterEmail,
          avatar: finalAvatar,
        };
      }
      return p;
    });

    const newSettings: UserSettings = {
      ...settings,
      customDisplayName: finalName,
      customEmail: masterEmail,
      customAvatar: finalAvatar,
      profiles: updatedProfiles,
    };

    onSaveSettings(newSettings);
    setIsEditProfileOpen(false);
    onShowToast('success', 'Profile details updated successfully!', 'Profile Saved');
  };

  // Switch Active Profile
  const handleSwitchProfile = (profile: UserProfile) => {
    const masterEmail = currentUser?.email || settings.customEmail || profile.email || '';
    const newSettings: UserSettings = {
      ...settings,
      currentProfileId: profile.id,
      customDisplayName: profile.name,
      customEmail: masterEmail,
      customAvatar: profile.avatar,
    };
    onSaveSettings(newSettings);
    setIsSwitchProfileOpen(false);
    onShowToast('info', `Switched active profile to "${profile.name}".`, 'Profile Switched');
  };

  // Create New Profile
  const handleCreateNewProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) {
      onShowToast('error', 'Please enter a name for the new profile.', 'Name Required');
      return;
    }

    const masterEmail = currentUser?.email || settings.customEmail || '';
    const newProf: UserProfile = {
      id: `profile-${Date.now()}`,
      name: newProfileName.trim(),
      avatar: newProfileAvatar,
      email: masterEmail,
      createdAt: Date.now(),
    };

    const updatedProfiles = [...profiles, newProf];
    const newSettings: UserSettings = {
      ...settings,
      profiles: updatedProfiles,
      currentProfileId: newProf.id,
      customDisplayName: newProf.name,
      customEmail: masterEmail,
      customAvatar: newProf.avatar,
    };

    onSaveSettings(newSettings);
    setNewProfileName('');
    setIsNewProfileModalOpen(false);
    setIsSwitchProfileOpen(false);
    onShowToast('success', `Created & switched to profile "${newProf.name}"!`, 'Profile Created');
  };

  // Delete Profile
  const handleDeleteProfile = (profileId: string, profileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (profiles.length <= 1) {
      onShowToast('error', 'You must have at least one active profile.', 'Cannot Delete');
      return;
    }

    const remaining = profiles.filter(p => p.id !== profileId);
    const nextCurrent = remaining[0];
    const newSettings: UserSettings = {
      ...settings,
      profiles: remaining,
      currentProfileId: settings.currentProfileId === profileId ? nextCurrent.id : settings.currentProfileId,
      customDisplayName: settings.currentProfileId === profileId ? nextCurrent.name : settings.customDisplayName,
      customAvatar: settings.currentProfileId === profileId ? nextCurrent.avatar : settings.customAvatar,
    };

    onSaveSettings(newSettings);
    onShowToast('info', `Profile "${profileName}" was removed.`, 'Profile Deleted');
  };

  // PIN Setup / Save / Recovery
  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (pinStep === 'create') {
      if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
        setPinError('PIN must be exactly 4 numeric digits.');
        return;
      }
      if (pinInput !== pinConfirmInput) {
        setPinError('PINs do not match. Please re-enter.');
        return;
      }
      if (!pinBackupAnswerInput.trim()) {
        setPinError('Please enter an answer for the security backup question.');
        return;
      }

      const newSettings: UserSettings = {
        ...settings,
        profilePin: pinInput,
        profilePinEnabled: true,
        profilePinBackupQuestion: 'what/who do you like most?',
        profilePinBackupAnswer: pinBackupAnswerInput.trim(),
      };
      onSaveSettings(newSettings);
      setIsPinModalOpen(false);
      setPinInput('');
      setPinConfirmInput('');
      setPinBackupAnswerInput('');
      onShowToast('success', 'Profile PIN and backup question activated!', 'PIN Enabled');
    } else if (pinStep === 'remove') {
      if (pinInput !== settings.profilePin) {
        setPinError('Incorrect PIN. Please enter your current 4-digit PIN or use the backup question.');
        return;
      }

      const newSettings: UserSettings = {
        ...settings,
        profilePin: null,
        profilePinEnabled: false,
        profilePinBackupAnswer: null,
      };
      onSaveSettings(newSettings);
      setIsPinModalOpen(false);
      setPinInput('');
      onShowToast('info', 'Profile PIN has been removed.', 'PIN Disabled');
    } else if (pinStep === 'recovery') {
      const cleanEntered = pinRecoveryAnswerInput.trim().toLowerCase();
      const cleanExpected = (settings.profilePinBackupAnswer || '').trim().toLowerCase();

      if (!settings.profilePinBackupAnswer || (cleanEntered && cleanEntered === cleanExpected)) {
        const newSettings: UserSettings = {
          ...settings,
          profilePin: null,
          profilePinEnabled: false,
          profilePinBackupAnswer: null,
        };
        onSaveSettings(newSettings);
        setIsPinModalOpen(false);
        setPinRecoveryAnswerInput('');
        setPinInput('');
        onShowToast('info', 'Profile PIN has been reset using backup question.', 'PIN Reset');
      } else {
        setPinError('Incorrect answer to security question. Please check spelling and try again.');
      }
    }
  };

  // Connect AniList Access Token for 2-Way Live Sync
  const handleConnectAniListToken = async (tokenToUse?: string) => {
    const token = extractAniListToken(tokenToUse || anilistTokenInput);
    if (!token) {
      onShowToast('error', 'Please paste a valid AniList OAuth Access Token.', 'Token Required');
      return;
    }

    setIsSyncingAniList(true);
    try {
      // 1. Fetch authenticated viewer
      const viewer = await fetchViewerProfile(token);
      if (!viewer || !viewer.name) {
        throw new Error('Could not retrieve AniList profile with this token.');
      }

      // 2. Fetch user's media list
      const items = await fetchUserMediaList(viewer.name);
      if (items && items.length > 0) {
        onImportList(items, viewer.name);
      }

      // 3. Save to settings with Two-Way Sync Active
      const updated: UserSettings = {
        ...settings,
        anilistToken: token,
        importUsername: viewer.name,
        anilistUser: viewer,
        twoWaySyncEnabled: true,
        syncWatchStatus: true,
        syncEpisodeProgress: true,
        syncScores: true,
        lastSyncTimestamp: Date.now(),
      };

      onSaveSettings(updated);
      setShowTokenInput(false);
      onShowToast(
        'success',
        `Live Two-Way Sync enabled for "${viewer.name}"! Changes made here will update your AniList profile.`,
        'Two-Way Live Sync Active'
      );
    } catch (err: any) {
      console.error('AniList Token Connection Error:', err);
      onShowToast('error', err.message || 'Invalid AniList token. Please verify and retry.', 'Token Invalid');
    } finally {
      setIsSyncingAniList(false);
    }
  };

  // One-Click AniList Username Sync (Public Watchlist Import)
  const handleSyncAniListUsername = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const username = anilistUsernameInput.trim();
    if (!username) {
      onShowToast('error', 'Please enter your AniList username.', 'Username Required');
      return;
    }

    setIsSyncingAniList(true);
    try {
      // 1. Fetch user watchlist
      const items = await fetchUserMediaList(username);
      if (!items || items.length === 0) {
        onShowToast('info', `No anime records found under AniList username "${username}".`, 'List Empty');
        setIsSyncingAniList(false);
        return;
      }

      // 2. Fetch user profile stats & avatar
      let aniUser = null;
      try {
        aniUser = await fetchAniListUserProfile(username);
      } catch (profileErr) {
        console.warn('Could not fetch AniList user profile metadata:', profileErr);
      }

      // 3. Save to library & settings (Username-only is 1-way sync)
      onImportList(items, username);
      const updated: UserSettings = {
        ...settings,
        importUsername: username,
        anilistUser: aniUser || {
          id: 0,
          name: username,
          avatar: { large: PRESET_AVATARS[0].url },
        },
        lastSyncTimestamp: Date.now(),
      };

      onSaveSettings(updated);
      onShowToast(
        'sync',
        `Successfully synced ${items.length} anime entries from "${username}"!`,
        'AniList Synced'
      );
    } catch (err: any) {
      console.error('AniList Sync Error:', err);
      onShowToast('error', err.message || 'Failed to sync with AniList. Check username spelling.', 'Sync Failed');
    } finally {
      setIsSyncingAniList(false);
    }
  };

  // Disconnect AniList
  const handleDisconnectAniList = () => {
    onSaveSettings({
      ...settings,
      importUsername: null,
      anilistToken: null,
      anilistUser: null,
      twoWaySyncEnabled: false,
      lastSyncTimestamp: null,
    });
    setAnilistUsernameInput('');
    setAnilistTokenInput('');
    onShowToast('info', 'AniList account disconnected.', 'Disconnected');
  };

  // Force Cloud Resync with Firebase Firestore
  const handleForceCloudResync = async () => {
    if (!currentUser) {
      onShowToast('info', 'Sign in with Google to enable Firebase cross-device cloud sync.', 'Sign In Required');
      return;
    }
    setIsCloudResyncing(true);
    try {
      await syncUserProfileToCloud(currentUser, settings, libraryCount);
      onShowToast(
        'success',
        'Your watch history, library, and settings are fully synchronized with Firebase across all your devices.',
        'Cloud Resynced'
      );
    } catch (err: any) {
      console.error('Cloud resync error:', err);
      onShowToast('error', 'Could not resync with Firebase cloud.', 'Sync Error');
    } finally {
      setIsCloudResyncing(false);
    }
  };

  // Toggle Content Restrictions (18+ / Mature filter)
  const handleToggleContentRestrictions = () => {
    const updatedVal = !settings.contentRestrictions;
    onSaveSettings({
      ...settings,
      contentRestrictions: updatedVal,
    });
    onShowToast(
      updatedVal ? 'info' : 'success',
      updatedVal
        ? 'Content Restrictions turned ON: 18+ and adult content will be filtered.'
        : 'Content Restrictions turned OFF: All anime content visible.',
      'Content Filter'
    );
  };

  const displayName = currentUser?.displayName || currentProfile.name || settings.customDisplayName || 'Anime Explorer';
  const email = currentUser?.email || settings.customEmail || currentProfile.email || 'Guest User (Not Signed In)';
  const avatarUrl = currentUser?.photoURL || currentProfile.avatar || settings.customAvatar || PRESET_AVATARS[0].url;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* PROFILE HEADER CARD */}
      <div className="relative rounded-3xl overflow-hidden p-6 sm:p-8 bg-gradient-to-b from-pink-950/40 via-slate-900/90 to-slate-900/90 border border-white/15 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center space-y-4">
          {/* Avatar Circle with Neon Ring & Edit Pencil */}
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-violet-600 p-1 shadow-xl shadow-pink-500/30">
              <div className="w-full h-full rounded-full bg-slate-950 overflow-hidden flex items-center justify-center relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-600 to-violet-800 text-white text-3xl font-black">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Click to Edit Avatar / Profile */}
            <button
              onClick={() => {
                setEditName(displayName);
                setEditAvatar(avatarUrl);
                setIsEditProfileOpen(true);
              }}
              className="absolute bottom-0 right-0 p-2.5 rounded-full bg-pink-500 text-white shadow-lg border-2 border-slate-900 cursor-pointer hover:bg-pink-600 transition active:scale-95"
              title="Change Name or Avatar"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {/* User Display Info */}
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <span>{displayName}</span>
              {currentUser && (
                <CheckCircle2 className="w-5 h-5 text-pink-400" title="Google Account Verified" />
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
              {email}
            </p>

            {/* Unique Chat Handle & Bio */}
            {settings.uniqueUsername ? (
              <div className="pt-2 flex flex-col items-center gap-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/40 text-pink-300 text-xs font-black">
                  <span>@{settings.uniqueUsername}</span>
                </span>
                {settings.userBio && (
                  <p className="text-xs text-slate-300 italic max-w-sm mx-auto line-clamp-2">
                    "{settings.userBio}"
                  </p>
                )}
              </div>
            ) : (
              <div className="pt-2">
                <button
                  onClick={onOpenUsernameModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 text-pink-300 text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-spin" />
                  <span>Claim Your Unique @Username to Chat</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {/* Direct Messages Shortcut */}
            {onNavigateToMessages && (
              <button
                onClick={onNavigateToMessages}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 text-white text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-pink-500/25 active:scale-95"
              >
                <Send className="w-3.5 h-3.5 -rotate-12" />
                <span>Open DMs & Chat</span>
              </button>
            )}

            {/* Claim or Edit Handle Button */}
            {onOpenUsernameModal && (
              <button
                onClick={onOpenUsernameModal}
                className="px-4 py-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/40 text-pink-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer backdrop-blur-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{settings.uniqueUsername ? 'Edit Chat Bio' : 'Claim Handle'}</span>
              </button>
            )}

            <button
              onClick={() => {
                setEditName(displayName);
                setEditAvatar(avatarUrl);
                setIsEditProfileOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer backdrop-blur-md"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>

            <button
              onClick={() => setIsSwitchProfileOpen(true)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer backdrop-blur-md"
            >
              <User className="w-3.5 h-3.5 text-violet-400" />
              <span>Switch Profile</span>
            </button>

            <button
              onClick={handleShareWebsite}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-pink-500/20 hover:from-pink-500/30 hover:to-purple-500/30 border border-pink-500/40 text-pink-200 hover:text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer backdrop-blur-md active:scale-95 shadow-sm"
              title="Share AniLove website with thumbnail card preview"
            >
              <Share2 className="w-3.5 h-3.5 text-pink-400" />
              <span>Share Website</span>
            </button>

            {currentUser ? (
              <button
                onClick={handleSignOut}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer backdrop-blur-md"
              >
                <LogOut className="w-3.5 h-3.5 text-pink-400" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                disabled={isAuthLoading}
                onClick={handleGoogleSignIn}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white text-xs font-extrabold shadow-lg shadow-pink-500/25 transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isAuthLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                <span>Sign In with Google</span>
              </button>
            )}

            <div className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 backdrop-blur-md flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-pink-400" />
              <span>{libraryCount} in Watchlist</span>
            </div>
          </div>
        </div>
      </div>

      {/* ACCORDION CONTAINER FOR ACCOUNT SECTIONS */}
      <div className="space-y-4">
        {/* SECTION 1: ACCOUNT & SECURITY */}
        <div className={`rounded-3xl transition-all duration-200 border backdrop-blur-xl shadow-lg overflow-hidden ${
          openSection === 'account_security' ? 'bg-slate-900/80 border-pink-500/30' : 'bg-slate-900/50 border-white/10 hover:border-white/20'
        }`}>
          <button
            type="button"
            onClick={() => toggleSection('account_security')}
            className="w-full p-5 sm:p-6 flex items-center justify-between text-left cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-2xl border transition ${
                openSection === 'account_security' ? 'bg-pink-500/20 text-pink-400 border-pink-500/40' : 'bg-white/5 text-slate-300 border-white/10'
              }`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">Account & Security</h2>
                  {settings.profilePinEnabled ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      PIN Protected
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/10 text-slate-400">
                      Profiles & PIN
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Multi-profile switching, security 4-digit PIN lock, and session management
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs font-bold text-pink-400 hidden sm:inline">
                {openSection === 'account_security' ? 'Hide' : 'Manage'}
              </span>
              <div className={`p-2 rounded-xl bg-white/5 text-slate-300 transition-transform duration-300 ${
                openSection === 'account_security' ? 'rotate-180 bg-pink-500/20 text-pink-300' : ''
              }`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <AnimatePresence initial={false}>
            {openSection === 'account_security' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 pt-2 border-t border-white/10 space-y-4">
                  <div className="divide-y divide-white/5">
                    {/* Switch Profile Row */}
                    <div
                      onClick={() => setIsSwitchProfileOpen(true)}
                      className="py-3.5 flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/5 text-pink-300 group-hover:bg-pink-500/20 transition">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-pink-300 transition">Switch Profile</p>
                          <p className="text-xs text-slate-400">Manage multiple profiles or create a guest profile</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-300 font-semibold">{displayName}</span>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-pink-400 transition" />
                      </div>
                    </div>

                    {/* Profile PIN Row */}
                    <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${settings.profilePinEnabled ? (isPinUnlocked ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30') : 'bg-white/5 text-slate-400'}`}>
                          {settings.profilePinEnabled ? (
                            isPinUnlocked ? <Unlock className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">Profile PIN Lock</p>
                            {settings.profilePinEnabled && (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                isPinUnlocked
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}>
                                {isPinUnlocked ? 'Unlocked' : 'Locked'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {settings.profilePinEnabled
                              ? '4-digit PIN lock with security question recovery ("what/who do you like most?").'
                              : 'Set a 4-digit PIN to lock and protect your Library & Cards Binder with a backup security question.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-auto">
                        {settings.profilePinEnabled && (
                          <>
                            {isPinUnlocked && onLockSession && (
                              <button
                                type="button"
                                onClick={onLockSession}
                                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Lock Now</span>
                              </button>
                            )}
                            {!isPinUnlocked && onUnlockSession && (
                              <button
                                type="button"
                                onClick={onUnlockSession}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>Unlock</span>
                              </button>
                            )}
                          </>
                        )}

                        {settings.profilePinEnabled ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPinStep('remove');
                              setPinInput('');
                              setPinError('');
                              setIsPinModalOpen(true);
                            }}
                            className="text-xs font-bold text-pink-400 hover:text-pink-300 underline cursor-pointer"
                          >
                            Change / Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setPinStep('create');
                              setPinInput('');
                              setPinConfirmInput('');
                              setPinError('');
                              setIsPinModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 text-xs font-bold transition cursor-pointer"
                          >
                            Set PIN
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (settings.profilePinEnabled) {
                              setPinStep('remove');
                              setPinInput('');
                              setPinError('');
                              setIsPinModalOpen(true);
                            } else {
                              setPinStep('create');
                              setPinInput('');
                              setPinConfirmInput('');
                              setPinError('');
                              setIsPinModalOpen(true);
                            }
                          }}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            settings.profilePinEnabled ? 'bg-pink-500' : 'bg-white/10'
                          }`}
                          title={settings.profilePinEnabled ? 'Click to change or remove PIN' : 'Click to setup PIN'}
                        >
                          <span
                            className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                              settings.profilePinEnabled ? 'right-1' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 2: THEME / UI PREFERENCES */}
        <div id="theme-and-ui-preferences" className={`rounded-3xl transition-all duration-200 border backdrop-blur-xl shadow-lg overflow-hidden ${
          openSection === 'theme_ui' ? 'bg-slate-900/80 border-pink-500/30' : 'bg-slate-900/50 border-white/10 hover:border-white/20'
        }`}>
          <button
            type="button"
            onClick={() => toggleSection('theme_ui')}
            className="w-full p-5 sm:p-6 flex items-center justify-between text-left cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-2xl border transition ${
                openSection === 'theme_ui' ? 'bg-pink-500/20 text-pink-400 border-pink-500/40' : 'bg-white/5 text-slate-300 border-white/10'
              }`}>
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">Theme/Ui</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    Atmosphere & UI FX
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ambient particle overlay (snow, sakura, fireflies) and 3D pop-up card option
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs font-bold text-pink-400 hidden sm:inline">
                {openSection === 'theme_ui' ? 'Hide' : 'Configure'}
              </span>
              <div className={`p-2 rounded-xl bg-white/5 text-slate-300 transition-transform duration-300 ${
                openSection === 'theme_ui' ? 'rotate-180 bg-pink-500/20 text-pink-300' : ''
              }`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <AnimatePresence initial={false}>
            {openSection === 'theme_ui' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 pt-2 border-t border-white/10 space-y-4">
                  <div className="divide-y divide-white/5">
                    {/* Ambient Particle Overlay (Snow, Sakura, Fireflies) */}
                    <div className="py-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm">
                            <Snowflake className="w-4 h-4 animate-spin" style={{ animationDuration: '8s' }} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white flex items-center gap-2">
                              <span>Ambient Particle Atmosphere</span>
                              <span className="px-2 py-0.2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[9px] font-black uppercase">
                                Visual FX
                              </span>
                            </p>
                            <p className="text-xs text-slate-400">
                              Floating ambient snow, falling cherry blossoms, or glowing firefly sparks across the screen.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                              settings.ambientParticlesEnabled
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                : 'bg-white/5 text-slate-400 border-white/10'
                            }`}
                          >
                            {settings.ambientParticlesEnabled ? 'Enabled' : 'Disabled'}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = !settings.ambientParticlesEnabled;
                              onSaveSettings({ ...settings, ambientParticlesEnabled: nextVal });
                            }}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                              settings.ambientParticlesEnabled ? 'bg-cyan-500 shadow-md shadow-cyan-500/30' : 'bg-white/10'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                                settings.ambientParticlesEnabled ? 'right-1' : 'left-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Style Chooser when enabled */}
                      {settings.ambientParticlesEnabled && (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {[
                            {
                              id: 'snow' as const,
                              label: 'Snow Theme',
                              desc: 'Crystal flakes & winter snow',
                              icon: '❄️',
                              border: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200',
                            },
                            {
                              id: 'sakura' as const,
                              label: 'Sakura Petals',
                              desc: '3D drifting cherry blossoms',
                              icon: '🌸',
                              border: 'border-pink-500/50 bg-pink-500/10 text-pink-200',
                            },
                            {
                              id: 'fireflies' as const,
                              label: 'Fireflies',
                              desc: 'Pulsing bioluminescent sparks',
                              icon: '✨',
                              border: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
                            },
                          ].map(opt => {
                            const isSelected = (settings.ambientParticleStyle || 'sakura') === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  onSaveSettings({ ...settings, ambientParticleStyle: opt.id, ambientParticlesEnabled: true });
                                }}
                                className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                                  isSelected
                                    ? `${opt.border} ring-1 ring-white/30 shadow-md`
                                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-base">{opt.icon}</span>
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                <span className="text-xs font-bold leading-tight">{opt.label}</span>
                                <span className="text-[10px] text-slate-400 leading-none">{opt.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 3D Anime Card Pop-up Preview (Toggle) */}
                    <div className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-pink-400 border border-pink-500/30 shadow-sm">
                          <Sparkles className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white flex items-center gap-2">
                            <span>3D Pop-up Card Option</span>
                            <span className="px-2 py-0.2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[9px] font-black uppercase">
                              360° 3D
                            </span>
                          </p>
                          <p className="text-xs text-slate-400">
                            Show interactive 360° holographic 3D card modal when clicking anime posters before opening full details.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                            settings.enable3DCardPreview !== false
                              ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}
                        >
                          {settings.enable3DCardPreview !== false ? 'Enabled' : 'Disabled'}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = settings.enable3DCardPreview === false ? true : false;
                            onSaveSettings({ ...settings, enable3DCardPreview: nextVal });
                          }}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            settings.enable3DCardPreview !== false ? 'bg-pink-500 shadow-md shadow-pink-500/30' : 'bg-white/10'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                              settings.enable3DCardPreview !== false ? 'right-1' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* App Opening Cinematic Logo Intro (AniLove 4s Intro) */}
                    <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-pink-400 border border-pink-500/30 shadow-sm">
                          <Film className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white flex items-center gap-2">
                            <span>Cinematic Logo Intro</span>
                            <span className="px-2 py-0.2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[9px] font-black uppercase">
                              AniLove 7S
                            </span>
                          </p>
                          <p className="text-xs text-slate-400">
                            6–7s cinematic anime intro: glowing heart formation, anime sunset sky parallax scene, and AniLove logo reveal.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {onReplayIntro && (
                          <button
                            type="button"
                            onClick={onReplayIntro}
                            className="px-3 py-1 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 active:scale-95 text-pink-300 border border-pink-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Play the 6–7s anime opening animation now"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Preview</span>
                          </button>
                        )}

                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                            settings.appIntroAnimationEnabled !== false
                              ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}
                        >
                          {settings.appIntroAnimationEnabled !== false ? 'Enabled' : 'Disabled'}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = settings.appIntroAnimationEnabled === false ? true : false;
                            onSaveSettings({ ...settings, appIntroAnimationEnabled: nextVal });
                          }}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            settings.appIntroAnimationEnabled !== false ? 'bg-pink-500 shadow-md shadow-pink-500/30' : 'bg-white/10'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                              settings.appIntroAnimationEnabled !== false ? 'right-1' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 3: PLAYER & STREAMING PREFERENCES */}
        <div id="player-and-streaming-preferences" className={`rounded-3xl transition-all duration-200 border backdrop-blur-xl shadow-lg overflow-hidden ${
          openSection === 'player_preferences' ? 'bg-slate-900/80 border-pink-500/30' : 'bg-slate-900/50 border-white/10 hover:border-white/20'
        }`}>
          <button
            type="button"
            onClick={() => toggleSection('player_preferences')}
            className="w-full p-5 sm:p-6 flex items-center justify-between text-left cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-2xl border transition ${
                openSection === 'player_preferences' ? 'bg-pink-500/20 text-pink-400 border-pink-500/40' : 'bg-white/5 text-slate-300 border-white/10'
              }`}>
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">Player & Streaming Preferences</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    Playback & Audio
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audio language, 12 server priorities, auto-skip intro, and playback filters
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs font-bold text-pink-400 hidden sm:inline">
                {openSection === 'player_preferences' ? 'Hide' : 'Configure'}
              </span>
              <div className={`p-2 rounded-xl bg-white/5 text-slate-300 transition-transform duration-300 ${
                openSection === 'player_preferences' ? 'rotate-180 bg-pink-500/20 text-pink-300' : ''
              }`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <AnimatePresence initial={false}>
            {openSection === 'player_preferences' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 pt-2 border-t border-white/10 space-y-4">
                  <div className="divide-y divide-white/5">

                    {/* Audio Language (Default: English Dub) */}
                    <div className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/5 text-pink-300">
                          <Volume2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Default Audio Language</p>
                          <p className="text-xs text-slate-400">Preferred voiceover format (Default: English Voice Dub)</p>
                        </div>
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
                          onShowToast('success', `Default audio set to ${first.toUpperCase()}.`, 'Audio Updated');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/15 text-xs font-bold text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer max-w-[180px] sm:max-w-xs"
                      >
                        <option value="DUB">🇺🇸 English Dub (Default)</option>
                        <option value="SUB">🇯🇵 Japanese Subtitles</option>
                      </select>
                    </div>

                    {/* 12 Streaming Scrapers Top-3 Priority Setup */}
                    <div className="py-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-white/5 text-pink-300">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">Streaming Servers (Prioritize Top 3)</p>
                            <p className="text-xs text-slate-400">Scrapes from 12 live server engines with prioritized failover</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onSaveSettings({
                              ...settings,
                              preferredServers: ['tatakai-multi', 'anify-cloud', 'anikoto-hd1'],
                              defaultStreamServer: 'tatakai-multi',
                            });
                            onShowToast('success', 'Reset to Default (1. Tatakai Multi-Dub, 2. Anify Media Cloud, 3. Anikoto HD-1).', 'Defaults Restored');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-slate-300 transition cursor-pointer"
                        >
                          Reset Defaults
                        </button>
                      </div>

                      {/* 3 Priority Dropdowns */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {/* Priority 1 */}
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                            <span>#1 Primary Server</span>
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-[9px]">Priority 1</span>
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
                              onShowToast('success', `Priority 1 server set to ${newFirst}.`, 'Server Updated');
                            }}
                            className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            {STREAM_PROVIDERS.map(prov => (
                              <option key={`acc-p1-${prov.id}`} value={prov.id}>
                                {prov.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Priority 2 */}
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-indigo-500/30 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300">
                            <span>#2 Secondary Server</span>
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-[9px]">Priority 2</span>
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
                              onShowToast('success', `Priority 2 server set to ${newSecond}.`, 'Server Updated');
                            }}
                            className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                          >
                            {STREAM_PROVIDERS.map(prov => (
                              <option key={`acc-p2-${prov.id}`} value={prov.id}>
                                {prov.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Priority 3 */}
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300">
                            <span>#3 Tertiary Server</span>
                            <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-[9px]">Priority 3</span>
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
                              onShowToast('success', `Priority 3 server set to ${newThird}.`, 'Server Updated');
                            }}
                            className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                          >
                            {STREAM_PROVIDERS.map(prov => (
                              <option key={`acc-p3-${prov.id}`} value={prov.id}>
                                {prov.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Auto-Skip Opening Themes (Intro) */}
                    <div className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/5 text-pink-300">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Auto-Skip Opening Themes (Intro)</p>
                          <p className="text-xs text-slate-400">Automatically skip anime theme songs using smart chapter markers</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !settings.autoSkipIntro;
                          onSaveSettings({ ...settings, autoSkipIntro: nextVal });
                          onShowToast('info', `Intro auto-skip ${nextVal ? 'enabled' : 'disabled'}.`);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          settings.autoSkipIntro ? 'bg-pink-500' : 'bg-white/10'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                            settings.autoSkipIntro ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Auto-Play Next Episode */}
                    <div className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/5 text-pink-300">
                          <Radio className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Auto-Play Next Episode</p>
                          <p className="text-xs text-slate-400">Seamlessly continue next episode when current completes</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !settings.autoPlayNextEpisode;
                          onSaveSettings({ ...settings, autoPlayNextEpisode: nextVal });
                          onShowToast('info', `Auto-play ${nextVal ? 'enabled' : 'disabled'}.`);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          settings.autoPlayNextEpisode ? 'bg-pink-500' : 'bg-white/10'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                            settings.autoPlayNextEpisode ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Content Restrictions (ON/OFF Toggle, default OFF) */}
                    <div className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/5 text-pink-300">
                          {settings.contentRestrictions ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Content Restrictions</p>
                          <p className="text-xs text-slate-400">
                            {settings.contentRestrictions
                              ? 'Filtering active: Mature & 18+ content hidden'
                              : 'Restrictions OFF: Showing all anime including mature content'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                            settings.contentRestrictions
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}
                        >
                          {settings.contentRestrictions ? 'Active' : 'Off'}
                        </span>

                        <button
                          type="button"
                          onClick={handleToggleContentRestrictions}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            settings.contentRestrictions ? 'bg-pink-500' : 'bg-white/10'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                              settings.contentRestrictions ? 'right-1' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION: SAVED ANIME REELS */}
        <div className={`rounded-3xl transition-all duration-200 border backdrop-blur-xl shadow-lg overflow-hidden ${
          openSection === 'saved_reels' ? 'bg-slate-900/80 border-pink-500/30' : 'bg-slate-900/50 border-white/10 hover:border-white/20'
        }`}>
          <button
            type="button"
            onClick={() => toggleSection('saved_reels')}
            className="w-full p-5 sm:p-6 flex items-center justify-between text-left cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-2xl border transition ${
                openSection === 'saved_reels' ? 'bg-pink-500/20 text-pink-400 border-pink-500/40' : 'bg-white/5 text-slate-300 border-white/10'
              }`}>
                <Film className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">Saved Anime Reels</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    {savedReels.length} {savedReels.length === 1 ? 'Reel' : 'Reels'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your bookmarked anime edit reels. Tap to preview or launch in full player.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs font-bold text-pink-400 hidden sm:inline">
                {openSection === 'saved_reels' ? 'Hide' : 'View Saved'}
              </span>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                openSection === 'saved_reels' ? 'rotate-180 bg-pink-500/20 text-pink-300' : ''
              }`} />
            </div>
          </button>

          <AnimatePresence>
            {openSection === 'saved_reels' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-white/10 px-5 sm:px-6 py-6 space-y-6"
              >
                {/* Header & Quick Action bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
                  <div className="text-xs text-slate-400">
                    Manage and play your bookmarked anime edit reels.
                  </div>

                  <div className="flex items-center gap-2">
                    {onNavigateToReels && (
                      <button
                        onClick={() => onNavigateToReels()}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Open Reels Player</span>
                      </button>
                    )}

                    {savedReels.length > 0 && (
                      <button
                        onClick={handleClearAllSaved}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-xs font-bold border border-white/10 hover:border-rose-500/30 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear All</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Reels Grid / Empty State */}
                {savedReels.length === 0 ? (
                  <div className="text-center py-10 px-4 space-y-3 bg-black/20 rounded-2xl border border-white/5">
                    <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto border border-pink-500/20">
                      <Bookmark className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white">No Saved Reels Yet</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      While watching anime edit reels in the Reels tab, tap the Bookmark button or double-tap the video to save them to your account.
                    </p>
                    {onNavigateToReels && (
                      <button
                        onClick={() => onNavigateToReels()}
                        className="mt-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-pink-300 hover:text-white text-xs font-bold transition cursor-pointer"
                      >
                        Explore Reels Now
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {savedReels.map((reel, idx) => (
                      <div
                        key={reel.id}
                        onClick={() => setPreviewReel(reel)}
                        className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-950 border border-white/10 hover:border-pink-500/50 shadow-md cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                      >
                        {/* Video Snapshot / Placeholder */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />

                        <div className="absolute inset-0 flex items-center justify-center text-slate-700 group-hover:text-pink-400 transition">
                          <Film className="w-10 h-10 opacity-30 group-hover:opacity-60" />
                        </div>

                        {/* Top Badge: Index & Delete Button */}
                        <div className="absolute top-2 inset-x-2 z-20 flex items-center justify-between pointer-events-auto">
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-black/70 text-pink-300 border border-white/10 backdrop-blur-md">
                            #{idx + 1}
                          </span>

                          <button
                            onClick={(e) => handleRemoveSavedReel(reel.id, e)}
                            title="Remove from saved"
                            className="w-6 h-6 rounded-full bg-black/70 text-slate-400 hover:text-rose-400 border border-white/10 flex items-center justify-center transition active:scale-90"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Center Play Icon Hover Overlay */}
                        <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-pink-500/90 text-white flex items-center justify-center shadow-lg shadow-pink-500/40">
                            <Play className="w-5 h-5 ml-0.5 fill-current" />
                          </div>
                        </div>

                        {/* Bottom Metadata */}
                        <div className="absolute bottom-2 inset-x-2 z-20 space-y-0.5">
                          <p className="text-[11px] font-bold text-white line-clamp-1 drop-shadow">
                            {reel.cleanTitle}
                          </p>
                          <div className="flex items-center justify-between text-[9px] text-slate-400">
                            <span>{reel.size || 'HD Video'}</span>
                            <span className="text-pink-400 font-bold group-hover:underline">Play</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Video Preview Modal inside Account */}
                {previewReel && (
                  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
                    <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-3 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Film className="w-4 h-4 text-pink-400" />
                          <h4 className="text-xs font-bold text-white line-clamp-1">{previewReel.cleanTitle}</h4>
                        </div>
                        <button
                          onClick={() => setPreviewReel(null)}
                          className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer text-xs"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="relative aspect-[9/16] w-full rounded-2xl overflow-hidden bg-black border border-white/10">
                        <video
                          src={previewReel.url}
                          autoPlay
                          controls
                          playsInline
                          loop
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        {onNavigateToReels && (
                          <button
                            onClick={() => {
                              const targetId = previewReel.id;
                              setPreviewReel(null);
                              onNavigateToReels(targetId);
                            }}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold text-xs shadow-md shadow-pink-500/25 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Launch Full Reels View</span>
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            handleRemoveSavedReel(previewReel.id, e);
                            setPreviewReel(null);
                          }}
                          className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition cursor-pointer"
                        >
                          Unsave
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 3: DATA BACKUP & TRANSFER */}
        <div className={`rounded-3xl transition-all duration-200 border backdrop-blur-xl shadow-lg overflow-hidden ${
          openSection === 'data_backup' ? 'bg-slate-900/80 border-pink-500/30' : 'bg-slate-900/50 border-white/10 hover:border-white/20'
        }`}>
          <button
            type="button"
            onClick={() => toggleSection('data_backup')}
            className="w-full p-5 sm:p-6 flex items-center justify-between text-left cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-2xl border transition ${
                openSection === 'data_backup' ? 'bg-pink-500/20 text-pink-400 border-pink-500/40' : 'bg-white/5 text-slate-300 border-white/10'
              }`}>
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">Data Backup & Transfer</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-slate-400">
                    JSON Archive
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Export your complete library and settings or restore from offline JSON backup
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs font-bold text-pink-400 hidden sm:inline">
                {openSection === 'data_backup' ? 'Hide' : 'Export / Import'}
              </span>
              <div className={`p-2 rounded-xl bg-white/5 text-slate-300 transition-transform duration-300 ${
                openSection === 'data_backup' ? 'rotate-180 bg-pink-500/20 text-pink-300' : ''
              }`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <AnimatePresence initial={false}>
            {openSection === 'data_backup' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 pt-2 border-t border-white/10 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={onExportBackup}
                      className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20 transition">
                          <Download className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-pink-300 transition">Export Watchlist JSON</p>
                          <p className="text-xs text-slate-400">Download offline backup file</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-pink-400 transition" />
                    </button>

                    <label className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20 transition">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-violet-300 transition">Import Backup File</p>
                          <p className="text-xs text-slate-400">Restore library from JSON</p>
                        </div>
                      </div>
                      <input
                        type="file"
                        accept=".json"
                        onChange={onImportBackup}
                        className="hidden"
                      />
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition" />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 4: ANILIST TWO-WAY LIVE SYNC */}
        <div className={`rounded-3xl transition-all duration-200 border backdrop-blur-xl shadow-lg overflow-hidden ${
          openSection === 'anilist_sync' ? 'bg-slate-900/80 border-sky-500/30' : 'bg-slate-900/50 border-white/10 hover:border-white/20'
        }`}>
          <button
            type="button"
            onClick={() => toggleSection('anilist_sync')}
            className="w-full p-5 sm:p-6 flex items-center justify-between text-left cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-2xl border transition ${
                openSection === 'anilist_sync' ? 'bg-sky-500/20 text-sky-400 border-sky-500/40' : 'bg-white/5 text-slate-300 border-white/10'
              }`}>
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">AniList Two-Way Live Sync</h2>
                  {settings.twoWaySyncEnabled && settings.anilistToken ? (
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      2-Way Live Active
                    </span>
                  ) : settings.importUsername ? (
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                      1-Way Import
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-400">
                      Not Linked
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synchronize watch progress, ratings, and library updates bidirectionally with AniList
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs font-bold text-sky-400 hidden sm:inline">
                {openSection === 'anilist_sync' ? 'Hide' : 'Sync'}
              </span>
              <div className={`p-2 rounded-xl bg-white/5 text-slate-300 transition-transform duration-300 ${
                openSection === 'anilist_sync' ? 'rotate-180 bg-sky-500/20 text-sky-300' : ''
              }`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <AnimatePresence initial={false}>
            {openSection === 'anilist_sync' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 pt-2 border-t border-white/10 space-y-4">
                  {/* CONNECTED STATE: TWO-WAY LIVE SYNC OR USERNAME */}
                  {settings.importUsername || settings.anilistToken ? (
                    <div className="space-y-4">
                      {/* Account Card */}
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          {settings.anilistUser?.avatar?.large ? (
                            <img
                              src={settings.anilistUser.avatar.large}
                              alt={settings.importUsername || 'AniList User'}
                              className="w-12 h-12 rounded-2xl object-cover border-2 border-sky-500/40 shadow-md"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-black text-lg">
                              {(settings.importUsername || 'A').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-white">{settings.importUsername || settings.anilistUser?.name}</p>
                              <span className="text-[10px] font-bold text-sky-400 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                                AniList Account
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {settings.twoWaySyncEnabled && settings.anilistToken
                                ? 'Live 2-Way Sync Active: Actions on this site automatically push updates to AniList in real-time.'
                                : '1-Way Sync: Public watchlist imported. Link your AniList token to enable live bidirectional synchronization.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            disabled={isSyncingAniList}
                            onClick={() => {
                              if (settings.importUsername) handleSyncAniListUsername();
                              else if (settings.anilistToken) handleConnectAniListToken(settings.anilistToken);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-pink-500/20 active:scale-95 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAniList ? 'animate-spin' : ''}`} />
                            <span>{isSyncingAniList ? 'Syncing...' : 'Sync Now'}</span>
                          </button>
                          <button
                            onClick={handleDisconnectAniList}
                            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                          >
                            Unlink
                          </button>
                        </div>
                      </div>

                      {/* LIVE TWO-WAY SYNC PREFERENCES (If Token Connected) */}
                      {settings.twoWaySyncEnabled && settings.anilistToken ? (
                        <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-500/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" />
                              Two-Way Live Sync Automation
                            </span>
                            <span className="text-[11px] text-sky-300 font-semibold">Real-time mutation push</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            {/* Sync Watch Status */}
                            <div
                              onClick={() =>
                                onSaveSettings({
                                  ...settings,
                                  syncWatchStatus: !settings.syncWatchStatus,
                                })
                              }
                              className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                                settings.syncWatchStatus
                                  ? 'bg-sky-500/15 border-sky-500/40 text-white'
                                  : 'bg-white/5 border-white/10 text-slate-400'
                              }`}
                            >
                              <div>
                                <p className="text-xs font-bold">Watch Status</p>
                                <p className="text-[10px] text-slate-400">Watching, Completed, Dropped</p>
                              </div>
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${settings.syncWatchStatus ? 'bg-sky-500 border-sky-400' : 'border-slate-600'}`}>
                                {settings.syncWatchStatus && <Check className="w-2.5 h-2.5 text-white" />}
                              </span>
                            </div>

                            {/* Sync Episode Progress */}
                            <div
                              onClick={() =>
                                onSaveSettings({
                                  ...settings,
                                  syncEpisodeProgress: !settings.syncEpisodeProgress,
                                })
                              }
                              className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                                settings.syncEpisodeProgress
                                  ? 'bg-sky-500/15 border-sky-500/40 text-white'
                                  : 'bg-white/5 border-white/10 text-slate-400'
                              }`}
                            >
                              <div>
                                <p className="text-xs font-bold">Episode Progress</p>
                                <p className="text-[10px] text-slate-400">Updates live when watching</p>
                              </div>
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${settings.syncEpisodeProgress ? 'bg-sky-500 border-sky-400' : 'border-slate-600'}`}>
                                {settings.syncEpisodeProgress && <Check className="w-2.5 h-2.5 text-white" />}
                              </span>
                            </div>

                            {/* Sync Scores */}
                            <div
                              onClick={() =>
                                onSaveSettings({
                                  ...settings,
                                  syncScores: !settings.syncScores,
                                })
                              }
                              className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                                settings.syncScores
                                  ? 'bg-sky-500/15 border-sky-500/40 text-white'
                                  : 'bg-white/5 border-white/10 text-slate-400'
                              }`}
                            >
                              <div>
                                <p className="text-xs font-bold">Ratings & Scores</p>
                                <p className="text-[10px] text-slate-400">Syncs 1-10 scores to AniList</p>
                              </div>
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${settings.syncScores ? 'bg-sky-500 border-sky-400' : 'border-slate-600'}`}>
                                {settings.syncScores && <Check className="w-2.5 h-2.5 text-white" />}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Upgrade to 2-way live sync prompt */
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/40 to-violet-950/40 border border-sky-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                              Enable Live Two-Way Sync (Web ➔ AniList)
                            </p>
                            <p className="text-[11px] text-slate-300 mt-0.5">
                              Authorize or paste your AniList access token so changes made here automatically update your real AniList account in real-time.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowTokenInput(true)}
                            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-extrabold shadow-lg shadow-sky-500/25 transition cursor-pointer whitespace-nowrap active:scale-95"
                          >
                            Activate 2-Way Sync
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* NOT CONNECTED: SHOW AUTH OPTIONS */
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Option A: 1-Click Public Username Sync */}
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-black uppercase text-pink-400">Option 1</span>
                              <span className="text-xs font-bold text-white">Public Username Sync (1-Way)</span>
                            </div>
                            <p className="text-xs text-slate-400">
                              Quickly import your public watchlist without entering any passwords or tokens.
                            </p>
                          </div>

                          <form onSubmit={handleSyncAniListUsername} className="space-y-2 pt-2">
                            <input
                              type="text"
                              value={anilistUsernameInput}
                              onChange={e => setAnilistUsernameInput(e.target.value)}
                              placeholder="Enter AniList username..."
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                            />
                            <button
                              type="submit"
                              disabled={isSyncingAniList}
                              className="w-full py-2.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              {isSyncingAniList ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                              <span>Import Watchlist</span>
                            </button>
                          </form>
                        </div>

                        {/* Option B: Live 2-Way Sync Token Authorization */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-950/30 via-slate-900 to-slate-900 border border-sky-500/30 space-y-3 flex flex-col justify-between shadow-lg shadow-sky-500/5">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-black uppercase text-sky-400">Option 2 (Recommended)</span>
                              <span className="text-xs font-bold text-white">Live Two-Way Sync</span>
                            </div>
                            <p className="text-xs text-slate-300">
                              No server required! Uses direct browser GraphQL to instantly synchronize episode progress, ratings, and watch status to your AniList profile.
                            </p>
                          </div>

                          <div className="space-y-2 pt-2">
                            <a
                              href={getAniListAuthUrl()}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-extrabold shadow-lg shadow-sky-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              <span>1-Click Authorize with AniList</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => setShowTokenInput(!showTokenInput)}
                              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-bold transition text-center cursor-pointer"
                            >
                              {showTokenInput ? 'Hide Token Input' : 'Or Paste AniList Access Token'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Token Input Drawer */}
                      {showTokenInput && (
                        <div className="p-4 rounded-2xl bg-slate-950 border border-sky-500/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-sky-300">
                              Paste AniList OAuth Access Token
                            </label>
                            <a
                              href="https://anilist.co/settings/developer"
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                            >
                              Get token from AniList Developer Settings &rarr;
                            </a>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={anilistTokenInput}
                              onChange={e => setAnilistTokenInput(e.target.value)}
                              placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIs..."
                              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500"
                            />
                            <button
                              onClick={() => handleConnectAniListToken()}
                              disabled={isSyncingAniList}
                              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
                            >
                              {isSyncingAniList ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION 5: FIREBASE AUTOMATIC CROSS-DEVICE CLOUD SYNC */}
        <div className={`rounded-3xl transition-all duration-200 border backdrop-blur-xl shadow-lg overflow-hidden ${
          openSection === 'cloud_sync' ? 'bg-slate-900/80 border-violet-500/30' : 'bg-slate-900/50 border-white/10 hover:border-white/20'
        }`}>
          <button
            type="button"
            onClick={() => toggleSection('cloud_sync')}
            className="w-full p-5 sm:p-6 flex items-center justify-between text-left cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-2xl border transition ${
                openSection === 'cloud_sync' ? 'bg-violet-500/20 text-violet-400 border-violet-500/40' : 'bg-white/5 text-slate-300 border-white/10'
              }`}>
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">Firebase Cloud Synchronization</h2>
                  {currentUser ? (
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Sync Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Local Device Only
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Seamless multi-device cloud backup for watch history, library, and user data
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs font-bold text-violet-400 hidden sm:inline">
                {openSection === 'cloud_sync' ? 'Hide' : 'View'}
              </span>
              <div className={`p-2 rounded-xl bg-white/5 text-slate-300 transition-transform duration-300 ${
                openSection === 'cloud_sync' ? 'rotate-180 bg-violet-500/20 text-violet-300' : ''
              }`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          <AnimatePresence initial={false}>
            {openSection === 'cloud_sync' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 pt-2 border-t border-white/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {currentUser
                          ? 'Continuous background synchronization active across your phone, tablet, and PC. Every episode watched, library item added, or setting modified is saved to Firebase Cloud automatically with zero manual effort.'
                          : 'Sign in with your Google account to automatically sync your watch progress and library across all devices in real-time.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {!currentUser && (
                        <button
                          disabled={isAuthLoading}
                          onClick={handleGoogleSignIn}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white text-xs font-extrabold transition cursor-pointer shadow-md active:scale-95"
                        >
                          {isAuthLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Sign In with Google'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sync features overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center gap-2 text-pink-400">
                        <Radio className="w-4 h-4" />
                        <p className="text-xs font-bold text-white">Live Watch History & Resume</p>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Playback positions and episode completions are instantly mirrored to Firestore so you can pick up exactly where you left off on any screen.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center gap-2 text-violet-400">
                        <Database className="w-4 h-4" />
                        <p className="text-xs font-bold text-white">Watchlist & Ratings</p>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Anime additions, status classifications (Watching, Completed, Dropped), and scores automatically sync seamlessly.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center gap-2 text-sky-400">
                        <ShieldCheck className="w-4 h-4" />
                        <p className="text-xs font-bold text-white">Master Account Security</p>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Locked to your authenticated account ({email}) for cross-device authentication and identity preservation.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MODAL 1: EDIT PROFILE (Name, Gmail, Logo/Avatar) */}
      <AnimatePresence>
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl bg-slate-900 border border-white/15 p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Edit Profile Details</h3>
                    <p className="text-xs text-slate-400">Customize your display name, email, and avatar</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditProfileOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Avatar Selection with 6 Default Presets & Owned Character Cards */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Profile Avatar / Logo
                    </label>
                    <span className="text-[10px] font-bold text-pink-400">
                      6 Presets or Owned Cards Only
                    </span>
                  </div>

                  {/* Avatar Tabs */}
                  <div className="flex rounded-xl bg-slate-950 p-1 border border-white/10 mb-3">
                    <button
                      type="button"
                      onClick={() => setAvatarTab('presets')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        avatarTab === 'presets'
                          ? 'bg-pink-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Default Presets (6)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarTab('owned')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        avatarTab === 'owned'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Owned Cards ({vaultCards.length})</span>
                    </button>
                  </div>

                  {/* Tab 1: 6 Default Presets */}
                  {avatarTab === 'presets' && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                      {PRESET_AVATARS.map((av, idx) => {
                        const isSelected = editAvatar === av.url;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setEditAvatar(av.url)}
                            className={`group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-pink-500 ring-2 ring-pink-500/50 scale-105 shadow-lg shadow-pink-500/20'
                                : 'border-white/10 hover:border-white/30 opacity-75 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={av.url}
                              alt={av.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 text-center">
                              <span className="text-[9px] font-bold text-white truncate block">
                                {av.name}
                              </span>
                            </div>
                            {isSelected && (
                              <div className="absolute inset-0 bg-pink-500/25 flex items-center justify-center">
                                <Check className="w-5 h-5 text-white filter drop-shadow-md" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Tab 2: Owned Character Cards */}
                  {avatarTab === 'owned' && (
                    <div>
                      {vaultCards.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-slate-950/80 border border-white/10 text-center space-y-2">
                          <p className="text-xs font-bold text-slate-300">No Character Cards Owned Yet</p>
                          <p className="text-[11px] text-slate-500">
                            Play the Character Gacha or visit the Arcade Card Shop to summon character cards and unlock them as your profile picture!
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
                          {vaultCards.map(card => {
                            const cardImg = getSafeCharacterImage(card.characterName, card.characterImage);
                            const isSelected = editAvatar === cardImg || editAvatar === card.characterImage;
                            return (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => setEditAvatar(cardImg)}
                                className={`group relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all cursor-pointer text-left ${
                                  isSelected
                                    ? 'border-purple-500 ring-2 ring-purple-500/50 scale-105 shadow-lg shadow-purple-500/20'
                                    : 'border-white/10 hover:border-white/30 opacity-80 hover:opacity-100'
                                }`}
                              >
                                <img
                                  src={cardImg}
                                  alt={card.characterName}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-1.5">
                                  <p className="text-[10px] font-black text-white truncate">
                                    {card.characterName}
                                  </p>
                                  <p className="text-[8px] text-purple-300 font-bold truncate">
                                    {card.rarity}
                                  </p>
                                </div>
                                {isSelected && (
                                  <div className="absolute inset-0 bg-purple-500/25 flex items-center justify-center">
                                    <Check className="w-5 h-5 text-white filter drop-shadow-md" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Enter your name..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                {/* Email / Gmail (Locked to Firebase Master Account) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Master Account Email
                    </label>
                    <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Locked & Cloud-Verified
                    </span>
                  </div>
                  <div className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-sm text-slate-300 flex items-center justify-between">
                    <span className="font-mono">{email}</span>
                    <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Firebase Primary
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Account email is locked to your authenticated Google / Firebase identity for secure cross-device synchronization and cannot be altered.
                  </p>
                </div>

                {/* Save Button */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white text-xs font-extrabold shadow-lg shadow-pink-500/25 transition cursor-pointer active:scale-95"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: SWITCH PROFILE */}
      <AnimatePresence>
        {isSwitchProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Switch Profile</h3>
                    <p className="text-xs text-slate-400">Select an account profile or add a new one</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSwitchProfileOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Profiles List */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {profiles.map(prof => {
                  const isActive = prof.id === currentProfile.id;
                  return (
                    <div
                      key={prof.id}
                      onClick={() => handleSwitchProfile(prof)}
                      className={`p-3.5 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-pink-500/20 border-pink-500/50 shadow-md shadow-pink-500/10'
                          : 'bg-white/5 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={prof.avatar}
                          alt={prof.name}
                          className="w-10 h-10 rounded-full object-cover border border-white/20"
                        />
                        <div>
                          <p className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{prof.name}</span>
                            {isActive && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-500 text-white">
                                Active
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">{prof.email || 'Local User'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {profiles.length > 1 && !isActive && (
                          <button
                            onClick={e => handleDeleteProfile(prof.id, prof.name, e)}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {isActive && <Check className="w-5 h-5 text-pink-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add New Profile Button */}
              <div className="pt-2">
                <button
                  onClick={() => setIsNewProfileModalOpen(true)}
                  className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-pink-500 text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-pink-400" />
                  <span>Create New Profile</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: CREATE NEW PROFILE */}
      <AnimatePresence>
        {isNewProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white">Create New Profile</h3>
                <button
                  onClick={() => setIsNewProfileModalOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateNewProfile} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Pick Profile Avatar
                    </label>
                    <span className="text-[10px] font-bold text-pink-400">
                      6 Presets or Owned Cards
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                    {PRESET_AVATARS.slice(0, 6).map((av, idx) => (
                      <button
                        key={`preset-${idx}`}
                        type="button"
                        onClick={() => setNewProfileAvatar(av.url)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition cursor-pointer relative ${
                          newProfileAvatar === av.url ? 'border-pink-500 ring-2 ring-pink-500/50 scale-105' : 'border-white/10 opacity-70'
                        }`}
                      >
                        <img src={av.url} alt={av.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        {newProfileAvatar === av.url && (
                          <div className="absolute inset-0 bg-pink-500/25 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                    {vaultCards.map(card => {
                      const cardImg = getSafeCharacterImage(card.characterName, card.characterImage);
                      const isSelected = newProfileAvatar === cardImg;
                      return (
                        <button
                          key={`card-${card.id}`}
                          type="button"
                          onClick={() => setNewProfileAvatar(cardImg)}
                          className={`aspect-square rounded-xl overflow-hidden border-2 transition cursor-pointer relative ${
                            isSelected ? 'border-purple-500 ring-2 ring-purple-500/50 scale-105' : 'border-white/10 opacity-70'
                          }`}
                        >
                          <img
                            src={cardImg}
                            alt={card.characterName}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-purple-500/25 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newProfileName}
                    onChange={e => setNewProfileName(e.target.value)}
                    placeholder="e.g. Otaku Night Mode, Guest..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewProfileModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold cursor-pointer active:scale-95"
                  >
                    Create Profile
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: PROFILE PIN SETUP / REMOVE / RECOVERY */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                    {pinStep === 'recovery' ? <HelpCircle className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {pinStep === 'create'
                        ? 'Set Profile 4-Digit PIN'
                        : pinStep === 'recovery'
                        ? 'Reset PIN via Security Question'
                        : 'Verify & Remove PIN'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {pinStep === 'create'
                        ? 'Protect your library with a 4-digit code & backup question'
                        : pinStep === 'recovery'
                        ? 'Answer your backup question to clear profile lock'
                        : 'Enter your current PIN to turn off lock'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSavePin} className="space-y-4">
                {pinError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                    {pinError}
                  </div>
                )}

                {pinStep !== 'recovery' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        {pinStep === 'create' ? 'Enter 4-Digit PIN' : 'Current 4-Digit PIN'}
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        required
                        value={pinInput}
                        onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-center text-2xl tracking-widest text-pink-400 font-black focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    {pinStep === 'create' && (
                      <>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                            Confirm 4-Digit PIN
                          </label>
                          <input
                            type="password"
                            maxLength={4}
                            required
                            value={pinConfirmInput}
                            onChange={e => setPinConfirmInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="••••"
                            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-center text-2xl tracking-widest text-pink-400 font-black focus:outline-none focus:border-pink-500"
                          />
                        </div>

                        {/* Backup Security Question */}
                        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-pink-500/20 space-y-2 text-left">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-pink-400">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Backup Security Question</span>
                          </div>
                          <p className="text-xs text-white font-medium">
                            "what/who do you like most?"
                          </p>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Your Secret Answer
                            </label>
                            <input
                              type="text"
                              required
                              value={pinBackupAnswerInput}
                              onChange={e => setPinBackupAnswerInput(e.target.value)}
                              placeholder="e.g. Zoro, Luffy, Mom, Violet Evergarden..."
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                              Used to reset your PIN if you ever forget it.
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {pinStep === 'remove' && (
                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPinStep('recovery');
                            setPinError('');
                            setPinRecoveryAnswerInput('');
                          }}
                          className="text-xs font-semibold text-pink-400 hover:text-pink-300 transition underline cursor-pointer"
                        >
                          Forgot PIN? Reset with Security Question
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  /* RECOVERY VIEW */
                  <div className="space-y-3.5 text-left">
                    <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-amber-500/20 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Security Question</span>
                      </div>
                      <p className="text-sm font-semibold text-white">
                        "{settings.profilePinBackupQuestion || 'what/who do you like most?'}"
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Your Answer
                      </label>
                      <input
                        type="text"
                        required
                        value={pinRecoveryAnswerInput}
                        onChange={e => {
                          setPinRecoveryAnswerInput(e.target.value);
                          setPinError('');
                        }}
                        placeholder="Enter the answer you set..."
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (pinStep === 'recovery') {
                        setPinStep('remove');
                        setPinError('');
                      } else {
                        setIsPinModalOpen(false);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    {pinStep === 'recovery' ? 'Back' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-xl text-white text-xs font-bold cursor-pointer active:scale-95 shadow-lg ${
                      pinStep === 'recovery'
                        ? 'bg-gradient-to-r from-amber-500 to-pink-600 shadow-amber-500/25'
                        : 'bg-gradient-to-r from-pink-500 to-violet-600 shadow-pink-500/25'
                    }`}
                  >
                    {pinStep === 'create'
                      ? 'Activate PIN'
                      : pinStep === 'recovery'
                      ? 'Verify & Reset PIN'
                      : 'Confirm & Disable'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: SHARE WEBSITE WITH THUMBNAIL CARD PREVIEW */}
      <AnimatePresence>
        {isShareWebsiteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-5 shadow-2xl overflow-hidden relative"
            >
              {/* Background ambient glow */}
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-pink-400 border border-pink-500/30 shadow-sm">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Share AniLove</h3>
                    <p className="text-xs text-slate-400">Share website with rich thumbnail card preview</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsShareWebsiteModalOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Website Card Preview (Exact Social Share Thumbnail Card) */}
              <div className="relative z-10 rounded-2xl overflow-hidden border border-white/15 bg-slate-950/80 shadow-xl">
                <div className="relative h-44 sm:h-48 w-full bg-slate-900 overflow-hidden">
                  <img
                    src="/og-banner.jpg"
                    alt="AniLove Website Preview Banner"
                    className="w-full h-full object-cover object-center"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/assets/anime_sunset_city.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-black text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-pink-400" />
                    <span>AniLove Web App</span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="text-[11px] font-mono text-pink-400 font-semibold tracking-wide">
                      {typeof window !== 'undefined' ? window.location.host : 'anilove.app'}
                    </span>
                    <h4 className="text-sm font-black text-white leading-snug line-clamp-1 drop-shadow-md">
                      AniLove - Anime Tracker, Streaming & Edits
                    </h4>
                  </div>
                </div>
                <div className="p-3.5 space-y-1">
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    Discover trending anime, stream episodes, and watch HD anime edits on AniLove. Your ultimate anime companion.
                  </p>
                </div>
              </div>

              {/* URL Field with Quick Copy */}
              <div className="relative z-10 space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Website Share Link
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-slate-300 font-mono truncate select-all">
                    {typeof window !== 'undefined' ? window.location.origin : 'https://anilove.app'}
                  </div>
                  <button
                    onClick={handleCopyWebsiteLink}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 ${
                      copiedWebsiteLink
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                    }`}
                  >
                    {copiedWebsiteLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Social Share Buttons */}
              <div className="relative z-10 pt-1 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {/* WhatsApp */}
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent('Discover trending anime, stream episodes, and watch HD anime edits on AniLove: ' + (typeof window !== 'undefined' ? window.location.origin : ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 text-center"
                  >
                    <Send className="w-3.5 h-3.5 rotate-45" />
                    <span>WhatsApp</span>
                  </a>

                  {/* Telegram */}
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}&text=${encodeURIComponent('Discover trending anime and watch HD anime edits on AniLove!')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-[#0088cc]/15 hover:bg-[#0088cc]/25 border border-[#0088cc]/30 text-[#0088cc] text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 text-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Telegram</span>
                  </a>

                  {/* Twitter / X */}
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}&text=${encodeURIComponent('Discover trending anime, stream episodes, and watch HD anime edits on AniLove!')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 text-center"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>X / Twitter</span>
                  </a>
                </div>

                {/* System Native Share Button */}
                {typeof navigator !== 'undefined' && !!navigator.share && (
                  <button
                    onClick={async () => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : '';
                      try {
                        await navigator.share({
                          title: 'AniLove - Anime Tracker, Streaming & Edits',
                          text: 'Discover trending anime, stream episodes, and watch HD anime edits on AniLove!',
                          url: origin,
                        });
                      } catch {}
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white text-xs font-extrabold shadow-lg shadow-pink-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Open System Share Sheet</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
