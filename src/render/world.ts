// 3D 월드: 단계별 가게를 짓고, 뷰들을 갱신하고, sim 이벤트를 연출로 바꾼다
import * as THREE from 'three';
import { TIMING } from '../data/view';
import { MENU_BY_ID, MENU_IDS } from '../data/menus';
import type { LayoutGeo } from '../sim/geometry';
import { geoOf } from '../sim/state';
import type { GameState, SimEvent } from '../sim/types';
import { buildShop, type ShopModel } from './models/shop';
import { OverlapLog, overlapNow } from './overlap';
import type { Renderer } from './renderer';
import { CatsView } from './views/cats';
import { FxView } from './views/fx';
import { KitchenView } from './views/kitchen';
import { TablesView } from './views/tables';
import { fmtMoney } from '../ui/hud';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class World {
  readonly root = new THREE.Group();
  readonly hits: THREE.Object3D[] = [];
  readonly cats: CatsView;
  readonly tables: TablesView;
  readonly kitchen: KitchenView;
  readonly fx: FxView;
  shop: ShopModel | null = null;
  geo: LayoutGeo | null = null;
  private builtKey = '';
  now = 0;
  overlap: OverlapLog | null = null;
  private steamAcc = 0;
  private expand: { t: number; dl: number; df: number } | null = null;
  onPaid: (amount: number, pos: THREE.Vector3) => void = () => {};
  onReview: (score: number) => void = () => {};

  constructor(private r: Renderer) {
    r.scene.add(this.root);
    this.cats = new CatsView(this.root);
    this.tables = new TablesView(this.root, this.hits);
    this.kitchen = new KitchenView(this.root, this.hits);
    this.fx = new FxView(this.root);
  }

  /** 가게 구조가 바뀌면(확장·화구·이름·메뉴·티어) 다시 짓는다 */
  sync(s: GameState): void {
    const key = `${s.stage}|${s.burners}|${s.shopName}|${MENU_IDS.map((m) => (s.menus[m] ? 1 : 0)).join('')}|${s.tier}`;
    if (key === this.builtKey) return;
    const prev = this.geo;
    this.builtKey = key;
    this.geo = geoOf(s.stage);
    this.shop?.dispose();
    this.shop = buildShop(this.geo, { name: s.shopName, menus: s.menus, tier: s.tier }, this.root);
    this.tables.build(this.geo);
    this.kitchen.build(s, this.geo);
    const g = this.geo;
    this.r.camera.setBounds(g.left - 0.25, 3.15, -5.25, g.front + 1.35);
    this.r.resize();
    if (prev && prev.stage !== g.stage) {
      // 확장 연출: 벽과 입구가 옛 자리에서 밀려난다 (0.6초)
      this.expand = { t: 0, dl: prev.left - g.left, df: prev.front - g.front };
    }
  }

  update(s: GameState, alpha: number, dt: number): void {
    this.now += dt;
    this.sync(s);
    const g = this.geo!;
    this.cats.update(s, alpha, this.now, dt);
    this.tables.update(s, g, this.now, this.now);
    this.kitchen.update(s, this.now, this.now);
    this.fx.update(dt);
    if (this.expand && this.shop) {
      this.expand.t += dt;
      const k = Math.min(1, this.expand.t / TIMING.expandSec);
      const e = 1 - (1 - k) ** 3;
      this.shop.leftGroup.position.x = this.expand.dl * (1 - e);
      this.shop.frontGroup.position.z = this.expand.df * (1 - e);
      if (k >= 1) this.expand = null;
    }
    // 김
    this.steamAcc += dt;
    const ds = s.dayState;
    if (ds && this.steamAcc > 0.12) {
      this.steamAcc = 0;
      ds.burners.forEach((b, i) => {
        if (b.phase === 'cooking' || b.phase === 'done') { this.kitchen.burnerPos(i, _a); this.fx.puff(_a.x, 1.3, _a.z); }
        if (b.phase === 'burnt' && Math.random() < 0.7) { this.kitchen.burnerPos(i, _a); this.fx.puff(_a.x, 1.2, _a.z, true); }
      });
      if (Math.random() < 0.5) {
        const src: THREE.Vector3[] = [];
        ds.tables.forEach((tb, ti) => tb.seatDish.forEach((d, si) => { if (d && !d.eaten) src.push(this.tables.bowlPos(g, ti, si, new THREE.Vector3())); }));
        ds.pass.forEach((p, i) => { if (p) src.push(this.kitchen.passPos(i, new THREE.Vector3())); });
        if (src.length) { const q = src[Math.floor(Math.random() * src.length)]; this.fx.puff(q.x, q.y + 0.25, q.z); }
      }
    }
    if (this.overlap && ds) this.checkOverlap(s);
  }

  checkOverlap(s: GameState): void {
    const ds = s.dayState!;
    const list = [];
    for (const c of ds.cats) {
      const m = this.cats.get(c.id);
      if (!m) continue;
      const tm = c.kind === 'guest' ? ds.teams.find((t) => t.id === c.team) : undefined;
      const seatOwn = tm && tm.table >= 0 && c.seat >= 0 && ['enterSeat', 'sitting', 'seated', 'standing', 'exitSeat'].includes(c.state);
      const seat = seatOwn ? this.geo!.tables[tm!.table].seats[c.seat] : undefined;
      list.push({ c, m, name: `${c.kind}#${c.id}`, seat });
    }
    this.overlap!.add(overlapNow(list, this.geo!.colliders));
  }

  /** sim 이벤트 → 연출 */
  handle(s: GameState, e: SimEvent): void {
    const g = this.geo!;
    const ds = s.dayState;
    switch (e.k) {
      case 'toPass': {
        if (e.burner < 0) break;
        this.kitchen.burnerPos(e.burner, _a);
        this.kitchen.passPos(e.slot, _b);
        this.kitchen.passHidden.set(e.slot, this.now + TIMING.flySec);
        const d = ds?.pass[e.slot];
        this.fx.fly(_a, _b, d ? d.menu : 'sundae', TIMING.flySec, 0.7, 1.1);
        break;
      }
      case 'serve': {
        this.tables.bowlPos(g, e.table, e.seat, _b);
        if (e.slot >= 0) this.kitchen.passPos(e.slot, _a);
        else if (e.from) _a.set(e.from.x, 1.2, e.from.z);
        this.tables.hideUntil.set(e.table * 100 + e.seat, this.now + TIMING.flySec);
        this.fx.fly(_a, _b, e.menu, TIMING.flySec, 0.9, 1.0);
        _b.y += 0.6;
        this.fx.pop('서빙 완료', '#5CC46B', _b, 46);
        break;
      }
      case 'paid': {
        const t = g.tables[e.table];
        _a.set(t.x, 1.5, t.z);
        if (e.amount > 0) { this.fx.pop(`+${fmtMoney(e.amount)}원`, '#FFD34D', _a, 54); this.onPaid(e.amount, _a.clone()); }
        this.kitchen.sinkPos(_b);
        break;
      }
      case 'wash': {
        this.kitchen.sinkPos(_a);
        this.kitchen.stackPos(_b);
        this.fx.fly(_a, _b, 'empty', TIMING.flySec, 0.5, 1.0);
        break;
      }
      case 'poof': this.fx.poof(e.x, e.y, e.z); break;
      case 'burn': {
        this.kitchen.burnerPos(e.burner, _a);
        for (let i = 0; i < 6; i++) this.fx.puff(_a.x, 1.2, _a.z, true);
        break;
      }
      case 'review': {
        const t = g.tables[e.table];
        _a.set(t.x, 2.0, t.z);
        const col = e.score >= (s.reviews.length ? s.reviews.reduce((a, b) => a + b, 0) / s.reviews.length : 0) ? '#5CC46B' : '#E2533B';
        this.fx.pop(`★${e.score.toFixed(1)}`, col, _a, 50, TIMING.reviewPopSec);
        this.onReview(e.score);
        break;
      }
      case 'combo': {
        _a.set(0.8, 2.6, -1.0);
        this.fx.pop(`${e.n}연속!`, '#FF9A3C', _a, 64, TIMING.comboSec);
        break;
      }
      case 'angry': {
        const tm = ds?.teams.find((x) => x.id === e.team);
        if (tm) this.cats.angry(tm.members);
        break;
      }
      default: break;
    }
    void MENU_BY_ID;
  }

  clearDay(): void { this.cats.clear(); this.fx.clear(); }
}
