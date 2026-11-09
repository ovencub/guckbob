import { newGame } from '../src/sim/state';
import { startDay, step } from '../src/sim/sim';
import { hire } from '../src/sim/catalog';
import { PlayerBot } from '../src/sim/bot';
import { inHall } from '../src/sim/movement';
import type { SimEvent } from '../src/sim/types';
const seed = Number(process.argv[2] ?? 1); const tap = Number(process.argv[3] ?? 2);
const s = newGame(seed); s.tutorial = false;
s.stage = 3; s.burners = 6; s.bowls = 30; s.sinkLevel = 3; s.kiosk = process.argv[4] !== 'nokiosk'; s.tier = 4;
s.menus = { sundae: true, spicy: true, suyuk: true };
for (let i = 0; i < 3; i++) hire(s, 'chef', 3); hire(s, 'server', 3); hire(s, 'server', 2); hire(s, 'dish', 3);
s.promos = [{ id: 'tv', days: 3 }, { id: 'youtube', days: 3 }];
for (let i = 0; i < 50; i++) s.reviews.push(4.6);
startDay(s);
const bot = new PlayerBot(tap); const ev: SimEvent[] = [];
let minD = 9, poofs = 0, maxCats = 0; const t0 = Date.now();
while (s.phase !== 'settle') {
  bot.tick(s, 1 / 30, ev); step(s, ev);
  const ds = s.dayState!; if (!ds) break;
  const h = ds.cats.filter(inHall); maxCats = Math.max(maxCats, ds.cats.length);
  for (let a = 0; a < h.length; a++) for (let b = a + 1; b < h.length; b++) minD = Math.min(minD, Math.hypot(h[a].x - h[b].x, h[a].z - h[b].z));
}
for (const e of ev) if (e.k === 'poof') poofs++;
const r = s.lastReport!;
console.log(`seed ${seed} sold ${r.sold} rev ${r.revenue} teams ${r.teams} missed ${r.missed} angry ${r.angry} burnt ${r.burnt} review ${r.reviewAvg.toFixed(2)} minD ${minD.toFixed(3)} poofs ${poofs} maxCats ${maxCats} bot ${bot.actions} ms ${Date.now() - t0}`);
