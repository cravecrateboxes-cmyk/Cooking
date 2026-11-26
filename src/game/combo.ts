/**
 * Serving streak: guests paid within a short window of each other chain into a combo, which the game
 * celebrates louder each step. Time is the world's own clock, so it pauses with the game.
 */
export class Combo {
  private last = -Infinity;
  count = 0;

  constructor(private readonly window: number, private readonly cap: number) {}

  /** A guest just paid at `now`; returns the streak including this one (1 = no combo). */
  hit(now: number): number {
    this.count = now - this.last <= this.window ? Math.min(this.count + 1, this.cap) : 1;
    this.last = now;
    return this.count;
  }
}
