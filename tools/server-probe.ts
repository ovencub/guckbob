import { newGame } from '../src/sim/state';
import { startDay, step } from '../src/sim/sim';
import { hire } from '../src/sim/catalog';
import type { SimEvent } from '../src/sim/types';
const s = newGame(1); s.tutorial = false;
s.stage = Number(process.argv[2] ?? 3); s.burners = 2 + s.stage; s.bowls = 30; s.sinkLevel = 3; s.kiosk = false;
s.menus = { sundae: true, spicy: true, suyuk: false };
for (let i = 0; i < 3; i++) hire(s, 'chef', 3); hire(s, 'server', 3); hire(s, 'server', 2); hire(s, 'dish', 3);
startDay(s);
const ev: SimEvent[] = [];
const hist: Record<string, number> = {};
let blocked = 0, tick = 0;
while (s.phase !== 'settle') {
  step(s, ev); tick++;
  const ds = s.dayState!; if (!ds) break;
  for (const c of ds.cats) if (c.kind === 'server') {
    const k = `${c.state}:${c.task?.k ?? '-'}`; hist[k] = (hist[k] ?? 0) + 1;
    if (c.blockedT > 0.2) blocked++;
    if (tick % 300 === 0) console.log(`t=${ds.t.toFixed(0)} srv#${c.id} ${k} at(${c.x.toFixed(2)},${c.z.toFixed(2)}) goal ${c.goal ? c.goal.x.toFixed(2) + ',' + c.goal.z.toFixed(2) : '-'} blk ${c.blockedT.toFixed(1)} carry ${c.carry.length} path ${c.path.length}`);
  }
}
console.log(hist, 'blockedTicks', blocked, 'report', JSON.stringify({ sold: s.lastReport!.sold, teams: s.lastReport!.teams, angry: s.lastReport!.angry }));
