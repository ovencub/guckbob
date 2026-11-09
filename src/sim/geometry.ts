// 레이아웃 데이터 → 좌석·그릇·서비스 지점·충돌 상자 계산 (ART.md 8.2). three·DOM 없음.
import {
  CAT_DIM, DOOR, KITCHEN_LAYOUT as K, QUEUE, SEAT_RULES as R, STAGES, TABLE_KINDS, type TableKind,
} from '../data/layouts';

export interface Vec2 { x: number; z: number }
export interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; kind: string }
export type Foot =
  | { t: 'rect'; x0: number; x1: number; z0: number; z1: number; clear: number }
  | { t: 'circle'; x: number; z: number; r: number; clear: number };

export interface Seat { x: number; z: number; ry: number; bowl: Vec2; approach: Vec2; stool: number }
export interface TableGeo {
  id: number; kind: TableKind; x: number; z: number; w: number; d: number; cap: number;
  seats: Seat[]; service: Array<Vec2 & { ry: number }>;
}
export interface LayoutGeo {
  stage: number; left: number; right: number; back: number; front: number; hallMinZ: number;
  tables: TableGeo[]; colliders: Box[]; feet: Foot[]; stations: Vec2[];
  burners: Vec2[]; passSlots: Vec2[]; stack: Vec2; sink: Vec2; chefZ: number;
  door: Vec2; spawn: Vec2; exit: Vec2; queue: Vec2[]; idle: Vec2[]; pickZ: number;
}

export const FLOOR_RIGHT = 3.1;
const TOP_OVER = 0.06; // 카운터 상판이 앞으로 튀어나온 만큼

export const faceTo = (dx: number, dz: number): number => Math.atan2(dx, dz);

function rectDist(px: number, pz: number, x0: number, x1: number, z0: number, z1: number): number {
  const dx = Math.max(x0 - px, 0, px - x1);
  const dz = Math.max(z0 - pz, 0, pz - z1);
  return Math.hypot(dx, dz);
}

export function footDist(f: Foot, x: number, z: number): number {
  return f.t === 'rect' ? rectDist(x, z, f.x0, f.x1, f.z0, f.z1) : Math.hypot(x - f.x, z - f.z) - f.r;
}

/** 걷는 고양이 중심이 (x,z)에 있을 때 정적 장애물과 안 겹치는가 */
export function staticFree(g: LayoutGeo, x: number, z: number, ignore?: Foot): boolean {
  if (x < g.left + CAT_DIM.walkClear || x > g.right - CAT_DIM.bodyR) return false;
  if (z < g.hallMinZ || z > g.front - CAT_DIM.frontInset) return false;
  for (const f of g.feet) {
    if (f === ignore) continue;
    if (footDist(f, x, z) < f.clear) return false;
  }
  return true;
}

export function burnerSlotsFor(stage: number): Vec2[] {
  const n = STAGES[stage].burnerSlots;
  return K.burnerX.slice(0, n).map((x) => ({ x, z: K.counterZ }));
}

