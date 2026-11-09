// sim 위치로 근사한 손님 몸 ↔ 의자 관통 탐지 (자기 의자 예외는 렌더 검사기와 같은 규칙)
import { newGame, geoOf } from '../src/sim/state';
import { startDay, step } from '../src/sim/sim';
import { PlayerBot } from '../src/sim/bot';
import { applyPreset } from '../src/debugPreset';
import type { SimEvent } from '../src/sim/types';
const s = newGame(Number(process.argv[2] ?? 21)); s.tutorial = false; applyPreset(s);
startDay(s); const bot = new PlayerBot(1.3); const ev: SimEvent[] = [];
const g = geoOf(s.stage); const stools = g.colliders.filter((b) => b.kind === 'stool');
const exempt = ['enterSeat', 'sitting', 'seated', 'standing', 'exitSeat'];
let n = 0;
while (s.phase !== 'settle' && n < 20) {
  bot.tick(s, 1 / 30, ev); step(s, ev); const ds = s.dayState!;
  for (const c of ds.cats) {
    if (c.kind !== 'guest' || c.state === 'queue' || c.state === 'spawnWait') continue;
    const tm = ds.teams.find((t) => t.id === c.team);
    const seat = tm && tm.table >= 0 && exempt.includes(c.state) ? g.tables[tm.table].seats[c.seat] : null;
    for (const b of stools) {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      if (seat && Math.hypot(cx - seat.x, cz - seat.z) < 0.05) continue;
      const y = c.y + 0.47;
      const d = Math.hypot(Math.max(b.x0 - c.x, 0, c.x - b.x1), Math.max(0 - y, 0, y - b.y1), Math.max(b.z0 - c.z, 0, c.z - b.z1));
      if (0.4 - d > 0.02) { n++; console.log(`t=${ds.t.toFixed(2)} cat ${c.id} ${c.state} team ${tm?.state} at(${c.x.toFixed(2)},${c.z.toFixed(2)},y${c.y.toFixed(2)}) seat ${c.seat} pen ${(0.4 - d).toFixed(3)} stool(${cx.toFixed(2)},${cz.toFixed(2)})`); }
    }
  }
}
