// 직원 AI (GDD 6장): 주방장(화구 2개, 절대 안 탐), 서버(서빙 > 주문 > 치우기), 설거지 알바
import { CAT_DIM, KITCHEN_LAYOUT as K } from '../data/layouts';
import { MOVE } from '../data/layouts';
import { SERVER } from '../data/staff';
import { takeOrder } from './customers';
import { chefStations, type Vec2 } from './geometry';
import { canClean, chefSpeed, clean, oldestWaiting, serveCarried, startCook, unmetOrders, wash } from './kitchen';
import { asideSpot, faceToward, place, routeBlockers, spotClear, stepWalk, walkTo } from './movement';
import { blankCat, chefTaste, geoOf, sinkCap, washSecOf } from './state';
import type { Cat, GameState, ServerTask, SimEvent, StaffMember, Team } from './types';

type Emit = (e: SimEvent) => void;

/** 영업 시작 때 직원 고양이 배치 */
export function placeStaff(s: GameState): void {
  const ds = s.dayState!;
  const g = geoOf(s.stage);
  const cs = s.staff.filter((m) => m.role === 'chef');
  const st = chefStations(g, s.burners, cs.length);
  cs.forEach((m, i) => {
    const x0 = st[i].burners.length ? g.burners[st[i].burners[0]].x : st[i].x;
    const c = blankCat(ds.nextId++, 'chef', x0, g.chefZ, Math.PI);
    c.staff = m.id; c.fur = m.fur; c.state = 'idle';
    ds.cats.push(c);
  });
  const dm = s.staff.find((m) => m.role === 'dish');
  if (dm) {
    const c = blankCat(ds.nextId++, 'dish', g.sink.x, g.chefZ, Math.PI);
    c.staff = dm.id; c.fur = dm.fur; ds.cats.push(c);
  }
  s.staff.filter((m) => m.role === 'server').forEach((m, i) => {
    const p = g.idle[i % g.idle.length];
    const c = blankCat(ds.nextId++, 'server', p.x, p.z, Math.PI);
    c.staff = m.id; c.fur = m.fur; c.speed = SERVER.speed[m.grade];
    ds.cats.push(c);
  });
}

const member = (s: GameState, c: Cat): StaffMember | undefined => s.staff.find((m) => m.id === c.staff);

/** 주방장: 맡은 화구(최대 2개) 중 끓일 화구 앞으로 게걸음으로 가서 조리. 조리대를 보고 옆으로만 움직인다 */
export function updateChefs(s: GameState, dt: number, emit: Emit): void {
  const ds = s.dayState!;
  const g = geoOf(s.stage);
  const chefCats = ds.cats.filter((c) => c.kind === 'chef');
  const st = chefStations(g, s.burners, chefCats.length);
  chefCats.forEach((c, i) => {
    const m = member(s, c);
    if (!m) return;
    c.ry = Math.PI;
    c.moving = false;
    const mine = st[i].burners;
    const cooking = mine.some((b) => ds.burners[b].phase === 'cooking' && ds.burners[b].by === m.id);
    // 끓일 화구 고르기: 지금 서 있는 화구가 비었으면 그곳, 아니면 가까운 빈 화구
    const empty = mine.filter((b) => ds.burners[b].phase === 'empty').sort((a, b) => Math.abs(g.burners[a].x - c.x) - Math.abs(g.burners[b].x - c.x));
    const want = empty.length && unmetOrders(s).length && ds.clean > 0 ? empty[0] : -1;
    if (want >= 0) {
      const tx = g.burners[want].x;
      const d = tx - c.x;
      if (Math.abs(d) > MOVE.arriveEps) {
        const stp = Math.min(Math.abs(d), MOVE.chefSpeed * dt);
        c.x += Math.sign(d) * stp;
        c.moving = true;
      } else {
        c.x = tx;
        const un = unmetOrders(s);
        if (un.length) startCook(s, want, un[0].menu, m.id, chefTaste(s, m), chefSpeed(m.grade), emit);
      }
    }
    c.actT = cooking && !c.moving ? 1 : 0;
  });
}

export function updateDishwasher(s: GameState, dt: number, emit: Emit): void {
  const ds = s.dayState!;
  const c = ds.cats.find((k) => k.kind === 'dish');
  const m = c && member(s, c);
  if (!c || !m) return;
  const need = washSecOf(m);
  if (ds.sink <= 0) { ds.dishT = Math.min(ds.dishT, need); c.actT = 0; return; }
  ds.dishT += dt;
  c.actT = 1;
  if (ds.dishT >= need) { ds.dishT -= need; wash(s, emit, m.id); }
}

