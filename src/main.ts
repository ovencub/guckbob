import './ui/styles.css';
import './ui/screens.css';
import './ui/extra.css';
import { App } from './app';
import { installDebug } from './debug';
import { makePlugins } from './plugins';
import { Renderer } from './render/renderer';
import { buildStaticScene } from './render/staticScene';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const params = new URLSearchParams(location.search);
// 디버그 치트는 개발·로컬 미리보기에서만 (배포본에서는 숨김)
const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || import.meta.env.DEV;

if (params.get('scene') === 'ref' && local) {
  const r = new Renderer(canvas);
  const tick = buildStaticScene(r);
  r.resize();
  const t0 = performance.now();
  const loop = (now: number) => { tick((now - t0) / 1000); r.render(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
} else {
  const { plugins, attach } = makePlugins(params);
  const app = new App(canvas, ui, plugins);
  attach(app);
  const dbg = params.get('debug');
  if (dbg && local) installDebug(app.game, dbg, app);
  const go = () => app.showStart();
  // 스프라이트 글자가 Jua 로 그려지도록 폰트를 잠깐 기다린다 (최대 1.5초)
  Promise.race([document.fonts?.load('40px Jua') ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).then(go, go);
}
