// 주방: 조리·탐·배식대·서빙·청소·설거지 (GDD 4.3~4.9) + 주문 수요 계산
import { KITCHEN } from '../data/balance';
import { bumpCombo, endCombo } from './combo';
import { MENU_BY_ID, MENU_IDS, type MenuId } from '../data/menus';
import { CHEF } from '../data/staff';
import { placeDish } from './customers';
import { PLAYER, sinkCap } from './state';
import type { GameState, SimEvent, Team } from './types';

type Emit = (e: SimEvent) => void;

/** 조리·배식대·운반 중인 메뉴 수 */
export function supply(s: GameState): Record<MenuId, number> {
  const ds = s.dayState!;
  const out = Object.fromEntries(MENU_IDS.map((m) => [m, 0])) as Record<MenuId, number>;
  for (const b of ds.burners) if (b.phase === 'cooking' || b.phase === 'done') out[b.menu]++;
  for (const p of ds.pass) if (p) out[p.menu]++;
  for (const c of ds.cats) for (const d of c.carry) out[d.menu]++;
  return out;
}

/** 아직 아무도 만들지 않은 주문 (오래된 순) */
export function unmetOrders(s: GameState): Array<{ team: Team; menu: MenuId; t: number }> {
  const ds = s.dayState!;
  const items: Array<{ team: Team; menu: MenuId; t: number }> = [];
  for (const t of ds.teams) {
    if (t.state !== 'seated' || !t.orderTaken) continue;
    for (const o of t.orders) if (!o.served) items.push({ team: t, menu: o.menu, t: t.seatedT + o.member * 1e-4 });
  }
  items.sort((a, b) => a.t - b.t);
  const sup = supply(s);
  return items.filter((it) => {
    if (sup[it.menu] > 0) { sup[it.menu]--; return false; }
    return true;
  });
}

export function unmetCount(s: GameState): Record<MenuId, number> {
  const out = Object.fromEntries(MENU_IDS.map((m) => [m, 0])) as Record<MenuId, number>;
  for (const u of unmetOrders(s)) out[u.menu]++;
  return out;
}

/** 이 메뉴를 기다리는 테이블 중 가장 오래 기다린 팀 */
export function oldestWaiting(s: GameState, menu: MenuId, exclude: number[] = []): Team | null {
  const ds = s.dayState!;
  let best: Team | null = null;
  for (const t of ds.teams) {
    if (t.state !== 'seated' || !t.orderTaken || exclude.includes(t.id)) continue;
    const need = t.orders.filter((o) => !o.served && o.menu === menu).length - t.orders.filter((o) => !o.served && o.menu === menu && o.reserved).length;
    if (need <= 0) continue;
    if (!best || t.seatedT < best.seatedT) best = t;
  }
  return best;
}

export function startCook(s: GameState, burner: number, menu: MenuId, by: number, taste: number, speed: number, emit: Emit): boolean {
  const ds = s.dayState!;
  const b = ds.burners[burner];
  if (!b || b.phase !== 'empty' || !s.menus[menu]) return false;
  if (ds.clean <= 0) {
    emit({ k: 'nope', what: 'burner', id: burner });
    if (by === PLAYER) emit({ k: 'toast', msg: '그릇이 없어요' });
    return false;
  }
  ds.clean--;
  b.phase = 'cooking'; b.menu = menu; b.t = 0; b.dur = MENU_BY_ID[menu].cookSec / speed; b.by = by; b.taste = taste; b.dishId = ds.nextId++;
  emit({ k: 'cook', burner, by });
  return true;
}

function freePassSlot(s: GameState): number {
  return s.dayState!.pass.findIndex((p) => p === null);
}

/** 완료된 화구 → 배식대 */
export function collect(s: GameState, burner: number, emit: Emit, quiet = false): boolean {
  const ds = s.dayState!;
  const b = ds.burners[burner];
  if (!b || b.phase !== 'done') return false;
  const slot = freePassSlot(s);
  if (slot < 0) {
    if (!quiet) { emit({ k: 'nope', what: 'burner', id: burner }); emit({ k: 'toast', msg: '배식대가 꽉 찼어요' }); }
    return false;
  }
  ds.pass[slot] = { id: b.dishId, menu: b.menu, taste: b.taste, by: b.by, res: 0, at: ds.t };
  b.phase = 'empty';
  emit({ k: 'toPass', burner, slot });
  return true;
}

