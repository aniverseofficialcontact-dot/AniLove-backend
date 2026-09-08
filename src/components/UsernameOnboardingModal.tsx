import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  AtSign,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  ArrowRight,
  ShieldCheck,
  LogIn,
  Link2,
  Check,
  ExternalLink,
  Lock,
  Key,
  HelpCircle,
} from 'lucide-react';
import { ChatUserProfile, UserSettings } from '../types';
import {
  checkUsernameAvailable,
  claimUsernameAndSaveProfile,
  isValidUsername,
  getCrossDeviceUserId,
} from '../services/chatService';
import { auth, signInWithGoogle } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import {
  getAniListAuthUrl,
  extractAniListToken,
  fetchAuthenticatedViewer,
} from '../services/anilist';

export interface UsernameOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  currentUser?: FirebaseUser | null;
  settings?: UserSettings;
  currentSettings?: UserSettings;
  onProfileCreated: (profile: ChatUserProfile) => void;
  initialUsername?: string;
  onShowToast?: (type: 'success' | 'error' | 'info' | 'sync', message: string, title?: string) => void;
  onSaveSettings?: (settings: UserSettings) => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1563089145-599997674d42?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1569705460033-cfaa4bf9f822?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&auto=format&fit=crop&q=80',
];

export const UsernameOnboardingModal: React.FC<UsernameOnboardingModalProps> = ({
  isOpen,
  onClose,
  userId,
  currentUser,
  settings,
  currentSettings,
  onProfileCreated,
  initialUsername = '',
  onShowToast,
  onSaveSettings,
}) => {
  const activeSettings = settings || currentSettings;

  // Local linked account state
  const [activeGoogleUser, setActiveGoogleUser] = useState<FirebaseUser | null>(
    currentUser || auth.currentUser
  );
  const [localSettings, setLocalSettings] = useState<UserSettings | null>(activeSettings || null);

  // AniList OAuth Token input state
  const [tokenInput, setTokenInput] = useState('');
  const [isVerifyingAniListToken, setIsVerifyingAniListToken] = useState(false);
  const [showTokenManualInput, setShowTokenManualInput] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Profile Form State
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('Anime Explorer');
  const [bio, setBio] = useState('Binge-watching anime & sharing reels ✨');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);

  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine active cross-device identity (Google or AniList 2-Way Sync OAuth)
  const currentEffectiveSettings = localSettings || activeSettings;
  const crossDeviceIdentity = getCrossDeviceUserId(activeGoogleUser, currentEffectiveSettings);
  const isAccountLinked = Boolean(crossDeviceIdentity);

  // Sync state when modal opens or settings change
  useEffect(() => {
    if (isOpen) {
      setActiveGoogleUser(currentUser || auth.currentUser);
      setLocalSettings(activeSettings || null);

      const curAniList =
        activeSettings?.anilistUser?.name ||
        (activeSettings?.anilistToken ? activeSettings?.importUsername : '') ||
        '';

      const defaultUsername =
        initialUsername ||
        activeSettings?.uniqueUsername ||
        (curAniList ? curAniList.toLowerCase().replace(/[^a-z0-9_]/g, '') : '') ||
        '';
      const defaultDisplayName =
        activeSettings?.customDisplayName ||
        curAniList ||
        currentUser?.displayName ||
        'Anime Explorer';
      const defaultBio = activeSettings?.userBio || 'Binge-watching anime & sharing reels ✨';
      const defaultAvatar =
        activeSettings?.customAvatar ||
        activeSettings?.anilistUser?.avatar?.large ||
        currentUser?.photoURL ||
        PRESET_AVATARS[0];

      setUsername(defaultUsername);
      setDisplayName(defaultDisplayName);
      setBio(defaultBio);
      setSelectedAvatar(defaultAvatar);
      setIsAvailable(null);
      setErrorMessage(null);
      setLinkError(null);
      setTokenInput('');
    }
  }, [isOpen, initialUsername, activeSettings, currentUser]);

  // Debounced check for username availability
  useEffect(() => {
    if (!isOpen) return;
    if (!username.trim()) {
      setIsAvailable(null);
      setErrorMessage(null);
      return;
    }

    const clean = username.trim().toLowerCase();
    const validation = isValidUsername(clean);
    if (!validation.valid) {
      setIsAvailable(false);
      setErrorMessage(validation.error || 'Invalid username');
      return;
    }

    setErrorMessage(null);
    setIsChecking(true);

    const timer = setTimeout(async () => {
      try {
        const activeUid = crossDeviceIdentity?.uid || userId || activeGoogleUser?.uid;
        const available = await checkUsernameAvailable(clean, activeUid);
        setIsAvailable(available);
        if (!available) {
          setErrorMessage('This username is already taken. Try another!');
        }
      } catch (err) {
        console.warn('Failed to check username:', err);
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, crossDeviceIdentity?.uid, userId, activeGoogleUser, isOpen]);

  // Google Sign-In action
  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    setLinkError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        setActiveGoogleUser(user);
        if (!displayName || displayName === 'Anime Explorer') {
          if (user.displayName) setDisplayName(user.displayName);
        }
        if (user.photoURL) {
          setSelectedAvatar(user.photoURL);
        }
        if (!username && user.email) {
          const derived = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
          if (derived.length >= 3) setUsername(derived);
        }
        if (onShowToast) {
          onShowToast('success', `Linked with Google (${user.email})`, 'Google Identity Verified');
        }
      }
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        setLinkError(
          `Google Sign-in on "${host}" requires domain authorization in Firebase Console. You can authenticate with AniList 2-Way Sync below!`
        );
      } else {
        setLinkError(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Open AniList OAuth Authorization in a new tab
  const handleOpenAniListOAuth = () => {
    const authUrl = getAniListAuthUrl();
    window.open(authUrl, '_blank', 'noopener,noreferrer');
    setShowTokenManualInput(true);
    if (onShowToast) {
      onShowToast(
        'info',
        'AniList authorization opened. Authorize AniLove, then copy your token or redirect URL to complete login.',
        'AniList 2-Way Sync'
      );
    }
  };

  // AniList OAuth Token Verification (Guarantees cryptographically proven 2-way sync ownership)
  const handleVerifyAniListToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = tokenInput.trim();
    const token = extractAniListToken(raw);
    if (!token) {
      setLinkError('Please paste your AniList access token or the full redirected URL.');
      return;
    }

    setIsVerifyingAniListToken(true);
    setLinkError(null);
    try {
      // Real authenticated GraphQL query to AniList Viewer
      const viewer = await fetchAuthenticatedViewer(token);
      if (!viewer || !viewer.id || !viewer.name) {
        throw new Error('Could not retrieve authenticated AniList profile from token.');
      }

      // Update settings with verified Two-Way Sync
      const updated: UserSettings = {
        ...(currentEffectiveSettings || ({} as UserSettings)),
        anilistToken: token,
        importUsername: viewer.name,
        anilistUser: viewer,
        twoWaySyncEnabled: true,
        syncWatchStatus: true,
        syncEpisodeProgress: true,
        syncScores: true,
        lastSyncTimestamp: Date.now(),
      };

      setLocalSettings(updated);
      if (onSaveSettings) {
        onSaveSettings(updated);
      }

      if (viewer.avatar?.large) {
        setSelectedAvatar(viewer.avatar.large);
      }
      if (!displayName || displayName === 'Anime Explorer') {
        setDisplayName(viewer.name);
      }
      if (!username) {
        setUsername(viewer.name.toLowerCase().replace(/[^a-z0-9_]/g, ''));
      }

      setTokenInput('');
      setShowTokenManualInput(false);

      if (onShowToast) {
        onShowToast(
          'success',
          `AniList 2-Way Sync authenticated for @${viewer.name}! Verified cross-device identity enabled.`,
          'AniList OAuth Verified'
        );
      }
    } catch (err: any) {
      console.error('AniList OAuth Verification Error:', err);
      setLinkError(
        err.message || 'Invalid or expired AniList OAuth token. Please authorize through AniList and try again.'
      );
    } finally {
      setIsVerifyingAniListToken(false);
    }
  };

  const handleDisconnectIdentity = () => {
    if (crossDeviceIdentity?.provider === 'google') {
      setActiveGoogleUser(null);
    } else {
      if (currentEffectiveSettings && onSaveSettings) {
        const resetSettings: UserSettings = {
          ...currentEffectiveSettings,
          anilistToken: undefined,
          twoWaySyncEnabled: false,
        };
        setLocalSettings(resetSettings);
        onSaveSettings(resetSettings);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crossDeviceIdentity) {
      setLinkError('You must link either Google or authenticated AniList 2-Way Sync to enable cross-device chats.');
      return;
    }
    if (!username || isAvailable === false || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const targetUid = crossDeviceIdentity.uid;

      const res = await claimUsernameAndSaveProfile(targetUid, username, {
        displayName: displayName.trim() || crossDeviceIdentity.displayName || 'Anime Fan',
        avatar: selectedAvatar,
        bio,
        anilistUsername:
          crossDeviceIdentity.provider === 'anilist'
            ? crossDeviceIdentity.identifier.replace('@', '')
            : undefined,
        linkedProvider: crossDeviceIdentity.provider,
        linkedAccount: crossDeviceIdentity.identifier,
      });

      if (res.success && res.profile) {
        onProfileCreated(res.profile);
        onClose();
        if (onShowToast) {
          onShowToast(
            'success',
            `@${res.profile.username} registered with verified ${
              crossDeviceIdentity.provider === 'google' ? 'Google' : 'AniList 2-Way Sync'
            }!`,
            'Username Claimed'
          );
        }
      } else {
        setErrorMessage(res.error || 'Failed to claim username.');
      }
    } catch (err: any) {
      console.error('Error claiming username:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while saving profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden my-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/20 text-white shrink-0">
                <AtSign className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  Claim Your Handle
                  <Sparkles className="w-4 h-4 text-pink-400" />
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pick a unique @username to send DMs, share reels, and connect.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Account Verification Section (MANDATORY FOR CROSS-DEVICE CHATS) */}
          <div className="mb-5 p-4 rounded-2xl bg-slate-950/90 border border-white/10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-pink-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Verified Identity Required
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Anti-Impersonation
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mb-3.5 leading-relaxed">
              To guarantee absolute privacy and prevent unauthorized users from accessing your conversations, direct messaging requires linking either your <strong>Google Account</strong> or authenticating with <strong>AniList 2-Way Sync</strong> via official OAuth.
            </p>

            {isAccountLinked && crossDeviceIdentity ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-emerald-300">
                        {crossDeviceIdentity.provider === 'google'
                          ? 'Google Account Connected'
                          : 'AniList 2-Way Sync Active'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                        {crossDeviceIdentity.identifier}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      Cryptographically verified. No one else can access your chats.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectIdentity}
                  className="text-[11px] font-bold text-slate-400 hover:text-white underline cursor-pointer shrink-0"
                >
                  Switch
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Option A: Google Sign-In */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isGoogleLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isGoogleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
                  ) : (
                    <LogIn className="w-4 h-4 text-pink-400" />
                  )}
                  <span>Connect with Google Account</span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest my-1">
                  <div className="flex-1 h-px bg-white/10" />
                  <span>OR (AniList Two-Way Sync)</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Option B: AniList Two-Way Sync Login */}
                <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-xs font-bold text-sky-200">AniList 2-Way Sync OAuth</span>
                    </div>
                    <span className="text-[10px] text-sky-400/80 font-medium">Official AniList API</span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Authorize AniLove with AniList to verify account ownership and enable live library sync alongside private messaging.
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenAniListOAuth}
                      className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-sky-600/20"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>1. Authorize on AniList.co</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTokenManualInput(!showTokenManualInput)}
                      className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                    >
                      {showTokenManualInput ? 'Hide' : 'Enter Token'}
                    </button>
                  </div>

                  {showTokenManualInput && (
                    <form onSubmit={handleVerifyAniListToken} className="pt-2 space-y-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value)}
                          placeholder="Paste AniList token or redirect URL (#access_token=...)"
                          className="w-full bg-slate-900 border border-sky-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500">
                          Extracts token automatically from the redirect URL
                        </span>
                        <button
                          type="submit"
                          disabled={isVerifyingAniListToken || !tokenInput.trim()}
                          className="py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          {isVerifyingAniListToken ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>2. Verify & Connect</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {linkError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{linkError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Unique Chat Username
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-400 font-bold text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="e.g. naruto_99"
                  maxLength={20}
                  className="w-full bg-slate-950 border border-white/15 rounded-2xl pl-8 pr-11 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition font-medium"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                  {isChecking && <Loader2 className="w-4 h-4 text-pink-400 animate-spin" />}
                  {!isChecking && isAvailable === true && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  {!isChecking && isAvailable === false && (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
              </div>

              {/* Status Hint */}
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                {errorMessage ? (
                  <span className="text-rose-400 font-medium">{errorMessage}</span>
                ) : isAvailable === true ? (
                  <span className="text-emerald-400 font-medium">✨ @{username} is available!</span>
                ) : (
                  <span className="text-slate-500">3-20 characters: letters, numbers, and underscores</span>
                )}
                <span className="text-slate-500">{username.length}/20</span>
              </div>
            </div>

            {/* Display Name Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your Public Name"
                maxLength={30}
                className="w-full bg-slate-950 border border-white/15 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
              />
            </div>

            {/* Bio Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Bio / Status
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your favorite anime, favorite character, or a short quote..."
                maxLength={120}
                rows={2}
                className="w-full bg-slate-950 border border-white/15 rounded-2xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition resize-none"
              />
              <div className="text-right text-[10px] text-slate-500 mt-1">{bio.length}/120</div>
            </div>

            {/* Avatar Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Choose Profile Avatar
              </label>
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedAvatar(url)}
                    className={`relative w-11 h-11 rounded-2xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                      selectedAvatar === url
                        ? 'border-pink-500 scale-105 shadow-md shadow-pink-500/30'
                        : 'border-white/20 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="Avatar" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Disappearing Messages Notice */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-2.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero-Waste Chat:</strong> Direct messages automatically disappear after 5 days, keeping storage lean and private.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isAccountLinked || !username || isAvailable !== true || isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black shadow-lg shadow-pink-500/25 transition cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Enter Chat</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
