import { describe, expect, it } from 'vitest';
import { Combo } from './combo';

describe('Combo', () => {
  it('starts at 1 and chains payments inside the window', () => {
    const c = new Combo(6, 9);
    expect(c.hit(0)).toBe(1);
    expect(c.hit(5.9)).toBe(2);
    expect(c.hit(11.8)).toBe(3);
  });
  it('resets after a gap longer than the window', () => {
    const c = new Combo(6, 9);
    c.hit(0);
    c.hit(3);
    expect(c.hit(9.5)).toBe(1);
  });
  it('never passes the cap', () => {
    const c = new Combo(6, 3);
    for (let t = 0; t < 10; t++) c.hit(t);
    expect(c.count).toBe(3);
  });
});
