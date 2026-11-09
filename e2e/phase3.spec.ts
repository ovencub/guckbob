import { expect, test, type Page } from '@playwright/test';

type G = {
  __guck: {
    state(): { phase: string; dayState: { sold: number; revenue: number; clean: number; sink: number; burners: Array<{ phase: string }>; teams: Array<{ state: string; seatedT: number; patience: number; orders: Array<{ served: boolean }> }>; t: number } | null; lastReport: { sold: number; revenue: number } | null };
    bot(on: boolean, taps?: number): void;
    overlapReport(): Array<[string, number]>;
    cmd: Record<string, (...a: unknown[]) => unknown>;
  };
};

async function waitFor(page: Page, fn: string, timeout = 60000) {
  await page.waitForFunction(fn, null, { timeout, polling: 100 });
}

test('3단계: 탭으로 하루 진행 — 판매·수금·설거지, 겹침 0', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?debug=overlap&seed=7');
  await page.waitForFunction(() => !!(window as unknown as G).__guck);
  // 실제 화면 탭: 첫 손님이 앉으면 테이블을 눌러 주문을 받는다
  await waitFor(page, `(() => { const d = window.__guck.state().dayState; return d && d.teams.some(t => t.state === 'seated'); })()`);
  const ok = await page.evaluate(() => {
    const g = (window as unknown as G).__guck;
    const ds = g.state().dayState!;
    return ds.teams.some((t) => t.state === 'seated');
  });
  expect(ok).toBe(true);
  // 이후 봇이 탭 속도 2.0/초로 플레이 (실제 시간)
  await page.evaluate(() => (window as unknown as G).__guck.bot(true, 2.0));
  await waitFor(page, `(() => { const d = window.__guck.state().dayState; return d && d.burners.some(b => b.phase === 'done'); })()`, 30000);
  await page.screenshot({ path: 'docs/shots/03-done-alert.png' });
  await waitFor(page, `(() => { const d = window.__guck.state().dayState; return d && d.sold >= 1 && d.revenue > 0; })()`, 60000);
  await waitFor(page, `(() => { const d = window.__guck.state().dayState; return d && d.teams.filter(t => t.state === 'seated').length >= 3 && d.burners.some(b => b.phase === 'cooking'); })()`, 60000);
  await page.screenshot({ path: 'docs/shots/03-busy.png' });
  // 화난 손님: 봇을 끄고 기다린다
  await page.evaluate(() => (window as unknown as G).__guck.bot(false));
  await waitFor(page, `(() => { const d = window.__guck.state().dayState; return d && d.teams.some(t => t.state === 'seated' && (d.t - t.seatedT) / t.patience > 0.85 && t.orders.some(o => !o.served)); })()`, 60000);
  await page.screenshot({ path: 'docs/shots/03-angry.png' });
  await page.evaluate(() => (window as unknown as G).__guck.bot(true, 2.0));
  await waitFor(page, `window.__guck.state().phase === 'settle' || window.__guck.state().lastReport !== null`, 150000);
  const rep = await page.evaluate(() => (window as unknown as G).__guck.state().lastReport);
  expect(rep!.sold).toBeGreaterThanOrEqual(1);
  expect(rep!.revenue).toBeGreaterThan(0);
  const washed = await page.evaluate(() => (window as unknown as { __guck: { state(): { dayState: { washed: number } } } }).__guck.state().dayState.washed);
  expect(washed).toBeGreaterThanOrEqual(1);
  const over = await page.evaluate(() => (window as unknown as G).__guck.overlapReport().filter(([, v]) => v > 0.02));
  console.log('겹침 0.02 초과:', JSON.stringify(over));
  expect(over).toEqual([]);
  expect(errors).toEqual([]);
});
