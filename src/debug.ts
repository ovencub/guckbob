// 디버그 도구 (?debug=1 또는 ?debug=overlap). window.__guck 로 e2e 가 조작한다.
import { SIM_DT } from './data/balance';
import { CHEF } from './data/staff';
import type { Game } from './game';
import { OverlapLog } from './render/overlap';
import { PlayerBot } from './sim/bot';
import { hire } from './sim/catalog';
import * as cmd from './sim/commands';
import { step } from './sim/sim';
import type { GameState, SimEvent } from './sim/types';

export interface DebugApi {
  game: Game;
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

export function installDebug(game: Game, mode: string): DebugApi {
  let bot: PlayerBot | null = null;
  const botEv: SimEvent[] = [];
  const api: DebugApi = {
    game,
    state: () => game.s,
    cmd,
    bot(on, taps = 2.0) {
      bot = on ? new PlayerBot(taps) : null;
      game.botTick = bot ? (dt: number) => { bot!.tick(game.s, dt, botEv); game.feed(botEv); } : null;
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
    preset(name) {
      const s = game.s;
      if (name === 'full') {
        s.stage = 3; s.burners = 6; s.bowls = 30; s.sinkLevel = 3; s.kiosk = true; s.tier = 4;
        s.menus = { sundae: true, spicy: true, suyuk: true };
        s.staff = [];
        for (let i = 0; i < CHEF.max; i++) hire(s, 'chef', 3);
        hire(s, 'server', 3); hire(s, 'server', 2); hire(s, 'dish', 3);
        s.promos = [{ id: 'tv', days: 3 }, { id: 'youtube', days: 3 }];
        for (let i = 0; i < 50; i++) s.reviews.push(4.6);
        s.money = 5000000;
        game.world.sync(s);
      }
    },
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
