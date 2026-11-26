import type { Dish } from './config';

export interface XZ {
  x: number;
  z: number;
}

export interface StationDef extends XZ {
  id: string;
  dish: Dish;
  model: string;
  rot: number;
}

export interface SeatDef extends XZ {
  rot: number;
}

export interface TableDef extends XZ {
  id: string;
  model: 'table' | 'picnic_table';
  rot: number;
  seats: SeatDef[];
}

export type UnlockKind = 'station' | 'table' | 'sink' | 'cook' | 'waiter' | 'runner' | 'next_map';

export interface UnlockDef extends XZ {
  id: string;
  kind: UnlockKind;
  /** station id for cooks, table id for tables */
  target?: string;
  cost: number;
  gems?: number;
  title: string;
}

export interface MapDef {
  id: 'barn' | 'truck';
  name: string;
  theme: 'restaurant' | 'beach';
  /** walkable rectangle for the chef */
  play: { minX: number; minZ: number; maxX: number; maxZ: number };
  /** nav rectangle for everyone (includes the street outside) */
  nav: { minX: number; minZ: number; maxX: number; maxZ: number };
  camBounds: { minX: number; minZ: number; maxX: number; maxZ: number };
  start: XZ;
  stations: StationDef[];
  counter: {
    segments: (XZ & { rot: number; model: 'counter_seg' | 'counter_end' })[];
    register: XZ & { rot: number };
    serve: XZ;
    queue: XZ[];
    cash: XZ;
    /** counter tray the chef stocks; guests at the front are served from it */
    pass: XZ & { rot: number };
    /** counter is part of the map scenery (truck hatch) rather than a prop */
    builtIn?: boolean;
  };
  tables: TableDef[];
  sink: XZ & { rot: number; pad: XZ };
  board: XZ & { rot: number; pad: XZ };
  /** bin for food nobody wants, so a full tray of the wrong dish never locks the chef */
  bin: XZ & { pad: XZ };
  /** waypoints from the spawn point to the end of the queue / into the dining room */
  enter: XZ[];
  diningEnter: XZ[];
  exit: XZ[];
  spawn: XZ;
  despawn: XZ;
  /** dish -> work pad offset in front of each station is computed; staff home spots */
  staffHome: XZ;
  unlocks: UnlockDef[];
  startDishes: Dish[];
}

const H = Math.PI / 2;

