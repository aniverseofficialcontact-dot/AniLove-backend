import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X, CloudCheck } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'sync';
  title?: string;
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      id="toast-container"
      className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map(toast => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isSync = toast.type === 'sync';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl ${
                isError
                  ? 'bg-rose-950/80 border-rose-500/30 text-rose-100'
                  : isSync
                  ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-100'
                  : isSuccess
                  ? 'bg-slate-900/80 border-pink-500/30 text-pink-100'
                  : 'bg-slate-900/80 border-white/15 text-slate-100'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
                {isSync && <CloudCheck className="w-5 h-5 text-emerald-400 animate-pulse" />}
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-pink-400" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-sky-400" />}
              </div>
              <div className="flex-1 text-sm">
                {toast.title && <div className="font-semibold">{toast.title}</div>}
                <div className="text-xs opacity-90 leading-relaxed mt-0.5">{toast.message}</div>
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
