import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Search,
  MessageCircle,
  Film,
  Tv,
  Clock,
  Sparkles,
  ArrowLeft,
  Plus,
  User,
  Check,
  CheckCheck,
  ShieldCheck,
  Play,
  Share2,
  Smile,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import {
  ChatConversation,
  ChatMessage,
  ChatUserProfile,
  UserSettings,
  AnimeReel,
  Anime
} from '../types';
import {
  subscribeToConversations,
  subscribeToMessages,
  sendChatMessage,
  markConversationAsRead,
  searchUsersByUsername,
  getOrCreateConversation
} from '../services/chatService';

interface MessagesViewProps {
  currentUserProfile: ChatUserProfile | null;
  settings: UserSettings;
  onOpenOnboarding: () => void;
  onNavigateToReel: (reelId: string) => void;
  onOpenAnimeDetail: (animeId: number) => void;
  onShowToast?: (type: 'success' | 'error' | 'info' | 'sync', message: string, title?: string) => void;
  initialChatId?: string | null;
  initialTargetUser?: ChatUserProfile | null;
}

const QUICK_REACTIONS = ['🔥', '💖', '🍿', '⚡', '✨', '😭', '🌸', '🤯'];

export const MessagesView: React.FC<MessagesViewProps> = ({
  currentUserProfile,
  settings,
  onOpenOnboarding,
  onNavigateToReel,
  onOpenAnimeDetail,
  onShowToast,
  initialChatId = null,
  initialTargetUser = null,
}) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId);
  const [activeRecipient, setActiveRecipient] = useState<ChatUserProfile | null>(initialTargetUser);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // User search modal / drawer for new chat
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<ChatUserProfile[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Mobile navigation between conversation list and active chat view
  const [showMobileChat, setShowMobileChat] = useState<boolean>(Boolean(initialChatId));

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Subscribe to conversations
  useEffect(() => {
    if (!currentUserProfile?.userId) return;

    const unsub = subscribeToConversations(currentUserProfile.userId, (list) => {
      setConversations(list);

      // Auto-select first chat on large screens if none selected
      if (!activeChatId && list.length > 0 && window.innerWidth >= 1024) {
        const first = list[0];
        setActiveChatId(first.id);
        const otherUid = first.participants.find(u => u !== currentUserProfile.userId);
        if (otherUid && first.participantProfiles?.[otherUid]) {
          const p = first.participantProfiles[otherUid];
          setActiveRecipient({
            userId: otherUid,
            username: p.username,
            displayName: p.displayName,
            avatar: p.avatar,
            createdAt: Date.now()
          });
        }
      }
    });

    return () => unsub();
  }, [currentUserProfile?.userId]);

  // Subscribe to messages of active chat
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }

    const unsub = subscribeToMessages(activeChatId, (msgs) => {
      setMessages(msgs);
      setTimeout(scrollToBottom, 60);
    });

    if (currentUserProfile?.userId) {
      markConversationAsRead(activeChatId, currentUserProfile.userId);
    }

    return () => unsub();
  }, [activeChatId, currentUserProfile?.userId]);

  // User search for new chat
  useEffect(() => {
    if (!userSearchQuery.trim() || userSearchQuery.trim().length < 2) {
      setUserSearchResults([]);
      return;
    }

    setIsSearchingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsersByUsername(userSearchQuery, currentUserProfile?.userId);
        setUserSearchResults(results);
      } catch (err) {
        console.error('Error searching users:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [userSearchQuery, currentUserProfile?.userId]);

  // Start chat with user
  const handleStartChatWithUser = async (targetUser: ChatUserProfile) => {
    if (!currentUserProfile) return;
    try {
      const conv = await getOrCreateConversation(currentUserProfile, targetUser);
      setActiveChatId(conv.id);
      setActiveRecipient(targetUser);
      setIsNewChatOpen(false);
      setUserSearchQuery('');
      setShowMobileChat(true);
    } catch (err) {
      console.error('Failed to initiate chat:', err);
      if (onShowToast) onShowToast('error', 'Could not open conversation.');
    }
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !activeChatId || !currentUserProfile || !activeRecipient || isSending) return;

    const text = messageInput.trim();
    setMessageInput('');
    setIsSending(true);

    try {
      await sendChatMessage(activeChatId, currentUserProfile.userId, activeRecipient.userId, {
        text,
        type: 'text',
      });
      setTimeout(scrollToBottom, 60);
    } catch (err) {
      console.error('Error sending message:', err);
      if (onShowToast) onShowToast('error', 'Failed to deliver message.');
      setMessageInput(text); // restore
    } finally {
      setIsSending(false);
    }
  };

  // Helper to calculate days remaining until disappearance
  const formatDaysRemaining = (expiresAt: number) => {
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return 'Expiring soon';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d left`;
    return `${hours}h left`;
  };

  // If user has not created a profile / claimed handle
  if (!currentUserProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto bg-slate-900/80 border border-white/15 rounded-3xl p-8 shadow-2xl backdrop-blur-xl"
        >
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-pink-500/25 mb-5">
            <MessageCircle className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">AniLove Direct Messages</h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Chat 1-on-1 with anime fans worldwide, share your favorite anime edit reels, and discuss episodes without clutter.
          </p>

          <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-bold text-white">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>Cross-Device Identity (Required)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Link with either <strong>Google</strong> or <strong>AniList 2-Way Sync</strong> so your messages and handle are securely verified and persist on any device.
            </p>

            <div className="flex items-center gap-2 font-bold text-white pt-1.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>5-Day Auto-Disappearing Messages</span>
            </div>
            <p className="text-[11px] text-slate-400">Zero-waste storage keeps your inbox light, private, and fast.</p>

            <div className="flex items-center gap-2 font-bold text-white pt-1.5">
              <Film className="w-4 h-4 text-violet-400" />
              <span>Direct Reel & Anime Sharing</span>
            </div>
            <p className="text-[11px] text-slate-400">Share reels and anime directly into DM threads with instant playback.</p>
          </div>

          <button
            onClick={onOpenOnboarding}
            className="mt-6 w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 text-white text-xs font-black shadow-lg shadow-pink-500/25 transition cursor-pointer"
          >
            Connect Account & Claim Username
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex-1 flex overflow-hidden rounded-3xl bg-slate-900/90 border border-white/15 shadow-2xl backdrop-blur-2xl">
        {/* =========================================================================
            LEFT COLUMN: Conversations List & Search
           ========================================================================= */}
        <aside
          className={`w-full lg:w-80 xl:w-96 flex flex-col border-r border-white/10 shrink-0 ${
            showMobileChat ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Top Bar: User Profile Preview & New Chat Button */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3 bg-slate-950/40">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-800 border-2 border-pink-500 shrink-0">
                {currentUserProfile.avatar ? (
                  <img src={currentUserProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-pink-400">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black text-white truncate">{currentUserProfile.displayName}</h3>
                <p className="text-[11px] font-bold text-pink-400 truncate">@{currentUserProfile.username}</p>
              </div>
            </div>

            <button
              onClick={() => setIsNewChatOpen(true)}
              className="p-2 rounded-2xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 border border-pink-500/30 transition cursor-pointer"
              title="Start New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Search bar inside conversation drawer */}
          <div className="p-3 border-b border-white/10 bg-slate-950/20">
            <button
              onClick={() => setIsNewChatOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-400 transition cursor-pointer text-left"
            >
              <Search className="w-4 h-4 text-slate-500" />
              <span>Search user by @handle...</span>
            </button>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {conversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-white/5 flex items-center justify-center text-slate-400">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-white">No Conversations Yet</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Start a DM by tapping the (+) button and typing a user's @username!
                </p>
                <button
                  onClick={() => setIsNewChatOpen(true)}
                  className="px-4 py-2 rounded-xl bg-pink-500 text-white text-xs font-bold shadow-md shadow-pink-500/20 hover:bg-pink-400 transition cursor-pointer"
                >
                  Find Users
                </button>
              </div>
            ) : (
              conversations.map((conv) => {
                const otherUid = conv.participants.find(u => u !== currentUserProfile.userId);
                const other = otherUid ? conv.participantProfiles?.[otherUid] : null;
                const isActive = activeChatId === conv.id;
                const unread = (otherUid && conv.unreadCounts?.[currentUserProfile.userId]) || 0;

                if (!other) return null;

                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setActiveChatId(conv.id);
                      setActiveRecipient({
                        userId: other.userId || otherUid || '',
                        username: other.username,
                        displayName: other.displayName,
                        avatar: other.avatar,
                        createdAt: Date.now(),
                      });
                      setShowMobileChat(true);
                    }}
                    className={`w-full p-3.5 flex items-center gap-3 text-left transition cursor-pointer ${
                      isActive
                        ? 'bg-pink-500/15 border-l-4 border-pink-500'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-2xl overflow-hidden bg-slate-800 border border-white/10">
                        {other.avatar ? (
                          <img src={other.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <User className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-pink-500 text-white text-[9px] font-black shadow-md">
                          {unread}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-white truncate">{other.displayName}</h4>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {conv.updatedAt ? new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-pink-400 truncate">@{other.username}</p>
                      <p className={`text-[11px] truncate mt-0.5 ${unread > 0 ? 'text-white font-bold' : 'text-slate-400'}`}>
                        {conv.lastMessage?.text || 'Started conversation'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* =========================================================================
            RIGHT / MAIN COLUMN: Chat Conversation View
           ========================================================================= */}
        <main
          className={`flex-1 flex flex-col bg-slate-950/60 min-w-0 ${
            !showMobileChat ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {activeRecipient && activeChatId ? (
            <>
              {/* Active Chat Header */}
              <header className="p-3.5 border-b border-white/10 flex items-center justify-between gap-3 bg-slate-950/80 backdrop-blur-md">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back button on mobile */}
                  <button
                    onClick={() => setShowMobileChat(false)}
                    className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-800 border border-white/15 shrink-0">
                    {activeRecipient.avatar ? (
                      <img src={activeRecipient.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <User className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-white truncate flex items-center gap-1.5">
                      {activeRecipient.displayName}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-pink-400">@{activeRecipient.username}</span>
                      {activeRecipient.bio && (
                        <span className="hidden sm:inline text-[11px] text-slate-400 truncate max-w-xs">
                          • {activeRecipient.bio}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5-Day Policy Badge */}
                <div
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-slate-400"
                  title="Messages automatically expire after 5 days."
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>5-Day Disappearing</span>
                </div>
              </header>

              {/* Disappearing Notice Banner */}
              <div className="px-4 py-1.5 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-transparent border-b border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>Direct Messages are temporary and disappear 5 days after sending.</span>
                </span>
                <span className="hidden md:inline text-pink-400 font-bold">Zero-Storage Mode</span>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                {messages.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-white/5 flex items-center justify-center text-pink-400">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-white">
                      Say hello to @{activeRecipient.username}!
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Send a friendly message or share an anime reel to start the chat.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === currentUserProfile.userId;
                    const daysLeft = formatDaysRemaining(msg.expiresAt);

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-md rounded-2xl p-3 sm:p-3.5 shadow-md ${
                            isMe
                              ? 'bg-gradient-to-tr from-pink-600 to-violet-600 text-white rounded-br-none'
                              : 'bg-slate-800/90 text-slate-200 border border-white/10 rounded-bl-none'
                          }`}
                        >
                          {/* 1. Reel Attachment Card */}
                          {msg.type === 'reel' && msg.reelData && (
                            <div className="mb-2.5 rounded-2xl bg-black/40 border border-white/15 overflow-hidden shadow-inner">
                              <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                                {msg.reelData.thumbnailUrl ? (
                                  <img
                                    src={msg.reelData.thumbnailUrl}
                                    alt="Thumbnail"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-pink-400 bg-slate-900">
                                    <Film className="w-8 h-8" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center">
                                  <button
                                    onClick={() => onNavigateToReel(msg.reelData!.id)}
                                    className="w-12 h-12 rounded-full bg-pink-500 hover:bg-pink-400 text-white flex items-center justify-center shadow-lg shadow-pink-500/40 hover:scale-110 active:scale-95 transition cursor-pointer"
                                    title="Watch Reel"
                                  >
                                    <Play className="w-6 h-6 fill-current translate-x-0.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="p-2.5 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-pink-300 flex items-center gap-1">
                                    <Film className="w-3 h-3" /> Anime Reel
                                  </span>
                                  <h5 className="text-xs font-bold text-white truncate">
                                    {msg.reelData.cleanTitle}
                                  </h5>
                                </div>
                                <button
                                  onClick={() => onNavigateToReel(msg.reelData!.id)}
                                  className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-[11px] font-bold text-white transition shrink-0 cursor-pointer"
                                >
                                  Watch
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 2. Anime Attachment Card */}
                          {msg.type === 'anime' && msg.animeData && (
                            <div className="mb-2.5 rounded-2xl bg-black/40 border border-white/15 overflow-hidden flex items-center gap-3 p-2">
                              <div className="w-12 h-16 rounded-xl overflow-hidden bg-slate-950 shrink-0">
                                {msg.animeData.coverImage && (
                                  <img
                                    src={msg.animeData.coverImage}
                                    alt="Poster"
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-wider text-violet-300 flex items-center gap-1">
                                  <Tv className="w-3 h-3" /> Anime Card
                                </span>
                                <h5 className="text-xs font-bold text-white truncate">
                                  {msg.animeData.title}
                                </h5>
                                <div className="flex items-center gap-2 text-[10px] text-slate-300 mt-0.5">
                                  {msg.animeData.format && <span>{msg.animeData.format}</span>}
                                  {msg.animeData.score ? <span>★ {msg.animeData.score}%</span> : null}
                                </div>
                              </div>
                              <button
                                onClick={() => onOpenAnimeDetail(msg.animeData!.id)}
                                className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-[11px] font-bold text-white transition shrink-0 cursor-pointer"
                              >
                                View
                              </button>
                            </div>
                          )}

                          {/* Text Body */}
                          {msg.text && (
                            <p className="text-xs leading-relaxed break-words whitespace-pre-wrap">
                              {msg.text}
                            </p>
                          )}

                          {/* Footer Timestamp & Disappearing Timer */}
                          <div
                            className={`mt-1.5 flex items-center justify-end gap-1.5 text-[10px] ${
                              isMe ? 'text-pink-200/80' : 'text-slate-400'
                            }`}
                          >
                            <Clock className="w-3 h-3 opacity-70" />
                            <span>{daysLeft}</span>
                            <span>•</span>
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && <CheckCheck className="w-3.5 h-3.5 opacity-80 ml-0.5" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Composer Bar */}
              <footer className="p-3 sm:p-4 border-t border-white/10 bg-slate-950/90 backdrop-blur-md">
                {/* Quick Reaction Emojis */}
                <div className="flex items-center gap-1.5 pb-2 overflow-x-auto">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setMessageInput(prev => prev + emoji)}
                      className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/15 text-sm transition cursor-pointer shrink-0"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={`Message @${activeRecipient.username}...`}
                    maxLength={500}
                    className="flex-1 bg-slate-900 border border-white/15 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                  />

                  <button
                    type="submit"
                    disabled={!messageInput.trim() || isSending}
                    className="p-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-pink-500/25 transition cursor-pointer"
                    title="Send Message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-pink-400">
                <MessageCircle className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white">Your Direct Messages</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Select a chat from the sidebar or tap (+) to find any anime fan by their @username.
              </p>
              <button
                onClick={() => setIsNewChatOpen(true)}
                className="px-5 py-2.5 rounded-2xl bg-pink-500 hover:bg-pink-400 text-white text-xs font-bold shadow-lg shadow-pink-500/25 transition cursor-pointer"
              >
                Start New Chat
              </button>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          NEW CHAT MODAL: Search users by @username
         ========================================================================= */}
      <AnimatePresence>
        {isNewChatOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">New Direct Message</h3>
                    <p className="text-[11px] text-slate-400">Search users by @handle</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNewChatOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>

              {/* Search Field */}
              <div className="relative my-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Type username (e.g. naruto)..."
                  className="w-full bg-slate-950 border border-white/15 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition"
                  autoFocus
                />
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-[160px] max-h-[300px]">
                {userSearchQuery.trim().length < 2 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Type at least 2 characters to search...
                  </div>
                ) : userSearchResults.length === 0 && !isSearchingUsers ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No users found matching "@{userSearchQuery}".
                  </div>
                ) : (
                  userSearchResults.map((user) => (
                    <button
                      key={user.userId}
                      onClick={() => handleStartChatWithUser(user)}
                      className="w-full p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-between gap-3 text-left transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-800 shrink-0 border border-white/15">
                          {user.avatar ? (
                            <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <User className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{user.displayName}</h4>
                          <p className="text-[11px] text-pink-400 truncate">@{user.username}</p>
                          {user.bio && <p className="text-[10px] text-slate-400 truncate">{user.bio}</p>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