function servicePoint(s: GameState, c: Cat, table: number): Vec2 {
  const ds = s.dayState!;
  const t = geoOf(s.stage).tables[table];
  const taken = ds.cats.filter((o) => o !== c && o.kind === 'server' && o.task && 'to' in o.task).map((o) => o.task!.to);
  let best = t.service[0];
  let bd = Infinity;
  for (const p of t.service) {
    if (taken.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.1)) continue;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function pickPoint(s: GameState, c: Cat, slots: number[]): Vec2 {
  const g = geoOf(s.stage);
  const x0 = slots.reduce((a, i) => a + g.passSlots[i].x, 0) / slots.length;
  const others = s.dayState!.cats.filter((o) => o !== c && o.kind === 'server');
  const lo = K.passX0 + 0.2;
  const hi = K.passX1 - 0.2;
  // 다른 서버의 위치·목표와 0.82칸 이상 떨어진, 원하는 곳에서 가장 가까운 지점
  for (const dx of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.0, -2.0, 2.5, -2.5]) {
    const x = Math.max(lo, Math.min(hi, x0 + dx));
    const p = { x, z: g.pickZ };
    const clash = others.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < CAT_DIM.sep + 0.05
      || (o.goal && Math.hypot(o.goal.x - p.x, o.goal.z - p.z) < CAT_DIM.sep + 0.05));
    if (!clash) return p;
  }
  return { x: Math.max(lo, Math.min(hi, x0)), z: g.pickZ };
}

function teamAt(s: GameState, table: number): Team | undefined {
  const ds = s.dayState!;
  return ds.teams.find((t) => t.id === ds.tables[table].team);
}

function chooseTask(s: GameState, c: Cat, cap: number): ServerTask | null {
  const ds = s.dayState!;
  // ① 들고 있는 그릇 배달
  if (c.carry.length) {
    // 들고 있는 그릇마다 주문 하나씩 예약 (다른 서버·플레이어와 헛걸음 방지)
    unreserve(s, c);
    const tables: number[] = [];
    for (const d of c.carry) {
      const t = oldestWaiting(s, d.menu);
      if (!t) continue;
      const o = t.orders.find((x) => !x.served && x.menu === d.menu && !x.reserved);
      if (o) { o.reserved = c.id; if (!tables.includes(t.table)) tables.push(t.table); }
    }
    if (!tables.length) return null; // 기다리는 테이블이 없으면 들고 대기
    const g = geoOf(s.stage);
    tables.sort((a, b) => Math.hypot(g.tables[a].x - c.x, g.tables[a].z - c.z) - Math.hypot(g.tables[b].x - c.x, g.tables[b].z - c.z));
    return { k: 'deliver', table: tables[0], to: servicePoint(s, c, tables[0]) };
  }
  // ① 배식대 국밥 서빙
  const want: number[] = [];
  const counted = new Map<string, number>();
  ds.pass.forEach((p, i) => {
    if (!p || p.res || want.length >= cap) return;
    const waiting = ds.teams.filter((t) => t.state === 'seated' && t.orderTaken)
      .reduce((a, t) => a + t.orders.filter((o) => !o.served && o.menu === p.menu).length, 0);
    const already = (counted.get(p.menu) ?? 0) + ds.cats.reduce((a, k) => a + k.carry.filter((d) => d.menu === p.menu).length, 0)
      + ds.pass.filter((q) => q && q.res && q.menu === p.menu).length;
    if (waiting - already <= 0) return;
    counted.set(p.menu, (counted.get(p.menu) ?? 0) + 1);
    want.push(i);
  });
  if (want.length) {
    for (const i of want) ds.pass[i]!.res = c.id;
    return { k: 'pick', slots: want, to: pickPoint(s, c, want) };
  }
  // ② 주문 받기 (키오스크 없을 때)
  if (!s.kiosk) {
    let best: Team | null = null;
    for (const t of ds.teams) {
      if (t.state !== 'seated' || t.orderTaken || ds.tables[t.table].orderBy) continue;
      if (!best || t.seatedT < best.seatedT) best = t;
    }
    if (best) {
      ds.tables[best.table].orderBy = c.id;
      return { k: 'order', table: best.table, to: servicePoint(s, c, best.table) };
    }
  }
  // ③ 동전 뜬 테이블 치우기 (개수대 여유 있을 때)
  const reservedSink = ds.tables.filter((t) => t.cleanBy).reduce((a, t) => a + t.bowls, 0);
  let bestT = -1;
  let bd = Infinity;
  for (const tb of ds.tables) {
    if (!tb.dirty || tb.cleanBy) continue;
    if (sinkCap(s) - ds.sink - reservedSink < tb.bowls) continue;
    const d = Math.hypot(geoOf(s.stage).tables[tb.id].x - c.x, geoOf(s.stage).tables[tb.id].z - c.z);
    if (d < bd) { bd = d; bestT = tb.id; }
  }
  if (bestT >= 0) {
    ds.tables[bestT].cleanBy = c.id;
    return { k: 'clean', table: bestT, to: servicePoint(s, c, bestT) };
  }
  return null;
}

