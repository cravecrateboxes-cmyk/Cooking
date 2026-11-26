/**
 * Every sound is synthesised with WebAudio at play time: no sample files, nothing to download. Each call
 * gets a little pitch and timing variation so repeated pickups never sound like a machine gun.
 */
export type Sound =
  | 'pop'
  | 'coin'
  | 'cash'
  | 'serve'
  | 'pickup'
  | 'unlock'
  | 'step'
  | 'plate'
  | 'gem'
  | 'whoosh'
  | 'pay'
  | 'click'
  | 'deny'
  | 'level'
  | 'sizzle'
  | 'ding'
  | 'wash'
  | 'combo';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = true;
  private last = new Map<Sound, number>();
  private coinStreak = 0;
  private coinStreakT = 0;

  /** The audio context and master bus, once a gesture has started audio (the music shares them). */
  get audio(): { ctx: AudioContext; out: GainNode; noise: AudioBuffer } | null {
    return this.ctx && this.master && this.noise ? { ctx: this.ctx, out: this.master, noise: this.noise } : null;
  }

  /** Must be called from a user gesture. */
  resume(): void {
    if (!this.ctx) {
      const AC = window.AudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 8;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.12;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slide = 1): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(dur: number, vol: number, freq: number, q = 1, at = 0, type: BiquadFilterType = 'bandpass'): void {
    const c = this.ctx;
    if (!c || !this.master || !this.noise) return;
    const t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.3);
    s.stop(t + dur + 0.02);
  }

  play(name: Sound, intensity = 1): void {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const gap = name === 'coin' || name === 'pickup' ? 0.03 : name === 'step' ? 0.12 : 0.02;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    this.last.set(name, now);
    const v = 0.94 + Math.random() * 0.12;
    switch (name) {
      case 'pop':
        this.tone(520 * v, 0.09, 'sine', 0.35, 0, 1.9);
        break;
      case 'pickup':
        this.tone(660 * v, 0.07, 'triangle', 0.22, 0, 1.5);
        break;
      case 'coin': {
        // rising pitch while coins keep streaming in
        if (now - this.coinStreakT > 0.5) this.coinStreak = 0;
        this.coinStreakT = now;
        this.coinStreak = Math.min(this.coinStreak + 1, 14);
        const f = 1180 * Math.pow(1.03, this.coinStreak) * v;
        this.tone(f, 0.06, 'square', 0.06);
        this.tone(f * 1.5, 0.12, 'sine', 0.16, 0.035);
        break;
      }
      case 'cash':
        this.hiss(0.08, 0.25, 3200 * v, 1.2);
        this.tone(900 * v, 0.05, 'triangle', 0.1);
        break;
      case 'pay':
        this.tone(1320, 0.07, 'square', 0.06);
        this.tone(1760, 0.18, 'sine', 0.2, 0.06);
        this.hiss(0.12, 0.12, 5000, 0.8, 0.02);
        break;
      case 'serve':
        this.tone(440 * v, 0.08, 'triangle', 0.25, 0, 1.6);
        this.tone(880 * v, 0.1, 'sine', 0.15, 0.05);
        break;
      case 'ding':
        this.tone(1568, 0.5, 'sine', 0.22);
        this.tone(2093, 0.45, 'sine', 0.1, 0.01);
        break;
      case 'plate':
        this.tone(1900 * v, 0.06, 'triangle', 0.12);
        this.hiss(0.05, 0.1, 6000, 2);
        break;
      case 'wash':
        this.hiss(0.25, 0.14, 900 * v, 0.7, 0, 'lowpass');
        this.tone(700 * v, 0.12, 'sine', 0.1, 0.05, 1.6);
        break;
      case 'step':
        this.hiss(0.05, 0.06 * intensity, 380 * v, 1.5, 0, 'lowpass');
        break;
      case 'sizzle':
        this.hiss(0.35, 0.05, 4200 * v, 0.5, 0, 'highpass');
        break;
      case 'whoosh':
        this.hiss(0.22, 0.14, 1200 * v, 0.6);
        break;
      case 'click':
        this.tone(760 * v, 0.05, 'triangle', 0.2, 0, 1.3);
        break;
      case 'deny':
        this.tone(220, 0.12, 'square', 0.08, 0, 0.8);
        this.tone(180, 0.14, 'square', 0.08, 0.1, 0.8);
        break;
      case 'gem':
        [1318, 1661, 1975, 2637].forEach((f, i) => this.tone(f * v, 0.25, 'sine', 0.14, i * 0.05));
        break;
      case 'unlock':
        // bright major arpeggio with a soft thump underneath
        this.tone(110, 0.3, 'sine', 0.5, 0, 0.5);
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.32, 'triangle', 0.2, i * 0.055));
        this.hiss(0.4, 0.12, 2500, 0.5, 0.25);
        break;
      case 'combo': {
        // three quick notes that climb a whole tone with every step of the streak (intensity = step)
        const base = 587 * Math.pow(2, (Math.min(intensity, 9) - 2) / 6);
        [1, 1.26, 1.5].forEach((m, i) => this.tone(base * m, 0.16, 'triangle', 0.18, i * 0.06));
        this.tone(base * 2, 0.3, 'sine', 0.12, 0.18);
        break;
      }
      case 'level':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, 'square', 0.07, i * 0.08));
        [784, 1046, 1318].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.16, 0.35 + i * 0.03));
        break;
    }
  }
}

export const sfx = new Sfx();
