// 바닥 격자 + A* (ART.md 8.3). 장애물은 고양이 크기만큼 팽창시킨 거리 검사로 막는다.
import { CAT_DIM } from '../data/layouts';
import { staticFree, type Foot, type LayoutGeo, type Vec2 } from './geometry';

export interface Grid {
  g: LayoutGeo; x0: number; z0: number; cols: number; rows: number; cell: number; free: Uint8Array; guest: boolean;
}

export function buildGrid(g: LayoutGeo, guest = false): Grid {
  const cell = CAT_DIM.gridCell;
  const x0 = g.left;
  const z0 = g.hallMinZ;
  const cols = Math.ceil((g.right - x0) / cell);
  const rows = Math.ceil((g.front - z0) / cell);
  const free = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      free[r * cols + c] = staticFree(g, x0 + (c + 0.5) * cell, z0 + (r + 0.5) * cell, undefined, guest) ? 1 : 0;
    }
  }
  return { g, x0, z0, cols, rows, cell, free, guest };
}

export interface Blocker { x: number; z: number; r: number }

const cellX = (G: Grid, c: number) => G.x0 + (c + 0.5) * G.cell;
const cellZ = (G: Grid, r: number) => G.z0 + (r + 0.5) * G.cell;

function blockedBy(bl: readonly Blocker[], x: number, z: number): boolean {
  for (const b of bl) if ((x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r) return true;
  return false;
}

export function pointOk(G: Grid, x: number, z: number, bl: readonly Blocker[], ignore?: Foot): boolean {
  return staticFree(G.g, x, z, ignore, G.guest) && !blockedBy(bl, x, z);
}

export function lineOk(G: Grid, a: Vec2, b: Vec2, bl: readonly Blocker[]): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(len / CAT_DIM.pathSample));
  for (let i = 1; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n;
    const z = a.z + ((b.z - a.z) * i) / n;
    if (!staticFree(G.g, x, z, undefined, G.guest) || blockedBy(bl, x, z)) return false;
  }
  return true;
}

function nearestFree(G: Grid, p: Vec2, bl: readonly Blocker[]): number {
  const c0 = Math.floor((p.x - G.x0) / G.cell);
  const r0 = Math.floor((p.z - G.z0) / G.cell);
  for (let rad = 0; rad < 16; rad++) {
    let best = -1;
    let bd = Infinity;
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const c = c0 + dc;
        const r = r0 + dr;
        if (c < 0 || r < 0 || c >= G.cols || r >= G.rows) continue;
        const i = r * G.cols + c;
        if (!G.free[i] || blockedBy(bl, cellX(G, c), cellZ(G, r))) continue;
        const d = (cellX(G, c) - p.x) ** 2 + (cellZ(G, r) - p.z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

// 재사용 버퍼 (매 경로마다 큰 배열을 만들지 않는다)
let gBuf = new Float32Array(0);
let fromBuf = new Int32Array(0);
let closedBuf = new Uint8Array(0);

/** a → b 경로. 첫 점은 a 다음 지점, 마지막은 b. 길이 없으면 null */
export function findPath(G: Grid, a: Vec2, b: Vec2, bl: readonly Blocker[] = []): Vec2[] | null {
  if (lineOk(G, a, b, bl)) return [{ x: b.x, z: b.z }];
  const n = G.cols * G.rows;
  if (gBuf.length < n) { gBuf = new Float32Array(n); fromBuf = new Int32Array(n); closedBuf = new Uint8Array(n); }
  const s = nearestFree(G, a, bl);
  const t = nearestFree(G, b, bl);
  if (s < 0 || t < 0) return null;
  gBuf.fill(Infinity, 0, n);
  fromBuf.fill(-1, 0, n);
  closedBuf.fill(0, 0, n);
  const tc = t % G.cols;
  const tr = (t / G.cols) | 0;
  const h = (i: number) => {
    const dc = Math.abs((i % G.cols) - tc);
    const dr = Math.abs(((i / G.cols) | 0) - tr);
    return Math.max(dc, dr) + 0.4142 * Math.min(dc, dr);
  };
  // 간단한 이진 힙
  const heap: number[] = [];
  const fs: number[] = [];
  const push = (i: number, f: number) => {
    heap.push(i); fs.push(f);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (fs[p] <= fs[k]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]]; [fs[p], fs[k]] = [fs[k], fs[p]]; k = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const li = heap.pop() as number;
    const lf = fs.pop() as number;
    if (heap.length) {
      heap[0] = li; fs[0] = lf;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && fs[l] < fs[m]) m = l;
        if (r < heap.length && fs[r] < fs[m]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]]; [fs[m], fs[k]] = [fs[k], fs[m]]; k = m;
      }
    }
    return top;
  };
  gBuf[s] = 0;
  push(s, h(s));
  let found = false;
  while (heap.length) {
    const cur = pop();
    if (cur === t) { found = true; break; }
    if (closedBuf[cur]) continue;
    closedBuf[cur] = 1;
    const cc = cur % G.cols;
    const cr = (cur / G.cols) | 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = cc + dc;
        const nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= G.cols || nr >= G.rows) continue;
        const ni = nr * G.cols + nc;
        if (!G.free[ni] || closedBuf[ni]) continue;
        if (dr && dc && (!G.free[cr * G.cols + nc] || !G.free[nr * G.cols + cc])) continue;
        if (bl.length && blockedBy(bl, cellX(G, nc), cellZ(G, nr))) continue;
        const ng = gBuf[cur] + (dr && dc ? 1.4142 : 1);
        if (ng < gBuf[ni]) { gBuf[ni] = ng; fromBuf[ni] = cur; push(ni, ng + h(ni)); }
      }
    }
  }
  if (!found) return null;
  const cells: Vec2[] = [];
  for (let i = t; i !== -1; i = fromBuf[i]) cells.push({ x: cellX(G, i % G.cols), z: cellZ(G, (i / G.cols) | 0) });
  cells.reverse();
  cells.push({ x: b.x, z: b.z });
  // 줄 당기기: 보이는 가장 먼 점으로 건너뛴다
  const out: Vec2[] = [];
  let from: Vec2 = a;
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !lineOk(G, from, cells[j], bl)) j--;
    out.push(cells[j]);
    from = cells[j];
    i = j + 1;
  }
  return out;
}
