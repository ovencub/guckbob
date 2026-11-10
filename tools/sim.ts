// 밸런스 봇 시뮬레이션: npm run sim -- --days 40 --seeds 5 --tap 1.3 [--tap 0.9,1.3,2.0] [--report docs/balance-report.md]
// 플레이 시간 = 일수 × (영업 120초 + UI 연출 시간 합 + 정비 15초 + 구매당 4초). UI 연출 시간은 data 값에서 계산한다.
import { writeFileSync } from 'node:fs';
import { DAY, SIM_DT } from '../src/data/balance';
import { BOT } from '../src/data/bot';
import { TIERS, TIER_MICHELIN } from '../src/data/tiers';
import { PLAYTIME, TIMING } from '../src/data/view';
import { PlayerBot } from '../src/sim/bot';
import { botShop, type PlanCursor } from '../src/sim/botPlan';
import { finishSettle, startDay, step } from '../src/sim/sim';
import { newGame } from '../src/sim/state';
import type { DayReport, SimEvent } from '../src/sim/types';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const DAYS = Number(arg('days', '40'));
const SEEDS = Number(arg('seeds', '5'));
const TAPS = arg('tap', '1.3').split(',').map(Number);
const REPORT = arg('report', '');
const SEED0 = Number(arg('seed0', '1000'));
const HUMAN = process.argv.includes('--human');

export interface RunResult { seed: number; tap: number; reached: Record<string, number>; days: number; minutes: number; michelin: boolean; rows: Array<DayReport & { buys: number; minutes: number; money: number; rating: number; tier: number; bought: string[] }> }

function uiSeconds(r: DayReport, overtime: number): number {
  const lines = 7 + r.wages.length;
  const receipt = Math.min(TIMING.receiptMaxSec, TIMING.screenSec + lines * TIMING.receiptLineSec);
  const tierUp = r.tierAfter > r.tierBefore ? TIMING.tierUpSec : 0;
  return DAY.countdownSec + overtime + receipt + TIMING.screenSec * 2 + tierUp;
}

export function runGame(seed: number, tap: number, days = DAYS, human = HUMAN): RunResult {
  const s = newGame(seed);
  const bot = new PlayerBot(tap, human ? 0.7 : undefined);
  if (human) bot.human = { lapseEvery: [8, 15], lapseSec: [1.5, 3], miss: 0.25, seed: seed * 7 + 1 };
  const cur: PlanCursor = { i: 0 };
  const ev: SimEvent[] = [];
  let minutes = 0;
  const reached: Record<string, number> = {};
  const rows: RunResult['rows'] = [];
  for (let d = 1; d <= days; d++) {
    startDay(s);
    while (s.phase !== 'settle') {
      bot.tick(s, SIM_DT, ev);
      step(s, ev);
      ev.length = 0;
    }
    const overtime = s.dayState!.overT;
    const r = s.lastReport!;
    if (r.tierAfter > r.tierBefore) for (let t = r.tierBefore + 1; t <= r.tierAfter; t++) reached[TIERS[t].name] = d;
    finishSettle(s);
    const done = s.tier >= TIER_MICHELIN;
    const bought: string[] = [];
    const buys = done ? 0 : botShop(s, cur, bought);
    minutes += (DAY.openSec + uiSeconds(r, overtime) + (done ? 0 : PLAYTIME.prepBaseSec + PLAYTIME.prepPerBuySec * buys)) / 60;
    rows.push({ ...r, buys, minutes, money: s.money, rating: r.ratingAfter, tier: s.tier, bought });
    if (done) return { seed, tap, reached, days: d, minutes, michelin: true, rows };
    s.phase = 'prep';
  }
  return { seed, tap, reached, days, minutes, michelin: false, rows };
}

