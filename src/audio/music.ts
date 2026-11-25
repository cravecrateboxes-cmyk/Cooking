import { sfx } from './sfx';

/**
 * A light, bouncy kitchen loop synthesised on the fly: plucked melody, round bass, soft offbeat hats and
 * a chord bed, I-vi-IV-V in C at 112 bpm. Scheduled a little ahead so it never stutters.
 */
const BPM = 112;
const STEP = 60 / BPM / 4;
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// chord roots (midi) and the chord tones the melody picks from, per bar
const BARS = [
  { root: 48, tones: [60, 64, 67, 72, 76] },
  { root: 45, tones: [57, 60, 64, 69, 72] },
  { root: 41, tones: [57, 60, 65, 69, 72] },
  { root: 43, tones: [59, 62, 67, 71, 74] },
];
// melody rhythm and contour over one bar of 16 steps: index into the bar's tones, or -1 for a rest
const MOTIF_A = [2, -1, 3, -1, 4, -1, 3, 2, -1, 1, -1, 2, 3, -1, -1, -1];
const MOTIF_B = [4, -1, 4, 3, -1, 2, -1, 1, 2, -1, 3, -1, 2, -1, 1, -1];

export class Music {
  private gain: GainNode | null = null;
  private timer = 0;
  private step = 0;
  private nextAt = 0;
  playing = false;

  start(): void {
    const a = sfx.audio;
    if (!a || this.playing) return;
    if (!this.gain) {
      this.gain = a.ctx.createGain();
      this.gain.connect(a.out);
    }
    this.gain.gain.cancelScheduledValues(a.ctx.currentTime);
    this.gain.gain.setValueAtTime(0, a.ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(0.34, a.ctx.currentTime + 1.2);
    this.playing = true;
    this.nextAt = a.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  stop(): void {
    const a = sfx.audio;
    clearInterval(this.timer);
    this.playing = false;
    if (a && this.gain) {
      this.gain.gain.cancelScheduledValues(a.ctx.currentTime);
      this.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.15);
    }
  }

  private schedule(): void {
    const a = sfx.audio;
    if (!a || !this.gain) return;
    while (this.nextAt < a.ctx.currentTime + 0.25) {
      this.note(a.ctx, a.noise, this.step, this.nextAt);
      this.nextAt += STEP;
      this.step = (this.step + 1) % (16 * 8);
    }
  }

  private note(ctx: AudioContext, noise: AudioBuffer, step: number, t: number): void {
    const out = this.gain;
    if (!out) return;
    const bar = Math.floor(step / 16) % 4;
    const half = Math.floor(step / 64);
    const s = step % 16;
    const chord = BARS[bar];
    // bass: root on the beat, octave pop on the "and" of 2 and 4
    if (s % 4 === 0) this.voice(ctx, out, midi(chord.root - 12 + (s === 8 ? 7 : 0)), t, 0.28, 'triangle', 0.5);
    if (s === 6 || s === 14) this.voice(ctx, out, midi(chord.root), t, 0.12, 'triangle', 0.3);
    // chord bed: soft square stabs on the offbeats
    if (s === 2 || s === 10) for (const n of chord.tones.slice(0, 3)) this.voice(ctx, out, midi(n), t, 0.1, 'square', 0.035);
    // melody: motif A twice then motif B, an octave up in the second half
    const motif = bar % 2 === 0 ? MOTIF_A : MOTIF_B;
    const idx = motif[s];
    if (idx >= 0) this.voice(ctx, out, midi(chord.tones[idx] + (half ? 12 : 0)), t, 0.16, 'sine', 0.2, true);
    // hats
    if (s % 2 === 1) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 8000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(s % 4 === 3 ? 0.06 : 0.03, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(hp).connect(g).connect(out);
      src.start(t, Math.random() * 0.4, 0.05);
    }
  }

  private voice(ctx: AudioContext, out: AudioNode, f: number, t: number, dur: number, type: OscillatorType, vol: number, pluck = false): void {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (pluck ? 1.6 : 1));
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur * 1.7);
    if (pluck) {
      // a quiet partial an octave and a fifth up gives the pluck a marimba-ish shine
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(f * 3, t);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(vol * 0.25, t + 0.005);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6);
      o2.connect(g2).connect(out);
      o2.start(t);
      o2.stop(t + dur);
    }
  }
}

export const music = new Music();
