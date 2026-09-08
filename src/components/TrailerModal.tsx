import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink } from 'lucide-react';
import { AnimeTrailer } from '../types';

interface TrailerModalProps {
  trailer: AnimeTrailer | null;
  animeTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TrailerModal: React.FC<TrailerModalProps> = ({ trailer, animeTitle, isOpen, onClose }) => {
  if (!isOpen || !trailer || !trailer.id) return null;

  const isYouTube = trailer.site?.toLowerCase() === 'youtube' || !trailer.site;
  const embedUrl = isYouTube
    ? `https://www.youtube.com/embed/${trailer.id}?autoplay=1&rel=0&enablejsapi=1`
    : null;

  return (
    <AnimatePresence>
      <div
        id="trailer-modal-backdrop"
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative w-full max-w-4xl bg-[#0e1222] border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#090c17]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <h3 className="font-semibold text-sm sm:text-base text-slate-100 truncate max-w-md">
                Trailer — {animeTitle}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {isYouTube && (
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                >
                  <span>Open on YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                id="close-trailer-modal-btn"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Player Container */}
          <div className="relative w-full aspect-video bg-black">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={`${animeTitle} Official Trailer`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <p>Trailer provider is not directly embeddable.</p>
                {trailer.site && <p className="text-xs mt-2 text-slate-500">Source: {trailer.site}</p>}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
