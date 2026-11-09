import { expect, test } from '@playwright/test';

type W = { __guck: { start(seed: number, tut?: boolean, preset?: string): void; bot(on: boolean, t?: number): void; fast(sec: number): void; nearMichelin(): void;
  app: { enterPrep(): void }; state(): { phase: string; tutorial: boolean; day: number; dayState: unknown } } };

test('7단계: 튜토리얼 손가락 표시 + 건너뛰기', async ({ page }) => {
  await page.goto('./?debug=1&seed=3');
  await page.waitForFunction(() => !!(window as unknown as W).__guck);
  await page.getByRole('button', { name: '새로 시작' }).click();
  await page.getByRole('button', { name: '정하기' }).click();
  await expect(page.locator('.tut-bub')).toBeVisible();
  await page.waitForFunction(() => document.querySelector('.tut-bub')?.textContent?.includes('주문') ?? false, null, { timeout: 20000 });
  await page.screenshot({ path: 'docs/shots/07-tutorial.png' });
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.locator('.tut')).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as W).__guck.state().tutorial)).toBe(false);
});

test('7단계: 미슐랭 엔딩 → 결과 → 공유 링크 → 도전장 화면', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?debug=1&seed=4');
  await page.waitForFunction(() => !!(window as unknown as W).__guck);
  await page.evaluate(() => { const g = (window as unknown as W).__guck; g.start(4, false, 'near'); g.bot(true, 2); g.fast(119);
    (g.state() as unknown as { reviews: number[] }).reviews = Array.from({ length: 50 }, () => 5); g.fast(40); });
  await expect(page.locator('.settle .paper')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page.locator('.ending')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'docs/shots/07-ending.png' });
  await page.locator('.ending').click({ force: true, timeout: 3000 }).catch(() => {});
  await expect(page.locator('.r-big')).toContainText('일 만에 미슐랭!');
  await page.screenshot({ path: 'docs/shots/07-result.png', fullPage: false });
  // 공유 링크 생성 (Web Share 없음 → 클립보드)
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: '자랑하기' }).click();
  await page.waitForTimeout(800);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const m = clip.match(/\?r=([A-Za-z0-9_-]+)/);
  expect(m).not.toBeNull();
  const p2 = await context.newPage();
  await p2.goto(`./?r=${m![1]}`);
  await expect(p2.locator('.challenge')).toContainText('일 만에 미슐랭');
  await expect(p2.getByRole('button', { name: '나도 도전하기' })).toBeVisible();
  await p2.screenshot({ path: 'docs/shots/07-challenge.png' });
  expect(errors).toEqual([]);
});

test('7단계: 잘못된 ?r= 는 무시하고 일반 시작 화면', async ({ page }) => {
  const long = Buffer.from(JSON.stringify({ v: 1, n: '가'.repeat(30), d: 5, m: 10, s: 4, c: 10, t: 0 })).toString('base64url');
  const range = Buffer.from(JSON.stringify({ v: 1, n: '냥', d: -3, m: 10, s: 9, c: 10, t: 0 })).toString('base64url');
  for (const r of ['%%%broken', 'abc', long, range]) {
    await page.goto(`./?r=${r}`);
    await expect(page.getByRole('button', { name: '새로 시작' })).toBeVisible();
    await expect(page.locator('.challenge')).toHaveCount(0);
  }
});
