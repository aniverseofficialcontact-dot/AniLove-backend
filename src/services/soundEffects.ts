// Synthesized Web Audio API sound effects engine (Zero external audio file dependencies)

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.25;
  private introNodes: (AudioNode & { stop?: (when?: number) => void })[] = [];
  private introMasterGain: GainNode | null = null;
  private introTimeoutIds: any[] = [];

  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public async resumeAudio(): Promise<void> {
    const ctx = this.initCtx();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore audio policy errors
      }
    }
  }

  public isAudioRunning(): boolean {
    return !!(this.ctx && this.ctx.state === 'running');
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  // Generic play dispatcher
  public play(name: 'click' | 'cardFlip' | 'success' | 'quizCorrect' | 'quizWrong' | 'coin' | 'gachaPull' | 'legendaryUnlock' | 'rankUp' | string) {
    if (!this.isEnabled) return;
    switch (name) {
      case 'cardFlip':
        return this.playCardFlip();
      case 'success':
        return this.playSuccess();
      case 'quizCorrect':
        return this.playQuizCorrect();
      case 'quizWrong':
        return this.playQuizWrong();
      case 'coin':
        return this.playPurchase();
      case 'gachaPull':
        return this.playGachaRoll();
      case 'legendaryUnlock':
        return this.playLegendaryReveal();
      case 'rankUp':
        return this.playVictoryFanfare();
      case 'click':
      default:
        return this.playClick();
    }
  }

  // Soft subtle UI click
  public playClick() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(this.volume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // ignore audio errors
    }
  }

  // Card / Tab Selection
  public playCardSelect() {
    this.playClick();
  }

  // 3D Card 360° Swoosh / Flip sound
  public playCardFlip() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.16);

      gain.gain.setValueAtTime(this.volume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // ignore audio errors
    }
  }

  // Success / Episode progress +1 / Bookmark added
  public playSuccess() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc1.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc1.frequency.setValueAtTime(1046.5, now + 0.24); // C6

      osc2.frequency.setValueAtTime(261.63, now);
      osc2.frequency.setValueAtTime(523.25, now + 0.24);

      gain.gain.setValueAtTime(this.volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch {
      // ignore audio errors
    }
  }

  // Correct answer in Anime Quiz
  public playQuizCorrect() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.07;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(this.volume * 0.4, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {
      // ignore audio errors
    }
  }

  // Wrong answer buzzer
  public playQuizWrong() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.setValueAtTime(110, now + 0.12);

      gain.gain.setValueAtTime(this.volume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // ignore audio errors
    }
  }

  public playError() {
    this.playQuizWrong();
  }

  // Gacha Summon Roll Whirl
  public playGachaRoll() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.6);

      gain.gain.setValueAtTime(this.volume * 0.2, now);
      gain.gain.linearRampToValueAtTime(this.volume * 0.4, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // ignore audio errors
    }
  }

  // Legendary UR / SSR Gacha Reveal
  public playLegendaryReveal() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const chords = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
      chords.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.05;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(this.volume * 0.4, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.8);
      });
    } catch {
      // ignore audio errors
    }
  }

  // Shop purchase sound effect
  public playPurchase() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.06;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(this.volume * 0.35, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch {
      // ignore audio errors
    }
  }

  // Theme switch / Modal swoop
  public playSwoosh() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.1);

      gain.gain.setValueAtTime(this.volume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // ignore audio errors
    }
  }

  // Voice line shout aura sound effect
  public playVoiceShout(pitchMultiplier: number = 1.0) {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const baseFreq = 340 * Math.max(0.7, Math.min(1.4, pitchMultiplier));
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.25);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.volume * 0.25, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // ignore audio errors
    }
  }
  // Victory Fanfare & Cheers sound effect
  public playVictoryFanfare() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Triumphant fanfare notes: C5, E5, G5, C6, G5, C6 (extended triumph)
      const notes = [
        { f: 523.25, d: 0.12, t: 0 },
        { f: 659.25, d: 0.12, t: 0.12 },
        { f: 783.99, d: 0.14, t: 0.24 },
        { f: 1046.5, d: 0.35, t: 0.38 },
        { f: 880.0, d: 0.15, t: 0.75 },
        { f: 1046.5, d: 0.15, t: 0.90 },
        { f: 1174.66, d: 0.15, t: 1.05 },
        { f: 1318.51, d: 0.6, t: 1.20 }
      ];

      notes.forEach(({ f, d, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + t;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(this.volume * 0.45, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + d);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + d);
      });
    } catch {
      // ignore audio errors
    }
  }

  // Stop the AniLove cinematic splash intro sound immediately
  public stopAniLoveCinematicIntro() {
    for (const tid of this.introTimeoutIds) {
      clearTimeout(tid);
    }
    this.introTimeoutIds = [];

    if (this.introMasterGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.introMasterGain.gain.cancelScheduledValues(now);
        this.introMasterGain.gain.setValueAtTime(this.introMasterGain.gain.value, now);
        this.introMasterGain.gain.linearRampToValueAtTime(0.0001, now + 0.1);
      } catch {}
    }

    for (const node of this.introNodes) {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch {}
    }
    this.introNodes = [];
  }

  // Rich, ethereal Anime Cinematic Intro fanfare for AppIntroSplash (harmonized chords, chimes, and riser)
  public playAniLoveCinematicIntro(startOffset: number = 0) {
    this.stopAniLoveCinematicIntro();
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.volume * 0.5, ctx.currentTime);
      masterGain.connect(ctx.destination);
      this.introMasterGain = masterGain;

      const now = ctx.currentTime;
      const offset = Math.max(0, startOffset);

      // Warm cinematic ambient chord pads (Cmaj7 -> Fmaj7 -> G -> High Cmaj)
      const padChords = [
        { t: 0, freqs: [130.81, 196.00, 261.63, 329.63], dur: 2.2 }, // Cmaj7
        { t: 2.0, freqs: [174.61, 220.00, 261.63, 349.23], dur: 2.2 }, // Fmaj7
        { t: 4.0, freqs: [196.00, 246.94, 293.66, 392.00], dur: 2.0 }, // G
        { t: 5.5, freqs: [261.63, 329.63, 392.00, 523.25], dur: 2.2 }, // High Cmaj
      ];

      padChords.forEach(chord => {
        const startTime = now + Math.max(0, chord.t - offset);
        if (chord.t + chord.dur <= offset) return;

        chord.freqs.forEach(f => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, startTime);

          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.04, startTime + 0.6);
          gain.gain.setValueAtTime(0.04, startTime + chord.dur - 0.4);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + chord.dur);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(startTime);
          osc.stop(startTime + chord.dur);

          this.introNodes.push(osc);
        });
      });

      // Sparkling anime chime bells arpeggios (delicate glass harp / celesta style)
      const bellNotes = [
        { t: 0.2, f: 523.25 },  // C5
        { t: 0.5, f: 659.25 },  // E5
        { t: 0.9, f: 783.99 },  // G5
        { t: 1.3, f: 1046.50 }, // C6
        { t: 1.7, f: 1318.51 }, // E6
        { t: 2.2, f: 880.00 },  // A5
        { t: 2.6, f: 1046.50 }, // C6
        { t: 3.0, f: 1318.51 }, // E6
        { t: 3.4, f: 1567.98 }, // G6
        { t: 4.1, f: 1174.66 }, // D6
        { t: 4.5, f: 1396.91 }, // F6
        { t: 4.9, f: 1760.00 }, // A6
        { t: 5.4, f: 2093.00 }, // C7 (Climax sparkle on logo lock)
        { t: 5.7, f: 1567.98 }, // G6
        { t: 6.0, f: 1318.51 }, // E6
        { t: 6.3, f: 1046.50 }, // C6
      ];

      bellNotes.forEach(note => {
        const startTime = now + (note.t - offset);
        if (startTime < now) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.f, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.08, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.8);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + 0.8);

        this.introNodes.push(osc);
      });

      // Sub-bass sweep / riser leading to climax at 5.4s
      if (offset < 5.4) {
        const riserStart = now + Math.max(0, 3.8 - offset);
        const riserDur = 1.6;
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(65, riserStart);
        subOsc.frequency.exponentialRampToValueAtTime(130, riserStart + riserDur);

        subGain.gain.setValueAtTime(0, riserStart);
        subGain.gain.linearRampToValueAtTime(0.08, riserStart + riserDur * 0.7);
        subGain.gain.exponentialRampToValueAtTime(0.0001, riserStart + riserDur);

        subOsc.connect(subGain);
        subGain.connect(masterGain);

        subOsc.start(riserStart);
        subOsc.stop(riserStart + riserDur);

        this.introNodes.push(subOsc);
      }
    } catch (err) {
      console.warn('[SoundEffects] Error playing cinematic intro:', err);
    }
  }
}

export const soundEffects = new SoundEngine();
