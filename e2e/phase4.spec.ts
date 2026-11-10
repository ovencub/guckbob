import { expect, test } from '@playwright/test';
import { BURNERS } from '../src/data/facilities';

type W = { __guck: { start(seed: number): void; bot(on: boolean, t?: number): void; fast(sec: number): void; state(): { phase: string; burners: number; money: number; day: number; stage: number } } };

test('4단계: 1일 → 정산 → 화구 구매 → 새로고침 → 이어하기 → 화구 3개', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?debug=1&seed=5');
  await expect(page.getByRole('button', { name: '새로 시작' })).toBeVisible();
  await page.screenshot({ path: 'docs/shots/04-start.png' });
  await page.evaluate(() => { const g = (window as unknown as W).__guck; g.start(5); g.bot(true, 2.0); g.fast(150); });
  await expect(page.locator('.settle .paper')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(3200);
  await page.screenshot({ path: 'docs/shots/04-settlement.png' });
  await page.getByRole('button', { name: '확인' }).click();
  // 티어 업 연출이 뜨면 탭해서 넘김
  const tu = page.locator('.tierup');
  if (await tu.isVisible().catch(() => false)) await tu.click();
  await expect(page.locator('.prep')).toBeVisible();
  await page.getByRole('button', { name: '시설' }).click();
  await page.screenshot({ path: 'docs/shots/04-prep.png' });
  const before = await page.evaluate(() => (window as unknown as W).__guck.state().money);
  expect(before).toBeGreaterThanOrEqual(BURNERS.costs[0]);
  await page.locator('[data-buy="burner"]').click();
  expect(await page.evaluate(() => (window as unknown as W).__guck.state().burners)).toBe(3);
  await page.reload();
  await page.getByRole('button', { name: /이어하기/ }).click();
  await expect(page.locator('.prep')).toBeVisible();
  const st = await page.evaluate(() => (window as unknown as W).__guck.state());
  expect(st.burners).toBe(3);
  expect(st.day).toBe(2);
  expect(st.money).toBe(before - BURNERS.costs[0]);
  // 잠금 이유 표시
  await page.getByRole('button', { name: '메뉴' }).click();
  await expect(page.locator('.plist')).toContainText('동네 맛집 이상');
  expect(errors).toEqual([]);
});

test('4단계: 가게 확장 연출 + 카메라 재맞춤', async ({ page }) => {
  await page.goto('./?debug=1&seed=6');
  await page.evaluate(() => {
    const g = (window as unknown as W & { __guck: { app: { enterPrep(): void }; game: { world: { sync(s: unknown): void } } } }).__guck;
    document.querySelectorAll('.overlay.start').forEach((n) => n.remove());
    const s = g.state() as unknown as { money: number; phase: string };
    s.money = 5_000_000; s.phase = 'prep';
    g.app.enterPrep();
  });
  await page.getByRole('button', { name: '시설' }).click();
  await page.locator('[data-buy="stage"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/shots/04-expand-mid.png' });
  await page.waitForTimeout(700);
  await page.locator('[data-buy="stage"]').click();
  await page.waitForTimeout(100);
  await page.locator('[data-buy="stage"]').click();
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => (window as unknown as W).__guck.state().stage)).toBe(3);
  await page.getByRole('button', { name: '다음 영업하기' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'docs/shots/04-stage4.png' });
});
