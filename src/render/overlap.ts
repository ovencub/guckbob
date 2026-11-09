// 겹침 검사 (레퍼런스 overlapNow·overlapReport 이식, ART.md 8.5).
// 고양이 = 몸통 구(r 0.40) + 앞발 구(r 0.1) + 꼬리 표본점(r 0.05) + 쟁반(r 0.24). 고정 물체 = 레이아웃 충돌 상자(AABB).
// 자기가 앉은 의자는 제외. 0.02칸 이하는 외곽선 두께 안이라 통과로 본다.
import * as THREE from 'three';
import { CAT_DIM } from '../data/layouts';
import type { Box } from '../sim/geometry';
import type { Cat } from '../sim/types';
import { TAIL_CURVE, type CatModel } from './models/cat';

export interface Hit { who: string; part: string; what: string; pen: number }
export const OVERLAP_LIMIT = 0.02;

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const TAIL_K = [0.25, 0.5, 0.75, 1].map((k) => TAIL_CURVE.getPoint(k));

function boxDist(b: Box, p: THREE.Vector3): number {
  const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1);
  const dy = Math.max(b.y0 - p.y, 0, p.y - b.y1);
  const dz = Math.max(b.z0 - p.z, 0, p.z - b.z1);
  return Math.hypot(dx, dy, dz);
}

function shapes(m: CatModel, out: Array<{ p: THREE.Vector3; r: number; part: string }>): void {
  m.g.updateMatrixWorld(true);
  out.length = 0;
  out.push({ p: m.body.getWorldPosition(new THREE.Vector3()), r: CAT_DIM.bodyR, part: '몸' });
  out.push({ p: m.pawL.getWorldPosition(new THREE.Vector3()), r: CAT_DIM.pawR, part: '왼발' });
  out.push({ p: m.pawR.getWorldPosition(new THREE.Vector3()), r: CAT_DIM.pawR, part: '오른발' });
  for (const tp of TAIL_K) out.push({ p: tp.clone().applyMatrix4(m.tail.matrixWorld), r: CAT_DIM.tailR, part: '꼬리' });
  if (m.tray) out.push({ p: m.tray.getWorldPosition(new THREE.Vector3()), r: CAT_DIM.trayR, part: '쟁반' });
}

export function overlapNow(cats: Array<{ c: Cat; m: CatModel; name: string; seat?: { x: number; z: number } }>, colliders: readonly Box[]): Hit[] {
  const hits: Hit[] = [];
  const sh: Array<{ p: THREE.Vector3; r: number; part: string }> = [];
  for (const { c, m, name, seat } of cats) {
    if (!m.g.visible || c.state === 'queue') continue;
    shapes(m, sh);
    const px = m.g.position.x;
    const pz = m.g.position.z;
    for (const b of colliders) {
      // 넓은 범위 먼저 거른다 (고양이 최대 반경 0.7)
      if (px < b.x0 - 1 || px > b.x1 + 1 || pz < b.z0 - 1 || pz > b.z1 + 1) continue;
      if (b.kind === 'stool' && seat) {
        // 자기 의자(앉으러 가는·앉은·일어나는 중)는 제외
        const cx = (b.x0 + b.x1) / 2;
        const cz = (b.z0 + b.z1) / 2;
        if (Math.hypot(cx - seat.x, cz - seat.z) < 0.05) continue;
      }
      for (const s of sh) {
        const pen = s.r - boxDist(b, s.p);
        if (pen > 0) hits.push({ who: name, part: s.part, what: b.kind, pen });
      }
    }
  }
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      const A = cats[i];
      const B = cats[j];
      if (!A.m.g.visible || !B.m.g.visible || A.c.state === 'queue' || B.c.state === 'queue') continue;
      A.m.body.getWorldPosition(_a);
      B.m.body.getWorldPosition(_b);
      const pen = 2 * CAT_DIM.bodyR - _a.distanceTo(_b);
      if (pen > 0) hits.push({ who: A.name, part: '몸', what: B.name, pen });
    }
  }
  void _v;
  return hits;
}

/** 최악 관통 깊이 누적기 */
export class OverlapLog {
  worst = new Map<string, number>();
  frames = 0;
  add(hits: Hit[]): void {
    this.frames++;
    for (const h of hits) {
      const k = `${h.who}·${h.part}→${h.what}`;
      if ((this.worst.get(k) ?? 0) < h.pen) this.worst.set(k, h.pen);
    }
  }
  report(): Array<[string, number]> {
    return [...this.worst.entries()].map(([k, v]) => [k, +v.toFixed(3)] as [string, number]).sort((a, b) => b[1] - a[1]);
  }
  over(): Array<[string, number]> { return this.report().filter(([, v]) => v > OVERLAP_LIMIT); }
}
