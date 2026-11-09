import './ui/styles.css';
import { Renderer } from './render/renderer';
import { buildStaticScene } from './render/staticScene';
import { Hud } from './ui/hud';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const r = new Renderer(canvas);
const tick = buildStaticScene(r);
const hud = new Hud(ui);
hud.update({
  money: 186400, rating: 3.2, tierName: '동네 맛집', day: 5, progress: 0.62, closed: false, clean: 4, bowls: 8, sink: 3, sinkCap: 10, queue: 3,
  tip: '완료! 뜬 화구를 눌러 배식대로 옮기세요. 늦으면 국밥이 타요.', paused: false, muted: false,
}, 186400);
r.resize();
new ResizeObserver(() => r.resize()).observe(canvas);
let t0 = performance.now();
const loop = (now: number) => {
  const t = (now - t0) / 1000;
  tick(t);
  r.render();
  requestAnimationFrame(loop);
};
void (document.fonts?.ready ?? Promise.resolve()).then(() => { t0 = performance.now(); requestAnimationFrame(loop); });
