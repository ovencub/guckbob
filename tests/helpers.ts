// 테스트 도우미: 상황을 바로 만들고 시간을 돌린다
import { SEAT_RULES } from '../src/data/layouts';
import type { MenuId } from '../src/data/menus';
import { makeTeam } from '../src/sim/customers';
import { startDay, step } from '../src/sim/sim';
import { blankCat, geoOf, newGame } from '../src/sim/state';
import type { GameState, SimEvent, Team } from '../src/sim/types';

export function openDay(seed = 1, setup?: (s: GameState) => void): { s: GameState; ev: SimEvent[] } {
  const s = newGame(seed);
  s.tutorial = false;
  setup?.(s);
  startDay(s);
  const ev: SimEvent[] = [];
  while (s.phase === 'countdown') step(s, ev);
  // 손님이 저절로 오지 않게
  s.dayState!.nextArrival = 1e9;
  return { s, ev };
}

export function run(s: GameState, sec: number, ev: SimEvent[] = []): SimEvent[] {
  const n = Math.round(sec * 30);
  for (let i = 0; i < n; i++) step(s, ev);
  return ev;
}

/** 팀을 테이블에 바로 앉힌다 (걷기 생략) */
export function seatNow(s: GameState, size: number, table: number, menus?: MenuId[], taken = true): Team {
  const ds = s.dayState!;
  const t = makeTeam(s, size);
  if (menus) menus.forEach((m, i) => { t.orders[i].menu = m; });
  const g = geoOf(s.stage);
  t.table = table; t.state = 'seated'; t.seatedT = ds.t; t.orderTaken = taken; t.spawnLeft = 0;
  ds.tables[table].team = t.id;
  t.members = [];
  for (let i = 0; i < size; i++) {
    const st = g.tables[table].seats[i];
    const c = blankCat(ds.nextId++, 'guest', st.x, st.z, st.ry);
    c.team = t.id; c.seat = i; c.state = 'seated'; c.y = SEAT_RULES.seatY;
    t.orders[i].member = i;
    ds.cats.push(c);
    t.members.push(c.id);
  }
  return t;
}

export function putOnPass(s: GameState, menu: MenuId, taste = 1): number {
  const ds = s.dayState!;
  const i = ds.pass.findIndex((p) => p === null);
  ds.pass[i] = { id: ds.nextId++, menu, taste, by: -1, res: 0 };
  return i;
}
