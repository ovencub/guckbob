// 가게 건물: 바닥·벽·주방 조리대·배식대·입구·보도 (레퍼런스 장면 이식, 레이아웃 데이터로 크기 결정)
import * as THREE from 'three';
import { DOOR, KITCHEN_LAYOUT as K } from '../../data/layouts';
import { MENUS, type MenuId } from '../../data/menus';
import { TIER_BLUE, TIER_LOCAL, TIER_MICHELIN } from '../../data/tiers';
import type { LayoutGeo } from '../../sim/geometry';
import { rr, textPop, FONT } from '../canvas2d';
import { M, blob, cyl, gradientMap, rbox, sphere } from '../toon';

const PX = 64;

function textPlane(w: number, h: number, worldW: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d') as CanvasRenderingContext2D, w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(worldW, (worldW * h) / w), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
}

export interface ShopOpts { name: string; menus: Record<MenuId, boolean>; tier: number }

export interface ShopModel {
  root: THREE.Group;
  leftGroup: THREE.Group;   // 왼쪽 벽 (확장 때 밀려난다)
  frontGroup: THREE.Group;  // 입구·보도
  floorGroup: THREE.Group;
  dispose(): void;
}

function floorTexture(g: LayoutGeo, x0: number, x1: number, z0: number, z1: number): THREE.CanvasTexture {
  const W = x1 - x0;
  const D = z1 - z0;
  const c = document.createElement('canvas');
  c.width = Math.round(W * PX); c.height = Math.round(D * PX);
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  const zy = (z: number) => (z - z0) * PX;
  const xx = (v: number) => (v - x0) * PX;
  const T = 0.75 * PX;
  for (let i = 0; i * T < c.width; i++) for (let j = 0; j * T < c.height; j++) { x.fillStyle = (i + j) % 2 ? '#C2DFCF' : '#CFE7DA'; x.fillRect(i * T, j * T, T, T); }
  const kz = zy(K.passZ - K.passD / 2 - 0.02);
  x.fillStyle = '#DDE5EA'; x.fillRect(0, 0, c.width, kz);
  x.strokeStyle = 'rgba(120,140,150,.28)'; x.lineWidth = 2;
  for (let gx = 0; gx <= c.width; gx += PX * 0.5) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, kz); x.stroke(); }
  for (let gy = 0; gy <= kz; gy += PX * 0.5) { x.beginPath(); x.moveTo(0, gy); x.lineTo(c.width, gy); x.stroke(); }
  // 작업 구역 선: 주방 통로, 개수대 앞
  x.strokeStyle = '#F7C948'; x.lineWidth = 7;
  const laneZ0 = zy(g.chefZ - 0.39);
  const laneZ1 = zy(g.chefZ + 0.63);
  rr(x, xx(g.stack.x - 0.45), laneZ0, xx(2.92) - xx(g.stack.x - 0.45), laneZ1 - laneZ0, 14); x.stroke();
  rr(x, xx(g.sink.x - 0.63), laneZ0, xx(g.sink.x + 0.63) - xx(g.sink.x - 0.63), laneZ1 - laneZ0, 14); x.stroke();
  // 입구 화살표 + 매트
  x.fillStyle = 'rgba(255,255,255,.92)';
  const ax = xx(DOOR.x - 0.05);
  const ay = zy(g.front - 0.45);
  x.beginPath(); x.moveTo(ax, ay - 34); x.lineTo(ax + 24, ay - 6); x.lineTo(ax + 9, ay - 6); x.lineTo(ax + 9, ay + 26);
  x.lineTo(ax - 9, ay + 26); x.lineTo(ax - 9, ay - 6); x.lineTo(ax - 24, ay - 6); x.closePath(); x.fill();
  x.fillStyle = '#E9C79A'; x.fillRect(xx(DOOR.x - 0.75), zy(g.front - 0.25), 1.4 * PX, 0.25 * PX);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

