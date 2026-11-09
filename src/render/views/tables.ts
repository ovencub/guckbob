// 테이블 뷰: 주문 말풍선·인내심 게이지·좌석 그릇·동전·히트박스 + 웨이팅 줄 말풍선
import * as THREE from 'three';
import { SEAT_RULES } from '../../data/layouts';
import type { MenuId } from '../../data/menus';
import { patienceLevel, patienceUsed } from '../../sim/customers';
import type { LayoutGeo } from '../../sim/geometry';
import { canClean } from '../../sim/kitchen';
import type { GameState } from '../../sim/types';
import { bubble, coin, drawDish, gauge, textPop } from '../canvas2d';
import { makeBowl, setBowl, type BowlModel } from '../models/bowl';
import { makeTable } from '../models/props';
import { cSprite, type CSprite } from '../sprites';

const coinMats: THREE.SpriteMaterial[] = [];
function coinMat(grey: boolean): THREE.SpriteMaterial {
  const i = grey ? 1 : 0;
  if (!coinMats[i]) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    coin(c.getContext('2d') as CanvasRenderingContext2D, 64, 64, 46, grey);
    coinMats[i] = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false });
  }
  return coinMats[i];
}

export const hitMat = new THREE.MeshBasicMaterial({ visible: false });

interface TableV { group: THREE.Group; bowls: BowlModel[]; bub: CSprite; coin: THREE.Sprite; hit: THREE.Mesh }

export class TablesView {
  private tv: TableV[] = [];
  private queueBubs: CSprite[] = [];
  /** 서빙 연출 중엔 그릇을 늦게 보인다: key = table*100+seat */
  readonly hideUntil = new Map<number, number>();
  constructor(private root: THREE.Object3D, readonly hits: THREE.Object3D[]) {}

