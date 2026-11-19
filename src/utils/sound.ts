class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private getCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private beep(freq: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.08, delay = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  snap() {
    this.beep(520, 0.045, 'triangle', 0.07);
    this.beep(780, 0.03, 'sine', 0.05, 0.02);
  }

  wire() {
    this.beep(660, 0.05, 'sine', 0.06);
  }

  toggle(high: boolean) {
    this.beep(high ? 620 : 380, 0.05, 'triangle', 0.06);
  }

  tick() {
    this.beep(980, 0.028, 'square', 0.025);
  }

  error() {
    this.beep(220, 0.14, 'sawtooth', 0.06);
    this.beep(165, 0.18, 'sawtooth', 0.05, 0.11);
  }

  victory() {
    this.beep(523.25, 0.12, 'triangle', 0.08, 0);
    this.beep(659.25, 0.12, 'triangle', 0.08, 0.1);
    this.beep(783.99, 0.14, 'triangle', 0.08, 0.2);
    this.beep(1046.5, 0.28, 'triangle', 0.1, 0.32);
  }
}

export const sound = new SoundEngine();