export function updateBurners(s: GameState, dt: number, emit: Emit): void {
  const ds = s.dayState!;
  ds.burners.forEach((b, i) => {
    if (b.phase === 'cooking') {
      b.t += dt;
      if (b.t >= b.dur) {
        b.phase = 'done'; b.t = 0;
        emit({ k: 'cookDone', burner: i });
        if (b.by !== PLAYER) collect(s, i, emit, true); // 주방장 조리는 바로 배식대로
      }
    } else if (b.phase === 'done') {
      if (b.by !== PLAYER) { collect(s, i, emit, true); return; } // 주방장 것은 절대 타지 않는다
      b.t += dt;
      if (b.t >= KITCHEN.burnSec) {
        b.phase = 'burnt'; b.t = 0;
        ds.burnt++; ds.burnedByPlayer++;
        emit({ k: 'burn', burner: i });
        endCombo(s);
      }
    }
    if (b.phase === 'burnt' && ds.sink < sinkCap(s)) {
      // 탄 냄비 그릇은 개수대로. 개수대가 꽉 차 있으면 자리가 날 때까지 막힌다
      ds.sink++;
      b.phase = 'empty';
    }
  });
}

/** 배식대 국밥을 테이블로 (tableTeam 지정 없으면 가장 오래 기다린 테이블) */
export function serve(s: GameState, slot: number, emit: Emit, tableId = -1, by = PLAYER): boolean {
  const ds = s.dayState!;
  const d = ds.pass[slot];
  if (!d) return false;
  let team: Team | null = null;
  if (tableId >= 0) {
    const tb = ds.tables[tableId];
    const t = ds.teams.find((x) => x.id === tb.team);
    if (t && t.state === 'seated' && t.orderTaken && t.orders.some((o) => !o.served && o.menu === d.menu)) team = t;
  } else team = oldestWaiting(s, d.menu);
  if (!team) { emit({ k: 'nope', what: 'pass', id: slot }); return false; }
  const seat = placeDish(s, team, d.menu, d.taste, by, d.id);
  ds.pass[slot] = null;
  emit({ k: 'serve', slot, table: team.table, seat, by, menu: d.menu });
  bumpCombo(s, emit);
  return true;
}

/** 서버가 들고 온 그릇 놓기 */
export function serveCarried(s: GameState, team: Team, d: { id: number; menu: MenuId; taste: number }, by: number, from: { x: number; z: number }, emit: Emit, resBy = 0): boolean {
  if (team.state !== 'seated') return false;
  const seat = placeDish(s, team, d.menu, d.taste, by, d.id, resBy);
  if (seat < 0) return false;
  emit({ k: 'serve', slot: -1, table: team.table, seat, by, menu: d.menu, from });
  return true;
}

export function canClean(s: GameState, table: number): boolean {
  const ds = s.dayState!;
  const tb = ds.tables[table];
  return tb.dirty && sinkCap(s) - ds.sink >= tb.bowls;
}

export function clean(s: GameState, table: number, emit: Emit, by = PLAYER): boolean {
  const ds = s.dayState!;
  const tb = ds.tables[table];
  if (!tb || !tb.dirty) return false;
  if (!canClean(s, table)) {
    emit({ k: 'nope', what: 'table', id: table });
    if (by === PLAYER) emit({ k: 'toast', msg: '개수대가 꽉 찼어요' });
    return false;
  }
  ds.sink += tb.bowls;
  const amount = tb.coins;
  ds.revenue += amount;
  s.money += amount;
  tb.dirty = false; tb.coins = 0; tb.bowls = 0; tb.cleanBy = 0;
  tb.seatDish = tb.seatDish.map(() => null);
  emit({ k: 'paid', table, amount, by });
  if (amount > 0) bumpCombo(s, emit);
  return true;
}

export function wash(s: GameState, emit: Emit, by = PLAYER): boolean {
  const ds = s.dayState!;
  if (ds.sink <= 0) { emit({ k: 'nope', what: 'sink', id: 0 }); return false; }
  if (by === PLAYER && ds.washCd > 0) return false;
  ds.sink--;
  ds.clean++;
  ds.washed++;
  if (by === PLAYER) ds.washCd = KITCHEN.washCooldownSec;
  emit({ k: 'wash', by });
  return true;
}

export const chefSpeed = (grade: number): number => CHEF.speed[grade];
