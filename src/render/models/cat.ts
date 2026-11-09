// 고양이 (ART.md 4장, 레퍼런스 makeCat). 몸통+머리 하나인 콩 모양, 외곽선, 털 무늬 6종.
import * as THREE from 'three';
import { CAT_DIM } from '../../data/layouts';
import { makeBowl, type BowlModel } from './bowl';
import { M, blob, cone, cyl, geo, gradientMap, inkBasic, sphere, torus, whiteBasic } from '../toon';

export const FURS = ['cheese', 'mackerel', 'calico', 'tuxedo', 'cream', 'black'] as const;
export type Fur = (typeof FURS)[number];
const FUR: Record<Fur, string> = { cheese: '#F4B05A', mackerel: '#A9ABB6', calico: '#FFF8EE', tuxedo: '#3B3638', cream: '#F6E1C3', black: '#3B3638' };
export const SCARVES = [0xe8604c, 0x4c8dd9, 0xf2c94c, 0x7cc45a, 0xb57edc, 0xf28c38, 0x5fc7c0, 0xf48fb1] as const;
export type CatRole = 'guest' | 'vip' | 'tourist' | 'chef' | 'server' | 'dish';

export const TAIL_CURVE = new THREE.CatmullRomCurve3(CAT_DIM.tail.map(([x, y, z]) => new THREE.Vector3(x, y, z)));

function furTex(base: string, kind: Fur): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  x.fillStyle = base; x.fillRect(0, 0, 256, 128);
  const dark = kind === 'cheese' ? '#D9853A' : kind === 'mackerel' ? '#6E717E' : kind === 'cream' ? '#E2BE90' : null;
  if (dark) {
    x.strokeStyle = dark; x.lineCap = 'round'; x.lineWidth = 7;
    for (const sx of [52, 64, 76]) { x.beginPath(); x.moveTo(sx, 6); x.lineTo(sx, 30); x.stroke(); }
    for (const u of [0, 128, 192, 256]) {
      for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(u - 14, 48 + k * 16); x.quadraticCurveTo(u, 42 + k * 16, u + 14, 48 + k * 16); x.stroke(); }
    }
  }
  if (kind === 'calico') {
    x.fillStyle = '#F2A24F'; x.beginPath(); x.ellipse(30, 30, 34, 24, 0.3, 0, 7); x.fill(); x.ellipse(170, 60, 40, 30, 0, 0, 7); x.fill();
    x.fillStyle = '#3B3638'; x.beginPath(); x.ellipse(100, 22, 26, 18, 0, 0, 7); x.ellipse(215, 40, 30, 26, 0, 0, 7); x.fill();
  }
  if (kind !== 'mackerel' && kind !== 'black') { x.fillStyle = '#FFF8EE'; x.beginPath(); x.ellipse(64, 104, 40, 34, 0, 0, 7); x.fill(); }
  if (kind === 'tuxedo') { x.fillStyle = '#FFF8EE'; x.beginPath(); x.ellipse(64, 96, 36, 40, 0, 0, 7); x.fill(); }
  return new THREE.CanvasTexture(c);
}

const bodyMats = new Map<Fur, THREE.MeshToonMaterial>();
function bodyMat(f: Fur): THREE.MeshToonMaterial {
  let m = bodyMats.get(f);
  if (!m) { m = new THREE.MeshToonMaterial({ color: 0xffffff, map: furTex(FUR[f], f), gradientMap }); bodyMats.set(f, m); }
  return m;
}
const apronMats = new Map<number, THREE.MeshToonMaterial>();
function apronMat(col: number): THREE.MeshToonMaterial {
  let m = apronMats.get(col);
  if (!m) { m = new THREE.MeshToonMaterial({ color: col, gradientMap, side: THREE.DoubleSide }); apronMats.set(col, m); }
  return m;
}
const flashMat = new THREE.MeshToonMaterial({ color: 0xff6b5b, gradientMap });

