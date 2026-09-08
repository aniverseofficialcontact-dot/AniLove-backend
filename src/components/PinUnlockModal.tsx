import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, ShieldAlert, X, Delete, ArrowRight, HelpCircle, RotateCcw, ShieldCheck, KeyRound } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

interface PinUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetSectionName?: string;
  correctPin?: string | null;
  backupQuestion?: string;
  backupAnswer?: string | null;
  onResetPin?: () => void;
  onNavigateToAccount?: () => void;
}

export function PinUnlockModal({
  isOpen,
  onClose,
  onSuccess,
  targetSectionName = 'Protected Content',
  correctPin,
  backupQuestion = 'what/who do you like most?',
  backupAnswer,
  onResetPin,
  onNavigateToAccount,
}: PinUnlockModalProps) {
  const [mode, setMode] = useState<'pin' | 'recovery'>('pin');
  const [pinDigits, setPinDigits] = useState<string>('');
  const [recoveryInput, setRecoveryInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [shakeKey, setShakeKey] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recoveryInputRef = useRef<HTMLInputElement | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('pin');
      setPinDigits('');
      setRecoveryInput('');
      setError('');
      setIsSuccess(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (mode === 'recovery') {
      setError('');
      setTimeout(() => {
        recoveryInputRef.current?.focus();
      }, 100);
    } else {
      setError('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [mode]);

  // Handle digit input verification
  const handleAddDigit = (digit: string) => {
    if (isSuccess || pinDigits.length >= 4) return;
    soundEffects.playClick();
    const newDigits = pinDigits + digit;
    setPinDigits(newDigits);
    setError('');

    if (newDigits.length === 4) {
      verifyPin(newDigits);
    }
  };

  const handleDeleteDigit = () => {
    if (isSuccess || pinDigits.length === 0) return;
    soundEffects.playClick();
    setPinDigits(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    soundEffects.playClick();
    setPinDigits('');
    setError('');
  };

  const verifyPin = (enteredPin: string) => {
    if (enteredPin === correctPin) {
      setIsSuccess(true);
      soundEffects.playSuccess();
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 400);
    } else {
      soundEffects.playError();
      setError('Incorrect PIN. Please try again or use the backup question.');
      setShakeKey(prev => prev + 1);
      setTimeout(() => {
        setPinDigits('');
      }, 600);
    }
  };

  const handleVerifyBackupAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEntered = recoveryInput.trim().toLowerCase();
    const cleanExpected = (backupAnswer || '').trim().toLowerCase();

    // If backup answer was configured, verify case-insensitively.
    // If no backup answer was ever saved (legacy), allow reset.
    if (!backupAnswer || (cleanEntered && cleanEntered === cleanExpected)) {
      setIsSuccess(true);
      soundEffects.playSuccess();
      setTimeout(() => {
        onResetPin?.();
        onSuccess();
        onClose();
      }, 600);
    } else {
      soundEffects.playError();
      setError('Incorrect answer to security question. Please try again.');
      setShakeKey(prev => prev + 1);
    }
  };

  // Keyboard navigation & number typing
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (mode === 'pin') {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleAddDigit(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleDeleteDigit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pinDigits, isSuccess, correctPin, mode]);

  if (!isOpen) return null;

  const displayQuestion = backupQuestion || 'what/who do you like most?';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Hidden input for software keyboards in PIN mode */}
        {mode === 'pin' && (
          <input
            ref={inputRef}
            type="tel"
            pattern="[0-9]*"
            inputMode="numeric"
            maxLength={4}
            value={pinDigits}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 4);
              setPinDigits(val);
              if (val.length === 4) {
                verifyPin(val);
              }
            }}
            className="opacity-0 absolute pointer-events-none w-0 h-0"
            aria-hidden="true"
          />
        )}

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-sm rounded-3xl bg-slate-900/95 border border-pink-500/30 p-6 sm:p-7 shadow-2xl shadow-pink-500/10 backdrop-blur-2xl text-center space-y-5 z-10"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {mode === 'pin' ? (
            <>
              {/* Security Shield / Lock Icon */}
              <div className="flex flex-col items-center">
                <div className="relative mb-3">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      isSuccess
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/20'
                        : error
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-lg shadow-rose-500/20'
                        : 'bg-pink-500/20 text-pink-400 border border-pink-500/30 shadow-lg shadow-pink-500/20'
                    }`}
                  >
                    {isSuccess ? (
                      <Unlock className="w-8 h-8 animate-bounce" />
                    ) : error ? (
                      <ShieldAlert className="w-8 h-8 animate-pulse" />
                    ) : (
                      <Lock className="w-8 h-8" />
                    )}
                  </div>
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-pink-500 to-indigo-500 opacity-20 blur-sm -z-10" />
                </div>

                <h3 className="text-lg font-black text-white tracking-wide">
                  {isSuccess ? 'Access Granted' : 'Profile PIN Required'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-[260px]">
                  Enter your 4-digit PIN to access <span className="text-pink-400 font-bold">{targetSectionName}</span>
                </p>
              </div>

              {/* PIN Digits Display (Dots) */}
              <motion.div
                key={shakeKey}
                animate={error ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
                transition={{ duration: 0.4 }}
                className="flex items-center justify-center gap-3.5 py-2"
              >
                {[0, 1, 2, 3].map(index => {
                  const isFilled = pinDigits.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-4 h-4 rounded-full transition-all duration-200 ${
                        isSuccess
                          ? 'bg-emerald-400 scale-110 shadow-md shadow-emerald-400/50'
                          : isFilled
                          ? 'bg-gradient-to-r from-pink-500 to-indigo-500 scale-110 shadow-md shadow-pink-500/50'
                          : 'bg-slate-800 border-2 border-slate-700'
                      }`}
                    />
                  );
                })}
              </motion.div>

              {/* Error / Status message */}
              <div className="min-h-5 flex items-center justify-center">
                {error && (
                  <p className="text-xs font-semibold text-rose-400 animate-in fade-in slide-in-from-top-1 leading-tight">
                    {error}
                  </p>
                )}
                {isSuccess && (
                  <p className="text-xs font-semibold text-emerald-400 animate-in fade-in">
                    Unlocking protected section...
                  </p>
                )}
              </div>

              {/* 12-Button Numeric Touch Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto pt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleAddDigit(num.toString())}
                    disabled={isSuccess || pinDigits.length >= 4}
                    className="h-12 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-pink-600 border border-slate-700/80 hover:border-pink-500/40 text-base font-bold text-white transition active:scale-95 flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    {num}
                  </button>
                ))}

                {/* Clear button */}
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isSuccess || pinDigits.length === 0}
                  className="h-12 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-400 hover:text-white transition active:scale-95 flex items-center justify-center cursor-pointer disabled:opacity-40"
                >
                  Clear
                </button>

                {/* 0 digit */}
                <button
                  type="button"
                  onClick={() => handleAddDigit('0')}
                  disabled={isSuccess || pinDigits.length >= 4}
                  className="h-12 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-pink-600 border border-slate-700/80 hover:border-pink-500/40 text-base font-bold text-white transition active:scale-95 flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  0
                </button>

                {/* Backspace button */}
                <button
                  type="button"
                  onClick={handleDeleteDigit}
                  disabled={isSuccess || pinDigits.length === 0}
                  className="h-12 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition active:scale-95 flex items-center justify-center cursor-pointer disabled:opacity-40"
                  aria-label="Backspace"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              {/* Forgot PIN Recovery Trigger */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setMode('recovery')}
                  className="text-xs font-semibold text-pink-400 hover:text-pink-300 flex items-center justify-center gap-1.5 py-1 transition cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Forgot PIN? Answer Backup Question</span>
                </button>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <button
                    type="button"
                    onClick={onClose}
                    className="hover:text-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  {onNavigateToAccount && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToAccount();
                      }}
                      className="text-slate-400 hover:text-white font-medium flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Account Settings</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* RECOVERY MODE VIA BACKUP SECURITY QUESTION */
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <div className="relative mb-3">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      isSuccess
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/20'
                        : error
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-lg shadow-rose-500/20'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/20'
                    }`}
                  >
                    {isSuccess ? (
                      <ShieldCheck className="w-8 h-8 animate-bounce" />
                    ) : (
                      <KeyRound className="w-8 h-8" />
                    )}
                  </div>
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-500 to-pink-500 opacity-20 blur-sm -z-10" />
                </div>

                <h3 className="text-lg font-black text-white tracking-wide">
                  {isSuccess ? 'PIN Reset Successful!' : 'Backup Question Verification'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                  Answer your backup question below. Verifying correctly will reset your PIN and grant access.
                </p>
              </div>

              {/* Security Question Box */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-amber-500/20 text-left space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  <HelpCircle className="w-3 h-3" />
                  <span>Security Question</span>
                </div>
                <p className="text-sm font-semibold text-white capitalize">
                  "{displayQuestion}"
                </p>
              </div>

              {/* Form Input for Answer */}
              <form onSubmit={handleVerifyBackupAnswer} className="space-y-4">
                <motion.div
                  key={shakeKey}
                  animate={error ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className="space-y-1.5 text-left"
                >
                  <label className="block text-xs font-bold text-slate-300">
                    Your Answer
                  </label>
                  <input
                    ref={recoveryInputRef}
                    type="text"
                    required
                    value={recoveryInput}
                    onChange={e => {
                      setRecoveryInput(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter what or who you like most..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-medium placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition text-sm"
                  />
                  {error && (
                    <p className="text-xs font-semibold text-rose-400 pt-1 leading-tight">
                      {error}
                    </p>
                  )}
                  {isSuccess && (
                    <p className="text-xs font-semibold text-emerald-400 pt-1">
                      Answer verified! Resetting PIN and unlocking...
                    </p>
                  )}
                </motion.div>

                {/* Reset & Submit Button */}
                <div className="space-y-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSuccess || !recoveryInput.trim()}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-violet-600 hover:from-amber-400 hover:to-violet-500 text-white text-xs font-bold uppercase tracking-wider transition active:scale-95 shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset PIN & Unlock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('pin')}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition cursor-pointer"
                  >
                    Back to PIN Keypad
                  </button>
                </div>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
