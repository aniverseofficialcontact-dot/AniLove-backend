import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Send,
  Search,
  Check,
  Film,
  Sparkles,
  Loader2,
  Tv,
  MessageCircle,
  User,
  Clock
} from 'lucide-react';
import { AnimeReel, Anime, ChatConversation, ChatUserProfile, UserSettings } from '../types';
import {
  subscribeToConversations,
  searchUsersByUsername,
  getOrCreateConversation,
  sendChatMessage
} from '../services/chatService';

interface ShareToDmModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: ChatUserProfile | null;
  reelToShare?: AnimeReel | null;
  animeToShare?: Anime | null;
  onOpenLoginOrUsername: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info' | 'sync', message: string, title?: string) => void;
}

export const ShareToDmModal: React.FC<ShareToDmModalProps> = ({
  isOpen,
  onClose,
  currentUserProfile,
  reelToShare,
  animeToShare,
  onOpenLoginOrUsername,
  onShowToast,
}) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [caption, setCaption] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});

  // Subscribe to user's recent conversations
  useEffect(() => {
    if (!currentUserProfile?.userId || !isOpen) return;
    const unsub = subscribeToConversations(currentUserProfile.userId, (list) => {
      setConversations(list);
    });
    return () => unsub();
  }, [currentUserProfile?.userId, isOpen]);

  // Debounced search for users by @username
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsersByUsername(searchQuery, currentUserProfile?.userId);
        setSearchResults(results);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUserProfile?.userId]);

  const handleSendToConversation = async (conv: ChatConversation) => {
    if (!currentUserProfile) return;
    const otherUid = conv.participants.find(uid => uid !== currentUserProfile.userId);
    if (!otherUid) return;

    setSendingId(conv.id);
    try {
      if (reelToShare) {
        await sendChatMessage(conv.id, currentUserProfile.userId, otherUid, {
          text: caption.trim() || undefined,
          type: 'reel',
          reelData: reelToShare,
        });
      } else if (animeToShare) {
        await sendChatMessage(conv.id, currentUserProfile.userId, otherUid, {
          text: caption.trim() || undefined,
          type: 'anime',
          animeData: animeToShare,
        });
      }

      setSentMap(prev => ({ ...prev, [conv.id]: true }));
      if (onShowToast) {
        onShowToast('success', 'Shared successfully in DM!', 'Sent');
      }
    } catch (err: any) {
      console.error('Failed to send DM:', err);
      if (onShowToast) {
        onShowToast('error', 'Could not deliver message. Please try again.');
      }
    } finally {
      setSendingId(null);
    }
  };

  const handleSendToSearchedUser = async (targetUser: ChatUserProfile) => {
    if (!currentUserProfile) return;

    setSendingId(targetUser.userId);
    try {
      const conv = await getOrCreateConversation(currentUserProfile, targetUser);
      if (reelToShare) {
        await sendChatMessage(conv.id, currentUserProfile.userId, targetUser.userId, {
          text: caption.trim() || undefined,
          type: 'reel',
          reelData: reelToShare,
        });
      } else if (animeToShare) {
        await sendChatMessage(conv.id, currentUserProfile.userId, targetUser.userId, {
          text: caption.trim() || undefined,
          type: 'anime',
          animeData: animeToShare,
        });
      }

      setSentMap(prev => ({ ...prev, [targetUser.userId]: true }));
      if (onShowToast) {
        onShowToast('success', `Sent to @${targetUser.username}!`, 'Delivered');
      }
    } catch (err) {
      console.error('Failed to send:', err);
      if (onShowToast) {
        onShowToast('error', 'Could not deliver message.');
      }
    } finally {
      setSendingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                <Send className="w-5 h-5 -rotate-12" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Direct Share</h3>
                <p className="text-[11px] text-slate-400">Share with anime fans in 1-on-1 DM</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* If user is not logged in / no chat profile */}
          {!currentUserProfile ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-xl shadow-pink-500/10">
                <MessageCircle className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Cross-Device Account Required</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                  Connect your Google account or authenticate with AniList 2-Way Sync to share reels and chat securely across all your devices.
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenLoginOrUsername();
                }}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 text-white text-xs font-black shadow-lg shadow-pink-500/25 hover:brightness-110 transition cursor-pointer"
              >
                Connect Google or AniList 2-Way Sync
              </button>
            </div>
          ) : (
            <>
              {/* Item Preview Card */}
              <div className="my-3 p-2.5 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center gap-3">
                {reelToShare && (
                  <>
                    <div className="w-12 h-14 rounded-xl bg-black/40 overflow-hidden relative shrink-0 border border-white/10">
                      {reelToShare.thumbnailUrl ? (
                        <img
                          src={reelToShare.thumbnailUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-pink-400">
                          <Film className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-pink-400 uppercase tracking-wider">
                        <Film className="w-3 h-3" /> Anime Reel
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">
                        {reelToShare.cleanTitle}
                      </h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-500" /> Disappears in 5 days
                      </p>
                    </div>
                  </>
                )}

                {animeToShare && (
                  <>
                    <div className="w-11 h-14 rounded-xl bg-black/40 overflow-hidden shrink-0 border border-white/10">
                      <img
                        src={animeToShare.coverImage.large || animeToShare.coverImage.medium}
                        alt="Poster"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                        <Tv className="w-3 h-3" /> Anime Card
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">
                        {animeToShare.title.english || animeToShare.title.romaji}
                      </h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-500" /> Disappears in 5 days
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Message Caption Input */}
              <div className="mb-3">
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a message or reaction..."
                  maxLength={160}
                  className="w-full bg-slate-950 border border-white/15 rounded-2xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition"
                />
              </div>

              {/* Search User Input */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user by @username..."
                  className="w-full bg-slate-950 border border-white/15 rounded-2xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition"
                />
                {isSearching && (
                  <Loader2 className="w-3.5 h-3.5 text-pink-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}
              </div>

              {/* Contacts / Recent List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[140px] max-h-[260px]">
                {/* Search Results Mode */}
                {searchQuery.trim().length >= 2 ? (
                  searchResults.length === 0 && !isSearching ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No users found for "@{searchQuery}".
                    </div>
                  ) : (
                    searchResults.map((user) => {
                      const isSent = sentMap[user.userId];
                      const isSending = sendingId === user.userId;
                      return (
                        <div
                          key={user.userId}
                          className="flex items-center justify-between p-2 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-white/15">
                              {user.avatar ? (
                                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  <User className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-white truncate">{user.displayName}</h5>
                              <p className="text-[11px] text-pink-400 truncate">@{user.username}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSendToSearchedUser(user)}
                            disabled={isSent || isSending}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                              isSent
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-pink-500 hover:bg-pink-400 text-white shadow-md shadow-pink-500/20 active:scale-95'
                            }`}
                          >
                            {isSending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isSent ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Sent</span>
                              </>
                            ) : (
                              <span>Send</span>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )
                ) : (
                  /* Recent Conversations Mode */
                  conversations.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No recent chats yet. Type a username above to start sending!
                    </div>
                  ) : (
                    conversations.map((conv) => {
                      const otherUid = conv.participants.find(uid => uid !== currentUserProfile.userId);
                      const otherProfile = otherUid ? conv.participantProfiles?.[otherUid] : null;
                      const isSent = sentMap[conv.id];
                      const isSending = sendingId === conv.id;

                      if (!otherProfile) return null;

                      return (
                        <div
                          key={conv.id}
                          className="flex items-center justify-between p-2 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-white/15">
                              {otherProfile.avatar ? (
                                <img src={otherProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  <User className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-white truncate">{otherProfile.displayName}</h5>
                              <p className="text-[11px] text-pink-400 truncate">@{otherProfile.username}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSendToConversation(conv)}
                            disabled={isSent || isSending}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                              isSent
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-pink-500 hover:bg-pink-400 text-white shadow-md shadow-pink-500/20 active:scale-95'
                            }`}
                          >
                            {isSending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isSent ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Sent</span>
                              </>
                            ) : (
                              <span>Send</span>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