/** Map 1: a corner burger restaurant. Kitchen along the back (north) wall, counter in the middle, dining room south-east. */
export const BARN: MapDef = {
  id: 'barn',
  name: 'Corner Grill',
  theme: 'restaurant',
  play: { minX: -6.6, minZ: -6.6, maxX: 6.6, maxZ: 6.6 },
  nav: { minX: -18, minZ: -7.2, maxX: 18, maxZ: 11 },
  camBounds: { minX: -4.5, minZ: -4.5, maxX: 4.5, maxZ: 5.5 },
  start: { x: -3.4, z: -4.2 },
  stations: [
    { id: 'grill', dish: 'burger', model: 'st_grill', x: -4.8, z: -6.1, rot: 0 },
    { id: 'soda', dish: 'soda', model: 'st_soda', x: -2.6, z: -6.1, rot: 0 },
    { id: 'fryer', dish: 'fries', model: 'st_fryer', x: -0.4, z: -6.1, rot: 0 },
    { id: 'sundae', dish: 'sundae', model: 'st_sundae', x: 1.8, z: -6.1, rot: 0 },
  ],
  counter: {
    segments: [
      { model: 'counter_end', x: -6.2, z: -2.4, rot: 0 },
      { model: 'counter_seg', x: -5.2, z: -2.4, rot: 0 },
      { model: 'counter_seg', x: -4.0, z: -2.4, rot: 0 },
      { model: 'counter_seg', x: -2.8, z: -2.4, rot: 0 },
      { model: 'counter_seg', x: -1.6, z: -2.4, rot: 0 },
      { model: 'counter_end', x: -0.6, z: -2.4, rot: 0 },
    ],
    register: { x: -3.4, z: -2.45, rot: Math.PI },
    serve: { x: -3.4, z: -3.45 },
    cash: { x: -2.2, z: -2.4 },
    pass: { x: -4.5, z: -2.4, rot: 0 },
    queue: [
      { x: -3.4, z: -1.35 },
      { x: -3.4, z: -0.35 },
      { x: -3.4, z: 0.65 },
      { x: -3.4, z: 1.65 },
      { x: -3.4, z: 2.65 },
      { x: -3.4, z: 3.65 },
      { x: -3.4, z: 4.65 },
      { x: -3.4, z: 5.65 },
    ],
  },
  // the lane between the two table columns fits the chef past both chairs with room to spare
  tables: [
    { id: 't1', model: 'table', x: 1.6, z: -0.4, rot: 0, seats: seatsLR(1.6, -0.4) },
    { id: 't2', model: 'table', x: 4.9, z: -0.4, rot: 0, seats: seatsLR(4.9, -0.4) },
    { id: 't3', model: 'table', x: 1.6, z: 2.6, rot: 0, seats: seatsLR(1.6, 2.6) },
    { id: 't4', model: 'table', x: 4.9, z: 2.6, rot: 0, seats: seatsLR(4.9, 2.6) },
    { id: 't5', model: 'table', x: 4.9, z: 5.4, rot: 0, seats: seatsLR(4.9, 5.4) },
  ],
  sink: { x: 4.3, z: -6.15, rot: 0, pad: { x: 4.3, z: -5.0 } },
  bin: { x: -6.12, z: -6.2, pad: { x: -6.05, z: -5.25 } },
  board: { x: 6.2, z: -3.7, rot: -H, pad: { x: 5.1, z: -3.7 } },
  spawn: { x: -16, z: 8.6 },
  despawn: { x: 17, z: 8.6 },
  enter: [
    { x: -3.4, z: 8.6 },
    { x: -3.4, z: 6.6 },
  ],
  diningEnter: [
    { x: -2.2, z: 8.6 },
    { x: -2.2, z: 6.4 },
    { x: 0.2, z: 5.0 },
  ],
  exit: [
    { x: -2.1, z: 6.6 },
    { x: -2.1, z: 8.6 },
  ],
  staffHome: { x: 0.4, z: -3.6 },
  startDishes: ['burger'],
  unlocks: [
    { id: 'soda', kind: 'station', target: 'soda', cost: 30, x: -2.6, z: -6.1, title: 'Soda Fountain' },
    { id: 't1', kind: 'table', target: 't1', cost: 45, x: 1.6, z: -0.4, title: 'Table' },
    { id: 'sink', kind: 'sink', cost: 35, x: 4.3, z: -6.15, title: 'Dish Sink' },
    { id: 't2', kind: 'table', target: 't2', cost: 80, x: 4.9, z: -0.4, title: 'Table' },
    { id: 'fryer', kind: 'station', target: 'fryer', cost: 120, x: -0.4, z: -6.1, title: 'Fryer' },
    { id: 'cook_grill', kind: 'cook', target: 'grill', cost: 160, x: -4.8, z: -3.7, title: 'Hire Grill Cook' },
    { id: 't3', kind: 'table', target: 't3', cost: 180, x: 1.6, z: 2.6, title: 'Table' },
    { id: 'waiter', kind: 'waiter', cost: 240, x: 0.4, z: -3.6, title: 'Hire Waiter' },
    { id: 't4', kind: 'table', target: 't4', cost: 300, x: 4.9, z: 2.6, title: 'Table' },
    { id: 'sundae', kind: 'station', target: 'sundae', cost: 0, gems: 8, x: 1.8, z: -6.1, title: 'Sundae Bar' },
    { id: 'cook_soda', kind: 'cook', target: 'soda', cost: 360, x: -2.0, z: -3.7, title: 'Hire Soda Cook' },
    { id: 'runner', kind: 'runner', cost: 420, x: -5.6, z: -3.7, title: 'Hire Counter Runner' },
    { id: 't5', kind: 'table', target: 't5', cost: 480, x: 4.9, z: 5.4, title: 'Table' },
    { id: 'cook_fryer', kind: 'cook', target: 'fryer', cost: 560, x: -0.4, z: -3.7, title: 'Hire Fry Cook' },
    { id: 'next', kind: 'next_map', target: 'truck', cost: 650, x: -5.4, z: 4.6, title: 'Open Beach Truck' },
  ],
};

