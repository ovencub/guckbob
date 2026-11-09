// 1단계 정적 장면 (레퍼런스와 같은 구도). ?scene=ref 로 언제든 다시 볼 수 있다.
import * as THREE from 'three';
import { SEAT_RULES } from '../data/layouts';
import { computeLayout } from '../sim/geometry';
import { bubble, drawDish, gauge, textPop } from './canvas2d';
import { makeBowl } from './models/bowl';
import { makeCat, type CatOpts } from './models/cat';
import { makeBurner, makeTable } from './models/props';
import { buildShop } from './models/shop';
import type { Renderer } from './renderer';
import { cSprite } from './sprites';

export function buildStaticScene(r: Renderer): (t: number) => void {
  const g = computeLayout(0);
  buildShop(g, { name: '고양이 국밥', menus: { sundae: true, spicy: false, suyuk: false }, tier: 1 }, r.scene);
  r.camera.setBounds(-3.15, 3.15, -5.25, g.front + 1.35);
  for (const t of g.tables) makeTable(t, r.scene);
  makeBurner(g.burners[0].x, g.burners[0].z, 0.95, r.scene, false);
  makeBurner(g.burners[1].x, g.burners[1].z, 0.95, r.scene, false);
  makeBurner(g.burners[2].x, g.burners[2].z, 0.95, r.scene, true);
  for (let i = 0; i < 4; i++) makeBowl('empty', r.scene, [g.stack.x, 0.95 + i * 0.085, g.stack.z], 1.0);
  for (let i = 0; i < 3; i++) makeBowl('dirty', r.scene, [g.sink.x - 0.12 + i * 0.12, 0.98 + i * 0.07, g.sink.z + 0.05 + (i % 2) * 0.08], 1.0).rotation.z = 0.25 - i * 0.15;
  const cats: ReturnType<typeof makeCat>[] = [];
  const sit = (ti: number, si: number, o: CatOpts) => {
    const s = g.tables[ti].seats[si];
    const c = makeCat(o, cats.length);
    c.g.position.set(s.x, SEAT_RULES.seatY, s.z); c.g.rotation.y = s.ry; c.shadow.position.y = -SEAT_RULES.seatY + 0.014;
    r.scene.add(c.g); cats.push(c);
    return s;
  };
  const s1 = sit(0, 0, { fur: 'mackerel', role: 'guest', scarf: 0xe8604c });
  sit(1, 0, { fur: 'cheese', role: 'guest', scarf: 0x4c8dd9 });
  sit(1, 1, { fur: 'tuxedo', role: 'guest', scarf: 0xf2c94c });
  sit(1, 3, { fur: 'cream', role: 'guest', scarf: 0x7cc45a });
  const s3a = sit(2, 0, { fur: 'calico', role: 'guest', scarf: 0xb57edc });
  const s3b = sit(2, 3, { fur: 'black', role: 'guest', scarf: 0xf28c38 });
  for (const s of [s3a, s3b, g.tables[1].seats[0]]) makeBowl('sundae', r.scene, [s.bowl.x, 0.885, s.bowl.z], 1.0);
  const chef = makeCat({ fur: 'cheese', role: 'chef' }, 9);
  chef.g.position.set((g.burners[0].x + g.burners[1].x) / 2, 0, g.chefZ); chef.g.rotation.y = Math.PI; r.scene.add(chef.g); cats.push(chef);
  const server = makeCat({ fur: 'mackerel', role: 'server', badge: 1 }, 10);
  server.g.position.set(2.45, 0, -1.0); server.trayBowls[1].visible = true; r.scene.add(server.g); cats.push(server);
  ['cream', 'cheese', 'tuxedo'].forEach((f, i) => {
    const c = makeCat({ fur: f as CatOpts['fur'], role: 'guest', scarf: [0xe8604c, 0x4c8dd9, 0x7cc45a][i] }, 11 + i);
    c.g.position.set(g.queue[i].x, 0, g.queue[i].z); c.g.rotation.y = Math.PI / 2; r.scene.add(c.g); cats.push(c);
  });
  makeBowl('sundae', r.scene, [g.passSlots[1].x, 0.89, g.passSlots[1].z], 1.1);
  makeBowl('spicy', r.scene, [g.passSlots[2].x, 0.89, g.passSlots[2].z], 1.1);
  const b1 = cSprite(256, 224, 1.05, r.scene);
  b1.sp.position.set(s1.x, 1.95, s1.z);
  b1.draw('a', (x) => { bubble(x, 12, 8, 232, 180, true); drawDish(x, 'sundae', 128, 86, 120); gauge(x, 40, 148, 176, 0.75); });
  const b2 = cSprite(384, 224, 1.05, r.scene);
  b2.sp.position.set(g.tables[1].x, 2.25, g.tables[1].z - 1.0);
  b2.draw('a', (x) => {
    bubble(x, 12, 8, 360, 180, true); drawDish(x, 'sundae', 108, 86, 108); drawDish(x, 'spicy', 268, 86, 108);
    textPop(x, '×1', 172, 118, 34, '#FFFFFF'); textPop(x, '×1', 334, 118, 34, '#FFFFFF'); gauge(x, 48, 150, 288, 0.45);
  });
  const done = cSprite(220, 220, 0.82, r.scene);
  done.sp.position.set(g.burners[0].x, 1.85, g.burners[0].z);
  done.draw('d', (x) => {
    x.fillStyle = '#FFD34D'; x.strokeStyle = '#2B2A33'; x.lineWidth = 8; x.beginPath(); x.arc(110, 110, 86, 0, 7); x.fill(); x.stroke();
    x.strokeStyle = '#E2533B'; x.lineWidth = 14; x.beginPath(); x.arc(110, 110, 72, -Math.PI / 2, Math.PI * 0.8); x.stroke(); textPop(x, '완료!', 110, 112, 50, '#FFFFFF');
  });
  return (t: number) => {
    for (const c of cats) {
      c.body.scale.y = 1.08 * (1 + 0.022 * Math.sin(t * 3 + c.ph));
      c.tail.rotation.y = 0.35 * Math.sin(t * 2.4 + c.ph);
    }
    void THREE;
  };
}
