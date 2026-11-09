import { expect, test } from '@playwright/test';

type W = { __guck: { start(seed: number, tut?: boolean, preset?: string): void; bot(on: boolean, t?: number): void; runOverlap(sec: number): Array<[string, number]>;
  state(): { stage: number; staff: unknown[]; phase: string; dayState: { teams: Array<{ state: string }>; cats: Array<{ kind: string }> } | null; lastReport: { sold: number } | null } } };

test('5단계: 직원 풀세트 + 가게 4단계 하루 — 관통 0, 스크린샷', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?debug=overlap&seed=21');
  await page.waitForFunction(() => !!(window as unknown as W).__guck);
  await page.evaluate(() => { const g = (window as unknown as W).__guck; g.start(21, false, 'full'); g.bot(true, 1.3); });
  const st = await page.evaluate(() => (window as unknown as W).__guck.state());
  expect(st.stage).toBe(3);
  expect(st.staff.length).toBe(6);
  // 실제 시간으로 잠깐 돌려 화면을 찍는다
  await page.waitForFunction(() => { const d = (window as unknown as W).__guck.state().dayState; return !!d && d.teams.filter((t) => t.state === 'seated').length >= 5; }, null, { timeout: 90000 });
  await page.screenshot({ path: 'docs/shots/05-staff-full.png' });
  // 나머지 하루는 렌더 없이 빠르게 (sim + 뷰 + 겹침 검사 매 틱)
  const rep = await page.evaluate(() => (window as unknown as W).__guck.runOverlap(200));
  const over = rep.filter(([, v]) => v > 0.02);
  console.log('겹침 최악 5개:', JSON.stringify(rep.slice(0, 5)), '0.02 초과', over.length);
  const sold = await page.evaluate(() => (window as unknown as W).__guck.state().lastReport?.sold ?? -1);
  console.log('판매', sold);
  expect(sold).toBeGreaterThan(30);
  expect(over).toEqual([]);
  expect(errors).toEqual([]);
});
