// 고양이 이동: A* 경로 + 고양이끼리 분리(ART.md 8.3). 한 고양이는 자기 이동이 다른 고양이와
// sep(0.82) 보다 가까워지게 만들지 않는다 → 순서대로 갱신해도 겹침이 생기지 않는다.
import { CAT_DIM, MOVE } from '../data/layouts';
import { staticFree, type Vec2 } from './geometry';
import { findPath, lineOk, type Blocker } from './grid';
import { geoOf, gridOf } from './state';
import type { Cat, GameState } from './types';

const SEP2 = CAT_DIM.sep * CAT_DIM.sep;
const TURN_RATE = Math.PI / MOVE.turnSec;

/** 홀 바닥에서 다른 고양이와 부딪힐 수 있는 상태인가 */
export function inHall(c: Cat): boolean {
  if (c.kind === 'chef' || c.kind === 'dish') return false;
  return c.state !== 'queue' && c.state !== 'gone' && c.state !== 'spawnWait';
}

export function angleTo(from: number, to: number, maxStep: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

export function nearestOther(s: GameState, c: Cat, x: number, z: number): number {
  const ds = s.dayState!;
  let best = Infinity;
  for (const o of ds.cats) {
    if (o === c || !inHall(o)) continue;
    const d = (o.x - x) ** 2 + (o.z - z) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

let lastBlocker = -1;

function posOk(s: GameState, c: Cat, x: number, z: number): boolean {
  if (!c.free && !staticFree(geoOf(s.stage), x, z)) return false;
  const ds = s.dayState!;
  for (const o of ds.cats) {
    if (o === c || !inHall(o)) continue;
    // 렌더러가 이전 틱과 현재 틱 사이를 보간하므로 두 위치 모두에서 떨어져 있어야 한다
    for (let k = 0; k < 2; k++) {
      const ox = k ? o.px : o.x;
      const oz = k ? o.pz : o.z;
      const dn = (ox - x) ** 2 + (oz - z) ** 2;
      if (dn < SEP2) {
        // 이미 가까운 상태라면 멀어지는 움직임만 허용
        const dc = (ox - c.x) ** 2 + (oz - c.z) ** 2;
        if (dn <= dc) { lastBlocker = o.id; return false; }
      }
    }
  }
  return true;
}

/** 서 있는 다른 고양이들을 장애물로 (경로 재계산용) */
export function standingBlockers(s: GameState, c: Cat, range: number): Blocker[] {
  const out: Blocker[] = [];
  for (const o of s.dayState!.cats) {
    if (o === c || !inHall(o) || o.moving) continue;
    if (Math.abs(o.x - c.x) > range || Math.abs(o.z - c.z) > range) continue;
    out.push({ x: o.x, z: o.z, r: CAT_DIM.sep });
  }
  return out;
}

/** 경로 계산용 장애물: 근처 고양이 + (똑똑한 서버) 손님이 앞으로 지나갈 자리 예측.
 *  자기 위치·목표 근처는 비워 둔다 (안 그러면 출발·도착이 막혀 길이 없어진다) */
export function routeBlockers(s: GameState, c: Cat, goal: Vec2): Blocker[] {
  const out: Blocker[] = [];
  const keep = (x: number, z: number) => Math.hypot(x - c.x, z - c.z) > CAT_DIM.sep && Math.hypot(x - goal.x, z - goal.z) > CAT_DIM.sep;
  for (const o of s.dayState!.cats) {
    if (o === c || !inHall(o)) continue;
    if (Math.abs(o.x - c.x) > MOVE.blockerRange || Math.abs(o.z - c.z) > MOVE.blockerRange) continue;
    if (keep(o.x, o.z)) out.push({ x: o.x, z: o.z, r: CAT_DIM.sep });
    if (c.lookSec > 0 && o.kind === 'guest' && o.goal && o.speed > 0) {
      // 손님이 lookSec 동안 걸어갈 길 위의 점들
      let budget = o.speed * c.lookSec;
      let px = o.x; let pz = o.z;
      for (const wp of o.path.length ? o.path : [o.goal]) {
        const seg = Math.hypot(wp.x - px, wp.z - pz);
        const n = Math.ceil(Math.min(seg, budget) / MOVE.predictStep);
        for (let i = 1; i <= n; i++) {
          const k = Math.min(1, (i * MOVE.predictStep) / Math.max(seg, 1e-6));
          const x = px + (wp.x - px) * k; const z = pz + (wp.z - pz) * k;
          if (keep(x, z)) out.push({ x, z, r: CAT_DIM.sep * MOVE.predictShrink });
        }
        budget -= seg;
        if (budget <= 0) break;
        px = wp.x; pz = wp.z;
      }
    }
  }
  return out;
}

/** 근처 모든 고양이(움직이는 것 포함)를 장애물로 */
export function nearbyBlockers(s: GameState, c: Cat, range: number): Blocker[] {
  const out: Blocker[] = [];
  for (const o of s.dayState!.cats) {
    if (o === c || !inHall(o)) continue;
    if (Math.abs(o.x - c.x) > range || Math.abs(o.z - c.z) > range) continue;
    out.push({ x: o.x, z: o.z, r: CAT_DIM.sep });
  }
  return out;
}

/** 남은 경로 길이 */
export function remaining(c: Cat): number {
  if (!c.goal) return 0;
  let d = 0;
  let px = c.x;
  let pz = c.z;
  for (const p of c.path) { d += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; }
  if (!c.path.length) d = Math.hypot(c.goal.x - c.x, c.goal.z - c.z);
  return d;
}


/** goal 까지 경로 설정. free=true 면 정적 장애물 검사 없이 직선 (좌석 출입) */
export function walkTo(s: GameState, c: Cat, goal: Vec2, free = false, blockers: Blocker[] = []): boolean {
  c.goal = { x: goal.x, z: goal.z };
  c.free = free;
  c.blockedT = 0;
  c.bestD = Infinity;
  if (free) { c.path = [c.goal]; return true; }
  let p = findPath(gridOf(s.stage), { x: c.x, z: c.z }, goal, blockers);
  if (!p && blockers.length) p = findPath(gridOf(s.stage), { x: c.x, z: c.z }, goal, []);
  if (!p) { c.path = [c.goal]; return false; }
  c.path = p;
  return true;
}

/** 한 틱 이동. 반환: 목표 도착 */
export function stepWalk(s: GameState, c: Cat, dt: number): boolean {
  c.moving = false;
  if (!c.goal) return true;
  let wp = c.path[0] ?? c.goal;
  let dx = wp.x - c.x;
  let dz = wp.z - c.z;
  let dist = Math.hypot(dx, dz);
  while (dist < MOVE.arriveEps && c.path.length > 1) {
    c.path.shift();
    wp = c.path[0];
    dx = wp.x - c.x; dz = wp.z - c.z; dist = Math.hypot(dx, dz);
  }
  if (dist < MOVE.arriveEps && c.path.length <= 1) {
    // 마지막 몇 cm 도 다른 고양이와 간격을 지킬 때만 딱 맞춘다
    if (posOk(s, c, c.goal.x, c.goal.z)) { c.x = c.goal.x; c.z = c.goal.z; }
    c.path = []; c.goal = null; c.blockedT = 0;
    return true;
  }
  const step = Math.min(dist, c.speed * dt);
  const ux = dx / dist;
  const uz = dz / dist;
  const fx = ux;
  const fz = uz;
  c.passT = Math.max(0, c.passT - dt);
  let nx = c.x + ux * step;
  let nz = c.z + uz * step;
  lastBlocker = -1;
  let moved = posOk(s, c, nx, nz);
  const firstBlocker = lastBlocker;
  let side = false;
  // 좌석 출입(직선 구간)에서는 옆걸음 금지: 정적 검사를 안 하므로 옆 의자로 밀려날 수 있다
  if (!moved && !c.free) {
    // 막은 고양이 기준으로 비켜 갈 쪽을 정하고(한동안 유지) 그쪽으로만 옆걸음 → 좌우로 떨지 않는다
    const o = firstBlocker >= 0 ? s.dayState!.cats.find((k) => k.id === firstBlocker) : undefined;
    if (o) choosePassSide(c, o, fx, fz);
    if (!c.passSide) c.passSide = 1;
    for (const sg of [c.passSide, -c.passSide]) {
      for (const deg of MOVE.sidestepDeg) {
        const a = (sg * deg * Math.PI) / 180;
        const cx = fx * Math.cos(a) - fz * Math.sin(a);
        const cz = fx * Math.sin(a) + fz * Math.cos(a);
        const tx = c.x + cx * step * MOVE.sideSpeed;
        const tz = c.z + cz * step * MOVE.sideSpeed;
        if (posOk(s, c, tx, tz)) { nx = tx; nz = tz; moved = true; side = true; break; }
      }
      if (moved) { if (sg !== c.passSide) { c.passSide = sg; c.passT = MOVE.passHoldSec; } break; }
    }
  }
  c.blockedBy = moved ? -1 : firstBlocker;
  if (moved) {
    c.x = nx; c.z = nz;
    // 얼굴은 가려는 방향을 본다 (옆걸음 때마다 몸이 돌아가 떨려 보이지 않게)
    c.ry = angleTo(c.ry, Math.atan2(fx, fz), TURN_RATE * dt);
    c.moving = true;
    void side;
  }
  // 끼임 = 남은 경로 길이가 줄지 않은 시간 (옆걸음 왕복도 끼임으로 본다)
  const gd = remaining(c);
  if (gd < c.bestD - MOVE.progressEps) { c.bestD = gd; c.blockedT = 0; }
  else c.blockedT += dt;
  const rp = c.replanSec || MOVE.stuckReplanSec;
  // 막히면 rp 간격으로 다시 계산 (똑똑한 서버일수록 자주, 손님 예측 포함)
  if (!c.free && c.blockedT >= rp && Math.floor(c.blockedT / rp) !== Math.floor((c.blockedT - dt) / rp)) {
    const bt = c.blockedT; const bd = c.bestD;
    walkTo(s, c, c.goal!, false, c.lookSec > 0 || c.kind === 'server' ? routeBlockers(s, c, c.goal!) : nearbyBlockers(s, c, 4));
    c.blockedT = bt; c.bestD = Math.min(bd, remaining(c) + MOVE.progressEps);
  }
  return false;
}

/** 비켜 갈 쪽 정하기: 상대가 왼쪽에 있으면 오른쪽으로. 정면이면 오른쪽(서로 같은 규칙 → 엇갈려 지나감). 정하면 한동안 유지 */
function choosePassSide(c: Cat, o: Cat, ux: number, uz: number): void {
  if (c.passT > 0 && c.passSide) return;
  const lat = (o.x - c.x) * -uz + (o.z - c.z) * ux; // +면 상대가 왼쪽
  c.passSide = Math.abs(lat) < 0.08 ? -1 : lat > 0 ? -1 : 1;
  c.passT = MOVE.passHoldSec;
}

/** 길을 막고 있을 때 비켜 설 자리: 상대(와 상대가 갈 다음 지점)에서 가장 먼 빈 자리. 가까운 반경부터 */
export function asideSpot(s: GameState, c: Cat, other: Cat): Vec2 | null {
  const g = geoOf(s.stage);
  const ahead = other.path[0] ?? other.goal ?? { x: other.x, z: other.z };
  for (const r of MOVE.dodgeRadii) {
    let best: Vec2 | null = null;
    let bestScore = -Infinity;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const p = { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r };
      if (!staticFree(g, p.x, p.z) || !spotClear(s, p.x, p.z, c)) continue;
      if (!lineOk(gridOf(s.stage), { x: c.x, z: c.z }, p, [])) continue;
      const score = Math.min(Math.hypot(p.x - other.x, p.z - other.z), segDist(p, other, ahead));
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best && bestScore >= CAT_DIM.sep) return best;
  }
  return null;
}

function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x; const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

/** 직선 이동 (보도의 웨이팅 줄 등 장애물 없는 곳) */
export function stepStraight(c: Cat, to: Vec2, speed: number, dt: number): boolean {
  const dx = to.x - c.x;
  const dz = to.z - c.z;
  const d = Math.hypot(dx, dz);
  c.moving = false;
  if (d < MOVE.arriveEps) { c.x = to.x; c.z = to.z; return true; }
  const st = Math.min(d, speed * dt);
  c.x += (dx / d) * st; c.z += (dz / d) * st;
  c.ry = angleTo(c.ry, Math.atan2(dx, dz), TURN_RATE * dt);
  c.moving = true;
  return false;
}

export function faceToward(c: Cat, x: number, z: number, dt: number): void {
  c.ry = angleTo(c.ry, Math.atan2(x - c.x, z - c.z), TURN_RATE * dt);
}

/** (x,z) 근처에 다른 홀 고양이가 없는가 (등장·일어서기 전 확인) */
export function spotClear(s: GameState, x: number, z: number, except?: Cat): boolean {
  for (const o of s.dayState!.cats) {
    if (o === except || !inHall(o)) continue;
    if ((o.x - x) ** 2 + (o.z - z) ** 2 < SEP2) return false;
    if ((o.px - x) ** 2 + (o.pz - z) ** 2 < SEP2) return false;
  }
  return true;
}

/** 순간이동·등장: 보간하지 않게 이전 위치도 같이 옮긴다 */
export function place(c: Cat, x: number, z: number): void {
  c.x = x; c.z = z; c.px = x; c.pz = z;
}
