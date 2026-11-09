// 손님: 도착·웨이팅·착석·주문·인내심·식사·퇴장 (GDD 4.1~4.7)
import { ARRIVAL, LOOKS, REVIEW, TABLE, TUTORIAL, VIP } from '../data/balance';
import { MOVE, SEAT_RULES } from '../data/layouts';
import { MENUS, type MenuId } from '../data/menus';
import { TIER_TOURIST } from '../data/tiers';
import { endCombo } from './combo';
import { faceToward, place, spotClear, stepStraight, stepWalk, walkTo } from './movement';
import { pushReview, sampleReview } from './review';
import { rand, randInt, randRange, weighted } from './rng';
import { arrivalRate, blankCat, geoOf, kindnessOf, maxTableCap, priceOf, queuePatience } from './state';
import type { Cat, GameState, OrderItem, SimEvent, Team } from './types';
import { MENU_BY_ID } from '../data/menus';
import { COST_RESEARCH } from '../data/research';

type Emit = (e: SimEvent) => void;

/** 착석 후 경과 비율 (0~1) */
export function patienceUsed(s: GameState, t: Team): number {
  if (t.state !== 'seated') return 0;
  const end = t.orders.every((o) => o.served) ? t.seatedT + t.doneP * t.patience : s.dayState!.t;
  return Math.min(1, (end - t.seatedT) / t.patience);
}

/** 50% 노랑·발 구르기, 80% 빨강·흔들림 */
export function patienceLevel(used: number): 'ok' | 'warn' | 'danger' {
  return used >= TABLE.dangerRatio ? 'danger' : used >= TABLE.warnRatio ? 'warn' : 'ok';
}

export function teamPatience(t: Team): number {
  const base = TABLE.patienceBase + TABLE.patiencePerExtra * (t.size - 1);
  return t.scripted ? base * TUTORIAL.patienceMult : base;
}

function pickOrders(s: GameState, size: number): OrderItem[] {
  const out: OrderItem[] = [];
  const counts: Partial<Record<MenuId, number>> = {};
  for (let i = 0; i < size; i++) {
    const opts = MENUS.filter((m) => s.menus[m.id] && size >= m.minTeam && (!m.maxPerTeam || (counts[m.id] ?? 0) < m.maxPerTeam))
      .map((m) => [m.id, m.weight] as const);
    const menu = weighted(s, opts);
    counts[menu] = (counts[menu] ?? 0) + 1;
    out.push({ menu, member: i, served: false, dish: null, kind: 0, eatT: 0, reserved: 0 });
  }
  return out;
}

export function makeTeam(s: GameState, size: number, o: { vip?: boolean; scripted?: boolean } = {}): Team {
  const ds = s.dayState!;
  const t: Team = {
    id: ds.nextId++, size, vip: !!o.vip, tourist: !o.vip && s.tier >= TIER_TOURIST && rand(s) < 0.35, scripted: !!o.scripted,
    state: 'queue', table: -1, members: [], orders: pickOrders(s, size), orderTaken: false, seatedT: 0, patience: 0,
    arriveT: ds.t, queuePatience: queuePatience(s), lastServedT: 0, doneP: 0, kioskAt: -1, angry: false, spawnLeft: size,
  };
  t.patience = teamPatience(t);
  ds.teams.push(t);
  return t;
}

function pickSize(s: GameState): number {
  const cap = maxTableCap(s);
  return weighted(s, ARRIVAL.groupWeights.filter(([n]) => n <= cap));
}

/** 인원이 들어가는 가장 작은 빈 테이블 (치워지지 않은 테이블은 빈 테이블이 아니다) */
export function findTable(s: GameState, size: number): number {
  const ds = s.dayState!;
  const g = geoOf(s.stage);
  let best = -1;
  for (const tb of ds.tables) {
    const cap = g.tables[tb.id].cap;
    if (tb.team >= 0 || tb.dirty || cap < size) continue;
    if (best < 0 || cap < g.tables[best].cap) best = tb.id;
  }
  return best;
}

function seatOrder(n: number, cols: number): number[] {
  // 좌석 배열은 [앞줄 cols개, 뒷줄 cols개]. 마주 보게 번갈아 채운다
  const out: number[] = [];
  for (let c = 0; c < cols; c++) { out.push(c, cols + c); }
  return out.slice(0, n);
}