export interface CatOpts { fur: Fur; role: CatRole; scarf?: number; badge?: 0 | 1 | 2 }

export interface CatModel {
  g: THREE.Group;
  bodyPivot: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Group;
  earL: THREE.Mesh;
  earR: THREE.Mesh;
  pawL: THREE.Mesh;
  pawR: THREE.Mesh;
  tail: THREE.Group;
  tray: THREE.Group | null;
  trayBowls: BowlModel[];
  pawL0: THREE.Vector3;
  pawR0: THREE.Vector3;
  shadow: THREE.Mesh;
  ph: number;
  role: CatRole;
  flash(on: boolean): void;
}

export function makeCat(o: CatOpts, ph: number): CatModel {
  const g = new THREE.Group();
  const fc = new THREE.Color(FUR[o.fur]).getHex();
  const earCol = o.fur === 'calico' ? 0xf2a24f : fc;
  const bm = bodyMat(o.fur);
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.02;
  g.add(bodyPivot);
  const body = M(sphere(0.42, 28, 20), 0, { mat: bm, p: [0, 0.45, 0], s: [1, 1.08, 0.94], parent: bodyPivot, ol: 0.03 });
  const head = new THREE.Group();
  bodyPivot.add(head);
  M(sphere(0.13, 14, 10), 0xfff8ee, { p: [0, 0.5, 0.36], s: [1.35, 0.85, 0.7], parent: head, ol: 0.018 });
  M(sphere(0.035, 8, 6), 0xff8fa3, { p: [0, 0.565, 0.445], parent: head, ol: 0 });
  const ears: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(sphere(0.05, 10, 8), inkBasic); e.position.set(sx * 0.16, 0.665, 0.372); head.add(e);
    const hl = new THREE.Mesh(sphere(0.016, 6, 5), whiteBasic); hl.position.set(sx * 0.16 + 0.016, 0.683, 0.418); head.add(hl);
    M(sphere(0.06, 10, 8), 0xffb3b8, { p: [sx * 0.27, 0.545, 0.31], s: [1, 0.55, 0.35], parent: head, ol: 0 });
    const ear = M(cone(0.13, 0.24, 12), earCol, { p: [sx * 0.22, 0.885, 0.02], r: [0, 0, -sx * 0.35], parent: head, ol: 0.022 });
    M(cone(0.075, 0.14, 10), 0xffb3b8, { p: [0, -0.02, 0.065], parent: ear, ol: 0 });
    ears.push(ear);
  }
  const mouthGeo = torus(0.028, 0.008, 4, 10, Math.PI);
  for (const mx of [-0.028, 0.028]) {
    const m = new THREE.Mesh(mouthGeo, inkBasic); m.rotation.z = Math.PI; m.position.set(mx, 0.515, 0.452); head.add(m);
  }
  const pawCol = o.role === 'dish' ? 0xffd23f : 0xfff8ee;
  const pawL = M(sphere(0.1, 12, 10), pawCol, { p: [-0.17, 0.15, 0.33], s: [1, 0.8, 1], parent: bodyPivot, ol: 0.02 });
  const pawR = M(sphere(0.1, 12, 10), pawCol, { p: [0.17, 0.15, 0.33], s: [1, 0.8, 1], parent: bodyPivot, ol: 0.02 });
  // 꼬리는 등에 붙어 위로 말린다: 몸 뒤로 0.62 이상 나가지 않게
  const tail = new THREE.Group();
  g.add(tail);
  const tailCol = o.fur === 'tuxedo' || o.fur === 'black' ? 0x3b3638 : o.fur === 'calico' ? 0xf2a24f : fc;
  M(geo('tail', () => new THREE.TubeGeometry(TAIL_CURVE, 18, 0.05, 8, false)), tailCol, { parent: tail, ol: 0.02 });
  const scarf = o.role === 'vip' ? 0xf2c230 : o.scarf;
  if (scarf !== undefined && (o.role === 'guest' || o.role === 'vip' || o.role === 'tourist')) {
    M(torus(0.355, 0.06, 8, 26), scarf, { p: [0, 0.3, 0], r: [Math.PI / 2, 0, 0], parent: bodyPivot, ol: 0.02 });
  }
  const apron = (col: number) => {
    const a = new THREE.Mesh(geo('apron', () => new THREE.CylinderGeometry(0.405, 0.43, 0.38, 22, 1, true, -0.95, 1.9)), apronMat(col));
    a.position.y = 0.24; bodyPivot.add(a);
  };
  if (o.role === 'chef') {
    apron(0xffffff);
    M(cyl(0.17, 0.18, 0.18, 16), 0xffffff, { p: [0, 0.96, 0], parent: head, ol: 0.022 });
    M(sphere(0.22, 16, 12), 0xffffff, { p: [0, 1.12, 0], s: [1, 0.72, 1], parent: head, ol: 0.022 });
  }
  if (o.role === 'server') {
    apron(0x2f4a6e);
    M(torus(0.37, 0.045, 8, 26), 0xf28c38, { p: [0, 0.74, 0], r: [Math.PI / 2 - 0.12, 0, 0], parent: head, ol: 0.018 });
  }
  if (o.role === 'dish') {
    apron(0x9ccbe2);
    M(torus(0.37, 0.045, 8, 26), 0xf48fb1, { p: [0, 0.74, 0], r: [Math.PI / 2 - 0.12, 0, 0], parent: head, ol: 0.018 });
  }
  if (o.role === 'vip') {
    // 선글라스
    for (const sx of [-1, 1]) M(cyl(0.075, 0.075, 0.03, 14), 0x1e1e24, { p: [sx * 0.15, 0.665, 0.4], r: [Math.PI / 2, 0, 0], parent: head, ol: 0.012 });
    M(geo('glassBar', () => new THREE.BoxGeometry(0.16, 0.02, 0.02)), 0x1e1e24, { p: [0, 0.68, 0.41], parent: head, ol: 0 });
  }
  if (o.role === 'tourist') {
    M(geo('pack', () => new THREE.BoxGeometry(0.34, 0.36, 0.16)), 0x6fa8dc, { p: [0, 0.48, -0.42], parent: bodyPivot, ol: 0.02 });
  }
  if (o.badge) {
    M(cyl(0.065, 0.065, 0.025, 14), o.badge === 2 ? 0xf2c230 : 0xc9ced6, { p: [0.16, 0.42, 0.37], r: [Math.PI / 2 - 0.3, 0, 0], parent: bodyPivot, ol: 0.014 });
  }
  let tray: THREE.Group | null = null;
  const trayBowls: BowlModel[] = [];
  // 서버는 쟁반을 머리 위로 든다 → 테이블·손님과 높이가 겹치지 않는다
  if (o.role === 'server') {
    pawL.position.set(-0.27, 0.82, 0.12); pawR.position.set(0.27, 0.82, 0.12);
    tray = new THREE.Group(); tray.position.set(0, CAT_DIM.trayY - 0.02, 0.04); bodyPivot.add(tray);
    M(cyl(0.24, 0.24, 0.03, 20), 0xc9864a, { parent: tray, ol: 0.02 });
    for (let i = 0; i < 3; i++) {
      const b = makeBowl('sundae', tray, [(i - 1) * 0.15, 0.02, i === 1 ? -0.06 : 0.04], 0.62);
      b.visible = false;
      trayBowls.push(b);
    }
  }
  const shadow = blob(0, 0, 0.38, g);
  shadow.position.y = 0.014;
  const flashTargets = [body];
  const cat: CatModel = {
    g, bodyPivot, body, head, earL: ears[0], earR: ears[1], pawL, pawR, tail, tray, trayBowls,
    pawL0: pawL.position.clone(), pawR0: pawR.position.clone(), shadow, ph, role: o.role,
    flash(on) { for (const t of flashTargets) t.material = on ? flashMat : bm; },
  };
  return cat;
}
