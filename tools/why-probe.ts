// 같은 19일차 가게에서 봇의 행동을 하나씩 빼 보면 화난 손님·별점이 어떻게 되나
import { SIM_DT } from '../src/data/balance';
import { BOT } from '../src/data/bot';
import { PlayerBot } from '../src/sim/bot';
import { botShop } from '../src/sim/botPlan';
import { finishSettle, startDay, step } from '../src/sim/sim';
import { newGame } from '../src/sim/state';
import type { GameState, SimEvent } from '../src/sim/types';

function upTo(day: number, seed: number): GameState {
  const s = newGame(seed); const bot = new PlayerBot(1.3); const cur = { i: 0 }; const ev: SimEvent[] = [];
  for (let d = 1; d < day; d++) { startDay(s); while (s.phase !== 'settle') { bot.tick(s, SIM_DT, ev); step(s, ev); ev.length = 0; } finishSettle(s); botShop(s, cur); s.phase = 'prep'; }
  return s;
}
function play(base: GameState, name: string, tweak: (s: GameState, b: PlayerBot) => void): void {
  let ang = 0, angT = 0, rev = 0, n = 0, miss = 0, pServe = 0, sServe = 0;
  for (let k = 0; k < 4; k++) {
    const s = JSON.parse(JSON.stringify(base)) as GameState; s.rng = 777 + k;
    const b = new PlayerBot(1.3); tweak(s, b);
    startDay(s); const ev: SimEvent[] = [];
    while (s.phase !== 'settle') { b.tick(s, SIM_DT, ev); step(s, ev); for (const e of ev) if (e.k === 'serve') { if (e.by < 0) pServe++; else sServe++; } ev.length = 0; }
    const r = s.lastReport!; ang += r.angry; angT += r.angryTeams; rev += r.reviewAvg; n++; miss += r.missed;
  }
  console.log(`${name.padEnd(34)} 화난 손님 ${(ang / n).toFixed(1)}명(${(angT / n).toFixed(1)}팀)/일 · 하루 리뷰 평균 ${(rev / n).toFixed(2)} · 서빙 플레이어:서버 ${pServe}:${sServe} · 놓친 손님 ${(miss / n).toFixed(0)}`);
}
const base = upTo(19, 1000);
console.log('19일차 가게:', `단계${base.stage + 1} 화구${base.burners} 직원 ${base.staff.map((m) => m.role + m.grade).join(',')} 키오스크 ${base.kiosk}`);
const B = BOT as unknown as Record<string, number>;
const keep = { u: B.urgentRatio, w: B.passWaitSec };
play(base, '봇 그대로', () => {});
play(base, '급한 테이블 직접 서빙 안 함', () => { B.urgentRatio = 9; B.passWaitSec = 99; });
B.urgentRatio = keep.u; B.passWaitSec = keep.w;
play(base, '보이는 국밥 전부 직접 서빙', () => { B.urgentRatio = 0; B.passWaitSec = 0; });
B.urgentRatio = keep.u; B.passWaitSec = keep.w;
play(base, '키오스크 없음', (s) => { s.kiosk = false; });
play(base, '반응 1.0초(사람이 늦게 봄)', (_s, b) => { b.reaction = 1.0; });
play(base, '탭 0.9/초', (_s, b) => { b.tapsPerSec = 0.9; });
play(base, '주방장 1명뿐', (s) => { const cs = s.staff.filter((m) => m.role === 'chef'); s.staff = s.staff.filter((m) => m.role !== 'chef' || m === cs[0]); });