export function computeLayout(stage: number): LayoutGeo {
  const S = STAGES[stage];
  const left = S.left;
  const right = FLOOR_RIGHT;
  const back = K.backWallZ + K.wallT / 2;
  const front = S.front;
  const counterFront = K.counterZ + K.counterD / 2;
  const chefZ = counterFront + K.chefGap;
  const passFront = K.passZ + K.passD / 2 + TOP_OVER;
  const passBack = K.passZ - K.passD / 2 - TOP_OVER;
  const hallMinZ = chefZ + CAT_DIM.sep + CAT_DIM.kitchenGap;
  const burners = burnerSlotsFor(stage);
  const leftmost = Math.min(...burners.map((b) => b.x));
  const stack = { x: leftmost - K.stackGap, z: K.counterZ + 0.05 };
  const sink = { x: leftmost - K.sinkGap, z: K.counterZ };
  const colliders: Box[] = [];
  const feet: Foot[] = [];
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, kind: string) =>
    colliders.push({ x0, x1, y0, y1, z0, z1, kind });

  // 벽: 뒤, 왼쪽
  box(left - K.wallT, right, 0, 2.3, back - K.wallT, back, 'wall');
  box(left - K.wallT, left, 0, 2.3, back - K.wallT, front, 'wall');
  // 주방 조리대(개수대 포함) + 배식대
  const counterX0 = sink.x - K.sinkW / 2;
  box(counterX0, K.counterRight, 0, K.counterH + 0.07, K.counterZ - K.counterD / 2 - TOP_OVER, counterFront + TOP_OVER, 'counter');
  box(K.passX0 - TOP_OVER, K.passX1 + TOP_OVER, 0, K.passTopY, passBack, passFront, 'counter');
  feet.push({ t: 'rect', x0: K.passX0 - TOP_OVER, x1: K.passX1 + TOP_OVER, z0: passBack, z1: passFront, clear: CAT_DIM.walkClear });

  const tables: TableGeo[] = [];
  S.tables.forEach((t, id) => {
    const kd = TABLE_KINDS[t.kind];
    box(t.x - kd.w / 2, t.x + kd.w / 2, R.tableTopY - R.tableTopH / 2, R.tableTopY + R.tableTopH / 2, t.z - kd.d / 2, t.z + kd.d / 2, 'table');
    feet.push({ t: 'rect', x0: t.x - kd.w / 2, x1: t.x + kd.w / 2, z0: t.z - kd.d / 2, z1: t.z + kd.d / 2, clear: CAT_DIM.tableClear });
    const seats: Seat[] = [];
    const fz = kd.d / 2 + R.seatGap;
    for (const side of [-1, 1]) {
      for (let c = 0; c < kd.cols; c++) {
        const cx = (c - (kd.cols - 1) / 2) * R.seatSpacing;
        const sx = t.x + cx;
        const sz = t.z + side * fz;
        box(sx - R.stoolR, sx + R.stoolR, 0, R.stoolH, sz - R.stoolR, sz + R.stoolR, 'stool');
        feet.push({ t: 'circle', x: sx, z: sz, r: R.stoolR * Math.SQRT2, clear: CAT_DIM.walkClear }); // 검사기는 의자를 AABB 로 본다 → 외접원
        seats.push({
          x: sx, z: sz, ry: side < 0 ? 0 : Math.PI,
          bowl: { x: sx, z: t.z + side * (kd.d / 2 - R.bowlInset) },
          approach: { x: sx, z: sz + side * R.approachDists[0] }, stool: feet.length - 1,
        });
      }
    }
    const service: TableGeo['service'] = [];
    for (const side of [1, -1]) {
      const sx = t.x + side * (kd.w / 2 + R.serviceGap);
      service.push({ x: sx, z: t.z, ry: faceTo(-side, 0) });
    }
    tables.push({ id, kind: t.kind, x: t.x, z: t.z, w: kd.w, d: kd.d, cap: kd.seats, seats, service });
  });

  const door = { x: DOOR.x, z: front };
  const spawn = { x: DOOR.x + DOOR.spawnDx, z: front - DOOR.inset };
  const exit = { x: DOOR.x + DOOR.exitDx, z: front - DOOR.inset };
  const qz = front + QUEUE.barrierDz + QUEUE.barrierGap;
  const queue = Array.from({ length: 6 }, (_, i) => ({ x: QUEUE.firstX - i * QUEUE.step, z: qz }));
  const pickZ = passFront + K.serverPickGap;
  const idle = [{ x: 2.35, z: pickZ }, { x: 1.35, z: pickZ }];
  const passSlots: Vec2[] = [];
  for (const rz of K.passRowZ) for (let c = 0; c < K.passCols; c++) passSlots.push({ x: K.passColX0 + c * K.passColStep, z: rz });

  const g: LayoutGeo = {
    stage, left, right, back, front, hallMinZ, tables, colliders, feet, stations: [],
    burners, passSlots, stack, sink, chefZ, door, spawn, exit, queue, idle, pickZ,
  };
  for (const t of tables) {
    for (const s of t.seats) s.approach = pickApproach(g, t, s);
    // 테이블 끝이 막혀 있으면 좌석 진입 지점에서 서빙한다 (그릇은 0.2초 날아간다)
    const ok = t.service.filter((p) => staticFree(g, p.x, p.z));
    t.service = ok.length ? ok : t.seats.map((s) => ({ x: s.approach.x, z: s.approach.z, ry: faceTo(t.x - s.approach.x, t.z - s.approach.z) }));
  }
  return g;
}

