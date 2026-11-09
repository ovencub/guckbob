// 튜토리얼 (GDD 14장): 1일차 첫 손님 3팀. 손가락이 테이블 → 화구 → 완료 → 배식대 → 동전 → 개수대 순으로 짚는다. 건너뛰기, 60초 안.
import * as THREE from 'three';
import { TUTORIAL } from '../data/balance';
import { KITCHEN_LAYOUT as K } from '../data/layouts';
import type { Game } from '../game';

interface Point { at: THREE.Vector3; text: string }

export class Tutorial {
  private el: HTMLDivElement;
  private hand: HTMLDivElement;
  private bubbleEl: HTMLDivElement;
  private skipBtn: HTMLButtonElement;
  active = false;
  private washedOnce = false;
  private t = 0;
  onEnd: (skipped: boolean) => void = () => {};

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'tut';
    this.el.innerHTML = '<div class="tut-hand">👆</div><div class="tut-bub"></div><button class="btn tut-skip tap" type="button">건너뛰기</button>';
    root.appendChild(this.el);
    this.hand = this.el.querySelector('.tut-hand') as HTMLDivElement;
    this.bubbleEl = this.el.querySelector('.tut-bub') as HTMLDivElement;
    this.skipBtn = this.el.querySelector('.tut-skip') as HTMLButtonElement;
    this.skipBtn.addEventListener('click', () => this.end(true));
    this.el.style.display = 'none';
  }

  start(): void { this.active = true; this.washedOnce = false; this.t = 0; this.el.style.display = ''; }

  end(skipped: boolean): void {
    if (!this.active) return;
    this.active = false;
    this.el.style.display = 'none';
    this.onEnd(skipped);
  }

  noteWash(): void { this.washedOnce = true; }

  private target(g: Game): Point | null {
    const s = g.s;
    const ds = s.dayState;
    if (!ds) return null;
    const geo = g.world.geo!;
    const v = new THREE.Vector3();
    const scripted = ds.teams.filter((t) => t.scripted);
    const order = scripted.find((t) => t.state === 'seated' && !t.orderTaken);
    if (order) { const tb = geo.tables[order.table]; return { at: v.set(tb.x, 1.2, tb.z), text: '테이블을 눌러 주문을 받아요' }; }
    const done = ds.burners.findIndex((b) => b.phase === 'done');
    if (done >= 0) return { at: g.world.kitchen.burnerPos(done, v).setY(1.6), text: '완료! 눌러서 배식대로 옮겨요. 늦으면 타요' };
    if (ds.pass.some((p) => p)) {
      const i = ds.pass.findIndex((p) => p);
      return { at: g.world.kitchen.passPos(i, v).setY(1.1), text: '국밥을 누르면 손님에게 날아가요' };
    }
    const dirty = ds.tables.find((tb) => tb.dirty);
    if (dirty) { const tb = geo.tables[dirty.id]; return { at: v.set(tb.x, 1.4, tb.z), text: '동전을 눌러 수금하고 치워요' }; }
    if (ds.sink > 0 && !this.washedOnce && scripted.some((t) => t.state === 'gone' || t.state === 'leaving')) return { at: v.set(geo.sink.x, 1.2, geo.sink.z), text: '개수대를 눌러 그릇을 씻어요' };
    const waiting = scripted.some((t) => t.state === 'seated' && t.orderTaken && t.orders.some((o) => !o.served));
    const cooking = ds.burners.findIndex((b) => b.phase === 'cooking');
    if (waiting && cooking < 0) {
      const empty = ds.burners.findIndex((b) => b.phase === 'empty');
      if (empty >= 0) return { at: g.world.kitchen.burnerPos(empty, v).setY(1.3), text: '빈 화구를 눌러 국밥을 끓여요' };
    }
    if (cooking >= 0) return { at: g.world.kitchen.burnerPos(cooking, v).setY(1.6), text: '보글보글… 3초면 완성!' };
    return { at: v.set(geo.spawn.x, 1.0, geo.spawn.z), text: '손님이 오고 있어요!' };
  }

  update(g: Game, dt: number): void {
    if (!this.active) return;
    this.t += dt;
    const ds = g.s.dayState;
    const scripted = ds ? ds.teams.filter((t) => t.scripted) : [];
    const finished = ds && ds.scriptedLeft === 0 && scripted.length === 0 && this.washedOnce;
    if (!ds || g.s.phase === 'overtime' || this.t > TUTORIAL.maxSec || finished) { this.end(false); return; }
    const p = this.target(g);
    if (!p) { this.hand.style.display = 'none'; return; }
    const sc = g.r.toScreen(p.at, { x: 0, y: 0 });
    this.hand.style.display = '';
    this.hand.style.transform = `translate(${sc.x - 16}px, ${sc.y + 6 + Math.abs(Math.sin(this.t * 6)) * 10}px)`;
    this.bubbleEl.textContent = p.text;
    const top = Math.min(g.r.h - 160, Math.max(150, sc.y + 70));
    this.bubbleEl.style.transform = `translate(-50%, ${top}px)`;
    void K;
  }
}