export function buildShop(g: LayoutGeo, o: ShopOpts, scene: THREE.Object3D): ShopModel {
  const root = new THREE.Group();
  scene.add(root);
  const x0 = g.left - 0.08;
  const x1 = 3.0;
  const z0 = -5.0;
  const z1 = g.front;
  const W = x1 - x0;
  const D = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const floorGroup = new THREE.Group();
  root.add(floorGroup);
  M(rbox(W + 0.2, 0.3, D + 0.2, 0.15), 0xb5d3c3, { p: [cx, -0.15, cz], ol: 0.04, parent: floorGroup });
  const tex = floorTexture(g, x0, x1, z0, z1);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshToonMaterial({ map: tex, gradientMap }));
  pl.rotation.x = -Math.PI / 2; pl.position.set(cx, 0.006, cz); floorGroup.add(pl);

  // 뒤 벽 (징두리 + 벽 + 몰딩) — 왼쪽 벽까지 이어진다
  const backW = W + 0.3;
  const bx = cx - 0.05;
  M(rbox(backW, 0.85, 0.26, 0.06), 0x8fc1a9, { p: [bx, 0.425, -5.05], parent: root });
  M(rbox(backW, 1.45, 0.22, 0.06), 0xfbefd8, { p: [bx, 1.57, -5.07], parent: root });
  M(rbox(backW + 0.06, 0.08, 0.32, 0.03), 0xd9975a, { p: [bx, 0.88, -5.0], ol: 0.025, parent: root });

  // 왼쪽 벽 (그룹째로 밀려난다)
  const leftGroup = new THREE.Group();
  root.add(leftGroup);
  const wx = g.left - 0.13;
  const wl = D + 0.3;
  M(rbox(0.26, 0.85, wl, 0.06), 0x8fc1a9, { p: [wx, 0.425, cz], parent: leftGroup });
  M(rbox(0.22, 1.45, wl, 0.06), 0xfbefd8, { p: [wx - 0.02, 1.57, cz], parent: leftGroup });
  M(rbox(0.32, 0.08, wl + 0.06, 0.03), 0xd9975a, { p: [wx + 0.05, 0.88, cz], ol: 0.025, parent: leftGroup });
  for (const wz of windowZs(g)) {
    M(rbox(0.07, 1.0, 1.9, 0.03), 0xd9975a, { p: [g.left, 1.45, wz], ol: 0.03, parent: leftGroup });
    const win = textPlane(256, 128, 1.8, (x, w, h) => {
      x.fillStyle = '#BFE6F2'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.7)';
      x.beginPath(); x.moveTo(30, h); x.lineTo(90, 0); x.lineTo(120, 0); x.lineTo(60, h); x.fill();
      x.strokeStyle = '#C9864A'; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10); x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
    });
    win.position.set(g.left + 0.045, 1.45, wz); win.rotation.y = Math.PI / 2; leftGroup.add(win);
  }

  // 간판 + 메뉴판
  M(rbox(2.5, 0.68, 0.08, 0.06), 0xc9864a, { p: [0.75, 1.72, -4.91], ol: 0.03, parent: root });
  const sign = textPlane(512, 128, 2.36, (x, w, h) => {
    x.fillStyle = '#FFF4DD'; rr(x, 6, 6, w - 12, h - 12, 16); x.fill();
    const size = Math.min(78, Math.floor(860 / Math.max(4, o.name.length + 1)));
    textPop(x, o.name, w / 2, h / 2 + 4, size, '#E2533B');
  });
  sign.position.set(0.75, 1.72, -4.86); root.add(sign);
  if (o.tier >= TIER_BLUE) {
    M(cyl(0.16, 0.16, 0.04, 18), 0x3d7be0, { p: [2.12, 1.86, -4.84], r: [Math.PI / 2, 0, 0], ol: 0.02, parent: root });
    M(rbox(0.1, 0.32, 0.03, 0.02), 0x3d7be0, { p: [2.06, 1.62, -4.85], r: [0, 0, 0.25], ol: 0.015, parent: root });
    M(rbox(0.1, 0.32, 0.03, 0.02), 0x3d7be0, { p: [2.18, 1.62, -4.85], r: [0, 0, -0.25], ol: 0.015, parent: root });
  }
  M(rbox(1.15, 0.78, 0.06, 0.05), 0x3f5a4e, { p: [g.sink.x, 1.62, -4.92], ol: 0.03, parent: root });
  const board = textPlane(256, 176, 1.05, (x, w, h) => {
    x.fillStyle = '#2F4A40'; x.fillRect(0, 0, w, h); x.fillStyle = '#FFF4DD'; x.font = `30px ${FONT}`; x.textBaseline = 'middle';
    x.textAlign = 'left'; x.fillText('오늘의 메뉴', 18, 30);
    MENUS.forEach((m, i) => {
      const y = 78 + i * 38;
      x.globalAlpha = o.menus[m.id] ? 1 : 0.45; x.font = `27px ${FONT}`;
      x.textAlign = 'left'; x.fillText(m.short === '순대' ? '순대국밥' : m.short === '얼큰' ? '얼큰순대' : m.name, 18, y);
      x.textAlign = 'right'; x.fillText(o.menus[m.id] ? m.price.toLocaleString('ko-KR') : '준비중', w - 16, y);
    });
    x.globalAlpha = 1;
  });
  board.position.set(g.sink.x, 1.62, -4.885); root.add(board);

  // 주방 조리대 + 개수대
  const cX0 = g.sink.x - K.sinkW / 2 + 0.02;
  const mainX0 = g.sink.x + K.sinkW / 2 + 0.03;
  const mainW = K.counterRight - mainX0;
  M(rbox(mainW, K.counterH, K.counterD, 0.08), 0xe3b27a, { p: [mainX0 + mainW / 2, K.counterH / 2, K.counterZ], parent: root });
  M(rbox(mainW + 0.1, 0.07, K.counterD + 0.07, 0.05), 0xd5dde2, { p: [mainX0 + mainW / 2, 0.915, K.counterZ], ol: 0.025, parent: root });
  M(rbox(K.sinkW, K.counterH, K.counterD, 0.08), 0x9ccbe2, { p: [cX0 + K.sinkW / 2 - 0.02, K.counterH / 2, K.counterZ], parent: root });
  M(rbox(K.sinkW + 0.07, 0.07, K.counterD + 0.07, 0.05), 0xd5dde2, { p: [g.sink.x, 0.915, K.counterZ], ol: 0.025, parent: root });
  M(rbox(0.95, 0.05, 0.62, 0.08), 0x5f7480, { p: [g.sink.x, 0.955, K.counterZ + 0.02], ol: 0.02, parent: root });
  M(cyl(0.035, 0.035, 0.42, 10), 0xb8c2c8, { p: [g.sink.x, 1.15, K.counterZ - 0.38], ol: 0.02, parent: root });
  M(cyl(0.03, 0.03, 0.28, 10), 0xb8c2c8, { p: [g.sink.x, 1.34, K.counterZ - 0.26], r: [Math.PI / 2, 0, 0], ol: 0.02, parent: root });
  // 배식대
  const pw = K.passX1 - K.passX0;
  const pcx = (K.passX0 + K.passX1) / 2;
  M(rbox(pw, K.passH, K.passD, 0.08), 0xe3b27a, { p: [pcx, K.passH / 2, K.passZ], parent: root });
  M(rbox(pw + 0.12, 0.07, K.passD + 0.12, 0.05), 0xf6ddb8, { p: [pcx, K.passTopY - 0.035, K.passZ], ol: 0.025, parent: root });

  // 입구·보도·차단봉·화분 (그룹째로 앞으로 밀려난다)
  const frontGroup = new THREE.Group();
  root.add(frontGroup);
  const fz = g.front;
  const sw = Math.max(W + 0.6, 3.0 - g.queue[5].x + 1.2);
  const swx = Math.min(cx, (3.4 + g.queue[5].x - 0.8) / 2);
  M(rbox(sw, 0.18, 2.1, 0.12), 0xd7dde1, { p: [swx, -0.12, fz + 1.05], ol: 0.04, parent: frontGroup });
  M(rbox(sw, 0.08, 0.22, 0.05), 0xb9c3c9, { p: [swx, 0.0, fz + 0.12], ol: 0.03, parent: frontGroup });
  const dx0 = DOOR.x - DOOR.halfW;
  const dx1 = DOOR.x + DOOR.halfW;
  M(cyl(0.06, 0.06, 2.1, 10), 0x8b5a3c, { p: [dx0, 1.05, fz], ol: 0.025, parent: frontGroup });
  M(cyl(0.06, 0.06, 2.1, 10), 0x8b5a3c, { p: [dx1, 1.05, fz], ol: 0.025, parent: frontGroup });
  M(rbox(DOOR.halfW * 2 + 0.25, 0.1, 0.14, 0.04), 0x8b5a3c, { p: [DOOR.x, 2.1, fz], ol: 0.025, parent: frontGroup });
  const noren = textPlane(256, 96, 1.62, (x, w, h) => {
    x.fillStyle = '#2D4A6B'; x.fillRect(0, 0, w, h); x.fillStyle = '#F4E3C6';
    [w / 3, (2 * w) / 3].forEach((sx) => x.fillRect(sx - 2, h * 0.55, 4, h));
    textPop(x, '국 밥', w / 2, h * 0.42, 44, '#FFFDF8');
  });
  (noren.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
  noren.position.set(DOOR.x, 1.78, fz); frontGroup.add(noren);
  if (o.tier >= TIER_MICHELIN) {
    const plaque = textPlane(256, 96, 1.2, (x, w, h) => {
      x.fillStyle = '#FFF4DD'; rr(x, 4, 4, w - 8, h - 8, 18); x.fill(); x.strokeStyle = '#2B2A33'; x.lineWidth = 6; x.stroke();
      textPop(x, '★★★', w / 2, h / 2 + 2, 54, '#FFC93C');
    });
    plaque.position.set(DOOR.x, 2.45, fz + 0.02); frontGroup.add(plaque);
  }
  // 차단봉: 줄 앞쪽 0.5칸
  const barZ = g.queue[0].z - 0.5;
  const posts = [g.queue[0].x + 0.55, ...g.queue.slice(0, 5).map((q) => q.x - 0.55)];
  for (const sx of posts) {
    M(cyl(0.035, 0.035, 0.62, 8), 0xd9a441, { p: [sx, 0.3, barZ], ol: 0.02, parent: frontGroup });
    M(cyl(0.11, 0.12, 0.04, 12), 0xd9a441, { p: [sx, 0.02, barZ], ol: 0.02, parent: frontGroup });
  }
  const ropeL = posts[0] - posts[posts.length - 1];
  M(cyl(0.022, 0.022, ropeL, 6), 0xc8443a, { p: [(posts[0] + posts[posts.length - 1]) / 2, 0.55, barZ], r: [0, 0, Math.PI / 2], ol: 0, parent: frontGroup });
  // 화분: 보도 오른쪽 (동네 맛집부터 하나 더)
  const plants = o.tier >= TIER_LOCAL ? [3.45, 4.2] : [3.45];
  for (const px of plants) {
    M(cyl(0.22, 0.17, 0.36, 14), 0xc9864a, { p: [px, 0.18, fz + 0.75], ol: 0.03, parent: frontGroup });
    M(sphere(0.34, 16, 12), 0x6db86a, { p: [px, 0.62, fz + 0.75], s: [1, 1.1, 1], ol: 0.03, parent: frontGroup });
    M(sphere(0.22, 14, 10), 0x82c97a, { p: [px + 0.15, 0.92, fz + 0.8], ol: 0.03, parent: frontGroup });
    blob(px, fz + 0.75, 0.3, frontGroup);
  }
  return {
    root, leftGroup, frontGroup, floorGroup,
    dispose() {
      root.removeFromParent();
      tex.dispose();
      root.traverse((ob) => {
        const m = ob as THREE.Mesh;
        if (m.isMesh && (m.material as THREE.MeshBasicMaterial).map && m.material !== undefined) {
          const mat = m.material as THREE.MeshBasicMaterial;
          if (mat.map && mat.map !== tex) mat.map.dispose();
        }
      });
    },
  };
}

function windowZs(g: LayoutGeo): number[] {
  const out: number[] = [];
  for (let z = 2.0; z < g.front - 1.2; z += 5.0) out.push(z);
  return out;
}
