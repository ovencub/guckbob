import { expect, test } from '@playwright/test';

type W = { __guck: { start(seed: number): void; app: { enterPrep(): void }; state(): { money: number; phase: string } } };

test('PC: 정비 목록이 마우스 휠·드래그로 스크롤된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./?debug=1&seed=2');
  await page.waitForFunction(() => !!(window as unknown as W).__guck);
  await page.evaluate(() => {
    const g = (window as unknown as W).__guck;
    document.querySelectorAll('.overlay.start').forEach((n) => n.remove());
    const s = g.state() as unknown as { money: number; phase: string };
    s.money = 3_000_000; s.phase = 'prep';
    const st = s as unknown as { staff: Array<{ id: number; role: string; grade: number; name: string; fur: number }>; nextStaffId: number };
    for (const role of ['chef', 'chef', 'server', 'server', 'dish']) st.staff.push({ id: st.nextStaffId++, role, grade: 0, name: '나비', fur: 0 });
    g.app.enterPrep();
  });
  const list = page.locator('.plist');
  await expect(list).toBeVisible();
  await page.waitForTimeout(500); // 시트가 올라오는 0.25초 연출이 끝난 뒤
  const dims = await list.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
  expect(dims.sh).toBeGreaterThan(dims.ch); // 내용이 넘친다 = 스크롤 가능
  const box = (await list.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  const afterWheel = await list.evaluate((el) => el.scrollTop);
  expect(afterWheel).toBeGreaterThan(50);
  await list.evaluate((el) => { el.scrollTop = 0; });
  await page.mouse.move(box.x + 30, box.y + box.height - 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 40, { steps: 8 });
  await page.mouse.up();
  const afterDrag = await list.evaluate((el) => el.scrollTop);
  expect(afterDrag).toBeGreaterThan(50);
  // 드래그 뒤에 구매 버튼이 눌리지 않았다
  expect(await page.evaluate(() => (window as unknown as W).__guck.state().money)).toBe(3_000_000);
});