function seatTeam(s: GameState, t: Team, table: number, emit: Emit): void {
  const ds = s.dayState!;
  t.table = table;
  t.state = 'entering';
  ds.tables[table].team = t.id;
  const g = geoOf(s.stage);
  const order = seatOrder(t.size, g.tables[table].seats.length / 2);
  // 웨이팅 줄 대표 고양이는 사라지고, 팀이 문 안쪽에서 한 마리씩 나타난다
  for (const id of t.members) {
    const c = ds.cats.find((k) => k.id === id);
    if (c) { emit({ k: 'poof', x: c.x, z: c.z, y: 0 }); c.state = 'gone'; }
  }
  t.members = [];
  for (let i = 0; i < t.size; i++) {
    const c = blankCat(ds.nextId++, 'guest', g.spawn.x, g.spawn.z, Math.PI);
    c.team = t.id; c.seat = order[i]; c.state = 'spawnWait'; c.speed = MOVE.customerSpeed;
    c.fur = randInt(s, LOOKS.furKinds); c.scarf = randInt(s, LOOKS.scarfKinds);
    t.orders[i].member = i;
    ds.cats.push(c);
    t.members.push(c.id);
  }
  t.spawnLeft = t.size;
}

function enqueue(s: GameState, t: Team, emit: Emit): void {
  const ds = s.dayState!;
  if (ds.queue.length >= ARRIVAL.maxQueue) {
    t.state = 'gone';
    ds.missed += t.size;
    emit({ k: 'queueFull', team: t.id });
    return;
  }
  const g = geoOf(s.stage);
  const slot = g.queue[ds.queue.length];
  ds.queue.push(t.id);
  ds.peakQueue = Math.max(ds.peakQueue, ds.queue.length);
  const c = blankCat(ds.nextId++, 'guest', slot.x - 1.2, slot.z, Math.PI / 2);
  c.team = t.id; c.state = 'queue'; c.speed = MOVE.customerSpeed;
  c.fur = randInt(s, LOOKS.furKinds); c.scarf = randInt(s, LOOKS.scarfKinds);
  ds.cats.push(c);
  t.members = [c.id];
  emit({ k: 'poof', x: slot.x - 1.2, z: slot.z, y: 0 });
}

export function arrive(s: GameState, t: Team, emit: Emit): void {
  emit({ k: 'arrive', team: t.id });
  const tb = findTable(s, t.size);
  if (tb >= 0 && (s.dayState!.queue.length === 0 || t.vip)) seatTeam(s, t, tb, emit);
  else enqueue(s, t, emit);
}

/** 자리가 나면 줄의 맨 앞부터 그 자리에 들어가는 첫 팀이 입장 (작은 팀 새치기 허용) */
export function admitFromQueue(s: GameState, emit: Emit): void {
  const ds = s.dayState!;
  for (let i = 0; i < ds.queue.length; i++) {
    const t = ds.teams.find((x) => x.id === ds.queue[i]);
    if (!t) continue;
    const tb = findTable(s, t.size);
    if (tb < 0) continue;
    ds.queue.splice(i, 1);
    seatTeam(s, t, tb, emit);
    i--;
  }
}

export function spawnArrivals(s: GameState, dt: number, open: boolean, emit: Emit): void {
  const ds = s.dayState!;
  if (!open) return;
  if (ds.scriptedLeft > 0) {
    if (ds.t >= ds.scriptedNext) {
      const idx = TUTORIAL.teams - ds.scriptedLeft;
      arrive(s, makeTeam(s, TUTORIAL.teamSizes[idx], { scripted: true }), emit);
      ds.scriptedLeft--;
      ds.scriptedNext = ds.t + TUTORIAL.gapSec;
      if (ds.scriptedLeft === 0) ds.nextArrival = ds.t + TUTORIAL.gapSec;
    }
    return;
  }
  if (ds.vipAt >= 0 && !ds.vipDone && ds.t >= ds.vipAt) {
    ds.vipDone = true;
    const v = makeTeam(s, VIP.size, { vip: true });
    emit({ k: 'vipArrive', team: v.id });
    arrive(s, v, emit);
  }
  if (ds.t >= ds.nextArrival) {
    arrive(s, makeTeam(s, pickSize(s)), emit);
    const lam = arrivalRate(s) / 60;
    const gap = -Math.log(1 - rand(s)) / lam;
    ds.nextArrival = ds.t + Math.max(ARRIVAL.minGapSec, gap);
  }
  void dt;
}

