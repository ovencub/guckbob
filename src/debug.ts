// 디버그 도구 (?debug=1 또는 ?debug=overlap). window.__guck 로 e2e 가 조작한다.
import { SIM_DT } from './data/balance';
import { applyPreset } from './debugPreset';
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
  start(seed: number, tutorial?: boolean, preset?: 'full'): void;
  state(): GameState;
  cmd: typeof cmd;
  bot(on: boolean, taps?: number): void;
  overlapStart(): void;
  overlapReport(): Array<[string, number]>;
  runOverlap(seconds: number): Array<[string, number]>;
  preset(name: 'full'): void;
  fast(seconds: number): void;
  drawCalls(): number;
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

