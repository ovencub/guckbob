// 한 시드의 일별 진행 출력: npx tsx tools/sim-days.ts <시드> <탭> <일수>
import { runGame } from './sim';
import { TIERS } from '../src/data/tiers';

const r = runGame(Number(process.argv[2] ?? 1000), Number(process.argv[3] ?? 1.3), Number(process.argv[4] ?? 40));
for (const d of r.rows) {
  console.log([d.day, d.sold, `${(d.revenue / 1000).toFixed(0)}k`, `net ${(d.net / 1000).toFixed(0)}k`, `r${d.rating.toFixed(2)}`, TIERS[d.tier].name,
    `money ${(d.money / 1000).toFixed(0)}k`, `miss${d.missed}`, `ang${d.angry}`, `vip:${d.vip}`, `${d.minutes.toFixed(1)}m`, d.bought.join(',')].join('\t'));
}
console.log(r.michelin ? `MICHELIN day ${r.days} ${r.minutes.toFixed(1)}m` : 'no michelin', JSON.stringify(r.reached));
