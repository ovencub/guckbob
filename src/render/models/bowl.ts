// 뚝배기·수육 접시 (ART.md 5장, 레퍼런스 makeBowl)
import * as THREE from 'three';
import type { DishKind } from '../canvas2d';
import { M, geo, gradientMap, toon } from '../toon';

export type BowlKind = DishKind | 'empty' | 'burnt';

const bowlProfile = [[0, 0], [0.15, 0], [0.19, 0.025], [0.215, 0.12], [0.228, 0.19], [0.214, 0.205], [0.196, 0.14], [0.15, 0.07], [0, 0.07]]
  .map((p) => new THREE.Vector2(p[0], p[1]));
const bowlGeo = () => geo('bowl', () => new THREE.LatheGeometry(bowlProfile, 22));
const bowlMat = new THREE.MeshToonMaterial({ color: 0x5a3a2e, gradientMap, side: THREE.DoubleSide });
const SOUP: Record<string, number> = { sundae: 0xf2e6cf, spicy: 0xe5533a, dirty: 0x8c6b4c, burnt: 0x2b2a33 };
const soupGeo = () => geo('soup', () => new THREE.CircleGeometry(0.2, 20));
const sliceGeo = () => geo('slice', () => new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10));
const onionGeo = () => geo('onion', () => new THREE.BoxGeometry(0.035, 0.015, 0.02));
const plateGeo = () => geo('plate', () => new THREE.CylinderGeometry(0.25, 0.2, 0.05, 22));
const meatGeo = () => geo('meat', () => new THREE.BoxGeometry(0.1, 0.035, 0.16));

export interface BowlModel extends THREE.Group {
  userData: { soup: THREE.Mesh; tops: THREE.Group; pot: THREE.Group; plate: THREE.Group; kind: BowlKind };
}

export function makeBowl(kind: BowlKind, parent: THREE.Object3D | null, pos?: readonly [number, number, number], scale?: number): BowlModel {
  const g = new THREE.Group() as BowlModel;
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  if (scale) g.scale.setScalar(scale);
  const pot = new THREE.Group();
  g.add(pot);
  M(bowlGeo(), 0, { mat: bowlMat, parent: pot, ol: 0.022 });
  const soup = new THREE.Mesh(soupGeo(), toon(SOUP.sundae));
  soup.rotation.x = -Math.PI / 2;
  soup.position.y = 0.168;
  pot.add(soup);
  const tops = new THREE.Group();
  pot.add(tops);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(sliceGeo(), toon(0x5e3b4a));
    s.position.set(-0.08 + i * 0.08, 0.175, i % 2 ? 0.05 : -0.04);
    tops.add(s);
  }
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(onionGeo(), toon(0x7cc45a));
    s.position.set(-0.11 + i * 0.07, 0.178, 0.09 - (i % 2) * 0.14);
    tops.add(s);
  }
  // 수육: 흰 접시 + 분홍 고기 4조각
  const plate = new THREE.Group();
  g.add(plate);
  M(plateGeo(), 0xfffdf8, { parent: plate, p: [0, 0.025, 0], ol: 0.02 });
  for (let i = 0; i < 4; i++) {
    M(meatGeo(), 0xf2b9a2, { parent: plate, p: [-0.12 + i * 0.08, 0.07, 0], r: [0.25, 0, 0.12 - i * 0.08], ol: 0.012 });
  }
  M(geo('herb', () => new THREE.SphereGeometry(0.035, 8, 6)), 0x7cc45a, { parent: plate, p: [0.16, 0.07, 0.1], ol: 0 });
  g.userData = { soup, tops, pot, plate, kind: 'empty' };
  applyBowl(g, kind);
  if (parent) parent.add(g);
  return g;
}

export function setBowl(g: BowlModel, kind: BowlKind): void {
  if (g.userData.kind !== kind) applyBowl(g, kind);
}

function applyBowl(g: BowlModel, kind: BowlKind): void {
  const u = g.userData;
  u.kind = kind;
  const isPlate = kind === 'suyuk';
  u.pot.visible = !isPlate;
  u.plate.visible = isPlate;
  if (kind === 'empty') { u.soup.visible = false; u.tops.visible = false; return; }
  u.soup.visible = true;
  u.soup.material = toon(SOUP[kind] ?? SOUP.sundae);
  u.soup.scale.setScalar(kind === 'dirty' ? 0.7 : 1);
  u.tops.visible = kind === 'sundae' || kind === 'spicy';
}
