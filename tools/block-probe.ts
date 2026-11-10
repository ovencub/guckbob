// 서버 ↔ 손님 막힘 측정: npx tsx tools/block-probe.ts [시드]
// 하루 동안 "막혀서 못 움직인" 시간을 누가 누구를 막았는지로 나눠 센다 (0.3초 넘게 진전 없는 경우).
import { newGame } from '../src/sim/state';
import { startDay, step } from '../src/sim/sim';
import { PlayerBot } from '../src/sim/bot';
import { hire } from '../src/sim/catalog';
import { applyPreset } from '../src/debugPreset';
import { inHall } from '../src/sim/movement';
import type { GameState, SimEvent } from '../src/sim/types';

function scenario(name: string, setup: (s: GameState) => void, seed: number): void {
  const s = newGame(seed); s.tutorial = false; setup(s);
  startDay(s);
  const bot = new PlayerBot(1.3); const ev: SimEvent[] = [];
  let srvByGuest = 0, guestBySrv = 0, srvStuckLong = 0, guestPoof = 0, delivered = 0;
  while (s.phase !== 'settle') {
    bot.tick(s, 1 / 30, ev); step(s, ev);
    const ds = s.dayState!;
    for (const e of ev) { if (e.k === 'serve' && e.by >= 0) delivered++; }
    ev.length = 0;
    const hall = ds.cats.filter(inHall);
    for (const c of hall) {
      if (c.blockedT < 0.3 || !c.goal) continue;
      const near = hall.filter((o) => o !== c && Math.hypot(o.x - c.x, o.z - c.z) < 1.0);
      if (c.kind === 'server' && near.some((o) => o.kind === 'guest')) { srvByGuest += 1 / 30; if (c.blockedT > 1.5) srvStuckLong += 1 / 30; }
      if (c.kind === 'guest' && near.some((o) => o.kind === 'server')) guestBySrv += 1 / 30;
      if (c.kind === 'guest' && c.blockedT > 1.5) guestPoof += 1 / 30;
    }
  }
  const r = s.lastReport!;
  console.log(`${name}: 서버가 손님에 막힘 ${srvByGuest.toFixed(1)}s (1.5초 넘게 ${srvStuckLong.toFixed(1)}s) · 손님이 서버에 막힘 ${guestBySrv.toFixed(1)}s · 손님 1.5초+ 끼임 ${guestPoof.toFixed(1)}s · 서버 서빙 ${delivered} · 판매 ${r.sold} · 리뷰 ${r.reviewAvg.toFixed(2)}`);
}

const seed = Number(process.argv[2] ?? 5);
scenario('중반(2단계·서버 일반 1)', (s) => { s.stage = 1; s.burners = 4; s.bowls = 14; s.kiosk = true; s.menus.spicy = true; hire(s, 'server', 1); hire(s, 'chef', 1); s.reviews = Array.from({ length: 50 }, () => 2.6); s.tier = 2; }, seed);
scenario('후반(4단계·풀세트)', (s) => applyPreset(s, 'full'), seed);
