// 하루 흐름 (GDD 3장): 정비 → 영업 시작!(1초) → 영업 120초 → 마감·남은 손님(최대 15초) → 정산 → 정비
import { DAY, SIM_DT, TUTORIAL } from '../data/balance';
import { PROMO_BY_ID } from '../data/promos';
import { TIER_MICHELIN } from '../data/tiers';
import { admitFromQueue, forceLeaveAll, leaveQueue, scheduleVip, spawnArrivals, updateGuest, updateTeams } from './customers';
import { settle } from './economy';
import { updateBurners } from './kitchen';
import { clearStaffTasks, placeStaff, updateChefs, updateDishwasher, updateServer } from './staffAI';
import { newDayState, rating, sinkCap } from './state';
import type { DayReport, GameState, SimEvent } from './types';

export function startDay(s: GameState): void {
  if (s.phase !== 'prep') return;
  s.dayState = newDayState(s);
  for (const b of s.bought) {
    const def = PROMO_BY_ID[b.id];
    if (def.bonus > 0) s.promos.push({ id: b.id, days: def.days });
  }
  scheduleVip(s, s.bought.some((b) => b.id === 'vip'));
  if (s.tutorial && s.day === 1) {
    s.dayState.scriptedLeft = TUTORIAL.teams;
    s.dayState.scriptedNext = s.dayState.nextArrival;
  }
  placeStaff(s);
  s.phase = 'countdown';
}

export function skipTutorial(s: GameState): void {
  s.tutorial = false;
  const ds = s.dayState;
  if (ds && ds.scriptedLeft > 0) { ds.scriptedLeft = 0; ds.nextArrival = Math.min(ds.nextArrival, ds.t + 0.5); }
}

/** 고정 스텝 하나 진행 */
export function step(s: GameState, events: SimEvent[], dt = SIM_DT): void {
  const ds = s.dayState;
  if (!ds) return;
  const emit = (e: SimEvent) => { events.push(e); };
  for (const c of ds.cats) { c.px = c.x; c.pz = c.z; c.pry = c.ry; c.py = c.y; }
  if (s.phase === 'countdown') {
    ds.overT += dt;
    if (ds.overT >= DAY.countdownSec) { ds.overT = 0; s.phase = 'open'; ds.ratingOpen = rating(s); emit({ k: 'open' }); }
    return;
  }
  if (s.phase !== 'open' && s.phase !== 'overtime') return;
  const open = s.phase === 'open';
  if (open) {
    ds.t += dt;
    spawnArrivals(s, dt, true, emit);
    if (ds.t >= DAY.openSec) {
      s.phase = 'overtime';
      // 웨이팅 줄은 조용히 해산 (페널티 없음)
      for (const id of [...ds.queue]) { const t = ds.teams.find((x) => x.id === id); if (t) leaveQueue(s, t, emit); }
      ds.queue = [];
      emit({ k: 'close' });
    }
  } else ds.overT += dt;

  updateTeams(s, dt, emit);
  if (s.phase === 'open') admitFromQueue(s, emit);
  updateBurners(s, dt, emit);
  updateChefs(s, emit);
  updateDishwasher(s, dt, emit);
  for (const c of ds.cats) {
    if (c.kind === 'guest') updateGuest(s, c, dt, emit);
    else if (c.kind === 'server') updateServer(s, c, dt, emit);
  }
  ds.cats = ds.cats.filter((c) => c.state !== 'gone');
  ds.washCd = Math.max(0, ds.washCd - dt);
  if (ds.comboT > 0) { ds.comboT -= dt; if (ds.comboT <= 0) ds.comboN = 0; }
  if (ds.clean === 0) ds.bowlZeroSec += dt;
  if (ds.sink >= sinkCap(s)) ds.sinkFullSec += dt;

  if (s.phase === 'overtime') {
    const busy = ds.teams.some((t) => t.state === 'entering' || t.state === 'seated');
    if (!busy || ds.overT >= DAY.overtimeMaxSec) endDay(s, emit);
  }
}

function endDay(s: GameState, emit: (e: SimEvent) => void): void {
  const ds = s.dayState!;
  forceLeaveAll(s, emit);
  // 테이블에 남은 동전은 자동 수금 (결정 로그)
  for (const tb of ds.tables) if (tb.dirty && tb.coins > 0) { ds.revenue += tb.coins; s.money += tb.coins; tb.coins = 0; }
  clearStaffTasks(s);
  s.phase = 'settle';
  settle(s, ds.ratingOpen);
  emit({ k: 'dayEnd' });
}

/** 정산 확인 → 정비 시간 (미슐랭이면 엔딩) */
export function finishSettle(s: GameState): DayReport | null {
  if (s.phase !== 'settle') return null;
  const rep = s.lastReport;
  s.day++;
  s.dayState = null;
  s.tutorial = false;
  if (s.tier >= TIER_MICHELIN && !s.ended) { s.ended = true; s.phase = 'ended'; }
  else s.phase = 'prep';
  return rep;
}

export function continueEndless(s: GameState): void {
  s.endless = true;
  s.phase = 'prep';
}
