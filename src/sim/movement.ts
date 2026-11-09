// 고양이 이동: A* 경로 + 고양이끼리 분리(ART.md 8.3). 한 고양이는 자기 이동이 다른 고양이와
// sep(0.82) 보다 가까워지게 만들지 않는다 → 순서대로 갱신해도 겹침이 생기지 않는다.
import { CAT_DIM, MOVE } from '../data/layouts';
import { staticFree, type Vec2 } from './geometry';
import { findPath, type Blocker } from './grid';
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
        if (dn <= dc) return false;
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

/** goal 까지 경로 설정. free=true 면 정적 장애물 검사 없이 직선 (좌석 출입) */
export function walkTo(s: GameState, c: Cat, goal: Vec2, free = false, blockers: Blocker[] = []): boolean {
  c.goal = { x: goal.x, z: goal.z };
  c.free = free;
  c.blockedT = 0;
  if (free) { c.path = [c.goal]; return true; }
  const p = findPath(gridOf(s.stage), { x: c.x, z: c.z }, goal, blockers);
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
  let nx = c.x + ux * step;
  let nz = c.z + uz * step;
  let moved = posOk(s, c, nx, nz);
  let side = false;
  if (!moved) {
    // 비켜 가기: 진행 방향에서 조금씩 틀어 본다
    for (const deg of MOVE.sidestepDeg) {
      for (const sg of [1, -1]) {
        const a = (sg * deg * Math.PI) / 180;
        const cx = ux * Math.cos(a) - uz * Math.sin(a);
        const cz = ux * Math.sin(a) + uz * Math.cos(a);
        const tx = c.x + cx * step * 0.8;
        const tz = c.z + cz * step * 0.8;
        if (posOk(s, c, tx, tz)) { nx = tx; nz = tz; moved = true; side = true; break; }
      }
      if (moved) break;
    }
  }
  if (moved) {
    const mx = nx - c.x;
    const mz = nz - c.z;
    c.x = nx; c.z = nz;
    c.ry = angleTo(c.ry, Math.atan2(mx, mz), TURN_RATE * dt);
    c.moving = true;
    c.blockedT = side ? c.blockedT + dt * 0.5 : 0;
    if (side && !c.free) {
      // 옆으로 비켰으면 다음 웨이포인트까지 직선이 막혔을 수 있으니 새로 계산
      const g = c.goal;
      walkTo(s, c, g, false);
      c.blockedT += dt * 0.5;
    }
  } else {
    c.blockedT += dt;
    if (c.blockedT > MOVE.stuckReplanSec && !c.free && Math.abs((c.blockedT % MOVE.stuckReplanSec) - dt) < dt) {
      const g = c.goal;
      const bt = c.blockedT;
      walkTo(s, c, g, false, standingBlockers(s, c, 4));
      c.blockedT = bt;
    }
  }
  return false;
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
