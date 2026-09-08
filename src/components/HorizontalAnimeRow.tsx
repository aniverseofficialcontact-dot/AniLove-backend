import React, { useRef } from 'react';
import { Anime, UserMediaListItem, MediaListStatus } from '../types';
import { AnimeCard } from './AnimeCard';

interface HorizontalAnimeRowProps {
  title: string;
  category?: 'trending' | 'popular' | 'topRated' | 'newest' | string;
  animeList: Anime[];
  userLibrary: UserMediaListItem[];
  isLoading?: boolean;
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime, episodeNumber?: number, startTime?: number) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onUpdateProgress: (anime: Anime, newProgress: number) => void;
  onSelectGenre?: (genre: string) => void;
  onSelectStudio?: (studio: string) => void;
  onInspect3DCard?: (anime: Anime) => void;
}

export const HorizontalAnimeRow: React.FC<HorizontalAnimeRowProps> = ({
  title,
  animeList,
  userLibrary,
  isLoading = false,
  onOpenDetails,
  onPlayStream,
  onUpdateStatus,
  onUpdateProgress,
  onSelectGenre,
  onSelectStudio,
  onInspect3DCard,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  return (
    <section className="space-y-3.5">
      {/* Category Row Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          {title}
        </h3>
      </div>

      {/* Horizontal Swipeable Row */}
      <div
        ref={rowRef}
        className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto pb-4 pt-4 -mt-2 px-1 scrollbar-none snap-x select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-[145px] sm:w-[165px] md:w-[180px] lg:w-[192px] xl:w-[200px] shrink-0 aspect-[2/3] rounded-2xl bg-white/5 animate-pulse border border-white/10"
              />
            ))
          : animeList.map(anime => (
              <div
                key={anime.id}
                className="w-[145px] sm:w-[165px] md:w-[180px] lg:w-[192px] xl:w-[200px] shrink-0 snap-start transition-transform duration-200"
              >
                <AnimeCard
                  anime={anime}
                  userItem={userLibrary.find(i => i.mediaId === anime.id)}
                  onOpenDetails={onOpenDetails}
                  onPlayStream={onPlayStream}
                  onUpdateStatus={onUpdateStatus}
                  onUpdateProgress={onUpdateProgress}
                  onSelectGenre={onSelectGenre}
                  onSelectStudio={onSelectStudio}
                  onInspect3DCard={onInspect3DCard}
                />
              </div>
            ))}
      </div>
    </section>
  );
};