export function scheduleVip(s: GameState, has: boolean): void {
  const ds = s.dayState!;
  ds.vipAt = has ? randRange(s, VIP.arriveMinSec, VIP.arriveMaxSec) : -1;
}

/** 팀 단위 갱신: 줄 인내심, 키오스크, 테이블 인내심, 식사 끝 → 퇴장 */
export function updateTeams(s: GameState, dt: number, emit: Emit): void {
  const ds = s.dayState!;
  for (const t of ds.teams) {
    if (t.state === 'queue') {
      if (ds.t - t.arriveT > t.queuePatience) {
        ds.queue = ds.queue.filter((q) => q !== t.id);
        ds.missed += t.size;
        leaveQueue(s, t, emit);
      }
    } else if (t.state === 'leaving') {
      if (t.members.every((id) => { const c = ds.cats.find((k) => k.id === id); return !c || c.state === 'gone'; })) t.state = 'gone';
    } else if (t.state === 'seated') {
      if (!t.orderTaken && t.kioskAt >= 0 && ds.t >= t.kioskAt) { t.orderTaken = true; emit({ k: 'order', table: t.table, by: -2 }); }
      const allServed = t.orders.every((o) => o.served);
      if (!allServed && ds.t - t.seatedT >= t.patience) { angryLeave(s, t, emit); continue; }
      if (allServed && t.orders.every((o) => o.eatT >= TABLE.eatSec)) happyLeave(s, t, emit);
      for (const o of t.orders) if (o.served && o.eatT < TABLE.eatSec) {
        o.eatT += dt;
        if (o.eatT >= TABLE.eatSec) {
          const c = ds.cats.find((k) => k.id === t.members[o.member]);
          const tb = ds.tables[t.table];
          if (c && tb.seatDish[c.seat]) tb.seatDish[c.seat] = { menu: 'dirty', eaten: true };
          emit({ k: 'eatDone', table: t.table, seat: c ? c.seat : 0 });
        }
      }
    }
  }
  // 줄 앞당기기
  const g = geoOf(s.stage);
  ds.queue.forEach((id, i) => {
    const t = ds.teams.find((x) => x.id === id);
    const c = t && ds.cats.find((k) => k.id === t.members[0]);
    if (c && c.state === 'queue') stepStraight(c, g.queue[i], c.speed, dt);
  });
  ds.teams = ds.teams.filter((t) => t.state !== 'gone' || t.members.some((m) => ds.cats.some((c) => c.id === m && c.state !== 'gone')));
}

export function leaveQueue(s: GameState, t: Team, emit: Emit): void {
  const ds = s.dayState!;
  t.state = 'gone';
  for (const id of t.members) {
    const c = ds.cats.find((k) => k.id === id);
    if (c) { emit({ k: 'poof', x: c.x, z: c.z, y: 0 }); c.state = 'gone'; }
  }
  emit({ k: 'queueLeave', team: t.id });
}

function freeTable(s: GameState, t: Team): void {
  const ds = s.dayState!;
  const tb = ds.tables[t.table];
  if (tb.team === t.id) tb.team = -1;
}

function startLeaving(s: GameState, t: Team): void {
  const ds = s.dayState!;
  t.state = 'leaving';
  for (const id of t.members) {
    const c = ds.cats.find((k) => k.id === id);
    if (!c) continue;
    if (c.state === 'seated' || c.state === 'sitting') { c.state = 'standing'; c.stateT = 0; }
    else if (c.state === 'spawnWait') c.state = 'gone';
    else if (c.state === 'enterSeat') { c.state = 'exitSeat'; c.stateT = 0; walkTo(s, c, geoOf(s.stage).tables[t.table].seats[c.seat].approach, true); }
    else if (c.state === 'toSeat') { c.state = 'toExit'; walkTo(s, c, geoOf(s.stage).exit); }
  }
}

