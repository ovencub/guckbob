// 진행 모델 가정 vs 구현 비교: N일까지 봇으로 진행한 뒤 다음 날의 테이블 회전·리뷰 구성 요소를 잰다
import { SIM_DT } from '../src/data/balance';
import { PlayerBot } from '../src/sim/bot';
import { botShop } from '../src/sim/botPlan';
import { finishSettle, startDay, step } from '../src/sim/sim';
import { newGame, playerTaste } from '../src/sim/state';
import type { SimEvent } from '../src/sim/types';
const N = Number(process.argv[2] ?? 20); const tap = Number(process.argv[3] ?? 1.3);
const s = newGame(1000); const bot = new PlayerBot(tap); const cur = { i: 0 }; const ev: SimEvent[] = [];
for (let d = 1; d <= N; d++) { startDay(s); while (s.phase !== 'settle') { bot.tick(s, SIM_DT, ev); step(s, ev); ev.length = 0; } finishSettle(s); botShop(s, cur); s.phase = 'prep'; }
console.log('day', s.day, 'stage', s.stage, 'burners', s.burners, 'bowls', s.bowls, 'sink', s.sinkLevel, 'kiosk', s.kiosk, 'taste', s.taste, 'staff', s.staff.map((m) => m.role[0] + m.grade).join(','), 'playerTaste', playerTaste(s));
startDay(s);
const assigned = new Map<number, number>(), seated = new Map<number, number>(), served = new Map<number, number>(), left = new Map<number, number>();
const dirtyFrom = new Map<number, number>(); let dirtySum = 0, dirtyN = 0;
const hist: Record<string, number> = {}; const bl: Record<string, number> = {}; let carrySum = 0, carryN = 0;
let K = 0, T = 0, P = 0, n = 0, playerServes = 0, serverServes = 0, playerTaps = 0;
while (s.phase !== 'settle') {
  if (bot.tick(s, SIM_DT, ev)) playerTaps++;
  step(s, ev);
  const ds = s.dayState!; const now = ds.t + ds.overT;
  for (const e of ev) if (e.k === 'serve') { if (e.by < 0) playerServes++; else serverServes++; }
  ev.length = 0;
  for (const t of ds.teams) {
    if (t.state === 'entering' && !assigned.has(t.id)) assigned.set(t.id, now);
    if (t.state === 'seated' && !seated.has(t.id)) seated.set(t.id, now);
    if (t.state === 'seated' && t.orders.every((o) => o.served) && !served.has(t.id)) { served.set(t.id, now); T += t.orders.reduce((a, o) => a + o.dish!.taste, 0) / t.size; K += t.orders.reduce((a, o) => a + o.kind, 0) / t.size; P += t.doneP; n++; }
    if ((t.state === 'leaving' || t.state === 'gone') && !left.has(t.id) && seated.has(t.id)) left.set(t.id, now);
  }
  for (const c of ds.cats) if (c.kind === 'server') { const k = `${c.state}:${c.task?.k ?? '-'}`; hist[k] = (hist[k] ?? 0) + 1; if (c.state === 'walk' && c.blockedT > 0.1) { hist.blocked = (hist.blocked ?? 0) + 1; const near = ds.cats.filter((o) => o !== c && Math.hypot(o.x - c.x, o.z - c.z) < 1.0).map((o) => o.kind + ':' + o.state).join('+') || 'none'; const key = `${c.task?.k}@${Math.round(c.x)},${Math.round(c.z)} by ${near}`; bl[key] = (bl[key] ?? 0) + 1; } if (c.task?.k === 'deliver' && c.state === 'act') { carrySum += c.carry.length; carryN++; } }
  for (const tb of ds.tables) { if (tb.dirty && !dirtyFrom.has(tb.id)) dirtyFrom.set(tb.id, now); if (!tb.dirty && dirtyFrom.has(tb.id)) { dirtySum += now - dirtyFrom.get(tb.id)!; dirtyN++; dirtyFrom.delete(tb.id); } }
}
const avg = (m1: Map<number, number>, m2: Map<number, number>) => { let a = 0, c = 0; for (const [k, v] of m2) if (m1.has(k)) { a += v - m1.get(k)!; c++; } return (a / Math.max(1, c)).toFixed(2); };
const r = s.lastReport!;
console.log(`sold ${r.sold} teams ${r.teams} missed ${r.missed} rating ${r.ratingAfter.toFixed(2)} reviewAvg ${r.reviewAvg.toFixed(2)}`);
console.log(`walk-in ${avg(assigned, seated)}s  seated→served ${avg(seated, served)}s  served→leave ${avg(served, left)}s  dirty ${(dirtySum / Math.max(1, dirtyN)).toFixed(2)}s`);
console.log(`avg T ${(T / n).toFixed(2)} K ${(K / n).toFixed(2)} p ${(P / n).toFixed(2)}  serves player ${playerServes} server ${serverServes}  playerTaps ${playerTaps} bowlZero ${r.bowlZeroSec.toFixed(0)} sinkFull ${r.sinkFullSec.toFixed(0)}`);
console.log(Object.entries(hist).map(([k, v]) => `${k} ${(v / 30).toFixed(0)}s`).join(' | '), 'avgCarryAtDeliver', (carrySum / Math.max(1, carryN)).toFixed(2));
console.log(Object.entries(bl).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}: ${(v / 30).toFixed(1)}s`).join(' ;; '));