function unreserve(s: GameState, c: Cat): void {
  for (const tm of s.dayState!.teams) for (const o of tm.orders) if (o.reserved === c.id) o.reserved = 0;
}

function releaseTask(s: GameState, c: Cat): void {
  const ds = s.dayState!;
  const t = c.task;
  unreserve(s, c);
  if (!t) return;
  if (t.k === 'pick') for (const i of t.slots) { const p = ds.pass[i]; if (p && p.res === c.id) p.res = 0; }
  if (t.k === 'order' && ds.tables[t.table].orderBy === c.id) ds.tables[t.table].orderBy = 0;
  if (t.k === 'clean' && ds.tables[t.table].cleanBy === c.id) ds.tables[t.table].cleanBy = 0;
  c.task = null;
}

function taskValid(s: GameState, c: Cat): boolean {
  const ds = s.dayState!;
  const t = c.task;
  if (!t) return false;
  switch (t.k) {
    case 'pick': return t.slots.some((i) => ds.pass[i]?.res === c.id);
    case 'deliver': { const tm = teamAt(s, t.table); return !!tm && tm.state === 'seated' && tm.orders.some((o) => !o.served && o.reserved === c.id); }
    case 'order': { const tm = teamAt(s, t.table); return !!tm && tm.state === 'seated' && !tm.orderTaken; }
    case 'clean': return ds.tables[t.table].dirty;
    case 'home': return true;
  }
}

function finishTask(s: GameState, c: Cat, m: StaffMember, emit: Emit): void {
  const ds = s.dayState!;
  const t = c.task!;
  if (t.k === 'pick') {
    for (const i of t.slots) {
      const p = ds.pass[i];
      if (p && p.res === c.id) { c.carry.push({ id: p.id, menu: p.menu, taste: p.taste }); ds.pass[i] = null; emit({ k: 'toPass', burner: -1, slot: i }); }
    }
    // 걸어오는 동안 새로 나온 국밥도 쟁반이 찰 때까지 같이 집는다
    const cap = SERVER.carry[m.grade];
    for (let i = 0; i < ds.pass.length && c.carry.length < cap; i++) {
      const p = ds.pass[i];
      if (!p || p.res) continue;
      const waiting = ds.teams.filter((tm) => tm.state === 'seated' && tm.orderTaken)
        .reduce((a, tm) => a + tm.orders.filter((o) => !o.served && o.menu === p.menu).length, 0);
      const carried = ds.cats.reduce((a, k) => a + k.carry.filter((d) => d.menu === p.menu).length, 0)
        + ds.pass.filter((q) => q && q.res && q.menu === p.menu).length;
      if (waiting - carried <= 0) continue;
      c.carry.push({ id: p.id, menu: p.menu, taste: p.taste }); ds.pass[i] = null; emit({ k: 'toPass', burner: -1, slot: i });
    }
  } else if (t.k === 'deliver') {
    const tm = teamAt(s, t.table);
    if (tm) {
      for (let i = 0; i < c.carry.length; i++) {
        const d = c.carry[i];
        if (!tm.orders.some((o) => !o.served && o.menu === d.menu && o.reserved === c.id)) continue;
        if (serveCarried(s, tm, d, m.id, { x: c.x, z: c.z }, emit, c.id)) { c.carry.splice(i, 1); i--; }
      }
    }
  } else if (t.k === 'order') {
    takeOrder(s, t.table, m.id, emit);
  } else if (t.k === 'clean') {
    if (canClean(s, t.table)) clean(s, t.table, emit, m.id);
  }
  releaseTask(s, c);
}

