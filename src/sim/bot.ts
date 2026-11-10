// 플레이어 봇 (BUILD_PLAN 6단계): 초당 행동 수 제한, 반응 지연 0.4초,
// 가장 급한 일부터: 완료 알림 > 서빙 > 주문 > 청소 > 설거지(필요할 때) > 조리 > 설거지(한가할 때)
import { BOT } from '../data/bot';
import * as cmd from './commands';
import { patienceUsed } from './customers';
import { canClean, oldestWaiting, unmetOrders } from './kitchen';
import { PLAYER, sinkCap, unlockedMenus } from './state';
import type { GameState, SimEvent } from './types';

export class PlayerBot {
  private budget = 0;
  private seen = new Map<string, number>();
  private alive = new Set<string>();
  actions = 0;
  /** 사람 흉내 (밸런스 검증용): 가끔 딴 데 보기(lapse), 가장 급한 일을 놓치기(miss) */
  human: { lapseEvery: [number, number]; lapseSec: [number, number]; miss: number; seed: number } | null = null;
  private lapseAt = -1;
  private lapseEnd = -1;
  private ignore = new Map<string, number>();
  constructor(public tapsPerSec: number, public reaction: number = BOT.reactionSec) {}

  private rnd(): number {
    const h = this.human!;
    h.seed = (h.seed * 1664525 + 1013904223) >>> 0;
    return h.seed / 4294967296;
  }

  private ready(key: string, now: number): boolean {
    if ((this.ignore.get(key) ?? -1) > now) return false;
    this.alive.add(key);
    const t = this.seen.get(key);
    if (t === undefined) { this.seen.set(key, now); return false; }
    return now - t >= this.reaction;
  }

  /** 한 틱. 행동했으면 true */
  tick(s: GameState, dt: number, ev: SimEvent[]): boolean {
    const ds = s.dayState;
    if (!ds || (s.phase !== 'open' && s.phase !== 'overtime')) { this.seen.clear(); this.ignore.clear(); this.lapseAt = -1; this.lapseEnd = -1; return false; }
    this.budget = Math.min(BOT.menuPickCost, this.budget + dt * this.tapsPerSec);
    const now = ds.t;
    this.alive.clear();
    if (this.human) {
      const h = this.human;
      if (this.lapseAt < 0) this.lapseAt = now + h.lapseEvery[0] + this.rnd() * (h.lapseEvery[1] - h.lapseEvery[0]);
      if (now >= this.lapseAt) { this.lapseEnd = now + h.lapseSec[0] + this.rnd() * (h.lapseSec[1] - h.lapseSec[0]); this.lapseAt = this.lapseEnd + h.lapseEvery[0] + this.rnd() * (h.lapseEvery[1] - h.lapseEvery[0]); }
      if (now < this.lapseEnd) return false;
    }
    let act = this.pick(s, now);
    if (act && this.human && this.budget >= act.cost && this.rnd() < this.human.miss) {
      // 가장 급한 일을 못 보고 다른 일을 한다 (0.5~1.5초 동안 그 일을 못 봄)
      this.ignore.set(act.key, now + 0.5 + this.rnd());
      act = this.pick(s, now);
    }
    for (const k of [...this.seen.keys()]) if (!this.alive.has(k)) this.seen.delete(k);
    if (!act || this.budget < act.cost) return false;
    this.budget -= act.cost;
    this.actions += act.cost;
    act.run(ev);
    this.seen.delete(act.key);
    return true;
  }

  private pick(s: GameState, now: number): { key: string; cost: number; run: (ev: SimEvent[]) => void } | null {
    const ds = s.dayState!;
    // ① 완료 알림
    for (let i = 0; i < ds.burners.length; i++) {
      const b = ds.burners[i];
      if (b.phase === 'done' && b.by === PLAYER && ds.pass.some((p) => !p)) {
        const k = `done:${i}`;
        if (this.ready(k, now)) return { key: k, cost: 1, run: (ev) => cmd.collect(s, i, ev) };
      }
    }
    // ② 서빙 — 서버가 있으면 서버에게 맡기고(친절도), 급한 테이블이나 오래 남은 국밥만 직접
    const hasServer = s.staff.some((m) => m.role === 'server');
    for (let i = 0; i < ds.pass.length; i++) {
      const p = ds.pass[i];
      const target = p && !p.res ? oldestWaiting(s, p.menu) : null;
      if (p && target && (!hasServer || now - p.at >= BOT.passWaitSec || patienceUsed(s, target) >= BOT.urgentRatio)) {
        const k = `serve:${i}`;
        if (this.ready(k, now)) return { key: k, cost: 1, run: (ev) => cmd.serve(s, i, ev) };
      }
    }
    // ③ 주문
    for (const t of ds.teams) {
      if (t.state === 'seated' && !t.orderTaken && !ds.tables[t.table].orderBy) {
        const k = `order:${t.table}`;
        if (this.ready(k, now)) return { key: k, cost: 1, run: (ev) => cmd.takeOrder(s, t.table, ev) };
      }
    }
    // ④ 청소·수금
    for (const tb of ds.tables) {
      if (tb.dirty && !tb.cleanBy && canClean(s, tb.id)) {
        const k = `clean:${tb.id}`;
        if (this.ready(k, now)) return { key: k, cost: 1, run: (ev) => cmd.clean(s, tb.id, ev) };
      }
    }
    const unmet = unmetOrders(s);
    const blocked = ds.tables.some((tb) => tb.dirty && !canClean(s, tb.id)) || ds.burners.some((b) => b.phase === 'burnt');
    const needBowls = ds.clean < Math.min(unmet.length, ds.burners.filter((b) => b.phase === 'empty').length);
    // ⑤ 설거지 (그릇이 모자라거나 개수대 때문에 막혔을 때)
    if (ds.sink > 0 && ds.washCd <= 0 && (needBowls || blocked || ds.sink >= sinkCap(s))) {
      if (this.ready('wash', now)) return { key: 'wash', cost: 1, run: (ev) => cmd.wash(s, ev) };
    }
    // ⑥ 조리
    if (unmet.length && ds.clean > 0) {
      const multi = unlockedMenus(s).length > 1;
      for (let i = 0; i < ds.burners.length; i++) {
        if (ds.burners[i].phase !== 'empty') continue;
        const k = `cook:${i}`;
        const menu = unmet[0].menu;
        if (this.ready(k, now)) return { key: k, cost: multi ? BOT.menuPickCost : 1, run: (ev) => cmd.startCook(s, i, menu, ev) };
        break;
      }
    }
    // ⑦ 한가하면 설거지
    if (ds.sink > 0 && ds.washCd <= 0 && this.ready('wash', now)) return { key: 'wash', cost: 1, run: (ev) => cmd.wash(s, ev) };
    return null;
  }
}
