import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  BookOpen,
  Tv,
  Crown,
  Heart,
  Star,
  Check,
  Flame,
  ExternalLink,
  ShieldAlert,
  Coins,
  Sparkle,
  Rotate3d,
  RefreshCw,
  Eye,
  EyeOff,
  User,
  Share2,
  Info,
  Layers,
  ChevronLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { GachaCard, Anime } from '../types';
import { soundEffects } from '../services/soundEffects';
import {
  getSafeCharacterImage,
  getFallbackAvatarSvg,
  fetchDetailedCharacterInfo,
  DetailedCharacterData,
} from '../services/characterPool';
import {
  getCardAwakeningLevel,
  upgradeCardAwakeningLevel,
  getStoredArcadeCoins,
  spendArcadeCoins,
} from '../services/storage';

interface CharacterCardModalProps {
  card: GachaCard;
  onClose: () => void;
  onOpenAnimeDetails?: (anime: Anime) => void;
}

export interface CharacterTierConfig {
  level: number;
  id: 'holo' | 'rare' | 'master' | 'secret';
  tierName: string;
  badge: string;
  stars: string;
  cost: number;
  glowClass: string;
  borderClass: string;
  borderGradient: string;
  badgeBg: string;
  textColor: string;
  bgGradient: string;
  accentColor: string;
}

// 4 Distinct Tiers Inspired directly by the 4 Anime Card Colors (Cyan, Purple, Gold, Pink)
export const CHARACTER_TIERS: CharacterTierConfig[] = [
  {
    level: 1,
    id: 'holo',
    tierName: 'Cyan Holo Finish',
    badge: '★ Holo Tier',
    stars: '★',
    cost: 0,
    glowClass: 'shadow-[0_0_30px_rgba(56,189,248,0.35)] ring-1 ring-cyan-400/50',
    borderClass: 'border-cyan-400/60',
    borderGradient: 'from-cyan-400 via-blue-500 to-indigo-600',
    badgeBg: 'bg-gradient-to-r from-slate-900 via-cyan-900 to-slate-900 text-cyan-200 border border-cyan-400/40 shadow-sm',
    textColor: 'text-cyan-300',
    bgGradient: 'from-[#081321] via-[#090d16] to-[#060a12]',
    accentColor: '#38bdf8',
  },
  {
    level: 2,
    id: 'rare',
    tierName: 'Amethyst Rare Finish',
    badge: '★★ Rare Tier',
    stars: '★★',
    cost: 1, // 1 Arcade Coin
    glowClass: 'shadow-[0_0_35px_rgba(168,85,247,0.45)] ring-1 ring-purple-400/60',
    borderClass: 'border-purple-400/70',
    borderGradient: 'from-purple-500 via-indigo-400 to-pink-500',
    badgeBg: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30 border border-purple-400/40',
    textColor: 'text-purple-300',
    bgGradient: 'from-[#130924] via-[#0c0b1a] to-[#090b14]',
    accentColor: '#c084fc',
  },
  {
    level: 3,
    id: 'master',
    tierName: 'Radiant Master Gold',
    badge: '★★★ Master Tier',
    stars: '★★★',
    cost: 3, // 3 Arcade Coins
    glowClass: 'shadow-[0_0_40px_rgba(245,158,11,0.55)] ring-2 ring-amber-400/70',
    borderClass: 'border-amber-400/80',
    borderGradient: 'from-amber-400 via-yellow-300 to-orange-500',
    badgeBg: 'bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/40 border border-amber-300',
    textColor: 'text-amber-300',
    bgGradient: 'from-[#1e1405] via-[#100d08] to-[#0c0d14]',
    accentColor: '#fbbf24',
  },
  {
    level: 4,
    id: 'secret',
    tierName: 'Cosmic Secret Aurora',
    badge: '★★★★ Secret Tier',
    stars: '★★★★',
    cost: 5, // 5 Arcade Coins
    glowClass: 'shadow-[0_0_45px_rgba(244,114,182,0.65)] ring-2 ring-pink-400/80',
    borderClass: 'border-pink-400/90',
    borderGradient: 'from-pink-500 via-rose-500 to-purple-600',
    badgeBg: 'bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white shadow-lg shadow-pink-500/50 border border-pink-400',
    textColor: 'text-pink-300',
    bgGradient: 'from-[#1c0826] via-[#0e0a1f] to-[#080d1e]',
    accentColor: '#f472b6',
  },
];

