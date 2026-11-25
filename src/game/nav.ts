import * as THREE from 'three';

export interface Rect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** Coarse walkability grid with A* and string-pulled paths. Used by customers and staff. */
export class NavGrid {
  readonly cell = 0.4;
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;
  private readonly g: Float32Array;
  private readonly from: Int32Array;
  private readonly stamp: Uint32Array;
  private readonly closed: Uint32Array;
  private run = 1;

  constructor(readonly bounds: Rect, obstacles: Rect[], pad = 0.28) {
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / this.cell);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / this.cell);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    for (const o of obstacles) this.block(o, pad);
  }

  block(o: Rect, pad: number): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.bounds.minX + (c + 0.5) * this.cell;
        const z = this.bounds.minZ + (r + 0.5) * this.cell;
        if (x > o.minX - pad && x < o.maxX + pad && z > o.minZ - pad && z < o.maxZ + pad) this.blocked[r * this.cols + c] = 1;
      }
    }
  }

  private idx(x: number, z: number): number {
    const c = Math.floor((x - this.bounds.minX) / this.cell);
    const r = Math.floor((z - this.bounds.minZ) / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  private free(i: number): boolean {
    return i >= 0 && this.blocked[i] === 0;
  }

  private nearestFree(i: number): number {
    if (this.free(i)) return i;
    const c0 = i % this.cols;
    const r0 = Math.floor(i / this.cols);
    for (let rad = 1; rad < 8; rad++) {
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          const r = r0 + dr;
          const c = c0 + dc;
          if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) continue;
          const j = r * this.cols + c;
          if (this.blocked[j] === 0) return j;
        }
      }
    }
    return i;
  }

  private center(i: number, out: THREE.Vector3): THREE.Vector3 {
    const c = i % this.cols;
    const r = Math.floor(i / this.cols);
    return out.set(this.bounds.minX + (c + 0.5) * this.cell, 0, this.bounds.minZ + (r + 0.5) * this.cell);
  }

  /** Is the straight segment a->b clear of blocked cells? */
  clear(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / (this.cell * 0.35));
    for (let s = 0; s <= steps; s++) {
      const t = s / Math.max(1, steps);
      const i = this.idx(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
      if (i >= 0 && this.blocked[i]) return false;
    }
    return true;
  }

  path(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
    if (this.clear(a, b)) return [b.clone()];
    const start = this.nearestFree(this.idx(a.x, a.z));
    const goal = this.nearestFree(this.idx(b.x, b.z));
    if (start < 0 || goal < 0) return [b.clone()];
    const run = ++this.run;
    const open: number[] = [start];
    const f = new Map<number, number>();
    this.g[start] = 0;
    this.stamp[start] = run;
    this.from[start] = -1;
    const gc = goal % this.cols;
    const gr = Math.floor(goal / this.cols);
    const h = (i: number) => {
      const dc = Math.abs((i % this.cols) - gc);
      const dr = Math.abs(Math.floor(i / this.cols) - gr);
      return Math.max(dc, dr) + 0.41 * Math.min(dc, dr);
    };
    f.set(start, h(start));
    let found = false;
    let guard = 0;
    while (open.length && guard++ < 20000) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (f.get(open[k])! < f.get(open[bi])!) bi = k;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) {
        found = true;
        break;
      }
      this.closed[cur] = run;
      const cc = cur % this.cols;
      const cr = Math.floor(cur / this.cols);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const c = cc + dc;
          const r = cr + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const j = r * this.cols + c;
          if (this.blocked[j] || this.closed[j] === run) continue;
          // no corner cutting through blocked diagonals
          if (dr && dc && (this.blocked[cr * this.cols + c] || this.blocked[r * this.cols + cc])) continue;
          const ng = this.g[cur] + (dr && dc ? 1.414 : 1);
          if (this.stamp[j] !== run || ng < this.g[j]) {
            this.stamp[j] = run;
            this.g[j] = ng;
            this.from[j] = cur;
            f.set(j, ng + h(j));
            if (!open.includes(j)) open.push(j);
          }
        }
      }
    }
    if (!found) return [b.clone()];
    const cells: THREE.Vector3[] = [];
    for (let i = goal; i !== -1 && i !== start; i = this.from[i]) cells.push(this.center(i, new THREE.Vector3()));
    cells.reverse();
    cells.push(b.clone());
    // string pulling: skip any point we can see past
    const out: THREE.Vector3[] = [];
    let anchor = a.clone();
    let k = 0;
    while (k < cells.length) {
      let far = k;
      for (let m = cells.length - 1; m > k; m--) {
        if (this.clear(anchor, cells[m])) {
          far = m;
          break;
        }
      }
      out.push(cells[far]);
      anchor = cells[far];
      k = far + 1;
    }
    return out;
  }
}
