import './ui/styles.css';
import './ui/screens.css';
import { App } from './app';
import { installDebug } from './debug';
import { Renderer } from './render/renderer';
import { buildStaticScene } from './render/staticScene';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const params = new URLSearchParams(location.search);

if (params.get('scene') === 'ref') {
  const r = new Renderer(canvas);
  const tick = buildStaticScene(r);
  r.resize();
  const t0 = performance.now();
  const loop = (now: number) => { tick((now - t0) / 1000); r.render(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
} else {
  const app = new App(canvas, ui);
  const dbg = params.get('debug');
  if (dbg) installDebug(app.game, dbg, app);
  app.showStart();
}
