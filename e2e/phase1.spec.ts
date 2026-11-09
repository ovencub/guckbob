import { expect, test } from '@playwright/test';

test('1단계: 정적 가게 장면 — 모바일 세로 + PC 가운데 세로 캔버스', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./?scene=ref');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'docs/shots/01-static-390x844.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/shots/01-static-1440x900.png' });
  const box = await page.locator('#app').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(480);
  expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThan(2);
  expect(errors.filter((e) => !e.includes('fonts.g'))).toEqual([]);
});
