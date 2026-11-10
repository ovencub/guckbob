// 주방 옆 4인석(T2) 주변 막힘 측정: 서버 대기 자리, 좌석 진입점, 그 근처에서 막힌 시간
import { newGame, geoOf } from '../src/sim/state';
import { startDay, step } from '../src/sim/sim';
import { PlayerBot } from '../src/sim/bot';
import { hire } from '../src/sim/catalog';
import { inHall } from '../src/sim/movement';
import type { SimEvent } from '../src/sim/types';

const g = geoOf(0);
const t2 = g.tables[1];
console.log('pickZ', g.pickZ.toFixed(2), 'idle', JSON.stringify(g.idle), 'T2 approach', JSON.stringify(t2.seats.map((s) => [+s.approach.x.toFixed(2), +s.approach.z.toFixed(2)])));
for (const seed of [3, 4, 5]) {
  const s = newGame(seed); s.tutorial = false; s.kiosk = true; s.menus.spicy = true; s.burners = 3; s.bowls = 12;
  hire(s, 'server', 1); hire(s, 'server', 1); hire(s, 'chef', 1);
  s.reviews = Array.from({ length: 50 }, () => 2.5); s.tier = 2;
  startDay(s);
  const bot = new PlayerBot(1.3); const ev: SimEvent[] = [];
  let near = 0, all = 0, tp0 = 0; const who: Record<string, number> = {}; const tps: string[] = [];
  while (s.phase !== 'settle') {
    const before = s.dayState!.teleports;
    const snap = s.dayState!.cats.map((c) => ({ id: c.id, kind: c.kind, st: c.state, x: c.x, z: c.z, by: c.blockedBy, bt: c.blockedT }));
    bot.tick(s, 1 / 30, ev); step(s, ev); ev.length = 0;
    const ds = s.dayState!;
    if (ds.teleports > before) {
      const v = snap.filter((c) => c.bt > 2).map((c) => { const o = snap.find((k) => k.id === c.by); return `${c.kind}:${c.st}@(${c.x.toFixed(1)},${c.z.toFixed(1)}) by ${o ? o.kind + ':' + o.st + '@(' + o.x.toFixed(1) + ',' + o.z.toFixed(1) + ')' : '-'}`; });
      tps.push(v.join(' ; '));
    }
    for (const c of ds.cats) {
      if (!inHall(c) || !c.goal || c.blockedT < 0.3) continue;
      all += 1 / 30;
      if (Math.abs(c.x - t2.x) < 1.8 && c.z < t2.z) {
        near += 1 / 30;
        const o = ds.cats.find((k) => k.id === c.blockedBy);
        const key = `${c.kind}:${c.task?.k ?? c.state} by ${o ? o.kind + ':' + (o.task?.k ?? o.state) + (o.moving ? '' : '(서있음)') : 'none'}`;
        who[key] = (who[key] ?? 0) + 1 / 30;
      }
    }
  }
  console.log(`seed ${seed}: 막힘 합계 ${all.toFixed(0)}초 중 T2 앞(주방 쪽) ${near.toFixed(0)}초 · 순간이동 ${s.dayState!.teleports}회 · 판매 ${s.lastReport!.sold}`);
  void tp0;
  for (const t of tps) console.log('    TP', t);
  console.log('   ', Object.entries(who).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(1)}s`).join(' | '));
}
