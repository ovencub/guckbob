// 테이블·의자·화구 (레퍼런스 table/stool/makeBurner 이식). 좌석 위치는 sim/geometry 가 계산한 값을 그대로 쓴다.
import * as THREE from 'three';
import { SEAT_RULES as R } from '../../data/layouts';
import type { TableGeo } from '../../sim/geometry';
import { makeBowl, type BowlModel } from './bowl';
import { M, blob, cone, cyl, rbox, torus } from '../toon';

export function makeTable(t: TableGeo, parent: THREE.Object3D): THREE.Group {
  const g = new THREE.Group();
  parent.add(g);
  M(rbox(t.w, R.tableTopH, t.d, 0.14), 0xd9975a, { p: [t.x, R.tableTopY, t.z], parent: g });
  const legs = t.w > 2 ? [t.x - t.w / 4, t.x + t.w / 4] : [t.x];
  for (const lx of legs) {
    M(cyl(0.07, 0.07, 0.78, 12), 0x8b5a3c, { p: [lx, 0.4, t.z], ol: 0.025, parent: g });
    M(cyl(0.3, 0.32, 0.04, 18), 0x8b5a3c, { p: [lx, 0.02, t.z], ol: 0.02, parent: g });
  }
  blob(t.x, t.z, Math.max(t.w, t.d) * 0.55, g);
  for (const s of t.seats) {
    M(cyl(0.2, 0.18, R.stoolH, 16), 0xe8604c, { p: [s.x, R.stoolH / 2, s.z], ol: 0.03, parent: g });
    M(cyl(0.23, 0.23, 0.07, 18), 0xf4a08a, { p: [s.x, R.stoolH + 0.035, s.z], ol: 0.025, parent: g });
    blob(s.x, s.z, 0.28, g);
  }
  return g;
}

export interface BurnerModel { g: THREE.Group; flames: THREE.Group; pot: BowlModel; ghost: boolean }

const flameMats = [new THREE.MeshBasicMaterial({ color: 0x6fb7ff }), new THREE.MeshBasicMaterial({ color: 0xff9a3c })];

export function makeBurner(x: number, z: number, y: number, parent: THREE.Object3D, ghost: boolean): BurnerModel {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  if (ghost) {
    const m = new THREE.Mesh(rbox(0.85, 0.08, 0.72, 0.08), new THREE.MeshBasicMaterial({ color: 0x2b2a33, transparent: true, opacity: 0.18 }));
    g.add(m);
    const pot = makeBowl('empty', g, [0, 0.07, 0], 1.35);
    pot.visible = false;
    return { g, flames: new THREE.Group(), pot, ghost: true };
  }
  M(rbox(0.85, 0.09, 0.72, 0.08), 0x3d4248, { parent: g, ol: 0.025 });
  M(torus(0.22, 0.028, 8, 24), 0x22262a, { parent: g, p: [0, 0.06, 0], r: [Math.PI / 2, 0, 0], ol: 0 });
  const flames = new THREE.Group();
  flames.position.y = 0.06;
  g.add(flames);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const f = new THREE.Mesh(cone(0.035, 0.09, 6), flameMats[i % 2]);
    f.position.set(Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.2);
    flames.add(f);
  }
  const pot = makeBowl('sundae', g, [0, 0.07, 0], 1.35);
  return { g, flames, pot, ghost: false };
}