  build(g: LayoutGeo): void {
    this.dispose();
    for (const t of g.tables) {
      const group = makeTable(t, this.root);
      const bowls = t.seats.map((s) => {
        const b = makeBowl('sundae', group, [s.bowl.x, SEAT_RULES.tableTopY + SEAT_RULES.tableTopH / 2, s.bowl.z], 1.0);
        b.visible = false;
        return b;
      });
      const bub = cSprite(384, 224, 1.05, this.root);
      bub.sp.visible = false;
      const cs = new THREE.Sprite(coinMat(false));
      cs.scale.set(0.55, 0.55, 1); cs.renderOrder = 21; cs.visible = false;
      cs.position.set(t.x, 1.35, t.z);
      this.root.add(cs);
      // 히트박스: 테이블 + 좌석 + 말풍선 높이까지 넉넉하게
      const hit = new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.9, 2.4, t.d + 2.0), hitMat);
      hit.position.set(t.x, 1.1, t.z);
      hit.userData = { kind: 'table', id: t.id };
      this.root.add(hit);
      this.hits.push(hit);
      this.tv.push({ group, bowls, bub, coin: cs, hit });
    }
    for (let i = 0; i < g.queue.length; i++) {
      const q = cSprite(200, 180, 0.72, this.root);
      q.sp.visible = false;
      this.queueBubs.push(q);
    }
  }

  dispose(): void {
    for (const v of this.tv) {
      v.group.removeFromParent(); v.bub.sp.removeFromParent(); v.coin.removeFromParent(); v.hit.removeFromParent();
      const i = this.hits.indexOf(v.hit); if (i >= 0) this.hits.splice(i, 1);
    }
    for (const q of this.queueBubs) q.sp.removeFromParent();
    this.tv = []; this.queueBubs = [];
  }

  tablePos(id: number): THREE.Vector3 { return this.tv[id]?.hit.position ?? new THREE.Vector3(); }
  bowlPos(g: LayoutGeo, table: number, seat: number, out: THREE.Vector3): THREE.Vector3 {
    const s = g.tables[table].seats[seat];
    return out.set(s.bowl.x, SEAT_RULES.tableTopY + SEAT_RULES.tableTopH / 2, s.bowl.z);
  }

  update(s: GameState, g: LayoutGeo, now: number, t: number): void {
    const ds = s.dayState;
    this.tv.forEach((v, id) => {
      const geo = g.tables[id];
      const tb = ds?.tables[id];
      v.bowls.forEach((b, i) => {
        const d = tb?.seatDish[i];
        const hidden = (this.hideUntil.get(id * 100 + i) ?? 0) > now;
        b.visible = !!d && !hidden;
        if (d) setBowl(b, d.eaten ? 'dirty' : (d.menu as MenuId));
      });
      v.coin.visible = !!tb && tb.dirty;
      if (tb?.dirty) {
        const grey = !canClean(s, id);
        v.coin.material = coinMat(grey);
        v.coin.position.y = 1.35 + Math.abs(Math.sin(t * 6 + id)) * 0.18;
      }
      const team = tb && tb.team >= 0 ? ds!.teams.find((x) => x.id === tb.team) : undefined;
      if (!team || team.state !== 'seated') { v.bub.sp.visible = false; return; }
      const used = patienceUsed(s, team);
      const p = 1 - used;
      const remain = new Map<MenuId, number>();
      for (const o of team.orders) if (!o.served) remain.set(o.menu, (remain.get(o.menu) ?? 0) + 1);
      if (team.orderTaken && remain.size === 0) { v.bub.sp.visible = false; return; }
      v.bub.sp.visible = true;
      const kinds = [...remain.entries()];
      const wide = team.orderTaken && (kinds.length > 1 || team.size > 1);
      const key = `${team.orderTaken ? kinds.map(([m, n]) => m + n).join() : 'hand'}|${Math.round(p * 40)}|${team.vip ? 1 : 0}`;
      v.bub.draw(key, (x) => {
        const w = wide ? 360 : 232;
        const x0 = (384 - w) / 2;
        bubble(x, x0, 8, w, 180, true);
        if (team.vip) { x.save(); x.strokeStyle = '#F2C230'; x.lineWidth = 6; x.strokeRect(x0 + 10, 16, w - 20, 164); x.restore(); }
        if (!team.orderTaken) textPop(x, '주문!', 192, 82, 62, '#FFFFFF');
        else if (!wide) drawDish(x, kinds[0][0], 192, 86, 120);
        else {
          const n = kinds.length;
          const step = (w - 40) / n;
          kinds.forEach(([m, c], i) => {
            const cx = x0 + 20 + step * (i + 0.5) - 14;
            drawDish(x, m, cx, 86, Math.min(108, step * 0.82));
            textPop(x, `×${c}`, cx + Math.min(64, step * 0.42), 118, 34, '#FFFFFF');
          });
        }
        gauge(x, x0 + 30, 150, w - 60, p);
      });
      const shake = patienceLevel(used) === 'danger' ? Math.sin(t * 40) * 0.03 : 0;
      v.bub.sp.position.set(geo.x + shake, 2.15, geo.z - 0.2);
      v.bub.sp.scale.set(1.05 * (384 / 224), 1.05, 1);
    });
    // 웨이팅 줄 말풍선: 인원 점 + 인내심
    this.queueBubs.forEach((q) => { q.sp.visible = false; });
    if (ds) {
      ds.queue.forEach((id, i) => {
        const tm = ds.teams.find((x) => x.id === id);
        const c = tm && ds.cats.find((k) => k.id === tm.members[0]);
        const q = this.queueBubs[i];
        if (!tm || !c || !q) return;
        const p = Math.max(0, 1 - (ds.t - tm.arriveT) / tm.queuePatience);
        q.sp.visible = true;
        q.sp.position.set(c.x, 1.55, c.z);
        q.draw(`${tm.size}|${Math.round(p * 30)}`, (x) => {
          bubble(x, 10, 8, 180, 130, true);
          x.fillStyle = '#2B2A33';
          if (tm.size <= 4) for (let k = 0; k < tm.size; k++) { x.beginPath(); x.arc(100 + (k - (tm.size - 1) / 2) * 34, 58, 11, 0, 7); x.fill(); }
          else textPop(x, `${tm.size}명`, 100, 58, 44, '#FFFFFF');
          gauge(x, 34, 100, 132, p);
        });
      });
    }
  }
}