/** 나 때문에 막힌 손님이 있으면(또는 손님과 서로 막혔으면) 손님 길에서 먼 빈 자리로 비켜 선다 (손님 우선) */
function tryDodge(s: GameState, c: Cat): boolean {
  const ds = s.dayState!;
  const stuck = ds.cats.find((o) => o.kind === 'guest' && o.blockedBy === c.id && o.blockedT >= MOVE.yieldAfterSec)
    ?? (c.blockedBy >= 0 && c.blockedT >= MOVE.yieldAfterSec ? ds.cats.find((o) => o.id === c.blockedBy && o.kind === 'guest') : undefined);
  if (!stuck) return false;
  const p = asideSpot(s, c, stuck);
  if (!p) return false;
  walkTo(s, c, p);
  c.dodgeT = MOVE.dodgeMaxSec;
  return true;
}

export function updateServer(s: GameState, c: Cat, dt: number, emit: Emit): void {
  const m = member(s, c);
  if (!m) return;
  c.speed = SERVER.speed[m.grade];
  c.lookSec = SERVER.lookSec[m.grade];
  c.replanSec = SERVER.replanSec[m.grade];
  // 손님 우선: 내가 손님 길을 막고 있으면 옆으로 비켜 선다
  if (c.dodgeT > 0) {
    c.dodgeT -= dt;
    if (stepWalk(s, c, dt) || c.dodgeT <= 0) {
      c.dodgeT = 0;
      if (c.task && c.state === 'walk') walkTo(s, c, c.task.to, false, routeBlockers(s, c, c.task.to));
      else { c.goal = null; c.path = []; }
    }
    return;
  }
  if (c.state !== 'act' && tryDodge(s, c)) return;
  if (c.state === 'act') {
    c.actT -= dt;
    if (c.task && c.task.k !== 'home') {
      const g = geoOf(s.stage);
      const tgt = c.task.k === 'pick' ? { x: c.x, z: g.pickZ - 1 } : g.tables[c.task.table];
      faceToward(c, tgt.x, tgt.z, dt);
    }
    if (c.actT <= 0) { if (c.task && taskValid(s, c)) finishTask(s, c, m, emit); else releaseTask(s, c); c.state = 'idle'; }
    return;
  }
  if (c.state === 'walk') {
    if (!taskValid(s, c)) { releaseTask(s, c); c.state = 'idle'; c.goal = null; c.moving = false; return; }
    if (stepWalk(s, c, dt)) {
      if (c.task!.k === 'home') { c.task = null; c.state = 'idle'; return; }
      c.state = 'act'; c.actT = SERVER.actionSec;
    } else if (c.blockedT > MOVE.stuckPoofSec && c.goal) {
      if (spotClear(s, c.goal.x, c.goal.z, c)) {
        // 오래 끼면 연기와 함께 목표 지점으로 (결정 로그)
        emit({ k: 'poof', x: c.x, z: c.z, y: 0 });
        s.dayState!.teleports++;
        place(c, c.goal.x, c.goal.z); c.blockedT = 0;
        emit({ k: 'poof', x: c.x, z: c.z, y: 0 });
      } else {
        // 목표 자리에 누가 있으면 일을 내려놓고 다른 일
        releaseTask(s, c); c.state = 'idle'; c.goal = null; c.path = []; c.blockedT = 0;
      }
    }
    return;
  }
  // idle: 새 일 고르기
  c.moving = false;
  const task = chooseTask(s, c, SERVER.carry[m.grade]);
  if (task) {
    c.task = task;
    c.state = 'walk';
    c.stateT = 0;
    walkTo(s, c, task.to, false, routeBlockers(s, c, task.to));
    return;
  }
  const g = geoOf(s.stage);
  const servers = s.dayState!.cats.filter((k) => k.kind === 'server');
  const home = g.idle[Math.max(0, servers.indexOf(c)) % g.idle.length];
  c.stateT += dt;
  if (Math.hypot(home.x - c.x, home.z - c.z) > 0.3 && !c.carry.length && c.stateT > MOVE.serverHomeDelaySec) {
    c.task = { k: 'home', to: home };
    c.state = 'walk';
    walkTo(s, c, home);
  } else faceToward(c, c.x, c.z - 1, dt);
}

/** 영업이 끝나면 들고 있던 그릇은 사라진 것으로 (다음 날 그릇은 모두 깨끗하게 시작) */
export function clearStaffTasks(s: GameState): void {
  for (const c of s.dayState!.cats) if (c.kind === 'server') { releaseTask(s, c); c.carry = []; }
}
