// 주방 뷰: 화구(조리 링·완료!·탐)·배식대 국밥·그릇 더미·개수대 (ART.md 5장, 6장)
import * as THREE from 'three';
import { KITCHEN } from '../../data/balance';
import { KITCHEN_LAYOUT as K } from '../../data/layouts';
import type { LayoutGeo } from '../../sim/geometry';
import { sinkCap } from '../../sim/state';
import type { GameState } from '../../sim/types';
import { bubble, drawDish, rr, textPop } from '../canvas2d';
import { makeBowl, setBowl, type BowlModel } from '../models/bowl';
import { makeBurner, type BurnerModel } from '../models/props';
import { cSprite, setSpriteScale, type CSprite } from '../sprites';
import { hitMat } from './tables';

const STACK_SHOW = 6;
const PILE_SHOW = 6;

export class KitchenView {
  private burners: BurnerModel[] = [];
  private rings: CSprite[] = [];
  private pass: BowlModel[] = [];
  private stack: BowlModel[] = [];
  private pile: BowlModel[] = [];
  private countSp: CSprite | null = null;
  private fullSp: CSprite | null = null;
  private objs: THREE.Object3D[] = [];
  private g: LayoutGeo | null = null;
  readonly passHidden = new Map<number, number>(); // slot → 이 시각까지 숨김 (날아오는 중)
  constructor(private root: THREE.Object3D, readonly hits: THREE.Object3D[]) {}

  private keep<T extends THREE.Object3D>(o: T): T { this.objs.push(o); return o; }