function happyLeave(s: GameState, t: Team, emit: Emit): void {
  const ds = s.dayState!;
  const tb = ds.tables[t.table];
  let T = 0;
  let K = 0;
  let pay = 0;
  for (const o of t.orders) {
    const d = o.dish!;
    T += d.taste; K += o.kind; pay += priceOf(d.menu, d.taste);
    ds.ingredients += MENU_BY_ID[d.menu].cost * (1 - s.costCut * COST_RESEARCH.cutPerLevel);
  }
  T /= t.orders.length; K /= t.orders.length;
  const score = sampleReview(s, T, K, t.doneP);
  pushReview(s.reviews, score, t.vip ? REVIEW.vipWeight : 1);
  ds.reviews.push(score);
  if (t.vip) { ds.vipScore = score; if (score >= REVIEW.vipPass) s.vipOk = true; }
  tb.dirty = true; tb.coins = pay; tb.bowls = t.orders.length;
  ds.sold += t.orders.length; ds.teamsServed++; ds.guests += t.size;
  freeTable(s, t);
  startLeaving(s, t);
  emit({ k: 'leave', team: t.id, table: t.table, happy: true });
  emit({ k: 'review', score, vip: t.vip, table: t.table });
}

export function angryLeave(s: GameState, t: Team, emit: Emit): void {
  const ds = s.dayState!;
  const tb = ds.tables[t.table];
  const placed = t.orders.filter((o) => o.served).length;
  pushReview(s.reviews, REVIEW.angryScore, t.vip ? REVIEW.vipWeight : 1);
  ds.reviews.push(REVIEW.angryScore);
  if (t.vip) ds.vipScore = REVIEW.angryScore;
  ds.angry += t.size;
  t.angry = true;
  for (let i = 0; i < tb.seatDish.length; i++) if (tb.seatDish[i]) tb.seatDish[i] = { menu: 'dirty', eaten: true };
  if (placed > 0) { tb.dirty = true; tb.coins = 0; tb.bowls = placed; }
  freeTable(s, t);
  startLeaving(s, t);
  endCombo(s);
  emit({ k: 'angry', team: t.id, table: t.table });
  emit({ k: 'review', score: REVIEW.angryScore, vip: t.vip, table: t.table });
}

/** 마감 후 15초가 지나도 남은 손님: 페널티 없이 퇴장 */
export function forceLeaveAll(s: GameState, emit: Emit): void {
  const ds = s.dayState!;
  for (const t of ds.teams) {
    if (t.state === 'gone') continue;
    if (t.table >= 0) freeTable(s, t);
    t.state = 'gone';
    for (const id of t.members) {
      const c = ds.cats.find((k) => k.id === id);
      if (c && c.state !== 'gone') { emit({ k: 'poof', x: c.x, z: c.z, y: c.y }); c.state = 'gone'; }
    }
  }
  ds.queue = [];
}

/** 손님 고양이 한 마리 갱신 */
export function updateGuest(s: GameState, c: Cat, dt: number, emit: Emit): void {
  const ds = s.dayState!;
  const g = geoOf(s.stage);
  const t = ds.teams.find((x) => x.id === c.team);
  c.stateT += dt;
  switch (c.state) {
    case 'spawnWait': {
      if (!t) { c.state = 'gone'; return; }
      // 팀원은 한 마리씩: 앞 팀원이 다 나타난 뒤, 입구가 비면
      const idx = t.members.indexOf(c.id);
      const prevWaiting = t.members.slice(0, idx).some((id) => ds.cats.find((k) => k.id === id)?.state === 'spawnWait');
      if (prevWaiting || !spotClear(s, g.spawn.x, g.spawn.z, c)) return;
      place(c, g.spawn.x, g.spawn.z); c.state = 'toSeat'; c.stateT = 0;
      t.spawnLeft--;
      emit({ k: 'poof', x: c.x, z: c.z, y: 0 });
      walkTo(s, c, g.tables[t.table].seats[c.seat].approach);
      break;
    }
    case 'toSeat': {
      if (stepWalk(s, c, dt)) { c.state = 'enterSeat'; c.stateT = 0; const st = g.tables[t!.table].seats[c.seat]; walkTo(s, c, st, true); }
      else if (c.blockedT > MOVE.stuckPoofSec) teleportToSeat(s, c, emit);
      break;
    }
    case 'enterSeat': {
      const st = g.tables[t!.table].seats[c.seat];
      // 의자 바로 앞에서 폴짝 올라간다 (위아래로만)
      c.y = SEAT_RULES.seatY * Math.max(0, Math.min(1, 1 - Math.hypot(st.x - c.x, st.z - c.z) / MOVE.hopDist)) * 0.5;
      if (stepWalk(s, c, dt)) { c.state = 'sitting'; c.stateT = 0; }
      else if (c.blockedT > MOVE.stuckPoofSec) teleportToSeat(s, c, emit);
      break;
    }
    case 'sitting': {
      const st = g.tables[t!.table].seats[c.seat];
      faceToward(c, c.x + Math.sin(st.ry), c.z + Math.cos(st.ry), dt);
      c.y = SEAT_RULES.seatY * (0.5 + 0.5 * Math.min(1, c.stateT / MOVE.sitSec));
      if (c.stateT >= MOVE.sitSec) { c.y = SEAT_RULES.seatY; c.ry = st.ry; c.state = 'seated'; c.stateT = 0; checkSeated(s, t!, emit); }
      break;
    }
    case 'standing': {
      c.y = SEAT_RULES.seatY * (1 - 0.5 * Math.min(1, c.stateT / MOVE.standSec));
      if (c.stateT >= MOVE.standSec) {
        c.state = 'exitSeat'; c.stateT = 0;
        const tb = g.tables[t ? t.table : 0];
        walkTo(s, c, tb.seats[c.seat].approach, true);
      }
      break;
    }
    case 'exitSeat': {
      const tbx = g.tables[t ? t.table : 0].seats[c.seat];
      c.y = SEAT_RULES.seatY * Math.max(0, Math.min(1, 1 - Math.hypot(tbx.x - c.x, tbx.z - c.z) / MOVE.hopDist)) * 0.5;
      if (stepWalk(s, c, dt)) { c.y = 0; c.state = 'toExit'; c.stateT = 0; walkTo(s, c, g.exit); }
      else if (c.blockedT > MOVE.stuckPoofSec) poofOut(c, emit);
      break;
    }
    case 'toExit': {
      if (stepWalk(s, c, dt)) poofOut(c, emit);
      else if (c.blockedT > MOVE.stuckPoofSec) poofOut(c, emit);
      break;
    }
    default:
      break;
  }
}