/** 좌석 진입 지점: 바깥쪽 → 대각선 → 옆 순서로, 비어 있고 직선으로 들어갈 수 있는 곳 */
function pickApproach(g: LayoutGeo, t: TableGeo, s: Seat): Vec2 {
  const out = s.z > t.z ? 1 : -1;
  const cands: Vec2[] = [];
  for (const a of R.approachDists) {
    const d45 = a * Math.SQRT1_2;
    cands.push(
      { x: s.x, z: s.z + out * a },
      { x: s.x + d45, z: s.z + out * d45 }, { x: s.x - d45, z: s.z + out * d45 },
      { x: s.x + a, z: s.z }, { x: s.x - a, z: s.z },
    );
  }
  const own = g.feet[s.stool];
  for (const c of cands) {
    if (!staticFree(g, c.x, c.z)) continue;
    if (!segmentClear(g, c, s, own)) continue;
    if (g.tables.some((tt) => tt.seats.some((o) => o !== s && Math.hypot(o.x - c.x, o.z - c.z) < CAT_DIM.sep))) continue;
    return c;
  }
  return cands[0];
}

/** 진입 지점 → 의자 직선이 다른 의자·테이블과 닿지 않는가 (자기 의자는 제외) */
export function segmentClear(g: LayoutGeo, a: Vec2, b: Vec2, ignore?: Foot): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(len / CAT_DIM.pathSample));
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n;
    const z = a.z + ((b.z - a.z) * i) / n;
    for (const f of g.feet) {
      if (f === ignore) continue;
      if (footDist(f, x, z) < f.clear) return false;
    }
  }
  return true;
}

export function chefStations(g: LayoutGeo, ownedBurners: number, chefs: number): Array<{ x: number; burners: number[] }> {
  // 화구를 x 순서로 정렬해 오른쪽(배식대 가까운 쪽)부터 주방장마다 최대 2개씩 나눈다
  const idx = Array.from({ length: ownedBurners }, (_, i) => i).sort((a, b) => g.burners[a].x - g.burners[b].x);
  const out: Array<{ x: number; burners: number[] }> = [];
  if (chefs <= 0) return out;
  const take = Math.min(idx.length, chefs * 2);
  const mine = idx.slice(idx.length - take);
  const per = Math.ceil(take / chefs);
  for (let c = 0; c < chefs; c++) {
    const bs = mine.slice(c * per, c * per + per);
    out.push({ x: bs.length ? bs.reduce((s, b) => s + g.burners[b].x, 0) / bs.length : NaN, burners: bs });
  }
  // 맡은 화구가 없는 주방장은 조리대 앞 빈 곳에 선다
  for (const o of out) {
    if (!Number.isNaN(o.x)) continue;
    for (let x = K.counterRight - CAT_DIM.sep / 2; x > g.sink.x; x -= CAT_DIM.sep / 2) {
      const taken = out.some((p) => !Number.isNaN(p.x) && Math.abs(p.x - x) < CAT_DIM.sep + 0.1) || Math.abs(g.sink.x - x) < CAT_DIM.sep + 0.1;
      if (!taken) { o.x = x; break; }
    }
    if (Number.isNaN(o.x)) o.x = K.counterRight;
  }
  return out;
}
