// 사람 흉내 봇 일별 진행: npx tsx tools/sim-days-h.ts <시드> <탭> <일수>
import { runGame } from './sim';
import { TIERS } from '../src/data/tiers';

const r = runGame(Number(process.argv[2] ?? 1000), Number(process.argv[3] ?? 1.3), Number(process.argv[4] ?? 40), true);
for (const d of r.rows) {
  console.log([d.day, d.sold, `${(d.revenue / 1000).toFixed(0)}k`, `net${(d.net / 1000).toFixed(0)}k`, `r${d.rating.toFixed(2)}`, `rv${d.reviewAvg.toFixed(2)}`,
    TIERS[d.tier].name, `money${(d.money / 1000).toFixed(0)}k`, `ang${d.angry}`, `miss${d.missed}`, d.bought.join(',')].join('\t'));
}
console.log(r.michelin ? `MICHELIN ${r.days} ${r.minutes.toFixed(1)}m` : 'no', JSON.stringify(r.reached));
