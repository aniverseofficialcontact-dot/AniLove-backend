import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Tv,
  ListOrdered,
  BookOpen,
  Flame,
  Globe,
  RefreshCw,
  Copy,
  Check,
  Play,
  Info,
  ChevronRight,
  Volume2,
  VolumeX,
  Zap,
  Lock,
  MessageSquare,
} from 'lucide-react';
import { Anime } from '../types';
import {
  AiChatMessage,
  AiContext,
  SenseiMode,
  askAnimeSensei,
  getSeasonalHighlights,
  getWebsiteFeaturesGuide,
} from '../services/gemini';

interface AiAnimeSenseiModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAnime?: Anime | null;
  userLibrary: any[];
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
}

// 5 Starting Options with rich visual styling
const POPULAR_GENRES = [
  'Action',
  'Romance',
  'Fantasy',
  'Sci-Fi',
  'Comedy',
  'Psychological',
  'Isekai',
  'Slice of Life',
  'Thriller',
  'Shonen',
  'Supernatural',
  'Horror',
  'Sports',
  'Mystery',
  'Drama',
];

const FIVE_STARTING_OPTIONS = [
  {
    id: 'recommendations',
    title: '✨ Personalized Anime Recommendations',
    subtitle: 'Find anime similar to your favorites, genres, or custom vibes',
    icon: Tv,
    gradient: 'from-indigo-600/20 to-purple-600/20 hover:from-indigo-600/30 hover:to-purple-600/30',
    borderColor: 'border-indigo-500/30 hover:border-indigo-400',
    textColor: 'text-indigo-300',
    promptQuestion: `### 🔮 **Personalized Anime Recommendations**\n\nChoose any genre below, or type your favorite anime name/theme into the box:\n\n*(For example: tap **"Romance"**, **"Action"**, **"Fantasy"**, or type **"Solo Leveling"**, **"Attack on Titan"**, **"Dark thriller"**)*`,
    placeholder: 'Pick a genre above or type anime title / vibe (e.g. Romance, Solo Leveling)...',
  },
  {
    id: 'watch_order',
    title: '🧭 Franchise Watch Order Guide',
    subtitle: 'Get complete chronological & release order for multi-season franchises',
    icon: ListOrdered,
    gradient: 'from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/30 hover:to-blue-600/30',
    borderColor: 'border-cyan-500/30 hover:border-cyan-400',
    textColor: 'text-cyan-300',
    promptQuestion: `### 🧭 **Franchise Watch Order Guide**\n\nWhich anime franchise would you like the complete watch order for?\n\n*(For example: type **"Fate"**, **"Demon Slayer"**, **"Attack on Titan"**, **"Steins;Gate"**, **"Monogatari"**, or **"Dragon Ball"**)*\n\n**Type the franchise name below:**`,
    placeholder: 'Enter franchise name (e.g. Fate, Demon Slayer, Naruto)...',
  },
  {
    id: 'lore',
    title: '📜 Anime Lore & Deep Dossier',
    subtitle: 'Explore deep world-building, story synopsis, character factions & themes',
    icon: BookOpen,
    gradient: 'from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30',
    borderColor: 'border-emerald-500/30 hover:border-emerald-400',
    textColor: 'text-emerald-300',
    promptQuestion: `### 📜 **Anime Lore & World Dossier**\n\nWhich anime universe would you like to explore deep lore and world breakdown for?\n\n*(For example: type **"Hunter x Hunter"**, **"Vinland Saga"**, **"Neon Genesis Evangelion"**, **"Frieren"**, or **"Death Note"**)*\n\n**Type the anime title below:**`,
    placeholder: 'Enter anime title for lore breakdown (e.g. Vinland Saga, Frieren)...',
  },
  {
    id: 'seasonal',
    title: '🔥 Seasonal Highlights (Top 10)',
    subtitle: 'Discover the 10 most popular & trending anime right now',
    icon: Flame,
    gradient: 'from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30',
    borderColor: 'border-amber-500/30 hover:border-amber-400',
    textColor: 'text-amber-300',
    promptQuestion: '',
    placeholder: 'Ask any follow-up question or select another topic...',
  },
  {
    id: 'about',
    title: '🌐 About AniLove Platform & Features',
    subtitle: 'Free HD streaming, Arcade games, coins, 3D card gacha & companions',
    icon: Globe,
    gradient: 'from-pink-600/20 to-rose-600/20 hover:from-pink-600/30 hover:to-rose-600/30',
    borderColor: 'border-pink-500/30 hover:border-pink-400',
    textColor: 'text-pink-300',
    promptQuestion: '',
    placeholder: 'Ask any question about AniLove features or select a topic...',
  },
];

