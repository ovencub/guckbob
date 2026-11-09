import { newGame } from '../src/sim/state';
import { startDay, step, finishSettle } from '../src/sim/sim';
import * as cmd from '../src/sim/commands';
import type { SimEvent } from '../src/sim/types';
const s = newGame(42);
const ev: SimEvent[] = [];
const t0 = Date.now();
for (let d = 0; d < 3; d++) {
  startDay(s);
  let ticks = 0;
  while (s.phase !== 'settle' && ticks < 30 * 200) {
    step(s, ev); ticks++;
    const ds = s.dayState!;
    // 아주 단순한 플레이: 모든 걸 바로 처리
    if (ticks % 6 === 0) {
      ds.tables.forEach((tb) => cmd.tapTable(s, tb.id, ev));
      ds.burners.forEach((b, i) => { if (b.phase !== 'cooking') cmd.tapBurner(s, i, ev); });
      ds.pass.forEach((p, i) => p && cmd.serve(s, i, ev));
      cmd.wash(s, ev);
    }
  }
  const r = s.lastReport!;
  console.log(`day ${r.day} ticks ${ticks} rev ${r.revenue} sold ${r.sold} teams ${r.teams} missed ${r.missed} angry ${r.angry} burnt ${r.burnt} net ${r.net} rating ${r.ratingAfter.toFixed(2)}`);
  finishSettle(s);
}
console.log('ms', Date.now() - t0, 'events', ev.length);
