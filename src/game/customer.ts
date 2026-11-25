import * as THREE from 'three';
import type { Rng } from './rng';
import type { Dish } from './config';
import type { NavGrid } from './nav';
import { Walker } from './walker';
import type { Bubble } from '../ui/bubble';

export const GUEST_COLOURS = ['#ff4b55', '#3fa9f5', '#5ccf54', '#ff8a2b', '#8a5cf5', '#ff79b4', '#22c3b0', '#ffb020', '#4f6cff', '#e8443a'];
export const VIP_COLOUR = '#ffc531';

export interface OrderLine {
  dish: Dish;
  want: number;
  got: number;
}

export type GuestState =
  | 'arriving'
  | 'queue'
  | 'ordering'
  | 'toSeat'
  | 'seated'
  | 'eating'
  | 'leaving'
  | 'gone';

/** A guest: walks in, orders, waits, pays, leaves. The world decides what they do next; this class remembers. */
export class Customer extends Walker {
  state: GuestState = 'arriving';
  readonly order: OrderLine[] = [];
  readonly vip: boolean;
  readonly dineIn: boolean;
  queueSlot = -1;
  tableId = '';
  seatIndex = -1;
  /** seconds since the order was placed */
  waited = 0;
  eatLeft = 0;
  /** value to pay, computed when the order completes */
  bill = 0;
  /** showed the grumpy emote already */
  grumbled = false;
  bubble!: Bubble;

  constructor(nav: NavGrid, rng: Rng, vip: boolean, dineIn: boolean, walk: number) {
    const colour = vip ? VIP_COLOUR : GUEST_COLOURS[rng.int(GUEST_COLOURS.length)];
    super(colour, nav, walk * rng.range(0.92, 1.1), vip ? 1.06 : rng.range(0.94, 1.04));
    this.vip = vip;
    this.dineIn = dineIn;
    // VIPs wear the crown; some regulars wear a hat or a scarf so the crowd isn't all alike
    if (vip) this.char.wear('hat', 'cos_hat_crown');
    else if (rng.chance(0.22)) this.char.wear('hat', rng.chance(0.6) ? 'cos_hat_cap' : 'cos_hat_cowboy');
    if (!vip && rng.chance(0.15)) this.char.wear('outfit', 'cos_fit_scarf');
  }

  setOrder(menu: Dish[], size: number, rng: Rng): void {
    this.order.length = 0;
    for (let i = 0; i < size; i++) {
      const d = menu[rng.int(menu.length)];
      const line = this.order.find((l) => l.dish === d);
      if (line) line.want++;
      else this.order.push({ dish: d, want: 1, got: 0 });
    }
  }

  wants(d: Dish): boolean {
    return this.order.some((l) => l.dish === d && l.got < l.want);
  }

  get remaining(): number {
    let n = 0;
    for (const l of this.order) n += l.want - l.got;
    return n;
  }

  get itemCount(): number {
    let n = 0;
    for (const l of this.order) n += l.want;
    return n;
  }

  receive(d: Dish): void {
    const l = this.order.find((x) => x.dish === d && x.got < x.want);
    if (l) l.got++;
  }

  /** Walk a list of fixed waypoints, then pathfind to the goal. */
  route(points: THREE.Vector3[], goal: THREE.Vector3 | null, done: () => void): void {
    if (!goal) {
      this.follow(points, done);
      return;
    }
    this.follow(points, () => this.goTo(goal, done));
  }
}