export const AiAnimeSenseiModal: React.FC<AiAnimeSenseiModalProps> = ({
  isOpen,
  onClose,
  currentAnime,
  userLibrary,
  onOpenDetails,
  onPlayStream,
}) => {
  // Current active mode: 'initial' locks input until user selects an option
  const [activeMode, setActiveMode] = useState<SenseiMode>('initial');

  // Initial 2 messages: Welcome greeting followed by "What do you want to know?" with the 5 options
  const [messages, setMessages] = useState<AiChatMessage[]>(() => [
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: `### Konnichiwa! ⛩️ I'm **AniAI Sensei**\nYour personalized anime intelligence advisor, lore archivist, and franchise guide.`,
      timestamp: Date.now() - 200,
    },
    {
      id: 'welcome-2',
      sender: 'assistant',
      text: `### What would you like to know?\nPlease select one of the 5 options below to get started:`,
      timestamp: Date.now() - 100,
      showOptionButtons: true,
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [placeholderText, setPlaceholderText] = useState('🔒 Please select an option above to begin...');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Set default locked placeholder on open if in initial state
  useEffect(() => {
    if (isOpen && activeMode === 'initial') {
      setPlaceholderText('🔒 Please select an option above to begin...');
    }
  }, [isOpen, activeMode]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // Speech synthesis cleanup
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isTyping) return;

    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    const context: AiContext = {
      currentAnime: currentAnime
        ? currentAnime.title?.english || currentAnime.title?.romaji
        : undefined,
      genres: currentAnime?.genres || ['Action', 'Fantasy'],
      libraryCount: userLibrary.length,
    };

    // Mode to send: if 'initial', fall back to 'general'
    const modeToSend: SenseiMode = activeMode === 'initial' ? 'general' : activeMode;

    try {
      const result = await askAnimeSensei(query, context, modeToSend);

      const assistantMsg: AiChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: result.reply,
        timestamp: Date.now(),
        suggestedAnime: result.suggestedAnime,
        isFallback: result.isFallback,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Error fetching AI response:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          text: 'Gomen! I encountered a brief network delay. Please try asking again in a moment.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  /**
   * Handles user tapping one of the 5 starting options
   */
  const handleSelectStartingOption = async (optionId: string) => {
    if (isTyping) return;

    if (optionId === 'recommendations') {
      setActiveMode('recommendations');
      const userMsg: AiChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: '✨ Personalized Anime Recommendations',
        timestamp: Date.now(),
      };

      const opt = FIVE_STARTING_OPTIONS.find((o) => o.id === 'recommendations')!;
      const assistantMsg: AiChatMessage = {
        id: `assistant-${Date.now() + 1}`,
        sender: 'assistant',
        text: opt.promptQuestion,
        timestamp: Date.now() + 1,
        showGenrePills: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setPlaceholderText(opt.placeholder);
      setTimeout(() => inputRef.current?.focus(), 150);
      return;
    }

    if (optionId === 'watch_order') {
      setActiveMode('watch_order');
      const userMsg: AiChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: '🧭 Franchise Watch Order Guide',
        timestamp: Date.now(),
      };

      const opt = FIVE_STARTING_OPTIONS.find((o) => o.id === 'watch_order')!;
      const assistantMsg: AiChatMessage = {
        id: `assistant-${Date.now() + 1}`,
        sender: 'assistant',
        text: opt.promptQuestion,
        timestamp: Date.now() + 1,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setPlaceholderText(opt.placeholder);
      setTimeout(() => inputRef.current?.focus(), 150);
      return;
    }

    if (optionId === 'lore') {
      setActiveMode('lore');
      const userMsg: AiChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: '📜 Anime Lore & Deep Dossier',
        timestamp: Date.now(),
      };

      const opt = FIVE_STARTING_OPTIONS.find((o) => o.id === 'lore')!;
      const assistantMsg: AiChatMessage = {
        id: `assistant-${Date.now() + 1}`,
        sender: 'assistant',
        text: opt.promptQuestion,
        timestamp: Date.now() + 1,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setPlaceholderText(opt.placeholder);
      setTimeout(() => inputRef.current?.focus(), 150);
      return;
    }

    if (optionId === 'seasonal') {
      setActiveMode('seasonal');
      const userMsg: AiChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: '🔥 Seasonal Highlights (Top 10 Trending)',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);
      setPlaceholderText('Ask any follow-up question or pick another topic above...');

      try {
        const result = await getSeasonalHighlights();
        const assistantMsg: AiChatMessage = {
          id: `assistant-${Date.now() + 1}`,
          sender: 'assistant',
          text: result.reply,
          timestamp: Date.now() + 1,
          suggestedAnime: result.suggestedAnime,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error('Error fetching seasonal highlights:', err);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    if (optionId === 'about') {
      setActiveMode('about');
      const userMsg: AiChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: '🌐 About AniLove Platform & Features',
        timestamp: Date.now(),
      };

      const assistantMsg: AiChatMessage = {
        id: `assistant-${Date.now() + 1}`,
        sender: 'assistant',
        text: getWebsiteFeaturesGuide(),
        timestamp: Date.now() + 1,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setPlaceholderText('Ask any question about AniLove features or pick a topic above...');
      return;
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleSpeak = (id: string, text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking && currentSpeakingId === id) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setCurrentSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown symbols for cleaner TTS
    const cleanText = text
      .replace(/[#*`_\[\]()~]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentSpeakingId(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentSpeakingId(null);
    };

    setCurrentSpeakingId(id);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleClearChat = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentSpeakingId(null);
    setActiveMode('initial');
    setInputQuery('');
    setPlaceholderText('🔒 Please select an option above to begin...');
    setMessages([
      {
        id: 'welcome-1-reset',
        sender: 'assistant',
        text: `### Konnichiwa! ⛩️ I'm **AniAI Sensei**\nYour personalized anime intelligence advisor, lore archivist, and franchise guide.`,
        timestamp: Date.now() - 200,
      },
      {
        id: 'welcome-2-reset',
        sender: 'assistant',
        text: `### What would you like to know?\nPlease select one of the 5 options below to get started:`,
        timestamp: Date.now() - 100,
        showOptionButtons: true,
      },
    ]);
  };

  if (!isOpen) return null;

  const isInputBlocked = activeMode === 'initial';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-3xl h-[92vh] max-h-[840px] bg-[#0c0e18] border border-indigo-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 relative"
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-white tracking-tight">AniAI Sensei</h2>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    Interactive Advisor
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Recommendations • Watch Orders • Lore • Seasonal Top 10
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClearChat}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs font-medium flex items-center gap-1 cursor-pointer"
                title="Reset conversation"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
              <button
                onClick={() => {
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                  onClose();
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Option Navigation Chips */}
          <div className="px-4 sm:px-6 py-2 bg-slate-950/70 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Topics:
            </span>
            {FIVE_STARTING_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = activeMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectStartingOption(opt.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 border ${
                    isSelected
                      ? `bg-indigo-600/30 ${opt.borderColor} text-white ring-1 ring-indigo-400/50 shadow-md`
                      : `bg-slate-900/90 ${opt.borderColor} ${opt.textColor} hover:bg-white/5 shadow-sm`
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{opt.title.split(' ')[1] || opt.title}</span>
                </button>
              );
            })}
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isThisSpeaking = isSpeaking && currentSpeakingId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 mt-1 shadow-md">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[90%] sm:max-w-[84%] rounded-2xl p-4 shadow-lg ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-[#131728] border border-slate-800/90 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {/* Message Body */}
                    <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line space-y-2 prose prose-invert max-w-none">
                      {msg.text}
                    </div>

                    {/* 5 Prominent Starting Option Cards */}
                    {msg.showOptionButtons && (
                      <div className="mt-3.5 space-y-2 border-t border-slate-700/60 pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {FIVE_STARTING_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const isSelected = activeMode === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => handleSelectStartingOption(opt.id)}
                                className={`p-3 rounded-2xl bg-gradient-to-r ${opt.gradient} border ${opt.borderColor} text-left transition-all group flex items-start gap-3 cursor-pointer shadow-md hover:scale-[1.01] ${
                                  isSelected ? 'ring-2 ring-indigo-400' : ''
                                }`}
                              >
                                <div
                                  className={`p-2 rounded-xl bg-slate-950/70 border ${opt.borderColor} ${opt.textColor} shrink-0 group-hover:scale-110 transition-transform shadow-inner`}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <h4
                                      className={`text-xs font-black ${opt.textColor} group-hover:text-white transition`}
                                    >
                                      {opt.title}
                                    </h4>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                    {opt.subtitle}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Interactive Popular Genre Chips */}
                    {msg.showGenrePills && (
                      <div className="mt-3.5 pt-3 border-t border-slate-700/60 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>Quick Select Anime Genre:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {POPULAR_GENRES.map((genre) => (
                            <button
                              key={genre}
                              onClick={() => handleSendMessage(genre)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-400 text-xs font-bold transition shadow-sm hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1"
                            >
                              <span>#{genre}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interactive Anime Cards Preview */}
                    {msg.suggestedAnime && msg.suggestedAnime.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                          <Play className="w-3 h-3 text-indigo-400" />
                          <span>Interactive Anime Cards ({msg.suggestedAnime.length}):</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {msg.suggestedAnime.map((anime) => {
                            const title =
                              anime.title?.english ||
                              anime.title?.romaji ||
                              anime.title?.userPreferred ||
                              'Anime';
                            const cover = anime.coverImage?.large || anime.coverImage?.medium;
                            const score = anime.averageScore || anime.meanScore;

                            return (
                              <div
                                key={anime.id}
                                className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 transition group shadow-md"
                              >
                                {cover && (
                                  <img
                                    src={cover}
                                    alt={title}
                                    className="w-12 h-16 rounded-xl object-cover border border-slate-700 shrink-0"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition">
                                    {title}
                                  </h4>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                    {score && (
                                      <span className="text-yellow-400 font-bold">★ {score}%</span>
                                    )}
                                    {anime.format && <span>• {anime.format}</span>}
                                    {anime.episodes && <span>• {anime.episodes} eps</span>}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <button
                                      onClick={() => {
                                        onClose();
                                        onPlayStream(anime);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
                                    >
                                      <Play className="w-2.5 h-2.5 fill-current" />
                                      <span>Watch</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        onClose();
                                        onOpenDetails(anime);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer border border-slate-700"
                                    >
                                      <Info className="w-2.5 h-2.5" />
                                      <span>Details</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bottom toolbar for Assistant message */}
                    {!isUser && (
                      <div className="mt-3 pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/50">
                        <span className="text-[10px] text-slate-500">AniAI Sensei</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleSpeak(msg.id, msg.text)}
                            className={`flex items-center gap-1 transition text-[11px] cursor-pointer ${
                              isThisSpeaking
                                ? 'text-amber-400 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Read response aloud"
                          >
                            {isThisSpeaking ? (
                              <>
                                <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>Listen</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition text-[11px] cursor-pointer"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-1 shadow-md">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 shadow-md">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-[#131728] border border-slate-800/90 text-slate-300 flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping [animation-delay:0.4s]" />
                  <span className="text-slate-400 font-medium ml-1">
                    Sensei is analyzing anime catalogs...
                  </span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Footer Input Bar */}
          <div className="p-3 sm:p-4 bg-slate-900/90 border-t border-slate-800/90">
            {isInputBlocked ? (
              <div className="flex items-center gap-3 bg-[#090b14]/90 border border-slate-800 rounded-2xl px-4 py-3 shadow-inner">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-300">
                    Please select one of the 5 options above to start
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Choose Recommendations, Watch Order, Lore, Seasonal Top 10, or About AniLove
                  </p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2 bg-[#090b14] border border-slate-700/80 focus-within:border-indigo-500 rounded-2xl px-3 py-2 shadow-inner transition"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder={placeholderText}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none px-1"
                  disabled={isTyping}
                  autoFocus
                />

                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isTyping}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-md shadow-indigo-600/30 transition cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-2 mt-2">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-indigo-400" />
                {activeMode === 'watch_order'
                  ? 'Mode: Franchise Watch Order — Enter any franchise name'
                  : activeMode === 'lore'
                  ? 'Mode: Anime Lore & Dossier — Enter any anime title'
                  : activeMode === 'recommendations'
                  ? 'Mode: Recommendations — Enter an anime name or theme'
                  : activeMode === 'seasonal'
                  ? 'Mode: Seasonal Highlights'
                  : activeMode === 'about'
                  ? 'Mode: About AniLove Features'
                  : 'Select an option above to begin'}
              </span>
              {!isInputBlocked && <span className="hidden sm:inline">Press Enter to Send</span>}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
