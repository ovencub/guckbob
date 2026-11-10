import { expect, test } from '@playwright/test';

type T = { kind: string; id: number; x: number; y: number; w: number; h: number };
type W = { __guck: { start(seed: number, tut?: boolean, preset?: string): void; targets(): T[]; drawCalls(): number; bot(on: boolean, t?: number): void;
  state(): { dayState: { tables: Array<{ dirty: boolean }>; burners: Array<{ phase: string }>; sink: number; washed: number; teams: Array<{ state: string; orderTaken: boolean; table: number }> } } } };

const SIZES = [[390, 844], [360, 780], [430, 932], [1440, 900]] as const;

test('8단계: 화면 크기별 스크린샷 + 모든 탭 대상 44px 이상', async ({ page }) => {
  await page.goto('./?debug=1&seed=8');
  await page.waitForFunction(() => !!(window as unknown as W).__guck);
  await page.evaluate(() => (window as unknown as W).__guck.start(8));
  await page.waitForTimeout(4000);
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `docs/shots/08-${w}x${h}.png` });
    const ts = await page.evaluate(() => (window as unknown as W).__guck.targets());
    const small = ts.filter((t) => Math.min(t.w, t.h) < 44);
    expect(small, `${w}x${h}`).toEqual([]);
  }
});

test('8단계: 모든 상호작용 대상을 실제 클릭으로 처리', async ({ page }) => {
  await page.goto('./?debug=1&seed=9');
  await page.waitForFunction(() => !!(window as unknown as W).__guck);
  await page.evaluate(() => (window as unknown as W).__guck.start(9));
  const g = () => page.evaluate(() => (window as unknown as W).__guck.state().dayState);
  const at = async (kind: string, id: number) => {
    const t = (await page.evaluate(() => (window as unknown as W).__guck.targets())).find((x) => x.kind === kind && x.id === id)!;
    await page.mouse.click(t.x, t.y);
  };
  // 첫 손님 착석 → 테이블 클릭으로 주문
  await page.waitForFunction(() => (window as unknown as W).__guck.state().dayState.teams.some((t) => t.state === 'seated'), null, { timeout: 30000 });
  const team = (await g()).teams.find((t) => t.state === 'seated')!;
  await at('table', team.table);
  expect((await g()).teams.find((t) => t.table === team.table)!.orderTaken).toBe(true);
  // 화구 클릭 → 조리 → 완료 클릭 → 배식대 클릭 → 서빙 (팀 인원만큼)
  const need = await page.evaluate((tb) => (window as unknown as { __guck: { state(): { dayState: { teams: Array<{ table: number; state: string; size: number }> } } } }).__guck.state().dayState.teams.find((t) => t.table === tb && t.state === 'seated')!.size, team.table);
  for (let k = 0; k < need; k++) {
    await at('burner', 0);
    expect((await g()).burners[0].phase).toBe('cooking');
    await page.waitForFunction(() => (window as unknown as W).__guck.state().dayState.burners[0].phase === 'done', null, { timeout: 10000 });
    await at('burner', 0);
    expect((await g()).burners[0].phase).toBe('empty');
    await page.waitForTimeout(300);
    await at('pass', 0);
  }
  // 식사 후 동전 클릭 → 수금, 개수대 클릭 → 설거지
  await page.waitForFunction((tb) => (window as unknown as W).__guck.state().dayState.tables[tb].dirty, team.table, { timeout: 20000 });
  await at('table', team.table);
  expect((await g()).tables[team.table].dirty).toBe(false);
  await at('sink', 0);
  expect((await g()).washed).toBeGreaterThanOrEqual(1);
});

test('8단계: 성능 기록 — 손님 최대(직원 풀세트·가게 4단계) 드로우콜', async ({ page }) => {
  await page.goto('./?debug=1&seed=10');
  await page.waitForFunction(() => !!(window as unknown as W).__guck);
  await page.evaluate(() => { const g = (window as unknown as W).__guck; g.start(10, false, 'full'); g.bot(true, 2); });
  let maxCalls = 0;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    maxCalls = Math.max(maxCalls, await page.evaluate(() => (window as unknown as W).__guck.drawCalls()));
  }
  const fps = await page.evaluate(() => new Promise<number>((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
  console.log(`PERF drawCallsMax=${maxCalls} fps(swiftshader)=${fps.toFixed(1)}`);
  expect(maxCalls).toBeGreaterThan(0);
});
