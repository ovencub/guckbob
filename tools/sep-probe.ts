import { newGame } from '../src/sim/state';
import { startDay, step } from '../src/sim/sim';
import { PlayerBot } from '../src/sim/bot';
import { inHall } from '../src/sim/movement';
import type { SimEvent } from '../src/sim/types';
const s = newGame(Number(process.argv[2] ?? 7)); s.tutorial = false;
startDay(s);
const bot = new PlayerBot(2.0);
const ev: SimEvent[] = [];
let worst = 9; let info = '';
let tick = 0;
while (s.phase !== 'settle') {
  bot.tick(s, 1 / 30, ev); step(s, ev); tick++;
  const ds = s.dayState; if (!ds) break;
  const h = ds.cats.filter(inHall);
  for (let a = 0; a < h.length; a++) for (let b = a + 1; b < h.length; b++) {
    const d = Math.hypot(h[a].x - h[b].x, h[a].z - h[b].z);
    // interpolated midpoint check too
    const mx = (h[a].x + h[a].px) / 2 - (h[b].x + h[b].px) / 2, mz = (h[a].z + h[a].pz) / 2 - (h[b].z + h[b].pz) / 2;
    const dm = Math.hypot(mx, mz);
    const m = Math.min(d, dm);
    if (m < worst) { worst = m; info = `t=${ds.t.toFixed(2)} ${h[a].id}:${h[a].state}(${h[a].x.toFixed(2)},${h[a].z.toFixed(2)}) ${h[b].id}:${h[b].state}(${h[b].x.toFixed(2)},${h[b].z.toFixed(2)}) d=${d.toFixed(3)} mid=${dm.toFixed(3)}`; }
  }
}
console.log('min', worst.toFixed(3), info);
