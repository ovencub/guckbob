// 배포본 확인: 캔버스 렌더링·콘솔 에러 없음·디버그 숨김. 실행: npx tsx tools/check-live.ts [url]
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'https://ovencub.github.io/guckbob/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url + '?debug=1');
await page.getByRole('button', { name: '새로 시작' }).waitFor({ timeout: 20000 });
const debugHidden = await page.evaluate(() => !(window as unknown as { __guck?: unknown }).__guck);
await page.getByRole('button', { name: '새로 시작' }).click();
await page.getByRole('button', { name: '정하기' }).click();
await page.waitForTimeout(6000);
const lit = await page.evaluate(() => {
  const c = document.getElementById('scene') as HTMLCanvasElement;
  return c.width > 0 && c.height > 0;
});
await page.screenshot({ path: 'docs/shots/09-live.png' });
console.log(JSON.stringify({ url, canvas: lit, debugHidden, errors }));
await browser.close();
