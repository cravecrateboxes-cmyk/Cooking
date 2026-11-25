/** Tiny tween runner: a list of time-based callbacks driven by the game loop. */

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inCubic: (t: number) => t * t * t,
  inOutSine: (t: number) => 0.5 - Math.cos(Math.PI * t) / 2,
  outBack: (t: number) => {
    const c1 = 1.9;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * 2 * Math.PI) / 3) + 1;
  },
};

interface Job {
  t: number;
  dur: number;
  delay: number;
  fn: (k: number) => void;
  done?: () => void;
  ease: Ease;
}

export class Tweens {
  private jobs: Job[] = [];

  add(dur: number, fn: (k: number) => void, opts: { ease?: Ease; delay?: number; done?: () => void } = {}): void {
    this.jobs.push({ t: 0, dur: Math.max(1e-4, dur), delay: opts.delay ?? 0, fn, done: opts.done, ease: opts.ease ?? ease.outCubic });
  }

  wait(delay: number, done: () => void): void {
    this.add(0.0001, () => undefined, { delay, done });
  }

  update(dt: number): void {
    // iterate over a snapshot: callbacks may schedule new tweens
    const list = this.jobs;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const j = list[i];
      if (j.delay > 0) {
        j.delay -= dt;
        list[w++] = j;
        continue;
      }
      j.t += dt;
      const k = Math.min(1, j.t / j.dur);
      j.fn(j.ease(k));
      if (k < 1) list[w++] = j;
      else j.done?.();
    }
    list.length = w;
  }

  clear(): void {
    this.jobs.length = 0;
  }
}
