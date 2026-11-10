// 디버그 도구 (?debug=1 또는 ?debug=overlap). window.__guck 로 e2e 가 조작한다.
import * as THREE from 'three';
import { SIM_DT } from './data/balance';
import { applyPreset, nearMichelin } from './debugPreset';
import type { App } from './app';
import type { Game } from './game';
import { OverlapLog } from './render/overlap';
import { PlayerBot } from './sim/bot';
import * as cmd from './sim/commands';
import { step } from './sim/sim';
import type { GameState, SimEvent } from './sim/types';

export interface DebugApi {
  game: Game;
  app?: App;
  start(seed: number, tutorial?: boolean, preset?: 'full' | 'near'): void;
  state(): GameState;
  cmd: typeof cmd;
  bot(on: boolean, taps?: number): void;
  overlapStart(): void;
  overlapReport(): Array<[string, number]>;
  runOverlap(seconds: number): Array<[string, number]>;
  preset(name: 'full'): void;
  fast(seconds: number): void;
  drawCalls(): number;
  nearMichelin(): void;
  targets(): Array<{ kind: string; id: number; x: number; y: number; w: number; h: number }>;
}

export function installDebug(game: Game, mode: string, app?: App): DebugApi {
  let bot: PlayerBot | null = null;
  const botEv: SimEvent[] = [];
  const api: DebugApi = {
    game,
    app,
    start(seed, tutorial = false, preset) {
      document.querySelectorAll('.overlay.start').forEach((n) => n.remove());
      app!.newGame('고양이 국밥', seed, (s) => { s.tutorial = tutorial; if (preset) applyPreset(s, preset); });
      game.s.tutorial = tutorial;
      if (!tutorial && game.s.dayState) game.s.dayState.scriptedLeft = 0;
    },
    state: () => game.s,
    cmd,
    bot(on, taps = 2.0) {
      bot = on ? new PlayerBot(taps) : null;
      api.game.botTick = bot ? (dt: number) => { bot!.tick(api.game.s, dt, botEv); api.game.feed(botEv); } : null;
    },
    overlapStart() { game.world.overlap = new OverlapLog(); },
    overlapReport() { return game.world.overlap ? game.world.overlap.report() : []; },
    /** 렌더 없이 sim + 뷰 + 겹침 검사를 빠르게 (레퍼런스 overlapReport 와 같은 방식) */
    runOverlap(seconds) {
      if (!game.world.overlap) game.world.overlap = new OverlapLog();
      const ev: SimEvent[] = [];
      const n = Math.round(seconds / SIM_DT);
      for (let i = 0; i < n; i++) {
        if (!game.s.dayState || game.s.phase === 'settle') break;
        if (bot) bot.tick(game.s, SIM_DT, ev);
        step(game.s, ev);
        game.feed(ev);
        game.world.update(game.s, 1, SIM_DT);
      }
      return game.world.overlap.report();
    },
    preset(name) { applyPreset(game.s, name); game.world.sync(game.s); },
    fast(seconds) {
      const ev: SimEvent[] = [];
      for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
        if (bot) bot.tick(game.s, SIM_DT, ev);
        step(game.s, ev);
        game.feed(ev);
      }
    },
    drawCalls: () => game.r.drawCalls,
    /** 탭 대상 히트박스의 화면 위치·크기 (px) */
    targets() {
      const out: Array<{ kind: string; id: number; x: number; y: number; w: number; h: number }> = [];
      const r = game.r.canvas.getBoundingClientRect();
      for (const o of game.world.hits) {
        const m = o as THREE.Mesh;
        m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const cx of [b.min.x, b.max.x]) for (const cy of [b.min.y, b.max.y]) for (const cz of [b.min.z, b.max.z]) {
          const p = game.r.toScreen(new THREE.Vector3(cx, cy, cz), { x: 0, y: 0 });
          x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
        }
        const c = game.r.toScreen(m.getWorldPosition(new THREE.Vector3()), { x: 0, y: 0 });
        out.push({ kind: o.userData.kind as string, id: o.userData.id as number, x: c.x + r.left, y: c.y + r.top, w: x1 - x0, h: y1 - y0 });
      }
      return out;
    },
    nearMichelin() { nearMichelin(game.s); game.world.sync(game.s); },
  };
  (window as unknown as { __guck: DebugApi }).__guck = api;
  if (mode === 'overlap') {
    api.overlapStart();
    setInterval(() => {
      const over = game.world.overlap!.over();
      console.log(`겹침 검사: 관통 0.02 초과 ${over.length}건`, JSON.stringify(over.slice(0, 10)));
    }, 5000);
  }
  return api;
}

