// 레퍼런스(design/style-preview.html)를 390×844에서 열어 폰 프레임 영역만 docs/shots/00-reference.png 로 저장한다.
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(resolve('design/style-preview.html')).href);
await page.waitForTimeout(4500);
await page.locator('#phone').screenshot({ path: 'docs/shots/00-reference.png' });
await browser.close();
console.log('saved docs/shots/00-reference.png');
