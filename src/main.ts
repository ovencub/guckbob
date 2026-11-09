import './ui/styles.css';
import { installDebug } from './debug';
import { Game } from './game';
import { Renderer } from './render/renderer';
import { buildStaticScene } from './render/staticScene';
import { startDay } from './sim/sim';
import { newGame } from './sim/state';

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
  const seed = Number(params.get('seed') ?? Date.now() % 1e9);
  const s = newGame(seed);
  s.tutorial = false;
  const game = new Game(s, canvas, ui, {
    onEvent: () => {},
    onTap: () => {},
    onDayEnd: () => { game.toasts.banner('마감!', 1.2); },
    sound: { muted: false, toggle() { this.muted = !this.muted; } },
  });
  const dbg = params.get('debug');
  if (dbg) installDebug(game, dbg);
  if (params.get('preset') === 'full' && dbg) (window as unknown as { __guck: { preset(n: string): void } }).__guck.preset('full');
  startDay(s);
  game.toasts.banner('영업 시작!', 1);
  const loop = (now: number) => { game.frame(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