  build(s: GameState, g: LayoutGeo): void {
    this.dispose();
    this.g = g;
    g.burners.forEach((b, i) => {
      const owned = i < s.burners;
      const bm = makeBurner(b.x, b.z, K.burnerY, this.root, !owned);
      this.keep(bm.g);
      this.burners.push(bm);
      const ring = cSprite(220, 220, 0.82, this.root);
      ring.sp.position.set(b.x, 1.85, b.z);
      ring.sp.visible = false;
      this.keep(ring.sp);
      this.rings.push(ring);
      if (!owned) {
        ring.sp.visible = true;
        ring.sp.position.y = 1.2;
        setSpriteScale(ring, 0.5);
        ring.draw('plus', (x) => {
          x.fillStyle = '#FFFDF8'; x.strokeStyle = '#2B2A33'; x.lineWidth = 12; x.beginPath(); x.arc(110, 110, 80, 0, 7); x.fill(); x.stroke();
          textPop(x, '+', 110, 114, 120, '#F7C948');
        });
      }
      if (owned) {
        const hit = this.keep(new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, 1.6), hitMat));
        hit.position.set(b.x, 1.1, b.z + 0.35);
        hit.userData = { kind: 'burner', id: i };
        this.root.add(hit);
        this.hits.push(hit);
      }
    });
    for (const p of g.passSlots) {
      const b = makeBowl('sundae', this.root, [p.x, K.passTopY, p.z], 1.1);
      b.visible = false;
      this.pass.push(this.keep(b));
    }
    const ph = this.keep(new THREE.Mesh(new THREE.BoxGeometry(K.passX1 - K.passX0 + 0.3, 1.6, K.passD + 0.9), hitMat));
    ph.position.set((K.passX0 + K.passX1) / 2, 0.9, K.passZ + 0.15);
    ph.userData = { kind: 'pass', id: 0 };
    this.root.add(ph);
    this.hits.push(ph);
    for (let i = 0; i < STACK_SHOW; i++) {
      // 엎어 쌓은 깨끗한 그릇: 밝은 바깥면이 보이게
      const b = makeBowl('empty', this.root, [g.stack.x, 1.16 + i * 0.075, g.stack.z], 1.0);
      b.rotation.x = Math.PI;
      this.stack.push(this.keep(b));
    }
    for (let i = 0; i < PILE_SHOW; i++) {
      const b = makeBowl('dirty', this.root, [g.sink.x - 0.16 + (i % 3) * 0.16, 0.98 + Math.floor(i / 3) * 0.09 + (i % 2) * 0.02, g.sink.z + 0.02 + (i % 2) * 0.1], 1.0);
      b.rotation.z = 0.25 - (i % 3) * 0.15;
      this.pile.push(this.keep(b));
    }
    this.countSp = cSprite(120, 100, 0.36, this.root);
    this.countSp.sp.position.set(g.stack.x, 1.78, g.stack.z);
    this.keep(this.countSp.sp);
    this.fullSp = cSprite(200, 140, 0.55, this.root);
    this.fullSp.sp.position.set(g.sink.x, 1.75, g.sink.z);
    this.fullSp.draw('full', (x) => { bubble(x, 10, 8, 180, 100, true); textPop(x, 'FULL', 100, 60, 52, '#E2533B'); });
    this.keep(this.fullSp.sp);
    const sh = this.keep(new THREE.Mesh(new THREE.BoxGeometry(K.sinkW + 0.2, 2.2, 1.7), hitMat));
    sh.position.set(g.sink.x, 1.1, g.sink.z + 0.35);
    sh.userData = { kind: 'sink', id: 0 };
    this.root.add(sh);
    this.hits.push(sh);
  }

  dispose(): void {
    for (const o of this.objs) {
      o.removeFromParent();
      const i = this.hits.indexOf(o); if (i >= 0) this.hits.splice(i, 1);
    }
    this.objs = []; this.burners = []; this.rings = []; this.pass = []; this.stack = []; this.pile = [];
  }

  burnerObj(i: number): THREE.Object3D | null { return this.burners[i]?.ghost ? null : this.burners[i]?.g ?? null; }

  burnerPos(i: number, out: THREE.Vector3): THREE.Vector3 { const b = this.g!.burners[i]; return out.set(b.x, K.burnerY + 0.1, b.z); }
  passPos(i: number, out: THREE.Vector3): THREE.Vector3 { const p = this.g!.passSlots[i]; return out.set(p.x, K.passTopY, p.z); }
  sinkPos(out: THREE.Vector3): THREE.Vector3 { return out.set(this.g!.sink.x, 1.0, this.g!.sink.z); }
  stackPos(out: THREE.Vector3): THREE.Vector3 { return out.set(this.g!.stack.x, 1.0, this.g!.stack.z); }

  update(s: GameState, now: number, t: number): void {
    const ds = s.dayState;
    this.burners.forEach((bm, i) => {
      if (bm.ghost) return;
      const b = ds?.burners[i];
      const ring = this.rings[i];
      const phase = b?.phase ?? 'empty';
      bm.pot.visible = phase !== 'empty';
      bm.flames.visible = phase === 'cooking';
      if (b && phase !== 'empty') setBowl(bm.pot, phase === 'burnt' ? 'burnt' : b.menu);
      if (phase === 'cooking') bm.flames.rotation.y = t * 3;
      bm.g.position.x = this.g!.burners[i].x + (phase === 'burnt' ? Math.sin(t * 50) * 0.02 : 0);
      ring.sp.visible = phase !== 'empty';
      if (!b || phase === 'empty') return;
      if (phase === 'cooking') {
        const p = Math.min(1, b.t / b.dur);
        ring.draw(`c${b.menu}${Math.round(p * 40)}`, (x) => {
          x.fillStyle = '#FFFDF8'; x.strokeStyle = '#2B2A33'; x.lineWidth = 8; x.beginPath(); x.arc(110, 110, 86, 0, 7); x.fill(); x.stroke();
          x.strokeStyle = '#5CC46B'; x.lineWidth = 16; x.beginPath(); x.arc(110, 110, 70, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); x.stroke();
          drawDish(x, b.menu, 110, 118, 92);
        });
        setSpriteScale(ring, 1);
      } else if (phase === 'done') {
        const chef = b.by >= 0;
        const p = chef ? 1 : Math.max(0, 1 - b.t / KITCHEN.burnSec);
        ring.draw(`d${Math.round(p * 40)}${chef ? 'c' : ''}`, (x) => {
          x.fillStyle = '#FFD34D'; x.strokeStyle = '#2B2A33'; x.lineWidth = 8; x.beginPath(); x.arc(110, 110, 86, 0, 7); x.fill(); x.stroke();
          if (!chef) { x.strokeStyle = '#E2533B'; x.lineWidth = 14; x.beginPath(); x.arc(110, 110, 72, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); x.stroke(); }
          textPop(x, '완료!', 110, 112, 50, '#FFFFFF');
        });
        setSpriteScale(ring, 1 + 0.08 * Math.abs(Math.sin(t * 10)));
      } else {
        ring.draw('burnt', (x) => {
          x.fillStyle = '#4A4650'; x.strokeStyle = '#2B2A33'; x.lineWidth = 8; x.beginPath(); x.arc(110, 110, 86, 0, 7); x.fill(); x.stroke();
          textPop(x, '탔어요', 110, 112, 44, '#FFB3A6');
        });
        setSpriteScale(ring, 0.9);
      }
    });
    this.pass.forEach((b, i) => {
      const d = ds?.pass[i];
      b.visible = !!d && (this.passHidden.get(i) ?? 0) <= now;
      if (d) setBowl(b, d.menu);
    });
    const clean = ds ? ds.clean : s.bowls;
    this.stack.forEach((b, i) => { b.visible = i < Math.min(clean, STACK_SHOW); });
    this.countSp?.draw(String(clean), (x) => {
      x.fillStyle = clean === 0 ? '#E2533B' : '#2B2A33'; rr(x, 6, 10, 108, 80, 30); x.fill();
      x.fillStyle = '#FFFDF8'; x.font = '56px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(clean), 60, 54);
    });
    const dirty = ds ? ds.sink : 0;
    this.pile.forEach((b, i) => { b.visible = i < Math.min(dirty, PILE_SHOW); });
    if (this.fullSp) this.fullSp.sp.visible = !!ds && dirty >= sinkCap(s);
  }
}