function poofOut(c: Cat, emit: Emit): void {
  emit({ k: 'poof', x: c.x, z: c.z, y: c.y });
  c.state = 'gone';
}

function teleportToSeat(s: GameState, c: Cat, emit: Emit): void {
  const t = s.dayState!.teams.find((x) => x.id === c.team);
  if (!t) return;
  const st = geoOf(s.stage).tables[t.table].seats[c.seat];
  if (!spotClear(s, st.x, st.z, c)) return;
  emit({ k: 'poof', x: c.x, z: c.z, y: 0 });
  place(c, st.x, st.z); c.path = []; c.goal = null; c.state = 'sitting'; c.stateT = 0; c.blockedT = 0;
  emit({ k: 'poof', x: c.x, z: c.z, y: 0 });
}

function checkSeated(s: GameState, t: Team, emit: Emit): void {
  const ds = s.dayState!;
  if (t.state !== 'entering') return;
  const all = t.members.every((id) => ds.cats.find((k) => k.id === id)?.state === 'seated');
  if (!all) return;
  t.state = 'seated';
  t.seatedT = ds.t;
  if (s.kiosk) t.kioskAt = ds.t + TABLE.kioskDelaySec;
  emit({ k: 'seated', team: t.id });
}

/** 주문 받기 (플레이어 탭·서버·키오스크) */
export function takeOrder(s: GameState, table: number, by: number, emit: Emit): boolean {
  const ds = s.dayState!;
  const tb = ds.tables[table];
  const t = tb && ds.teams.find((x) => x.id === tb.team);
  if (!t || t.state !== 'seated' || t.orderTaken) return false;
  t.orderTaken = true;
  tb.orderBy = 0;
  emit({ k: 'order', table, by });
  return true;
}

/** 메뉴를 기다리는 테이블에 그릇 놓기. 반환: 놓인 좌석 (없으면 -1) */
export function placeDish(s: GameState, t: Team, menu: MenuId, taste: number, by: number, dishId: number): number {
  const ds = s.dayState!;
  const o = t.orders.find((x) => !x.served && x.menu === menu);
  if (!o) return -1;
  o.served = true;
  o.dish = { id: dishId, menu, taste };
  o.kind = kindnessOf(s, by);
  o.eatT = 0;
  const c = ds.cats.find((k) => k.id === t.members[o.member]);
  const seat = c ? c.seat : 0;
  ds.tables[t.table].seatDish[seat] = { menu, eaten: false };
  if (t.orders.every((x) => x.served)) t.doneP = (ds.t - t.seatedT) / t.patience;
  t.lastServedT = ds.t;
  return seat;
}
