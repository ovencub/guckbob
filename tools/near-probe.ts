import { newGame } from '../src/sim/state';
import { startDay, step } from '../src/sim/sim';
import { PlayerBot } from '../src/sim/bot';
import { nearMichelin } from '../src/debugPreset';
import type { SimEvent } from '../src/sim/types';
for (const promo of [true, false]) {
  const s = newGame(4); s.tutorial = false; nearMichelin(s); if (!promo) s.promos = [];
  startDay(s); const bot = new PlayerBot(2); const ev: SimEvent[] = [];
  while (s.phase !== 'settle') { bot.tick(s, 1 / 30, ev); step(s, ev); ev.length = 0; }
  const r = s.lastReport!;
  console.log(`promo ${promo}: sold ${r.sold} teams ${r.teams} angry ${r.angry} (${r.angryTeams} teams) reviewAvg ${r.reviewAvg.toFixed(2)} rating ${r.ratingAfter.toFixed(2)} tier ${r.tierAfter}`);
}