const median = (xs: number[]) => { const a = [...xs].sort((p, q) => p - q); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const won = (n: number) => Math.round(n).toLocaleString('ko-KR');

function main(): void {
  const all: RunResult[] = [];
  const md: string[] = ['# 밸런스 봇 리포트', '', `생성: \`npm run sim -- --days ${DAYS} --seeds ${SEEDS} --tap ${TAPS.join(',')}\``, ''];
  const summary: string[] = ['| 봇 | 미슐랭 도달일(중앙값) | 플레이 시간(중앙값) | 시드별 도달일 | 시드별 분 | 목표 |', '|---|---|---|---|---|---|'];
  for (const tap of TAPS) {
    const rs: RunResult[] = [];
    for (let k = 0; k < SEEDS; k++) {
      const t0 = Date.now();
      const r = runGame(SEED0 + k, tap);
      rs.push(r); all.push(r);
      console.log(`tap ${tap} seed ${r.seed}: ${r.michelin ? `미슐랭 ${r.days}일` : `미달(${r.days}일)`} ${r.minutes.toFixed(1)}분 tiers ${JSON.stringify(r.reached)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
    const dm = median(rs.map((r) => (r.michelin ? r.days : 99)));
    const mm = median(rs.map((r) => r.minutes));
    const goal = tap === 1.3 ? `${BOT.targetDays[0]}~${BOT.targetDays[1]}일, ${BOT.targetMinutes[0]}~${BOT.targetMinutes[1]}분` : tap < 1.3 ? '30일 이내, 80분 이내' : '평균보다 같거나 빠름, 45분 이상';
    summary.push(`| 탭 ${tap}/초 | ${dm === 99 ? '미달' : `${dm}일`} | ${mm.toFixed(1)}분 | ${rs.map((r) => (r.michelin ? r.days : '–')).join(' / ')} | ${rs.map((r) => r.minutes.toFixed(0)).join(' / ')} | ${goal} |`);
    console.log(`== tap ${tap}: 중앙값 ${dm}일 ${mm.toFixed(1)}분`);
  }
  md.push('## 요약', '', ...summary, '');
  const avg = all.filter((r) => r.tap === 1.3);
  if (avg.length) {
    const d1 = avg.map((r) => r.rows[0]);
    const q10 = avg.map((r) => Math.max(...r.rows.filter((d) => d.day >= 10).map((d) => d.peakQueue)));
    md.push('## 추가 기준 (탭 1.3 봇)', '',
      `- 1일차 순이익: ${d1.map((d) => won(d.net)).join(' / ')} → ${d1.every((d) => d.net > 0) ? '전부 양수 ✓' : '음수 있음 ✗'}`,
      `- 1일차 화난 손님 팀 수: ${d1.map((d) => d.angryTeams).join(' / ')} → ${d1.every((d) => d.angryTeams <= 3) ? '3팀 이하 ✓' : '초과 ✗'}`,
      `- 10일차 이후 웨이팅 줄 최대(팀): ${q10.join(' / ')} → ${q10.every((q) => q > 0) ? '줄 생김 ✓' : '줄 없음 ✗'}`, '');
  }
  for (const tap of TAPS) {
    const rs = all.filter((r) => r.tap === tap);
    md.push(`## 탭 ${tap}/초 — 시드별 티어 도달일`, '', '| 시드 | ' + TIERS.slice(1).map((t) => t.name).join(' | ') + ' | 분 |', '|---|' + TIERS.slice(1).map(() => '---|').join('') + '---|');
    for (const r of rs) md.push(`| ${r.seed} | ${TIERS.slice(1).map((t) => r.reached[t.name] ?? '–').join(' | ')} | ${r.minutes.toFixed(1)} |`);
    md.push('');
    const ex = rs[0];
    md.push(`### 탭 ${tap}/초 시드 ${ex.seed} 일별`, '', '| 일 | 판매 | 매출 | 순익 | 별점 | 티어 | 보유금 | 화남 | 놓침 | 웨이팅 최대 | 구매 | 누적 분 |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const d of ex.rows) md.push(`| ${d.day} | ${d.sold} | ${won(d.revenue)} | ${won(d.net)} | ${d.rating.toFixed(2)} | ${TIERS[d.tier].name} | ${won(d.money)} | ${d.angry} | ${d.missed} | ${d.peakQueue} | ${d.buys} | ${d.minutes.toFixed(1)} |`);
    md.push('');
  }
  if (REPORT) writeFileSync(REPORT, md.join('\n') + '\n', 'utf8');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/sim.ts')) main();
