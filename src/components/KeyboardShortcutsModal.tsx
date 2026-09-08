import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Keyboard, X, Play, Volume2, Maximize, SkipForward, Camera, Sparkles, Sliders } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space / K', action: 'Play / Pause video playback', icon: Play },
    { key: '← / →', action: 'Seek backward / forward 10 seconds', icon: SkipForward },
    { key: '↑ / ↓', action: 'Adjust volume up / down by 10%', icon: Volume2 },
    { key: 'M', action: 'Mute / Unmute audio', icon: Volume2 },
    { key: 'F', action: 'Toggle Fullscreen mode', icon: Maximize },
    { key: 'T', action: 'Toggle Theater Mode', icon: Sliders },
    { key: 'P', action: 'Picture-in-Picture (PiP) mode', icon: Sparkles },
    { key: 'O', action: 'Skip Opening Theme (+85s)', icon: SkipForward },
    { key: 'E', action: 'Skip Ending Theme (+90s)', icon: SkipForward },
    { key: 'C', action: 'Capture screenshot snapshot', icon: Camera },
    { key: 'N', action: 'Next Episode', icon: SkipForward },
    { key: 'Hold Screen', action: '2x Fast Forward Turbo Speed', icon: Sparkles },
    { key: '?', action: 'Open Keyboard Shortcuts Guide', icon: Keyboard },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-[#0e111d] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-200"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center">
                <Keyboard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Player Keyboard Shortcuts</h3>
                <p className="text-xs text-slate-400">Master video playback controls with your keyboard</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {shortcuts.map((sc, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs"
              >
                <span className="text-slate-300 font-medium">{sc.action}</span>
                <kbd className="px-2.5 py-1 rounded-lg bg-slate-800 text-indigo-300 font-mono font-bold border border-slate-700 shadow-sm text-[11px]">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="pt-2 text-center text-xs text-slate-500">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-bold">Esc</kbd> to close anytime
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
