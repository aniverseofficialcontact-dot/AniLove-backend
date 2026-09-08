import React, { useState, useEffect, useCallback } from 'react';
import {
  Gamepad2,
  Dice5,
  EyeOff,
  Swords,
  ShoppingBag,
  Coins,
  Calendar,
  ZoomIn,
} from 'lucide-react';
import { Anime } from '../types';
import { fetchVastArcadeAnimePool } from '../services/anilist';
import { soundEffects } from '../services/soundEffects';
import { getStoredArcadeCoins } from '../services/storage';
import { BlurGuesser } from './BlurGuesser';
import { HigherLowerGame } from './HigherLowerGame';
import { YearBattleGame } from './YearBattleGame';
import { ZoomGuesserGame } from './ZoomGuesserGame';
import { CharacterGacha } from './CharacterGacha';
import { ArcadeShop } from './ArcadeShop';

interface ArcadeViewProps {
  onOpenDetails?: (anime: Anime) => void;
  onNavigateToLibrary?: () => void;
  onNavigateToCards?: () => void;
}

export type ArcadeSubTab =
  | 'blur'
  | 'higherlower'
  | 'year_battle'
  | 'zoom_guesser'
  | 'gacha'
  | 'shop';

export const ArcadeView: React.FC<ArcadeViewProps> = ({
  onOpenDetails,
  onNavigateToLibrary,
  onNavigateToCards,
}) => {
  const [subTab, setSubTab] = useState<ArcadeSubTab>('blur');
  const [animePool, setAnimePool] = useState<Anime[]>([]);
  const [isLoadingPool, setIsLoadingPool] = useState<boolean>(true);
  const [coins, setCoins] = useState<number>(() => getStoredArcadeCoins());

  // Sync coins
  useEffect(() => {
    const handleCoinUpdate = (e: CustomEvent<number>) => {
      setCoins(e.detail);
    };
    const handleStorage = () => {
      setCoins(getStoredArcadeCoins());
    };
    window.addEventListener('arcade_coins_updated' as any, handleCoinUpdate as any);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('arcade_coins_updated' as any, handleCoinUpdate as any);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Load vast high-diversity anime pool spanning random pages, genres, and popularity
  const loadGamePool = useCallback(async () => {
    setIsLoadingPool(true);
    try {
      const vastPool = await fetchVastArcadeAnimePool();
      setAnimePool(vastPool);
    } catch (err) {
      console.error('Failed to load vast anime pool for arcade:', err);
    } finally {
      setIsLoadingPool(false);
    }
  }, []);

  useEffect(() => {
    loadGamePool();
  }, [loadGamePool]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden p-6 sm:p-8 bg-gradient-to-r from-slate-900/95 via-purple-950/40 to-slate-900/95 border border-white/10 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-bold">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Otaku Arcade & Game Zone</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Anime Mini-Games, Character Gacha & Quizzes
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Play 4 fast automated anime mini-games, earn Arcade Coins, pull character cards in Gacha, and collect rare awakenings!
            </p>
          </div>

          {/* Quick Balance Header Chip */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 shrink-0 self-start md:self-center">
            <Coins className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-[10px] text-amber-400/80 font-bold block uppercase tracking-wider">Arcade Balance</span>
              <span className="text-base font-black text-amber-300">{coins} Coins</span>
            </div>
          </div>
        </div>

        {/* Scrollable Sub-Tab Bar */}
        <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Tab 1: Guess the Anime (Blur) */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setSubTab('blur');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
              subTab === 'blur'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-white/5'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Guess Anime (Blur)</span>
          </button>

          {/* Tab 2: Higher or Lower (Rating Battle) */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setSubTab('higherlower');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
              subTab === 'higherlower'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-white/5'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Higher or Lower</span>
          </button>

          {/* Tab 3: Release Year Battle */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setSubTab('year_battle');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
              subTab === 'year_battle'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-white/5'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Year Battle</span>
          </button>

          {/* Tab 4: Zoom Crop Guesser */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setSubTab('zoom_guesser');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
              subTab === 'zoom_guesser'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-white/5'
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Zoom Crop</span>
          </button>

          {/* Tab 5: Character Gacha */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setSubTab('gacha');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
              subTab === 'gacha'
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/30 font-black'
                : 'text-violet-300 hover:text-violet-100 bg-violet-950/40 border border-violet-500/20'
            }`}
          >
            <Dice5 className="w-3.5 h-3.5" />
            <span>Character Gacha</span>
          </button>

          {/* Tab 6: Card Shop */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setSubTab('shop');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
              subTab === 'shop'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black shadow-md shadow-amber-500/30'
                : 'text-amber-300 hover:text-amber-100 bg-amber-950/40 border border-amber-500/20'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
            <span>Card Shop</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
              subTab === 'shop'
                ? 'bg-slate-950 text-amber-300'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {coins}
            </span>
          </button>
        </div>
      </div>

      {/* ===================== SUBTAB 1: GUESS THE ANIME (BLUR MCQ) ===================== */}
      {subTab === 'blur' && (
        <BlurGuesser
          animePool={animePool}
          onOpenDetails={onOpenDetails}
          onNavigateToShop={() => setSubTab('shop')}
          onRefreshPool={loadGamePool}
        />
      )}

      {/* ===================== SUBTAB 2: HIGHER OR LOWER (RATING BATTLE) ===================== */}
      {subTab === 'higherlower' && (
        <HigherLowerGame
          animePool={animePool}
          onOpenDetails={onOpenDetails}
          onNavigateToShop={() => setSubTab('shop')}
          onRefreshPool={loadGamePool}
        />
      )}

      {/* ===================== SUBTAB 3: RELEASE YEAR BATTLE ===================== */}
      {subTab === 'year_battle' && (
        <YearBattleGame
          animePool={animePool}
          onOpenDetails={onOpenDetails}
          onNavigateToShop={() => setSubTab('shop')}
          onRefreshPool={loadGamePool}
        />
      )}

      {/* ===================== SUBTAB 4: ZOOM CROP GUESSER ===================== */}
      {subTab === 'zoom_guesser' && (
        <ZoomGuesserGame
          animePool={animePool}
          onOpenDetails={onOpenDetails}
          onNavigateToShop={() => setSubTab('shop')}
          onRefreshPool={loadGamePool}
        />
      )}

      {/* ===================== SUBTAB 5: CHARACTER GACHA (COMPLETED ANIME SPINS) ===================== */}
      {subTab === 'gacha' && (
        <CharacterGacha
          onOpenDetails={onOpenDetails}
          onNavigateToLibrary={onNavigateToLibrary}
          onNavigateToShop={() => setSubTab('shop')}
          onNavigateToCards={onNavigateToCards}
        />
      )}

      {/* ===================== SUBTAB 6: CARD SHOP ===================== */}
      {subTab === 'shop' && (
        <ArcadeShop
          onOpenDetails={onOpenDetails}
          onNavigateToGame={(gameTab) => setSubTab(gameTab as ArcadeSubTab)}
        />
      )}
    </div>
  );
};