/** Map 2: a food truck parked on the beach. The chef works inside, guests order at the hatch and eat at picnic tables. */
export const TRUCK: MapDef = {
  id: 'truck',
  name: 'Beach Truck',
  theme: 'beach',
  // the chef stays out of the gap behind the truck, where the camera cannot follow
  play: { minX: -5.5, minZ: -5.3, maxX: 8, maxZ: 7 },
  nav: { minX: -20, minZ: -8, maxX: 20, maxZ: 12 },
  camBounds: { minX: -3.5, minZ: -3.5, maxX: 4.5, maxZ: 4.5 },
  start: { x: -3.6, z: -1.6 },
  stations: [
    { id: 'roller', dish: 'hotdog', model: 'st_hotdog', x: -4.85, z: -3.3, rot: H },
    { id: 'soda', dish: 'soda', model: 'st_soda', x: -4.85, z: -1.4, rot: H },
    { id: 'oven', dish: 'pizza', model: 'st_oven', x: -4.85, z: 0.5, rot: H },
    { id: 'sundae', dish: 'sundae', model: 'st_sundae', x: -4.85, z: 2.4, rot: H },
  ],
  counter: {
    builtIn: true,
    segments: [],
    register: { x: -1.95, z: -0.4, rot: -H },
    serve: { x: -2.55, z: -0.4 },
    cash: { x: -1.95, z: 0.6 },
    pass: { x: -1.95, z: -1.45, rot: H },
    queue: [
      { x: -1.15, z: -0.4 },
      { x: -0.15, z: -0.4 },
      { x: 0.85, z: -0.4 },
      { x: 1.85, z: -0.55 },
      { x: 2.85, z: -0.85 },
      { x: 3.85, z: -1.25 },
      { x: 4.85, z: -1.7 },
      { x: 5.85, z: -2.2 },
    ],
  },
  tables: [
    { id: 'p1', model: 'picnic_table', x: 2.6, z: 3.2, rot: 0, seats: seatsNS(2.6, 3.2) },
    { id: 'p2', model: 'picnic_table', x: 5.6, z: 3.2, rot: 0, seats: seatsNS(5.6, 3.2) },
    { id: 'p3', model: 'picnic_table', x: 2.6, z: 6.0, rot: 0, seats: seatsNS(2.6, 6.0) },
    { id: 'p4', model: 'picnic_table', x: 5.6, z: 6.0, rot: 0, seats: seatsNS(5.6, 6.0) },
  ],
  sink: { x: -3.7, z: -4.75, rot: 0, pad: { x: -3.7, z: -3.7 } },
  bin: { x: -2.78, z: -4.85, pad: { x: -2.8, z: -3.8 } },
  board: { x: -1.5, z: 5.8, rot: Math.PI, pad: { x: -1.5, z: 4.8 } },
  spawn: { x: 19, z: -4 },
  despawn: { x: 19, z: 9 },
  enter: [
    { x: 9, z: -3.5 },
    { x: 7.2, z: -3.0 },
  ],
  diningEnter: [
    { x: 9, z: 1.5 },
    { x: 7.5, z: 1.5 },
  ],
  exit: [
    { x: 7.5, z: 1.0 },
    { x: 10, z: 6 },
  ],
  staffHome: { x: -3.6, z: 1.4 },
  startDishes: ['hotdog'],
  unlocks: [
    { id: 'soda', kind: 'station', target: 'soda', cost: 80, x: -4.85, z: -1.4, title: 'Lemonade Tap' },
    { id: 'p1', kind: 'table', target: 'p1', cost: 110, x: 2.6, z: 3.2, title: 'Picnic Table' },
    { id: 'sink', kind: 'sink', cost: 90, x: -3.7, z: -4.75, title: 'Dish Tub' },
    { id: 'oven', kind: 'station', target: 'oven', cost: 240, x: -4.85, z: 0.5, title: 'Pizza Oven' },
    { id: 'p2', kind: 'table', target: 'p2', cost: 280, x: 5.6, z: 3.2, title: 'Picnic Table' },
    { id: 'cook_roller', kind: 'cook', target: 'roller', cost: 340, x: -2.6, z: -2.55, title: 'Hire Hot Dog Cook' },
    { id: 'waiter', kind: 'waiter', cost: 440, x: 1.2, z: 1.8, title: 'Hire Waiter' },
    { id: 'sundae', kind: 'station', target: 'sundae', cost: 0, gems: 10, x: -4.85, z: 2.4, title: 'Sundae Bar' },
    { id: 'p3', kind: 'table', target: 'p3', cost: 460, x: 2.6, z: 6.0, title: 'Picnic Table' },
    { id: 'cook_oven', kind: 'cook', target: 'oven', cost: 560, x: -2.6, z: 1.5, title: 'Hire Pizza Cook' },
    { id: 'p4', kind: 'table', target: 'p4', cost: 700, x: 5.6, z: 6.0, title: 'Picnic Table' },
  ],
};

function seatsLR(x: number, z: number): SeatDef[] {
  return [
    { x: x - 0.95, z, rot: H },
    { x: x + 0.95, z, rot: -H },
  ];
}

function seatsNS(x: number, z: number): SeatDef[] {
  return [
    { x: x - 0.4, z: z - 0.62, rot: 0 },
    { x: x + 0.4, z: z + 0.62, rot: Math.PI },
  ];
}

export const MAPS = { barn: BARN, truck: TRUCK };
