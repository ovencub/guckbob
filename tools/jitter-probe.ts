// 막힘 → 떨림(이동 방향이 틱마다 뒤집힘)·순간이동 측정: npx tsx tools/jitter-probe.ts [시드...]
import { newGame } from '../src/sim/state';
import { startDay, step } from '../src/sim/sim';
import { PlayerBot } from '../src/sim/bot';
import { hire } from '../src/sim/catalog';
import { applyPreset } from '../src/debugPreset';
import { inHall } from '../src/sim/movement';
import type { GameState, SimEvent } from '../src/sim/types';

function run(name: string, setup: (s: GameState) => void, seed: number): number[] {
  const s = newGame(seed); s.tutorial = false; setup(s); startDay(s);
  const bot = new PlayerBot(1.3); const ev: SimEvent[] = [];
  const last = new Map<number, [number, number]>();
  let flips = 0, stillBlocked = 0; const lastFlip = new Map<number, number>(); const jit: Record<string, number> = {}; let tick = 0;
  while (s.phase !== 'settle') {
    bot.tick(s, 1 / 30, ev); step(s, ev); ev.length = 0; tick++;
    const ds = s.dayState!;
    for (const c of ds.cats) {
      if (!inHall(c)) continue;
      const mx = c.x - c.px, mz = c.z - c.pz;
      if (Math.hypot(mx, mz) > 1e-4) {
        const l = last.get(c.id);
        if (l && mx * l[0] + mz * l[1] < 0) { flips++; const lf = lastFlip.get(c.id); if (lf !== undefined && tick - lf < 9) { const k = `${c.kind}:${c.state}:${c.dodgeT > 0 ? 'dodge' : ''}`; jit[k] = (jit[k] ?? 0) + 1; } lastFlip.set(c.id, tick); }
        last.set(c.id, [mx, mz]);
      }
      if (c.goal && c.blockedT > 0.5) stillBlocked += 1 / 30;
    }
  }
  const ds = s.dayState!;
  console.log(JSON.stringify(jit));
  console.log(`${name}: 방향 뒤집힘 ${flips}회 · 0.5초+ 막힘 ${stillBlocked.toFixed(0)}초 · 순간이동 ${ds.teleports}회 · 판매 ${s.lastReport!.sold}`);
  return [flips, stillBlocked, ds.teleports];
}
for (const seed of process.argv.slice(2).map(Number).length ? process.argv.slice(2).map(Number) : [5, 6]) {
  run(`중반 s${seed}`, (s) => { s.stage = 1; s.burners = 4; s.bowls = 14; s.kiosk = true; s.menus.spicy = true; hire(s, 'server', 1); hire(s, 'chef', 1); s.reviews = Array.from({ length: 50 }, () => 2.6); s.tier = 2; }, seed);
  run(`후반 s${seed}`, (s) => applyPreset(s, 'full'), seed);
}