/**
 * Authentic Lorebook Markdown Renderer with Spoiler Revealer
 */
const LorebookMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const [revealedSpoilers, setRevealedSpoilers] = useState<{ [key: number]: boolean }>({});

  if (!content || !content.trim()) {
    return (
      <div className="p-6 rounded-2xl bg-slate-950/60 border border-white/10 text-center space-y-2">
        <BookOpen className="w-8 h-8 text-purple-400 mx-auto opacity-50" />
        <p className="text-xs text-slate-400">
          No biography recorded on the database for this character yet.
        </p>
      </div>
    );
  }

  // Pre-process linebreaks and HTML breaks
  const normalized = content
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

  // Split into paragraphs / blocks
  const paragraphs = normalized.split(/\n\n+/);

  return (
    <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed select-text">
      {paragraphs.map((para, pIdx) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Check if entire paragraph is a spoiler block: ~! ... !~
        const spoilerMatch = trimmed.match(/^~!\s*([\s\S]*?)\s*!~$/);
        if (spoilerMatch) {
          const spoilerContent = spoilerMatch[1];
          const isRevealed = !!revealedSpoilers[pIdx];

          return (
            <div
              key={pIdx}
              className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3.5 space-y-2 transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Story Spoiler Section</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setRevealedSpoilers((prev) => ({ ...prev, [pIdx]: !prev[pIdx] }))
                  }
                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[10px] font-bold text-amber-200 transition cursor-pointer flex items-center gap-1"
                >
                  {isRevealed ? (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Hide Spoiler</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Reveal Spoiler</span>
                    </>
                  )}
                </button>
              </div>

              {isRevealed ? (
                <div className="pt-1.5 border-t border-amber-500/20 text-slate-200 whitespace-pre-line leading-relaxed">
                  {renderFormattedInline(spoilerContent)}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  This lore section contains plot details. Tap "Reveal Spoiler" to read.
                </p>
              )}
            </div>
          );
        }

        // Check if paragraph is a section header (e.g. __Background:__, **History:**, etc.)
        const isHeader =
          /^(__|\*\*)[^_\*]+(__|\*\*):?$/.test(trimmed) ||
          (/^[A-Z][A-Za-z\s]+:$/.test(trimmed) && trimmed.length < 40);

        if (isHeader) {
          const cleanHeader = trimmed.replace(/__|\*\*/g, '').replace(/:$/, '');
          return (
            <div
              key={pIdx}
              className="pt-2 border-b border-purple-500/20 pb-1 flex items-center gap-2 text-xs font-black text-purple-300 uppercase tracking-wider"
            >
              <Sparkle className="w-3 h-3 text-purple-400" />
              <span>{cleanHeader}</span>
            </div>
          );
        }

        // Standard Paragraph
        return (
          <p key={pIdx} className="whitespace-pre-line leading-relaxed text-slate-300">
            {renderFormattedInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

function renderFormattedInline(text: string): React.ReactNode {
  const parts = text.split(/(~![\s\S]*?!~)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('~!') && part.endsWith('!~')) {
      const inner = part.slice(2, -2).trim();
      return (
        <span
          key={idx}
          className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-200 text-[11px]"
        >
          ⚠️ {inner}
        </span>
      );
    }

    const cleanLines = part.split('\n');
    return cleanLines.map((line, lineIdx) => {
      const isListItem =
        line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.trim().startsWith('* ');
      if (isListItem) {
        const itemText = line.trim().replace(/^[-•*]\s*/, '');
        return (
          <span key={`${idx}-${lineIdx}`} className="flex items-start gap-2 my-1">
            <span className="text-purple-400 mt-0.5">•</span>
            <span>{itemText}</span>
          </span>
        );
      }

      return (
        <React.Fragment key={`${idx}-${lineIdx}`}>
          {lineIdx > 0 && <br />}
          {line}
        </React.Fragment>
      );
    });
  });
}

export const CharacterCardModal: React.FC<CharacterCardModalProps> = ({
  card,
  onClose,
  onOpenAnimeDetails,
}) => {
  // Modal Mode: '3D_CARD' or 'DETAILS_SHEET'
  const [showDetailsSheet, setShowDetailsSheet] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'LORE' | 'ANIME' | 'AWAKEN'>('LORE');

  // Exact AniList Character ID extracted from card
  const extractedCharId = useMemo(() => {
    if (card.characterId && typeof card.characterId === 'number') {
      return card.characterId;
    }
    if (card.id && card.id.startsWith('char-')) {
      const parts = card.id.split('-');
      if (parts.length >= 2) {
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    return undefined;
  }, [card]);

  // AniList Character Live Data
  const [detailedData, setDetailedData] = useState<DetailedCharacterData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(true);

  // Awakening State
  const [awakeningLevel, setAwakeningLevel] = useState<number>(() => getCardAwakeningLevel(card.id));
  const [coins, setCoins] = useState<number>(() => getStoredArcadeCoins());
  const [isAwakening, setIsAwakening] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // 3D 360° Globe Rotation state (matches InteractiveAnime3DCardModal)
  const [rotateX, setRotateX] = useState<number>(0);
  const [rotateY, setRotateY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStartRot, setDragStartRot] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [autoSpin, setAutoSpin] = useState<boolean>(false);
  const [sheenPos, setSheenPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-Spin 360° Animation Frame Loop
  useEffect(() => {
    if (!autoSpin || isDragging || showDetailsSheet) return;
    let animId: number;
    const spinLoop = () => {
      setRotateY((prev) => (prev + 0.6) % 360);
      animId = requestAnimationFrame(spinLoop);
    };
    animId = requestAnimationFrame(spinLoop);
    return () => cancelAnimationFrame(animId);
  }, [autoSpin, isDragging, showDetailsSheet]);

  // Fetch real-time character bio & anime media on mount directly from AniList with exact character matching
  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
      setIsLoadingDetails(true);
      try {
        const data = await fetchDetailedCharacterInfo(
          card.characterName,
          extractedCharId,
          card.animeId,
          card.animeTitle
        );
        if (isMounted) {
          setDetailedData(data);
        }
      } catch (err) {
        console.warn('Could not fetch character data:', err);
      } finally {
        if (isMounted) {
          setIsLoadingDetails(false);
        }
      }
    };

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [card.characterName, extractedCharId, card.animeId, card.animeTitle]);

  // Clean description for Back of Card
  const cleanDescription = useMemo(() => {
    const raw = detailedData?.description || card.characterRole || 'Legendary anime character collectible card.';
    return raw
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/~![\s\S]*?!~/g, '[Spoiler Lore concealed - Tap Details to view]')
      .trim();
  }, [detailedData?.description, card.characterRole]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDetailsSheet) {
          setShowDetailsSheet(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showDetailsSheet]);

  // 3D 360° Globe Drag Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    setAutoSpin(false);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragStartRot({ x: rotateX, y: rotateY });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartPos.x;
    const deltaY = e.clientY - dragStartPos.y;

    const nextRotY = dragStartRot.y + deltaX * 0.85;
    const nextRotX = dragStartRot.x - deltaY * 0.85;

    setRotateX(nextRotX);
    setRotateY(nextRotY);

    const normX = ((((nextRotY % 360) + 360) % 360) / 360) * 100;
    const normY = ((((nextRotX % 360) + 360) % 360) / 360) * 100;
    setSheenPos({ x: normX, y: normY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
  };

  const handleResetRotation = () => {
    soundEffects.playClick();
    setAutoSpin(false);
    setRotateX(0);
    setRotateY(0);
    setSheenPos({ x: 50, y: 50 });
  };

  const handleFlipCard = () => {
    soundEffects.playClick();
    setAutoSpin(false);
    setRotateX(0);
    setRotateY((prev) => Math.round(prev / 180) * 180 + 180);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.6 },
      colors: ['#38bdf8', '#c084fc', '#fbbf24', '#f472b6'],
    });
  };

  const toggleAutoSpin = () => {
    soundEffects.playClick();
    setAutoSpin((prev) => !prev);
  };

  const handleShare = () => {
    soundEffects.playClick();
    const url = window.location.origin;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${url} - Check out character card "${card.characterName}" on AniLove!`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Upgrade Card Awakening Foil (1 / 3 / 5 coins)
  const handleAwakenCard = (targetTier: CharacterTierConfig) => {
    if (coins < targetTier.cost || awakeningLevel >= targetTier.level) return;

    soundEffects.playGachaRoll();
    setIsAwakening(true);

    setTimeout(() => {
      const success = spendArcadeCoins(targetTier.cost);
      if (success) {
        upgradeCardAwakeningLevel(card.id, targetTier.level);
        setAwakeningLevel(targetTier.level);
        setCoins(getStoredArcadeCoins());
        soundEffects.playSuccess();
        window.dispatchEvent(new Event('character_awakened'));

        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#38bdf8', '#c084fc', '#fbbf24', '#f472b6'],
        });
      }
      setIsAwakening(false);
    }, 500);
  };

  const currentTier = CHARACTER_TIERS.find((t) => t.level === awakeningLevel) || CHARACTER_TIERS[0];

  // The authentic character portrait of the card - always matches what is seen in the binder grid
  const originalCardArtwork = card.characterImage || card.imageUrl;

  // High-resolution character artwork - ALWAYS prioritize the card's original artwork so it never shifts upon inspection
  const displayImage = getSafeCharacterImage(
    card.characterName,
    originalCardArtwork || detailedData?.image?.large,
    card.characterNativeName || detailedData?.name?.native
  );

  const modalContent = (
    <AnimatePresence>
      <div
        id="interactive-character-3d-card-modal"
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/95 sm:bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Floating Pop-up Container - Direct 3D Collectible */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="relative flex flex-col items-center justify-center z-20 max-w-lg w-full pointer-events-auto my-auto py-2 px-1"
          onClick={(e) => {
            if (e.target === e.currentTarget && !showDetailsSheet) onClose();
          }}
        >
          {/* Floating Top Controls Header Pill */}
          <div className="flex items-center justify-between w-full max-w-xs sm:max-w-sm px-4 py-2 mb-3 rounded-full bg-slate-900/85 backdrop-blur-xl border border-white/20 shadow-xl text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${currentTier.badgeBg}`}>
                {currentTier.badge}
              </span>
              <span className="text-xs font-black tracking-wide truncate max-w-[120px] sm:max-w-[150px]">
                {card.characterName}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleShare}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition cursor-pointer"
                title="Share Character Card"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/10 hover:bg-rose-500/30 text-slate-200 hover:text-rose-300 transition cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3D Rotating Canvas Viewport (Identical to Anime Card Viewport) */}
          <div
            className="relative flex items-center justify-center py-2 select-none"
            style={{ perspective: 1400 }}
          >
            {/* Card Container with Dynamic 3D Transform */}
            <div
              ref={cardRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`relative w-72 sm:w-80 h-[440px] sm:h-[480px] select-none touch-none cursor-grab active:cursor-grabbing ${
                isDragging ? '' : 'transition-transform duration-300 ease-out'
              }`}
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
              }}
            >
              {/* ========================================================================= */}
              {/* 🌟 FRONT FACE (0 deg) - EXACT MATCHING STYLING TO ANIME CARDS */}
              {/* ========================================================================= */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg)',
                }}
                className={`rounded-3xl p-3.5 bg-[#0a0d16] bg-gradient-to-br ${currentTier.bgGradient} ${currentTier.borderClass} border-2 ${currentTier.glowClass} shadow-2xl flex flex-col justify-between overflow-hidden select-none`}
              >
                {/* Dynamic Holographic Prismatic Sheen Highlight */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-3xl opacity-40 mix-blend-color-dodge transition-opacity duration-300"
                  style={{
                    background: `radial-gradient(circle at ${sheenPos.x}% ${sheenPos.y}%, rgba(255,255,255,0.9) 0%, rgba(244,114,182,0.4) 30%, rgba(139,92,246,0.3) 50%, transparent 75%)`,
                  }}
                />

                {/* Card Front Top Header */}
                <div className="relative z-10 flex items-center justify-between pointer-events-none">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-950/90 text-[10px] font-black text-pink-300 uppercase tracking-wider border border-white/15 shadow">
                    {card.characterRole || 'CHARACTER'} • #{extractedCharId || detailedData?.id || (card.id.startsWith('char-') ? card.id.split('-')[1] : card.id.slice(0, 5))}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${currentTier.badgeBg}`}>
                      {currentTier.badge}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black shadow-md flex items-center gap-1">
                      <Star className="w-3 h-3 fill-slate-950" />
                      {detailedData?.favourites ? `${(detailedData.favourites / 1000).toFixed(1)}k` : 'ICONIC'}
                    </span>
                  </div>
                </div>

                {/* Main Character Portrait Frame */}
                <div className="relative z-10 w-full flex-1 my-2.5 rounded-2xl overflow-hidden bg-slate-950 border border-white/20 shadow-inner pointer-events-none">
                  <img
                    src={displayImage}
                    alt={card.characterName}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = getFallbackAvatarSvg(
                        card.characterName,
                        card.characterNativeName || detailedData?.name?.native
                      );
                    }}
                    className="w-full h-full object-cover object-top filter brightness-105 pointer-events-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-transparent pointer-events-none" />

                  {/* Quick Info Overlays on Portrait */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 text-center pointer-events-none">
                    <h4 className="text-sm sm:text-base font-black text-white drop-shadow-md truncate">
                      {card.characterName}
                    </h4>
                    {card.characterNativeName && (
                      <p className="text-[10px] text-pink-300 font-medium drop-shadow truncate">
                        {card.characterNativeName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Front Bottom Meta & Details */}
                <div className="relative z-10 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium px-1">
                    <span className="truncate max-w-[150px] text-purple-300 font-bold">
                      {card.animeTitle}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {detailedData?.gender ? `${detailedData.gender}` : 'COLLECTIBLE'}
                      {detailedData?.age ? ` • ${detailedData.age}` : ''}
                    </span>
                  </div>

                  {/* Badges / Vital Tags */}
                  <div className="flex items-center gap-1 overflow-hidden pointer-events-none">
                    {detailedData?.bloodType && (
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/90 text-[9px] font-semibold tracking-wide border border-white/10">
                        Type {detailedData.bloodType}
                      </span>
                    )}
                    {detailedData?.dateOfBirth?.month && (
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/90 text-[9px] font-semibold tracking-wide border border-white/10">
                        Born: {detailedData.dateOfBirth.month}/{detailedData.dateOfBirth.day || ''}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-200 text-[9px] font-semibold tracking-wide border border-purple-500/30">
                      {currentTier.tierName}
                    </span>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 🌟 BACK FACE (180 deg) - SACRED ALCHEMY LORE ART (MATCHING ANIME CARD BACK) */}
              {/* ========================================================================= */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
                className={`rounded-3xl p-4 bg-[#0a0d18] bg-gradient-to-br ${currentTier.bgGradient} ${currentTier.borderClass} border-2 ${currentTier.glowClass} shadow-2xl flex flex-col justify-between overflow-hidden select-none`}
              >
                {/* Glowing Sacred Alchemy Emblem Background with Rotation */}
                <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 rounded-full border-2 border-dashed border-amber-400/60 animate-spin [animation-duration:35s]" />
                  <div className="absolute w-44 h-44 rounded-full border border-purple-400/50" />
                  <div className="absolute w-32 h-32 rotate-45 border border-pink-400/50" />
                </div>

                {/* Holographic Sheen on Back */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-3xl opacity-35 mix-blend-color-dodge"
                  style={{
                    background: `radial-gradient(circle at ${100 - sheenPos.x}% ${100 - sheenPos.y}%, rgba(255,255,255,0.85) 0%, rgba(180,150,255,0.3) 40%, transparent 70%)`,
                  }}
                />

                {/* Back Top Header */}
                <div className="relative z-10 flex items-center justify-between pointer-events-none">
                  <span className="px-2.5 py-1 rounded-md bg-slate-950/90 text-[9px] font-mono text-purple-300 font-black tracking-widest border border-purple-500/30">
                    #CHAR-{extractedCharId || detailedData?.id || (card.id.startsWith('char-') ? card.id.split('-')[1] : card.id.slice(0, 5))}
                  </span>
                  <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${currentTier.badgeBg}`}>
                    {currentTier.badge}
                  </span>
                </div>

                {/* Back Card Title Banner */}
                <div className="relative z-10 text-center mt-1 pointer-events-none">
                  <h3 className="text-sm font-black text-white truncate px-2">
                    {card.characterName}
                  </h3>
                  <p className="text-[10px] text-pink-300 font-medium drop-shadow truncate">
                    {card.animeTitle}
                  </p>
                </div>

                {/* Center Synopsis / Lore Box */}
                <div className="relative z-10 my-2 flex-1 flex flex-col bg-slate-950/90 border border-white/15 rounded-2xl p-3 overflow-hidden backdrop-blur-md shadow-inner">
                  <div className="flex items-center gap-1.5 text-pink-400 text-[11px] font-black uppercase tracking-wider mb-1 pointer-events-none">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Story Lore & Bio</span>
                  </div>
                  <div className="flex-1 overflow-y-auto text-xs text-slate-300 leading-relaxed scrollbar-thin pr-1 text-left select-text">
                    {cleanDescription}
                  </div>
                </div>

                {/* Statistical Matrix (3 Badges) */}
                <div className="relative z-10 grid grid-cols-3 gap-1.5 text-center my-1 pointer-events-none">
                  <div className="p-1.5 rounded-xl bg-slate-950/90 border border-white/10">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Favourites</p>
                    <p className="text-xs font-black text-amber-300">
                      {detailedData?.favourites ? detailedData.favourites.toLocaleString() : '1,000+'}
                    </p>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-950/90 border border-white/10">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Role</p>
                    <p className="text-xs font-black text-pink-300 truncate">
                      {card.characterRole || 'Main'}
                    </p>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-950/90 border border-white/10">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Finish</p>
                    <p className="text-xs font-black text-cyan-300 truncate">
                      Lv.{awakeningLevel} Finish
                    </p>
                  </div>
                </div>

                {/* Back Bottom Brand */}
                <div className="relative z-10 flex items-center justify-between text-[9px] text-slate-400 font-mono px-1 border-t border-white/10 pt-1.5 pointer-events-none">
                  <span>ANILOVE OFFICIAL COLLECTIBLE</span>
                  <span className="text-purple-300 font-bold">{currentTier.stars} {currentTier.tierName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Floating 3D Rotation Controls Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {/* Flip Button */}
            <button
              type="button"
              onClick={handleFlipCard}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 border border-purple-400/40 backdrop-blur-md transition active:scale-95 cursor-pointer"
              title="Flip Card 180°"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Flip Card</span>
            </button>

            {/* Auto Spin Toggle */}
            <button
              type="button"
              onClick={toggleAutoSpin}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md transition active:scale-95 cursor-pointer ${
                autoSpin
                  ? 'bg-pink-600/90 text-white border-pink-400 shadow-lg shadow-pink-600/30 animate-pulse'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-white/20 shadow-md'
              }`}
              title="Toggle 360° Auto-Spin"
            >
              <Sparkles className="w-3 h-3 text-pink-300" />
              <span>{autoSpin ? 'Spinning...' : '360° Auto-Spin'}</span>
            </button>

            {/* Reset Angle */}
            <button
              type="button"
              onClick={handleResetRotation}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs border border-white/20 backdrop-blur-md shadow-md transition active:scale-95 cursor-pointer"
              title="Reset Rotation"
            >
              <Rotate3d className="w-3 h-3" />
              <span>Reset View</span>
            </button>
          </div>

          {/* Floating Action Controls Bar - PROMINENT "DETAILS" & "AWAKEN" DUAL BUTTONS */}
          <div className="flex items-center justify-center gap-3 mt-3.5 w-full max-w-xs sm:max-w-sm px-2">
            {/* Details Option */}
            <button
              type="button"
              onClick={() => {
                soundEffects.playClick();
                setActiveTab('LORE');
                setShowDetailsSheet(true);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-purple-600/40 border border-purple-400/40 backdrop-blur-xl transition hover:scale-105 active:scale-95 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-purple-200" />
              <span>Details</span>
            </button>

            {/* Awaken Option (Opens Card Foil Upgrades) */}
            <button
              type="button"
              onClick={() => {
                soundEffects.playClick();
                setActiveTab('AWAKEN');
                setShowDetailsSheet(true);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/40 border border-amber-300/80 backdrop-blur-xl transition hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950" />
              <span>Awaken</span>
            </button>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* EXPANDED DETAILS & AWAKENING MODAL SHEET (OPENED BY "DETAILS" OR "AWAKEN") */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {showDetailsSheet && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/90 backdrop-blur-xl"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowDetailsSheet(false);
              }}
            >
              <div className="relative w-full max-w-2xl max-h-[92vh] rounded-3xl bg-slate-900 border border-purple-500/30 shadow-2xl text-slate-100 flex flex-col overflow-hidden">
                {/* Fixed Top Header & Responsive Segmented Tab Bar */}
                <div className="p-4 sm:p-6 pb-3 border-b border-white/10 bg-slate-900/95 backdrop-blur-md shrink-0 space-y-3">
                  {/* Top Row: Back button, Character Name, and Close X */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.playClick();
                          setShowDetailsSheet(false);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0 active:scale-95 border border-white/10"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden xs:inline">Back to Card</span>
                        <span className="xs:hidden">Back</span>
                      </button>
                      <h2 className="text-sm sm:text-base font-black text-white truncate">
                        {card.characterName}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playClick();
                        setShowDetailsSheet(false);
                      }}
                      className="p-1.5 sm:p-2 rounded-full bg-white/10 hover:bg-rose-600/80 text-slate-300 hover:text-white transition cursor-pointer shrink-0 active:scale-95"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 3-COLUMN RESPONSIVE SEGMENTED TAB BAR - NEVER CLIPS ON MOBILE */}
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-950/80 border border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playClick();
                        setActiveTab('LORE');
                      }}
                      className={`py-2 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                        activeTab === 'LORE'
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30 font-black'
                          : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate text-[11px] sm:text-xs">Lorebook</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playClick();
                        setActiveTab('ANIME');
                      }}
                      className={`py-2 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                        activeTab === 'ANIME'
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30 font-black'
                          : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Tv className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate text-[11px] sm:text-xs">
                        Anime ({detailedData?.media?.length || 1})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playClick();
                        setActiveTab('AWAKEN');
                      }}
                      className={`py-2 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                        activeTab === 'AWAKEN'
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/30 font-black'
                          : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate text-[11px] sm:text-xs">
                        Foil ({awakeningLevel}/4)
                      </span>
                    </button>
                  </div>
                </div>

                {/* Scrollable Content Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  {/* ========================================================================= */}
                  {/* TAB 1: CHARACTER LOREBOOK */}
                  {/* ========================================================================= */}
                  {activeTab === 'LORE' && (
                    <div className="space-y-4">
                      {/* Character Meta Badges */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 space-y-0.5 shadow-sm">
                          <span className="text-[10px] uppercase font-black text-purple-400 tracking-wider block">Gender</span>
                          <span className="font-bold text-white text-xs sm:text-sm">{detailedData?.gender || 'Unknown'}</span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 space-y-0.5 shadow-sm">
                          <span className="text-[10px] uppercase font-black text-purple-400 tracking-wider block">Age</span>
                          <span className="font-bold text-white text-xs sm:text-sm">{detailedData?.age || 'N/A'}</span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 space-y-0.5 shadow-sm">
                          <span className="text-[10px] uppercase font-black text-purple-400 tracking-wider block">Birthday</span>
                          <span className="font-bold text-white text-xs sm:text-sm">
                            {detailedData?.dateOfBirth?.month && detailedData?.dateOfBirth?.day
                              ? `${detailedData.dateOfBirth.month}/${detailedData.dateOfBirth.day}`
                              : 'Unknown'}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 space-y-0.5 shadow-sm">
                          <span className="text-[10px] uppercase font-black text-purple-400 tracking-wider block">Blood Type</span>
                          <span className="font-bold text-white text-xs sm:text-sm">{detailedData?.bloodType || 'Unknown'}</span>
                        </div>
                      </div>

                      {/* Alternative Names & Aliases */}
                      {detailedData?.name?.alternative && detailedData.name.alternative.length > 0 && (
                        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2">
                          <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider block">
                            Known Aliases & Alternate Names:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {detailedData.name.alternative.slice(0, 8).map((altName, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 rounded-lg bg-purple-950/50 border border-purple-500/30 text-[11px] font-medium text-purple-200"
                              >
                                {altName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Full Markdown Lorebook */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                        {isLoadingDetails ? (
                          <div className="py-8 text-center space-y-2">
                            <RefreshCw className="w-6 h-6 text-purple-400 animate-spin mx-auto" />
                            <p className="text-xs text-slate-400">Loading complete lorebook...</p>
                          </div>
                        ) : (
                          <LorebookMarkdown content={detailedData?.description || ''} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* TAB 2: FEATURED ANIME APPEARANCES */}
                  {/* ========================================================================= */}
                  {activeTab === 'ANIME' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                        <span>Official series featuring <strong className="text-white">{card.characterName}</strong>:</span>
                        <span className="text-purple-400 text-[11px]">Click title to view details</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {detailedData?.media && detailedData.media.length > 0 ? (
                          detailedData.media.map((media) => {
                            const mediaTitle = media.title.english || media.title.userPreferred || media.title.romaji || 'Anime';
                            return (
                              <div
                                key={media.id}
                                onClick={() => {
                                  if (onOpenAnimeDetails) {
                                    setShowDetailsSheet(false);
                                    onClose();
                                    onOpenAnimeDetails(media as unknown as Anime);
                                  }
                                }}
                                className="group p-3 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-white/10 hover:border-purple-500/50 transition-all flex items-center gap-3 cursor-pointer shadow-md active:scale-98"
                              >
                                <img
                                  src={media.coverImage?.large || media.coverImage?.medium}
                                  alt={mediaTitle}
                                  referrerPolicy="no-referrer"
                                  className="w-12 h-16 rounded-xl object-cover border border-white/10 shrink-0 group-hover:scale-105 transition"
                                />
                                <div className="min-w-0 space-y-1">
                                  <h5 className="text-xs sm:text-sm font-black text-white group-hover:text-purple-300 transition truncate">
                                    {mediaTitle}
                                  </h5>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {media.seasonYear ? `${media.seasonYear} • ` : ''}
                                    {media.episodes ? `${media.episodes} episodes` : 'Series'}
                                  </p>
                                  {media.averageScore && (
                                    <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                                      ★ {media.averageScore}% Score
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="col-span-1 sm:col-span-2 p-6 rounded-2xl bg-slate-950/60 border border-white/10 text-center space-y-2">
                            <Tv className="w-8 h-8 text-purple-400 mx-auto opacity-60" />
                            <p className="text-xs text-slate-300">
                              Originating Series: <strong className="text-purple-300">{card.animeTitle}</strong>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* TAB 3: CARD AWAKENING & FOIL UPGRADES (0 / 1 / 3 / 5 COINS) */}
                  {/* ========================================================================= */}
                  {activeTab === 'AWAKEN' && (
                    <div className="space-y-3">
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-4">
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                          <span className="font-bold text-slate-300 flex items-center gap-1.5">
                            <Coins className="w-4 h-4 text-amber-400" />
                            Your Coins: <strong className="text-amber-300 text-sm">{coins}</strong>
                          </span>
                          <span className={`font-black ${currentTier.textColor}`}>
                            Current: {currentTier.tierName}
                          </span>
                        </div>

                        {/* 4 Distinct Tiers matching anime cards */}
                        <div className="space-y-2.5">
                          {CHARACTER_TIERS.map((tier) => {
                            const isUnlocked = awakeningLevel >= tier.level;
                            const isNext = awakeningLevel + 1 === tier.level;
                            const canAfford = coins >= tier.cost;

                            return (
                              <div
                                key={tier.level}
                                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                                  isUnlocked
                                    ? `${tier.bgGradient} ${tier.borderClass} shadow-md`
                                    : isNext
                                    ? 'bg-slate-900 border-amber-500/50 hover:border-amber-500/80 shadow-lg'
                                    : 'bg-slate-950/50 border-white/5 opacity-60'
                                }`}
                              >
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs sm:text-sm font-black text-white truncate">
                                      {tier.tierName}
                                    </span>
                                    <span className={`text-[10px] font-bold ${tier.textColor}`}>
                                      {tier.badge}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400">
                                    {tier.level === 1
                                      ? 'Base unlocked Holo Finish (Free)'
                                      : `Upgrade Cost: ${tier.cost} Arcade Coins`}
                                  </p>
                                </div>

                                <div className="shrink-0">
                                  {isUnlocked ? (
                                    <span className={`px-3 py-1.5 rounded-xl bg-slate-900/90 ${tier.textColor} border ${tier.borderClass} text-xs font-black flex items-center gap-1 shadow-sm`}>
                                      <Check className="w-3.5 h-3.5" />
                                      Unlocked
                                    </span>
                                  ) : isNext ? (
                                    <button
                                      type="button"
                                      onClick={() => handleAwakenCard(tier)}
                                      disabled={!canAfford || isAwakening}
                                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                                        canAfford
                                          ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/30'
                                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                                      }`}
                                    >
                                      <Coins className="w-3.5 h-3.5 text-slate-950" />
                                      <span>Awaken ({tier.cost}c)</span>
                                    </button>
                                  ) : (
                                    <span className="px-3 py-1 text-[11px] text-slate-500 font-bold">
                                      Locked
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
